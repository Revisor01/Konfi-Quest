import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';

// ---------------------------------------------------------------------------
// Audit 26.09.2026, UI-Bericht BF-16, Nebenbefund: Die per useIonModal
// geoeffneten Modale hatten keinen Namen. Gezaehlt (27.09.2026, dieses
// Skript): 92 Aufrufe in 39 Dateien, 0 mit htmlAttributes -- und damit 92
// Dialoge, die VoiceOver/TalkBack nur als „Dialog" ansagen.
//
// Loesung an EINER Stelle (utils/modalNamen.ts): Beim Oeffnen wird der Titel
// des Modals -- das erste eigene ion-title, sonst data-dialogname -- als
// aria-label an die Dialog-Huelle im Shadow-DOM gesetzt. Das traegt nur, wenn
//   (1) der Beobachter in App.tsx angeschaltet ist und
//   (2) jede per Hook geoeffnete Komponente einen Titel mitbringt.
// Beides haelt dieser Test fest; dass der Name wirklich am Dialog ankommt,
// prueft modaleUeberHookBenanntGerendert.test.tsx mit echtem Ionic.
// ---------------------------------------------------------------------------

const src = resolve(process.cwd(), 'src');

const alleDateien = (ordner: string): string[] =>
  readdirSync(ordner).flatMap((name) => {
    const pfad = join(ordner, name);
    if (statSync(pfad).isDirectory()) return name === '__tests__' ? [] : alleDateien(pfad);
    return /\.(tsx|ts)$/.test(pfad) ? [pfad] : [];
  });

const aufloesen = (von: string, spezifizierer: string): string | null => {
  const basis = resolve(dirname(von), spezifizierer);
  for (const endung of ['.tsx', '.ts', '/index.tsx', '/index.ts']) {
    if (existsSync(basis + endung)) return basis + endung;
  }
  return null;
};

interface Aufruf { ort: string; komponente: string; quelle: string | null; herkunft: string }

// Quelltext der Komponente: importiert -> ganze Datei (ueber Sammel-Exporte
// wie shared/index.ts hinweg); in derselben Datei definiert -> von der
// Definition bis zur naechsten Definition auf gleicher oder hoeherer Ebene.
const komponentenQuelle = (datei: string, quelle: string, name: string): { text: string | null; herkunft: string } => {
  const imp = quelle.match(new RegExp(`import\\s+(?:${name}\\b[^;]*?|\\{[^}]*\\b${name}\\b[^}]*\\})\\s+from\\s+['"]([^'"]+)['"]`));
  if (imp) {
    let ziel = aufloesen(datei, imp[1]);
    const weiter = ziel ? readFileSync(ziel, 'utf8').match(new RegExp(`export\\s*\\{\\s*default\\s+as\\s+${name}\\s*\\}\\s*from\\s*['"]([^'"]+)['"]`)) : null;
    if (ziel && weiter) ziel = aufloesen(ziel, weiter[1]);
    return { text: ziel ? readFileSync(ziel, 'utf8') : null, herkunft: ziel ? relative(src, ziel) : `unaufgeloest: ${imp[1]}` };
  }
  const def = new RegExp(`^([ \\t]*)(?:export\\s+)?(?:const|function)\\s+${name}\\b`, 'm').exec(quelle);
  if (!def) return { text: null, herkunft: 'nicht gefunden' };
  const rest = quelle.slice(def.index + def[0].length);
  const naechste = new RegExp(`^[ \\t]{0,${def[1].length}}(?:export\\s+)?(?:const|function|interface|type)\\s`, 'm').exec(rest);
  const ende = naechste ? def.index + def[0].length + naechste.index : undefined;
  return { text: quelle.slice(def.index, ende), herkunft: `${relative(src, datei)} (lokal)` };
};

const alleAufrufe = (): Aufruf[] =>
  alleDateien(src).flatMap((pfad) => {
    const quelle = readFileSync(pfad, 'utf8');
    return [...quelle.matchAll(/useIonModal\(\s*([A-Za-z0-9_]+)/g)].map((m) => {
      const { text, herkunft } = komponentenQuelle(pfad, quelle, m[1]);
      return {
        ort: `${relative(src, pfad)}:${quelle.slice(0, m.index).split('\n').length}`,
        komponente: m[1],
        quelle: text,
        herkunft,
      };
    });
  });

// Ein Titel, den utils/modalNamen.ts findet: ion-title (auch ueber die
// gemeinsame Kopfzeile, die ihn rendert) oder data-dialogname.
const hatTitel = (text: string): boolean =>
  /<IonTitle\b[^>]*>/.test(text) || /<AppKopfzeile\b[^>]*\btitel=/.test(text) || /\bdata-dialogname=/.test(text);

describe('Per useIonModal geoeffnete Modale haben einen Namen (UI BF-16, Nebenbefund)', () => {
  const aufrufe = alleAufrufe();

  // 88 seit 02.10.2026 (2.4.0): Das Challenge-Detail der Konfis und die
  // Challenge-Ansicht der Leitung sind eigene Seiten statt Dialoge; das
  // Formular zum Bearbeiten oeffnen Liste und Seite ueber einen Hook statt je
  // fuer sich. Die Grenze bleibt zwei unter dem gezaehlten Stand.
  it('findet die Hook-Modale der App (Plausibilitaet der Zaehlung: 92 am 27.09.2026, 88 am 02.10.2026)', () => {
    expect(aufrufe.length).toBeGreaterThanOrEqual(86);
  });

  it('jede Komponente ist auffindbar', () => {
    expect(aufrufe.filter((a) => a.quelle === null).map((a) => `${a.ort} ${a.komponente} (${a.herkunft})`)).toEqual([]);
  });

  it('jede per Hook geoeffnete Komponente traegt einen Titel (ion-title oder data-dialogname)', () => {
    const ohne = aufrufe
      .filter((a) => a.quelle !== null && !hatTitel(a.quelle))
      .map((a) => `${a.ort} ${a.komponente} (${a.herkunft})`);
    expect(ohne).toEqual([]);
  });

  it('die zwei Vollbild-Ansichten ohne Kopfzeile nennen sich ueber data-dialogname', () => {
    const vollbild = [...new Set(aufrufe
      .filter((a) => a.quelle !== null && !/<IonTitle\b|<AppKopfzeile\b/.test(a.quelle))
      .map((a) => a.herkunft))].sort();
    expect(vollbild).toEqual(['components/shared/FileViewerModal.tsx', 'components/wrapped/WrappedModal.tsx']);
  });

  it('der Beobachter ist in App.tsx einmal fuer die ganze App angeschaltet', () => {
    const app = readFileSync(join(src, 'App.tsx'), 'utf8');
    expect(app).toContain("import { modalNamenAnschalten } from './utils/modalNamen';");
    expect(app).toMatch(/useEffect\(\(\) => modalNamenAnschalten\(\), \[\]\);/);
  });

  it('kein Aufruf versucht es mit aria-labelledby ueber htmlAttributes (landet am Host, der Dialog bleibt namenlos)', () => {
    const treffer = alleDateien(src).filter((pfad) => /htmlAttributes\s*:\s*\{[^}]*aria-labelledby/.test(readFileSync(pfad, 'utf8')));
    expect(treffer.map((p) => relative(src, p))).toEqual([]);
  });
});
