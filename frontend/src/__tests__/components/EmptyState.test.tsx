import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EmptyState from '../../components/shared/EmptyState';

describe('EmptyState', () => {
  const defaultProps = {
    icon: 'alert-circle',
    title: 'Keine Daten',
    message: 'Es sind keine Eintraege vorhanden.',
  };

  it('rendert den Titel korrekt', () => {
    render(<EmptyState {...defaultProps} />);
    expect(screen.getByText('Keine Daten')).toBeInTheDocument();
  });

  it('rendert die Nachricht korrekt', () => {
    render(<EmptyState {...defaultProps} />);
    expect(screen.getByText('Es sind keine Eintraege vorhanden.')).toBeInTheDocument();
  });

  it('wendet custom iconColor an', () => {
    const { container } = render(
      <EmptyState {...defaultProps} iconColor="#ff0000" />
    );
    const ionIcon = container.querySelector('ion-icon');
    expect(ionIcon).toBeTruthy();
    expect(ionIcon?.getAttribute('style')).toContain('color: rgb(255, 0, 0)');
  });

  it('nutzt Standard-iconColor #999 wenn nicht angegeben', () => {
    const { container } = render(<EmptyState {...defaultProps} />);
    const ionIcon = container.querySelector('ion-icon');
    expect(ionIcon).toBeTruthy();
    expect(ionIcon?.getAttribute('style')).toContain('color: rgb(153, 153, 153)');
  });
});
