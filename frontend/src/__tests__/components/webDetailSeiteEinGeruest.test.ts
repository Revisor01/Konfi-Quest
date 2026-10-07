// Jede Detailseite der Web-Fassung gibt in ALLEN Zustaenden (laedt, Fehler,
// nicht zugeordnet, Inhalt) WebDetailSeite zurueck -- nie zwischendurch
// WebSeite. Ein anderer Baustein an der Wurzel laesst React die IonPage neu
// bauen; die neue bleibt nach dem schon gelaufenen Seitenuebergang
// unsichtbar (ion-page-invisible): weisse Seite bis zum zweiten Klick
// (Simon, 07.10.2026; betroffen waren Konfi-Detail und die drei
// Event-Detailseiten). Die Zustaende gehen ueber `zustand`.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const WURZEL = join(__dirname, '../../components');

const dateien = (ordner: string): string[] => readdirSync(ordner).flatMap((n) => {
  const pfad = join(ordner, n);
  if (statSync(pfad).isDirectory()) return dateien(pfad);
  return /\.tsx$/.test(n) ? [pfad] : [];
});

/** Dateien, die beide Bausteine als Wurzel zurueckgeben. */
export const gemischt = (quellen: Record<string, string>): string[] =>
  Object.entries(quellen)
    .filter(([, text]) => /<WebDetailSeite[\s>]/.test(text) && /<WebSeite[\s>]/.test(text))
    .map(([name]) => name);

describe('Detailseiten: ein Geruest fuer alle Zustaende', () => {
  it('der Pruefer erkennt die Mischung (Gegenprobe) und laesst saubere Dateien in Ruhe', () => {
    expect(gemischt({
      'a.tsx': 'if (laedt) return <WebSeite titel="x">…</WebSeite>;\nreturn <WebDetailSeite titel="y" />;',
      'b.tsx': 'if (laedt) return <WebDetailSeite titel="x" zustand={<WebLaden />} />;\nreturn <WebDetailSeite titel="y" />;',
      'c.tsx': 'return <WebSeite titel="Liste">…</WebSeite>;',
    })).toEqual(['a.tsx']);
  });

  it('keine Datei unter components/ gibt WebSeite und WebDetailSeite zurueck', () => {
    const quellen = Object.fromEntries(dateien(WURZEL)
      .filter((p) => !p.endsWith('/web/WebDetailSeite.tsx'))
      .map((p) => [relative(WURZEL, p), readFileSync(p, 'utf8')]));
    expect(gemischt(quellen)).toEqual([]);
  });
});
