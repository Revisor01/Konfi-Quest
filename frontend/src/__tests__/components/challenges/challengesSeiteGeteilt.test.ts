import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Befund N7 (27.08.2026): Strukturbefund. AdminChallengesPage und
// TeamerChallengesPage waren Zeilenkopien voneinander -- gemessen wichen sie
// in 24 von rund 197 Zeilen ab, groesstenteils Kommentare. Echte Unterschiede
// waren nur Cache-Key, Modal-ID, Importpfade und der Komponentenname; View
// und Modals waren ohnehin schon geteilt.
//
// Der Bericht nannte es "den Naehrboden dieser Fehlerklasse": Jede kuenftige
// Aenderung an der Seite haette man von Hand spiegeln muessen, und genau das
// ist bei M3, M9, B1 und H1 schiefgegangen.
//
// Die Seite steht jetzt einmal in shared/ChallengesPage; die beiden Dateien
// bleiben als duenne Huellen, damit Routen und Importpfade unveraendert sind.
// Dieser Test haelt fest, dass sie duenn BLEIBEN -- sonst waechst die Kopie
// unbemerkt nach.

const lies = (pfad: string) =>
  readFileSync(resolve(process.cwd(), pfad), 'utf8');

const adminSeite = lies('src/components/admin/pages/AdminChallengesPage.tsx');
const teamerSeite = lies('src/components/teamer/pages/TeamerChallengesPage.tsx');
const geteilteSeite = lies('src/components/shared/ChallengesPage.tsx');

describe('Die Challenges-Seite steht nur noch einmal da (N7)', () => {
  it('beide Rollen-Seiten nutzen die geteilte Seite', () => {
    expect(adminSeite).toContain("from '../../shared/ChallengesPage'");
    expect(teamerSeite).toContain("from '../../shared/ChallengesPage'");
  });

  it('die Huellen bleiben duenn', () => {
    // Vorher rund 197 Zeilen je Datei. Waechst eine davon wieder, ist die
    // Kopie zurueck -- dann gehoert die Aenderung in die geteilte Seite.
    expect(adminSeite.split('\n').length).toBeLessThan(40);
    expect(teamerSeite.split('\n').length).toBeLessThan(40);
  });

  it('die Logik steht nicht mehr in den Rollen-Seiten', () => {
    // Stichproben aus dem frueheren Inhalt: Modal-Verdrahtung und die
    // Ableitung der eigenen Abzeichen.
    for (const [name, quelle] of [['admin', adminSeite], ['teamer', teamerSeite]] as const) {
      expect(quelle, name).not.toContain('useIonModal');
      expect(quelle, name).not.toContain('ChallengesManageView');
      expect(quelle, name).not.toContain('manageDirtyRef');
    }
    // Gegenprobe: In der geteilten Seite steht sie sehr wohl.
    expect(geteilteSeite).toContain('useIonModal');
    expect(geteilteSeite).toContain('ChallengesManageView');
    expect(geteilteSeite).toContain('manageDirtyRef');
  });

  it('die Zwischenspeicher der Rollen bleiben getrennt', () => {
    // Wichtig: Der Teamer-Schluessel haengt zusaetzlich an der Person, weil
    // das Backend nach zugewiesenen Jahrgaengen filtert. Zwei Teamer:innen
    // derselben Organisation sehen NICHT dasselbe -- ein gemeinsamer
    // Org-Schluessel wuerde ihnen gegenseitig die Liste unterschieben.
    expect(adminSeite).toContain("'admin:challenges:' + user?.organization_id");
    expect(teamerSeite).toContain('`teamer:challenges:${user?.organization_id}:${user?.id}`');
  });

  it('jede Rolle behaelt ihre eigene Modal-Seiten-ID', () => {
    // useModalPage verwaltet den Modal-Stapel je Seite. Gleiche ID fuer beide
    // Rollen wuerde die Stapel vermischen.
    expect(adminSeite).toContain('modalPageId="admin-challenges"');
    expect(teamerSeite).toContain('modalPageId="teamer-challenges"');
  });
});
