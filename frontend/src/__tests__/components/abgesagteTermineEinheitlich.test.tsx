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
// Kommentare darueber -- und nicht, wie es aussieht (Durchstreichen, Farben,
// Karten-Muster): Das ist Gestaltung und bleibt frei aenderbar (Simon,
// 15.10.2026). Wo eine Ansicht geprueft wird, ist das an dem, was
// auf dem Bildschirm steht (getByText), nicht an einer Zeichenkette im
// Quelltext -- genau diese Verwechslung ist im Repo schon dreimal passiert.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Quelltext ohne Kommentare -- wortgleich mit dem Helfer
 * __tests__/ohneKommentare.ts (bis 09.10.2026 im Ansichten-Test nebenan,
 * abgesagteTermineAnsichten.test.ts). Bewusst kopiert statt importiert: Ein
 * Import aus einer *.test.ts-Datei liesse Vitest deren Suite ein zweites Mal
 * registrieren.
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
vi.mock('@ionic/react', () => {
  const alsTag = (tag: string) =>
    ({ children, className }: { children?: React.ReactNode; className?: string }) =>
      React.createElement(tag, { className }, children);
  return {
    IonIcon: (props: { icon?: unknown; className?: string }) => (
      <span data-testid="icon" data-icon={String(props.icon)} className={props.className} />
    ),
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
  istVergangen,
} from '../../components/shared/eventFormatting';
import {
  teilnahmeDarstellung,
  zaehltAlsAbgemeldet,
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
// Befund C + D + F: Der Absageblock, in allen Rollen derselbe
// ------------------------------------------------------------------------

describe('AbsageBlock als Kasten (Detailansichten aller drei Rollen)', () => {
  it('zeigt Grund, Absagenden UND die Person, die den Grund geaendert hat', () => {
    render(<AbsageBlock event={abgesagtMitGrund} variante="kasten" />);
    expect(screen.getByText('Heizung im Gemeindehaus defekt', { exact: false })).toBeTruthy();
    // Nur der Name: "Abgesagt von" steht als Label darueber (Simon, 16.09.2026
    // -- "da steht jetzt abgesagt von und dann nochmal abgesagt von, das
    // reicht wohl in der ueberschrift"). Die Zeile-Variante behaelt den
    // Vorspann, dort gibt es kein Label.
    expect(screen.getByText('Anna Meier, 15.09.')).toBeTruthy();
    // Befund C: Diese Zeile gab es vorher nur bei der Leitung.
    expect(screen.getByText('Geändert von Bernd Schulz, 16.09.')).toBeTruthy();
  });

  it('die Namen stehen ohne Vorspann -- die Beschriftung "Abgesagt von" sagt, was sie bedeuten', () => {
    // Positives Gegenstueck zu "eine alte Absage ohne Urheber behauptet nicht
    // 'von unbekannt'" unten: Fehlte die Beschriftung ganz, bestuende jener
    // Test, ohne den Fehlerfall je zu erreichen.
    render(<AbsageBlock event={abgesagtMitGrund} variante="kasten" />);
    expect(screen.getByText('Abgesagt von')).toBeTruthy();
    expect(screen.getByText('Anna Meier, 15.09.')).toBeTruthy();
  });

  it('nennt NICHT zweimal denselben Namen, wenn Absage und Grund von derselben Person stammen', () => {
    render(
      <AbsageBlock
        event={{ ...abgesagtMitGrund, cancelled_reason_set_by_name: 'Anna Meier' }}
        variante="kasten"
      />
    );
    expect(screen.getByText('Anna Meier, 15.09.')).toBeTruthy();
    expect(screen.queryByText(/Geändert von/)).toBeNull();
  });

  it('Befund F: ohne Grund steht der Platzhaltersatz da -- in JEDER Rolle', () => {
    render(<AbsageBlock event={abgesagtOhneGrund} variante="kasten" />);
    expect(screen.getByText('Kein Grund zur Absage angegeben.')).toBeTruthy();
    // Wer abgesagt hat, bleibt sichtbar -- die Auskunft ist ja da.
    expect(screen.getByText('Anna Meier, 15.09.')).toBeTruthy();
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
    expect(screen.getByText('Geändert von Bernd Schulz, 16.09.')).toBeTruthy();
  });
});

describe('AbsageBlock als Zeile (Listen und Dashboard-Kacheln)', () => {
  it('Befund D: Grund und beide Urheberzeilen stehen auch in der kompakten Form', () => {
    render(<AbsageBlock event={abgesagtMitGrund} variante="zeile" />);
    expect(screen.getByText('Heizung im Gemeindehaus defekt')).toBeTruthy();
    expect(screen.getByText('Abgesagt von Anna Meier, 15.09.')).toBeTruthy();
    expect(screen.getByText('Grund geändert von Bernd Schulz, 16.09.')).toBeTruthy();
  });

  it('die Zeile sagt es als Fliesstext: "Abgesagt: " und der Grund', () => {
    const { container } = render(<AbsageBlock event={abgesagtMitGrund} variante="zeile" />);
    expect(container.querySelector('div')?.textContent).toBe('Abgesagt: Heizung im Gemeindehaus defekt');
  });

  it('ohne Grund bleibt die Zeile leer -- das Eck-Badge sagt "Abgesagt" schon', () => {
    const { container } = render(<AbsageBlock event={abgesagtOhneGrund} variante="zeile" />);
    expect(container.textContent).toBe('');
  });

  // aufDunkel gibt es nur fuer die Dashboard-Kacheln mit Farbverlauf
  // (Konfi- und Team-Startseite): Dort waere das Grau der Text-Tokens auf dem
  // dunklen Verlauf nicht zu lesen. Welche helle Farbe es ist, ist
  // Gestaltung; dass die Eigenschaft die Farbe von Grund- und Urheberzeilen
  // ueberhaupt umstellt, ist Lesbarkeit.
  it('aufDunkel faerbt Grund und Urheber anders als auf hellem Grund', () => {
    const farben = (aufDunkel: boolean) => {
      const { container, unmount } = render(<AbsageBlock event={abgesagtMitGrund} variante="zeile" aufDunkel={aufDunkel} />);
      const zeilen = Array.from(container.querySelectorAll<HTMLElement>(':scope > div'));
      const raus = zeilen.map((z) => [z.textContent, z.style.color]);
      unmount();
      return raus;
    };
    const hell = farben(false);
    const dunkel = farben(true);
    expect(dunkel.map(([text]) => text)).toEqual([
      'Abgesagt: Heizung im Gemeindehaus defekt',
      'Abgesagt von Anna Meier, 15.09.',
      'Grund geändert von Bernd Schulz, 16.09.',
    ]);
    expect(hell.map(([text]) => text)).toEqual(dunkel.map(([text]) => text));
    // Jede Zeile traegt auf dunklem Grund eine eigene Farbe, keine der hellen Variante.
    expect(dunkel.map(([, farbe], i) => farbe !== '' && farbe !== hell[i][1])).toEqual([true, true, true]);
  });
});

// ------------------------------------------------------------------------
// Der Kasten: Ueberschrift, kein Fliesstext-Label, keine Knoepfe
// ------------------------------------------------------------------------

describe('der Kasten: Ueberschrift, kein Fliesstext-Label, keine Knoepfe', () => {
  const kasten = (extra: Record<string, unknown> = {}) =>
    render(<AbsageBlock event={abgesagtMitGrund} variante="kasten" {...extra} />).container;

  it('der Kasten traegt die Ueberschrift "Absage"', () => {
    kasten();
    expect(screen.getByText('Absage')).toBeTruthy();
  });

  it('das alte Fliesstext-Label "Abgesagt:" gibt es im Kasten nicht mehr', () => {
    expect(kasten().textContent).not.toContain('Abgesagt:');
  });

  // GEAENDERTE ANFORDERUNG, KEINE AUFWEICHUNG (16.09.2026):
  // Bis zum Vormittag pruefte diese Stelle, dass GENAU ZWEI Knoepfe in der
  // Karte stehen ("Grund bearbeiten" und "Absage zuruecknehmen"). Simons
  // Entscheidung nach dem Blick auf Build 196 dreht das um: "grund und
  // ruecknahme machen wir nur per slide auf der liste nicht im termin unter
  // absage. es braucht dann nur ein icon am anfang und die gleiche struktur
  // wie bei details."
  //
  // Die Karte ist damit reine Auskunft. Der alte Test hatte recht fuer die
  // alte Anforderung -- er wird nicht gelockert, sondern auf die neue gedreht:
  // aus "genau zwei Knoepfe" wird "gar keiner". Das ist strenger, nicht
  // weicher. Dass die Aktionen nicht verschwunden sind, prueft der
  // Ansichten-Test nebenan an den Wisch-Aktionen beider Listen.
  it('in der Karte steht KEIN Knopf -- Aendern laeuft ueber den Wisch in der Liste', () => {
    const c = kasten();
    expect(c.querySelectorAll('button').length).toBe(0);
  });

  it('auch nicht, wenn die Karte ohne Grund steht (frueher der Ort fuer "Grund nachtragen")', () => {
    const { container } = render(<AbsageBlock event={abgesagtOhneGrund} variante="kasten" />);
    expect(container.querySelectorAll('button').length).toBe(0);
  });

  it('die Beschriftungen der alten Knoepfe stehen nirgends mehr in der Karte', () => {
    const text = kasten().textContent ?? '';
    expect(text).not.toContain('Grund bearbeiten');
    expect(text).not.toContain('Grund nachtragen');
    expect(text).not.toContain('Absage zurücknehmen');
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

  it('der Code steht nach dem Entfernen der Kommentare noch da', () => {
    // Gegenprobe zur Pruefmethode: ohneKommentare() darf den Code nicht
    // wegschneiden -- sonst waeren die Pruefungen oben wertlos.
    expect(quelle).toContain('event.cancelled_reason');
    expect(quelle).toContain('export default AbsageBlock');
  });
});

// ------------------------------------------------------------------------
// Befund E und die Ruecknahme: beide Aktionen leben in der Liste
// (16.09.2026, Simons Entscheidung)
//
// Frueher standen "Grund nachtragen/bearbeiten" und "Absage zuruecknehmen"
// als Knoepfe IN der Karte -- und die Pruefungen dazu an dieser Stelle. Simon
// hat entschieden, dass beides NUR noch ueber den Wisch an der Zeile in der
// Terminliste laeuft. Der Baustein kennt die Aktionen deshalb gar nicht mehr;
// dass es sie weiterhin gibt, pruefen terminListeRechteGerendert.test.tsx
// (Wisch-Aktionen der Leitungsliste) und teamerTerminAbsagen.test.tsx (die
// Teamer-Liste hat keine) gerendert.
//
// Hier bleibt nur die Gegenrichtung: Der Baustein darf keine Aktion mehr
// anbieten, auch nicht versehentlich ueber eine durchgereichte Prop.
// ------------------------------------------------------------------------

describe('der Baustein bietet keine Aktionen mehr an', () => {
  const quelle = ohneKommentare(
    readFileSync(resolve(process.cwd(), 'src/components/shared/AbsageBlock.tsx'), 'utf8')
  );

  it('AbsageBlock.tsx kennt die Knopf-Props nicht mehr', () => {
    expect(quelle).not.toContain('onGrundBearbeiten');
    expect(quelle).not.toContain('onZuruecknehmen');
    expect(quelle).not.toContain('bearbeitenDeaktiviert');
  });

  it('und rendert gar keinen IonButton', () => {
    expect(quelle).not.toContain('IonButton');
  });

  it('die Beschriftungen stehen nicht mehr im Code', () => {
    expect(quelle).not.toContain('Grund bearbeiten');
    expect(quelle).not.toContain('Grund nachtragen');
    expect(quelle).not.toContain('Absage zurücknehmen');
  });

  it('an einem NICHT abgesagten Termin steht ueberhaupt nichts', () => {
    const { container } = render(<AbsageBlock event={offenerTermin} variante="kasten" />);
    expect(container.textContent).toBe('');
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

  it('eine Selbstabmeldung heisst in beiden Listen "Abgemeldet"', () => {
    const d = teilnahmeDarstellung(selbstAbgemeldet);
    expect(d.statusText).toBe('Abgemeldet');
  });

  it('eine Abmeldung in der neuen Schreibweise (status="excused") heisst genauso', () => {
    const d = teilnahmeDarstellung({ status: 'excused', attendance_status: null });
    expect(d.statusText).toBe('Abgemeldet');
  });

  it('eine nachgetragene Abmeldung heisst "Abgemeldet (nachgetragen)"', () => {
    const d = teilnahmeDarstellung({ status: 'confirmed', attendance_status: 'excused' });
    expect(d.statusText).toBe('Abgemeldet (nachgetragen)');
  });

  it('wer trotz Abmeldung anwesend war, heisst "Anwesend"', () => {
    const d = teilnahmeDarstellung({ status: 'opted_out', attendance_status: 'present' });
    expect(d.statusText).toBe('Anwesend');
  });

  it('Abwesend, Warteliste und Gebucht behalten ihren Text', () => {
    expect(teilnahmeDarstellung({ status: 'confirmed', attendance_status: 'absent' }).statusText).toBe('Abwesend');
    expect(teilnahmeDarstellung({ status: 'waitlist', attendance_status: null }).statusText).toBe('Warteliste');
    expect(teilnahmeDarstellung({ status: 'confirmed', attendance_status: null }).statusText).toBe('Gebucht');
  });
});

// ------------------------------------------------------------------------
// Befund I (16.09.2026): Abgesagte bleiben an ihrer Datumsposition
//
// Am 15.09.2026 gab es hier kurzzeitig `abgesagteAnsEnde`, das abgesagte
// Termine im Konfi-Reiter "Alle" ans Listenende schob. Simon hat das am
// 16.09.2026 zurueckgenommen: Der Termin soll an seinem Tag stehen, damit
// sichtbar ist, dass GENAU DIESER erwartete Termin ausfaellt. Die Erwartung
// dreht sich damit um -- die Tests bleiben stehen, damit niemand die
// Sortierung versehentlich wieder einbaut.
// ------------------------------------------------------------------------

describe('Befund I: abgesagte Termine bleiben an ihrer Datumsposition', () => {
  it('eventFormatting exportiert keine Sortierung mehr, die abgesagte verschiebt', async () => {
    const modul = await import('../../components/shared/eventFormatting');
    expect('abgesagteAnsEnde' in modul).toBe(false);
  });

  it('der Konfi-Reiter "Alle" sortiert die Serverliste nicht um', () => {
    const quelle = ohneKommentare(
      readFileSync(resolve(process.cwd(), 'src/components/konfi/views/EventsView.tsx'), 'utf8')
    );
    // Der Server liefert nach event_date aufsteigend; der Reiter filtert nur.
    expect(quelle).toContain("nonKonfirmationEvents.filter(e => !istVergangen(e))");
    expect(quelle).not.toContain('.sort(abgesagteAnsEnde)');
    expect(quelle).not.toContain('abgesagteAnsEnde');
  });

  it('die gefilterte Liste behaelt die Datumsreihenfolge -- der Abgesagte steht in der Mitte', () => {
    // Genau Simons Fall: drei Termine, der mittlere faellt aus. Er muss an
    // Position 2 stehen bleiben, nicht ans Ende wandern.
    const jetzt = new Date('2026-09-16T12:00:00');
    const liste = [
      { id: 1, title: 'Mittwoch', event_date: '2026-09-17T18:00:00', cancelled: false },
      { id: 2, title: 'Freitag', event_date: '2026-09-18T18:00:00', cancelled: true },
      { id: 3, title: 'Montag', event_date: '2026-09-21T18:00:00', cancelled: false },
    ];
    const gefiltert = liste.filter(e => !istVergangen(e, jetzt));
    expect(gefiltert.map(e => e.id)).toEqual([1, 2, 3]);
  });
});
