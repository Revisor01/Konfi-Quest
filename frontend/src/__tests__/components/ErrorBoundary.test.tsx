import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ErrorBoundary from '../../components/common/ErrorBoundary';

// Mock der beiden Services, die der "Zur Anmeldung"-Button aufruft.
// Wichtig (Incident 13.06.2026): der Button MUSS clearAuth UND offlineCache.clearAll
// aufrufen, sonst ueberlebt ein gegifteter Cache-Eintrag und crasht sofort wieder.
const clearAuthMock = vi.fn().mockResolvedValue(undefined);
const clearAllMock = vi.fn().mockResolvedValue(undefined);
vi.mock('../../services/tokenStore', () => ({
  clearAuth: () => clearAuthMock(),
}));
vi.mock('../../services/offlineCache', () => ({
  offlineCache: { clearAll: () => clearAllMock() },
}));

// Komponente die einen Fehler wirft
const ThrowingComponent = () => {
  throw new Error('Test Error');
};

describe('ErrorBoundary', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // React Error Boundaries loggen den Fehler via console.error
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('rendert children wenn kein Fehler auftritt', () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">Normaler Inhalt</div>
      </ErrorBoundary>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Normaler Inhalt')).toBeInTheDocument();
  });

  it('zeigt die Login-Look-Fehlerseite wenn Kind-Komponente wirft', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText('Bitte melde dich erneut an')).toBeInTheDocument();
  });

  it('zeigt custom fallback wenn fallback-Prop gesetzt', () => {
    render(
      <ErrorBoundary fallback={<div data-testid="custom-fallback">Eigene Fehleranzeige</div>}>
        <ThrowingComponent />
      </ErrorBoundary>
    );
    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
    expect(screen.getByText('Eigene Fehleranzeige')).toBeInTheDocument();
  });

  it('zeigt den "Zur Anmeldung"-Button im Default-Fallback', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText('Zur Anmeldung')).toBeInTheDocument();
  });

  it('leert beim "Zur Anmeldung"-Klick sowohl Auth als auch den offlineCache', async () => {
    // reload mocken, damit jsdom nicht meckert
    const reloadMock = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...original, reload: reloadMock },
    });

    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByText('Zur Anmeldung'));

    // Beide Aufrufe sind dynamische Imports + Promises -> auf den finally-reload warten
    await waitFor(() => expect(reloadMock).toHaveBeenCalled());
    expect(clearAuthMock).toHaveBeenCalled();
    expect(clearAllMock).toHaveBeenCalled();

    Object.defineProperty(window, 'location', { configurable: true, value: original });
  });
});
