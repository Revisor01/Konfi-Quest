import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';
import {
  ROLLEN_FARBEN,
  rollenFarbe,
  rollenFarbeVar,
  rollenTextFarbeVar,
  rollenTonVar,
} from '../../utils/rollenNamen';

/**
 * Rollenfarben (Simon, TestFlight 233, 29.09.2026): "Es braucht noch eine
 * dritte Farbe. Es gibt die Org-Admins, die Admins und die Teamer. Die Admins
 * brauchen eine andere Farbe, damit es leichter erkennbar ist."
 *
 * Bis dahin trugen org_admin UND admin --app-color-users (Indigo), und vier
 * Ansichten rechneten die Farbe je mit eigener switch-Anweisung aus. Jetzt:
 * eine Zuordnung in utils/rollenNamen, ein eigenes Token fuer die Leitung.
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
/** CIE-Lab (D65) und der Abstand CIE76 -- genuegt, um "deutlich anders" zu pruefen. */
const lab = (hex: string): [number, number, number] => {
  const [r, g, b] = hexZuRgb(hex).map(linear);
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
};
const abstand = (a: string, b: string) => {
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
};

describe('Rolle -> Farbe: eindeutig, an einer Stelle', () => {
  it('jede Rolle hat ihre eigene Farbe -- keine zwei Rollen teilen eine', () => {
    expect(ROLLEN_FARBEN).toEqual({ org_admin: 'users', admin: 'leitung', teamer: 'teamer', konfi: 'konfis' });
    const werte = Object.values(ROLLEN_FARBEN);
    expect(new Set(werte).size).toBe(werte.length);
  });

  it('die Leitung ist nicht mehr die Farbe der Org-Leitung', () => {
    expect(rollenFarbe('admin')).toBe('leitung');
    expect(rollenFarbe('org_admin')).toBe('users');
    expect(rollenFarbe('admin')).not.toBe(rollenFarbe('org_admin'));
    expect(rollenFarbe('teamer')).toBe('teamer');
  });

  it('unbekannte Rollen: neutral, oder der angegebene Rueckfall', () => {
    expect(rollenFarbe('super_admin')).toBe('neutral');
    expect(rollenFarbe(undefined)).toBe('neutral');
    expect(rollenFarbe(null, 'teamer')).toBe('teamer');
    expect(rollenFarbe('admin', 'teamer')).toBe('leitung');
  });

  it('die Hilfen liefern Token-Verweise, keine Rohwerte', () => {
    expect(rollenFarbeVar('admin')).toBe('var(--app-color-leitung)');
    expect(rollenFarbeVar('org_admin')).toBe('var(--app-color-users)');
    expect(rollenFarbeVar('teamer')).toBe('var(--app-color-teamer)');
    expect(rollenTonVar('admin')).toBe('rgba(var(--app-color-leitung-rgb), 0.08)');
    expect(rollenTextFarbeVar('admin')).toBe('var(--app-text-leitung)');
    expect(rollenTextFarbeVar('unbekannt')).toBe('var(--app-text-system)');
  });

  it('jedes Token, auf das die Zuordnung zeigt, existiert hell und dunkel (Flaeche, -rgb, Text)', () => {
    for (const farbe of new Set(Object.values(ROLLEN_FARBEN))) {
      for (const name of [`--app-color-${farbe}`, `--app-color-${farbe}-rgb`, `--app-text-${farbe}`]) {
        expect(() => token(hell, name), `${name} hell`).not.toThrow();
        expect(() => token(dunkelBlock, name), `${name} dunkel`).not.toThrow();
      }
    }
  });
});

describe('Die Farbe der Leitung: lesbar und deutlich anders', () => {
  const leitung = token(hell, '--app-color-leitung');
  const orgLeitung = token(hell, '--app-color-users');
  const teamer = token(hell, '--app-color-teamer');
  const konfis = token(hell, '--app-color-konfis');

  it('weisse Schrift und Symbole darauf: mindestens 4,5:1 (AA)', () => {
    expect(kontrast('#ffffff', leitung)).toBeGreaterThanOrEqual(4.5);
    // Zum Vergleich die vorhandenen Rollenfarben: Teamer 6,04, Org-Leitung
    // 3,66 (reicht fuer Symbole, 3:1) -- die neue Farbe liegt nicht darunter.
    expect(kontrast('#ffffff', teamer)).toBeGreaterThanOrEqual(4.5);
    expect(kontrast('#ffffff', orgLeitung)).toBeGreaterThanOrEqual(3);
  });

  it('als Flaeche im Dunkeln unveraendert, wie jede Bereichsfarbe', () => {
    expect(token(dunkelBlock, '--app-color-leitung')).toBe(leitung);
  });

  it('deutlich anders als Org-Leitung, Teamer:in und Konfi (Lab-Abstand ueber 25)', () => {
    for (const [name, andere] of [['Org-Leitung', orgLeitung], ['Teamer:in', teamer], ['Konfi', konfis]] as const) {
      expect(abstand(leitung, andere), name).toBeGreaterThan(25);
    }
  });

  it('nicht zu verwechseln mit Warn- und Fehlerfarbe (hell und dunkel)', () => {
    for (const signal of ['--app-color-warning', '--app-color-danger']) {
      expect(abstand(leitung, token(hell, signal)), `${signal} hell`).toBeGreaterThan(40);
      expect(abstand(leitung, token(dunkelBlock, signal)), `${signal} dunkel`).toBeGreaterThan(40);
    }
  });

  it('als Schrift im Dunkeln: mindestens 4,5:1 auf Karte und beiden Seitengruenden', () => {
    const text = token(dunkelBlock, '--app-text-leitung');
    for (const grund of [token(dunkelBlock, '--app-surface-card'), '#000000', '#121212']) {
      expect(kontrast(text, grund), grund).toBeGreaterThanOrEqual(4.5);
    }
    // Hell ist das Text-Token die Flaechenfarbe selbst.
    expect(token(hell, '--app-text-leitung')).toBe(leitung);
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

  it.each([
    'src/components/admin/UsersView.tsx',
    'src/components/admin/modals/UserManagementModal.tsx',
    'src/components/admin/modals/EinladungModal.tsx',
    'src/components/admin/OffeneEinladungen.tsx',
    'src/components/chat/modals/MembersModal.tsx',
    'src/components/chat/modals/SimpleCreateChatModal.tsx',
  ])('%s holt die Farbe aus utils/rollenNamen', (datei) => {
    expect(lies(datei)).toMatch(/import \{[^}]*rollenFarbeVar[^}]*\} from '[./]+\/utils\/rollenNamen'/);
  });
});
