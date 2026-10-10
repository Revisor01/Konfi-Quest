import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import MessageBubble from '../../components/chat/MessageBubble';
import type { Message, ChatRoomBase } from '../../types/chat';

// ---------------------------------------------------------------------------
// Umfrage in der App (Simon, 10.10.2026, Bildschirmfoto iPhone mit grosser
// Schrift): "Wittenberg" und "16 (89%)" lagen uebereinander, die Zahl war
// nicht lesbar; im Fuss klebten "Einzelauswahl" und "18 Stimmen" aneinander.
// Die Zeile hatte weder Abstand noch Umbruch -- reichte der Platz nicht,
// schob sich die Antwort unter die Zahl.
//
// jsdom misst kein Layout; geprueft wird deshalb, was die Ueberlagerung
// verhindert: Zeile und Fuss brechen um und halten Abstand, die Zahl bleibt
// rechts, und ein einzelnes langes Wort darf umbrechen.
// ---------------------------------------------------------------------------

const ich = { id: 1, type: 'admin' as const, display_name: 'Leitung', role_name: 'admin' };
const raum: ChatRoomBase = { id: 3, name: 'Jahrgang', type: 'group' };

const umfrage: Message = {
  id: 60,
  content: '',
  sender_id: 7,
  sender_name: 'Simon',
  sender_type: 'admin',
  created_at: '2026-10-10T12:07:00Z',
  message_type: 'poll',
  question: 'Wo fand der Thesenanschlag statt?',
  options: ['Wittenberg', 'Worms'],
  votes: [
    { user_id: 1, user_type: 'admin', option_index: 0, user_name: 'Leitung' },
    { user_id: 9, user_type: 'konfi', option_index: 1, user_name: 'Mia' },
  ],
};

const zeigen = () =>
  render(
    <MessageBubble
      message={umfrage}
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

afterEach(() => cleanup());

describe('Umfrage in der App: Zahl und Antwort überlagern sich nicht', () => {
  it('die Zeile einer Antwort bricht um und hält Abstand, die Zahl bleibt rechts', () => {
    zeigen();
    const zahl = screen.getAllByText('(50%)')[0].parentElement as HTMLElement;
    const zeile = zahl.parentElement as HTMLElement;
    expect(zeile.style.flexWrap).toBe('wrap');
    expect(zeile.style.columnGap).toBe('var(--app-abstand-mittel)');
    expect(zahl.style.marginLeft).toBe('auto');
    expect(zahl.style.flexShrink).toBe('0');
  });

  it('ein langes Wort in der Antwort darf umbrechen', () => {
    zeigen();
    const text = screen.getByText('Wittenberg');
    expect(text.style.overflowWrap).toBe('anywhere');
  });

  it('der Fuß bricht um und hält Abstand zwischen Art und Stimmen', () => {
    zeigen();
    const fuss = screen.getByText('2 Stimmen').parentElement?.parentElement as HTMLElement;
    expect(fuss.textContent).toContain('Einzelauswahl');
    expect(fuss.style.flexWrap).toBe('wrap');
    expect(fuss.style.columnGap).toBe('var(--app-abstand-mittel)');
  });
});
