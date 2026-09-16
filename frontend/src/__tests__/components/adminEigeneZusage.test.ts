import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  welcheKnoepfe,
  zusageBeschriftung,
  absageBeschriftung,
  absageBrauchtGrund,
  hatZugesagt,
  hatAbgesagt,
} from '../../utils/zusageKnoepfe';

// Simons Auftrag vom 16.09.2026, woertlich:
//
//   "die anzeige bei teamerinnen mit nicht mehr dabei und doch dabei finde ich
//    richtig gut. das bleibt so. bei admins haben wir die buttons nebeneinander
//    'du bist dabei' 'bin nicht dabei'. und dann ein action modal. da muss die
//    logik einfach identisch sein wie bei teamerinnen bitte. erste abfrage
//    beide danach im wechsel."
//
// VORHER stand in der Leitungssicht eine dritte Handabschrift: beide Knoepfe
// DAUERHAFT, der eigene Stand als fill="solid", die Absage-Beschriftung als
// Zustand ("Abgesagt") statt als Weg, und ein window.prompt() fuer den Grund --
// das einzige im ganzen Frontend. Jetzt entscheidet utils/zusageKnoepfe.ts fuer
// beide Ansichten, und die Leitung bekommt denselben Dialog wie das Team.

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

/**
 * Blockkommentare und Zeilenkommentare entfernen. Ohne das prueft ein
 * toContain/not.toContain auch die Kommentare -- und die zitieren hier
 * ausgiebig, was frueher dastand.
 */
const ohneKommentare = (quelle: string) =>
  quelle.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const adminSeite = ohneKommentare(lies('src/components/admin/views/EventDetailView.tsx'));
const teamerSeite = ohneKommentare(lies('src/components/teamer/pages/TeamerEventsPage.tsx'));

/** Der Knopf-Block der eigenen Zusage in der Leitungssicht. */
const adminBlock = adminSeite.slice(
  adminSeite.indexOf('{darfSichMelden && ('),
  adminSeite.indexOf('{eventData?.has_timeslots'),
);

describe('Die Regeln stehen an EINER Stelle', () => {
  it('noch nichts entschieden -> beide Knoepfe', () => {
    expect(welcheKnoepfe(null)).toBe('beide');
    expect(welcheKnoepfe(undefined)).toBe('beide');
  });

  it('zugesagt -> nur noch der Weg zur Absage', () => {
    expect(welcheKnoepfe('confirmed')).toBe('absage');
    // Warteliste und der Alt-Status 'pending' zaehlen genauso: Die Aussage
    // "Ich bin dabei" zaehlt, nicht der zugeteilte Platz.
    expect(welcheKnoepfe('waitlist')).toBe('absage');
    expect(welcheKnoepfe('pending')).toBe('absage');
  });

  it('abgesagt -> nur noch der Weg zur Zusage', () => {
    expect(welcheKnoepfe('opted_out')).toBe('zusage');
  });

  it('beschriftet die Knoepfe wie beim Team', () => {
    expect(zusageBeschriftung(null)).toBe('Dabei');
    expect(zusageBeschriftung('opted_out')).toBe('Doch dabei');
    expect(zusageBeschriftung(null, 'Warteliste (2/5)')).toBe('Warteliste (2/5)');
    expect(absageBeschriftung(null)).toBe('Nicht dabei');
    expect(absageBeschriftung('confirmed')).toBe('Nicht mehr dabei');
    expect(absageBeschriftung('waitlist')).toBe('Nicht mehr dabei');
  });

  it('verlangt einen Grund NUR fuer die Absage nach einer Zusage', () => {
    // Verboten ohne Grund:
    expect(absageBrauchtGrund('confirmed')).toBe(true);
    expect(absageBrauchtGrund('waitlist')).toBe(true);
    expect(absageBrauchtGrund('pending')).toBe(true);
    // Erlaubt ohne Grund -- aus 'offen' und aus einer frueheren Absage:
    expect(absageBrauchtGrund(null)).toBe(false);
    expect(absageBrauchtGrund(undefined)).toBe(false);
    expect(absageBrauchtGrund('opted_out')).toBe(false);
  });

  it('trennt zugesagt und abgesagt sauber', () => {
    expect(hatZugesagt('confirmed')).toBe(true);
    expect(hatZugesagt('opted_out')).toBe(false);
    expect(hatAbgesagt('opted_out')).toBe(true);
    expect(hatAbgesagt('confirmed')).toBe(false);
    // 'excused' ist ein Anwesenheits-, kein Buchungsstatus: weder noch.
    expect(hatZugesagt('excused')).toBe(false);
    expect(hatAbgesagt('excused')).toBe(false);
  });
});

// NAMENSWECHSEL AM 17.09.2026: Hier stand ueberall `eigeneTeilnahme?.status`.
// Der Wert kam aus participants.find(...) -- und gegen Produktion gemessen
// steht die Leitung dort GAR NICHT drin, weder nach einer Zusage noch nach
// einer Absage. find() gab immer undefined, und undefined heisst "noch nichts
// entschieden": Die Leitung sah dauerhaft beide Knoepfe, egal was sie gewaehlt
// hatte (Simons Befund). Gelesen wird jetzt eventData.booking_status -- dieselbe
// Quelle wie auf der Teamer-Seite. Die Pruefungen hier bleiben inhaltlich
// dieselben, nur der Name des geprueften Ausdrucks aendert sich.
describe('Leitung: eigene Zusage', () => {
  it('zeigt den gruenen Knopf NICHT mehr, wenn schon zugesagt ist', () => {
    expect(adminBlock).toContain("welcheKnoepfe(eigeneZusage) !== 'absage' && (");
  });

  it('zeigt den roten Knopf NICHT mehr, wenn schon abgesagt ist', () => {
    expect(adminBlock).toContain("welcheKnoepfe(eigeneZusage) !== 'zusage' && (");
  });

  it('nimmt die Beschriftungen aus der gemeinsamen Stelle', () => {
    expect(adminBlock).toContain('{zusageBeschriftung(eigeneZusage)}');
    expect(adminBlock).toContain('{absageBeschriftung(eigeneZusage)}');
    // Die alten, fest verdrahteten Beschriftungen sind weg.
    expect(adminBlock).not.toContain("'Du bist dabei'");
    expect(adminBlock).not.toContain("'Bin dabei'");
    expect(adminBlock).not.toContain("'Bin nicht dabei'");
    expect(adminBlock).not.toContain("'Abgesagt'");
  });

  it('nutzt nur Outline-Knoepfe, nie vollfarbig', () => {
    // Simons Regel fuer das Team: "immer immer immer nur line buttons".
    // Der eigene Stand steht im Eck-Zeichen, nicht in einem gefuellten Knopf.
    const fills = [...adminBlock.matchAll(/fill=(?:"([^"]*)"|\{([^}]*)\})/g)];
    expect(fills.length).toBe(2);
    expect(fills.every(m => m[1] === 'outline')).toBe(true);
    expect(adminBlock).not.toContain("'solid'");
  });

  it('fragt den Grund im Modal ab, nicht per window.prompt', () => {
    const ganzesFrontend = adminSeite;
    expect(ganzesFrontend).not.toContain('window.prompt');
    expect(adminBlock).toContain('onClick={oeffneEigeneAbsage}');
    expect(adminSeite).toContain('useIonModal(TeamerAbsageModal');
  });

  it('gibt dem Modal dieselbe Grund-Pflicht mit wie die Teamer-Seite', () => {
    expect(adminSeite).toContain('grundPflicht: absageBrauchtGrund(eigeneZusage)');
    expect(teamerSeite).toContain('absageBrauchtGrund(selectedEvent.booking_status)');
  });

  it('ruft dieselbe Route wie das Team', () => {
    expect(adminSeite).toContain('api.post(`/teamer/events/${eventData.id}/zusage`');
    expect(teamerSeite).toContain('api.post(`/teamer/events/${event.id}/zusage`');
  });
});

describe('Regressionsschutz: die Teamer-Ansicht bleibt, wie sie war', () => {
  it('zeigt weiterhin beide Knoepfe, solange nichts gewaehlt ist', () => {
    const komponente = teamerSeite.slice(
      teamerSeite.indexOf('const ZusageKnoepfe'),
      teamerSeite.indexOf('const getEventStatusInfo'),
    );
    expect(komponente).toContain('if (zugesagt) return');
    expect(komponente).toContain('if (abgesagt) return');
    const offen = komponente.slice(komponente.lastIndexOf('return ('));
    expect(offen).toContain('{zusageKnopf}');
    expect(offen).toContain('{absageKnopf}');
  });

  it('behaelt seinen eigenen Absage-Dialog mit Warteschlange', () => {
    // Die Teamer-Absage laeuft offline ueber die Warteschlange -- das ist
    // Teamer-eigen und darf beim Angleichen nicht verschwinden.
    expect(teamerSeite).toContain('useIonModal(TeamerAbsageModal');
    expect(teamerSeite).toContain('writeQueue.enqueue');
  });

  it('behaelt seine Kontingent-Sperre (zusageMoeglich)', () => {
    expect(teamerSeite).toContain('zusageMoeglich={false}');
  });
});
