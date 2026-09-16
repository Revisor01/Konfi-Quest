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
    // className muss durchgereicht werden: An ihr haengt die Pruefung, dass
    // jede Info-Zeile ihr Icon am Anfang traegt (app-info-row__icon) und dass
    // es rot ist (app-icon-color--danger). Das echte IonIcon setzt die Klasse
    // ebenso -- ein Mock, der sie schluckt, machte die Pruefung wertlos.
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
  streichtDurch,
  titelDekoration,
  istVergangen,
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
    // Nur der Name: "Abgesagt von" steht als Label darueber (Simon, 16.09.2026
    // -- "da steht jetzt abgesagt von und dann nochmal abgesagt von, das
    // reicht wohl in der ueberschrift"). Die Zeile-Variante behaelt den
    // Vorspann, dort gibt es kein Label.
    expect(screen.getByText('Anna Meier, 15.09.')).toBeTruthy();
    // Befund C: Diese Zeile gab es vorher nur bei der Leitung.
    expect(screen.getByText('Geändert von Bernd Schulz, 16.09.')).toBeTruthy();
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

  // Der Umbau der Karte am 16.09.2026 betrifft NUR die Variante 'kasten'.
  // Die Zeile steht in drei Listen und zwei Dashboard-Kacheln, wo kein Platz
  // fuer Info-Zeilen ist -- sie behaelt ihren Fliesstext mit dem fetten
  // "Abgesagt: " davor. Ohne diese Pruefung waere "unveraendert" nur eine
  // Behauptung.
  it('die Zeile behaelt ihren Fliesstext mit fettem "Abgesagt: " davor', () => {
    const { container } = render(<AbsageBlock event={abgesagtMitGrund} variante="zeile" />);
    const fett = container.querySelector('strong');
    expect(fett?.textContent).toBe('Abgesagt: ');
    expect(container.querySelector('div')?.textContent).toBe('Abgesagt: Heizung im Gemeindehaus defekt');
    // Und KEINE Info-Zeilen -- die gehoeren in die Karte.
    expect(container.querySelector('.app-info-row')).toBeNull();
    expect(container.querySelector('.app-info-row__label')).toBeNull();
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

  it('das Rot traegt jetzt das Zeilen-Icon, nicht mehr ein fett gesetztes Wort', () => {
    // Bis zum 16.09.2026 stand hier "Abgesagt:" als rot gefaerbtes Label vor
    // dem Fliesstext. Mit den Info-Zeilen sitzt das Rot am Icon am Anfang der
    // Zeile -- dieselbe Stelle wie im Abschnitt Details.
    const c = kasten();
    expect(c.querySelector('.app-reason-box__label')).toBeNull();
    expect(c.querySelector('.app-info-row__icon.app-icon-color--danger')).not.toBeNull();
  });

  it('auch ohne Grund steht der Platzhaltersatz IN der Karte, nicht daneben', () => {
    const { container } = render(<AbsageBlock event={abgesagtOhneGrund} variante="kasten" />);
    const karte = container.querySelector('ion-card-content.app-card-content');
    expect(karte).not.toBeNull();
    expect(karte?.textContent).toContain('Kein Grund zur Absage angegeben.');
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

// ------------------------------------------------------------------------
// Die Karte ist nach dem Muster der Info-Zeilen gebaut (16.09.2026)
//
// Simon: "wir brauchen ein icon am anfang ... es braucht dann nur ein icon am
// anfang und die gleiche struktur wie bei details."
//
// Das Vorbild ist EventInfoCard in admin/views/EventDetailSections.tsx (dort
// die Zeilen "Datum", "Zeitfenster", "Anmeldung"): pro Aussage eine
// .app-info-row mit .app-info-row__icon links, .app-info-row__label als
// kleiner Ueberschrift und .app-info-row__value als Wert. Geprueft wird auf
// genau diese Klassen.
// ------------------------------------------------------------------------

describe('die Karte benutzt die Info-Zeilen des Details-Abschnitts', () => {
  it('der Grund steht in einer app-info-row mit Icon, Label und Wert', () => {
    const { container } = render(<AbsageBlock event={abgesagtMitGrund} variante="kasten" />);
    const zeilen = container.querySelectorAll('.app-info-row');
    expect(zeilen.length).toBe(2);

    const grundZeile = zeilen[0];
    expect(grundZeile.querySelector('.app-info-row__icon')).not.toBeNull();
    expect(grundZeile.querySelector('.app-info-row__label')?.textContent).toBe('Grund');
    expect(grundZeile.querySelector('.app-info-row__value')?.textContent).toBe('Heizung im Gemeindehaus defekt');
  });

  it('das Icon am Anfang jeder Zeile ist rot eingefaerbt wie der Kopf-Kreis', () => {
    const { container } = render(<AbsageBlock event={abgesagtMitGrund} variante="kasten" />);
    const icons = container.querySelectorAll('.app-info-row__icon.app-icon-color--danger');
    expect(icons.length).toBe(2);
  });

  it('die Urheber stehen in einer zweiten Zeile unter dem Label "Abgesagt von"', () => {
    const { container } = render(<AbsageBlock event={abgesagtMitGrund} variante="kasten" />);
    const urheberZeile = container.querySelectorAll('.app-info-row')[1];
    expect(urheberZeile.querySelector('.app-info-row__icon')).not.toBeNull();
    expect(urheberZeile.querySelector('.app-info-row__label')?.textContent).toBe('Abgesagt von');
    const werte = Array.from(urheberZeile.querySelectorAll('.app-info-row__value')).map(e => e.textContent);
    // Ohne Vorspann -- das Label darueber sagt schon "Abgesagt von".
    expect(werte).toEqual(['Anna Meier, 15.09.', 'Geändert von Bernd Schulz, 16.09.']);
  });

  it('auch der Platzhaltersatz steht als Wert in der Grund-Zeile', () => {
    const { container } = render(<AbsageBlock event={abgesagtOhneGrund} variante="kasten" />);
    const grundZeile = container.querySelectorAll('.app-info-row')[0];
    expect(grundZeile.querySelector('.app-info-row__label')?.textContent).toBe('Grund');
    expect(grundZeile.querySelector('.app-info-row__value')?.textContent).toBe('Kein Grund zur Absage angegeben.');
  });

  it('eine alte Absage ohne jeden Urheber bekommt gar keine zweite Zeile', () => {
    // Kein "Abgesagt von unbekannt" und keine leere Zeile mit Icon.
    const { container } = render(
      <AbsageBlock event={{ cancelled: true, cancelled_reason: 'Sturm' }} variante="kasten" />
    );
    expect(container.querySelectorAll('.app-info-row').length).toBe(1);
    expect(container.textContent).not.toContain('Abgesagt von');
  });

  it('das alte Fliesstext-Label "Abgesagt:" gibt es in der Karte nicht mehr', () => {
    const { container } = render(<AbsageBlock event={abgesagtMitGrund} variante="kasten" />);
    expect(container.querySelector('.app-reason-box__label')).toBeNull();
    expect(container.textContent).not.toContain('Abgesagt:');
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
    expect(container.querySelector('.app-info-row')).toBeNull();
    expect(container.textContent).toContain('Heizung im Gemeindehaus defekt');
    // Heller Text auf dem Farbverlauf -- der Grund, warum es diese Variante
    // gibt. Ein Umbau, der die Farbe verliert, macht den Text unlesbar.
    const zeilen = Array.from(container.querySelectorAll('div'));
    expect(zeilen[0].getAttribute('style')).toContain('rgba(255, 255, 255, 0.9)');
    expect(zeilen[1].getAttribute('style')).toContain('rgba(255, 255, 255, 0.75)');
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
// Befund E und die Ruecknahme: beide Aktionen leben in der Liste
// (16.09.2026, Simons Entscheidung)
//
// Frueher standen "Grund nachtragen/bearbeiten" und "Absage zuruecknehmen"
// als Knoepfe IN der Karte -- und die Pruefungen dazu an dieser Stelle. Simon
// hat entschieden, dass beides NUR noch ueber den Wisch an der Zeile in der
// Terminliste laeuft. Der Baustein kennt die Aktionen deshalb gar nicht mehr;
// dass es sie weiterhin gibt, prueft der Ansichten-Test nebenan
// (abgesagteTermineAnsichten.test.ts) an den Wisch-Aktionen von Leitungs- und
// Teamer-Liste.
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
