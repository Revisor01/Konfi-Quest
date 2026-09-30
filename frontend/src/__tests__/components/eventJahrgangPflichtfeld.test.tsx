import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Tester-Rückmeldung 30.09.2026: Im Event-Formular trug „Jahrgänge" IMMER das
// Pflicht-Sternchen. Einen Jahrgang verlangen App und Server aber nur bei
// Pflicht-Events (EventModal.handleSubmit, routes/events/verwaltung.js und
// serien.js) -- ein normales Event ohne Jahrgang ist erlaubt und gilt der
// ganzen Gemeinde (CLAUDE.md, „Wer sieht und bekommt was"). Das Sternchen
// behauptete also eine Pflicht, die es nicht gibt.
//
// Anlegen, Bearbeiten, Kopieren und Serie nutzen alle denselben Abschnitt
// (CategoriesTargetSection), deshalb wird genau der gerendert.
// ---------------------------------------------------------------------------

import { CategoriesTargetSection, EventFormData } from '../../components/admin/modals/EventFormSections';

afterEach(cleanup);

const formular = (teil: Partial<EventFormData>): EventFormData => ({
  name: 'Sommerfest', description: '', event_date: '', event_end_time: '', location: '',
  points: 0, point_type: 'gemeinde', category_ids: [], jahrgang_ids: [], type: 'event',
  max_participants: 0, registration_opens_at: '', registration_closes_at: '',
  has_timeslots: false, waitlist_enabled: false, max_waitlist_size: 0,
  is_series: false, series_count: 1, series_interval: 'week',
  mandatory: false, is_konfirmation: false, bring_items: '', checkin_window: 0,
  teamer_max_participants: 0, teamer_waitlist_enabled: false, teamer_max_waitlist_size: 0,
  ...teil,
});

const JAHRGAENGE = [{ id: 1, name: 'Jahrgang 2026' }, { id: 2, name: 'Jahrgang 2027' }];

function abschnitt(teil: Partial<EventFormData>, teamerAccess = 'normal') {
  render(
    <CategoriesTargetSection formData={formular(teil)} setFormData={() => {}} categories={[]}
      jahrgaenge={JAHRGAENGE as never} teamerAccess={teamerAccess} loading={false} />,
  );
  // textContent liefert an Ionic-Elementen in jsdom nichts (Stencil ueberschreibt
  // es fuer die Slot-Nachbildung) -- deshalb die Textknoten selbst einsammeln.
  const text = (el: Element) => {
    const gang = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let t = '';
    while (gang.nextNode()) t += gang.currentNode.nodeValue ?? '';
    return t;
  };
  const ueberschrift = [...document.querySelectorAll('ion-label')]
    .map(text).find((t) => t.startsWith('Jahrgänge'));
  return { ueberschrift: ueberschrift ?? '', seite: text(document.body) };
}

describe('Event-Formular: Jahrgänge sind nur bei Pflicht-Events Pflicht', () => {
  it('normales Event: kein Sternchen, dafür der Hinweis auf die ganze Gemeinde', () => {
    const { ueberschrift, seite } = abschnitt({ mandatory: false });
    expect(ueberschrift).toBe('Jahrgänge (mehrere möglich)');
    expect(seite).toContain('Ohne Auswahl gilt das Event für die ganze Gemeinde.');
  });

  it('normales Event mit Auswahl: kein Sternchen, kein Hinweis, die Zahl der gewählten', () => {
    const { ueberschrift, seite } = abschnitt({ mandatory: false, jahrgang_ids: [1] });
    expect(ueberschrift).toBe('Jahrgänge (mehrere möglich)(1 ausgewählt)');
    expect(seite).not.toContain('ganze Gemeinde');
  });

  it('Pflicht-Event ohne Auswahl: Sternchen und der Grund', () => {
    const { ueberschrift, seite } = abschnitt({ mandatory: true });
    expect(ueberschrift).toBe('Jahrgänge (mehrere möglich) * (Pflicht bei Pflicht-Events)');
    expect(seite).not.toContain('ganze Gemeinde');
  });

  it('Pflicht-Event mit Auswahl: Sternchen bleibt, der Grund entfällt', () => {
    const { ueberschrift } = abschnitt({ mandatory: true, jahrgang_ids: [1, 2] });
    expect(ueberschrift).toBe('Jahrgänge (mehrere möglich) *(2 ausgewählt)');
  });

  it('„Nur Team": der Abschnitt fehlt ganz', () => {
    const { ueberschrift } = abschnitt({ mandatory: false }, 'teamer_only');
    expect(ueberschrift).toBe('');
  });
});
