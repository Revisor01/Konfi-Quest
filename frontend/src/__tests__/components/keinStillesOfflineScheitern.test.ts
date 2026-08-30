import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

// Stilles Scheitern (Audit 25.08.2026): `if (!isOnline) return;` ohne jede
// Rückmeldung stand 30+ Mal in den Komponenten — der Tipp auf "Löschen",
// "Absagen" usw. verpuffte offline stumm. Dieser Test verhindert, dass das
// Muster zurückkehrt: Wer offline blockieren will, nutzt offlineBlockiert()
// (Meldung) oder legt die Aktion in die writeQueue.

const componentsDir = join(__dirname, '..', '..', 'components');

// Die Ausnahmeliste ist am 30.08.2026 LEER geworden und bleibt es.
//
// Sie trug seit dem 25.08.2026 zwei Dateien mit der Begruendung "werden
// parallel separat repariert" — das ist nie passiert, und solange sie drauf
// standen, waren sie gegen NEUE Verstoesse ungeschuetzt. In
// admin/views/EventDetailView.tsx hatten sich sechs stille Rueckkehrer
// gehalten (Anwesenheit setzen, Teilnehmer entfernen, Chat anlegen), die
// offline kommentarlos verpufften.
//
// Wer hier wieder etwas eintragen will: Es gibt keinen Grund. Wer offline
// blockieren muss, nimmt offlineBlockiert() (Meldung) oder die writeQueue.
// Ein Lade-Effekt, der bewusst den letzten Stand stehen laesst, ist kein
// Verstoss — der schreibt sich `const offline = !isOnline; if (offline)
// return;` und sagt im Kommentar, warum.
const erlaubt = new Set<string>([]);

const alleDateien = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return alleDateien(p);
    return /\.(tsx|ts)$/.test(name) ? [p] : [];
  });

describe('Kein stilles Offline-Scheitern in Komponenten', () => {
  it('keine Komponente enthält mehr `if (!isOnline) return` ohne Meldung', () => {
    const verstoesse: string[] = [];

    for (const datei of alleDateien(componentsDir)) {
      const rel = relative(componentsDir, datei);
      if (erlaubt.has(rel)) continue;

      const inhalt = readFileSync(datei, 'utf8');
      // Trifft `if (!isOnline) return;` und `if (!isOnline) return Promise.resolve();`
      if (/if\s*\(\s*!isOnline\s*\)\s*return\b/.test(inhalt)) {
        verstoesse.push(rel);
      }
    }

    expect(verstoesse).toEqual([]);
  });

  // Befund M5 (27.08.2026): Dieselbe Sorte Fehler, nur mit der anderen
  // Schreibweise — das Teamer-Profil hatte `if (!networkMonitor.isOnline)
  // return;` beim Wechsel der Bibeluebersetzung. Die Auswahl wurde vorher
  // optimistisch gesetzt, sah also uebernommen aus und war beim naechsten
  // Start wieder weg. Der Test oben konnte das nicht sehen, weil er nur auf
  // `!isOnline` prueft. Jetzt beide Schreibweisen.
  it('auch `if (!networkMonitor.isOnline) return` kommt nicht mehr vor', () => {
    const verstoesse: string[] = [];

    for (const datei of alleDateien(componentsDir)) {
      const rel = relative(componentsDir, datei);
      if (erlaubt.has(rel)) continue;

      const inhalt = readFileSync(datei, 'utf8');
      if (/if\s*\(\s*!networkMonitor\.isOnline\s*\)\s*return\b/.test(inhalt)) {
        verstoesse.push(rel);
      }
    }

    expect(verstoesse).toEqual([]);
  });

  // Gegenprobe zu M5: Die Reparatur ist nicht "Meldung statt Warteschlange",
  // sondern beide Profile reihen die Auswahl gleich ein. Faellt das zurueck
  // auf eine blosse Fehlermeldung, ginge eine offline getroffene Wahl wieder
  // verloren — der Test oben bliebe davon gruen.
  it('beide Profile legen die Bibeluebersetzung offline in die Warteschlange', () => {
    const profile = [
      'konfi/views/ProfileView.tsx',
      'teamer/pages/TeamerProfilePage.tsx',
    ];

    for (const rel of profile) {
      const inhalt = readFileSync(join(componentsDir, rel), 'utf8');
      const zweig = inhalt.slice(
        inhalt.indexOf('const handleTranslationChange'),
        inhalt.indexOf('const [presentBibleModal')
      );
      expect(zweig, rel).toContain('writeQueue.enqueue');
      expect(zweig, rel).toContain('bible-translation');
      expect(zweig, rel).toContain("type: 'fire-and-forget'");
    }
  });
});
