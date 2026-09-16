// Teamer:innen sagen Termine ab wie die Leitung (16.09.2026)
//
// Simons Regel, woertlich: "teamer duerfen nichts absagen, duerfen die events
// erstellen, wenn sie das duerfen dann duerfen sie auch absagen" -- auf
// Rueckfrage: "Dieselben Rechte wie die Leitung" und "Ja, gleiche
// Wisch-Aktionen wie Leitung".
//
// Das Backend erlaubte es laengst: PUT /events/:id/cancel
// (routes/events/verwaltung.js:1008), PUT /events/:id/absagegrund (:1195) und
// PUT /events/:id/reaktivieren (:1390) stehen alle hinter requireTeamer
// (middleware/rbac.js:274 -- org_admin, admin, teamer) plus Jahrgangsbindung
// ueber darfTermin(). Gefehlt hat nur die Oberflaeche.
//
// Geprueft wird die Quelle, nicht das gerenderte Bauteil -- dasselbe Muster
// und dieselbe Begruendung wie in teamerAbsageGrund.test.ts: Die Seite haengt
// an IonPage/Router/AppContext, ein Render-Test waere teurer als
// aussagekraeftig.
//
// KEIN TEST DARF AM KOMMENTAR ANSCHLAGEN: Im Repo ist mehrfach passiert, dass
// eine Pruefung auf eine Zeichenkette ansprang, die nur in einem Kommentar
// stand. Deshalb laeuft jede Pruefung ueber ohneKommentare() aus
// abgesagteTermineAnsichten.test.ts -- genau in dieser Datei steht auch die
// Gegenprobe zu dieser Hilfsfunktion.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ohneKommentare } from './abgesagteTermineAnsichten.test';

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');
const code = (pfad: string) => ohneKommentare(lies(pfad));

const TEAM_LISTE = 'src/components/teamer/pages/TeamerEventsPage.tsx';
const LEITUNG_LISTE = 'src/components/admin/EventsView.tsx';
const KONFI_LISTE = 'src/components/konfi/views/EventsView.tsx';

describe('Teamer-Liste: die Wisch-Aktionen der Leitung', () => {
  const quelle = code(TEAM_LISTE);

  it('der nicht abgesagte Termin traegt "Event absagen", der abgesagte "Absagegrund bearbeiten"', () => {
    // EIN Wisch fuer beide Faelle, wie in der Leitungsliste: Das aria-label
    // haengt am Zustand des Termins. Zwei getrennte Optionen waeren eine
    // Kopie, die auseinanderlaeuft.
    expect(quelle).toContain("aria-label={abgesagt ? 'Absagegrund bearbeiten' : 'Event absagen'}");
    // Das Icon wechselt mit: Stift beim Bearbeiten, Verbotszeichen beim
    // Absagen -- gleiche Zuordnung wie bei der Leitung.
    expect(quelle).toContain('icon={abgesagt ? ICON_BEARBEITEN : ICON_GESPERRT}');
  });

  it('"Absage zuruecknehmen" steht NUR am abgesagten Termin und ist gruen', () => {
    const zuruecknehmen = /\{abgesagt && \(\s*<IonItemOption[\s\S]{0,400}?aria-label="Absage zurücknehmen"[\s\S]{0,300}?app-icon-circle--success/;
    expect(zuruecknehmen.test(quelle)).toBe(true);
  });

  it('die Reihenfolge ist wie bei der Leitung: erst zuruecknehmen, dann absagen/Grund', () => {
    const posZuruecknehmen = quelle.indexOf('aria-label="Absage zurücknehmen"');
    const posAbsagen = quelle.indexOf("aria-label={abgesagt ? 'Absagegrund bearbeiten' : 'Event absagen'}");
    expect(posZuruecknehmen).toBeGreaterThan(-1);
    expect(posAbsagen).toBeGreaterThan(-1);
    expect(posZuruecknehmen).toBeLessThan(posAbsagen);
  });

  it('der Wisch haengt nicht mehr davon ab, ob der Termin abgesagt ist', () => {
    // Bis zum 16.09.2026 stand hier ein early return, der IonItemSliding nur
    // an abgesagten Terminen baute. Damit gab es am aktiven Termin gar keinen
    // Wisch -- und ohne Wisch kein Absagen.
    expect(quelle).not.toContain('if (!istAbgesagt(event)) return zeile;');
  });

  it('die Absage-Farbe ist warning, wie in der Leitungsliste', () => {
    const leitung = code(LEITUNG_LISTE);
    // Beide Listen faerben denselben Wisch gleich. Waere die eine rot und die
    // andere gelb, hiesse derselbe Griff zweierlei.
    for (const q of [quelle, leitung]) {
      expect(q).toContain('app-icon-circle--warning');
      expect(q).toContain('app-icon-circle--success');
    }
  });
});

describe('der Modus des Modals haengt am Termin, nicht an der Rolle', () => {
  const quelle = code(TEAM_LISTE);

  it('modus kommt aus istAbgesagt(absageTermin)', () => {
    expect(quelle).toContain("get modus() { return istAbgesagt(absageTermin) ? 'grund' as const : 'absagen' as const; }");
  });

  it('modus ist NICHT mehr fest auf grund verdrahtet', () => {
    // Genau die Zeile, die das Absagen aus der Teamer-Ansicht heraushielt.
    expect(quelle).not.toContain("modus: 'grund' as const");
  });

  it('der aktive Termin geht auf /cancel, der abgesagte auf /absagegrund', () => {
    // /cancel lehnt einen bereits abgesagten Termin mit 400 ab und muss das
    // fuer ausgelieferte App-Fassungen weiterhin tun -- deshalb zwei Routen.
    expect(quelle).toContain('api.put(`/events/${termin.id}/absagegrund`');
    expect(quelle).toContain('api.put(`/events/${termin.id}/cancel`');
    // Die Weiche steht im onSave und fragt den Termin, nicht die Rolle.
    expect(/onSave: async \(grund: string\) => \{[\s\S]{0,400}?if \(istAbgesagt\(termin\)\) \{/.test(quelle)).toBe(true);
  });
});

describe('die Handler nehmen den Termin als Parameter', () => {
  const quelle = code(TEAM_LISTE);

  it('handleTerminAbsagen und handleAbsageZuruecknehmen bekommen den Termin uebergeben', () => {
    // Sonst setzt ein Wisch aus der LISTE einen fremden Termin in die
    // Detailansicht -- in der Liste ist keiner geoeffnet.
    expect(quelle).toContain('const handleTerminAbsagen = (termin: Event) => {');
    expect(quelle).toContain('const handleAbsageZuruecknehmen = (termin: Event) => {');
  });

  it('das Modal liest den Termin aus absageTermin, nicht aus selectedEvent', () => {
    expect(quelle).toContain('get terminName() { return absageTermin?.name ?? \'\'; }');
    expect(quelle).toContain('get grundVorgabe() { return absageTermin?.cancelled_reason ?? \'\'; }');
  });

  it('die Detailansicht wird nur nachgezogen, wenn es derselbe Termin ist', () => {
    expect(quelle).toContain('setSelectedEvent(vorher => (vorher && vorher.id === termin.id ? aktualisiert : vorher))');
  });
});

describe('Teamer-Detailansicht: derselbe Absagen-Knopf wie bei der Leitung', () => {
  const quelle = code(TEAM_LISTE);
  const leitungAktionen = code('src/components/admin/views/EventDetailSections.tsx');

  it('der Knopf heisst "Event absagen" und steht auch bei der Leitung so da', () => {
    expect(quelle).toContain("'Event absagen'");
    expect(leitungAktionen).toContain("'Event absagen'");
  });

  it('er erscheint nur am nicht abgesagten Termin', () => {
    // Die Leitung blendet ihn ueber `if (!eventData || isCancelled) return null`
    // aus; hier ueber die Bedingung im JSX. Beide Male: kein zweites Absagen.
    expect(quelle).toContain('{!istAbgesagt(selectedEvent) && (');
    expect(leitungAktionen).toContain('if (!eventData || isCancelled) return null;');
  });

  it('er ist offline gesperrt und sagt es', () => {
    expect(/aria-label="Event absagen"[\s\S]{0,200}?onClick=\{\(\) => handleTerminAbsagen\(selectedEvent\)\}/.test(quelle)).toBe(true);
    expect(quelle).toContain('disabled={!isOnline}');
    expect(quelle).toContain('Du bist offline');
  });

  it('LOESCHEN gibt es in der Teamer-Ansicht nicht', () => {
    // Absichtlich: Ein geloeschter Termin nimmt Chat, Anmeldungen und
    // ausgedruckte QR-Codes mit. Das Backend erlaubt es (DELETE /events/:id
    // steht ebenfalls hinter requireTeamer), die Oberflaeche bietet es nicht.
    expect(quelle).not.toContain('api.delete(`/events/');
    expect(quelle).not.toContain("aria-label=\"Event löschen\"");
  });
});

describe('die anderen beiden Listen bleiben, wie sie waren', () => {
  it('die Leitungsliste bietet weiterhin absagen, Grund und loeschen', () => {
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
