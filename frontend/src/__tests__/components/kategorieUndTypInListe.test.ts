import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { kategorienText, zeigtPunkteart, punkteartText } from '../../components/shared/eventFormatting';

// Nutzerhinweis 03.09.2026: In der Termin-GESAMTLISTE standen weder Kategorie
// noch Punkteart -- obwohl die Liste beides laengst mitliefert (GET /events
// gibt categories[] und category_names aus, point_type kommt ueber e.*).
// Im Detail waren beide Angaben da, in der Liste nicht.
//
// Die Fallen dabei:
//  1. "Typ" heisst im Detail point_type (Gottesdienst/Gemeinde), NICHT type
//     (Termin vs. Aktivitaet). Genau diese Verwechslung stand schon einmal
//     als Bug im Teamer-Detail und liess ueberall "Gemeinde" erscheinen.
//  2. Bei Pflicht-, Konfirmations- und reinen Team-Terminen gibt es keine
//     Konfi-Punkte. Das Detail blendet die Punkteart dort aus, sonst stand
//     dort irrefuehrend "Gemeinde". Die Liste muss dieselbe Regel anwenden.

const lies = (pfad: string) =>
  readFileSync(resolve(process.cwd(), pfad), 'utf8');

const adminListe = lies('src/components/admin/EventsView.tsx');
const konfiListe = lies('src/components/konfi/views/EventsView.tsx');
const teamerListe = lies('src/components/teamer/pages/TeamerEventsPage.tsx');

// TeamerEventsPage enthaelt BEIDES in einer Datei: das Detail-Modal und
// darunter die Liste. Fuer die Reihenfolge-Pruefungen zaehlt nur die Liste --
// sonst misst indexOf die Detail-Zeilen, die es dort laengst gibt.
const teamerNurListe = teamerListe.slice(
  teamerListe.indexOf('app-list-item app-list-item--events')
);

const alleDrei: Array<[string, string]> = [
  ['Leitung', adminListe],
  ['Konfi', konfiListe],
  ['Team', teamerNurListe],
];

describe('kategorienText', () => {
  it('nimmt categories[] aus der Detail- und Listenantwort', () => {
    expect(kategorienText({ categories: [{ name: 'Freizeit' }, { name: 'Musik' }] }))
      .toBe('Freizeit, Musik');
  });

  it('faellt auf category_names zurueck, wenn categories fehlt', () => {
    expect(kategorienText({ category_names: 'Gottesdienst, Diakonie' }))
      .toBe('Gottesdienst, Diakonie');
  });

  it('bevorzugt categories[] gegenueber category_names', () => {
    expect(kategorienText({
      categories: [{ name: 'Freizeit' }],
      category_names: 'veraltet',
    })).toBe('Freizeit');
  });

  it('liefert leeren Text ohne Kategorien -- die Zeile entfaellt dann', () => {
    expect(kategorienText({})).toBe('');
    expect(kategorienText({ categories: [] })).toBe('');
    expect(kategorienText({ category_names: '   ' })).toBe('');
  });
});

describe('zeigtPunkteart -- gleiche Regel wie im Detail', () => {
  it('zeigt die Art bei einem normalen Termin mit Punkten', () => {
    expect(zeigtPunkteart({ points: 5 })).toBe(true);
  });

  it('verschweigt sie ohne Punkte', () => {
    expect(zeigtPunkteart({ points: 0 })).toBe(false);
    expect(zeigtPunkteart({})).toBe(false);
  });

  it('verschweigt sie bei Pflichtterminen', () => {
    expect(zeigtPunkteart({ points: 5, mandatory: true })).toBe(false);
  });

  it('verschweigt sie bei der Konfirmation', () => {
    expect(zeigtPunkteart({ points: 5, is_konfirmation: true })).toBe(false);
  });

  it('verschweigt sie bei reinen Team-Terminen', () => {
    expect(zeigtPunkteart({ points: 5, teamer_only: true })).toBe(false);
  });
});

describe('punkteartText', () => {
  it('nennt Gottesdienst beim Namen', () => {
    expect(punkteartText({ point_type: 'gottesdienst' })).toBe('Gottesdienst');
  });

  it('nennt Gemeinde beim Namen', () => {
    expect(punkteartText({ point_type: 'gemeinde' })).toBe('Gemeinde');
  });

  it('faellt ohne Angabe auf Gemeinde zurueck -- wie im Detail', () => {
    expect(punkteartText({})).toBe('Gemeinde');
  });
});

describe('Kategorie und Punkteart stehen in allen drei Listen', () => {
  it.each(alleDrei)('%s: die Liste zeigt die Kategorien', (_rolle, quelle) => {
    expect(quelle).toContain('kategorienText(event)');
    expect(quelle).toContain('app-icon-color--category');
  });

  it.each(alleDrei)('%s: die Liste zeigt die Punkteart', (_rolle, quelle) => {
    expect(quelle).toContain('zeigtPunkteart(event)');
    expect(quelle).toContain('punkteartText(event)');
  });

  it.each(alleDrei)('%s: die Punkteart kommt aus point_type, nicht aus type', (_rolle, quelle) => {
    // Die Zeile faerbt und beschriftet sich nach point_type. Ein Vergleich
    // auf `type` waere die alte Verwechslung (Event-Art statt Punkteart).
    expect(quelle).toContain("event.point_type === 'gottesdienst'");
  });

  it.each(alleDrei)('%s: die Punkteart steht direkt hinter den Punkten', (_rolle, quelle) => {
    // Punkte und ihre Art gehoeren zusammen in eine Zeile -- die Punkteart
    // darf nicht in einen anderen Block abrutschen.
    const punkte = quelle.indexOf('app-icon-color--points');
    const art = quelle.indexOf('zeigtPunkteart(event)');
    expect(punkte).toBeGreaterThan(-1);
    expect(art).toBeGreaterThan(punkte);
    // Dazwischen liegt nur der Abschluss der Punkte-Anzeige, keine neue
    // Meta-Zeile (die begaenne mit einem eigenen div).
    expect(quelle.slice(punkte, art)).not.toContain('className="app-list-item__meta"');
  });

  it.each(alleDrei)('%s: die Kategorien stehen nach dem Ort', (_rolle, quelle) => {
    const ort = quelle.indexOf('app-icon-color--location');
    const kategorie = quelle.indexOf('app-icon-color--category');
    expect(ort).toBeGreaterThan(-1);
    expect(kategorie).toBeGreaterThan(ort);
  });
});

describe('Die Listen-Route liefert die Daten weiterhin mit', () => {
  // Gegenprobe zur Anzeige: Ohne diese Felder in GET /events bliebe die
  // Karte leer, ohne dass ein Frontend-Test das merkt.
  const lesen = lies('../backend/routes/events/lesen.js');

  it('GET /events gibt die Kategorienamen aus', () => {
    expect(lesen).toContain('as category_names');
  });

  it('GET /events baut das categories-Array', () => {
    expect(lesen).toContain('categories: categories');
  });
});
