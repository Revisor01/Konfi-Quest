import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Befund 06.09.2026 (Prod-Event 130 "Teamerfreizeit", Org 1):
// Ein offener Termin stand in der Leitungs-Detailansicht als "Geschlossen".
//
// Die Ursache lag im Zusammenspiel zweier Stellen:
//   Backend  — GET /events/:id lieferte kein registration_status (nur die
//              Liste GET /events berechnete ihn).
//   Frontend — calculateRegistrationStatus reichte den fehlenden Wert
//              unveraendert weiter, und getStatusText() fiel durch die ganze
//              Kette bis zum abschliessenden `return 'Geschlossen'`.
//
// Sichtbar wurde es nur bei Terminen ohne Frist und ohne Kapazitaet, weil
// sonst eine vorgelagerte Bedingung (Warteliste, Ausgebucht, Vergangen,
// Pflicht, Abgesagt) das Durchfallen verdeckte.
//
// Der Gegenbeweis stand im selben Code: OHNE Verbindung nimmt die Ansicht
// den Stand aus dem Listen-Cache, der das Feld hat -- derselbe Termin stand
// offline korrekt auf "Offen" und kippte beim naechsten Online-Laden.
//
// Dieser Test sichert BEIDE Haelften: dass das Backend den Wert mitliefert,
// und dass die Anzeige bei einem fehlenden Wert nicht "Geschlossen" behauptet.

const lies = (pfad: string) =>
  readFileSync(resolve(process.cwd(), pfad), 'utf8');

const adminDetail = lies('src/components/admin/views/EventDetailView.tsx');
const backendLesen = lies('../backend/routes/events/lesen.js');

describe('Anmeldestatus in der Leitungs-Detailansicht (Befund 06.09.2026)', () => {
  it('das Detail-Backend berechnet den Status mit demselben Helfer wie die Liste', () => {
    // Kein zweites, handgeschriebenes SQL: genau dafuer gibt es
    // utils/terminAnmeldeStatus.js. Kopiertes SQL ist im Repo schon
    // dreimal auseinandergelaufen (siehe Kopf jener Datei).
    const detailBlock = backendLesen.slice(backendLesen.indexOf('const detailQuery'));
    expect(detailBlock).toContain('anmeldeStatusSql(');
    expect(detailBlock).toContain('kapazitaetSql(');
    expect(detailBlock).toContain('as registration_status');
    expect(detailBlock).toContain('as teamer_registration_status');
  });

  it('die Anzeige faellt bei fehlendem Wert NICHT mehr auf Geschlossen durch', () => {
    // Der Endzweig von getStatusText() war `return 'Geschlossen'`. Genau
    // dieser Zweig fing jeden undefined-Fall ab.
    const textBlock = adminDetail.slice(
      adminDetail.indexOf('const getStatusText'),
      adminDetail.indexOf('const handleAttendanceUpdate')
    );
    // 'Geschlossen' faellt jetzt nur noch bei einem AUSDRUECKLICHEN
    // closed-Status, nicht mehr als Rest.
    expect(textBlock).toContain("if (regStatus === 'closed') return 'Geschlossen';");
    expect(textBlock).not.toMatch(/\n\s*return 'Geschlossen';/);
  });

  it('bei Team-Terminen zaehlt das Teamer-Kontingent', () => {
    // registration_status rechnet ausschliesslich mit Konfi-Zahlen
    // (Migration 120). An einem teamer_only-Termin nehmen keine Konfis teil.
    const fn = adminDetail.slice(
      adminDetail.indexOf('const calculateRegistrationStatus'),
      adminDetail.indexOf('const handleEditSuccess')
    );
    expect(fn).toContain('teamer_registration_status');
    expect(fn).toContain('teamer_only');
    expect(fn).toContain('teamer_needed');
  });
});

// Die Statuskette aus EventDetailView.tsx, Zug um Zug nachgebildet.
// Ein Verhaltenstest neben den Vertragspruefungen oben: Er zeigt, was ein
// Mensch auf dem Bildschirm liest.
type Termin = {
  registration_status?: string;
  teamer_registration_status?: string;
  teamer_only?: boolean;
  teamer_needed?: boolean;
  mandatory?: boolean;
  max_participants: number;
  registered_count: number;
  waitlist_enabled?: boolean;
};

const statusErmitteln = (t: Termin): string | undefined => {
  const nurTeam = !!(t.teamer_only || t.teamer_needed);
  if (nurTeam && t.teamer_registration_status && t.teamer_registration_status !== 'none') {
    const s = t.teamer_registration_status;
    return s === 'waitlist' ? 'open' : s;
  }
  return t.registration_status;
};

const anzeigetext = (t: Termin): string => {
  // Abgesagt/Konfirmation/Vergangen liegen davor und sind hier nicht im Spiel.
  const regStatus = statusErmitteln(t);
  if (regStatus === 'mandatory') return 'Pflichttermin';
  const istVoll = t.max_participants > 0 && t.registered_count >= t.max_participants;
  if (istVoll && t.waitlist_enabled) return 'Warteliste';
  if (istVoll) return 'Ausgebucht';
  if (regStatus === 'open') return 'Offen';
  if (regStatus === 'upcoming') return 'Bald';
  if (regStatus === 'closed') return 'Geschlossen';
  return 'Termin';
};

describe('Statustext der Detailansicht', () => {
  // Der echte Fall, Feld fuer Feld wie Event 130.
  const teamerfreizeit: Termin = {
    registration_status: 'open',
    teamer_registration_status: 'open',
    teamer_only: true,
    mandatory: false,
    max_participants: 0,
    registered_count: 0,
    waitlist_enabled: false
  };

  it('Teamerfreizeit ohne Fristen und ohne Kapazitaet steht auf Offen', () => {
    expect(anzeigetext(teamerfreizeit)).toBe('Offen');
  });

  it('ohne Status vom Backend wird nichts behauptet statt Geschlossen', () => {
    // Genau der Zustand vor dem Fix: das Feld fehlte in der Detailantwort.
    const ohneStatus: Termin = {
      ...teamerfreizeit,
      registration_status: undefined,
      teamer_registration_status: undefined
    };
    expect(anzeigetext(ohneStatus)).not.toBe('Geschlossen');
    expect(anzeigetext(ohneStatus)).toBe('Termin');
  });

  it('volles Teamer-Kontingent mit Warteliste bleibt anmeldbar', () => {
    const wartelistig: Termin = { ...teamerfreizeit, teamer_registration_status: 'waitlist' };
    expect(anzeigetext(wartelistig)).toBe('Offen');
  });

  it('geschlossenes Teamer-Kontingent meldet Geschlossen', () => {
    const zu: Termin = { ...teamerfreizeit, teamer_registration_status: 'closed' };
    expect(anzeigetext(zu)).toBe('Geschlossen');
  });

  it('bei Team-Terminen schlaegt der Konfi-Status nicht durch', () => {
    // Ein ausgebuchtes Konfi-Kontingent darf das Team nicht aussperren --
    // die beiden Kontingente sind unabhaengig.
    const gemischt: Termin = {
      registration_status: 'closed',
      teamer_registration_status: 'open',
      teamer_needed: true,
      max_participants: 0,
      registered_count: 0
    };
    expect(anzeigetext(gemischt)).toBe('Offen');
  });

  it('reiner Konfi-Termin nutzt weiter den Konfi-Status', () => {
    const konfiTermin: Termin = {
      registration_status: 'closed',
      teamer_registration_status: 'none',
      teamer_only: false,
      teamer_needed: false,
      max_participants: 0,
      registered_count: 0
    };
    expect(anzeigetext(konfiTermin)).toBe('Geschlossen');
  });

  it('ein wirklich geschlossener Termin sagt das weiterhin', () => {
    const geschlossen: Termin = {
      registration_status: 'closed',
      max_participants: 0,
      registered_count: 0
    };
    expect(anzeigetext(geschlossen)).toBe('Geschlossen');
  });

  it('Pflichttermin und Ausgebucht bleiben unveraendert', () => {
    expect(anzeigetext({ registration_status: 'mandatory', max_participants: 0, registered_count: 0 }))
      .toBe('Pflichttermin');
    expect(anzeigetext({ registration_status: 'open', max_participants: 5, registered_count: 5 }))
      .toBe('Ausgebucht');
    expect(anzeigetext({ registration_status: 'open', max_participants: 5, registered_count: 5, waitlist_enabled: true }))
      .toBe('Warteliste');
  });
});
