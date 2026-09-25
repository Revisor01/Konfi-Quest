// Jedes Eck-Badge, das nur ein Symbol zeigt, traegt role="img" und ein
// aria-label mit demselben Text wie sein title (Simon, 26.09.2026: "sollten
// wir machen"). title lesen Vorlesehilfen meist, aber nicht garantiert -- bei
// mehr als 15.000 Nutzenden ist "meist" zu wenig.
//
// Die Pruefung laeuft ueber den Quelltext ALLER Komponenten, damit ein neues
// Badge nicht ohne Beschriftung durchrutscht: Jedes <div ...app-corner-badge...>,
// auf das (nach einer optionalen Zahl wie {pending}) ein <IonIcon> folgt, ist
// ein Symbol-Badge. Text-Badges (+3P, Level-Schwellen, der Text-Rueckfall in
// StatusBadge) brauchen die Beschriftung nicht -- ihr Inhalt wird gelesen.
//
// Der Quelltext wird ohne Kommentare geprueft (ohneKommentare), wie in
// eckBadgesSymbolStattText.test.tsx.

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';
import { ohneKommentare } from './abgesagteTermineAnsichten.test';

const wurzel = resolve(process.cwd(), 'src/components');

const alleTsx = (ordner: string): string[] =>
  readdirSync(ordner).flatMap((name) => {
    const pfad = join(ordner, name);
    if (statSync(pfad).isDirectory()) return alleTsx(pfad);
    return pfad.endsWith('.tsx') ? [pfad] : [];
  });

/** Index des schliessenden '>' eines JSX-Oeffnungstags, das bei `start` ('<div') beginnt. */
const tagEnde = (quelle: string, start: number): number => {
  let tiefe = 0;
  let anfuehrung: string | null = null;
  for (let i = start; i < quelle.length; i++) {
    const z = quelle[i];
    if (anfuehrung) {
      if (z === anfuehrung) anfuehrung = null;
    } else if (z === "'" || z === '"' || z === '`') {
      anfuehrung = z;
    } else if (z === '{') {
      tiefe++;
    } else if (z === '}') {
      tiefe--;
    } else if (z === '>' && tiefe === 0) {
      return i;
    }
  }
  throw new Error(`Oeffnungstag ohne Ende ab Position ${start}`);
};

interface Badge {
  ort: string;
  tag: string;
}

/** Alle Eck-Badges einer Datei, deren Inhalt ein Symbol ist. */
const symbolBadges = (pfad: string): Badge[] => {
  const quelle = ohneKommentare(readFileSync(pfad, 'utf8'));
  const funde: Badge[] = [];
  let pos = 0;
  for (;;) {
    const start = quelle.indexOf('<div', pos);
    if (start < 0) break;
    const ende = tagEnde(quelle, start);
    pos = ende + 1;
    const tag = quelle.slice(start, ende);
    if (!tag.includes('app-corner-badge') || tag.includes('app-corner-badges')) continue;
    // Inhalt: optional eine Zahl in Klammern ({pending}, {resttage > 0 && resttage}),
    // dann das Symbol.
    const inhalt = quelle.slice(ende + 1, ende + 300).trimStart().replace(/^\{[^}]*\}\s*/, '');
    if (!inhalt.startsWith('<IonIcon')) continue;
    const zeile = quelle.slice(0, start).split('\n').length;
    funde.push({ ort: `${relative(wurzel, pfad)}:${zeile}`, tag });
  }
  return funde;
};

const attribut = (tag: string, name: string): string | null => {
  const m = tag.match(new RegExp(`(?:^|\\s)${name}=(\\{[^]*?\\}|"[^"]*")(?=\\s|$)`));
  return m ? m[1] : null;
};

const badges = alleTsx(wurzel).flatMap(symbolBadges);

describe('Eck-Badges mit Symbol sind fuer Vorlesehilfen beschriftet', () => {
  it('der Scanner findet die Symbol-Badges (Zaehler)', () => {
    // 26.09.2026: 39 Symbol-Badges in 29 Komponenten (34 nachgezogen, 6 hatten
    // die Beschriftung schon; das 'Aktiviert'-Badge der Einstellungen ist am
    // selben Tag mit der Push-Auswahl entfallen). Wer ein Badge hinzufuegt
    // oder entfernt, zieht die Zahl nach -- sie stellt sicher, dass der
    // Scanner nicht ins Leere laeuft und die Pruefungen darunter still gruen
    // werden.
    expect(badges.length).toBe(39);
  });

  it.each(badges.map((b) => [b.ort, b.tag] as const))('%s: role="img" und aria-label = title', (_ort, tag) => {
    expect(tag).toContain('role="img"');
    const title = attribut(tag, 'title');
    const label = attribut(tag, 'aria-label');
    expect(title, 'title fehlt').not.toBeNull();
    expect(label, 'aria-label fehlt').not.toBeNull();
    expect(label).toBe(title);
  });
});
