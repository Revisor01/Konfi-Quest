import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';
import * as zentraleIcons from '../../components/shared/icons';

// Icon-Konsolidierung (Simon, 05.09.2026): "kannst du es so bauen, dass wir
// nur an einer stelle die icons anpassen muessen damit ueberall an der
// richtigen stelle die icons geaendert werden ... dann haben wir einfach
// mehr flexibilitaet."
//
// Vorher importierten 144 Dateien direkt aus 'ionicons/icons'. Jetzt ist
// components/shared/icons.ts DIE eine Stelle: semantische Konstanten
// (ICON_TERMIN, ICON_ZUSAGE, ...), die Komponenten nur noch von dort holen.
//
// Diese Tests lesen die Quellen, statt zu rendern (Muster wie
// abzeichenZaehlerTeamer.test.ts): Geprueft wird die Verdrahtung — sie ist
// genau das, was bei einem spaeteren Icon-Wechsel nicht zerbrechen darf.

const lies = (pfad: string) =>
  readFileSync(resolve(process.cwd(), pfad), 'utf8');

/** Alle .ts/.tsx unterhalb eines Verzeichnisses, rekursiv. */
function dateienUnter(verzeichnis: string): string[] {
  const voll = resolve(process.cwd(), verzeichnis);
  const raus: string[] = [];
  for (const eintrag of readdirSync(voll)) {
    const pfad = join(voll, eintrag);
    if (statSync(pfad).isDirectory()) {
      raus.push(...dateienUnter(join(verzeichnis, eintrag)));
    } else if (eintrag.endsWith('.ts') || eintrag.endsWith('.tsx')) {
      raus.push(join(verzeichnis, eintrag));
    }
  }
  return raus;
}

// Bewusste Ausnahmen vom Verbot des Direktimports:
//   * die zentrale Datei selbst — sie MUSS aus ionicons importieren.
//   * utils/badgeIcons.ts — loest in der DATENBANK gespeicherte Icon-Namen
//     auf (badge.icon, certificate.icon). Datenvertrag, keine UI-Semantik;
//     alte App-Versionen lesen dieselben Werte.
const AUSNAHMEN = new Set([
  'src/components/shared/icons.ts',
  'src/utils/badgeIcons.ts',
]);

describe('Zentrale Icon-Datei: eine Stelle fuer alle Icons', () => {
  it('keine Komponente importiert direkt aus ionicons/icons', () => {
    const verstoesse: string[] = [];
    for (const verzeichnis of ['src/components', 'src/navigation', 'src/utils', 'src/contexts', 'src/services']) {
      let dateien: string[];
      try {
        dateien = dateienUnter(verzeichnis);
      } catch {
        continue; // Verzeichnis existiert nicht — nichts zu pruefen.
      }
      for (const datei of dateien) {
        const normal = datei.split('\\').join('/');
        if (AUSNAHMEN.has(normal)) continue;
        if (lies(datei).includes("'ionicons/icons'")) verstoesse.push(normal);
      }
    }
    expect(verstoesse).toEqual([]);
  });

  it('jede semantische Konstante ist definiert und ein nicht-leerer String', () => {
    const namen = Object.keys(zentraleIcons);
    for (const name of namen) {
      expect(name.startsWith('ICON_')).toBe(true);
      const wert = (zentraleIcons as Record<string, unknown>)[name];
      expect(typeof wert).toBe('string');
      expect((wert as string).length).toBeGreaterThan(0);
    }
    // Konkrete Zahl statt "irgendwas": Stand der Konsolidierung 05.09.2026.
    // Wer eine Konstante ergaenzt oder entfernt, zieht die Zahl bewusst nach.
    expect(namen.length).toBe(190);
  });

  it('keine Konstante ist verwaist — jede wird auch benutzt', () => {
    // Eine exportierte, aber nirgends benutzte Konstante ist totes Inventar
    // (so wie arrowBack: 17 Dateien importierten es 09/2026 noch, nutzten es
    // aber seit dem Umstieg auf ICON_ZURUECK nicht mehr).
    const benutzt = new Set<string>();
    for (const verzeichnis of ['src/components', 'src/navigation', 'src/utils']) {
      for (const datei of dateienUnter(verzeichnis)) {
        if (datei.split('\\').join('/') === 'src/components/shared/icons.ts') continue;
        for (const treffer of lies(datei).matchAll(/\bICON_[A-Z0-9_]+\b/g)) {
          benutzt.add(treffer[0]);
        }
      }
    }
    const verwaist = Object.keys(zentraleIcons).filter((n) => !benutzt.has(n));
    expect(verwaist).toEqual([]);
  });

  it('Bedeutungen bleiben unterscheidbar: Zusage und Absage sind verschiedene Glyphen', () => {
    expect(zentraleIcons.ICON_ZUSAGE_GEFUELLT).not.toBe(zentraleIcons.ICON_ABSAGE);
    expect(zentraleIcons.ICON_SICHTBAR).not.toBe(zentraleIcons.ICON_VERBORGEN);
  });

  it('Aliase teilen sich absichtlich das Glyph, haengen aber an eigenen Konstanten', () => {
    // home traegt zwei Bedeutungen (Gottesdienst-Kategorie und Start-Tab),
    // people ebenso (Gruppe und Gemeinde-Kategorie). Gleiches Glyph heute —
    // getrennte Konstanten, damit ein Tausch nur die gemeinte Stelle trifft.
    expect(zentraleIcons.ICON_STARTSEITE_GEFUELLT).toBe(zentraleIcons.ICON_GOTTESDIENST_GEFUELLT);
    expect(zentraleIcons.ICON_GEMEINDE_GEFUELLT).toBe(zentraleIcons.ICON_GRUPPE_GEFUELLT);
  });
});

describe('Alle drei Rollen nutzen dieselben Konstanten fuer dieselbe Bedeutung', () => {
  it('Punktart-Symbol (Gottesdienst/Gemeinde) ist in allen drei Terminlisten identisch verdrahtet', () => {
    const muster = "'gottesdienst' ? ICON_GOTTESDIENST_GEFUELLT : ICON_GEMEINDE_GEFUELLT";
    expect(lies('src/components/admin/EventsView.tsx')).toContain(muster);
    expect(lies('src/components/konfi/views/EventsView.tsx')).toContain(muster);
    expect(lies('src/components/teamer/pages/TeamerEventsPage.tsx')).toContain(muster);
  });

  it('Tab-Leiste: Chat und Challenges tragen fuer jede Rolle dieselbe Konstante', () => {
    const baeume = lies('src/navigation/rollenBaeume.ts');
    // admin, teamer, konfi — je ein Chat- und ein Challenges-Tab.
    expect(baeume.match(/icon: ICON_CHATS_GEFUELLT, label: 'Chat'/g)?.length).toBe(3);
    expect(baeume.match(/icon: ICON_CHALLENGE_GEFUELLT, label: 'Challenges'/g)?.length).toBe(3);
    // Start-Tab (teamer + konfi; admin startet auf der Konfi-Liste).
    expect(baeume.match(/icon: ICON_STARTSEITE_GEFUELLT, label: 'Start'/g)?.length).toBe(2);
  });

  it('Onboarding: der Start-Schritt zeigt bei Konfi und Teamer dasselbe Startseiten-Symbol', () => {
    expect(lies('src/components/konfi/modals/KonfiOnboardingModal.tsx')).toContain('icon: ICON_STARTSEITE,');
    expect(lies('src/components/teamer/modals/TeamerOnboardingModal.tsx')).toContain('icon: ICON_STARTSEITE,');
  });

  it('Status-Symbole kommen fuer alle Rollen aus der einen Map in StatusBadge', () => {
    // StatusBadge ist die Single Source of Truth fuer Event-Status-Icons
    // (Kommentar dort, 05.09.2026: 'Abgesagt von dir' fehlte und fiel auf
    // Text zurueck). Die Map muss auf den semantischen Konstanten stehen,
    // sonst laeuft ein Icon-Wechsel an ihr vorbei.
    const badge = lies('src/components/shared/StatusBadge.tsx');
    expect(badge).toContain("'Verbucht': ICON_ZUSAGE_GEFUELLT");
    expect(badge).toContain("'Abgesagt': ICON_ABSAGE");
    expect(badge).toContain("'Abgesagt von dir': ICON_ABSAGE");
    expect(badge).toContain("'Warteliste': ICON_WARTEND");
  });

  it('Material-Link-Kennzeichnung ist bei Leitung und Teamer dieselbe', () => {
    const muster = 'mat.link_url ? ICON_LINK : ICON_DATEI_GEFUELLT';
    expect(lies('src/components/admin/pages/AdminMaterialPage.tsx')).toContain(muster);
    expect(lies('src/components/teamer/pages/TeamerMaterialPage.tsx')).toContain(muster);
  });
});

describe('Nur-Kontur-Modus gilt fuer ALLE Konstanten', () => {
  // Simon, 06.09.2026: "icon benachrichtigungen bei admin mehr ist noch
  // nicht line."
  //
  // Der erste Umbau erfasste nur die _GEFUELLT-Namen. 20 Konstanten OHNE
  // dieses Namensteil zeigten weiter auf gefuellte Glyphen -- darunter
  // ICON_BENACHRICHTIGUNG (notifications), ICON_MEHR (ellipsisHorizontal)
  // und ICON_ABSAGE (closeCircle). Sie fielen durch, weil die Umstellung am
  // NAMEN haing statt am Glyph.
  //
  // Dieser Test prueft das Glyph: Jede Konstante muss auf eine
  // -Outline-Variante zeigen. Ein neues gefuelltes Icon faellt sofort auf.
  it('jede Konstante zeigt auf ein Outline-Glyph', () => {
    const quelle = lies('src/components/shared/icons.ts');
    const paare = [...quelle.matchAll(/ {2}(\w+) as (ICON_[A-Z_]+),/g)];
    expect(paare.length).toBeGreaterThan(150);
    const gefuellt = paare
      .filter((m) => !m[1].endsWith('Outline'))
      .map((m) => `${m[2]} -> ${m[1]}`);
    expect(gefuellt).toEqual([]);
  });
});
