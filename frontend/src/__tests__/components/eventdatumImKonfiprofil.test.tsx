// Simon, 01.10.2026: „Bei Events, die im Konfiprofil auftauchen, wird das
// Verbuchungsdatum angezeigt anstelle des Eventdatums (wäre da 27.9. gewesen).
// Ich fänd das Eventdatum logischer, damit ich weiß, wo ich nach dem Event
// suchen müsste. Bei den Aktivitäten steht ja auch das Aktivitätsdatum dabei."
//
// Gerendert werden die drei Stellen, an denen Event-Punkte eines Konfis
// gelistet sind:
//   - Events-Abschnitt der Leitungs-Detailansicht (EventPointsSection),
//   - Konfi-Historie einer beförderten Teamer:in (KonfiHistorySection),
//   - Punkte-Verlauf der Konfi selbst und der Teamer-Konfi-Statistik
//     (PointsHistoryModal, beide Wege dasselbe Modal).
// Regel überall: Eventdatum zeigen, ohne Eventdatum (alte Antwort) das
// Verbuchungsdatum; die Liste folgt dem angezeigten Datum, neueste zuerst.
//
// Ausgangslage wie bei Simon: Termin am 27.09.2026, verbucht am 30.09.2026.
// Die Zeitpunkte sind so geschrieben, wie der Server sie liefert
// (timestamptz bzw. date als Mitternacht Europe/Berlin in UTC).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, waitFor } from '@testing-library/react';

const apiGet = vi.fn();
vi.mock('../../services/api', () => ({
  default: {
    get: (...a: unknown[]) => apiGet(...a),
    post: vi.fn(async () => ({ data: {} })),
    put: vi.fn(async () => ({ data: {} })),
    delete: vi.fn(async () => ({ data: {} })),
  },
  DATEI_TIMEOUT_MS: 180000,
}));

import { EventPointsSection, KonfiHistorySection } from '../../components/admin/views/KonfiDetailSections';
import PointsHistoryModal from '../../components/konfi/modals/PointsHistoryModal';
import { datumKurz } from '../../utils/dateUtils';
import type { EventPunkteEintrag } from '../../types/user';

const TERMIN = '2026-09-27T08:00:00.000Z';       // 27.09.2026, 10:00 Uhr
const VERBUCHT = '2026-09-29T22:00:00.000Z';     // 30.09.2026 (date)

/** Reihenfolge, in der die Texte im Dokument stehen. */
const reihenfolge = (texte: string[]) => {
  const html = document.body.textContent || '';
  return [...texte].sort((a, b) => html.indexOf(a) - html.indexOf(b));
};

beforeEach(() => apiGet.mockReset());
afterEach(() => cleanup());

describe('Events-Abschnitt der Leitungs-Detailansicht', () => {
  const eintraege: EventPunkteEintrag[] = [
    // Server-Reihenfolge: nach Verbuchung absteigend.
    { id: 1, event_id: 11, points: 2, point_type: 'gottesdienst', event_name: 'Erntedank',
      event_date: TERMIN, awarded_date: VERBUCHT },
    { id: 2, event_id: 12, points: 1, point_type: 'gemeinde', event_name: 'Gemeindefest',
      event_date: '2026-09-28T09:00:00.000Z', awarded_date: '2026-09-28T22:00:00.000Z' },
    // Alte Antwort ohne Eventdatum: Rückfall auf die Verbuchung.
    { id: 3, event_id: 13, points: 1, point_type: 'gemeinde', event_name: 'Altes Treffen',
      awarded_date: '2026-08-14T22:00:00.000Z' },
  ];

  it('zeigt das Eventdatum statt des Verbuchungsdatums', () => {
    render(<EventPointsSection eventPoints={eintraege} currentKonfi={null} />);
    expect(screen.getByText('27.09.')).toBeTruthy();
    expect(screen.queryByText('30.09.')).toBe(null);
    expect(screen.getByText('28.09.')).toBeTruthy();
    expect(screen.queryByText('29.09.')).toBe(null);
  });

  it('fällt ohne Eventdatum auf das Verbuchungsdatum zurück', () => {
    render(<EventPointsSection eventPoints={eintraege} currentKonfi={null} />);
    expect(screen.getByText('15.08.')).toBeTruthy();
  });

  it('ordnet nach dem angezeigten Datum, neueste zuerst', () => {
    render(<EventPointsSection eventPoints={eintraege} currentKonfi={null} />);
    expect(reihenfolge(['Erntedank', 'Gemeindefest', 'Altes Treffen']))
      .toEqual(['Gemeindefest', 'Erntedank', 'Altes Treffen']);
  });
});

describe('Konfi-Historie einer beförderten Teamer:in', () => {
  const konfiHistory = {
    totals: { gottesdienst: 2, gemeinde: 3, total: 5 },
    history: [
      { id: 1, title: 'Erntedank', points: 2, category: 'gottesdienst', source_type: 'event',
        date: VERBUCHT, event_date: TERMIN },
      { id: 2, title: 'Kirchenputz', points: 2, category: 'gemeinde', source_type: 'activity',
        date: '2026-09-27T22:00:00.000Z', event_date: null },
      { id: 3, title: 'Altes Treffen', points: 1, category: 'gemeinde', source_type: 'event',
        date: '2026-08-14T22:00:00.000Z' },
    ],
  };

  it('zeigt das Eventdatum, die Aktivität ihr Datum, ohne Eventdatum die Verbuchung — chronologisch', () => {
    render(<KonfiHistorySection konfiHistory={konfiHistory} formatDate={(d) => datumKurz(d)} />);
    expect(screen.getByText('27.09.2026')).toBeTruthy();
    expect(screen.queryByText('30.09.2026')).toBe(null);
    expect(screen.getByText('28.09.2026')).toBeTruthy();
    expect(screen.getByText('15.08.2026')).toBeTruthy();
    expect(reihenfolge(['Erntedank', 'Kirchenputz', 'Altes Treffen']))
      .toEqual(['Kirchenputz', 'Erntedank', 'Altes Treffen']);
  });
});

describe('Punkte-Verlauf der Konfi (und der Teamer-Konfi-Statistik)', () => {
  it('zeigt das Eventdatum, fällt ohne es auf das Verbuchungsdatum zurück und ordnet danach', async () => {
    apiGet.mockResolvedValue({
      data: {
        totals: { gottesdienst: 2, gemeinde: 3, total: 5 },
        // Server-Reihenfolge: nach `date` (bei Events die Verbuchung).
        history: [
          { id: 1, title: 'Erntedank', points: 2, category: 'gottesdienst', source_type: 'event',
            date: VERBUCHT, event_date: TERMIN, comment: null },
          { id: 2, title: 'Kirchenputz', points: 2, category: 'gemeinde', source_type: 'activity',
            date: '2026-09-27T22:00:00.000Z', event_date: null, comment: null },
          { id: 3, title: 'Altes Treffen', points: 1, category: 'gemeinde', source_type: 'event',
            date: '2026-08-14T22:00:00.000Z', comment: null },
        ],
      },
    });

    render(<PointsHistoryModal onClose={() => undefined} apiEndpoint="/teamer/konfi-history" />);

    await waitFor(() => expect(screen.getByText('Erntedank')).toBeTruthy());
    expect(apiGet).toHaveBeenCalledWith('/teamer/konfi-history');
    expect(screen.getByText('27.09.2026')).toBeTruthy();
    expect(screen.queryByText('30.09.2026')).toBe(null);
    expect(screen.getByText('28.09.2026')).toBeTruthy();
    expect(screen.getByText('15.08.2026')).toBeTruthy();
    expect(reihenfolge(['Erntedank', 'Kirchenputz', 'Altes Treffen']))
      .toEqual(['Kirchenputz', 'Erntedank', 'Altes Treffen']);
  });
});
