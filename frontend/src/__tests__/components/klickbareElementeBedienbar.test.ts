import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';

// ---------------------------------------------------------------------------
// Audit 26.09.2026, UI-Bericht BF-03: 147 klickbare div/span/IonIcon/p ohne
// Rolle, Tabindex oder Tastaturhandler. Vorlesehilfen kuendigten die 13
// Eintraege unter „Mehr", die Auswahlzeilen in den Formularen der Leitung,
// die Abzeichen-Kacheln und die Chat-Aktionen als Text an, nicht als
// Schaltflaeche; per Tastatur waren sie unerreichbar.
//
// Regel seitdem: Ein Element mit onClick ist entweder ein <button>/<a> (oder
// IonButton/IonItem button), oder es traegt role="button" tabIndex={0} und
// onKeyDown={tastaturKlick} (utils/tastatur.ts) -- oder es ist ausdruecklich
// role="presentation", weil es nur den Klick nicht durchlaesst (Wrapper um
// eine Aktionsleiste) bzw. weil der eigentliche Knopf in ihm steckt (Zeile mit
// Info-Knopf rechts: der Knopf ist die Zeile INNEN, damit kein Knopf im Knopf
// entsteht).
//
// Zaehlmethode wie im Bericht: alle Oeffnungstags von div/span/IonIcon/IonCard/p
// mit onClick, ohne role/tabIndex/onKeyDown/aria-hidden. Beobachtet vor dem
// Paket: 138 (klammerbewusst; der Bericht zaehlte naiv 147). Ziel: 0.
// ---------------------------------------------------------------------------

const wurzel = resolve(process.cwd(), 'src/components');

const alleTsx = (ordner: string): string[] =>
  readdirSync(ordner).flatMap((name) => {
    const pfad = join(ordner, name);
    if (statSync(pfad).isDirectory()) return alleTsx(pfad);
    return pfad.endsWith('.tsx') ? [pfad] : [];
  });

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

const hat = (tag: string, attribut: string) => new RegExp(`(?:^|\\s)${attribut}\\s*=`).test(tag);

interface Klickbar { ort: string; element: string; tag: string }

const klickbare = (): Klickbar[] =>
  alleTsx(wurzel).flatMap((pfad) => {
    const quelle = readFileSync(pfad, 'utf8');
    const funde: Klickbar[] = [];
    for (const m of quelle.matchAll(/<(div|span|IonIcon|IonCard|p)\b/g)) {
      const start = m.index!;
      const tag = quelle.slice(start, tagEnde(quelle, start) + 1);
      if (!hat(tag, 'onClick')) continue;
      funde.push({ ort: `${relative(wurzel, pfad)}:${quelle.slice(0, start).split('\n').length}`, element: m[1], tag });
    }
    return funde;
  });

describe('Klickbare Elemente sind Schaltflaechen oder ausdruecklich keine (UI BF-03)', () => {
  const alle = klickbare();

  it('findet die klickbaren Nicht-Knoepfe (Plausibilitaet der Zaehlung)', () => {
    expect(alle.length).toBeGreaterThanOrEqual(100);
  });

  it('kein div/span/IonIcon/IonCard/p mit onClick ohne role, tabIndex, onKeyDown oder aria-hidden', () => {
    const ohne = alle
      .filter((k) => !hat(k.tag, 'role') && !hat(k.tag, 'tabIndex') && !hat(k.tag, 'onKeyDown') && !hat(k.tag, 'aria-hidden'))
      .map((k) => `${k.ort} ${k.element}`);
    expect(ohne).toEqual([]);
  });

  it('IonIcon und p mit onClick gibt es nicht mehr -- das sind <button> geworden', () => {
    expect(alle.filter((k) => k.element === 'IonIcon' || k.element === 'p').map((k) => k.ort)).toEqual([]);
  });

  it('jedes role="button" hat tabIndex UND onKeyDown (sonst Rolle ohne Tastatur)', () => {
    const unvollstaendig = alle
      .filter((k) => /(?:^|\s)role=(?:"button"|\{[^}]*'button'[^}]*\})/.test(k.tag))
      .filter((k) => !hat(k.tag, 'tabIndex') || !hat(k.tag, 'onKeyDown'))
      .map((k) => `${k.ort} ${k.element}`);
    expect(unvollstaendig).toEqual([]);
  });

  it('role="presentation" nur, wo der Klick nur gestoppt wird oder der Knopf im Inneren steckt', () => {
    // Abschliessende Liste: Wer eine Stelle hinzufuegt, begruendet sie hier.
    const erlaubt = [
      'admin/modals/ChallengeLeitungModal.tsx',   // Wrapper stoppt den Klick zur Karte
      'admin/pages/AdminSettingsPage.tsx',        // Zeilen mit Info-Knopf: Knopf ist .app-list-item__main
      'chat/MessageBubble.tsx',                   // Blase (Gesten, geschachtelt), Aktionsleiste, Reaktions-Picker
      'konfi/modals/ActivityRequestModal.tsx',    // Foto-Flaeche mit Loeschen-Knopf: Knopf ist der Text
      'teamer/modals/TeamerActivityRequestModal.tsx',
      'konfi/pages/KonfiDashboardPage.tsx',       // Rueckblick-Hinweis mit Ausblenden-Knopf
      'teamer/pages/TeamerDashboardPage.tsx',
    ];
    // 11 Zeilen unter „Mehr", 3 in der Chat-Blase, je 1 in den uebrigen fuenf Dateien.
    const praesentation = alle.filter((k) => /(?:^|\s)role="presentation"/.test(k.tag));
    expect(praesentation.length).toBe(19);
    const fremd = praesentation.map((k) => k.ort).filter((ort) => !erlaubt.some((e) => ort.startsWith(e)));
    expect(fremd).toEqual([]);
  });

  it('die Zeilen unter „Mehr" mit Info-Knopf tragen den Knopf innen, nicht als Knopf im Knopf', () => {
    const quelle = readFileSync(join(wurzel, 'admin/pages/AdminSettingsPage.tsx'), 'utf8');
    const innen = quelle.match(/<div role="button" tabIndex=\{0\} onKeyDown=\{tastaturKlick\} className="app-list-item__main">/g) ?? [];
    expect(innen.length).toBe(11);
  });
});
