// Badges: App und Web-Fassung lesen Reiter, Filter und Leertexte aus EINER
// Beschreibung (seiten/badgesKonfi.ts, seiten/badgesLeitung.ts; 09.10.2026).
// Gerendert werden die echten Ansichten beider Fassungen -- die Weiche
// (useBreitesLayout) ist umgestellt, sonst nichts.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, act } from '@testing-library/react';

const h = vi.hoisted(() => ({
  breit: false,
  push: vi.fn(),
  modale: [] as Array<{ name: string; props: Record<string, unknown>; optionen: Record<string, unknown> | undefined }>,
  alerts: [] as unknown[],
}));

vi.mock('@ionic/react', async () => (await import('../components/start/ionicStart')).ionicStart(h as never));
vi.mock('../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));
vi.mock('../../contexts/AppContext', () => ({ useApp: () => ({ user: { id: 7, type: 'konfi' } }) }));
vi.mock('../../services/api', () => ({ default: { get: vi.fn(() => Promise.resolve({ data: [] })) } }));

import KonfiBadgesView from '../../components/konfi/views/BadgesView';
import LeitungBadgesView from '../../components/admin/BadgesView';
import { inFassung } from '../../seiten/beschreibung';
import { BADGES_KEINE_TREFFER, BADGES_STATUS, BADGES_STATUS_BESCHRIFTUNG, type BadgesStatus } from '../../seiten/badgesKonfi';
import { BADGES_GRUPPE, BADGES_GRUPPE_BESCHRIFTUNG, LEITUNG_BADGES_LEER, LEITUNG_BADGES_STATUS, LEITUNG_BADGES_STATUS_BESCHRIFTUNG } from '../../seiten/badgesLeitung';

/** Die Beschriftungen der App-Reiter (role="tab") in einer Reiterleiste. */
const appReiter = (leiste: HTMLElement): string[] =>
  within(leiste).getAllByRole('tab').map((t) => t.textContent ?? '');
/** Die Beschriftungen der Chips einer Gruppe -- ohne die Zahl dahinter. */
const webChips = (gruppe: string): string[] =>
  within(screen.getByRole('group', { name: gruppe })).getAllByRole('button').map((b) => b.childNodes[0]?.textContent ?? '');

const badge = (id: number, name: string, extra: Record<string, unknown> = {}) => ({
  id, name, description: `${name} beschrieben`, icon: 'trophy', criteria_type: 'total_points', criteria_value: id,
  is_hidden: false, is_earned: false, progress_percentage: 0, color: '#c0c0c0', ...extra,
});
// Alle erreicht: der Reiter „Offen" ist leer.
const ALLE_ERREICHT = [badge(1, 'Erster Schritt', { is_earned: true }), badge(2, 'Punkte-Sammler', { is_earned: true })];

const KonfiSeite: React.FC<{ badges: ReturnType<typeof badge>[] }> = ({ badges }) => {
  const [filter, setFilter] = React.useState<BadgesStatus>('alle');
  return <KonfiBadgesView badges={badges as never} badgeStats={{ totalVisible: badges.length, totalSecret: 0 }} selectedFilter={filter} onFilterChange={setFilter} />;
};

beforeEach(() => { h.breit = false; });

describe('Badges der Konfis und des Teams: eine Beschreibung', () => {
  it('die App zeigt die Reiter der Beschreibung, in ihrer Reihenfolge', () => {
    render(<KonfiSeite badges={ALLE_ERREICHT} />);
    expect(appReiter(screen.getByRole('tablist'))).toEqual(inFassung(BADGES_STATUS, 'app').map((w) => w.kurz ?? w.label));
    expect(appReiter(screen.getByRole('tablist'))).toEqual(['Alle', 'Offen', 'In Arbeit']);
  });

  it('der Browser zeigt die Chips der Beschreibung -- dazu „Erhalten", das es nur dort gibt', () => {
    h.breit = true;
    render(<KonfiSeite badges={ALLE_ERREICHT} />);
    expect(webChips(BADGES_STATUS_BESCHRIFTUNG)).toEqual(inFassung(BADGES_STATUS, 'web').map((w) => w.label));
    expect(webChips(BADGES_STATUS_BESCHRIFTUNG)).toEqual(['Alle', 'Erhalten', 'Offen', 'In Arbeit']);
  });

  it('beide Fassungen filtern mit demselben Prädikat: „Offen" zeigt nur nicht erreichte Badges', () => {
    const badges = [badge(1, 'Erster Schritt', { is_earned: true }), badge(3, 'Punkte-Meister')];
    render(<KonfiSeite badges={badges} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Offen' }));
    expect(screen.queryByText('Erster Schritt')).toBeNull();
    expect(screen.getByText('Punkte-Meister')).toBeInTheDocument();
  });

  it('App: findet die Suche nichts, sagt das der Leertext -- nicht „Alle Badges erreicht!"', () => {
    render(<KonfiSeite badges={ALLE_ERREICHT} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Offen' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Badges durchsuchen' }), { target: { value: 'Nachtwanderung' } });
    expect(screen.getByText(BADGES_KEINE_TREFFER.titel)).toBeInTheDocument();
    expect(screen.getByText(BADGES_KEINE_TREFFER.text)).toBeInTheDocument();
    expect(screen.queryByText('Alle Badges erreicht!')).toBeNull();
  });

  it('App: ohne Suche bleibt der Leertext des Reiters', () => {
    render(<KonfiSeite badges={ALLE_ERREICHT} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Offen' }));
    expect(screen.getByText('Alle Badges erreicht!')).toBeInTheDocument();
    expect(screen.getByText('Du hast alle sichtbaren Badges eingesammelt.')).toBeInTheDocument();
  });

  it('Browser: dieselben Sätze bei Suche ohne Treffer', () => {
    h.breit = true;
    render(<KonfiSeite badges={ALLE_ERREICHT} />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Badges durchsuchen' }), { target: { value: 'Nachtwanderung' } });
    expect(screen.getByText(BADGES_KEINE_TREFFER.text)).toBeInTheDocument();
  });
});

const leitungBadge = (id: number, name: string, extra: Record<string, unknown> = {}) => ({
  id, name, icon: 'trophy', description: '', criteria_type: 'total_points', criteria_value: id,
  is_active: true, is_hidden: false, earned_count: 0, ...extra,
});

const zeigeLeitung = async (badges: ReturnType<typeof leitungBadge>[]) => {
  const ergebnis = render(<LeitungBadgesView badges={badges as never} onSelectBadge={vi.fn()} onDeleteBadge={vi.fn()} targetRole="konfi" onRoleChange={vi.fn()} />);
  await act(async () => { await Promise.resolve(); });
  return ergebnis;
};

describe('Badges verwalten (Leitung): eine Beschreibung', () => {
  it('die App zeigt Gruppe und Stand aus der Beschreibung', async () => {
    await zeigeLeitung([leitungBadge(1, 'Erster Schritt')]);
    const [gruppe, stand] = screen.getAllByRole('tablist');
    expect(appReiter(gruppe)).toEqual(inFassung(BADGES_GRUPPE, 'app').map((w) => w.label));
    expect(appReiter(stand)).toEqual(inFassung(LEITUNG_BADGES_STATUS, 'app').map((w) => w.label));
    expect(appReiter(stand)).toEqual(['Alle', 'Aktiv', 'Geheim', 'Inaktiv']);
  });

  it('der Browser zeigt dieselben Wahlen als Chips', async () => {
    h.breit = true;
    await zeigeLeitung([leitungBadge(1, 'Erster Schritt')]);
    expect(webChips(BADGES_GRUPPE_BESCHRIFTUNG)).toEqual(inFassung(BADGES_GRUPPE, 'web').map((w) => w.label));
    expect(webChips(LEITUNG_BADGES_STATUS_BESCHRIFTUNG)).toEqual(inFassung(LEITUNG_BADGES_STATUS, 'web').map((w) => w.label));
  });

  it('App: ohne ein Badge die Aufforderung „Lege das erste Badge an." (nicht mehr „deinen ersten Badge")', async () => {
    await zeigeLeitung([]);
    expect(screen.getByText(LEITUNG_BADGES_LEER.ohneBadges)).toBeInTheDocument();
    expect(screen.queryByText('Erstelle deinen ersten Badge!')).toBeNull();
  });

  it('App: gibt es Badges, nur keins im Stand, liegt es an Suche oder Filter', async () => {
    await zeigeLeitung([leitungBadge(1, 'Erster Schritt')]);
    fireEvent.click(screen.getByRole('tab', { name: 'Inaktiv' }));
    expect(screen.getByText(LEITUNG_BADGES_LEER.ohneTreffer)).toBeInTheDocument();
  });

  it('Browser: dieselben Sätze', async () => {
    h.breit = true;
    await zeigeLeitung([]);
    expect(screen.getByText(LEITUNG_BADGES_LEER.ohneBadges)).toBeInTheDocument();
  });
});
