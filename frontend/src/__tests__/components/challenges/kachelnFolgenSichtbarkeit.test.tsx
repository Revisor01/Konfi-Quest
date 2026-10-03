import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import ChallengeLeitungView from '../../../components/admin/views/ChallengeLeitungView';

// Die Kachelleiste (headerStats) las challenge?.visibility, hatte die
// Sichtbarkeit aber nicht in den useMemo-Abhaengigkeiten. Der Randfall ist
// erreichbar: In der offenen Challenge laesst sich ueber den Bearbeiten-Knopf
// die Sichtbarkeit auf "nur Leitung" stellen; die Seite drumherum
// (shared/ChallengeLeitungPage, bis 2.3 die Liste unter dem Dialog) reicht
// die frisch geladene Challenge an die Ansicht weiter. Aendert sich dabei
// weder counts noch der Filter, blieb die "Abgelehnt"-Kachel stehen, obwohl
// es bei "nur Leitung" keine Gruppen-Galerie (und damit kein Abgelehnt) gibt.

// WICHTIG: stabile Funktions-Identitaeten wie im echten AppContext
// (setError dort per useCallback([])). Ein je Render neues vi.fn() wuerde
// loadSubmissions neu erzeugen, den Lade-Effekt erneut feuern und ueber die
// neue counts-Identitaet das eigentlich veraltete useMemo doch aktualisieren —
// der Test liefe dann am Fehler vorbei.
const stableSetError = vi.fn();
const stableSetSuccess = vi.fn();
const stableUser = { id: 1, type: 'admin' };
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({
    user: stableUser,
    setError: stableSetError,
    setSuccess: stableSetSuccess
  })
}));

vi.mock('../../../services/api', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: [] })) }
}));

const inEinerWoche = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
const vorEinerWoche = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

const challenge = (visibility: string) => ({
  id: 9,
  title: 'Foto-Challenge',
  description: 'Mach ein Foto',
  visibility,
  moderated: false,
  is_draft: false,
  allow_multiple: false,
  starts_at: vorEinerWoche,
  ends_at: inEinerWoche
});

describe('ChallengeLeitungView: Kacheln folgen der Sichtbarkeit', () => {
  it('nach Umstellen auf "nur Leitung" verschwindet die Abgelehnt-Kachel', async () => {
    const { container, rerender } = render(
      <ChallengeLeitungView challenge={challenge('public') as never} onBack={vi.fn()} />
    );

    await waitFor(() => {
      expect(container.textContent).toContain('Abgelehnt');
    });

    // Sichtbarkeit aendert sich im offenen Modal (Bearbeiten-Formular +
    // Rueckspiegelung durch die Page) — counts und Filter bleiben gleich.
    rerender(
      <ChallengeLeitungView challenge={challenge('private') as never} onBack={vi.fn()} />
    );

    await waitFor(() => {
      expect(container.textContent).not.toContain('Abgelehnt');
    });
  });
});
