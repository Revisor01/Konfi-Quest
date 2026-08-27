import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Befund aus dem Rollen-Bericht (26.08.2026): Ein Admin ohne
// Jahrgangs-Zuweisung sah eine leere Konfi-Liste mit dem Text "Noch keine
// Konfis angelegt" -- obwohl es Konfis gibt und nur die Zuweisung fehlt. Wer
// frisch angelegt wurde, hielt die App fuer kaputt.
//
// Das VERHALTEN bleibt (Simons Entscheidung 26.08.: leere Liste ist richtig),
// nur der Grund wird sichtbar.
//
// Der Server meldet ihn per Header statt im Rumpf, damit die Antwort ein
// Array bleibt und kein Aufrufer bricht -- dasselbe Muster wie bei den
// Abzeichen-Zaehlern (teamer.js:516).

const lies = (pfad: string) =>
  readFileSync(resolve(process.cwd(), pfad), 'utf8');

const seite = lies('src/components/admin/pages/AdminKonfisPage.tsx');
const liste = lies('src/components/admin/KonfisView.tsx');
const backend = lies('../backend/routes/konfi-management.js');

describe('Admin ohne Jahrgangs-Zuweisung sieht den Grund', () => {
  it('der Server meldet den Fall per Header', () => {
    expect(backend).toContain("res.set('X-Kein-Jahrgang-Zugewiesen', 'true');");
  });

  it('die Antwort bleibt ein leeres Array', () => {
    // Wichtig: Der Antworttyp darf sich NICHT aendern, sonst braechen
    // Aufrufer, die ein Array erwarten.
    const zweig = backend.slice(
      backend.indexOf("res.set('X-Kein-Jahrgang-Zugewiesen'"),
      backend.indexOf("res.set('X-Kein-Jahrgang-Zugewiesen'") + 200
    );
    expect(zweig).toContain('return res.json([]);');
  });

  it('die Seite liest den Header aus', () => {
    expect(seite).toContain("res.headers?.['x-kein-jahrgang-zugewiesen'] === 'true'");
  });

  it('die Liste sagt dann etwas anderes als "keine angelegt"', () => {
    expect(liste).toContain('Kein Jahrgang zugewiesen');
    expect(liste).toContain('Dir ist noch kein Jahrgang zugewiesen');
  });

  it('die Suche behaelt ihren eigenen Text', () => {
    // Gegenprobe: Wer sucht und nichts findet, bekommt weiterhin den
    // Such-Hinweis -- nicht den Jahrgangs-Hinweis.
    expect(liste).toContain("searchTerm\n            ? 'Versuche andere Suchbegriffe'");
    expect(liste).toContain('ohneJahrgang && !searchTerm');
  });

  it('der urspruengliche Text bleibt fuer den echten Leerfall', () => {
    // Gegenprobe: Hat ein Admin MIT Zuweisung wirklich keine Konfis, ist
    // "Noch keine Konfis angelegt" die richtige Aussage.
    expect(liste).toContain("'Noch keine Konfis angelegt'");
  });
});
