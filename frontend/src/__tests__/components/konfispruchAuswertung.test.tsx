/**
 * Reiter „Sprüche" der Betreiber-Kennzahlen (docs/messung/umami.md, S1;
 * Simon, 09.10.2026: „volle Auswertung, auch wenn sie einzeln sind,
 * insbesondere die, die selbst eingetragen werden").
 *
 * Gerendert: jeder Spruch mit Anzahl -- auch eine Einzelnennung --, eigene
 * Sprüche im Wortlaut mit Stelle, der Bestand ohne Monat; App- und
 * Web-Fassung binden dieselbe Komponente ein.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const mockGet = vi.fn();
vi.mock('../../services/api', () => ({ default: { get: (...a: unknown[]) => mockGet(...a) } }));

import KonfispruchAuswertung from '../../components/admin/KonfispruchAuswertung';

const lies = (p: string) => readFileSync(resolve(__dirname, '../../..', p), 'utf8');

beforeEach(() => { cleanup(); mockGet.mockReset(); });

describe('KonfispruchAuswertung', () => {
  it('zeigt Einzelnennungen, eigene Sprüche im Wortlaut und den Bestand', async () => {
    mockGet.mockResolvedValue({
      data: {
        gesamt: { wahlen: 4, vorschlag: 3, eigen: 1, aus_bestand: 1 },
        uebersetzungen: [{ translation: 'luther2017', anzahl: 2 }, { translation: 'bigs', anzahl: 1 }],
        sprueche: [{ stelle: 'Josua 1,9', anzahl: 2 }, { stelle: 'Psalm 23,1', anzahl: 1 }],
        eigene: [{ freitext: 'Gott ist mein Licht', freitext_referenz: 'Ps 27,1', anzahl: 1 }],
        monate: [{ monat: null, anzahl: 1 }, { monat: '2026-10', anzahl: 3 }],
      },
    });
    render(<KonfispruchAuswertung />);
    await waitFor(() => expect(screen.getByText('Psalm 23,1')).toBeTruthy());
    expect(mockGet).toHaveBeenCalledWith('/metrics/konfisprueche');
    const zeile = (text: string) => screen.getByText(text).closest('li')!.textContent;
    expect(zeile('Psalm 23,1')).toBe('Psalm 23,11');
    expect(zeile('Josua 1,9')).toBe('Josua 1,92');
    expect(zeile('Bibel in gerechter Sprache')).toBe('Bibel in gerechter Sprache1');
    expect(screen.getByText('Ps 27,1').closest('li')!.textContent).toBe('Ps 27,1 — Gott ist mein Licht1');
    expect(screen.getByText('vor Oktober 2026 (Bestand, Monat unbekannt)')).toBeTruthy();
    expect(screen.getByText('Oktober 2026')).toBeTruthy();
  });

  it('Fehler: eine Zeile statt einer leeren Seite', async () => {
    mockGet.mockRejectedValue({ response: { status: 403 } });
    render(<KonfispruchAuswertung />);
    await waitFor(() => expect(screen.getByText('Die Auswertung der Sprüche konnte nicht geladen werden.')).toBeTruthy());
  });

  it('App- und Web-Fassung zeigen den Reiter', () => {
    expect(lies('src/components/admin/pages/AdminMetricsPage.tsx')).toContain("{tab === 'sprueche' && <KonfispruchAuswertung />}");
    expect(lies('src/components/admin/web/leitung/WebBetrieb.tsx')).toContain("{p.tab === 'sprueche' && <KonfispruchAuswertung />}");
  });
});
