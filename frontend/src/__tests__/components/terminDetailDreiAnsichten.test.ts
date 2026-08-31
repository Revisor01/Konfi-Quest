import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Befund N6 (Drei-Ansichten-Bericht): Das Termin-Detail gibt es dreimal, und
// die drei Fassungen sind auseinandergelaufen. Simons Entscheidungen vom
// 27.08.2026 sind hier umgesetzt; diese Tests halten fest, dass sie in ALLEN
// betroffenen Ansichten stehen -- nicht nur in der, in der man gerade war.
//
// Warum als Dateitest und nicht als Rendertest: Der Befund ist gerade, dass
// eine Anzeige in einem der drei Baeume FEHLT. Ein Rendertest der einen
// Ansicht wuerde das nie bemerken.

const lies = (pfad: string) =>
  readFileSync(resolve(process.cwd(), pfad), 'utf8');

const adminSections = lies('src/components/admin/views/EventDetailSections.tsx');
const adminDetail = lies('src/components/admin/views/EventDetailView.tsx');
const konfiDetail = lies('src/components/konfi/views/EventDetailView.tsx');
const teamerSeite = lies('src/components/teamer/pages/TeamerEventsPage.tsx');

describe('N6: Check-in-Fenster steht in allen drei Ansichten', () => {
  // Das Zeitfenster fuer den QR-Code wurde im Formular gesetzt, aber nirgends
  // angezeigt -- wer es aenderte, konnte nicht nachsehen, ob es wirkt.
  it.each([
    ['Leitung', adminSections],
    ['Konfi', konfiDetail],
    ['Teamer:in', teamerSeite]
  ])('%s sieht das Check-in-Fenster', (_rolle, quelle) => {
    expect(quelle).toContain('Check-in-Fenster');
    // Kurzform seit 31.08.2026 (Simons Rueckmeldung: Text war zu lang).
    expect(quelle).toContain('Min. (vor/nach Beginn)');
  });

  it('haengt an checkin_window und nicht an einem festen Wert', () => {
    for (const quelle of [adminSections, konfiDetail, teamerSeite]) {
      // Der Wert muss aus checkin_window kommen — eine feste Zahl im Text
      // waere still falsch, sobald die Leitung das Fenster aendert.
      expect(quelle).toMatch(/QR-Code \{[a-zA-Z]+\.checkin_window\} Min\. \(vor\/nach Beginn\)/);
    }
  });
});

describe('N6: Serien-Kennzeichnung auch fuer Konfis und Teamer:innen', () => {
  // Vorher sah nur die Leitung, dass ein Termin zu einer Reihe gehoert -- und
  // auch nur in ihrer LISTE, nicht im Detail.
  it.each([
    ['Konfi', konfiDetail],
    ['Teamer:in', teamerSeite]
  ])('%s sieht, dass der Termin Teil einer Reihe ist', (_rolle, quelle) => {
    expect(quelle).toContain('Terminreihe');
    expect(quelle).toContain('Teil einer Serie');
    expect(quelle).toMatch(/\{[a-zA-Z]+\.is_series && \(/);
  });
});

describe('N6: Anmeldezeitraum steht in allen drei Ansichten', () => {
  it.each([
    ['Leitung', adminSections],
    ['Konfi', konfiDetail],
    ['Teamer:in', teamerSeite]
  ])('%s sieht den Anmeldezeitraum', (_rolle, quelle) => {
    expect(quelle).toContain('Anmeldezeitraum');
    // "Sofort möglich" ist der Fall ohne gesetzten Beginn. Fehlt er, sieht die
    // Rolle bei genau diesen Terminen gar nichts.
    expect(quelle).toContain('Sofort möglich');
  });

  it('entfaellt ueberall bei Pflichtterminen', () => {
    // Bei Pflichtterminen gibt es keine Anmeldung -- der Block waere sinnlos.
    for (const quelle of [adminSections, konfiDetail, teamerSeite]) {
      const block = quelle.slice(quelle.indexOf('Anmeldezeitraum'));
      expect(block).toMatch(/\{![a-zA-Z]+\.mandatory && \(/);
    }
  });
});

describe('N6: Einstieg in den Event-Chat auch fuer Konfis und Teamer:innen', () => {
  // Beide werden beim Buchen ohnehin Mitglied des Raums (addToEventChat),
  // fanden ihn aber nur ueber die Chat-Uebersicht.
  it.each([
    ['Konfi', konfiDetail, '/konfi/chat/room/'],
    ['Teamer:in', teamerSeite, '/teamer/chat/room/']
  ])('%s kommt aus dem Termin in den Chat', (_rolle, quelle, pfad) => {
    expect(quelle).toContain('Event-Chat öffnen');
    expect(quelle).toContain(pfad);
  });

  it('der Knopf erscheint nur, wenn es einen Raum gibt', () => {
    // chat_room_id liefert das Backend nur bei bestehender Mitgliedschaft.
    // Ohne diesen Guard entstuende ein Knopf, der ins 403 laeuft.
    expect(konfiDetail).toMatch(/\{eventData\.chat_room_id && \(/);
    expect(teamerSeite).toMatch(/\{selectedEvent\.chat_room_id && \(/);
  });

  it('er oeffnet nur und erstellt nie', () => {
    // Chats anlegen bleibt der Leitung vorbehalten: POST /events/:id/chat
    // verlangt requireTeamer. Ein Erstellen-Aufruf in diesen beiden Ansichten
    // waere ein 403 mit Fehlermeldung statt eines stillen Nichts.
    for (const quelle of [konfiDetail, teamerSeite]) {
      expect(quelle).not.toMatch(/api\.post\(`\/events\/\$\{[^}]+\}\/chat`\)/);
    }
  });
});

describe('N6: Anmeldestatus im Leitungs-Detail kommt vom Backend', () => {
  // Vorher rechnete das Detail selbst und wich von der eigenen Liste ab.
  it('rechnet nicht mehr selbst', () => {
    // Die lokale Rechnung nutzte getLocalNow/parseLocalTime. Kommen sie
    // zurueck, ist die Divergenz zur Liste wieder da.
    expect(adminDetail).not.toContain('getLocalNow');
    expect(adminDetail).not.toContain('parseLocalTime');
  });

  it('nutzt den Wert aus der Antwort', () => {
    expect(adminDetail).toContain('event.registration_status as');
  });

  it('kennt Pflichttermine', () => {
    // Ohne diesen Zweig fiele 'mandatory' in den Fallback "Geschlossen" --
    // ein Pflichttermin ist aber nicht geschlossen.
    expect(adminDetail).toContain("regStatus === 'mandatory'");
    expect(adminDetail).toContain('Pflichttermin');
  });

  it('erkennt "ausgebucht" an der Kapazitaet, nicht am Status', () => {
    // Das Backend meldet bei freier Warteliste weiterhin 'open'. Haenge die
    // Warteliste-Anzeige an regStatus === 'closed', greift sie nie mehr.
    expect(adminDetail).toContain('const istVoll =');
    const block = adminDetail.slice(adminDetail.indexOf('const istVoll ='));
    expect(block).not.toMatch(/regStatus === 'closed' &&/);
  });
});

describe('N6: keine "Punkte 0" mehr in der Leitungsansicht', () => {
  it('die Punktezeile hat den points > 0-Guard', () => {
    // Konfi- und Teamer-Ansicht hatten ihn, die Leitung als einzige nicht.
    const treffer = adminSections.match(
      /!eventData\.mandatory && !eventData\.teamer_only && !eventData\.is_konfirmation && \(eventData\.points \|\| 0\) > 0/g
    );
    // Zwei Stellen: die Punkte-Zeile und die Typ-Zeile darunter.
    expect(treffer).toHaveLength(2);
  });

  it('die Punkte-Kachel weicht bei 0 Punkten aus', () => {
    expect(adminDetail).toContain("(eventData?.points || 0) > 0");
  });
});
