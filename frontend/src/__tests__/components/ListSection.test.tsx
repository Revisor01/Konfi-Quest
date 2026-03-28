import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ListSection from '../../components/shared/ListSection';

describe('ListSection', () => {
  const defaultProps = {
    icon: 'list',
    title: 'Aktivitaeten',
    count: 3,
  };

  it('rendert Titel mit Count in Klammern im IonListHeader', () => {
    const { container } = render(
      <ListSection {...defaultProps}>
        <div>Kind-Inhalt</div>
      </ListSection>
    );
    // IonListHeader enthaelt den Titel — Ionic Custom Elements in jsdom
    const listHeader = container.querySelector('ion-list-header');
    expect(listHeader).toBeTruthy();
    // IonLabel rendert als Shadow-Host; innerHTML enthaelt den Text
    expect(listHeader?.innerHTML).toContain('Aktivitaeten (3)');
  });

  it('rendert children wenn count > 0', () => {
    render(
      <ListSection {...defaultProps}>
        <div data-testid="child-element">Test-Kind</div>
      </ListSection>
    );
    expect(screen.getByTestId('child-element')).toBeInTheDocument();
    expect(screen.getByText('Test-Kind')).toBeInTheDocument();
  });

  it('rendert EmptyState wenn count=0 und emptyIcon/Title/Message gesetzt', () => {
    render(
      <ListSection
        icon="list"
        title="Aktivitaeten"
        count={0}
        emptyIcon="alert"
        emptyTitle="Keine Aktivitaeten"
        emptyMessage="Es wurden noch keine Aktivitaeten eingetragen."
      >
        <div data-testid="child-element">Sollte nicht sichtbar sein</div>
      </ListSection>
    );
    expect(screen.getByText('Keine Aktivitaeten')).toBeInTheDocument();
    expect(screen.getByText('Es wurden noch keine Aktivitaeten eingetragen.')).toBeInTheDocument();
    expect(screen.queryByTestId('child-element')).not.toBeInTheDocument();
  });

  it('rendert EmptyState wenn isEmpty=true explizit gesetzt', () => {
    render(
      <ListSection
        icon="list"
        title="Aktivitaeten"
        count={5}
        isEmpty={true}
        emptyIcon="alert"
        emptyTitle="Leer"
        emptyMessage="Leerer Zustand erzwungen"
      >
        <div data-testid="child-element">Kind</div>
      </ListSection>
    );
    expect(screen.getByText('Leer')).toBeInTheDocument();
    expect(screen.getByText('Leerer Zustand erzwungen')).toBeInTheDocument();
    expect(screen.queryByTestId('child-element')).not.toBeInTheDocument();
  });
});
