import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Audit 26.09.2026, UI-Bericht BF-01 -- gerenderte Gegenprobe zum
// Quelltext-Scan (formularfelderBenannt.test.ts): Drei Formulare der App
// werden gerendert, und jedes Feld muss den Namen tragen, den die
// Vorlesehilfe nennen soll. Geprueft am Host des Ionic-Elements, am nativen
// <input>/<textarea> (ion-input/ion-textarea sind scoped und ziehen den
// Namen beim Hydrieren dorthin) oder im Shadow-DOM (Toggle, Range, Select).
//
//   - Termin-Formular der Leitung: Grunddaten (Name, Beschreibung, Ort, ...)
//     und die Karte „Konfis" (Schalter und Schieberegler).
//   - Umfrage im Chat: Frage, Optionen, vier Schalter.
// ---------------------------------------------------------------------------

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ isOnline: true, setError: vi.fn(), setSuccess: vi.fn() }),
}));
vi.mock('../../hooks/useActionGuard', () => ({
  useActionGuard: () => ({ isSubmitting: false, guard: async (fn: () => Promise<void>) => fn() }),
}));
vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

import { BasicInfoSection, PointsParticipantsSection, EventFormData } from '../../components/admin/modals/EventFormSections';
import PollModal from '../../components/chat/modals/PollModal';

afterEach(cleanup);

const FELD_SELEKTOR = 'ion-input, ion-textarea, ion-select, ion-toggle, ion-range, ion-datetime, ion-checkbox, ion-searchbar';

/** Zugaenglicher Name eines Ionic-Feldes -- am Host, am nativen Element oder im Shadow-DOM. */
const name = (el: Element): string | null =>
  el.getAttribute('aria-label')
  ?? el.getAttribute('label')
  ?? el.querySelector('input, textarea')?.getAttribute('aria-label')
  ?? el.shadowRoot?.querySelector('[aria-label]')?.getAttribute('aria-label')
  ?? null;

const namen = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>(FELD_SELEKTOR)].map((el) => ({ tag: el.tagName.toLowerCase(), name: name(el) }));

const formData: EventFormData = {
  name: '', description: '', event_date: '', event_end_time: '', location: '', points: 1,
  point_type: 'gottesdienst', category_ids: [], jahrgang_ids: [], type: '', max_participants: 20,
  registration_opens_at: '', registration_closes_at: '', has_timeslots: false, waitlist_enabled: true,
  max_waitlist_size: 5, is_series: false, series_count: 1, series_interval: 'weekly', mandatory: false,
  is_konfirmation: false, bring_items: '', checkin_window: 60, teamer_max_participants: 0,
  teamer_waitlist_enabled: false, teamer_max_waitlist_size: 0,
};

describe('Gerenderte Formulare: jedes Feld hat einen Namen (UI BF-01)', () => {
  it('Termin-Formular, Grunddaten: Name, Beschreibung, Ort, Mitbringen, Zielgruppe, Pflicht, Konfirmation', () => {
    const { container } = render(
      <BasicInfoSection formData={formData} setFormData={vi.fn()} teamerAccess="normal" setTeamerAccess={vi.fn()} loading={false} />,
    );
    const felder = namen(container);
    expect(felder.length).toBeGreaterThanOrEqual(7);
    expect(felder.filter((f) => !f.name)).toEqual([]);
    expect(felder.map((f) => f.name)).toEqual(expect.arrayContaining([
      'Event Name', 'Beschreibung', 'Ort', 'Was mitbringen (optional)', 'Für wen ist das Event?', 'Pflicht-Event', 'Konfirmation',
    ]));
    // Das sichtbare Label bleibt -- Layout unveraendert.
    expect(container.textContent).toContain('Event Name *');
  });

  it('Termin-Formular, Karte „Konfis": Schalter und Schieberegler sind benannt', () => {
    const { container } = render(
      <PointsParticipantsSection formData={formData} setFormData={vi.fn()} loading={false} />,
    );
    const felder = namen(container);
    expect(felder.filter((f) => !f.name)).toEqual([]);
    expect(felder.map((f) => f.name)).toEqual(expect.arrayContaining([
      'Unbegrenzte Teilnehmer:innen', 'Max. Teilnehmer:innen', 'Warteliste aktivieren', 'Max. Wartelisten-Plätze', 'Punkte',
    ]));
    expect(felder.filter((f) => f.tag === 'ion-range').length).toBeGreaterThanOrEqual(3);
  });

  it('Umfrage im Chat: Frage, Optionen und die vier Schalter', () => {
    const { container } = render(<PollModal onClose={() => {}} onSuccess={() => {}} roomId={1} />);
    const felder = namen(container);
    expect(felder.filter((f) => !f.name)).toEqual([]);
    expect(felder.map((f) => f.name)).toEqual(expect.arrayContaining([
      'Frage', 'Option 1', 'Option 2', 'Mehrfachauswahl', 'Namen anzeigen', 'Exklusive Optionen', 'Ablaufdatum',
    ]));
  });
});
