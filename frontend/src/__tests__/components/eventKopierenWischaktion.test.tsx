import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import EventsView from '../../components/admin/EventsView';
import type { Event } from '../../types/event';

// EventsView zieht nur Kleinkram aus dem AppContext — hier reicht ein Stummel.
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    user: { id: 1, type: 'admin' },
    isOnline: true,
    setError: vi.fn(),
    setSuccess: vi.fn()
  })
}));

const inZweiWochen = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

const testEvent: Event = {
  id: 42,
  name: 'Konfi-Tag',
  event_date: inZweiWochen,
  location: 'Gemeindehaus',
  points: 2,
  type: 'event',
  max_participants: 20,
  registered_count: 0,
  registration_status: 'open',
  available_spots: 20,
  created_at: new Date().toISOString()
} as Event;

const basisProps = {
  events: [testEvent],
  onUpdate: vi.fn(),
  onAddEventClick: vi.fn(),
  onSelectEvent: vi.fn()
};

describe('EventsView Kopier-Wischaktion (Leitung)', () => {
  // Der Kopier-Handler samt Berechtigungspruefung existiert in der
  // AdminEventsPage seit jeher — die Wischaktion dazu war bei einer
  // Swipe-Ueberarbeitung verloren gegangen: onCopyEvent kam als Prop an,
  // wurde aber nirgends gerendert. Kopieren war damit unerreichbar.
  it('zeigt die Kopieraktion, wenn onCopyEvent uebergeben ist, und ruft sie auf', () => {
    const onCopyEvent = vi.fn();
    const { container } = render(
      <EventsView {...basisProps} onCopyEvent={onCopyEvent} onDeleteEvent={vi.fn()} />
    );

    const kopierKnopf = container.querySelector('ion-item-option[aria-label="Event kopieren"]');
    expect(kopierKnopf).not.toBeNull();

    fireEvent.click(kopierKnopf!);
    expect(onCopyEvent).toHaveBeenCalledTimes(1);
    expect(onCopyEvent).toHaveBeenCalledWith(expect.objectContaining({ id: 42 }));
  });

  it('zeigt KEINE Kopieraktion ohne onCopyEvent (fehlende Berechtigung)', () => {
    const { container } = render(
      <EventsView {...basisProps} onDeleteEvent={vi.fn()} />
    );
    expect(container.querySelector('ion-item-option[aria-label="Event kopieren"]')).toBeNull();
  });
});
