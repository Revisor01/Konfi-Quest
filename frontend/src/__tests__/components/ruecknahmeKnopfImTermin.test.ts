// Der Knopf ganz unten im Termin (Simon, 16.09.2026)
//
// Simons Wunsch, woertlich: "Ganz unten bei einem Event haben wir als Admin
// immer den Button 'Event absagen'. Könnten wir diesen Button genau so bauen,
// ganz unten bei einem Event mit 'Event wieder findet doch statt' oder so,
// sodass man da unten auf den Button hat, sodass wir da eine Symmetrie
// haben?"
//
// Entschieden: BEIDE Knoepfe unten im Termin -- am aktiven "Event absagen",
// am abgesagten stattdessen "Absage zurücknehmen". Der Wisch in der
// Terminliste bleibt zusaetzlich bestehen, genau wie beim Absagen.
//
// NICHT die Absage-Karte: Die bleibt reine Auskunft (Simons Entscheidung vom
// selben Tag). abgesagteTermineEinheitlich.test.tsx wacht darueber; hier geht
// es um den anderen Ort, das Seitenende.
//
// WICHTIG -- DER TEST DARF NICHT AM KOMMENTAR ANSCHLAGEN: Alle Dateien
// laufen vor der Pruefung durch ohneKommentare(), wie in den
// Nachbardateien. Die Gegenprobe dazu steht ganz unten.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ohneKommentare } from './abgesagteTermineAnsichten.test';

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');
const code = (pfad: string) => ohneKommentare(lies(pfad));

const ABSCHNITTE = 'src/components/admin/views/EventDetailSections.tsx';
const LEITUNG_DETAIL = 'src/components/admin/views/EventDetailView.tsx';
const LEITUNG_LISTE = 'src/components/admin/pages/AdminEventsPage.tsx';
const TEAM_LISTE = 'src/components/teamer/pages/TeamerEventsPage.tsx';
const HELFER = 'src/utils/absageZuruecknehmen.ts';

/** Nur der Abschnitt mit dem Knopf am Seitenende. */
const eventActionsSection = () => {
  const quelle = code(ABSCHNITTE);
  const start = quelle.indexOf('export const EventActionsSection');
  expect(start).toBeGreaterThan(-1);
  const rest = quelle.slice(start);
  const ende = rest.indexOf('interface TimeslotsSectionProps');
  expect(ende).toBeGreaterThan(-1);
  return rest.slice(0, ende);
};

describe('am AKTIVEN Termin steht unten "Event absagen"', () => {
  it('der Absage-Knopf ist da und rot', () => {
    const abschnitt = eventActionsSection();
    expect(abschnitt).toContain("'Event absagen'");
    expect(abschnitt).toContain('color="danger"');
  });

  it('der Ruecknahme-Knopf steht im anderen Zweig, nicht daneben', () => {
    // Genau ein Knopf ist sichtbar: die beiden haengen an isCancelled ? : .
    const abschnitt = eventActionsSection();
    expect(abschnitt).toContain('{isCancelled ? (');
    // Beide Beschriftungen kommen je genau einmal vor -- keine Dublette.
    expect(abschnitt.match(/'Event absagen'/g)).toHaveLength(1);
    expect(abschnitt.match(/'Absage zurücknehmen'/g)).toHaveLength(1);
  });
});

describe('am ABGESAGTEN Termin steht unten die Ruecknahme', () => {
  it('der Knopf heisst "Absage zurücknehmen" -- wie der Wisch und das Handbuch', () => {
    expect(eventActionsSection()).toContain("'Absage zurücknehmen'");
  });

  it('er ist gruen, nicht rot', () => {
    expect(eventActionsSection()).toContain('color="success"');
  });

  it('er sieht aus wie der Absage-Knopf: gleiche Karte, gleiche Form', () => {
    const abschnitt = eventActionsSection();
    // Beide Zweige liegen in derselben Karte und im selben Wrapper.
    expect(abschnitt.match(/className="app-card-content"/g)).toHaveLength(1);
    expect(abschnitt.match(/app-event-detail__add-button-wrapper/g)).toHaveLength(1);
    // Beide Knoepfe: expand="block" fill="outline", je einmal.
    expect(abschnitt.match(/expand="block"/g)).toHaveLength(2);
    expect(abschnitt.match(/fill="outline"/g)).toHaveLength(2);
  });

  it('offline ist er gesperrt, genau wie der Absage-Knopf', () => {
    expect(eventActionsSection().match(/disabled=\{!isOnline\}/g)).toHaveLength(2);
  });

  it('der Abschnitt verschwindet nicht mehr pauschal am abgesagten Termin', () => {
    // Bis zum 16.09.2026 stand hier `if (!eventData || isCancelled) return null`
    // -- damit waere der Ruecknahme-Knopf nie zu sehen gewesen.
    const abschnitt = eventActionsSection();
    expect(abschnitt).not.toContain('if (!eventData || isCancelled) return null;');
    expect(abschnitt).toContain('if (isCancelled && !handleAbsageZuruecknehmen) return null;');
  });
});

describe('der Knopf loest die bestehende Rueckfrage aus und ruft die richtige Route', () => {
  it('die Leitungs-Detailansicht reicht den Rueckruf durch', () => {
    const quelle = code(LEITUNG_DETAIL);
    expect(quelle).toContain('handleAbsageZuruecknehmen={handleAbsageZuruecknehmen}');
  });

  it('sie benutzt den gemeinsamen Helfer, keine zweite Rueckfrage', () => {
    const quelle = code(LEITUNG_DETAIL);
    expect(quelle).toContain('absageZuruecknehmenFragen(eventData, {');
    // Keine eigene Alert-Kopie in der Detailansicht.
    expect(quelle).not.toContain("header: 'Absage zurücknehmen?'");
  });

  it('die Rueckfrage und der Aufruf stehen genau einmal, im Helfer', () => {
    const helfer = code(HELFER);
    expect(helfer).toContain("header: 'Absage zurücknehmen?'");
    expect(helfer).toContain('api.put(`/events/${termin.id}/reaktivieren`)');
    // Die Listen-Seite hat keine eigene Kopie mehr.
    expect(code(LEITUNG_LISTE)).not.toContain("header: 'Absage zurücknehmen?'");
    expect(code(LEITUNG_LISTE)).not.toContain('/reaktivieren');
  });

  it('die Rueckfrage nennt die Zahl der Leute, die zurueckkommen', () => {
    const helfer = code(HELFER);
    expect(helfer).toContain('durch_absage_abgemeldet_count ?? 0');
    expect(helfer).toContain('1 Person wird wieder angemeldet und bekommt eine Mitteilung.');
    expect(helfer).toContain('${anzahl} Personen werden wieder angemeldet und bekommen eine Mitteilung.');
  });

  it('nach dem Zuruecknehmen laedt die Detailansicht den Termin neu', () => {
    expect(code(LEITUNG_DETAIL)).toContain('onErfolg: () => loadEventData()');
  });

  it('offline geht gar nichts los', () => {
    const quelle = code(LEITUNG_DETAIL);
    expect(quelle).toContain('const handleAbsageZuruecknehmen = () => {\n    if (offlineBlockiert(isOnline, setError) || !eventData) return;');
  });
});

describe('die Teamer-Ansicht hat keinen von beiden Knoepfen', () => {
  const quelle = code(TEAM_LISTE);

  it('kein "Event absagen"', () => {
    expect(quelle).not.toContain('Event absagen');
  });

  it('kein "Absage zurücknehmen"', () => {
    expect(quelle).not.toContain('Absage zurücknehmen');
  });

  it('kein Weg zum Helfer und keine Route', () => {
    expect(quelle).not.toContain('absageZuruecknehmenFragen');
    expect(quelle).not.toContain('/reaktivieren');
  });

  it('sie benutzt den Abschnitt mit dem Knopf gar nicht', () => {
    expect(quelle).not.toContain('EventActionsSection');
  });
});

// GEGENPROBE (Pflicht, siehe CLAUDE.md): Ein Vorkommen im Kommentar darf
// NICHT zaehlen. Faellt dieser Block, pruefen die Tests oben in Wahrheit
// Kommentartext statt Code.
describe('Gegenprobe: die Pruefungen haengen am Code, nicht am Kommentar', () => {
  it('ohneKommentare entfernt Zeilen-, Block- und JSX-Kommentare', () => {
    const beispiel = [
      "// 'Absage zurücknehmen'",
      "/* color=\"success\" */",
      "{/* api.put(`/events/${termin.id}/reaktivieren`) */}",
      "const echt = 'Absage zurücknehmen';"
    ].join('\n');
    const bereinigt = ohneKommentare(beispiel);
    expect(bereinigt.match(/'Absage zurücknehmen'/g)).toHaveLength(1);
    expect(bereinigt).not.toContain('color="success"');
    expect(bereinigt).not.toContain('/reaktivieren');
  });

  it('die echten Dateien enthalten die geprueften Stellen auch nach dem Bereinigen', () => {
    // Waeren sie nur Kommentar, staenden sie hier nicht mehr.
    expect(eventActionsSection()).toContain("'Absage zurücknehmen'");
    expect(code(HELFER)).toContain('/reaktivieren');
  });
});
