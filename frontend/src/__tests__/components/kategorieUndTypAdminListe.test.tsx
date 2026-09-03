import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EventsView from '../../components/admin/EventsView';
import type { Event } from '../../types/event';

// Ergaenzung zu kategorieUndTypInListe.test.ts: Dort wird der Quelltext
// geprueft, hier die tatsaechliche Ausgabe der Admin-Liste. Nutzerhinweis
// 03.09.2026 -- Kategorie und Punkteart fehlten in der Gesamtliste.

const basis = (ueberschreibung: Partial<Event> = {}): Event => ({
  id: 1,
  name: 'Jugendgottesdienst',
  event_date: '2026-09-14T18:00:00.000Z',
  points: 3,
  point_type: 'gottesdienst',
  type: 'event',
  max_participants: 50,
  registered_count: 5,
  registration_status: 'open',
  location: 'St. Marien Kirche',
  categories: [{ id: 1, name: 'Gottesdienst' }, { id: 2, name: 'Musik' }],
  ...ueberschreibung,
} as Event);

const zeige = (event: Event) =>
  render(<EventsView events={[event]} onSelectEvent={() => {}} />);

describe('Admin-Terminliste zeigt Kategorie und Punkteart', () => {
  it('nennt die Kategorien des Termins', () => {
    zeige(basis());
    expect(screen.getByText('Gottesdienst, Musik')).toBeInTheDocument();
  });

  it('nennt die Punkteart Gottesdienst', () => {
    zeige(basis());
    expect(screen.getByText('Gottesdienst')).toBeInTheDocument();
  });

  it('nennt die Punkteart Gemeinde', () => {
    zeige(basis({ point_type: 'gemeinde', categories: [] }));
    expect(screen.getByText('Gemeinde')).toBeInTheDocument();
  });

  it('zeigt keine Kategorie-Zeile, wenn der Termin keine hat', () => {
    const { container } = zeige(basis({ categories: [] }));
    expect(container.querySelector('.app-icon-color--category')).toBeNull();
  });

  it('verschweigt die Punkteart bei Pflichtterminen', () => {
    // Sonst stuende dort "Gemeinde", obwohl es keine Konfi-Punkte gibt.
    zeige(basis({ mandatory: true, point_type: 'gemeinde', categories: [] }));
    expect(screen.queryByText('Gemeinde')).toBeNull();
  });

  it('verschweigt die Punkteart bei der Konfirmation', () => {
    zeige(basis({ is_konfirmation: true, point_type: 'gemeinde', categories: [] }));
    expect(screen.queryByText('Gemeinde')).toBeNull();
  });

  it('verschweigt die Punkteart bei reinen Team-Terminen', () => {
    zeige(basis({ teamer_only: true, point_type: 'gemeinde', categories: [] }));
    expect(screen.queryByText('Gemeinde')).toBeNull();
  });

  it('verschweigt die Punkteart ohne Punkte', () => {
    zeige(basis({ points: 0, point_type: 'gemeinde', categories: [] }));
    expect(screen.queryByText('Gemeinde')).toBeNull();
  });

  it('nutzt category_names, wenn die Antwort kein categories-Array hat', () => {
    zeige(basis({ categories: undefined, category_names: 'Freizeit, Diakonie' }));
    expect(screen.getByText('Freizeit, Diakonie')).toBeInTheDocument();
  });
});
