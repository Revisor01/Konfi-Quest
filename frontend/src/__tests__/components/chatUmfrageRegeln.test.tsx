// Umfragen: was für eine Umfrage gilt, steht in ihr (Simon, 10.10.2026:
// „im sinne der klarheit brauchen wir unbedingt, dass wir schreiben was
// jeweils für eine umfrage gilt, damit das die kinder wissen").
//
//   - Regelzeilen (chatNachricht.umfrageRegeln) für jede Kombination, in App
//     (MessageBubble) und Web (WebUmfrage) sichtbar.
//   - Einmalige Antwort: Ein Tipp gibt die Stimme direkt ab, OHNE Rückfrage
//     (Simon, 10.10.2026); danach ist nichts mehr antippbar. Bei
//     Mehrfachauswahl erst auswählen, dann „Antwort abgeben".
//   - Namen aufdecken: nur für Ersteller:in und Leitung.
//   - Erstellen-Dialog: die neuen Schalter mit Erklärung und was er schickt.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import type { Message, ChatRoomBase } from '../../types/chat';

const apiPost = vi.fn();
vi.mock('../../services/api', () => ({ default: { post: (...a: unknown[]) => apiPost(...a), get: vi.fn() } }));
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ isOnline: true, setError: vi.fn(), setSuccess: vi.fn() }),
}));
vi.mock('../../hooks/useActionGuard', () => ({
  useActionGuard: () => ({ isSubmitting: false, guard: async (fn: () => Promise<void>) => fn() }),
}));
// JSDOM reicht ionChange/ionInput nicht an React durch (pushAuswahl.test.tsx):
// Schalter, Felder und Knöpfe als schlichte Elemente mit denselben Props.
vi.mock('@ionic/react', async () => {
  const echt = await vi.importActual<typeof import('@ionic/react')>('@ionic/react');
  const R = await vi.importActual<typeof import('react')>('react');
  type FeldProps = { value?: string; 'aria-label'?: string; onIonInput?: (e: { detail: { value: string } }) => void };
  const feld = (p: FeldProps) => R.createElement('input', {
    'aria-label': p['aria-label'], value: p.value ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => p.onIonInput?.({ detail: { value: e.target.value } }),
  });
  const IonToggle = (p: { checked?: boolean; disabled?: boolean; 'aria-label'?: string; onIonChange?: (e: { detail: { checked: boolean } }) => void }) =>
    R.createElement('input', {
      type: 'checkbox', 'aria-label': p['aria-label'], checked: !!p.checked, disabled: !!p.disabled,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => p.onIonChange?.({ detail: { checked: e.target.checked } }),
    });
  const IonButton = (p: { children?: React.ReactNode; onClick?: () => void; disabled?: boolean; 'aria-label'?: string }) =>
    R.createElement('button', { onClick: p.onClick, disabled: p.disabled, 'aria-label': p['aria-label'] }, p.children);
  return { ...echt, IonToggle, IonButton, IonInput: feld, IonTextarea: feld };
});

import { umfrageRegeln, umfrageGesperrt, umfrageMitAbgabeSchritt, darfNamenAufdecken } from '../../components/chat/chatNachricht';
import WebUmfrage from '../../components/chat/web/WebUmfrage';
import MessageBubble from '../../components/chat/MessageBubble';
import PollModal from '../../components/chat/modals/PollModal';

afterEach(cleanup);
beforeEach(() => { apiPost.mockReset(); apiPost.mockResolvedValue({ data: {} }); });

const konfi = { id: 21, type: 'konfi' };
const leitung = { id: 4, type: 'admin' };
const JETZT = new Date('2026-10-10T10:00:00+02:00');

const umfrage = (zusatz: Partial<Message> = {}): Message => ({
  id: 70, poll_id: 9, content: '', sender_id: 4, sender_name: 'Leitung', sender_type: 'admin',
  created_at: '2026-10-10T08:00:00Z', message_type: 'poll', question: 'Wer war der erste Jünger?',
  options: ['Petrus', 'Andreas', 'Johannes'], votes: [], multiple_choice: false, anonymous: true,
  exclusive_options: false, ...zusatz,
});
const meineStimme = { user_id: 21, user_type: 'konfi' as const, option_index: 1 };

describe('Regelzeilen: was für die Umfrage gilt', () => {
  it('normale anonyme Einzelauswahl', () => {
    expect(umfrageRegeln(umfrage(), konfi, JETZT)).toEqual([
      'Du kannst nur eine Antwort wählen.',
      'Du kannst deine Antwort jederzeit ändern.',
      'Anonym – niemand sieht, was du gewählt hast.',
    ]);
  });

  it('Mehrfachauswahl mit Namen', () => {
    expect(umfrageRegeln(umfrage({ multiple_choice: true, anonymous: false }), konfi, JETZT)).toEqual([
      'Du kannst mehrere Antworten wählen.',
      'Du kannst deine Antwort jederzeit ändern.',
      'Alle sehen, wer was gewählt hat.',
    ]);
  });

  it('Exklusiv-Wahl', () => {
    expect(umfrageRegeln(umfrage({ exclusive_options: true }), konfi, JETZT)[0])
      .toBe('Du kannst nur eine Antwort wählen – und jede Antwort nur eine Person.');
  });

  it('einmalig, noch nicht geantwortet / schon geantwortet', () => {
    const quiz = umfrage({ einmalige_antwort: true });
    expect(umfrageRegeln(quiz, konfi, JETZT)[1]).toBe('Du kannst nur einmal antworten – danach ist deine Antwort fest.');
    expect(umfrageRegeln({ ...quiz, votes: [meineStimme] }, konfi, JETZT)[1]).toBe('Du hast geantwortet – deine Antwort ist jetzt fest.');
  });

  it('einmalig mit Mehrfachauswahl nennt den Schritt „Antwort abgeben"', () => {
    expect(umfrageRegeln(umfrage({ einmalige_antwort: true, multiple_choice: true }), konfi, JETZT)[1])
      .toBe('Du kannst nur einmal antworten – danach ist deine Antwort fest. Wähle alles aus und tippe dann auf „Antwort abgeben“.');
  });

  it('Namen später: ohne und mit Ende, dann aufgedeckt', () => {
    const spaeter = umfrage({ namen_spaeter: true, namen_aufgedeckt: false });
    expect(umfrageRegeln(spaeter, konfi, JETZT)[2]).toBe('Namen werden später aufgedeckt. Dann sehen alle, wer was gewählt hat.');
    expect(umfrageRegeln({ ...spaeter, expires_at: '2026-10-11T10:00:00+02:00' }, konfi, JETZT)[2])
      .toBe('Namen werden später aufgedeckt, spätestens wenn die Umfrage endet. Dann sehen alle, wer was gewählt hat.');
    expect(umfrageRegeln({ ...spaeter, namen_aufgedeckt: true, anonymous: false }, konfi, JETZT)[2])
      .toBe('Die Namen sind aufgedeckt – alle sehen, wer was gewählt hat.');
  });

  it('beendet: nur noch die Namenszeile', () => {
    expect(umfrageRegeln(umfrage({ expires_at: '2026-10-10T09:00:00+02:00' }), konfi, JETZT))
      .toEqual(['Anonym – niemand sieht, was du gewählt hast.']);
  });

  it('gesperrt, Abgabe-Schritt und wer aufdecken darf', () => {
    expect(umfrageGesperrt(umfrage({ einmalige_antwort: true }), konfi, JETZT)).toBe(false);
    expect(umfrageGesperrt(umfrage({ einmalige_antwort: true, votes: [meineStimme] }), konfi, JETZT)).toBe(true);
    // Normale Umfrage mit eigener Stimme bleibt änderbar.
    expect(umfrageGesperrt(umfrage({ votes: [meineStimme] }), konfi, JETZT)).toBe(false);
    expect(umfrageMitAbgabeSchritt(umfrage({ einmalige_antwort: true, multiple_choice: true }))).toBe(true);
    expect(umfrageMitAbgabeSchritt(umfrage({ einmalige_antwort: true }))).toBe(false);
    const spaeter = umfrage({ namen_spaeter: true, namen_aufgedeckt: false });
    expect(darfNamenAufdecken(spaeter, leitung)).toBe(true);
    expect(darfNamenAufdecken(spaeter, { id: 99, type: 'admin' })).toBe(true);
    expect(darfNamenAufdecken(spaeter, konfi)).toBe(false);
    expect(darfNamenAufdecken(spaeter, { id: 3, type: 'teamer' })).toBe(false);
    expect(darfNamenAufdecken({ ...spaeter, namen_aufgedeckt: true }, leitung)).toBe(false);
    expect(darfNamenAufdecken(umfrage(), leitung)).toBe(false);
  });
});

/** Die Antwort-Knöpfe einer Umfrage (tragen aria-pressed). */
const antworten = () => screen.getAllByRole('button').filter((k) => k.hasAttribute('aria-pressed'));

describe('Web: Regeln stehen in der Umfrage, ein Tipp gibt ab', () => {
  it('die Regelzeilen stehen sichtbar über den Antworten', () => {
    render(<WebUmfrage message={umfrage({ einmalige_antwort: true })} user={konfi} onAbstimmen={vi.fn()} />);
    const liste = screen.getByRole('list', { name: 'Was für diese Umfrage gilt' });
    expect([...liste.querySelectorAll('li')].map((li) => li.textContent)).toEqual([
      'Du kannst nur eine Antwort wählen.',
      'Du kannst nur einmal antworten – danach ist deine Antwort fest.',
      'Anonym – niemand sieht, was du gewählt hast.',
    ]);
  });

  it('einmalig: ein Tipp gibt die Stimme direkt ab -- ohne Rückfrage', () => {
    const onAbstimmen = vi.fn();
    render(<WebUmfrage message={umfrage({ einmalige_antwort: true })} user={konfi} onAbstimmen={onAbstimmen} />);
    fireEvent.click(antworten()[2]);
    expect(onAbstimmen).toHaveBeenCalledTimes(1);
    expect(onAbstimmen).toHaveBeenCalledWith(70, 2);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('einmalig und schon geantwortet: nichts mehr antippbar', () => {
    const onAbstimmen = vi.fn();
    render(<WebUmfrage message={umfrage({ einmalige_antwort: true, votes: [meineStimme] })} user={konfi} onAbstimmen={onAbstimmen} />);
    for (const k of antworten()) {
      expect(k.getAttribute('aria-disabled')).toBe('true');
      fireEvent.click(k);
    }
    expect(onAbstimmen).not.toHaveBeenCalled();
  });

  it('normale Umfrage: die eigene Antwort bleibt antippbar (ändern)', () => {
    const onAbstimmen = vi.fn();
    render(<WebUmfrage message={umfrage({ votes: [meineStimme] })} user={konfi} onAbstimmen={onAbstimmen} />);
    fireEvent.click(antworten()[1]);
    expect(onAbstimmen).toHaveBeenCalledWith(70, 1);
  });

  it('einmalig mit Mehrfachauswahl: auswählen, dann „Antwort abgeben" mit allen', () => {
    const onAbstimmen = vi.fn();
    render(<WebUmfrage message={umfrage({ einmalige_antwort: true, multiple_choice: true })} user={konfi} onAbstimmen={onAbstimmen} />);
    const abgeben = screen.getByRole('button', { name: 'Antwort abgeben' }) as HTMLButtonElement;
    expect(abgeben.disabled).toBe(true);
    fireEvent.click(antworten()[2]);
    fireEvent.click(antworten()[0]);
    expect(onAbstimmen).not.toHaveBeenCalled();
    expect(antworten().map((k) => k.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'true']);
    fireEvent.click(abgeben);
    expect(onAbstimmen).toHaveBeenCalledWith(70, [0, 2]);
  });

  it('„Namen aufdecken" nur für Ersteller:in und Leitung, mit der Umfrage-ID', () => {
    const onNamenAufdecken = vi.fn();
    const spaeter = umfrage({ namen_spaeter: true, namen_aufgedeckt: false });
    const { unmount } = render(<WebUmfrage message={spaeter} user={konfi} onAbstimmen={vi.fn()} onNamenAufdecken={onNamenAufdecken} />);
    expect(screen.queryByRole('button', { name: 'Namen aufdecken' })).toBeNull();
    unmount();
    render(<WebUmfrage message={spaeter} user={leitung} onAbstimmen={vi.fn()} onNamenAufdecken={onNamenAufdecken} />);
    fireEvent.click(screen.getByRole('button', { name: 'Namen aufdecken' }));
    expect(onNamenAufdecken).toHaveBeenCalledWith(9);
  });
});

describe('App: dieselben Regeln in der Blase', () => {
  const raum: ChatRoomBase = { id: 1, name: 'Jahrgang', type: 'jahrgang' };
  const zeigen = (message: Message, onVoteInPoll = vi.fn(), user = { id: 21, type: 'konfi' as const, display_name: 'Lena' }) => render(
    <MessageBubble
      message={message} room={raum} user={user} selectedMessage={null} showReactionPicker={false}
      reactionTargetMessage={null} onLongPress={vi.fn()} onReply={vi.fn()} onShare={vi.fn()} onDelete={vi.fn()}
      onToggleReaction={vi.fn()} onOpenReactionPicker={vi.fn()} onVoteInPoll={onVoteInPoll} onNamenAufdecken={vi.fn()}
      onFileClick={vi.fn()} onError={vi.fn()} onDeselectMessage={vi.fn()} textareaRef={{ current: null }}
    />,
  );

  it('Regelzeilen sichtbar, Namen später', () => {
    zeigen(umfrage({ namen_spaeter: true, namen_aufgedeckt: false, einmalige_antwort: true }));
    const liste = screen.getByRole('list', { name: 'Was für diese Umfrage gilt' });
    expect([...liste.querySelectorAll('li')].map((li) => li.textContent)).toEqual([
      'Du kannst nur eine Antwort wählen.',
      'Du kannst nur einmal antworten – danach ist deine Antwort fest.',
      'Namen werden später aufgedeckt. Dann sehen alle, wer was gewählt hat.',
    ]);
    // Eine Konfi sieht keinen Aufdecken-Knopf.
    expect(screen.queryByRole('button', { name: 'Namen aufdecken' })).toBeNull();
  });

  it('einmalig: ein Tipp gibt ab, danach gesperrt', () => {
    const onVote = vi.fn();
    const { unmount } = zeigen(umfrage({ einmalige_antwort: true }), onVote);
    fireEvent.click(antworten()[0]);
    expect(onVote).toHaveBeenCalledWith(70, 0);
    unmount();
    const onVote2 = vi.fn();
    zeigen(umfrage({ einmalige_antwort: true, votes: [meineStimme] }), onVote2);
    for (const k of antworten()) fireEvent.click(k);
    expect(onVote2).not.toHaveBeenCalled();
  });

  it('einmalig mit Mehrfachauswahl: „Antwort abgeben" schickt die Auswahl', () => {
    const onVote = vi.fn();
    zeigen(umfrage({ einmalige_antwort: true, multiple_choice: true }), onVote);
    fireEvent.click(antworten()[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Antwort abgeben' }));
    expect(onVote).toHaveBeenCalledTimes(1);
    expect(onVote).toHaveBeenCalledWith(70, [1]);
  });
});

describe('Erstellen-Dialog: neue Schalter mit Erklärung', () => {
  const ausfuellen = () => {
    fireEvent.change(screen.getByLabelText('Frage'), { target: { value: 'Quizfrage' } });
    fireEvent.change(screen.getByLabelText('Option 1'), { target: { value: 'A' } });
    fireEvent.change(screen.getByLabelText('Option 2'), { target: { value: 'B' } });
  };
  const absenden = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Umfrage erstellen' }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(1));
    return apiPost.mock.calls[0][1] as Record<string, unknown>;
  };

  it('„Nur einmal antworten" mit Erklärung; „Namen erst später" erst, wenn Namen angezeigt werden', () => {
    render(<PollModal onClose={vi.fn()} onSuccess={vi.fn()} roomId={1} />);
    expect(screen.getByLabelText('Nur einmal antworten')).toBeTruthy();
    expect(screen.getByText('Wer abgestimmt hat, kann die Antwort danach nicht mehr ändern – gut für ein Quiz')).toBeTruthy();
    expect(screen.queryByLabelText('Namen erst später aufdecken')).toBeNull();
    expect(screen.getByText('Aus: anonym – niemand sieht, wer was gewählt hat')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Namen anzeigen'));
    expect(screen.getByLabelText('Namen erst später aufdecken')).toBeTruthy();
    expect(screen.getByText('Bis du sie aufdeckst, sieht niemand die Namen – auch du nicht. Endet die Umfrage, werden sie von selbst aufgedeckt.')).toBeTruthy();
  });

  it('schickt einmalige_antwort und namen_spaeter mit anonymous: false', async () => {
    render(<PollModal onClose={vi.fn()} onSuccess={vi.fn()} roomId={3} />);
    ausfuellen();
    fireEvent.click(screen.getByLabelText('Nur einmal antworten'));
    fireEvent.click(screen.getByLabelText('Namen anzeigen'));
    fireEvent.click(screen.getByLabelText('Namen erst später aufdecken'));
    const rumpf = await absenden();
    expect(apiPost.mock.calls[0][0]).toBe('/chat/rooms/3/polls');
    expect(rumpf).toMatchObject({ einmalige_antwort: true, namen_spaeter: true, anonymous: false });
  });

  it('Namen wieder aus: „später" fällt mit weg, nie anonym und später zugleich', async () => {
    render(<PollModal onClose={vi.fn()} onSuccess={vi.fn()} roomId={3} />);
    ausfuellen();
    fireEvent.click(screen.getByLabelText('Namen anzeigen'));
    fireEvent.click(screen.getByLabelText('Namen erst später aufdecken'));
    fireEvent.click(screen.getByLabelText('Namen anzeigen'));
    const rumpf = await absenden();
    expect(rumpf).toMatchObject({ anonymous: true, namen_spaeter: false, einmalige_antwort: false });
  });
});
