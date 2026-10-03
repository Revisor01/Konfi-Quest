import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, waitFor, fireEvent, cleanup } from '@testing-library/react';

// Die Challenge fuer Team und Leitung als eigene Seite (2.4.0, Simon
// 02.10.2026: "challenge nicht in modal öffnen, sondern in unterseite,
// damit man direkt auf die challenge linken kann aus einem push").
//
// Die Seite holt die Challenge selbst (GET /challenges/admin/:id, dieselbe
// Sichtbarkeit wie die Liste) und reicht sie an die Ansicht mit Moderation
// und eigenem Beitrag. Ein Push kann direkt hierher fuehren -- auch zu
// einer Challenge, die es nicht mehr gibt oder die einem anderen Jahrgang
// gehoert.
//
// "Neu seit dem letzten Oeffnen" (rote Zahl) muss auf der Seite genauso
// zurueckgehen wie im frueheren Dialog: beim Aufgehen und beim Verlassen,
// bei Entwuerfen und geplanten Challenges gar nicht (dort gibt es keine
// Beitraege, und der Server kennt sie fuer mark-read nicht).

const { setError, markChallengeAsRead, refreshAllCounts } = vi.hoisted(() => ({
  setError: vi.fn(),
  markChallengeAsRead: vi.fn(async () => undefined),
  refreshAllCounts: vi.fn(async () => undefined),
}));

const stabil = { user: { id: 4, type: 'admin', organization_id: 1 }, setError, setSuccess: vi.fn() };
vi.mock('../../../contexts/AppContext', () => ({ useApp: () => stabil }));
vi.mock('../../../contexts/BadgeContext', () => ({ useBadge: () => ({ markChallengeAsRead, refreshAllCounts }) }));
vi.mock('../../../services/api', () => ({ default: { get: vi.fn() } }));
// Die gemeinsame Kopfzeile als schlichte Attrappe: Ionic verschiebt
// aria-label beim Aufbau in den inneren Knopf (inheritAriaAttributes), der
// Zurueck-Knopf waere im Test je nach Zeitpunkt nicht auffindbar. Was die
// Kopfzeile selbst tut, prueft appKopfzeile.test.tsx; hier zaehlt, was die
// Seite ihr gibt.
vi.mock('../../../components/shared/AppKopfzeile', () => ({
  default: ({ titel, onZurueck, rechts }: { titel: React.ReactNode; onZurueck?: () => void; rechts?: React.ReactNode }) => (
    <div data-testid="kopfzeile">
      {onZurueck && <button type="button" aria-label="Zurück" onClick={onZurueck} />}
      <span>{titel}</span>
      {rechts}
    </div>
  ),
  AppKopfzeileGross: () => null,
}));

import api from '../../../services/api';
import { offlineCache } from '../../../services/offlineCache';
import ChallengeLeitungPage from '../../../components/shared/ChallengeLeitungPage';

const vorZweiWochen = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
const inEinerWoche = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
const inZweiWochen = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();
const laufend = {
  id: 7,
  title: 'Fürbitten sammeln',
  description: 'Schreibt eine Bitte für Sonntag',
  visibility: 'konfi_choice',
  moderated: true,
  is_draft: false,
  allow_multiple: true,
  allowed_media: ['text'],
  starts_at: vorZweiWochen,
  ends_at: inEinerWoche,
  jahrgaenge: [{ id: 1, name: '2025/2026' }],
  submission_count: 0,
  pending_count: 0,
};

const fehlerMitStatus = (status: number, data: Record<string, unknown> = { error: 'x' }) =>
  Object.assign(new Error(String(status)), { response: { status, data } });
const netzWeg = Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' });

const antworten = (challenge: unknown) => {
  vi.mocked(api.get).mockImplementation(async (route: string) => {
    if (route === '/challenges/admin/7') return { data: challenge };
    if (route === '/challenges/admin/7/submissions') return { data: { challenge, submissions: [] } };
    throw new Error(`unerwartet: ${route}`);
  });
};

const oeffne = (onBack = vi.fn()) => ({
  onBack,
  ...render(<ChallengeLeitungPage challengeId={7} onBack={onBack} />),
});

const aufrufe = (route: string) => vi.mocked(api.get).mock.calls.filter(([r]) => r === route).length;

beforeEach(() => {
  localStorage.clear();
  setError.mockClear();
  markChallengeAsRead.mockClear();
  refreshAllCounts.mockClear();
  vi.mocked(api.get).mockReset();
});

afterEach(() => cleanup());

describe('ChallengeLeitungPage: Laden', () => {
  it('zeigt waehrend des Ladens einen Ladehinweis', () => {
    vi.mocked(api.get).mockReturnValue(new Promise(() => undefined));
    const { container } = oeffne();
    expect(container.textContent).toContain('Challenge wird geladen');
    expect(api.get).toHaveBeenCalledWith('/challenges/admin/7');
  });

  it('zeigt die Challenge mit Moderation und laedt die Beitraege dazu', async () => {
    antworten(laufend);
    const { container } = oeffne();

    await waitFor(() => expect(container.textContent).toContain('Fürbitten sammeln'));
    expect(container.textContent).toContain('Schreibt eine Bitte für Sonntag');
    await waitFor(() => expect(aufrufe('/challenges/admin/7/submissions')).toBe(1));
    // Seite statt Dialog: Zurueck statt Schliessen, Bearbeiten in der Leiste.
    expect(container.querySelector('[aria-label="Zurück"]')).not.toBeNull();
    expect(container.querySelector('.app-modal-close-btn')).toBeNull();
    expect(container.querySelector('[title="Challenge bearbeiten"]')).not.toBeNull();
  });

  it('der Zurueck-Knopf fuehrt ueber onBack zurueck', async () => {
    antworten(laufend);
    const { container, onBack } = oeffne();
    await waitFor(() => expect(container.textContent).toContain('Fürbitten sammeln'));
    fireEvent.click(container.querySelector('[aria-label="Zurück"]')!);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

// Der IonRouterOutlet registriert die IonPage einer Route beim Einhaengen.
// Tauscht die Seite sie spaeter gegen eine andere (Laden -> Challenge), bemerkt
// er das nicht, und die neue bleibt weiss (MainTabs.tsx, SeiteMitChunk;
// keinTauschImOutlet.test.ts). Die Seite haelt deshalb EINE IonPage fuer alle
// Zustaende und tauscht nur den Inhalt -- auch die Ansicht mit Moderation
// bringt keine eigene mit.
describe('ChallengeLeitungPage: eine IonPage fuer alle Zustaende', () => {
  it('vom Laden zur Challenge bleibt es dieselbe IonPage', async () => {
    let antworten: (v: unknown) => void = () => undefined;
    vi.mocked(api.get).mockImplementation((route: string) => (route === '/challenges/admin/7'
      ? new Promise((r) => { antworten = r; })
      : Promise.resolve({ data: { challenge: laufend, submissions: [] } })) as never);
    const { container } = oeffne();
    const beimLaden = container.querySelector('.ion-page');
    expect(beimLaden).not.toBeNull();

    antworten({ data: laufend });
    await waitFor(() => expect(container.textContent).toContain('Schreibt eine Bitte für Sonntag'));
    expect(container.querySelectorAll('.ion-page')).toHaveLength(1);
    expect(container.querySelector('.ion-page')).toBe(beimLaden);
  });

  it('vom Laden zum Hinweis bleibt es dieselbe IonPage', async () => {
    let ablehnen: (e: unknown) => void = () => undefined;
    vi.mocked(api.get).mockReturnValue(new Promise((_r, j) => { ablehnen = j; }) as never);
    const { container } = oeffne();
    const beimLaden = container.querySelector('.ion-page');

    ablehnen(fehlerMitStatus(404));
    await waitFor(() => expect(container.textContent).toContain('Diese Challenge gibt es nicht mehr'));
    expect(container.querySelectorAll('.ion-page')).toHaveLength(1);
    expect(container.querySelector('.ion-page')).toBe(beimLaden);
  });
});

describe('ChallengeLeitungPage: gelesen beim Aufgehen und beim Verlassen', () => {
  it('laufende Challenge: beim Aufgehen einmal, beim Verlassen noch einmal -- Zaehler werden nachgezogen', async () => {
    antworten(laufend);
    const { container, unmount } = oeffne();
    await waitFor(() => expect(container.textContent).toContain('Fürbitten sammeln'));
    await waitFor(() => expect(markChallengeAsRead).toHaveBeenCalledTimes(1));
    expect(markChallengeAsRead).toHaveBeenCalledWith(7);
    await waitFor(() => expect(refreshAllCounts).toHaveBeenCalledTimes(1));

    unmount();
    await waitFor(() => expect(markChallengeAsRead).toHaveBeenCalledTimes(2));
    expect(markChallengeAsRead).toHaveBeenLastCalledWith(7);
  });

  it('Entwurf und geplante Challenge: nichts zu melden', async () => {
    for (const challenge of [
      { ...laufend, is_draft: true },
      { ...laufend, starts_at: inEinerWoche, ends_at: inZweiWochen },
    ]) {
      antworten(challenge);
      const { container, unmount } = oeffne();
      await waitFor(() => expect(container.textContent).toContain('Fürbitten sammeln'));
      unmount();
    }
    await new Promise((r) => setTimeout(r, 50));
    expect(markChallengeAsRead).not.toHaveBeenCalled();
  });
});

describe('ChallengeLeitungPage: nicht gefunden', () => {
  it('geloescht oder fremde Gemeinde (404): freundlicher Hinweis mit Weg zur Liste', async () => {
    vi.mocked(api.get).mockRejectedValue(fehlerMitStatus(404));
    const { container, onBack, getByText } = oeffne();

    await waitFor(() => expect(container.textContent).toContain('Diese Challenge gibt es nicht mehr'));
    expect(setError).not.toHaveBeenCalled();
    expect(markChallengeAsRead).not.toHaveBeenCalled();
    // Ohne Challenge keine Beitraege -- und keine Schleife.
    await new Promise((r) => setTimeout(r, 300));
    expect(aufrufe('/challenges/admin/7')).toBe(1);
    expect(aufrufe('/challenges/admin/7/submissions')).toBe(0);

    fireEvent.click(getByText('Zu den Challenges'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('nicht zugewiesener Jahrgang (403): nennt den Grund', async () => {
    vi.mocked(api.get).mockRejectedValue(fehlerMitStatus(403, { error: 'Kein Zugriff', error_code: 'jahrgang_nicht_zugewiesen' }));
    const { container, getByText } = oeffne();

    await waitFor(() => expect(container.textContent).toContain('Nicht deinem Jahrgang zugeordnet'));
    expect(container.textContent).not.toContain('Diese Challenge gibt es nicht mehr');
    expect(setError).not.toHaveBeenCalled();
    expect(getByText('Zu den Challenges')).toBeTruthy();
  });
});

describe('ChallengeLeitungPage: ohne Netz', () => {
  it('aus der Leitungsliste bekannt: Challenge aus dem Speicher der Liste', async () => {
    await offlineCache.set('admin:challenges:1', [laufend], 60_000);
    vi.mocked(api.get).mockRejectedValue(netzWeg);
    const { container } = oeffne();

    await waitFor(() => expect(container.textContent).toContain('Fürbitten sammeln'));
    await waitFor(() => expect(container.textContent).toContain('Die Liste der Beiträge ist offline nicht verfügbar.'));
  });

  it('ganz unbekannt: sagt, dass es eine Verbindung braucht', async () => {
    vi.mocked(api.get).mockRejectedValue(netzWeg);
    const { container, getByText } = oeffne();

    await waitFor(() => expect(container.textContent).toContain('Diese Challenge wurde noch nicht geladen'));
    expect(getByText('Zu den Challenges')).toBeTruthy();
  });
});
