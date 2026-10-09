// Verdrahtung des Challenge-Neuigkeiten-Zaehlers (24.09.2026). Simons
// Anforderung nennt drei Orte -- "auf der Challenge, auf dem Navi-Tab, auf
// dem Icon" -- und jeder ist eine eigene Stelle im Code, die einzeln
// vergessen werden kann.
//
// Seit 09.10.2026 gerendert statt am Quelltext (Geruest
// gerueste/reiterLeiste.tsx): Der Server meldet die Zahlen je Challenge in
// GET /notifications/badge-counts, der echte BadgeProvider rechnet, und
// geprueft wird, was am Reiter und am Eintrag der echten Challenge-Seite
// steht. Das Oeffnen meldet die Challenge als gelesen -- das pruefen die
// Seiten selbst gerendert: challengeOeffnenMeldetGelesen.test.tsx (Konfis)
// und challengeSeiteLeitung.test.tsx (Team und Leitung, beim Aufgehen und
// beim Verlassen).
//
// WAECHTER (bleibt Quelltext): "eine Kugel fuer Chat und Challenges statt
// zweier Abschriften" -- eine zweite Kugel, die gleich aussieht, saehe im
// DOM gleich aus.
import {
  zustand, TEAMER, LEITUNG, zaehlerAntwort, zuruecksetzen, mitZaehlern, zeigeReiter,
} from '../gerueste/reiterLeiste';
import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import KonfiChallengesPage from '../../../components/konfi/pages/KonfiChallengesPage';
import TeamerChallengesPage from '../../../components/teamer/pages/TeamerChallengesPage';
import AdminChallengesPage from '../../../components/admin/pages/AdminChallengesPage';
import ChallengesView from '../../../components/konfi/views/ChallengesView';
import ChallengesManageView from '../../../components/admin/views/ChallengesManageView';
import type { AdminChallenge, KonfiChallenge } from '../../../types/challenges';

const tag = 24 * 60 * 60 * 1000;
const challenge = (id: number, title: string) => ({
  id,
  title,
  description: '',
  visibility: 'public',
  audience: 'konfis_und_team',
  moderated: true,
  allow_multiple: true,
  allowed_media: ['text'],
  is_draft: false,
  starts_at: new Date(Date.now() - 7 * tag).toISOString(),
  ends_at: new Date(Date.now() + 7 * tag).toISOString(),
  has_submission: false,
  badge_icon: null,
});

const eintrag = (container: HTMLElement, titel: string) => {
  const treffer = [...container.querySelectorAll('.app-list-item')].filter((e) => e.textContent?.includes(titel));
  expect(treffer, `Eintrag ${titel}`).toHaveLength(1);
  return treffer[0] as HTMLElement;
};
const kugel = (el: HTMLElement) => {
  const k = el.querySelector('.app-zaehler-kugel');
  return k ? { zahl: k.textContent, text: k.getAttribute('aria-label') } : null;
};

beforeEach(() => {
  cleanup();
  zuruecksetzen();
});

describe('Navi-Tab: der Reiter Challenges traegt den Zaehler', () => {
  it('Konfis: die Summe ihrer Neuigkeiten', async () => {
    zustand.antworten.set('/notifications/badge-counts', zaehlerAntwort({ neuigkeitenJe: { 5: 2, 9: 1 } }));
    const reiter = await zeigeReiter('/konfi/dashboard');
    expect(reiter.find((r) => r.tab === 'challenges')).toMatchObject({ name: 'Challenges', zahl: '3', farbe: 'danger' });
  });

  it('ohne Neuigkeiten keine Zahl', async () => {
    const reiter = await zeigeReiter('/konfi/dashboard');
    expect(reiter.find((r) => r.tab === 'challenges')?.zahl).toBeNull();
  });

  it('Team: die offenen Freigaben', async () => {
    zuruecksetzen(TEAMER);
    zustand.antworten.set('/notifications/badge-counts', zaehlerAntwort({ freigabenJe: { 11: 4 } }));
    const reiter = await zeigeReiter('/teamer/dashboard');
    expect(reiter.find((r) => r.tab === 'teamer-challenges')).toMatchObject({ name: 'Challenges', zahl: '4' });
  });

  it('Leitung: Freigaben und Neuigkeiten laufen im selben Schluessel zusammen', async () => {
    // Der Server liefert je Rolle meist nur einen der beiden Anteile; seit
    // dem 27.09.2026 zaehlen die Neuigkeiten auch fuer Leitung und Team.
    zuruecksetzen(LEITUNG);
    zustand.antworten.set('/notifications/badge-counts', zaehlerAntwort({ freigabenJe: { 1: 2 }, neuigkeitenJe: { 1: 1 } }));
    const reiter = await zeigeReiter('/admin/dashboard');
    expect(reiter.find((r) => r.tab === 'admin-challenges')).toMatchObject({ name: 'Challenges', zahl: '3' });
  });
});

describe('Challenge: die Liste bekommt die Zahl je Challenge aus dem BadgeContext', () => {
  it('Konfis: die Kugel steht an der Challenge mit Neuem, und nur dort', async () => {
    zustand.antworten.set('/challenges/konfi', {
      active: [challenge(5, 'Foto-Challenge'), challenge(6, 'Text-Challenge')], archive: [], marks: [], offene_stempel: [],
    });
    zustand.antworten.set('/notifications/badge-counts', zaehlerAntwort({ neuigkeitenJe: { 5: 2 } }));
    const { container } = await mitZaehlern(<KonfiChallengesPage />);
    expect(kugel(eintrag(container, 'Foto-Challenge'))).toEqual({ zahl: '2', text: '2 Neuigkeiten' });
    expect(kugel(eintrag(container, 'Text-Challenge'))).toBeNull();
  });
});

describe('Challenge (Team und Leitung): die Liste bekommt die Zahlen je Challenge aus dem BadgeContext', () => {
  beforeEach(() => {
    zuruecksetzen(TEAMER);
    zustand.antworten.set('/challenges/admin', [challenge(5, 'Foto-Challenge'), challenge(6, 'Text-Challenge')]);
    zustand.antworten.set('/challenges/bewahrte-stempel', []);
  });

  it('offene Freigaben -- dieselbe Quelle wie der Reiter, nicht pending_count der Liste', async () => {
    // 25.09.2026, Simon: "Auf der Challenge muss auch ein Badge sein wie
    // bei den Chats". Die Liste traegt pending_count mit anderem Wert --
    // die Kugel folgt trotzdem dem BadgeContext.
    zustand.antworten.set('/challenges/admin', [
      { ...challenge(5, 'Foto-Challenge'), pending_count: 9 },
      { ...challenge(6, 'Text-Challenge'), pending_count: 4 },
    ]);
    zustand.antworten.set('/notifications/badge-counts', zaehlerAntwort({ freigabenJe: { 5: 1 } }));
    const { container } = await mitZaehlern(<TeamerChallengesPage />);
    expect(kugel(eintrag(container, 'Foto-Challenge'))).toEqual({ zahl: '1', text: '1 offen: 1 Beitrag wartet auf Freigabe' });
    expect(kugel(eintrag(container, 'Text-Challenge'))).toBeNull();
    // Das orange Eck-Badge fuer Wartendes steht daneben.
    expect(eintrag(container, 'Foto-Challenge').querySelector('.app-corner-badges [aria-label="1 Beitrag wartet auf Freigabe"]')).not.toBeNull();
  });

  it('Neuigkeiten kommen an derselben Liste an', async () => {
    zustand.antworten.set('/notifications/badge-counts', zaehlerAntwort({ neuigkeitenJe: { 6: 3 } }));
    const { container } = await mitZaehlern(<TeamerChallengesPage />);
    expect(kugel(eintrag(container, 'Text-Challenge'))).toEqual({ zahl: '3', text: '3 neue Beiträge' });
    expect(kugel(eintrag(container, 'Foto-Challenge'))).toBeNull();
  });

  it('neue Beitraege seit dem letzten Oeffnen und davon wartende (Server ab 29.09.2026)', async () => {
    zuruecksetzen(LEITUNG);
    zustand.antworten.set('/challenges/admin', [challenge(5, 'Foto-Challenge'), challenge(6, 'Text-Challenge')]);
    zustand.antworten.set('/notifications/badge-counts', zaehlerAntwort({
      freigabenJe: { 5: 2 }, neueBeitraegeJe: { 5: 2 }, neueWartendJe: { 5: 2 },
    }));
    const { container } = await mitZaehlern(<AdminChallengesPage />);
    expect(kugel(eintrag(container, 'Foto-Challenge'))).toEqual({ zahl: '2', text: '2 neue Beiträge, davon warten 2 auf Freigabe' });
    expect(kugel(eintrag(container, 'Text-Challenge'))).toBeNull();
  });
});

describe('eine Kugel fuer Chat und Challenges statt zweier Abschriften (Waechter)', () => {
  const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

  it('Chat-Liste, Konfi-Liste und Leitungs-Liste binden dieselbe ZaehlerKugel ein', () => {
    expect(lies('src/components/chat/ChatOverview.tsx')).toContain("import ZaehlerKugel from '../shared/ZaehlerKugel'");
    expect(lies('src/components/konfi/views/ChallengesView.tsx')).toContain("import ZaehlerKugel from '../../shared/ZaehlerKugel'");
    expect(lies('src/components/admin/views/ChallengesManageView.tsx')).toContain("import ZaehlerKugel from '../../shared/ZaehlerKugel'");
  });

  it('Konfi- und Leitungs-Liste zeichnen dieselbe Kugel, ab zehn "9+"', () => {
    const konfi = render(
      <ChallengesView active={[challenge(5, 'Foto-Challenge') as unknown as KonfiChallenge]} archive={[]} marks={[]}
        neuigkeiten={{ 5: 12 }} onSelectChallenge={() => {}} />
    );
    const konfiKugel = konfi.container.querySelector('.app-zaehler-kugel');
    cleanup();
    const leitung = render(
      <ChallengesManageView challenges={[challenge(5, 'Foto-Challenge') as unknown as AdminChallenge]}
        neuigkeiten={{ 5: 12 }} onSelectChallenge={() => {}} onEditChallenge={() => {}} onDeleteChallenge={() => {}} />
    );
    const leitungsKugel = leitung.container.querySelector('.app-zaehler-kugel');
    expect(konfiKugel?.textContent).toBe('9+');
    expect(leitungsKugel?.textContent).toBe('9+');
    expect(leitungsKugel?.className).toBe(konfiKugel?.className);
    expect(leitungsKugel?.parentElement?.className).toBe(konfiKugel?.parentElement?.className);
  });

  it('die alte Inline-Kugel der Chat-Liste ist weg', () => {
    // Sonst gaebe es wieder zwei Fassungen, die auseinanderlaufen.
    expect(lies('src/components/chat/ChatOverview.tsx')).not.toContain("'9+'");
  });

  it('die Leitungsseite meldet nichts selbst als gelesen -- das tut die Seite der Challenge', () => {
    expect(lies('src/components/shared/ChallengesPage.tsx')).not.toContain('markChallengeAsRead');
  });
});
