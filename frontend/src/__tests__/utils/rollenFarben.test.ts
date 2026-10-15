import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';
import { ROLLEN_FARBEN, rollenDarstellung } from '../../utils/rollenNamen';

/**
 * Rollenfarben (Simon, TestFlight 233, 29.09.2026): "Es braucht noch eine
 * dritte Farbe. Es gibt die Org-Admins, die Admins und die Teamer. Die Admins
 * brauchen eine andere Farbe, damit es leichter erkennbar ist."
 *
 * Bis dahin trugen org_admin UND admin --app-color-users (Indigo), und vier
 * Ansichten rechneten die Farbe je mit eigener switch-Anweisung aus. Jetzt:
 * eine Zuordnung in utils/rollenNamen, ein eigenes Token fuer die Leitung.
 *
 * Welche Rolle welche Farbe traegt, ist Layout und wird nicht festgeschrieben
 * (Simon, 15.10.2026). Geprueft werden die eine Stelle der Zuordnung, die
 * Lesbarkeit (Kontrast, Dunkelmodus) und dass jedes Token existiert.
 */

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');
const css = lies('src/theme/variables.css').replace(/\/\*[\s\S]*?\*\//g, '');
const dunkelBlock = css.match(/@media \(prefers-color-scheme: dark\) \{([\s\S]*?)\n\}\n/)![1];
const hell = css.replace(/@media \(prefers-color-scheme: dark\) \{[\s\S]*?\n\}\n/g, '');
const token = (quelle: string, name: string): string => {
  const m = quelle.match(new RegExp(`${name}:\\s*([^;]+);`));
  if (!m) throw new Error(`${name} fehlt`);
  return m[1].trim();
};

const hexZuRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
};
const linear = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const helligkeit = (hex: string) => {
  const [r, g, b] = hexZuRgb(hex).map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const kontrast = (a: string, b: string) => {
  const [h, d] = [helligkeit(a), helligkeit(b)].sort((x, y) => y - x);
  return (h + 0.05) / (d + 0.05);
};

describe('Rolle -> Farbe: jedes Token existiert', () => {
  it('jedes Token, auf das die Zuordnung zeigt, existiert hell und dunkel (Flaeche, -rgb, Text)', () => {
    for (const farbe of new Set(Object.values(ROLLEN_FARBEN))) {
      for (const name of [`--app-color-${farbe}`, `--app-color-${farbe}-rgb`, `--app-text-${farbe}`]) {
        expect(() => token(hell, name), `${name} hell`).not.toThrow();
        expect(() => token(dunkelBlock, name), `${name} dunkel`).not.toThrow();
      }
    }
  });
});

describe('Die Farbe der Leitung: lesbar', () => {
  const leitung = token(hell, '--app-color-leitung');
  const orgLeitung = token(hell, '--app-color-users');
  const teamer = token(hell, '--app-color-teamer');

  it('weisse Schrift und Symbole darauf: mindestens 4,5:1 (AA)', () => {
    expect(kontrast('#ffffff', leitung)).toBeGreaterThanOrEqual(4.5);
    // Zum Vergleich die vorhandenen Rollenfarben: Teamer 6,04, Org-Leitung
    // 3,66 (reicht fuer Symbole, 3:1) -- die neue Farbe liegt nicht darunter.
    expect(kontrast('#ffffff', teamer)).toBeGreaterThanOrEqual(4.5);
    expect(kontrast('#ffffff', orgLeitung)).toBeGreaterThanOrEqual(3);
  });

  it('als Schrift: mindestens 4,5:1, im Dunkeln auf Karte und beiden Seitengruenden, hell auf der Karte', () => {
    const text = token(dunkelBlock, '--app-text-leitung');
    for (const grund of [token(dunkelBlock, '--app-surface-card'), '#000000', '#121212']) {
      expect(kontrast(text, grund), grund).toBeGreaterThanOrEqual(4.5);
    }
    expect(kontrast(token(hell, '--app-text-leitung'), token(hell, '--app-surface-card'))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('Personenlisten (rollenDarstellung): die Schrift bleibt im Dunkeln lesbar', () => {
  // 02.10.2026, Paket 2.4.0, Punkt 6: Strich, Kreis, Eck-Marke und Schrift
  // kommen als Klassen aus utils/rollenNamen. Die Schrift liest das
  // Text-Token ihrer Rolle (--app-text-*), das im Dunkeln aufgehellt ist --
  // nicht die Flaechenfarbe, die auf dunklem Grund zu wenig Kontrast haette.
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regel = (selektor: string): string => {
    const m = hell.match(new RegExp(`(^|[\\s,}])${esc(selektor)}\\s*(,[^{]*)?\\{([^}]*)\\}`, 'm'));
    if (!m) throw new Error(`${selektor} fehlt im Stylesheet`);
    return m[3];
  };

  it.each(['org_admin', 'admin', 'teamer', 'konfi', 'unbekannt'])('%s: die Schrift liest das Text-Token ihrer Rolle', (rolle) => {
    const d = rollenDarstellung(rolle);
    const schrift = d.farbe === 'neutral' ? 'var\\(--app-text-system\\)' : `var\\(--app-text-${d.farbe}\\)`;
    expect(regel(`.${d.schrift}`)).toMatch(new RegExp(`color:\\s*${schrift}`));
  });
});

describe('Keine Ansicht rechnet die Rollenfarbe mehr selbst aus', () => {
  const dateien = (verzeichnis: string): string[] => {
    const voll = resolve(process.cwd(), verzeichnis);
    return readdirSync(voll).flatMap((e) => {
      const p = join(voll, e);
      if (e === '__tests__' || e === 'node_modules') return [];
      if (statSync(p).isDirectory()) return dateien(join(verzeichnis, e));
      return e.endsWith('.tsx') ? [join(verzeichnis, e)] : [];
    });
  };

  it('keine eigene Zuordnung admin/org_admin -> Token in einer Komponente', () => {
    const treffer = dateien('src/components').filter((d) => {
      const code = lies(d);
      return /case 'admin':\s*return '(users|teamer|leitung)'/.test(code)
        || /'org_admin'[^\n]*\?\s*'users'/.test(code)
        || /(^|[^\w.])name === 'teamer' \? 'teamer'/m.test(code);
    });
    expect(treffer).toEqual([]);
  });

  // Die Rollenauswahl (Benutzer anlegen, Einladen) faerbt Rollen, keine
  // Personen: weiter rollenFarbeVar. Jede Personenliste nimmt seit dem
  // 02.10.2026 rollenDarstellung (Strich, Kreis, Eck-Marke, Schrift).
  it.each([
    'src/components/admin/modals/UserManagementModal.tsx',
    'src/components/admin/modals/EinladungModal.tsx',
  ])('%s holt die Farbe aus utils/rollenNamen', (datei) => {
    expect(lies(datei)).toMatch(/import \{[^}]*rollenFarbeVar[^}]*\} from '[./]+\/utils\/rollenNamen'/);
  });

  it.each([
    'src/components/admin/UsersView.tsx',
    'src/components/admin/OffeneEinladungen.tsx',
    'src/components/chat/modals/MembersModal.tsx',
    'src/components/chat/modals/SimpleCreateChatModal.tsx',
    'src/components/admin/modals/OrganizationManagementModal.tsx',
    'src/components/admin/modals/ParticipantManagementModal.tsx',
    'src/components/admin/pages/AdminJahrgaengeePage.tsx',
  ])('%s holt die Personendarstellung aus utils/rollenNamen', (datei) => {
    expect(lies(datei)).toMatch(/import \{[^}]*rollenDarstellung[^}]*\} from '[./]+\/utils\/rollenNamen'/);
  });

  it('keine Personenliste traegt mehr die allgemeine Team-Farbe fuer Strich oder Kreis', () => {
    // app-list-item--team / app-icon-circle--team bleiben fuer die Raumtypen
    // der Chat-Uebersicht (Team-Chat) bestehen -- dort als Variable
    // (app-list-item--${colorClass}), nicht als fester Klassenname.
    const treffer = dateien('src/components').filter((d) =>
      /app-(list-item|icon-circle|corner-badge)--team\b/.test(lies(d)));
    expect(treffer).toEqual([]);
  });
});
