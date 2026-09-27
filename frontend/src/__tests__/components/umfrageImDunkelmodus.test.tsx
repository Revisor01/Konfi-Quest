import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import MessageBubble from '../../components/chat/MessageBubble';
import type { Message, ChatRoomBase } from '../../types/chat';

// ---------------------------------------------------------------------------
// Umfragen im Chat waren im Dunkelmodus unlesbar (27.09.2026).
//
// Die Antworten standen auf festem Weiss (`background: … : 'white'`), ihre
// Schrift aber auf --app-text-emphasis -- im Dunkeln #f2f2f7. Fast Weiss auf
// Weiss. Dasselbe galt fuer den Rahmen der eigenen Umfrage (Frage auf Weiss)
// und das Zitat einer beantworteten Nachricht in der eigenen Blase. Rahmen
// und "vergeben"-Flaeche waren Schwarz mit Deckkraft -- auf dunklem Grund
// verschwinden sie.
//
// jsdom wertet keine Media-Queries aus; geprueft wird deshalb, dass die
// Flaechen an den Tokens haengen, die im Dunkelblock von variables.css
// wechseln (dunkelmodus.test.ts prueft, dass sie das tun und dass Text darauf
// lesbar ist). Hell tragen die Tokens die Werte von vorher.
// ---------------------------------------------------------------------------

const ich = { id: 1, type: 'admin' as const, display_name: 'Leitung', role_name: 'admin' };
const raum: ChatRoomBase = { id: 3, name: 'Jahrgang', type: 'group' };

const umfrage = (eigene: boolean): Message => ({
  id: 50,
  content: '',
  sender_id: eigene ? ich.id : 7,
  sender_name: eigene ? 'Leitung' : 'Kim',
  sender_type: eigene ? 'admin' : 'konfi',
  created_at: '2026-09-27T08:00:00Z',
  message_type: 'poll',
  question: 'Wer bringt was mit?',
  options: ['Kuchen', 'Getränke', 'Nichts'],
  exclusive_options: true,
  // "Kuchen" hat jemand anderes schon gewaehlt -> fuer mich vergeben.
  votes: [{ user_id: 9, user_type: 'konfi', option_index: 0, user_name: 'Mia' }],
  ...(eigene ? { reply_to_id: 40, reply_to_sender_name: 'Kim', reply_to_content: 'Wer macht was?' } : {}),
});

const zeigen = (eigene: boolean) =>
  render(
    <MessageBubble
      message={umfrage(eigene)}
      room={raum}
      user={ich}
      selectedMessage={null}
      showReactionPicker={false}
      reactionTargetMessage={null}
      onLongPress={vi.fn()}
      onReply={vi.fn()}
      onShare={vi.fn()}
      onDelete={vi.fn()}
      onToggleReaction={vi.fn()}
      onOpenReactionPicker={vi.fn()}
      onVoteInPoll={vi.fn()}
      onFileClick={vi.fn()}
      onError={vi.fn()}
      onDeselectMessage={vi.fn()}
      textareaRef={{ current: null }}
    />
  );

/** Die Antwort-Knoepfe der Umfrage, in der Reihenfolge der Optionen. */
const antworten = () => screen.getAllByRole('button').filter((k) => k.hasAttribute('aria-pressed'));

/** Weiss oder Schwarz mit Deckkraft -- beides bricht im Dunkelmodus. */
const FESTE_FARBE = /\bwhite\b|#fff\b|#ffffff|rgba\(\s*0\s*,\s*0\s*,\s*0\s*,/;

afterEach(() => cleanup());

describe('Umfrage im Chat: Flächen folgen dem Dunkelmodus', () => {
  it('freie Antworten liegen auf dem Kartengrund, mit Rahmen aus dem Token', () => {
    zeigen(false);
    const [, frei] = antworten();
    expect(frei.textContent).toContain('Getränke');
    expect(frei.style.background).toBe('var(--app-surface-card)');
    expect(frei.style.border).toBe('1px solid var(--app-border-soft)');
    expect(frei.getAttribute('style')).not.toMatch(FESTE_FARBE);
  });

  it('eine vergebene Antwort liegt auf der gedämpften Fläche, nicht auf Schwarz mit Deckkraft', () => {
    zeigen(false);
    const [vergeben] = antworten();
    expect(vergeben.getAttribute('aria-disabled')).toBe('true');
    expect(vergeben.style.background).toBe('var(--app-surface-muted)');
    expect(vergeben.getAttribute('style')).not.toMatch(FESTE_FARBE);
  });

  it('in der eigenen Blase: Umfrage-Rahmen und Zitat auf dem Kartengrund, nicht auf Weiß', () => {
    zeigen(true);
    // Frage -> Kopfzeile -> Rahmen der Umfrage
    const rahmen = screen.getByText('Wer bringt was mit?').parentElement!.parentElement!;
    expect(rahmen.style.background).toBe('var(--app-surface-card)');
    const zitat = screen.getByRole('button', { name: 'Zur beantworteten Nachricht springen' });
    expect(zitat.style.backgroundColor).toBe('var(--app-surface-card)');
    for (const antwort of antworten()) {
      expect(antwort.getAttribute('style')).not.toMatch(FESTE_FARBE);
    }
  });
});
