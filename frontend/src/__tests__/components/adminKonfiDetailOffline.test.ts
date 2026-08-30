import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Gefunden bei der Offline-Pruefung am 30.08.2026: Die Leitungs-Detailansicht
// einer Person lud ausschliesslich ueber GET /admin/konfis/:id. Ohne Verbindung
// schlug der Abruf fehl und die Seite zeigte nur "Fehler beim Laden der
// Konfi-Daten" — obwohl die Person in der Liste davor sichtbar war, denn
// AdminKonfisPage haelt sie unter admin:konfis:<org> im Cache.
//
// DRITTE Ansicht mit demselben Muster: Konfi-Terminansicht behoben am
// 25.08.2026, Leitungs-Terminansicht am 29.08.2026 (87e04fc8), diese hier
// blieb aussen vor. Das wiederkehrende "Drei Ansichten"-Muster.

const lies = (pfad: string) =>
  readFileSync(resolve(process.cwd(), pfad), 'utf8');

const detail = lies('src/components/admin/views/KonfiDetailView.tsx');
const liste = lies('src/components/admin/pages/AdminKonfisPage.tsx');

describe('Leitungs-Personenansicht ohne Verbindung', () => {
  it('fragt offline gar nicht erst ab', () => {
    expect(detail).toContain('if (!isOnline)');
  });

  it('zeigt stattdessen den Grundstand aus dem Listen-Cache', () => {
    expect(detail).toContain('offlineCache.get<Konfi[]>');
    expect(detail).toContain("'admin:konfis:'");
  });

  it('benutzt denselben Cache-Schluessel wie die Liste', () => {
    // Weichen die Schluessel ab, findet das Detail nichts — genau der Fehler,
    // der in der Konfi-Terminansicht am 25.08. behoben wurde.
    const schluessel = "'admin:konfis:' + user?.organization_id";
    expect(liste).toContain(schluessel);
    expect(detail).toContain(schluessel);
  });

  it('laedt nach, sobald die Verbindung zurueck ist', () => {
    expect(detail).toContain('[konfiId, isOnline]');
  });

  it('meldet ehrlich, wenn die Person nie geladen wurde', () => {
    expect(detail).toContain('brauchst du eine Verbindung');
  });
});

describe('Die beiden frueher reparierten Ansichten bleiben repariert', () => {
  it('Leitungs-Terminansicht zieht weiter aus admin:events', () => {
    const termine = lies('src/components/admin/views/EventDetailView.tsx');
    expect(termine).toContain("'admin:events:' + user?.organization_id");
  });

  it('Konfi-Terminansicht teilt sich den Schluessel mit ihrer Liste', () => {
    const konfi = lies('src/components/konfi/views/EventDetailView.tsx');
    expect(konfi).toContain("'konfi:events:' + user?.id");
  });
});
