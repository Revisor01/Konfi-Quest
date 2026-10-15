import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Angeglichene Rollen-Unterschiede (Simon, 05.09.2026).
//
// Die Token-Konsolidierung hat sichtbar gemacht, was vorher in hunderten
// Fundstellen verborgen lag: Dieselbe Sache trug bei admin, teamer und konfi
// verschiedene Zeichen und Abstaende. Welche Zeichen, Farben und Abstaende
// das sind, ist Layout und wird nicht festgeschrieben (Simon, 15.10.2026).
// Geblieben ist, was Verhalten oder eine einzige Quelle sichert.
//
// Die Tests pruefen bewusst die VERDRAHTUNG in den Quellen und nicht das
// Rendern: Der Fehlerfall ist "jemand baut an EINER Stelle wieder etwas
// Eigenes", und genau das faengt ein Quelltest zuverlaessiger als ein
// Rendertest je Ansicht.

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

describe('Das Zeichen einer Aktivitaet steht an einer Stelle', () => {
  it('die Admin-Aktivitaetenliste liest es aus punkteartSymbole.ts, wie der Browser', () => {
    // Das Zeichen einer Aktivitaet steht seit 13.10.2026 an EINER Stelle fuer
    // App und Browser (punkteartSymbole.ts); die Liste der App liest es dort.
    const detail = lies('src/components/admin/views/KonfiDetailSections.tsx');
    expect(detail).toContain('aktivitaetSymbol(activity.type, isTeamer)');
  });
});

describe('Die App kennt ihre eigene Version', () => {
  // Simon, 06.09.2026: "warum zeigt er das? wir sind doch auf 2.1.1"
  //
  // Der Store-Update-Hinweis vergleicht die Store-Version mit App.getInfo().
  // Im iOS-Projekt stand noch 1.5.3, waehrend version.json 2.1.1 sagt --
  // die App hielt sich fuer aelter und meldete 2.0.0 als "neuer".
  // Ausgelieferte Builds waren NIE betroffen: Dort setzt
  // scripts/apply-version.sh die Version in der CI. Nur der lokale Stand
  // lief weg, und genau der laeuft beim Geraetetest.
  it('die iOS-Version stimmt mit version.json ueberein', () => {
    const version = JSON.parse(lies('version.json')).version as string;
    const pbx = lies('ios/App/App.xcodeproj/project.pbxproj');
    const treffer = [...pbx.matchAll(/MARKETING_VERSION = ([^;]+);/g)].map((m) => m[1].trim());
    expect(treffer.length).toBeGreaterThan(0);
    for (const t of treffer) expect(t).toBe(version);
  });
});

describe('Chat: die Reiter kommen aus der gemeinsamen Beschreibung', () => {
  it('die Reiter heissen Alle, Ungelesen, Konfis und Team', () => {
    // Seit 09.10.2026 aus der gemeinsamen Beschreibung (seiten/chats.ts); dass
    // App und Browser genau diese Reiter zeigen, prueft __tests__/seiten/chats.test.tsx gerendert.
    const seite = lies('src/components/chat/ChatOverview.tsx');
    expect(seite).toContain("from '../../seiten/chats'");
    expect(seite).toContain('chatReiterFuer(gehoertZumTeam).map(');
  });
});
