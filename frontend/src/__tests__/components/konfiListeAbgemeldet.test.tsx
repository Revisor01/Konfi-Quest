// Die Konfi-Terminliste nennt eine Abmeldung durch die Leitung beim Namen
// (Audit 26.09.2026, Screens Konfi/Teamer BF-01)
//
// Die Statuskette der Liste kannte booking_status 'excused' nicht: Die Karte
// einer abgemeldeten Konfi sagte "Offen" -- als waere nie etwas gewesen. Der
// Statustext wandert ueber EventCornerBadges auf die Karte; genau der wird
// hier gelesen. Die Farb- und Textkette selbst ist Teil der Komponente, darum
// wird die echte Liste gerendert und nicht eine Kopie der Regel geprueft.

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import type { Event } from '../../types/event';

vi.mock('@ionic/react', () => {
  const pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    IonIcon: () => null,
    IonItem: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => <div onClick={onClick}>{children}</div>,
    IonList: pass, IonLabel: pass, IonSegment: pass, IonSegmentButton: pass,
    IonListHeader: pass, IonItemGroup: pass, IonInput: () => null,
    useIonModal: () => [vi.fn(), vi.fn()],
  };
});

vi.mock('../../components/shared', async () => {
  const fmt = await vi.importActual<typeof import('../../components/shared/eventFormatting')>('../../components/shared/eventFormatting');
  return {
    ...fmt,
    SectionHeader: () => null,
    ListSection: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    EventLegendModal: () => null,
    AbsageBlock: () => null,
    EventCornerBadges: ({ statusText, showStatus }: { statusText: string; showStatus: boolean }) =>
      showStatus ? <div data-testid="status">{statusText}</div> : null,
  };
});

import EventsView from '../../components/konfi/views/EventsView';

const inZehnTagen = new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString();

const termin = (zusatz: Partial<Event>): Event => ({
  id: 5,
  name: 'Sommerfest',
  event_date: inZehnTagen,
  points: 2,
  type: 'event',
  registration_status: 'open',
  max_participants: 10,
  registered_count: 2,
  cancelled: false,
  mandatory: false,
  is_konfirmation: false,
  categories: [],
  ...zusatz,
} as Event);

function rendern(events: Event[]) {
  return render(
    <EventsView
      events={events}
      activeTab="alle"
      onTabChange={() => undefined}
      onSelectEvent={() => undefined}
    />
  );
}

describe('Konfi-Terminliste: Abmeldung durch die Leitung', () => {
  it('zeigt "Abgemeldet" statt "Offen", wenn booking_status excused ist', () => {
    rendern([termin({ booking_status: 'excused', is_registered: false, can_register: true })]);
    expect(screen.getByTestId('status').textContent).toBe('Abgemeldet');
  });

  it('auch am Pflichttermin', () => {
    rendern([termin({ mandatory: true, registration_status: 'mandatory', booking_status: 'excused', is_registered: false })]);
    expect(screen.getByTestId('status').textContent).toBe('Abgemeldet');
  });

  it('Gegenprobe: ohne Buchung bleibt es bei "Offen"', () => {
    rendern([termin({ booking_status: null, is_registered: false, can_register: true })]);
    expect(screen.getByTestId('status').textContent).toBe('Offen');
  });

  it('Gegenprobe: bestaetigt bleibt "Angemeldet", Warteliste bleibt "Warteliste (N)"', () => {
    rendern([
      termin({ id: 1, booking_status: 'confirmed', is_registered: true }),
      termin({ id: 2, booking_status: 'waitlist', is_registered: false, waitlist_position: 3 }),
    ]);
    const texte = screen.getAllByTestId('status').map(n => n.textContent);
    expect(texte).toEqual(['Angemeldet', 'Warteliste (3)']);
  });
});
