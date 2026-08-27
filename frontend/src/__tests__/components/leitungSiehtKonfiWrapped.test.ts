import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Befund N5 (27.08.2026): Halb genutzter Endpunkt. GET /wrapped/history/:userId
// gestattet admin und org_admin seit jeher den Zugriff auf die Snapshots der
// eigenen Organisation (wrapped.js:660-673) -- im Leitungs-Baum rief ihn aber
// niemand auf. Teamer:innen sehen ueber TeamerKonfiStatsPage nur ihr EIGENES
// eingefrorenes Konfi-Wrapped, was korrekt ist; der Leitung fehlte die
// Ansicht ganz.
//
// Kein zusaetzliches Freigabe-Gate noetig: Snapshot-Erzeugung und
// wrapped_released_at laufen in derselben Transaktion (wrapped.js:513-537).
// Ein Konfi-Snapshot existiert also nie vor der Freigabe -- die Leitung sieht
// nichts, was die Konfi nicht selbst schon sehen kann. Diese Kopplung sichert
// der Backend-Test unten ab: faellt sie, wird aus N5 eine Datenschutzluecke.

const lies = (pfad: string) =>
  readFileSync(resolve(process.cwd(), pfad), 'utf8');

const konfiDetail = lies('src/components/admin/views/KonfiDetailView.tsx');

describe('Leitung kann den Jahresrueckblick einer Konfi ansehen (N5)', () => {
  it('holt die Snapshots der angezeigten Konfi, nicht die eigenen', () => {
    // Der entscheidende Unterschied zur Teamer-Seite, die dort user?.id
    // verwendet: hier muss die konfiId der geoeffneten Detailseite stehen.
    expect(konfiDetail).toContain('api.get(`/wrapped/history/${konfiId}`)');
  });

  it('waehlt den Konfi-Snapshot aus der Liste', () => {
    expect(konfiDetail).toContain("e.wrapped_type === 'konfi'");
  });

  it('oeffnet das WrappedModal mit den geladenen Daten', () => {
    // initialData ist der Schalter, der das Modal daran hindert,
    // /wrapped/me zu laden -- sonst saehe die Leitung ihren eigenen
    // (leeren) Rueckblick statt dem der Konfi.
    expect(konfiDetail).toContain('initialData: wrappedModalData?.data');
    expect(konfiDetail).toContain('initialYear: wrappedModalData?.year');
    expect(konfiDetail).toContain("wrappedType: 'konfi' as const");
  });

  it('zeigt den Namen der Konfi im Modal, nicht den der Leitung', () => {
    expect(konfiDetail).toContain('displayName: currentKonfi?.display_name || currentKonfi?.name');
  });

  it('blendet die Karte ohne vorhandenen Rueckblick aus', () => {
    // Gegenprobe: Ohne Snapshot (Jahrgang noch nicht freigegeben, oder
    // offline) darf keine leere Karte stehenbleiben.
    expect(konfiDetail).toContain('{!isTeamer && konfiWrapped && (');
  });

  it('laedt bei Teamer:innen gar nicht erst', () => {
    // Die Detailseite dient beiden Rollen. Teamer-Wrapped hat eine eigene
    // Stelle; hier waere der Abruf nur ein 404 pro Seitenaufruf.
    const effekt = konfiDetail.slice(
      konfiDetail.indexOf('const [konfiWrapped'),
      konfiDetail.indexOf('const [wrappedModalData')
    );
    expect(effekt).toContain('if (isTeamer)');
    expect(effekt).toContain('setKonfiWrapped(null)');
  });

  it('bricht den Abruf beim Wechsel der Konfi ab', () => {
    // Ohne das Abbruch-Flag koennte die Antwort zu Konfi A den Rueckblick
    // von Konfi B ueberschreiben, wenn man schnell weiterblaettert.
    const effekt = konfiDetail.slice(
      konfiDetail.indexOf('const [konfiWrapped'),
      konfiDetail.indexOf('const [wrappedModalData')
    );
    expect(effekt).toContain('abgebrochen');
    expect(effekt).toContain('return () => { abgebrochen = true; };');
  });
});
