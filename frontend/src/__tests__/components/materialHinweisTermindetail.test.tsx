import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';

import { EventInfoCard } from '../../components/admin/views/EventDetailSections';
import type { EventData } from '../../components/admin/views/EventDetailSections';
import type { EventMaterial } from '../../types/event';

// Simons Wunsch (01.09.2026): Dass ein Termin Material traegt, stand in der
// Detailansicht NUR im Abschnitt ganz unten -- wer nicht scrollte, sah es
// nie. Jetzt steht in den Eckdaten ("Details") ein klickbarer Hinweis:
//   - genau EIN Material: Titel steht da, Tipp oeffnet direkt dessen Modal
//   - MEHRERE: Anzahl steht da, Tipp springt zum Material-Abschnitt unten
//     (dort ist jeder Eintrag einzeln waehlbar -- eines zu raten waere
//     Willkuer, ein eigenes Auswahlmenue verdoppelte nur die Liste)
//   - KEIN Material: die Zeile erscheint gar nicht (kein "0 Material")
// Der Abschnitt unten BLEIBT -- Simons ausdruecklicher Wunsch.
//
// Konfis haben auf Material keinen Zugriff (alle Material-Routen sind
// requireTeamer aufwaerts) -- ihre Terminansicht darf den Hinweis nicht
// bekommen.

const lies = (pfad: string) =>
  readFileSync(resolve(process.cwd(), pfad), 'utf8');

const eventFixture: EventData = {
  id: 1,
  name: 'Konfi-Tag',
  event_date: '2026-09-05T10:00:00Z',
  points: 0,
  type: 'event',
  max_participants: 20,
  registered_count: 0,
  registration_status: 'open',
  available_spots: 20,
  participants: [],
  created_at: '2026-08-01T00:00:00Z',
};

const material = (id: number, title: string): EventMaterial => ({
  id,
  title,
  created_at: '2026-08-01T00:00:00Z',
});

const renderKarte = (materials: EventMaterial[], onClick = vi.fn()) => {
  render(
    <EventInfoCard
      eventData={eventFixture}
      participants={[]}
      formatDate={(d) => d}
      formatTime={(d) => d}
      eventMaterials={materials}
      onMaterialHinweisClick={onClick}
    />
  );
  return onClick;
};

describe('Material-Hinweis in den Eckdaten (Leitung)', () => {
  it('erscheint MIT Material und traegt bei genau einem dessen Titel', () => {
    renderKarte([material(7, 'Elternbrief Konfi-Tag')]);
    expect(screen.getByText('Material')).toBeTruthy();
    expect(screen.getByText('Elternbrief Konfi-Tag')).toBeTruthy();
  });

  it('zeigt bei mehreren die Anzahl, nicht einen geratenen Titel', () => {
    renderKarte([material(7, 'Elternbrief'), material(8, 'Ablaufplan'), material(9, 'Packliste')]);
    expect(screen.getByText('3 Materialien')).toBeTruthy();
    expect(screen.queryByText('Elternbrief')).toBeNull();
  });

  it('erscheint OHNE Material gar nicht -- kein "0 Material"', () => {
    renderKarte([]);
    expect(screen.queryByText('Material')).toBeNull();
    expect(screen.queryByText('0 Materialien')).toBeNull();
  });

  it('ein Tipp auf den Hinweis loest genau einen Klick-Handler aus', () => {
    const onClick = renderKarte([material(7, 'Elternbrief Konfi-Tag')]);
    fireEvent.click(screen.getByText('Elternbrief Konfi-Tag'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('Klick-Entscheidung der Detailansicht (Leitung)', () => {
  const detail = lies('src/components/admin/views/EventDetailView.tsx');
  const sections = lies('src/components/admin/views/EventDetailSections.tsx');

  it('bei genau einem Material oeffnet der Tipp direkt das Modal', () => {
    expect(detail).toContain('if (eventMaterials.length === 1) {');
    expect(detail).toContain('handleMaterialClick(eventMaterials[0].id)');
  });

  it('bei mehreren springt der Tipp zum Material-Abschnitt unten', () => {
    expect(detail).toContain("document.getElementById('event-material-abschnitt')");
    // ... und der Abschnitt traegt genau diese id als Sprungziel.
    expect(sections).toContain('id="event-material-abschnitt"');
  });

  it('der Abschnitt ganz unten bleibt bestehen (Simons Wunsch)', () => {
    expect(detail).toContain('<EventMaterialSection');
  });
});

describe('Material-Hinweis in den Eckdaten (Teamer)', () => {
  const teamer = lies('src/components/teamer/pages/TeamerEventsPage.tsx');

  it('die Teamer-Detailansicht hat denselben Hinweis mit derselben Entscheidung', () => {
    expect(teamer).toContain('app-event-detail__material-link');
    expect(teamer).toContain('if (eventMaterials.length === 1) {');
    expect(teamer).toContain("document.getElementById('teamer-material-abschnitt')");
    expect(teamer).toContain('id="teamer-material-abschnitt"');
  });

  it('erscheint nur mit Material -- der Zweig steht hinter length > 0', () => {
    // Der Hinweis und der Abschnitt haengen beide an eventMaterials.length > 0;
    // offline setzt der Abruf eventMaterials auf [] und beide verschwinden.
    const hinweis = teamer.indexOf('Material-Hinweis (Simons Wunsch 01.09.2026)');
    expect(hinweis).toBeGreaterThan(-1);
    const zweig = teamer.slice(hinweis, teamer.indexOf('app-info-row__label">Material<', hinweis));
    expect(zweig).toContain('eventMaterials.length > 0 && (');
  });
});

describe('Konfi-Ansicht bleibt aussen vor', () => {
  // Alle Material-Routen sind requireTeamer aufwaerts (material.js) --
  // Konfis duerfen Material weder sehen noch abrufen.
  const konfi = lies('src/components/konfi/views/EventDetailView.tsx');

  it('die Konfi-Terminansicht laedt kein Material und zeigt keinen Hinweis', () => {
    expect(konfi.includes('/material/by-event')).toBe(false);
    expect(konfi.includes('app-event-detail__material-link')).toBe(false);
    expect(konfi.includes('EventInfoCard')).toBe(false);
  });
});
