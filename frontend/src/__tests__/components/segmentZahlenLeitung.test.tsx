import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { readFileSync } from 'fs';
import { join } from 'path';
import SegmentZahl from '../../components/shared/SegmentZahl';
import ChallengesManageView, { wartendeFreigabenJeReiter, teileChallengesAuf } from '../../components/admin/views/ChallengesManageView';
import EventsView from '../../components/admin/EventsView';
import ActivityRequestsView from '../../components/admin/ActivityRequestsView';
import type { AdminChallenge } from '../../types/challenges';

// Orange Wartezahl im Segment-Knopf (Simon, 28.09.2026, zur Ansicht):
// Wegweiser zu dem Reiter, hinter dem etwas auf die Leitung wartet --
// offene Freigaben, Verbuchungen, Antraege. NUR Wartendes, keine
// Neuigkeiten (die stehen rot an Reiter und Listeneintrag). Inline im
// Knopf, nicht absolut ueber dem Rand. Archiv zaehlt mit.

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: { id: 4, type: 'admin', role_name: 'org_admin' } }),
}));

afterEach(() => cleanup());

const tag = 24 * 60 * 60 * 1000;
const challenge = (id: number, title: string, start: number, ende: number, is_draft = false): AdminChallenge => ({
  id, title, description: 'd', challenge_type: 'frei', visibility: 'public',
  audience: 'konfis_und_team', moderated: true, allowed_media: ['text'], allow_multiple: true,
  starts_at: new Date(Date.now() + start).toISOString(),
  ends_at: new Date(Date.now() + ende).toISOString(),
  is_draft,
} as unknown as AdminChallenge);

const laufend = challenge(1, 'Läuft', -tag, 7 * tag);
const laufend2 = challenge(2, 'Läuft auch', -tag, 7 * tag);
const geplant = challenge(3, 'Kommt', 3 * tag, 9 * tag);
const beendet = challenge(4, 'Vorbei', -9 * tag, -tag);

const knopf = (container: HTMLElement, text: string) =>
  [...container.querySelectorAll('ion-segment-button')].find((k) => k.textContent?.startsWith(text)) as HTMLElement;

describe('SegmentZahl', () => {
  it('zeigt die Zahl mit Vorlesetext, bei 0 nichts, ab 10 "9+"', () => {
    const drei = render(<SegmentZahl anzahl={3} label="warten auf Freigabe" />).container.querySelector('.app-segment-zahl');
    expect(drei?.textContent).toBe('3');
    expect(drei?.getAttribute('role')).toBe('img');
    expect(drei?.getAttribute('aria-label')).toBe('3 warten auf Freigabe');
    expect(render(<SegmentZahl anzahl={0} />).container.querySelector('.app-segment-zahl')).toBeNull();
    expect(render(<SegmentZahl anzahl={12} />).container.querySelector('.app-segment-zahl')?.textContent).toBe('9+');
  });

  it('Farbe steht in EINEM Token (orange), im Textfluss statt absolut', () => {
    const css = readFileSync(join(process.cwd(), 'src/theme/variables.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const m = css.match(/\.app-segment-zahl \{([^}]*)\}/);
    expect(m).not.toBeNull();
    const regel = m![1];
    expect(regel).toMatch(/--app-segment-zahl-farbe:\s*var\(--app-color-warning\);/);
    expect(regel).toMatch(/background:\s*var\(--app-segment-zahl-farbe\);/);
    expect(regel).not.toMatch(/position:\s*absolute/);
    // Keine rote Kugel-Klasse: rot bleibt Reiter und Listeneintrag.
    const el = render(<SegmentZahl anzahl={1} />).container.querySelector('.app-segment-zahl');
    expect(el?.classList.contains('app-zaehler-kugel')).toBe(false);
  });
});

describe('Challenges: Wartezahl je Reiter nach teileChallengesAuf', () => {
  it('reine Funktion: Summe der Freigaben je Reiter, Archiv eingeschlossen', () => {
    const teile = teileChallengesAuf([laufend, laufend2, geplant, beendet]);
    expect(wartendeFreigabenJeReiter(teile, { 1: 2, 2: 1, 4: 3 })).toEqual({ aktuell: 3, geplant: 0, archiv: 3 });
    expect(wartendeFreigabenJeReiter(teile, {})).toEqual({ aktuell: 0, geplant: 0, archiv: 0 });
  });

  it('gerendert: Aktuell 3, Geplant keine, Archiv 1 -- Neuigkeiten zaehlen NICHT', () => {
    const { container } = render(
      <ChallengesManageView
        challenges={[laufend, laufend2, geplant, beendet]}
        offeneFreigaben={{ 1: 2, 2: 1, 4: 1 }}
        neuigkeiten={{ 1: 5, 3: 4 }}
        onSelectChallenge={() => {}}
        onEditChallenge={() => {}}
        onDeleteChallenge={() => {}}
      />
    );
    const aktuell = knopf(container, 'Aktuell').querySelector('.app-segment-zahl');
    expect(aktuell?.textContent).toBe('3');
    expect(aktuell?.getAttribute('aria-label')).toBe('3 warten auf Freigabe');
    expect(knopf(container, 'Geplant').querySelector('.app-segment-zahl')).toBeNull();
    const archiv = knopf(container, 'Archiv').querySelector('.app-segment-zahl');
    expect(archiv?.textContent).toBe('1');
    expect(archiv?.getAttribute('aria-label')).toBe('1 wartet auf Freigabe');
  });
});

describe('Events: Wartezahl am Unter-Reiter "Verbuchen"', () => {
  const zeige = (wartendVerbuchen?: number) => render(
    <EventsView
      events={[]}
      onSelectEvent={() => {}}
      activeTab="aktuell"
      onTabChange={() => {}}
      wartendVerbuchen={wartendVerbuchen}
    />
  ).container;

  it('4 Termine warten: "Verbuchen" traegt 4, die anderen Knoepfe nichts', () => {
    const c = zeige(4);
    const zahl = knopf(c, 'Verbuchen').querySelector('.app-segment-zahl');
    expect(zahl?.textContent).toBe('4');
    expect(zahl?.getAttribute('aria-label')).toBe('4 Events warten auf Verbuchung');
    expect(knopf(c, 'Aktuell').querySelector('.app-segment-zahl')).toBeNull();
    expect(knopf(c, 'Vergangen').querySelector('.app-segment-zahl')).toBeNull();
  });

  it('ohne Angabe keine Zahl', () => {
    expect(zeige(undefined).querySelector('.app-segment-zahl')).toBeNull();
  });
});

describe('Aktivitäten: Wartezahl am Unter-Reiter "Offen"', () => {
  it('2 offene Antraege: "Offen" traegt 2, "Verbucht" und "Abgelehnt" nichts', () => {
    const { container } = render(
      <ActivityRequestsView requests={[]} offeneAntraege={2} onSelectRequest={() => {}} onResetRequest={() => {}} />
    );
    const zahl = knopf(container, 'Offen').querySelector('.app-segment-zahl');
    expect(zahl?.textContent).toBe('2');
    expect(zahl?.getAttribute('aria-label')).toBe('2 Anträge warten auf Entscheidung');
    expect(knopf(container, 'Verbucht').querySelector('.app-segment-zahl')).toBeNull();
    expect(knopf(container, 'Abgelehnt').querySelector('.app-segment-zahl')).toBeNull();
  });

  it('die Seite reicht die Zahl aus dem BadgeContext durch', () => {
    const seite = readFileSync(join(process.cwd(), 'src/components/admin/pages/AdminEventsPage.tsx'), 'utf8');
    expect(seite).toContain('offeneAntraege={pendingRequestsCount}');
  });
});
