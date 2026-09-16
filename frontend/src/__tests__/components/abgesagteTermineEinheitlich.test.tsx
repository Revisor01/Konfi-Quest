// Ein abgesagter Termin sieht ueberall gleich aus (15.09.2026)
//
// Der Befund: Derselbe abgesagte Termin wurde in sieben Ansichten
// unterschiedlich dargestellt.
//
//   A) Die Teamer-Liste strich den Titel NICHT durch und graute ihn nicht
//      aus -- Leitung und Konfi taten beides. Ein abgesagter ZUKUENFTIGER
//      Termin sah im Team aus wie jeder andere, bis auf ein kleines rotes
//      Eck-Badge.
//   C) Die Zeile "Grund geändert von ..." gab es nur bei der Leitung. Team
//      und Konfis lasen "Abgesagt von Anna" ueber einem Text, den Bernd
//      geschrieben hatte.
//   D) Beide Startseiten zeigten den Grund gar nicht -- also ausgerechnet
//      dort nicht, wo man nach dem Push ZUERST landet.
//   E) "Grund nachtragen" gab es nur im Leitungs-Detail, obwohl das Backend
//      es jeder Teamer:in erlaubt (requireTeamer, events/verwaltung.js).
//   F) Nur die Leitung sah "Kein Grund zur Absage angegeben." Team und Konfi
//      konnten "kein Grund angegeben" nicht von "alte Absage" unterscheiden.
//   G) Die Kachel "Abgemeldet" zaehlte nur `status === 'opted_out' &&
//      !attendance_status`. Nach einer Terminabsage stehen alle auf
//      'excused' -- die Kachel meldete "Abgemeldet: 0".
//   H) Die Zeitfenster-Teilnehmerliste kannte 'opted_out' und 'excused' gar
//      nicht: Der Filter liess nur status === 'confirmed' durch, abgemeldete
//      Zeilen verschwanden ganz aus dem Zeitfenster.
//
// Dieser Test prueft das VERHALTEN der gemeinsamen Bausteine, nicht die
// Kommentare darueber. Wo eine Ansicht geprueft wird, ist das an dem, was
// auf dem Bildschirm steht (getByText), nicht an einer Zeichenkette im
// Quelltext -- genau diese Verwechslung ist im Repo schon dreimal passiert.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Quelltext ohne Kommentare -- wortgleich mit dem Helfer im Ansichten-Test
 * nebenan (abgesagteTermineAnsichten.test.ts). Bewusst kopiert statt
 * importiert: Ein Import aus einer *.test.ts-Datei liesse Vitest deren
 * Suite ein zweites Mal registrieren.
 *
 * Ohne ihn schlaegt eine Pruefung an einer Zeichenkette an, die nur in der
 * Erklaerung steht -- im Repo dreimal passiert.
 */
const ohneKommentare = (quelltext: string): string =>
  quelltext
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:/])\/\/[^\n]*/g, '$1');

// Ionic-Bausteine durch schlichte Elemente ersetzen: Der Test interessiert
// sich fuer Text und Zustand, nicht fuer Web Components.
// Die Karten-Bausteine behalten ihre Klassennamen: Genau an ihnen haengt
// die Pruefung, dass der Kasten im Karten-Muster der Nachbarabschnitte
// steht (16.09.2026).
vi.mock('@ionic/react', () => {
  const alsTag = (tag: string) =>
    ({ children, className }: { children?: React.ReactNode; className?: string }) =>
      React.createElement(tag, { className }, children);
  return {
    IonIcon: (props: { icon?: unknown }) => <span data-testid="icon" data-icon={String(props.icon)} />,
    IonButton: ({ children, disabled, onClick }: { children?: React.ReactNode; disabled?: boolean; onClick?: () => void }) => (
      <button type="button" disabled={disabled} onClick={onClick}>{children}</button>
    ),
    IonList: alsTag('ion-list'),
    IonListHeader: alsTag('ion-list-header'),
    IonLabel: alsTag('ion-label'),
    IonCard: alsTag('ion-card'),
    IonCardContent: alsTag('ion-card-content'),
  };
});

import AbsageBlock from '../../components/shared/AbsageBlock';
import {
  istAbgesagt,
  streichtDurch,
  titelDekoration,
  abgesagteAnsEnde,
} from '../../components/shared/eventFormatting';
import {
  teilnahmeDarstellung,
  zaehltAlsAbgemeldet,
  listItemKlasse,
  iconKreisKlasse,
  eckBadgeKlasse,
} from '../../utils/teilnahmeStatus';

// --- Testdaten: ein Termin, wie ihn die Routen liefern -------------------

// GET /events und GET /konfi/events liefern registration_status='cancelled',
// GET /events/:id und GET /events/cancelled zusaetzlich cancelled=true.
const abgesagtMitGrund = {
  id: 1,
  name: 'Konfifreizeit',
  cancelled: true,
  registration_status: 'cancelled',
  cancelled_reason: 'Heizung im Gemeindehaus defekt',
  cancelled_by_name: 'Anna Meier',
  cancelled_at: '2026-09-15T08:00:00+02:00',
  cancelled_reason_set_by_name: 'Bernd Schulz',
  cancelled_reason_set_at: '2026-09-16T09:30:00+02:00',
};

const abgesagtOhneGrund = {
  id: 2,
  name: 'Jugendgottesdienst',
  cancelled: true,
  registration_status: 'cancelled',
  cancelled_reason: null,
  cancelled_by_name: 'Anna Meier',
  cancelled_at: '2026-09-15T08:00:00+02:00',
};

const offenerTermin = {
  id: 3,
  name: 'Konfistunde',
  cancelled: false,
  registration_status: 'open',
  cancelled_reason: null,
};

// ------------------------------------------------------------------------
// istAbgesagt(): EINE Pruefung fuer beide Felder
// ------------------------------------------------------------------------

describe('istAbgesagt() deckt beide Felder ab', () => {
  it('erkennt die Absage am Feld cancelled (Detail- und Absagenliste)', () => {
    expect(istAbgesagt({ cancelled: true })).toBe(true);
  });

  it('erkennt die Absage am registration_status (Terminliste)', () => {
    expect(istAbgesagt({ registration_status: 'cancelled' })).toBe(true);
  });

  it('ein offener Termin ist nicht abgesagt', () => {
    expect(istAbgesagt(offenerTermin)).toBe(false);
  });

  it('null und undefined sind nicht abgesagt (statt zu werfen)', () => {
    expect(istAbgesagt(null)).toBe(false);
    expect(istAbgesagt(undefined)).toBe(false);
  });
});

// ------------------------------------------------------------------------
// Befund A + B: Wo wird durchgestrichen?
// ------------------------------------------------------------------------

describe('Durchstreichen: Listen und Kacheln ja, Detailansichten nein', () => {
  it('die Liste streicht einen abgesagten Termin durch', () => {
    expect(streichtDurch('liste', abgesagtMitGrund)).toBe(true);
    expect(titelDekoration('liste', abgesagtMitGrund)).toBe('line-through');
  });

  it('die Dashboard-Kachel streicht ebenfalls durch', () => {
    expect(streichtDurch('kachel', abgesagtMitGrund)).toBe(true);
    expect(titelDekoration('kachel', abgesagtMitGrund)).toBe('line-through');
  });

  it('die Detailansicht streicht NICHT durch -- dort sagen Kopf, Farbe und Grundkasten es schon', () => {
    expect(streichtDurch('detail', abgesagtMitGrund)).toBe(false);
    expect(titelDekoration('detail', abgesagtMitGrund)).toBe('none');
  });

  it('ein offener Termin wird nirgends durchgestrichen', () => {
    for (const ort of ['liste', 'detail', 'kachel'] as const) {
      expect(titelDekoration(ort, offenerTermin)).toBe('none');
    }
  });

  it('die Absage am registration_status streicht genauso durch wie die am Feld cancelled', () => {
    // Genau der Fall der Teamer-Liste: Sie kommt aus GET /events und kennt
    // nur registration_status.
    expect(titelDekoration('liste', { registration_status: 'cancelled' })).toBe('line-through');
    expect(titelDekoration('liste', { cancelled: true })).toBe('line-through');
  });
});

// ------------------------------------------------------------------------
// Befund C + D + F: Der Absageblock, in allen Rollen derselbe
// ------------------------------------------------------------------------

describe('AbsageBlock als Kasten (Detailansichten aller drei Rollen)', () => {
  it('zeigt Grund, Absagenden UND die Person, die den Grund geaendert hat', () => {
    render(<AbsageBlock event={abgesagtMitGrund} variante="kasten" />);
    expect(screen.getByText('Heizung im Gemeindehaus defekt', { exact: false })).toBeTruthy();
    expect(screen.getByText('Abgesagt von Anna Meier, 15.09.')).toBeTruthy();
    // Befund C: Diese Zeile gab es vorher nur bei der Leitung.
    expect(screen.getByText('Grund geändert von Bernd Schulz, 16.09.')).toBeTruthy();
  });

  it('nennt NICHT zweimal denselben Namen, wenn Absage und Grund von derselben Person stammen', () => {
    render(
      <AbsageBlock
        event={{ ...abgesagtMitGrund, cancelled_reason_set_by_name: 'Anna Meier' }}
        variante="kasten"
      />
    );
    expect(screen.getByText('Abgesagt von Anna Meier, 15.09.')).toBeTruthy();
    expect(screen.queryByText(/Grund geändert von/)).toBeNull();
  });

  it('Befund F: ohne Grund steht der Platzhaltersatz da -- in JEDER Rolle', () => {
    render(<AbsageBlock event={abgesagtOhneGrund} variante="kasten" />);
    expect(screen.getByText('Kein Grund zur Absage angegeben.')).toBeTruthy();
    // Wer abgesagt hat, bleibt sichtbar -- die Auskunft ist ja da.
    expect(screen.getByText('Abgesagt von Anna Meier, 15.09.')).toBeTruthy();
  });

  it('ein Termin, der nicht abgesagt ist, rendert gar nichts', () => {
    const { container } = render(<AbsageBlock event={offenerTermin} variante="kasten" />);
    expect(container.textContent).toBe('');
  });

  it('eine alte Absage ohne Urheber behauptet nicht "von unbekannt"', () => {
    render(
      <AbsageBlock
        event={{ cancelled: true, cancelled_reason: 'Sturm' }}
        variante="kasten"
      />
    );
    expect(screen.getByText('Sturm', { exact: false })).toBeTruthy();
    expect(screen.queryByText(/Abgesagt von/)).toBeNull();
    expect(screen.queryByText(/unbekannt/)).toBeNull();
  });

  it('eine alte Absage OHNE Absagenden nennt trotzdem, wer den Grund nachgetragen hat', () => {
    // Termine von vor Migration 150 haben kein cancelled_by. Traegt jetzt
    // jemand den Grund nach, ist das die einzige bekannte Person.
    render(
      <AbsageBlock
        event={{
          cancelled: true,
          cancelled_reason: 'Sturm',
          cancelled_reason_set_by_name: 'Bernd Schulz',
          cancelled_reason_set_at: '2026-09-16T09:30:00+02:00',
        }}
        variante="kasten"
      />
    );
    expect(screen.getByText('Grund geändert von Bernd Schulz, 16.09.')).toBeTruthy();
  });
});

describe('AbsageBlock als Zeile (Listen und Dashboard-Kacheln)', () => {
  it('Befund D: Grund und beide Urheberzeilen stehen auch in der kompakten Form', () => {
    render(<AbsageBlock event={abgesagtMitGrund} variante="zeile" />);
    expect(screen.getByText('Heizung im Gemeindehaus defekt')).toBeTruthy();
    expect(screen.getByText('Abgesagt von Anna Meier, 15.09.')).toBeTruthy();
    expect(screen.getByText('Grund geändert von Bernd Schulz, 16.09.')).toBeTruthy();
  });

  it('ohne Grund bleibt die Zeile leer -- das Eck-Badge sagt "Abgesagt" schon', () => {
    const { container } = render(<AbsageBlock event={abgesagtOhneGrund} variante="zeile" />);
    expect(container.textContent).toBe('');
  });
});

// ------------------------------------------------------------------------
// Der Kasten steht in einer Karte wie seine Nachbarn (16.09.2026)
//
// Simons Befund: "das feld in einem termin das abgesagt sagt ist gut. aber es
// muss in einer weissen card stehen im gleichen stil wie alle anderen."
//
// Das Vorbild ist UnregistrationsSection in
// admin/views/EventDetailSections.tsx -- und mit ihr Details, Beschreibung
// und Material: IonList.app-section-inset > IonListHeader mit rundem
// Abschnitts-Icon > IonCard.app-card > IonCardContent.app-card-content.
// Geprueft wird auf genau diese Klassen, nicht auf "irgendein Element ist da".
// ------------------------------------------------------------------------

describe('der Kasten traegt das Karten-Muster der Nachbarabschnitte', () => {
  const kasten = (extra: Record<string, unknown> = {}) =>
    render(<AbsageBlock event={abgesagtMitGrund} variante="kasten" {...extra} />).container;

  it('sitzt in ion-list.app-section-inset wie Details, Beschreibung und Abmeldungen', () => {
    expect(kasten().querySelector('ion-list.app-section-inset')).not.toBeNull();
  });

  it('hat einen Abschnittskopf mit rundem roten Icon -- das Rot bleibt als Akzent', () => {
    const c = kasten();
    expect(c.querySelector('ion-list-header')).not.toBeNull();
    expect(c.querySelector('.app-section-icon.app-section-icon--danger')).not.toBeNull();
    expect(screen.getByText('Absage')).toBeTruthy();
  });

  it('die Flaeche ist die gemeinsame weisse Karte (ion-card.app-card)', () => {
    const c = kasten();
    expect(c.querySelector('ion-card.app-card')).not.toBeNull();
    expect(c.querySelector('ion-card-content.app-card-content')).not.toBeNull();
  });

  it('die rot getoente Flaeche ist weg -- sonst waere es ein Kasten IN der Karte', () => {
    const c = kasten();
    expect(c.querySelector('.app-reason-box')).toBeNull();
    expect(c.querySelector('.app-reason-box--danger')).toBeNull();
  });

  it('das Wort "Abgesagt:" bleibt rot ausgezeichnet (app-reason-box__label)', () => {
    // Der Label-Stil faerbt nur die Schrift, nicht die Flaeche -- er darf
    // bleiben und traegt das Rot in die Karte.
    const label = kasten().querySelector('.app-reason-box__label');
    expect(label).not.toBeNull();
    expect(label?.textContent).toBe('Abgesagt:');
  });

  it('auch ohne Grund steht der Platzhaltersatz IN der Karte, nicht daneben', () => {
    const { container } = render(<AbsageBlock event={abgesagtOhneGrund} variante="kasten" />);
    const karte = container.querySelector('ion-card-content.app-card-content');
    expect(karte).not.toBeNull();
    expect(karte?.textContent).toContain('Kein Grund zur Absage angegeben.');
  });

  it('beide Knoepfe stehen IN der Karte', () => {
    const c = kasten({ onGrundBearbeiten: () => {}, onZuruecknehmen: () => {} });
    const karte = c.querySelector('ion-card-content.app-card-content');
    expect(karte?.querySelectorAll('button').length).toBe(2);
  });
});

describe('Zeile und dunkle Kachel bekommen KEINE Karte', () => {
  it('die Zeile in der Liste traegt keine Karten-Auszeichnung', () => {
    const { container } = render(<AbsageBlock event={abgesagtMitGrund} variante="zeile" />);
    expect(container.querySelector('ion-list.app-section-inset')).toBeNull();
    expect(container.querySelector('ion-card.app-card')).toBeNull();
    expect(container.querySelector('.app-section-icon--danger')).toBeNull();
    // Der Inhalt ist trotzdem da -- geprueft wird die Form, nicht die Leere.
    expect(container.textContent).toContain('Heizung im Gemeindehaus defekt');
  });

  it('die Kachel mit Farbverlauf (aufDunkel) ebenfalls nicht', () => {
    const { container } = render(
      <AbsageBlock event={abgesagtMitGrund} variante="zeile" aufDunkel />
    );
    expect(container.querySelector('ion-list.app-section-inset')).toBeNull();
    expect(container.querySelector('ion-card.app-card')).toBeNull();
    expect(container.textContent).toContain('Heizung im Gemeindehaus defekt');
  });
});

// Die Karte darf keine festen Farbwerte mitbringen: Ein Dunkelmodus
// faerbt ueber die Tokens um, eine hart notierte Farbe bliebe weiss im
// schwarzen Umfeld. Geprueft wird der Quelltext OHNE Kommentare -- eine
// Farbe in der Erklaerung ist erlaubt, im Code nicht.
describe('keine festen Farbwerte in der neuen Auszeichnung', () => {
  const quelle = ohneKommentare(
    readFileSync(resolve(process.cwd(), 'src/components/shared/AbsageBlock.tsx'), 'utf8')
  );

  it('AbsageBlock.tsx enthaelt keine Hexfarbe', () => {
    expect(quelle.match(/#[0-9a-fA-F]{3,8}\b/g)).toBeNull();
  });

  it('und keine benannte oder rgb()-Farbe ausserhalb der bestehenden Kachel-Weisstoene', () => {
    // rgba(255,255,255,...) gehoert zur Variante 'aufDunkel' und stand
    // schon vorher da (heller Text auf dem Farbverlauf). Alles andere waere neu.
    const rgbFunde = (quelle.match(/rgba?\([^)]*\)/g) ?? []).filter(
      (f) => !f.startsWith('rgba(255,255,255,')
    );
    expect(rgbFunde).toEqual([]);
    expect(quelle).not.toMatch(/(background|color)\s*:\s*['"]?white['"]?/);
  });

  it('die Karten-Klassen stehen im Code, nicht nur im Kommentar', () => {
    // Gegenprobe zur Pruefmethode: ohneKommentare() darf die Klassennamen
    // nicht wegschneiden -- sonst waeren die Pruefungen oben wertlos.
    expect(quelle).toContain('app-section-inset');
    expect(quelle).toContain('app-card-content');
  });
});

// ------------------------------------------------------------------------
// Befund E: Der Knopf zum Nachtragen
// ------------------------------------------------------------------------

describe('Befund E: Grund nachtragen bzw. bearbeiten', () => {
  it('ohne Grund heisst der Knopf "Grund nachtragen"', () => {
    render(<AbsageBlock event={abgesagtOhneGrund} variante="kasten" onGrundBearbeiten={() => {}} />);
    expect(screen.getByText('Grund nachtragen')).toBeTruthy();
  });

  it('mit Grund heisst er "Grund bearbeiten"', () => {
    render(<AbsageBlock event={abgesagtMitGrund} variante="kasten" onGrundBearbeiten={() => {}} />);
    expect(screen.getByText('Grund bearbeiten')).toBeTruthy();
  });

  it('ohne Verbindung ist der Knopf gesperrt', () => {
    render(
      <AbsageBlock
        event={abgesagtMitGrund}
        variante="kasten"
        onGrundBearbeiten={() => {}}
        bearbeitenDeaktiviert
      />
    );
    expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true);
  });

  it('wer nicht schreiben darf (Konfi), bekommt keinen Knopf', () => {
    render(<AbsageBlock event={abgesagtMitGrund} variante="kasten" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('der Knopf steht AUCH bei einer Absage ohne Grund -- sonst gaebe es keinen Ort zum Nachtragen', () => {
    // Genau die Sackgasse, die im Leitungs-Detail schon einmal behoben wurde
    // (Migration 152) und die es im Team noch gar nicht gab.
    const { container } = render(
      <AbsageBlock event={abgesagtOhneGrund} variante="kasten" onGrundBearbeiten={() => {}} />
    );
    expect(container.querySelector('button')).not.toBeNull();
  });
});

// ------------------------------------------------------------------------
// Absage zuruecknehmen (16.09.2026)
// ------------------------------------------------------------------------

describe('Absage zuruecknehmen', () => {
  it('der Knopf steht im Kasten, wenn der Aufrufer ihn anbietet', () => {
    render(<AbsageBlock event={abgesagtMitGrund} variante="kasten" onZuruecknehmen={() => {}} />);
    expect(screen.getByText('Absage zurücknehmen')).toBeTruthy();
  });

  it('er steht AUCH bei einer Absage ohne Grund -- die Absage laesst sich so oder so zuruecknehmen', () => {
    render(<AbsageBlock event={abgesagtOhneGrund} variante="kasten" onZuruecknehmen={() => {}} />);
    expect(screen.getByText('Absage zurücknehmen')).toBeTruthy();
  });

  it('wer nicht schreiben darf (Konfi), bekommt ihn nicht', () => {
    render(<AbsageBlock event={abgesagtMitGrund} variante="kasten" />);
    expect(screen.queryByText('Absage zurücknehmen')).toBeNull();
  });

  it('an einem NICHT abgesagten Termin gibt es ihn nicht', () => {
    const { container } = render(
      <AbsageBlock event={offenerTermin} variante="kasten" onZuruecknehmen={() => {}} />
    );
    expect(container.textContent).toBe('');
  });

  it('ohne Verbindung ist er gesperrt', () => {
    render(
      <AbsageBlock
        event={abgesagtMitGrund}
        variante="kasten"
        onZuruecknehmen={() => {}}
        bearbeitenDeaktiviert
      />
    );
    expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true);
  });

  it('meldet den Klick an den Aufrufer -- er stellt die Rueckfrage mit der Zahl', () => {
    const gerufen = vi.fn();
    render(<AbsageBlock event={abgesagtMitGrund} variante="kasten" onZuruecknehmen={gerufen} />);
    // Nur EIN Knopf im Kasten, weil onGrundBearbeiten hier fehlt.
    screen.getByRole('button').click();
    expect(gerufen).toHaveBeenCalledTimes(1);
  });

  it('steht neben dem Grund-Knopf, nicht statt seiner', () => {
    render(
      <AbsageBlock
        event={abgesagtMitGrund}
        variante="kasten"
        onGrundBearbeiten={() => {}}
        onZuruecknehmen={() => {}}
      />
    );
    expect(screen.getByText('Grund bearbeiten')).toBeTruthy();
    expect(screen.getByText('Absage zurücknehmen')).toBeTruthy();
  });
});

// ------------------------------------------------------------------------
// Befund G: Die Kachel "Abgemeldet"
// ------------------------------------------------------------------------

describe('Befund G: die Kachel "Abgemeldet" zaehlt nach einer Terminabsage richtig', () => {
  // Der gemeldete Fall: Ein Pflichttermin mit vier Konfis wird abgesagt. Der
  // Hintergrunddienst setzt alle Buchungen auf attendance_status='excused'.
  const nachTerminabsage = [
    { status: 'confirmed', attendance_status: 'excused' },
    { status: 'confirmed', attendance_status: 'excused' },
    { status: 'confirmed', attendance_status: 'excused' },
    { status: 'confirmed', attendance_status: 'excused' },
  ];

  it('zaehlt nach einer Absage alle vier -- vorher stand hier 0', () => {
    expect(nachTerminabsage.filter(zaehltAlsAbgemeldet).length).toBe(4);
  });

  it('zaehlt die neue Schreibweise status="excused" mit', () => {
    // Die Abmeldung setzt seit dem 15.09.2026 auch den Buchungsstatus.
    const neueWelt = [
      { status: 'excused', attendance_status: 'excused' },
      { status: 'excused', attendance_status: null },
      { status: 'confirmed', attendance_status: null },
    ];
    expect(neueWelt.filter(zaehltAlsAbgemeldet).length).toBe(2);
  });

  it('zaehlt die alte Schreibweise status="opted_out" weiterhin mit', () => {
    const alteWelt = [
      { status: 'opted_out', attendance_status: null },
      { status: 'opted_out', attendance_status: null },
      { status: 'confirmed', attendance_status: null },
    ];
    expect(alteWelt.filter(zaehltAlsAbgemeldet).length).toBe(2);
  });

  it('wer doch kam, zaehlt NICHT mehr als abgemeldet', () => {
    // Simons Fall (13.09.2026): "Ich als Admin will eine Selbstabmeldung
    // bearbeiten koennen. Doch anwesend." Danach steht dieselbe Person unter
    // "Anwesend" -- sie darf nicht zugleich unter "Abgemeldet" stehen.
    const gemischt = [
      { status: 'opted_out', attendance_status: 'present' },
      { status: 'opted_out', attendance_status: 'absent' },
      { status: 'opted_out', attendance_status: null },
    ];
    expect(gemischt.filter(zaehltAlsAbgemeldet).length).toBe(1);
  });

  it('ein Termin ohne jede Abmeldung zeigt 0', () => {
    const alleDa = [
      { status: 'confirmed', attendance_status: 'present' },
      { status: 'confirmed', attendance_status: null },
      { status: 'waitlist', attendance_status: null },
    ];
    expect(alleDa.filter(zaehltAlsAbgemeldet).length).toBe(0);
  });
});

// ------------------------------------------------------------------------
// Befund H: Beide Teilnehmerlisten sagen dasselbe
// ------------------------------------------------------------------------

describe('Befund H: Zeitfenster- und Nicht-Zeitfenster-Liste zeigen dasselbe Label', () => {
  // Der gemeldete Fall: Eine Konfi meldet sich von einem Pflichttermin mit
  // Zeitfenstern ab. In der Liste ohne Zeitfenster stand "Abgemeldet" (rot),
  // in der mit Zeitfenstern "Gebucht" (blau) -- bzw. nach der
  // Status-Umstellung gar nichts mehr, weil der Filter sie herauswarf.
  const selbstAbgemeldet = { status: 'opted_out', attendance_status: null };

  it('eine Selbstabmeldung heisst in beiden Listen "Abgemeldet" und ist rot', () => {
    const d = teilnahmeDarstellung(selbstAbgemeldet);
    expect(d.statusText).toBe('Abgemeldet');
    expect(listItemKlasse(d)).toBe('app-list-item--danger');
    expect(iconKreisKlasse(d)).toBe('app-icon-circle--danger');
    expect(eckBadgeKlasse(d)).toBe('app-corner-badge--danger');
  });

  it('eine Abmeldung in der neuen Schreibweise (status="excused") heisst genauso', () => {
    const d = teilnahmeDarstellung({ status: 'excused', attendance_status: null });
    expect(d.statusText).toBe('Abgemeldet');
    expect(listItemKlasse(d)).toBe('app-list-item--danger');
  });

  it('eine nachgetragene Abmeldung heisst "Abgemeldet (nachgetragen)" und ist grau', () => {
    const d = teilnahmeDarstellung({ status: 'confirmed', attendance_status: 'excused' });
    expect(d.statusText).toBe('Abgemeldet (nachgetragen)');
    expect(listItemKlasse(d)).toBe('app-list-item--neutral');
    expect(eckBadgeKlasse(d)).toBe('app-corner-badge--neutral');
  });

  it('wer trotz Abmeldung anwesend war, heisst "Anwesend" und ist gruen', () => {
    const d = teilnahmeDarstellung({ status: 'opted_out', attendance_status: 'present' });
    expect(d.statusText).toBe('Anwesend');
    expect(listItemKlasse(d)).toBe('app-list-item--success');
  });

  it('Abwesend, Warteliste und Gebucht behalten Text und Farbe', () => {
    expect(teilnahmeDarstellung({ status: 'confirmed', attendance_status: 'absent' }).statusText).toBe('Abwesend');
    expect(listItemKlasse(teilnahmeDarstellung({ status: 'confirmed', attendance_status: 'absent' }))).toBe('app-list-item--danger');
    expect(teilnahmeDarstellung({ status: 'waitlist', attendance_status: null }).statusText).toBe('Warteliste');
    expect(listItemKlasse(teilnahmeDarstellung({ status: 'waitlist', attendance_status: null }))).toBe('app-list-item--warning');
    expect(teilnahmeDarstellung({ status: 'confirmed', attendance_status: null }).statusText).toBe('Gebucht');
    expect(listItemKlasse(teilnahmeDarstellung({ status: 'confirmed', attendance_status: null }))).toBe('app-list-item--info');
  });

  it('Rand, Kreis und Eck-Badge einer Zeile tragen IMMER dieselbe Farbe', () => {
    const faelle = [
      { status: 'opted_out', attendance_status: null },
      { status: 'confirmed', attendance_status: 'excused' },
      { status: 'confirmed', attendance_status: 'present' },
      { status: 'confirmed', attendance_status: 'absent' },
      { status: 'waitlist', attendance_status: null },
      { status: 'confirmed', attendance_status: null },
    ];
    for (const fall of faelle) {
      const d = teilnahmeDarstellung(fall);
      expect(listItemKlasse(d)).toBe(`app-list-item--${d.farbe}`);
      expect(iconKreisKlasse(d)).toBe(`app-icon-circle--${d.farbe}`);
      expect(eckBadgeKlasse(d)).toBe(`app-corner-badge--${d.farbe}`);
    }
  });
});

// ------------------------------------------------------------------------
// Befund I: Abgesagte ans Ende des Konfi-Reiters "Alle"
// ------------------------------------------------------------------------

describe('Befund I: abgesagte Termine stehen am Ende des Reiters "Alle"', () => {
  it('sortiert abgesagte hinter die anmeldbaren', () => {
    const liste = [
      { id: 1, cancelled: false },
      { id: 2, cancelled: true },
      { id: 3, cancelled: false },
      { id: 4, registration_status: 'cancelled' },
    ];
    expect([...liste].sort(abgesagteAnsEnde).map(e => e.id)).toEqual([1, 3, 2, 4]);
  });

  it('laesst die Datumsreihenfolge des Servers innerhalb der beiden Gruppen stehen', () => {
    // Array.prototype.sort ist seit ES2019 stabil -- wer nach Datum
    // hereinkommt, bleibt nach Datum stehen.
    const liste = [
      { id: 10, cancelled: false },
      { id: 20, cancelled: true },
      { id: 30, cancelled: true },
      { id: 40, cancelled: false },
    ];
    expect([...liste].sort(abgesagteAnsEnde).map(e => e.id)).toEqual([10, 40, 20, 30]);
  });

  it('eine Liste ohne Absagen bleibt unveraendert', () => {
    const liste = [{ id: 1 }, { id: 2 }, { id: 3 }];
    expect([...liste].sort(abgesagteAnsEnde).map(e => e.id)).toEqual([1, 2, 3]);
  });
});
