import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, waitFor, fireEvent, cleanup } from '@testing-library/react';

// Die Challenge der Konfis als eigene Seite (2.4.0, Simon 02.10.2026:
// "challenge nicht in modal öffnen, sondern in unterseite, damit man direkt
// auf die challenge linken kann aus einem push").
//
// Ein Push-Tipp kann jetzt direkt auf /konfi/challenges/<id> fuehren --
// ohne dass die Liste je geladen war, und auch zu einer Challenge, die es
// inzwischen nicht mehr gibt. Die Seite laedt deshalb selbst und sagt, was
// los ist: kein leerer Bildschirm, kein roter Fehlerkasten, keine Schleife.

const { setError, markChallengeAsRead } = vi.hoisted(() => ({
  setError: vi.fn(),
  markChallengeAsRead: vi.fn(),
}));

// Stabile Identitaeten wie im echten Kontext (setError per useCallback):
// Eine je Rendern neue Attrappe liesse das Laden endlos neu anlaufen.
const stabil = { user: { id: 1, type: 'konfi' }, setError };
vi.mock('../../../contexts/AppContext', () => ({ useApp: () => stabil }));
vi.mock('../../../contexts/BadgeContext', () => ({ useBadge: () => ({ markChallengeAsRead }) }));
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
import KonfiChallengeDetailPage from '../../../components/konfi/pages/KonfiChallengeDetailPage';

const vorZweiWochen = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
const inEinerWoche = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
const challenge = {
  id: 7,
  title: 'Foto-Challenge',
  description: 'Mach ein Foto vom Kirchturm',
  visibility: 'public',
  moderated: true,
  is_draft: false,
  allow_multiple: true,
  starts_at: vorZweiWochen,
  ends_at: inEinerWoche,
};

const fehlerMitStatus = (status: number) =>
  Object.assign(new Error(String(status)), { response: { status, data: { error: 'x' } } });
const netzWeg = Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' });

const oeffne = (onBack = vi.fn()) => ({
  onBack,
  ...render(<KonfiChallengeDetailPage challengeId={7} onBack={onBack} />),
});

beforeEach(() => {
  localStorage.clear();
  setError.mockClear();
  markChallengeAsRead.mockClear();
  vi.mocked(api.get).mockReset();
});

afterEach(() => cleanup());

describe('KonfiChallengeDetailPage: Laden', () => {
  it('zeigt waehrend des Ladens einen Ladehinweis -- keine leere Seite', () => {
    vi.mocked(api.get).mockReturnValue(new Promise(() => undefined));
    const { container } = oeffne();
    expect(container.textContent).toContain('Challenge wird geladen');
    expect(api.get).toHaveBeenCalledWith('/challenges/konfi/7');
  });

  it('zeigt die geladene Challenge und meldet sie genau einmal als gelesen', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { challenge, gallery: [], own_submissions: [] } });
    const { container } = oeffne();

    await waitFor(() => expect(container.textContent).toContain('Foto-Challenge'));
    expect(container.textContent).toContain('Mach ein Foto vom Kirchturm');
    expect(container.textContent).toContain('Noch keine geteilten Beiträge');
    // Gemeldet wird im Effekt nach dem Zeichnen -- darauf warten, dann zaehlen.
    await waitFor(() => expect(markChallengeAsRead).toHaveBeenCalledTimes(1));
    expect(markChallengeAsRead).toHaveBeenCalledWith(7);
    // Zurueck-Knopf statt Schliessen-Kreuz: eine Seite, kein Dialog.
    expect(container.querySelector('[aria-label="Zurück"]')).not.toBeNull();
    expect(container.querySelector('.app-modal-close-btn')).toBeNull();
  });

  it('der Zurueck-Knopf fuehrt ueber onBack zurueck', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { challenge, gallery: [], own_submissions: [] } });
    const { container, onBack } = oeffne();
    await waitFor(() => expect(container.textContent).toContain('Foto-Challenge'));
    fireEvent.click(container.querySelector('[aria-label="Zurück"]')!);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

// Der IonRouterOutlet registriert die IonPage einer Route beim Einhaengen.
// Tauscht die Seite sie spaeter gegen eine andere (Laden -> Challenge), bemerkt
// er das nicht, und die neue bleibt weiss (MainTabs.tsx, SeiteMitChunk;
// keinTauschImOutlet.test.ts). Die Seite haelt deshalb EINE IonPage fuer alle
// Zustaende und tauscht nur den Inhalt.
describe('KonfiChallengeDetailPage: eine IonPage fuer alle Zustaende', () => {
  it('vom Laden zur Challenge bleibt es dieselbe IonPage', async () => {
    let antworten: (v: unknown) => void = () => undefined;
    vi.mocked(api.get).mockReturnValue(new Promise((r) => { antworten = r; }) as never);
    const { container } = oeffne();
    const beimLaden = container.querySelector('.ion-page');
    expect(beimLaden).not.toBeNull();

    antworten({ data: { challenge, gallery: [], own_submissions: [] } });
    await waitFor(() => expect(container.textContent).toContain('Mach ein Foto vom Kirchturm'));
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

describe('KonfiChallengeDetailPage: nicht gefunden', () => {
  it('geloescht (404): freundlicher Hinweis mit Weg zur Liste, kein Fehlerkasten', async () => {
    vi.mocked(api.get).mockRejectedValue(fehlerMitStatus(404));
    const { container, onBack, getByText } = oeffne();

    await waitFor(() => expect(container.textContent).toContain('Diese Challenge gibt es nicht mehr'));
    expect(setError).not.toHaveBeenCalled();
    expect(markChallengeAsRead).not.toHaveBeenCalled();

    fireEvent.click(getByText('Zu den Challenges'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('nicht sichtbar (403): eigener Hinweis, ebenfalls mit Weg zur Liste', async () => {
    vi.mocked(api.get).mockRejectedValue(fehlerMitStatus(403));
    const { container, getByText } = oeffne();

    await waitFor(() => expect(container.textContent).toContain('Diese Challenge ist nicht für dich'));
    expect(container.textContent).not.toContain('Diese Challenge gibt es nicht mehr');
    expect(setError).not.toHaveBeenCalled();
    expect(getByText('Zu den Challenges')).toBeTruthy();
  });

  it('keine Endlosschleife: nach dem Hinweis wird nicht weiter angefragt', async () => {
    vi.mocked(api.get).mockRejectedValue(fehlerMitStatus(404));
    const { container } = oeffne();
    await waitFor(() => expect(container.textContent).toContain('Diese Challenge gibt es nicht mehr'));
    await new Promise((r) => setTimeout(r, 300));
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it('eine gespeicherte Fassung gilt nicht, wenn der Server "weg" sagt', async () => {
    // Erst einmal geladen (landet im Speicher) ...
    vi.mocked(api.get).mockResolvedValueOnce({ data: { challenge, gallery: [], own_submissions: [] } });
    const erstes = oeffne();
    await waitFor(() => expect(erstes.container.textContent).toContain('Foto-Challenge'));
    erstes.unmount();
    // ... dann geloescht: Der Server antwortet, also gilt seine Antwort.
    vi.mocked(api.get).mockRejectedValue(fehlerMitStatus(404));
    const { container } = oeffne();
    await waitFor(() => expect(container.textContent).toContain('Diese Challenge gibt es nicht mehr'));
    expect(container.textContent).not.toContain('Mach ein Foto vom Kirchturm');
  });
});

describe('KonfiChallengeDetailPage: ohne Netz', () => {
  it('nie geladen, aber aus der Liste bekannt: Kopf aus der Liste, Beitraege als offline markiert', async () => {
    await offlineCache.set('konfi:challenges:1', { active: [challenge], archive: [], marks: [] }, 60_000);
    vi.mocked(api.get).mockRejectedValue(netzWeg);
    const { container } = oeffne();

    await waitFor(() => expect(container.textContent).toContain('Die Liste der Beiträge ist offline nicht verfügbar.'));
    expect(container.textContent).toContain('Foto-Challenge');
    expect(container.textContent).not.toContain('Noch keine geteilten Beiträge');
  });

  it('ganz unbekannt: sagt, dass es eine Verbindung braucht -- mit Weg zur Liste', async () => {
    vi.mocked(api.get).mockRejectedValue(netzWeg);
    const { container, getByText } = oeffne();

    await waitFor(() => expect(container.textContent).toContain('Diese Challenge wurde noch nicht geladen'));
    expect(getByText('Zu den Challenges')).toBeTruthy();
    expect(setError).not.toHaveBeenCalled();
  });
});
