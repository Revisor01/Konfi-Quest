// Ein abgesagter Termin hat in allen drei Rollen dieselbe Farbe
// (Nachpruefung zu Simons Befund vom 17.09.2026)
//
// SIMONS BEFUND LAUTETE: "Termin abgesagt erscheint in rot bei Teamer nicht
// in grau wie bei Konfis. Das Konfi grau finde ich besser."
//
// GEGEN DEN CODE GEPRUEFT — DIE ERSTE HAELFTE STIMMT NICHT:
// Die Konfi-Ansicht faerbt abgesagte Termine NICHT grau, sondern rot, und
// zwar an jeder Stelle:
//   konfi/views/EventsView.tsx      -> if (isCancelled) statusColor = C.danger
//   konfi/views/EventDetailView.tsx -> if (istAbgesagt(eventData)) return danger
// Genau dasselbe tut die Teamer-Ansicht. Die beiden Rollen sind also bereits
// gleich; es gibt kein "Konfi-Grau", auf das sich das Team angleichen
// koennte. Die gemeinsame Legende (shared/EventLegendModal.tsx) fuehrt
// "Absage / Abmeldung" ausdruecklich fuer konfi, teamer UND admin in
// --app-color-danger.
//
// WAS IN DER KONFI-LISTE GRAU IST, IST DER TITEL: Ein abgesagter Termin wird
// durchgestrichen und in --app-text-muted gesetzt. Das ist vermutlich, was im
// Vorbeigehen als "grau" gelesen wurde. Die Teamer-Liste tut das seit dem
// 15.09.2026 ebenfalls (TeamerEventsPage.tsx, Titel-Zeile).
//
// DESHALB WURDE HIER NICHTS UMGEFAERBT. Waere die Teamer-Ansicht auf Grau
// gestellt worden, waere sie als EINZIGE der drei Rollen grau geworden --
// aus einer behaupteten Ungleichheit waere eine echte geworden, gegen die
// Legende, die alle drei Rollen sehen.
//
// Dieser Test haelt den geprueften Zustand fest: Wenn die Farbe fuer
// abgesagte Termine geaendert wird, dann in ALLEN Rollen und in der Legende
// zugleich. Geprueft wird am Quelltext ohne Kommentare -- ein Farbname in
// einer Erklaerung darf nicht anschlagen (diese Verwechslung ist im Repo
// schon dreimal passiert).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ohneKommentare = (quelltext: string): string =>
  quelltext
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:/])\/\/[^\n]*/g, '$1');

const lies = (pfad: string): string =>
  ohneKommentare(readFileSync(resolve(process.cwd(), pfad), 'utf8'));

describe('Abgesagte Termine tragen in Konfi, Team und Legende dieselbe Farbe', () => {
  it('die Konfi-Liste faerbt abgesagte Termine rot (nicht grau)', () => {
    const quelle = lies('src/components/konfi/views/EventsView.tsx');
    expect(quelle).toContain('if (isCancelled) statusColor = C.danger;');
    // Die Gegenrichtung: kein neutraler Zweig fuer die Absage.
    expect(quelle).not.toContain('if (isCancelled) statusColor = C.past;');
  });

  it('das Konfi-Detail faerbt abgesagte Termine rot', () => {
    const quelle = lies('src/components/konfi/views/EventDetailView.tsx');
    expect(quelle).toContain('if (istAbgesagt(eventData)) return danger;');
  });

  it('die Teamer-Liste faerbt abgesagte Termine rot -- also genauso wie die Konfi-Liste', () => {
    const quelle = lies('src/components/teamer/pages/TeamerEventsPage.tsx');
    expect(quelle).toContain("statusText = 'Abgesagt';");
    expect(quelle).toContain('statusColor = C.danger;');
  });

  it('das Teamer-Detail faerbt abgesagte Termine rot -- also genauso wie das Konfi-Detail', () => {
    const quelle = lies('src/components/teamer/pages/TeamerEventsPage.tsx');
    expect(quelle).toContain('if (istAbgesagt(event)) return danger;');
  });

  it('die gemeinsame Legende nennt die Absage fuer alle drei Rollen in Rot', () => {
    const quelle = lies('src/components/shared/EventLegendModal.tsx');
    // Der Eintrag traegt --app-color-danger und gilt fuer konfi, teamer, admin.
    expect(quelle).toContain("label: 'Absage / Abmeldung'");
    const eintrag = quelle.slice(quelle.indexOf("label: 'Absage / Abmeldung'") - 200, quelle.indexOf("label: 'Absage / Abmeldung'") + 200);
    expect(eintrag).toContain('var(--app-color-danger)');
    expect(eintrag).toContain("'konfi'");
    expect(eintrag).toContain("'teamer'");
    expect(eintrag).toContain("'admin'");
  });
});

describe('Das Graue an einem abgesagten Termin ist der Titel -- in Konfi UND Team', () => {
  it('die Konfi-Liste setzt den Titel eines abgesagten Termins auf app-text-muted', () => {
    const quelle = lies('src/components/konfi/views/EventsView.tsx');
    expect(quelle).toContain("color: isCancelled || shouldGrayOut ? 'var(--app-text-muted)' : undefined");
  });

  it('die Teamer-Liste tut dasselbe -- gleiche Bedingung, gleiches Token', () => {
    const quelle = lies('src/components/teamer/pages/TeamerEventsPage.tsx');
    expect(quelle).toContain("color: istAbgesagt(event) || shouldGrayOut ? 'var(--app-text-muted)' : undefined");
  });

  it('und beide streichen den Titel durch, ueber dieselbe gemeinsame Funktion', () => {
    for (const pfad of [
      'src/components/konfi/views/EventsView.tsx',
      'src/components/teamer/pages/TeamerEventsPage.tsx',
    ]) {
      expect(lies(pfad)).toContain("textDecoration: titelDekoration('liste', event)");
    }
  });
});

// ====================================================================
// NACHTRAG 17.09.2026: Simons Befund war doch berechtigt -- nur an einer
// anderen Stelle, als der Test oben geprueft hat.
//
// Auf die Rueckfrage, ob abgesagte Termine ueberall grau werden sollen,
// antwortete er: "nein. ich will sie nur grau auf dem button bis du dabei?
// an allen anderen stellen nicht."
//
// Gemeint ist der HINWEIS IN DER KARTE "Bist du dabei?", der an einem
// abgesagten Termin statt der Knoepfe steht. Und dort gab es den Unterschied
// wirklich:
//   Konfi  -> <IonNote color="medium">   (grau)
//   Team   -> app-status-box--danger     (rot)
//
// Der Test oben hat diese Stelle nicht erfasst -- er sah nur Listenfarbe und
// Titel. Beides bleibt unveraendert rot bzw. grau; geaendert wird
// ausschliesslich der Karten-Hinweis.
// ====================================================================
describe('Der Hinweis in der Karte "Bist du dabei?" ist grau -- in beiden Rollen', () => {
  const KONFI = 'src/components/konfi/views/EventDetailView.tsx';
  const TEAM = 'src/components/teamer/pages/TeamerEventsPage.tsx';

  it('die Konfi-Ansicht nutzt IonNote color="medium"', () => {
    expect(lies(KONFI)).toContain('<IonNote color="medium"');
  });

  it('die Teamer-Ansicht nutzt jetzt dieselbe Darstellung', () => {
    expect(lies(TEAM)).toContain('<IonNote color="medium"');
  });

  it('und NICHT mehr die rote Statusbox fuer diesen Hinweis', () => {
    const quelle = lies(TEAM);
    const hinweis = quelle.indexOf('Dieser Termin ist abgesagt');
    expect(hinweis).toBeGreaterThan(-1);
    // Die 300 Zeichen vor dem Hinweistext duerfen kein --danger tragen.
    const davor = quelle.slice(Math.max(0, hinweis - 300), hinweis);
    expect(davor).not.toContain('app-status-box--danger');
  });

  it('die Listenfarbe bleibt in BEIDEN Rollen rot -- nur der Hinweis wird grau', () => {
    // Simons Vorgabe: "an allen anderen stellen nicht."
    expect(lies('src/components/konfi/views/EventsView.tsx'))
      .toContain('if (isCancelled) statusColor = C.danger');
    expect(lies(TEAM)).toContain('if (istAbgesagt(event)) return danger');
  });
});
