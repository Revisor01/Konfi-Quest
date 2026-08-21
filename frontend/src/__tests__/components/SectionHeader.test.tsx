import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SectionHeader from '../../components/shared/SectionHeader';

describe('SectionHeader', () => {
  const defaultProps = {
    title: 'Veranstaltungen',
    subtitle: 'Alle geplanten Events',
    icon: 'calendar',
    stats: [
      { value: 12, label: 'Gesamt' },
      { value: 3, label: 'Aktiv' },
    ],
  };

  it('rendert Titel und Subtitle', () => {
    render(<SectionHeader {...defaultProps} />);
    expect(screen.getByText('Veranstaltungen')).toBeInTheDocument();
    expect(screen.getByText('Alle geplanten Events')).toBeInTheDocument();
  });

  it('rendert alle Stats mit Werten und Labels', () => {
    render(<SectionHeader {...defaultProps} />);
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Gesamt')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Aktiv')).toBeInTheDocument();
  });

  it('nutzt Preset-Farben fuer "events" (rot)', () => {
    const { container } = render(
      <SectionHeader {...defaultProps} preset="events" />
    );
    const banner = container.querySelector('.app-header-banner') as HTMLElement;
    expect(banner).toBeTruthy();
    // events preset: primary=#dc2626, secondary=#b91c1c
    expect(banner.style.background).toContain('rgb(220, 38, 38)');
  });

  it('nutzt custom colors wenn uebergeben', () => {
    const { container } = render(
      <SectionHeader
        {...defaultProps}
        colors={{ primary: '#00ff00', secondary: '#008800' }}
      />
    );
    const banner = container.querySelector('.app-header-banner') as HTMLElement;
    expect(banner.style.background).toContain('rgb(0, 255, 0)');
  });

  it('rendert die korrekte Anzahl von Stats-Items', () => {
    const { container } = render(<SectionHeader {...defaultProps} />);
    const statItems = container.querySelectorAll('.app-stats-row__item');
    expect(statItems.length).toBe(2);
  });

  it('rendert Stats ohne onClick als reine Anzeige (kein Button)', () => {
    const { container } = render(<SectionHeader {...defaultProps} />);
    expect(container.querySelectorAll('button.app-stats-row__item').length).toBe(0);
    expect(container.querySelectorAll('.app-stats-row__item--clickable').length).toBe(0);
  });

  it('macht Stats mit onClick zu Buttons und meldet den Klick', () => {
    const onGesamt = vi.fn();
    const { container } = render(
      <SectionHeader
        {...defaultProps}
        stats={[
          { value: 12, label: 'Gesamt', onClick: onGesamt, active: true },
          { value: 3, label: 'Aktiv' },
        ]}
      />
    );

    const buttons = container.querySelectorAll('button.app-stats-row__item--clickable');
    expect(buttons.length).toBe(1);

    // Die aktive Kachel ist als solche markiert (Optik + Screenreader).
    expect(buttons[0].classList.contains('app-stats-row__item--active')).toBe(true);
    expect(buttons[0].getAttribute('aria-current')).toBe('true');

    fireEvent.click(screen.getByText('Gesamt'));
    expect(onGesamt).toHaveBeenCalledTimes(1);
  });
});
