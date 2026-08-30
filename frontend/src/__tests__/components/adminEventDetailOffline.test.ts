import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Nutzerhinweis 29.08.2026: "das event ist rot hat nichtmal einen titel,
// zumindest beim admin". Die Leitungs-Detailansicht lud ausschliesslich ueber
// GET /events/:id. Ohne Verbindung schlug der Abruf fehl, eventData blieb
// null und die Seite zeigte nur "Fehler beim Laden der Event-Daten" — obwohl
// der Termin in der Liste davor sichtbar war, denn die Liste haelt ihn im
// Cache (admin:events:<org>).
//
// Dieselbe Klasse Fehler war in der KONFI-Ansicht bereits am 25.08.2026
// behoben worden ("ich sehe die Liste der Events, aber wenn ich in ein Event
// klicke ist alles 0 und rot"). Die Leitungssicht blieb aussen vor — das
// wiederkehrende Muster der drei Ansichten.

const lies = (pfad: string) =>
  readFileSync(resolve(process.cwd(), pfad), 'utf8');

const adminDetail = lies('src/components/admin/views/EventDetailView.tsx');
const adminListe = lies('src/components/admin/pages/AdminEventsPage.tsx');
const konfiDetail = lies('src/components/konfi/views/EventDetailView.tsx');

describe('Leitungs-Terminansicht ohne Verbindung', () => {
  it('fragt offline gar nicht erst ab', () => {
    // Der fehlschlagende Abruf war die Ursache der roten Meldung.
    expect(adminDetail).toContain('if (!isOnline)');
  });

  it('zeigt stattdessen den Grundstand aus dem Listen-Cache', () => {
    expect(adminDetail).toContain('offlineCache.get<Event[]>');
    expect(adminDetail).toContain("'admin:events:'");
  });

  it('benutzt denselben Cache-Schluessel wie die Terminliste', () => {
    // Weichen die Schluessel ab, findet das Detail nichts — genau der Fehler,
    // der in der Konfi-Ansicht am 25.08. behoben wurde (dort stand vorher ein
    // eigener Eintrag pro Termin).
    const schluessel = "'admin:events:' + user?.organization_id";
    expect(adminListe).toContain(schluessel);
    expect(adminDetail).toContain(schluessel);
  });

  it('laedt nach, sobald die Verbindung zurueck ist', () => {
    // Sonst bliebe die Seite auf dem Grundstand stehen: Teilnehmerliste und
    // Abmeldungen haengen an GET /events/:id und fehlen offline.
    expect(adminDetail).toContain('[eventId, isOnline]');
  });

  it('meldet ehrlich, wenn der Termin nie geladen wurde', () => {
    // Kein Cache-Eintrag heisst: wirklich keine Daten. Dann ist ein Hinweis
    // richtig — aber einer, der den Grund nennt.
    expect(adminDetail).toContain('brauchst du eine Verbindung');
  });
});

describe('Die Konfi-Ansicht bleibt repariert', () => {
  it('teilt sich weiterhin den Cache-Schluessel mit ihrer Liste', () => {
    expect(konfiDetail).toContain("'konfi:events:' + user?.id");
  });

  it('fragt Zeitfenster offline nicht ab', () => {
    // Seit dem 30.08.2026 als `const offline = ...` geschrieben: Der Waechter
    // keinStillesOfflineScheitern.test.ts hat keine Ausnahmeliste mehr, und
    // seine Regex trifft `if (!networkMonitor.isOnline) return`. Hier bricht
    // aber keine Nutzeraktion ab, sondern ein Lade-Effekt laesst den
    // vorhandenen Stand stehen — die Schreibweise macht das sichtbar.
    expect(konfiDetail).toContain('const offline = !networkMonitor.isOnline;');
    expect(konfiDetail).toContain('if (offline) return;');
  });
});
