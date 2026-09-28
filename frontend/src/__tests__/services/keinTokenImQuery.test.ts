import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve, relative } from 'path';

// ---------------------------------------------------------------------------
// Das Anmelde-Token gehört in den Authorization-Header, nie in eine Adresse
// (Audit 26.09.2026, backend-fachlogik-chat-challenges-rueckblick BF-09).
//
// Ein Query-String steht im Zugriffslog des Reverse-Proxys (RequestPath) und
// in Referrern. GET /chat/files/:filename nahm das Token bis zum 28.09.2026
// auch aus ?token=; die Challenge-Dateiroute lehnt das seit 04.08.2026 ab.
// Seit dem 28.09.2026 nimmt auch die Chat-Route nur noch den Header. Keine
// ausgelieferte App hat ?token= je gesendet (geprüft an den Tags 1.3.0 bis
// 2.3.0): Dateien und Videos laufen per axios mit Header über den Medien-Cache.
//
// Dieser Wächter hält fest, dass die App das Token auch künftig nirgends in
// eine Adresse schreibt — sonst käme der Fallback mit der nächsten
// Video-Lösung zurück, und mit ihm die Tokens im Log. Gelesen wird der
// Quelltext (ohne Kommentare): Eine Adresse, die irgendwo gebaut wird, fällt
// hier auf, egal über welchen Weg sie später geladen wird.
// ---------------------------------------------------------------------------

const SRC = resolve(process.cwd(), 'src');

function quelldateien(verzeichnis: string): string[] {
  return readdirSync(verzeichnis).flatMap((name) => {
    const pfad = join(verzeichnis, name);
    if (statSync(pfad).isDirectory()) return name === '__tests__' ? [] : quelldateien(pfad);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [pfad] : [];
  });
}

/** Block- und Zeilenkommentare entfernen (ohne "https://" zu treffen). */
const ohneKommentare = (quelle: string) =>
  quelle.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');

/** Stellen, an denen ein Token in eine Adresse wandert. */
function tokenInAdresse(quelle: string): string[] {
  const rein = ohneKommentare(quelle);
  const muster = [
    /[?&]token=/g,                                   // `...?token=${t}`, '&token=' + t
    /(?:searchParams|params)\.(?:set|append)\(\s*['"`]token['"`]/g,
    /params\s*:\s*\{[^}]*\btoken\b/g,                 // axios({ params: { token } })
  ];
  return muster.flatMap((m) => rein.match(m) ?? []);
}

describe('Kein Anmelde-Token im Query-String (BF-09)', () => {
  const dateien = quelldateien(SRC);

  it('findet die Quelldateien der App', () => {
    expect(dateien.length).toBeGreaterThan(100);
    expect(dateien.some((d) => d.endsWith('services/mediaCache.ts'))).toBe(true);
  });

  it('keine Quelldatei schreibt ein Token in eine Adresse', () => {
    const funde = dateien.flatMap((d) =>
      tokenInAdresse(readFileSync(d, 'utf8')).map((f) => `${relative(SRC, d)}: ${f}`)
    );
    expect(funde).toEqual([]);
  });

  it('Gegenprobe: das Muster erkennt die frühere Video-Adresse und die üblichen Umwege', () => {
    // So stand es am 05.08.2025 für einen Tag im Chat (Video-Tag).
    expect(tokenInAdresse('<source src={`${api.defaults.baseURL}/chat/files/${p}?token=${t}`} />')).toHaveLength(1);
    expect(tokenInAdresse("const url = base + '&token=' + t;")).toHaveLength(1);
    expect(tokenInAdresse("u.searchParams.set('token', t);")).toHaveLength(1);
    expect(tokenInAdresse('api.get(url, { params: { token } });')).toHaveLength(1);
    // Kommentare und das Lesen des Passwort-Links zählen nicht.
    expect(tokenInAdresse('// kein ?token= nötig\nconst t = params.get(\'token\');')).toEqual([]);
  });
});
