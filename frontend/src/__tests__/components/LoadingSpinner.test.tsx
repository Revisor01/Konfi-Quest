import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LoadingSpinner from '../../components/common/LoadingSpinner';

describe('LoadingSpinner', () => {
  it('rendert die Standard-Nachricht "Quest wird geladen..."', () => {
    render(<LoadingSpinner />);
    expect(screen.getByText('Quest wird geladen...')).toBeInTheDocument();
  });

  it('rendert eine custom Nachricht', () => {
    render(<LoadingSpinner message="Daten werden abgerufen..." />);
    expect(screen.getByText('Daten werden abgerufen...')).toBeInTheDocument();
  });

  it('rendert inline-Variante ohne ion-page Wrapper', () => {
    const { container } = render(<LoadingSpinner />);
    // Ionic React rendert IonPage als div.ion-page
    const ionPage = container.querySelector('.ion-page');
    expect(ionPage).toBeNull();
  });

  it('rendert fullScreen-Variante mit ion-page Wrapper', () => {
    const { container } = render(<LoadingSpinner fullScreen={true} />);
    // Ionic React rendert IonPage als div.ion-page
    const ionPage = container.querySelector('.ion-page');
    expect(ionPage).toBeTruthy();
  });

  it('zeigt "Konfi Quest" Titel in fullScreen-Modus', () => {
    render(<LoadingSpinner fullScreen={true} />);
    expect(screen.getByText('Konfi Quest')).toBeInTheDocument();
  });
});
