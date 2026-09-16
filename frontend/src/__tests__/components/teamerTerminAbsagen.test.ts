// Teamer:innen verwalten KEINE Termine (16.09.2026)
//
// Simons Entscheidung, woertlich: "teamer erstellen keine veranstaltungen
// fertig. das machen admins und org admins. das ist einfach nicht der weg. ich
// halte das fuer zu komplex. lass es uns rausnehmen. also auch nicht loeschen
// und absagen" -- auf Rueckfrage: Gesperrt wird in BEIDEN Ebenen, Oberflaeche
// UND Backend.
//
// DIESE DATEI PRUEFTE AM VORMITTAG DAS GEGENTEIL. Am selben Tag war die
// Teamer-Absage gebaut worden (Modal, Detail-Knopf, drei Wisch-Aktionen, 17
// Tests). Das ist keine Fehlkorrektur, sondern eine geaenderte Anforderung:
// Die Aktionen sind wieder heraus, und die Datei sichert jetzt ihre
// ABWESENHEIT. Eine Datei, die die Abwesenheit absichert, ist mehr wert als
// keine Datei -- sonst waechst dieselbe Oberflaeche beim naechsten Mal wieder
// nach, ohne dass es jemand merkt.
//
// Die zweite Ebene liegt im Backend: POST /events, PUT /events/:id,
// DELETE /events/:id, PUT /events/:id/cancel, /absagegrund und /reaktivieren
// stehen seither hinter requireAdmin (org_admin, admin) statt requireTeamer.
// Die 403/200-Gegenprobe dazu steht in backend/tests/routes/rbacTermine.test.js.
//
// WAS DEM TEAM BLEIBT und hier ausdruecklich geprueft wird: die eigene Zu- und
// Absage der TEILNAHME, der QR-Code zum Einchecken, der Termin-Chat und alles
// Lesende -- darunter der AbsageBlock, denn ein abgesagter Termin muss
// weiterhin als solcher zu sehen sein, samt Grund.
//
// Geprueft wird die Quelle, nicht das gerenderte Bauteil -- dasselbe Muster
// und dieselbe Begruendung wie in teamerAbsageGrund.test.ts: Die Seite haengt
// an IonPage/Router/AppContext, ein Render-Test waere teurer als
// aussagekraeftig.
//
// KEIN TEST DARF AM KOMMENTAR ANSCHLAGEN: Im Repo ist mehrfach passiert, dass
// eine Pruefung auf eine Zeichenkette ansprang, die nur in einem Kommentar
// stand. Das faellt hier besonders ins Gewicht, weil oberhalb in der Seite ein
// langer Kommentar steht, der genau die entfernten Namen nennt. Deshalb laeuft
// jede Pruefung ueber ohneKommentare() aus abgesagteTermineAnsichten.test.ts --
// genau in jener Datei steht auch die Gegenprobe zu dieser Hilfsfunktion.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ohneKommentare } from './abgesagteTermineAnsichten.test';

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');
const code = (pfad: string) => ohneKommentare(lies(pfad));

const TEAM_LISTE = 'src/components/teamer/pages/TeamerEventsPage.tsx';
const LEITUNG_LISTE = 'src/components/admin/EventsView.tsx';
const KONFI_LISTE = 'src/components/konfi/views/EventsView.tsx';

describe('die Teamer-Liste hat keine Wisch-Aktionen mehr', () => {
  const quelle = code(TEAM_LISTE);

  it('kein Wisch heisst "Event absagen" oder "Absagegrund bearbeiten"', () => {
    expect(quelle).not.toContain("aria-label={abgesagt ? 'Absagegrund bearbeiten' : 'Event absagen'}");
    expect(quelle).not.toContain('Absagegrund bearbeiten');
    expect(quelle).not.toContain('Event absagen');
  });

  it('"Absage zuruecknehmen" gibt es nicht', () => {
    expect(quelle).not.toContain('Absage zurücknehmen');
  });

  it('die Zeile ist wieder ein schlichtes IonItem, ohne IonItemSliding', () => {
    // Ein Wisch, der nur in ein 403 laeuft, waere schlimmer als gar keiner:
    // Er verspricht eine Aktion, die es nicht gibt.
    expect(quelle).not.toContain('IonItemSliding');
    expect(quelle).not.toContain('IonItemOption');
  });

  it('die Seite bindet die Wisch-Hilfsfunktion nicht mehr ein', () => {
    // closeOpenSlidingItems wurde ausschliesslich von den Wisch-Aktionen
    // gerufen. Bleibt der Import stehen, waechst der Wisch leicht wieder nach.
    expect(quelle).not.toContain('closeOpenSlidingItems');
  });
});

describe('die Teamer-Seite ruft keine Verwaltungs-Route mehr auf', () => {
  const quelle = code(TEAM_LISTE);

  it.each([
    ['/cancel', 'api.put(`/events/${termin.id}/cancel`'],
    ['/absagegrund', 'api.put(`/events/${termin.id}/absagegrund`'],
    ['/reaktivieren', 'api.put(`/events/${termin.id}/reaktivieren`'],
  ])('kein Aufruf von %s', (_name, aufruf) => {
    expect(quelle).not.toContain(aufruf);
  });

  it('auch nicht unter anderem Namen -- keine der drei Pfad-Endungen kommt vor', () => {
    // Die Pruefung oben haengt am genauen Variablennamen. Diese hier faellt
    // auch, wenn jemand denselben Aufruf mit `event.id` statt `termin.id`
    // schreibt.
    expect(quelle).not.toMatch(/\/events\/\$\{[^}]+\}\/cancel/);
    expect(quelle).not.toMatch(/\/events\/\$\{[^}]+\}\/absagegrund/);
    expect(quelle).not.toMatch(/\/events\/\$\{[^}]+\}\/reaktivieren/);
  });

  it('kein Anlegen, Aendern oder Loeschen von Terminen', () => {
    expect(quelle).not.toContain('api.delete(`/events/');
    expect(quelle).not.toMatch(/api\.post\(\s*['"`]\/events['"`]/);
    expect(quelle).not.toMatch(/api\.put\(\s*`\/events\/\$\{[^}]+\}`/);
  });

  it('kein Anlegen eines Termin-Chats -- das ist ebenfalls Verwaltung', () => {
    // POST /events/:id/chat steht seit dem 16.09.2026 hinter requireAdmin.
    // Den Chat OEFFNEN bleibt dem Team (siehe unten) -- dafuer braucht es
    // keine Route, nur die chat_room_id.
    expect(quelle).not.toMatch(/api\.post\(`\/events\/\$\{[^}]+\}\/chat`\)/);
  });
});

describe('das Absage-Modal der Leitung ist nicht mehr eingebunden', () => {
  const quelle = code(TEAM_LISTE);

  it('TerminAbsagenModal wird nicht importiert', () => {
    expect(quelle).not.toContain("import TerminAbsagenModal from '../../admin/modals/TerminAbsagenModal'");
    expect(quelle).not.toContain('TerminAbsagenModal');
  });

  it('die Handler und ihr Zustand sind weg', () => {
    expect(quelle).not.toContain('handleTerminAbsagen');
    expect(quelle).not.toContain('handleAbsageZuruecknehmen');
    expect(quelle).not.toContain('presentAbsagegrundModal');
    expect(quelle).not.toContain('absageTermin');
  });

  it('der Detail-Knopf "Event absagen" ist weg', () => {
    // Er stand zwischen den Eckdaten und dem Material-Abschnitt.
    expect(quelle).not.toContain('{!istAbgesagt(selectedEvent) && (');
  });
});

describe('was dem Team bleibt', () => {
  const quelle = code(TEAM_LISTE);

  it('die eigene Zu- und Absage der TEILNAHME laeuft weiter ueber die Zusage-Route', () => {
    // Nicht zu verwechseln mit dem Absagen des TERMINS: Hier sagt eine Person
    // fuer sich selbst zu oder ab.
    expect(quelle).toContain('api.post(`/teamer/events/${event.id}/zusage`');
    expect(quelle).toContain('onClick={oeffneAbsage}');
    expect(quelle).toContain("import TeamerAbsageModal from '../modals/TeamerAbsageModal'");
  });

  it('der QR-Code zum Einchecken bleibt', () => {
    expect(quelle).toContain('aria-label="QR-Code zum Einchecken anzeigen"');
    expect(quelle).toContain('presentQRDisplayModal');
  });

  it('der Termin-Chat laesst sich weiter OEFFNEN', () => {
    // Oeffnen heisst: in den Raum springen, dessen id schon in der Antwort
    // steht. Kein Anlegen, keine Verwaltungs-Route.
    expect(quelle).toContain('aria-label="Event-Chat öffnen"');
    expect(quelle).toContain('router.push(`/teamer/chat/room/${selectedEvent.chat_room_id}`');
  });

  it('ein abgesagter Termin ist weiterhin als abgesagt zu SEHEN, samt Grund', () => {
    // Sehen ja, aendern nein. Der AbsageBlock steht im Detail als Kasten und
    // an der Listenzeile als Zeile -- unveraendert.
    expect(quelle).toContain('<AbsageBlock');
    expect(quelle).toContain('variante="kasten"');
    expect(quelle).toContain('variante="zeile"');
  });

  it('der Block ist reine Auskunft -- er bekommt keine Knoepfe durchgereicht', () => {
    expect(quelle).not.toContain('onGrundBearbeiten={');
    expect(quelle).not.toContain('onZuruecknehmen={');
  });
});

describe('die anderen beiden Listen bleiben, wie sie waren', () => {
  it('die Leitungsliste bietet weiterhin absagen, Grund und loeschen', () => {
    // Die Rechte sind NICHT weggefallen, sie sind nur auf die Leitung
    // zusammengezogen. Waere hier auch nichts mehr, haette die Umstellung die
    // Aktion ganz beseitigt statt sie zu verschieben.
    const leitung = code(LEITUNG_LISTE);
    expect(leitung).toContain("aria-label={isCancelled ? 'Absagegrund bearbeiten' : 'Event absagen'}");
    expect(leitung).toContain('aria-label="Absage zurücknehmen"');
    expect(leitung).toContain('aria-label="Event löschen"');
  });

  it('die Konfi-Liste hat gar keine Wisch-Aktionen', () => {
    const konfi = code(KONFI_LISTE);
    expect(konfi).not.toContain('<IonItemOption');
    expect(konfi).not.toContain('IonItemSliding');
  });
});
