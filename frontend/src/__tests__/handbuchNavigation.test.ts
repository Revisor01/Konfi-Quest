// Handbuch: Abschnitte des aktuellen Kapitels als Unterpunkte in der
// Seitenleiste (Simon, 27.09.2026: "die subpunkte als Unterpunkte ausklappen
// wenn man ein Kapitel anklickt"; schon am 08.09.2026 "13.1 13.2 13.3 auch in
// der navi"). Geprueft wird das ERZEUGTE HTML unter public/docs -- das ist,
// was ausgeliefert wird. Dass es zum Generator passt, prueft die CI getrennt
// (Generator laufen lassen, git diff muss leer sein).
//
// Drei Teile:
// 1. Aufbau: Unter dem aktuellen Kapitel stehen genau dessen h2 mit Nummer
//    und Anker, jeder Anker existiert, die anderen Kapitel bleiben zu.
// 2. Handy: Ein Tipp auf einen Eintrag schliesst das Klappmenue.
// 3. Mitlesen: Der gerade gelesene Abschnitt traegt aria-current="location".
//    2 und 3 fuehren die Skripte der Seite in einem eigenen jsdom aus; Lage
//    und Observer werden dort vorgegeben, weil jsdom kein Layout rechnet.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { JSDOM } from 'jsdom';

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

/** Kapitel wie im Generator: Dateireihenfolge, "80-challenges.md" -> challenges.html. */
const kapitel = readdirSync(resolve(process.cwd(), '../docs/handbuch'))
  .filter((d) => d.endsWith('.md'))
  .sort()
  .map((quelle, i) => ({ quelle, nr: i + 1, seite: `${quelle.replace(/^\d+-/, '').replace(/\.md$/, '')}.html` }));

/** h2-Titel der Markdown-Quelle, ohne Zeilen in Codebloecken. */
const h2DerQuelle = (quelle: string) => {
  let imCode = false;
  return lies(`../docs/handbuch/${quelle}`).split('\n').filter((z) => {
    if (z.trim().startsWith('```')) { imCode = !imCode; return false; }
    return !imCode && /^##\s/.test(z);
  }).map((z) => z.replace(/^##\s+/, '').trim());
};

const parsen = (seite: string) =>
  new DOMParser().parseFromString(lies(`public/docs/${seite}`), 'text/html');

const unterpunkte = (doc: Document) =>
  [...doc.querySelectorAll<HTMLAnchorElement>('nav.seitenleiste .nav-abschnitte a')].map((a) => {
    const nummer = a.querySelector('.nav-abschnitt-nr')?.textContent ?? '';
    return { nummer, titel: (a.textContent ?? '').slice(nummer.length), href: a.getAttribute('href') };
  });

describe('Handbuch-Navigation: Aufbau (Kapitel 12, Challenges)', () => {
  const doc = parsen('challenges.html');
  const nav = doc.querySelector('nav.seitenleiste')!;
  const hier = nav.querySelector<HTMLAnchorElement>('a[aria-current="page"]')!;

  it('das aktuelle Kapitel ist markiert und traegt die Unterpunkte', () => {
    expect(hier.getAttribute('href')).toBe('./challenges.html');
    const liste = hier.parentElement!.querySelector(':scope > ul.nav-abschnitte');
    expect(liste).not.toBeNull();
    // Verschachtelt in der vorhandenen <nav>, nicht daneben.
    expect(liste!.closest('nav.seitenleiste')).toBe(nav);
  });

  it('Nummern, Titel und Anker stimmen mit den h2 des Kapitels ueberein', () => {
    const quelle = h2DerQuelle('80-challenges.md');
    const punkte = unterpunkte(doc);
    expect(punkte).toHaveLength(quelle.length);
    expect(punkte[0]).toEqual({ nummer: '12.1', titel: 'Eine Challenge anlegen', href: '#eine-challenge-anlegen' });
    expect(punkte.map((p) => p.titel)).toEqual(quelle);
    expect(punkte.map((p) => p.nummer)).toEqual(quelle.map((_, i) => `12.${i + 1}`));

    const h2 = [...doc.querySelectorAll('article.kapitel h2[id]')];
    expect(punkte).toEqual(h2.map((h) => {
      const nummer = h.querySelector('.abschnitt-nr')?.textContent ?? '';
      return { nummer, titel: (h.textContent ?? '').slice(nummer.length), href: `#${h.id}` };
    }));
  });

  it('jeder Anker existiert als h2 im Kapitel (keine h3 in der Leiste)', () => {
    const punkte = unterpunkte(doc);
    expect(punkte).toHaveLength(h2DerQuelle('80-challenges.md').length);
    for (const { href } of punkte) {
      const ziel = doc.getElementById(href!.slice(1));
      expect(ziel?.tagName, href!).toBe('H2');
      expect(ziel!.closest('article.kapitel')).not.toBeNull();
    }
  });

  it('die anderen Kapitel bleiben zugeklappt', () => {
    const andere = [...nav.querySelectorAll(':scope ul:not(.nav-abschnitte) > li')]
      .filter((li) => li.querySelector(':scope > a') !== hier);
    expect(andere).toHaveLength(kapitel.length - 1);
    for (const li of andere) expect(li.querySelector('ul')).toBeNull();
    expect(nav.querySelectorAll('ul ul')).toHaveLength(1);
  });
});

describe('Handbuch-Navigation: jede Kapitelseite', () => {
  it.each(kapitel)('$seite zeigt genau die eigenen h2 als Unterpunkte', ({ quelle, nr, seite }) => {
    const doc = parsen(seite);
    const titel = h2DerQuelle(quelle);
    const punkte = unterpunkte(doc);
    expect(punkte.map((p) => p.titel)).toEqual(titel);
    expect(punkte.map((p) => p.nummer)).toEqual(titel.map((_, i) => `${nr}.${i + 1}`));
    for (const { href } of punkte) expect(doc.getElementById(href!.slice(1))?.tagName).toBe('H2');
    const offen = [...doc.querySelectorAll('nav.seitenleiste ul.nav-abschnitte')];
    expect(offen).toHaveLength(1);
    expect(offen[0].parentElement!.querySelector(':scope > a')!.getAttribute('href')).toBe(`./${seite}`);
  });

  it('die Uebersicht bleibt ohne Unterpunkte und ohne Mitlese-Skript', () => {
    const html = lies('public/docs/index.html');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelectorAll('nav.seitenleiste ul ul')).toHaveLength(0);
    expect(doc.querySelectorAll('nav.seitenleiste [aria-current]')).toHaveLength(0);
    expect(html).not.toContain('IntersectionObserver');
  });
});

// --- Skripte der Seite ausfuehren ---

type Lage = { oben: Record<string, number>; blaetternUnten: number };

/**
 * Laedt challenges.html in ein eigenes jsdom und fuehrt die Skripte aus.
 * `schmal` steht fuer die Media-Query (max-width:860px). Der Observer wird
 * nur eingesammelt; der Test ruft ihn selbst, nachdem er die Lage gesetzt hat.
 */
const laden = ({ schmal }: { schmal: boolean }) => {
  const rueckrufe: Array<() => void> = [];
  const lage: Lage = { oben: {}, blaetternUnten: 5000 };
  const dom = new JSDOM(lies('public/docs/challenges.html'), {
    url: 'https://konfi-quest.de/docs/challenges.html',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(w) {
      Object.defineProperty(w, 'innerHeight', { value: 800, configurable: true });
      w.matchMedia = ((q: string) => ({ matches: schmal, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof w.matchMedia;
      (w as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
        constructor(cb: () => void) { rueckrufe.push(cb); }
        observe() {}
        disconnect() {}
      };
      w.HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
        const top = this.classList.contains('blaettern') ? lage.blaetternUnten - 150 : (lage.oben[this.id] ?? 0);
        return { top, bottom: top + 150, left: 0, right: 0, width: 0, height: 150, x: 0, y: top, toJSON() {} } as DOMRect;
      };
    },
  });
  const w = dom.window;
  const ids = [...w.document.querySelectorAll('.nav-abschnitte a')].map((a) => a.getAttribute('href')!.slice(1));
  const markiert = () =>
    [...w.document.querySelectorAll('.nav-abschnitte a[aria-current="location"]')].map((a) => a.getAttribute('href'));
  const melden = () => rueckrufe.forEach((cb) => cb());
  return { w, lage, ids, markiert, melden, rueckrufe };
};

describe('Handbuch-Navigation: Handy-Menue schliesst beim Tippen', () => {
  it('ein Unterpunkt schliesst das offene Menue auf schmalen Bildschirmen', () => {
    const { w } = laden({ schmal: true });
    const klapp = w.document.querySelector('details.nav-klapp')!;
    expect(klapp.hasAttribute('open')).toBe(false); // Startzustand: zu
    klapp.setAttribute('open', '');
    // Der Sprung selbst bleibt dem Browser: Der Klick darf nicht abgefangen werden.
    let abgefangen: boolean | null = null;
    w.addEventListener('click', (ev) => { abgefangen = ev.defaultPrevented; });
    w.document.querySelector<HTMLAnchorElement>('.nav-abschnitte a[href="#den-stempel-vergeben"]')!.click();
    expect(klapp.hasAttribute('open')).toBe(false);
    expect(abgefangen).toBe(false);
  });

  it('ein Kapitel-Link schliesst es ebenso (vor dem Seitenwechsel)', () => {
    const { w } = laden({ schmal: true });
    const klapp = w.document.querySelector('details.nav-klapp')!;
    klapp.setAttribute('open', '');
    // Den Seitenwechsel selbst kann jsdom nicht; nach dem Handler abfangen.
    w.addEventListener('click', (ev) => ev.preventDefault());
    w.document.querySelector<HTMLAnchorElement>('.nav-inhalt a[href="./chat.html"]')!.click();
    expect(klapp.hasAttribute('open')).toBe(false);
  });

  it('auf dem Desktop bleibt die Leiste offen', () => {
    const { w } = laden({ schmal: false });
    const klapp = w.document.querySelector('details.nav-klapp')!;
    expect(klapp.hasAttribute('open')).toBe(true);
    w.document.querySelector<HTMLAnchorElement>('.nav-abschnitte a[href="#den-stempel-vergeben"]')!.click();
    expect(klapp.hasAttribute('open')).toBe(true);
  });
});

describe('Handbuch-Navigation: der gelesene Abschnitt ist markiert', () => {
  // Fenster 800 px hoch, Linie bei 35 % = 280 px.
  const verteilen = (lage: Lage, ids: string[], oben: number[]) => {
    ids.forEach((id, i) => { lage.oben[id] = oben[i] ?? 3000 + i * 500; });
  };

  it('zwei Beobachter: Ueberschriften an der Linie und das Blaettern am Ende', () => {
    const { rueckrufe } = laden({ schmal: false });
    expect(rueckrufe).toHaveLength(2);
  });

  it('vor der ersten Ueberschrift ist nichts markiert', () => {
    const { lage, ids, markiert, melden } = laden({ schmal: false });
    expect(ids).toHaveLength(h2DerQuelle('80-challenges.md').length);
    verteilen(lage, ids, [520]);
    melden();
    expect(markiert()).toEqual([]);
  });

  it('markiert die letzte Ueberschrift oberhalb der Linie -- und nur sie', () => {
    const { lage, ids, markiert, melden } = laden({ schmal: false });
    verteilen(lage, ids, [-1800, -900, 120, 600]);
    melden();
    expect(markiert()).toEqual([`#${ids[2]}`]);
    // Weitergelesen: der vierte kreuzt die Linie.
    verteilen(lage, ids, [-2300, -1400, -380, 100]);
    melden();
    expect(markiert()).toEqual([`#${ids[3]}`]);
  });

  it('am Kapitelende gilt der letzte sichtbare Abschnitt, auch unterhalb der Linie', () => {
    const { lage, ids, markiert, melden } = laden({ schmal: false });
    const n = ids.length;
    verteilen(lage, ids, ids.map((_, i) => (i < n - 2 ? -3000 + i * 100 : 0)));
    lage.oben[ids[n - 2]] = 150;
    lage.oben[ids[n - 1]] = 520; // erreicht die Linie nie
    lage.blaetternUnten = 780; // Blaettern ganz im Bild
    melden();
    expect(markiert()).toEqual([`#${ids[n - 1]}`]);
  });

  it('am Kapitelende gewinnt der angesprungene Abschnitt, wenn er im Bild ist', () => {
    const { w, lage, ids, markiert, melden } = laden({ schmal: false });
    const n = ids.length;
    // So gelegt, dass jede andere Regel etwas anderes waehlte: die Linie den
    // drittletzten, "letzter sichtbarer" den letzten.
    verteilen(lage, ids, ids.map((_, i) => -3000 + i * 100));
    lage.oben[ids[n - 3]] = 100;
    lage.oben[ids[n - 2]] = 350;
    lage.oben[ids[n - 1]] = 520;
    lage.blaetternUnten = 780;
    w.location.hash = `#${ids[n - 2]}`;
    melden();
    expect(markiert()).toEqual([`#${ids[n - 2]}`]);
  });
});
