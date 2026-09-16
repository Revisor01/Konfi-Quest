// Alle sieben Ansichten benutzen wirklich die gemeinsamen Bausteine
// (15.09.2026)
//
// Der Verhaltenstest daneben (abgesagteTermineEinheitlich.test.tsx) prueft,
// dass AbsageBlock, titelDekoration() und teilnahmeDarstellung() das Richtige
// tun. Er prueft NICHT, dass die Ansichten sie auch aufrufen -- und genau das
// war die Ursache des ganzen Befunds: Die Bausteine gab es teilweise schon
// (istAbgesagt() stand seit Tagen in eventFormatting.ts und wurde an genau
// EINER Stelle benutzt), waehrend sechs Ansichten weiter von Hand rechneten.
//
// Deshalb hier die Gegenrichtung: Keine der sieben Ansichten darf die
// Absage noch selbst zusammenbauen.
//
// WICHTIG -- DER TEST DARF NICHT AM KOMMENTAR ANSCHLAGEN: Im Repo ist
// dreimal passiert, dass eine Pruefung auf eine Zeichenkette ansprang, die
// nur in einem Kommentar stand. Deshalb werden alle Dateien vor der Pruefung
// von Kommentaren befreit (ohneKommentare) und erst der Rest durchsucht.
// Die Gegenprobe dazu steht ganz unten: Ein Vorkommen im Kommentar darf NICHT
// zaehlen.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Entfernt Zeilen- und Blockkommentare sowie JSX-Kommentare aus dem Quelltext.
 * Zeichenketten bleiben stehen -- sie sind Code, und ein Text wie
 * "Kein Grund zur Absage angegeben." ist genau das, was geprueft werden soll.
 */
export const ohneKommentare = (quelltext: string): string =>
  quelltext
    // /* ... */ und damit auch die JSX-Form {/* ... */}
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // // ... bis Zeilenende. Das Muster verlangt Zeilenanfang oder ein
    // Zeichen davor, das kein ':' oder '/' ist -- sonst zerschnitte es
    // "https://..." in einer Zeichenkette.
    .replace(/(^|[^:/])\/\/[^\n]*/g, '$1');

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');
const code = (pfad: string) => ohneKommentare(lies(pfad));

const ANSICHTEN = {
  leitungListe: 'src/components/admin/EventsView.tsx',
  leitungDetail: 'src/components/admin/views/EventDetailView.tsx',
  leitungZeitfenster: 'src/components/admin/views/EventDetailSections.tsx',
  teamListe: 'src/components/teamer/pages/TeamerEventsPage.tsx',
  teamStart: 'src/components/teamer/pages/TeamerDashboardPage.tsx',
  konfiListe: 'src/components/konfi/views/EventsView.tsx',
  konfiDetail: 'src/components/konfi/views/EventDetailView.tsx',
  konfiStart: 'src/components/konfi/views/DashboardSections.tsx',
};

describe('der Absageblock steht in allen sieben Ansichten', () => {
  // Die Zeitfenster-Liste zeigt Teilnehmende, keinen Termin -- sie bekommt
  // deshalb keinen AbsageBlock, sondern wird weiter unten geprueft.
  const mitAbsageblock = Object.entries(ANSICHTEN).filter(([name]) => name !== 'leitungZeitfenster');

  it.each(mitAbsageblock)('%s rendert <AbsageBlock', (_name, pfad) => {
    expect(code(pfad)).toContain('<AbsageBlock');
  });

  it.each(mitAbsageblock)('%s baut den Grund NICHT mehr selbst zusammen', (_name, pfad) => {
    const quelle = code(pfad);
    // Genau die Zeichenkette, die vorher fuenfmal im JSX stand.
    expect(quelle).not.toContain('<strong>Abgesagt: </strong>');
    // Und die Kastenform mit ihrem Label.
    expect(quelle).not.toContain('app-reason-box__label">Abgesagt:');
  });

  it.each(mitAbsageblock)('%s ruft absageUrheberZeile() nicht mehr selbst auf', (_name, pfad) => {
    // Beide Urheberzeilen gehoeren in den Block. Wer sie einzeln aufruft,
    // entscheidet wieder fuer sich, ob er die zweite zeigt -- und genau das
    // war Befund C.
    expect(code(pfad)).not.toContain('absageUrheberZeile(');
    expect(code(pfad)).not.toContain('absagegrundUrheberZeile(');
  });
});

describe('Befund A: alle drei Terminlisten streichen abgesagte Titel durch', () => {
  const listen = [ANSICHTEN.leitungListe, ANSICHTEN.teamListe, ANSICHTEN.konfiListe];

  it.each(listen)('%s setzt textDecoration ueber titelDekoration()', (pfad) => {
    const quelle = code(pfad);
    expect(quelle).toContain("titelDekoration('liste', event)");
    // Keine handgeschriebene Variante daneben -- sonst gilt fuer denselben
    // Titel zweimal etwas anderes.
    expect(quelle).not.toMatch(/textDecoration:\s*\w+\s*\?\s*'line-through'/);
  });

  it('die Team-Liste graut den Titel jetzt auch aus (Befund A, zweite Haelfte)', () => {
    const quelle = code(ANSICHTEN.teamListe);
    expect(quelle).toContain("istAbgesagt(event) || shouldGrayOut ? 'var(--app-text-muted)'");
  });

  it.each([ANSICHTEN.konfiStart, ANSICHTEN.teamStart])(
    '%s streicht auf der Kachel durch, ebenfalls ueber titelDekoration()',
    (pfad) => {
      expect(code(pfad)).toContain("titelDekoration('kachel', event)");
    }
  );
});

describe('Befund B: keine Detailansicht streicht durch', () => {
  const details = [ANSICHTEN.leitungDetail, ANSICHTEN.teamListe, ANSICHTEN.konfiDetail];

  it.each(details)('%s streicht den grossen Titel nicht durch', (pfad) => {
    const quelle = code(pfad);
    // Ein 'line-through' im Detailbereich waere nur ueber
    // titelDekoration('detail', ...) zulaessig -- und das liefert 'none'.
    expect(quelle).not.toContain("titelDekoration('detail'");
  });
});

// ------------------------------------------------------------------------
// Befund E, neu gefasst (16.09.2026)
//
// GEAENDERTE ANFORDERUNG, KEINE AUFWEICHUNG: Bis zum Vormittag pruefte dieser
// Abschnitt, dass Leitungs- und Team-Detailansicht onGrundBearbeiten an den
// AbsageBlock durchreichen. Simons Entscheidung nach Build 196 dreht das um --
// "grund und ruecknahme machen wir nur per slide auf der liste nicht im
// termin unter absage". Die Karte im Termin ist reine Auskunft; beide
// Aktionen sitzen in den Wisch-Aktionen der LISTE, in beiden Rollen.
//
// Die Erwartung wird also nicht gelockert: Sie wandert von der Detailansicht
// in die Liste und wird dort fuer BEIDE Aktionen geprueft, statt wie vorher
// nur fuer eine.
// ------------------------------------------------------------------------

describe('Befund E neu: Grund bearbeiten laeuft ueber den Wisch in beiden Listen', () => {
  it('die Leitungsliste bietet den Wisch "Absagegrund bearbeiten" an', () => {
    const quelle = code(ANSICHTEN.leitungListe);
    expect(quelle).toContain("aria-label={isCancelled ? 'Absagegrund bearbeiten' : 'Event absagen'}");
  });

  it('die Teamer-Liste bietet ihn ebenfalls an -- an einem abgesagten Termin', () => {
    const quelle = code(ANSICHTEN.teamListe);
    // Wortgleich zur Leitungsliste: EIN Wisch, dessen Beschriftung am
    // Zustand des Termins haengt.
    expect(quelle).toContain("aria-label={abgesagt ? 'Absagegrund bearbeiten' : 'Event absagen'}");
    expect(quelle).toContain('handleTerminAbsagen(event)');
  });

  it('das Team ruft dieselbe Route wie die Leitung auf', () => {
    const quelle = code(ANSICHTEN.teamListe);
    expect(quelle).toContain('/absagegrund');
    // Der Modus kommt aus dem Termin, wie in AdminEventsPage -- nicht fest.
    expect(quelle).toContain("get modus() { return istAbgesagt(absageTermin) ? 'grund' as const : 'absagen' as const; }");
  });

  it('das Team benutzt DASSELBE Modal, kein zweites', () => {
    const quelle = code(ANSICHTEN.teamListe);
    expect(quelle).toContain("import TerminAbsagenModal from '../../admin/modals/TerminAbsagenModal'");
  });

  it('keine Detailansicht reicht noch einen Knopf an den AbsageBlock durch', () => {
    for (const pfad of [ANSICHTEN.leitungDetail, ANSICHTEN.teamListe, ANSICHTEN.konfiDetail]) {
      const quelle = code(pfad);
      expect(quelle).not.toContain('onGrundBearbeiten={');
      expect(quelle).not.toContain('onZuruecknehmen={handle');
      expect(quelle).not.toContain('bearbeitenDeaktiviert');
    }
  });

  it('die Konfi-Liste bekommt gar keine Wisch-Aktion -- Konfis duerfen nicht schreiben', () => {
    const quelle = code(ANSICHTEN.konfiListe);
    expect(quelle).not.toContain('Absagegrund bearbeiten');
    expect(quelle).not.toContain('Absage zurücknehmen');
  });
});

describe('Absage zuruecknehmen: der Wisch steht in BEIDEN Listen', () => {
  it('die Leitungsliste bietet ihn an, nur an abgesagten Terminen', () => {
    const quelle = code(ANSICHTEN.leitungListe);
    expect(quelle).toContain('aria-label="Absage zurücknehmen"');
    // Der Gate: ohne isCancelled staende die Aktion an jedem Termin und liefe
    // ins Leere (das Backend antwortet mit 400).
    expect(quelle).toContain('{onZuruecknehmen && isCancelled && (');
  });

  it('die Teamer-Liste bietet ihn ebenfalls an, ebenfalls nur an abgesagten', () => {
    const quelle = code(ANSICHTEN.teamListe);
    expect(quelle).toContain('aria-label="Absage zurücknehmen"');
    expect(quelle).toContain('handleAbsageZuruecknehmen(event)');
    // Nur am abgesagten Termin -- an einem aktiven gibt es nichts
    // zurueckzunehmen. Der Wisch selbst steht seit dem 16.09.2026 an JEDER
    // Zeile, weil dort auch "Event absagen" haengt.
    expect(quelle).toContain('{abgesagt && (');
  });

  it('beide Listen rufen dieselbe Route auf', () => {
    expect(code('src/components/admin/pages/AdminEventsPage.tsx')).toContain('/reaktivieren');
    expect(code(ANSICHTEN.teamListe)).toContain('/reaktivieren');
  });

  it('beide faerben die Ruecknahme gruen und das Bearbeiten warnfarben', () => {
    for (const pfad of [ANSICHTEN.leitungListe, ANSICHTEN.teamListe]) {
      const quelle = code(pfad);
      expect(quelle).toContain('app-icon-circle--lg app-icon-circle--success');
      expect(quelle).toContain('app-icon-circle--lg app-icon-circle--warning');
    }
  });

  it('keine Detailansicht ruft die Route noch selbst auf', () => {
    // Genau ein Ort pro Aktion: Sonst laufen die Rueckfragen auseinander.
    expect(code(ANSICHTEN.leitungDetail)).not.toContain('/reaktivieren');
  });

  it('an einem NICHT abgesagten Termin bietet die Leitungsliste weiter "Event absagen"', () => {
    // Derselbe Wisch, andere Beschriftung und anderes Icon -- der Weg zum
    // Absagen darf durch die Ruecknahme nicht verschwinden.
    const quelle = code(ANSICHTEN.leitungListe);
    expect(quelle).toContain("isCancelled ? 'Absagegrund bearbeiten' : 'Event absagen'");
    expect(quelle).toContain('icon={isCancelled ? ICON_BEARBEITEN : ICON_GESPERRT}');
  });

  it('die Teamer-Liste bietet ihn genauso -- gleiche Rechte wie die Leitung', () => {
    // Umgedreht am 16.09.2026 (Simon): "wenn sie das duerfen dann duerfen sie
    // auch absagen". Bis dahin stand hier die Gegenprobe, dass das Team NICHT
    // absagt -- der Modus des Modals war fest 'grund'. Das Backend erlaubte
    // es die ganze Zeit (requireTeamer vor /cancel), nur die Oberflaeche
    // fehlte.
    const quelle = code(ANSICHTEN.teamListe);
    expect(quelle).toContain("abgesagt ? 'Absagegrund bearbeiten' : 'Event absagen'");
    expect(quelle).toContain('icon={abgesagt ? ICON_BEARBEITEN : ICON_GESPERRT}');
    expect(quelle).not.toContain("modus: 'grund' as const");
  });
});

describe('Befund G: die Kachel "Abgemeldet" nutzt die gemeinsame Zaehlung', () => {
  it('die Leitungs-Detailansicht zaehlt ueber zaehltAlsAbgemeldet()', () => {
    const quelle = code(ANSICHTEN.leitungDetail);
    expect(quelle).toContain('konfiOnly.filter(zaehltAlsAbgemeldet)');
    // Die alte, halbe Bedingung darf nicht daneben stehen bleiben.
    expect(quelle).not.toContain("p.status === 'opted_out' && !p.attendance_status");
  });
});

describe('Befund H: beide Teilnehmerlisten rechnen mit derselben Funktion', () => {
  it.each([ANSICHTEN.leitungDetail, ANSICHTEN.leitungZeitfenster])(
    '%s leitet Text und Farbe aus teilnahmeDarstellung() ab',
    (pfad) => {
      const quelle = code(pfad);
      expect(quelle).toContain('teilnahmeDarstellung(participant)');
      expect(quelle).toContain('listItemKlasse(darstellung)');
      expect(quelle).toContain('eckBadgeKlasse(darstellung)');
      expect(quelle).toContain('iconKreisKlasse(darstellung)');
    }
  );

  it.each([ANSICHTEN.leitungDetail, ANSICHTEN.leitungZeitfenster])(
    '%s baut die Klassennamen nicht mehr von Hand zusammen',
    (pfad) => {
      const quelle = code(pfad);
      expect(quelle).not.toContain("'app-list-item--booked'");
      expect(quelle).not.toContain("'app-corner-badge--neutral'");
      expect(quelle).not.toContain("'app-icon-circle--neutral'");
    }
  );

  it('die Zeitfenster-Liste wirft abgemeldete Zeilen nicht mehr heraus', () => {
    const quelle = code(ANSICHTEN.leitungZeitfenster);
    // Der alte Filter liess nur 'confirmed' durch -- eine Abmeldung setzt
    // seit dem 15.09.2026 status='excused' (events/anwesenheit.js), die Zeile
    // verschwand damit ganz aus dem Zeitfenster.
    expect(quelle).not.toContain("participants.filter(p => p.status === 'confirmed' && matchesSlot(p))");
    expect(quelle).toContain("['confirmed', 'excused', 'opted_out'].includes(p.status || '')");
  });

  it('die Zeitfenster-Liste zeigt den Abmeldegrund wie die andere Liste', () => {
    const quelle = code(ANSICHTEN.leitungZeitfenster);
    expect(quelle).toContain('participant.opt_out_reason');
    expect(quelle).toContain('participant.excuse_reason');
  });
});

describe('Befund I: der Konfi-Reiter "Alle" sortiert abgesagte ans Ende', () => {
  it('nutzt abgesagteAnsEnde aus eventFormatting', () => {
    const quelle = code(ANSICHTEN.konfiListe);
    expect(quelle).toContain('.sort(abgesagteAnsEnde)');
  });
});

describe('alle Absage-Pruefungen laufen ueber istAbgesagt()', () => {
  const alle = Object.values(ANSICHTEN);

  it.each(alle)('%s prueft die Absage nicht mehr an einem einzelnen Feld', (pfad) => {
    const quelle = code(pfad);
    // Die beiden handgeschriebenen Formen, die vorher an sieben Stellen
    // standen -- jede prueft nur die Haelfte der Wahrheit.
    expect(quelle).not.toMatch(/\bevent\.cancelled\b(?!_)/);
    expect(quelle).not.toMatch(/\beventData\.cancelled\b(?!_)/);
    expect(quelle).not.toMatch(/\beventData\?\.cancelled\b(?!_)/);
    expect(quelle).not.toMatch(/registration_status === 'cancelled'/);
    expect(quelle).not.toMatch(/selectedEvent\.registration_status === \('?cancelled/);
  });
});

// ------------------------------------------------------------------------
// GEGENPROBE ZUR PRUEFMETHODE SELBST
//
// Jede Pruefung oben laeuft ueber ohneKommentare(). Wenn diese Funktion
// nicht taete, was sie soll, waeren alle "not.toContain"-Pruefungen wertlos:
// Sie wuerden an einem Kommentar anschlagen (falscher Alarm) oder -- schlimmer
// -- eine Pruefung wuerde gruen, weil der gesuchte Code faelschlich als
// Kommentar entfernt wurde.
// ------------------------------------------------------------------------

describe('ohneKommentare() trennt Code von Kommentar', () => {
  it('entfernt Zeilenkommentare', () => {
    expect(ohneKommentare("const a = 1; // event.cancelled steht hier nur im Text")).not.toContain('event.cancelled');
  });

  it('entfernt Blockkommentare', () => {
    expect(ohneKommentare("/* event.cancelled */ const a = 1;")).not.toContain('event.cancelled');
  });

  it('entfernt JSX-Kommentare', () => {
    expect(ohneKommentare("{/* <strong>Abgesagt: </strong> */}<div />")).not.toContain('Abgesagt:');
  });

  it('laesst echten Code stehen', () => {
    const quelle = "if (event.cancelled) return null; // Kommentar";
    expect(ohneKommentare(quelle)).toContain('event.cancelled');
  });

  it('laesst Zeichenketten stehen -- auch solche mit Schraegstrichen', () => {
    const quelle = "const url = 'https://konfi-quest.de/events';";
    expect(ohneKommentare(quelle)).toContain("https://konfi-quest.de/events");
  });

  it('laesst einen Text mit Doppelpunkt stehen (der Platzhaltersatz)', () => {
    const quelle = "<span>Kein Grund zur Absage angegeben.</span>";
    expect(ohneKommentare(quelle)).toContain('Kein Grund zur Absage angegeben.');
  });
});
