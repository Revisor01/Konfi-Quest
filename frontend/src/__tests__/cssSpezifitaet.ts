// CSS-Rechnung fuer Stil-Waechter: Regeln eines Stylesheets lesen und die
// Spezifitaet eines Selektors so rechnen, wie der Browser es tut. Ein
// Text-Test kann das Rendering nicht sehen, aber gegen ein Theme pruefen,
// ob eine App-Regel jeden Theme-Selektor echt schlaegt -- dann ist die
// Ladereihenfolge der Stylesheets egal. Genutzt von dunkelmodus.test.ts und
// hinweisBoxSchrift.test.ts.

/**
 * Alle Regeln eines Stylesheets als Selektor + Rumpf. At-Regeln (@media,
 * @supports, @font-face) werden geoeffnet und ihr Inhalt normal gelesen;
 * ihre eigene Kopfzeile ist keine Regel.
 */
export function regeln(cssText: string): { selektor: string; rumpf: string }[] {
  const raus: { selektor: string; rumpf: string }[] = [];
  let kopf = '';
  for (let i = 0; i < cssText.length; i++) {
    const c = cssText[i];
    if (c === '{') {
      if (kopf.trim().startsWith('@')) { kopf = ''; continue; }
      const ende = cssText.indexOf('}', i);
      raus.push({ selektor: kopf.trim(), rumpf: cssText.slice(i + 1, ende) });
      i = ende;
      kopf = '';
    } else if (c === '}') kopf = '';
    else kopf += c;
  }
  return raus;
}

/** Eine Selektorliste an den Kommas der obersten Ebene trennen -- Kommas in :not(a, b) bleiben. */
export function teileObersteEbene(text: string): string[] {
  const raus: string[] = [];
  let tiefe = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '(' || c === '[') tiefe++;
    else if (c === ')' || c === ']') tiefe--;
    else if (c === ',' && tiefe === 0) { raus.push(text.slice(start, i)); start = i + 1; }
  }
  raus.push(text.slice(start));
  return raus;
}

/** Der letzte Verbund-Selektor eines komplexen Selektors -- das Element, das die Regel trifft. */
export function letzterVerbund(selektor: string): string {
  let tiefe = 0;
  let start = 0;
  for (let i = 0; i < selektor.length; i++) {
    const c = selektor[i];
    if (c === '(' || c === '[') tiefe++;
    else if (c === ')' || c === ']') tiefe--;
    else if (tiefe === 0 && /[\s>+~]/.test(c)) start = i + 1;
  }
  return selektor.slice(start);
}

/**
 * Spezifitaet eines einzelnen komplexen Selektors als [IDs, Klassen, Elemente]
 * nach Selectors Level 4: Klassen, Attribute und Pseudoklassen zaehlen gleich;
 * :not()/:is()/:has() zaehlen wie ihr spezifischstes Argument, :where() nichts;
 * Pseudoelemente zaehlen wie Elemente.
 */
export function spezifitaet(selektor: string): [number, number, number] {
  const s = selektor.trim();
  let ids = 0;
  let klassen = 0;
  let elemente = 0;
  let i = 0;
  const name = () => {
    const m = /^[\w-]+/.exec(s.slice(i));
    if (!m) throw new Error(`Name erwartet in "${s}" an Stelle ${i}`);
    i += m[0].length;
    return m[0];
  };
  const klammer = () => {
    let tiefe = 0;
    const start = i + 1;
    for (; i < s.length; i++) {
      if (s[i] === '(') tiefe++;
      else if (s[i] === ')' && --tiefe === 0) { const inhalt = s.slice(start, i); i++; return inhalt; }
    }
    throw new Error(`Klammer nicht geschlossen in "${s}"`);
  };
  while (i < s.length) {
    const c = s[i];
    if (c === '#') { i++; name(); ids++; }
    else if (c === '.') { i++; name(); klassen++; }
    else if (c === '[') { i = s.indexOf(']', i) + 1; klassen++; }
    else if (c === ':' && s[i + 1] === ':') { i += 2; name(); if (s[i] === '(') klammer(); elemente++; }
    else if (c === ':') {
      i++;
      const n = name();
      if (s[i] !== '(') { klassen++; continue; }
      const inhalt = klammer();
      if (n === 'not' || n === 'is' || n === 'has') {
        const max = teileObersteEbene(inhalt).map(spezifitaet).sort(vergleich).pop()!;
        ids += max[0]; klassen += max[1]; elemente += max[2];
      } else if (n !== 'where') klassen++;
    }
    else if (/[\s>+~*]/.test(c)) i++;
    else if (/[a-zA-Z]/.test(c)) { name(); elemente++; }
    else throw new Error(`Unerwartetes Zeichen "${c}" in "${s}"`);
  }
  return [ids, klassen, elemente];
}

/** Positiv, wenn a spezifischer ist als b; 0 bei Gleichstand (dann entscheidet die Reihenfolge). */
export function vergleich(a: [number, number, number], b: [number, number, number]): number {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}
