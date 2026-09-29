// Challenge loeschen (useChallengeDelete) -- Verhaltenstest.
//
// Anlass: Audit Tests 26.09.2026, BF-10 -- der Hook hatte keinen Test,
// obwohl er entscheidet, ob beim Loeschen die Beitraege der Konfis mitgehen
// (force=true). Beim Schreiben aufgefallen (29.09.2026): Eine GEPLANTE,
// noch nicht gestartete Challenge bekam die Warnung "wurde bereits
// gestartet" samt force -- das Handbuch (80-challenges.md) und der Server
// sagen: Entwuerfe und noch nicht gestartete lassen sich direkt loeschen.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { AdminChallenge } from '../../types/challenges';

interface Knopf { text: string; role?: string; handler?: () => void }
let alert: { header?: string; message?: string; buttons: Knopf[] } | null = null;
vi.mock('@ionic/react', () => ({
  useIonAlert: () => [(optionen: typeof alert) => { alert = optionen; }],
}));
const setError = vi.fn();
const setSuccess = vi.fn();
vi.mock('../../contexts/AppContext', () => ({ useApp: () => ({ setError, setSuccess }) }));
const apiDelete = vi.fn(async (_url: string) => ({ data: {} }));
vi.mock('../../services/api', () => ({ default: { delete: (url: string) => apiDelete(url) } }));

import { useChallengeDelete } from '../../hooks/useChallengeDelete';

const TAG = 24 * 3600 * 1000;
const iso = (abstand: number) => new Date(Date.now() + abstand).toISOString();
const challenge = (zusatz: Partial<AdminChallenge>): AdminChallenge => ({
  id: 42, title: 'Fotorallye', is_draft: false,
  starts_at: iso(-2 * TAG), ends_at: iso(5 * TAG), submission_count: 0,
  ...zusatz,
} as AdminChallenge);

const knopf = (text: string) => {
  const k = alert?.buttons.find((b) => b.text === text);
  if (!k) throw new Error(`Kein Knopf "${text}" im Dialog: ${alert?.buttons.map((b) => b.text).join(', ')}`);
  return k;
};

function starte() {
  const onDeleted = vi.fn(async () => undefined);
  const { result } = renderHook(() => useChallengeDelete({ onDeleted }));
  return { handleDelete: result.current.handleDelete, onDeleted };
}

beforeEach(() => {
  vi.clearAllMocks();
  alert = null;
});

describe('Challenge loeschen', () => {
  it('Entwurf: einfache Rueckfrage, geloescht ohne force', async () => {
    const { handleDelete, onDeleted } = starte();
    handleDelete(challenge({ is_draft: true }));
    expect(alert?.header).toBe('Entwurf löschen');
    expect(alert?.message).toBe('Entwurf "Fotorallye" wirklich löschen?');
    await act(async () => { knopf('Löschen').handler?.(); });
    expect(apiDelete).toHaveBeenCalledWith('/challenges/admin/42');
    expect(onDeleted).toHaveBeenCalledTimes(1);
    expect(setSuccess).toHaveBeenCalledWith('Challenge gelöscht');
  });

  it('geplant, noch nicht gestartet: einfache Rueckfrage ohne "bereits gestartet", geloescht ohne force', async () => {
    const { handleDelete } = starte();
    handleDelete(challenge({ starts_at: iso(3 * TAG), ends_at: iso(10 * TAG) }));
    expect(alert?.header).toBe('Challenge löschen');
    expect(alert?.message).toBe('Die geplante Challenge "Fotorallye" wirklich löschen?');
    expect(alert?.message).not.toContain('gestartet');
    await act(async () => { knopf('Löschen').handler?.(); });
    expect(apiDelete).toHaveBeenCalledWith('/challenges/admin/42');
  });

  it('laufend mit Beitraegen: Warnung nennt die Zahl, geloescht mit force', async () => {
    const { handleDelete, onDeleted } = starte();
    handleDelete(challenge({ submission_count: 3 }));
    expect(alert?.header).toBe('Challenge unwiderruflich löschen');
    expect(alert?.message).toBe('"Fotorallye" wurde bereits gestartet. Beim Löschen werden 3 Beiträge samt hochgeladener Dateien endgültig entfernt. Das lässt sich nicht rückgängig machen.');
    await act(async () => { knopf('Endgültig löschen').handler?.(); });
    expect(apiDelete).toHaveBeenCalledWith('/challenges/admin/42?force=true');
    expect(onDeleted).toHaveBeenCalledTimes(1);
  });

  it('beendet ohne Beitraege: ebenfalls die ausdrueckliche Bestaetigung mit force', async () => {
    const { handleDelete } = starte();
    handleDelete(challenge({ starts_at: iso(-10 * TAG), ends_at: iso(-1 * TAG) }));
    expect(alert?.message).toBe('"Fotorallye" wurde bereits gestartet. Beim Löschen wird die Challenge endgültig entfernt. Das lässt sich nicht rückgängig machen.');
    await act(async () => { knopf('Endgültig löschen').handler?.(); });
    expect(apiDelete).toHaveBeenCalledWith('/challenges/admin/42?force=true');
  });

  it('Abbrechen loescht nichts', () => {
    const { handleDelete } = starte();
    handleDelete(challenge({ submission_count: 3 }));
    expect(knopf('Abbrechen').role).toBe('cancel');
    expect(knopf('Abbrechen').handler).toBe(undefined);
    expect(apiDelete).not.toHaveBeenCalled();
  });

  it('ein Fehler des Servers erscheint als Meldung, die Liste bleibt', async () => {
    apiDelete.mockRejectedValueOnce({ response: { status: 403, data: { error: 'Kein Zugriff auf diese Challenge' } } });
    const { handleDelete, onDeleted } = starte();
    handleDelete(challenge({ submission_count: 1 }));
    await act(async () => { knopf('Endgültig löschen').handler?.(); });
    expect(setError).toHaveBeenCalledWith('Kein Zugriff auf diese Challenge');
    expect(onDeleted).not.toHaveBeenCalled();
    expect(setSuccess).not.toHaveBeenCalled();
  });
});
