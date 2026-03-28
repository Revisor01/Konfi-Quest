import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from '../../components/common/ErrorBoundary';

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

  it('zeigt Default-Fehlertext wenn Kind-Komponente wirft', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText('Etwas ist schiefgelaufen')).toBeInTheDocument();
    expect(screen.getByText('Ein unerwarteter Fehler ist aufgetreten.')).toBeInTheDocument();
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

  it('zeigt Buttons "Seite neu laden" und "Zur Startseite" im Default-Fallback', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText('Seite neu laden')).toBeInTheDocument();
    expect(screen.getByText('Zur Startseite')).toBeInTheDocument();
  });
});
