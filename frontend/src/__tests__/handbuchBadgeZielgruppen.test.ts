// Handbuch-Tabelle "Prüfen, ob die Bedingung zur Zielgruppe passt" gegen den
// Code (Audit 26.09.2026, Screens Leitung BF-09).
//
// Das Handbuch fuehrte "Pflicht-Anwesenheit" fuer Teamer:innen als "nur im
// Bestand" und versprach dazu: "Ein Badge dieser Art, das es schon gibt, wird
// aber weiterhin ganz normal vergeben." Der Teamer-Zweig der Badge-Pruefung
// (backend/routes/badges.js, checkAndAwardTeamerBadges) kennt den Fall aber
// nicht -- ein solches Badge wird nie vergeben.
//
// Der Waechter liest die Teamer-Spalte der Tabelle und prueft sie an zwei
// Stellen im Code:
//  - "nur im Bestand": der Teamer-Zweig wertet die Bedingung aus (vergeben)
//    UND das Formular bietet sie Teamer:innen nicht an (TEAMER_HIDDEN_TYPES);
//  - "nein": der Teamer-Zweig wertet sie nicht aus.
// Dazu stimmt das Zahlwort im Absatz "Nur im Bestand heißt: Diese ...".

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

const handbuch = lies('../docs/handbuch/60-badges.md');
const badgesJs = lies('../backend/routes/badges.js');
const formular = lies('src/components/admin/modals/BadgeManagementModal.tsx');

// Zeilenbeschriftung der Tabelle -> criteria_type (Namen wie in BadgesView).
const TYPEN: Record<string, string[]> = {
  'Gesamtpunkte, Gottesdienst, Gemeinde, Beide Kategorien': ['total_points', 'gottesdienst_points', 'gemeinde_points', 'both_categories'],
  'Bonuspunkte': ['bonus_points'],
  'Aktivitäten & Events': ['activity_count'],
  'Event-Teilnahmen': ['event_count'],
  'Verschiedene Aktivitäten': ['unique_activities'],
  'Pflicht-Anwesenheit': ['mandatory_event_count'],
  'Spezifische Aktivität': ['specific_activity'],
  'Aktivitäts-Kombination': ['activity_combination'],
  'Kategorie-Aktivitäten': ['category_activities'],
  'Kategorie-Kombination': ['category_combination'],
  'Zeitbasiert, Serie': ['time_based', 'streak'],
  'Teamer-Jahr': ['teamer_year'],
};

function tabelle(): { bedingung: string; teamer: string }[] {
  const start = handbuch.indexOf('## Prüfen, ob die Bedingung zur Zielgruppe passt');
  expect(start).toBeGreaterThan(-1);
  const abschnitt = handbuch.slice(start).split('\n');
  const kopf = abschnitt.findIndex((z) => z.startsWith('| Bedingung'));
  expect(kopf).toBeGreaterThan(-1);
  const ende = abschnitt.findIndex((z, i) => i > kopf && !z.startsWith('|'));
  return abschnitt.slice(kopf + 2, ende)
    .map((z) => z.split('|').map((s) => s.trim()))
    .map((spalten) => ({ bedingung: spalten[1], teamer: spalten[3] }));
}

function teamerFaelle(): Set<string> {
  const start = badgesJs.indexOf('async function checkAndAwardTeamerBadges');
  const ende = badgesJs.indexOf('async function checkStreakCriteria');
  expect(start).toBeGreaterThan(-1);
  expect(ende).toBeGreaterThan(start);
  const zweig = badgesJs.slice(start, ende);
  return new Set([...zweig.matchAll(/case '([a-z_]+)'/g)].map((m) => m[1]));
}

function verborgenFuerTeamer(): Set<string> {
  const zeile = formular.match(/const TEAMER_HIDDEN_TYPES = \[([^\]]*)\]/);
  expect(zeile).not.toBeNull();
  const punkte = formular.match(/const POINTS_CRITERIA_TYPES = \[([^\]]*)\]/);
  const namen = (text: string) => [...text.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  return new Set([...namen(zeile![1]), ...(punkte ? namen(punkte[1]) : [])]);
}

describe('Handbuch Badges: Zielgruppe Teamer:innen wie im Code', () => {
  const zeilen = tabelle();
  const faelle = teamerFaelle();
  const verborgen = verborgenFuerTeamer();

  it('jede Tabellenzeile ist bekannt', () => {
    expect(zeilen.map((z) => z.bedingung).sort()).toEqual(Object.keys(TYPEN).sort());
  });

  it('"nur im Bestand": wird vergeben, ist aber nicht mehr waehlbar', () => {
    for (const z of zeilen.filter((z) => z.teamer === 'nur im Bestand')) {
      for (const typ of TYPEN[z.bedingung]) {
        expect({ typ, vergeben: faelle.has(typ) }).toEqual({ typ, vergeben: true });
        expect({ typ, verborgen: verborgen.has(typ) }).toEqual({ typ, verborgen: true });
      }
    }
  });

  it('"nein": der Teamer-Zweig wertet die Bedingung nicht aus', () => {
    for (const z of zeilen.filter((z) => z.teamer === 'nein')) {
      for (const typ of TYPEN[z.bedingung]) {
        expect({ typ, vergeben: faelle.has(typ) }).toEqual({ typ, vergeben: false });
      }
    }
  });

  it('"ja": der Teamer-Zweig wertet sie aus und das Formular bietet sie an', () => {
    for (const z of zeilen.filter((z) => z.teamer === 'ja')) {
      for (const typ of TYPEN[z.bedingung]) {
        expect({ typ, vergeben: faelle.has(typ) }).toEqual({ typ, vergeben: true });
        expect({ typ, verborgen: verborgen.has(typ) }).toEqual({ typ, verborgen: false });
      }
    }
  });

  it('das Zahlwort im Absatz "Nur im Bestand" stimmt', () => {
    const anzahl = zeilen
      .filter((z) => z.teamer === 'nur im Bestand')
      .reduce((n, z) => n + TYPEN[z.bedingung].length, 0);
    const wort = ['null', 'eine', 'zwei', 'drei', 'vier', 'fünf'][anzahl];
    expect(handbuch).toContain(`**„Nur im Bestand" heißt:** Diese ${wort} lassen sich`);
  });
});
