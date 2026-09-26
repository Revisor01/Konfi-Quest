import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';

// ---------------------------------------------------------------------------
// Audit 26.09.2026, UI-Bericht BF-16: 16 <IonModal> ohne Namen. Ionic rendert
// das Modal als Dialog; ohne Namen kuendigt die Vorlesehilfe nur „Dialog" an,
// nicht „Postfach" oder „Datum waehlen".
//
// Regel: Jedes <IonModal> traegt aria-labelledby auf die id seiner IonTitle
// (Modale mit Kopfzeile) oder aria-label (die Datumswaehler, die nur ein
// IonDatetime enthalten: „<Feld> waehlen"). Die id muss in derselben Datei
// vergeben sein, sonst zeigt der Verweis ins Leere.
//
// Zaehlmethode wie im Bericht (grep ueber components/): beobachtet 17 IonModal,
// 0 mit Namen. Ziel: alle.
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

interface Modal { ort: string; tag: string; quelle: string }

const alleModale = (): Modal[] =>
  alleTsx(wurzel).flatMap((pfad) => {
    const quelle = readFileSync(pfad, 'utf8');
    const funde: Modal[] = [];
    for (const m of quelle.matchAll(/<IonModal\b/g)) {
      const start = m.index!;
      funde.push({ ort: `${relative(wurzel, pfad)}:${quelle.slice(0, start).split('\n').length}`, tag: quelle.slice(start, tagEnde(quelle, start) + 1), quelle });
    }
    return funde;
  });

describe('Jedes Modal hat einen Namen (UI BF-16)', () => {
  const modale = alleModale();

  it('findet die Modale der App (Plausibilitaet der Zaehlung)', () => {
    expect(modale.length).toBeGreaterThanOrEqual(15);
  });

  it('kein <IonModal> ohne aria-label oder aria-labelledby', () => {
    const ohne = modale.filter((m) => !/(?:^|\s)aria-label(?:ledby)?\s*=/.test(m.tag)).map((m) => m.ort);
    expect(ohne).toEqual([]);
  });

  it('jedes aria-labelledby zeigt auf eine id in derselben Datei', () => {
    const kaputt: string[] = [];
    for (const m of modale) {
      const ref = m.tag.match(/aria-labelledby="([^"]+)"/);
      if (!ref) continue;
      if (!m.quelle.includes(`id="${ref[1]}"`)) kaputt.push(`${m.ort} -> #${ref[1]}`);
    }
    expect(kaputt).toEqual([]);
  });

  it('Modale mit Kopfzeile sind ueber ihren Titel benannt, nicht ueber einen zweiten Text', () => {
    // Postfach und „Neuer Rueckblick" haben eine IonTitle -- die IST der Name.
    const mitTitel = modale.filter((m) => /aria-labelledby=/.test(m.tag)).map((m) => m.ort.split(':')[0]).sort();
    expect(mitTitel).toEqual(['admin/pages/AdminWrappedPage.tsx', 'common/PostfachModal.tsx']);
    const postfach = readFileSync(join(wurzel, 'common/PostfachModal.tsx'), 'utf8');
    expect(postfach).toContain('<IonTitle id="postfach-modal-titel">Postfach</IonTitle>');
  });

  it('Datumswaehler-Modale heissen „… waehlen"', () => {
    const waehler = modale.filter((m) => /keepContentsMounted/.test(m.tag));
    expect(waehler.length).toBe(15);
    const falsch = waehler.filter((m) => !/aria-label="[^"]+ wählen"/.test(m.tag)).map((m) => m.ort);
    expect(falsch).toEqual([]);
  });
});
