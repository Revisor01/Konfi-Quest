import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import GlobalToasts from '../../components/common/GlobalToasts';

// IonToast ist eine Overlay-Komponente und rendert in jsdom nur <template>.
// Daher wird hier ein Stub genutzt, um die Verdrahtung (Props/Dismiss) zu testen.
vi.mock('@ionic/react', () => ({
  IonToast: (props: any) => (
    <div
      data-testid="toast"
      data-open={String(props.isOpen)}
      data-color={props.color}
      data-message={props.message}
      onClick={() => props.onDidDismiss?.()}
    />
  )
}));

const mockSetError = vi.fn();
const mockSetSuccess = vi.fn();
let mockState = { error: '', success: '' };

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    ...mockState,
    setError: mockSetError,
    setSuccess: mockSetSuccess
  })
}));

describe('GlobalToasts', () => {
  beforeEach(() => {
    mockSetError.mockClear();
    mockSetSuccess.mockClear();
  });

  it('beide Toasts sind ohne Meldung geschlossen', () => {
    mockState = { error: '', success: '' };
    const { getAllByTestId } = render(<GlobalToasts />);
    const [errorToast, successToast] = getAllByTestId('toast');
    expect(errorToast.dataset.open).toBe('false');
    expect(successToast.dataset.open).toBe('false');
  });

  it('öffnet den Fehler-Toast mit Meldung und danger-Farbe', () => {
    mockState = { error: 'Kategorie kann nicht gelöscht werden', success: '' };
    const { getAllByTestId } = render(<GlobalToasts />);
    const [errorToast, successToast] = getAllByTestId('toast');
    expect(errorToast.dataset.open).toBe('true');
    expect(errorToast.dataset.message).toBe('Kategorie kann nicht gelöscht werden');
    expect(errorToast.dataset.color).toBe('danger');
    expect(successToast.dataset.open).toBe('false');
  });

  it('öffnet den Erfolgs-Toast mit Meldung und success-Farbe', () => {
    mockState = { error: '', success: 'Kategorie gelöscht' };
    const { getAllByTestId } = render(<GlobalToasts />);
    const [errorToast, successToast] = getAllByTestId('toast');
    expect(successToast.dataset.open).toBe('true');
    expect(successToast.dataset.message).toBe('Kategorie gelöscht');
    expect(successToast.dataset.color).toBe('success');
    expect(errorToast.dataset.open).toBe('false');
  });

  it('leert die Meldung im Context beim Dismiss', () => {
    mockState = { error: 'Fehler X', success: 'Erfolg Y' };
    const { getAllByTestId } = render(<GlobalToasts />);
    const [errorToast, successToast] = getAllByTestId('toast');
    fireEvent.click(errorToast);
    expect(mockSetError).toHaveBeenCalledWith('');
    fireEvent.click(successToast);
    expect(mockSetSuccess).toHaveBeenCalledWith('');
  });
});
