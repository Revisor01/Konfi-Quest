import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  FRONTEND,
  sichtbareTexteDerApp,
  nutzertexteDesBackendsGesamt,
} from './sichtbareTexte';

// ---------------------------------------------------------------------------
// Eine Sprache für App und Handbuch (UI-Audit 26.09.2026, BF-10).
//
// Die Oberfläche sagte „Events" und „Badges", das Handbuch „Termine" und
// „Abzeichen" — gezählt 92:41 und 72:33 in der App, 17:102 und 11:148 im
// Handbuch. Simons Entscheidung (27.09.2026): „Ich denke, dass Events,
// Badges, Challenges und Stempel so ein modernes App-Wording treffen."
//
// DIE REGEL (Glossar im Handbuch, Kapitel „Die App bedienen"):
//   - Wo ein Text das DING in der App benennt, heißt es Event(s), Badge(s),
//     Challenge(s), Stempel — „das Event", „das Badge", „die Challenge",
//     „der Stempel".
//   - „Termin" nur, wo der ZEITPUNKT gemeint ist (Datum, Uhrzeit).
//   - „Abzeichen" gibt es als Name nicht mehr.
//   - Zusammensetzungen mit Bindestrich: „Pflicht-Event", „Event-Name".
//
// Ob „Termin" einen Zeitpunkt meint, kann kein Test entscheiden. Deshalb
// steht jede verbleibende Stelle unten in einer Liste, mit Grund. Kommt eine
// neue dazu, fällt dieser Test — und wer ihn liest, entscheidet: Event oder
// Zeitpunkt?
// ---------------------------------------------------------------------------

const APP = sichtbareTexteDerApp(['components', 'services', 'navigation', 'utils', 'contexts', 'hooks']);
const BACKEND = nutzertexteDesBackendsGesamt();
const ALLE = [...APP, ...BACKEND];

/**
 * Stellen, an denen „Termin" den Zeitpunkt meint -- jede mit Grund. Geprüft
 * wird gegen den ganzen Text, damit ein neuer Satz mit „Termin" nicht unter
 * eine alte Ausnahme rutscht.
 */
const TERMIN_ALS_ZEITPUNKT: Array<[RegExp, string]> = [
  [/^Konfirmationstermin$/, 'Beschriftung des Konfirmationsdatums in der Konfi-Detailansicht'],
  [/^Noch kein Termin festgelegt$/, 'Konfirmationsdatum fehlt noch'],
  [/^Noch kein Termin gebucht$/, 'Konfirmationsdatum im Konfi-Profil'],
  [/^Konfirmationstermin bereits gebucht$/, 'Sperre bei der zweiten Konfirmation: es geht um das Datum'],
  [/^Du hast bereits einen Konfirmationstermin gebucht\. Bitte melde dich zuerst vom bisherigen Termin ab, bevor du einen neuen buchst\.$/, 'dieselbe Sperre, ausführlich'],
  [/^Keine Konfirmationstermine verfügbar$/, 'Liste der Konfirmationsdaten ist leer'],
  [/^Anderer Termin$/, 'Kennzeichnung: ein anderes Konfirmationsdatum ist gewählt'],
  [/^Letzter Termin:$/, 'Serienvorschau im Formular: Datum des letzten Events'],
  [/^Monate umfassen \(letzter Termin wäre$/, 'Serien-Obergrenze: das Datum des letzten Events'],
  [/^Du bist bereits zu einem Konfirmationstermin angemeldet \("$/, 'Konfirmationssperre im Backend (Text bis zum Namen)'],
  [/^Melde dich dort zuerst ab, um einen anderen Termin zu wählen\.$/, 'dieselbe Sperre, Fortsetzung'],
];

const terminStellen = () => ALLE.filter(({ text }) => /termin/i.test(text));

describe('Begriffe: eine Sprache für App und Backend', () => {
  it('„Abzeichen" steht in keinem sichtbaren Text mehr', () => {
    const treffer = ALLE.filter(({ text }) => /abzeichen/i.test(text)).map(({ ort, text }) => `${ort}: ${text}`);
    expect(treffer).toEqual([]);
  });

  it('„Termin" steht nur noch dort, wo der Zeitpunkt gemeint ist', () => {
    const offen = terminStellen()
      .filter(({ text }) => !TERMIN_ALS_ZEITPUNKT.some(([muster]) => muster.test(text)))
      .map(({ ort, text }) => `${ort}: ${text}`);
    expect(offen).toEqual([]);
  });

  it('jede Zeitpunkt-Ausnahme wird noch gebraucht', () => {
    // Sonst deckt eine veraltete Ausnahme beim nächsten Mal einen echten
    // Rückfall zu.
    const texte = terminStellen().map(({ text }) => text);
    const ungenutzt = TERMIN_ALS_ZEITPUNKT
      .filter(([muster]) => !texte.some((t) => muster.test(t)))
      .map(([muster, grund]) => `${muster} (${grund})`);
    expect(ungenutzt).toEqual([]);
  });

  it('Zusammensetzungen stehen mit Bindestrich', () => {
    // „Event Name", „Pflichtevent", „Serie-Event" standen nebeneinander.
    const muster = /\b(Event|Badge|Challenge|Stempel) (Name|Details|Grunddaten|Datum|Serie|Chat|Punkte|Status|Farbe)\b|Pflicht(event|termin)|Serie-Event/i;
    const treffer = ALLE.filter(({ text }) => muster.test(text)).map(({ ort, text }) => `${ort}: ${text}`);
    expect(treffer).toEqual([]);
  });

  it('das Muster erkennt die alten Schreibungen (Gegenprobe)', () => {
    const muster = /\b(Event|Badge|Challenge|Stempel) (Name|Details|Grunddaten|Datum|Serie|Chat|Punkte|Status|Farbe)\b|Pflicht(event|termin)|Serie-Event/i;
    for (const alt of ['Event Name *', 'Event Details', 'Keine Pflichtevents', 'Pflichttermin', 'Serie-Event löschen']) {
      expect(muster.test(alt), alt).toBe(true);
    }
    for (const neu of ['Event-Name *', 'Event-Details', 'Pflicht-Event', 'Event einer Serie löschen', 'Event absagen']) {
      expect(muster.test(neu), neu).toBe(false);
    }
  });
});

describe('Begriffe: dieselbe Suche in allen drei Rollen', () => {
  // Konfi und Team hatten „Events durchsuchen...", die Leitung „Event
  // suchen..."; bei den Badges ebenso. Ein Feld, das dasselbe tut, heißt
  // überall gleich.
  const lies = (pfad: string) => readFileSync(join(FRONTEND, 'src/components', pfad), 'utf8');
  const suchfelder = (quelle: string, wort: RegExp) =>
    [...quelle.matchAll(/(?:placeholder|aria-label)="([^"]*such[^"]*)"/g)].map((m) => m[1]).filter((t) => wort.test(t));

  it.each([
    ['Leitung', 'admin/EventsView.tsx'],
    ['Konfi', 'konfi/views/EventsView.tsx'],
    ['Team', 'teamer/pages/TeamerEventsPage.tsx'],
  ])('Events, %s: „Events durchsuchen..."', (_rolle, pfad) => {
    expect(suchfelder(lies(pfad), /Event/)).toEqual(['Events durchsuchen', 'Events durchsuchen...']);
  });

  it.each([
    ['Leitung', 'admin/BadgesView.tsx'],
    ['Konfi', 'konfi/views/BadgesView.tsx'],
  ])('Badges, %s: „Badges durchsuchen..."', (_rolle, pfad) => {
    expect(suchfelder(lies(pfad), /Badge/)).toEqual(['Badges durchsuchen', 'Badges durchsuchen...']);
  });
});

describe('Begriffe: die Mitteilungsgruppen heißen wie die Bereiche', () => {
  // Die Android-Kanäle stehen wörtlich in den Systemeinstellungen, die
  // Push-Auswahl in der App kommt vom Server (pushGruppen.js). Dass beide
  // Wort für Wort gleich sind, prüft backend/tests/utils/pushKanaele.test.js.
  it('die App legt die Kanäle „Events" und „Punkte und Badges" an', () => {
    const quelle = readFileSync(join(FRONTEND, 'src/services/notifications.ts'), 'utf8');
    expect(quelle).toContain("name: 'Events',");
    expect(quelle).toContain("name: 'Punkte und Badges',");
    expect(quelle).toContain("description: 'Punkte, Badges, Level, Challenges und der Rückblick',");
  });
});
