import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import MessageBubble from '../../components/chat/MessageBubble';
import type { Message, ChatRoomBase } from '../../types/chat';

// ---------------------------------------------------------------------------
// Umfrage in der App bei grosser Schrift (Simon, 10.10.2026, Bildschirmfoto
// iPhone mit Dynamic Type): "Wittenberg" und "16 (89%)" lagen uebereinander,
// die Zahl war nicht lesbar; im Fuss klebten "Einzelauswahl" und
// "18 Stimmen" aneinander. Vergroesserter Text darf keinen Inhalt verdecken
// (WCAG 1.4.4, 1.4.10) -- deshalb bleibt diese Pruefung, auch seit Layout
// frei aenderbar ist (Simon, 15.10.2026).
//
// jsdom misst kein Layout; geprueft wird, was die Ueberlagerung verhindert:
// Reicht der Platz nicht, brechen Antwortzeile und Fuss um, und ein einzelnes
// langes Wort darf umbrechen. Abstaende, Ausrichtung und Tokens legt der
// Test nicht fest.
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

/** Das naechste Element, das beide enthaelt -- die Zeile, in der sie nebeneinander stehen. */
const gemeinsameZeile = (a: HTMLElement, b: HTMLElement): HTMLElement => {
  let knoten = a.parentElement;
  while (knoten && !knoten.contains(b)) knoten = knoten.parentElement;
  return knoten as HTMLElement;
};

afterEach(() => cleanup());

describe('Umfrage in der App: bei grosser Schrift ueberlagern sich Zahl und Antwort nicht', () => {
  it('die Zeile aus Antwort und Zahl bricht um, statt die Zahl ueber die Antwort zu legen', () => {
    zeigen();
    const zeile = gemeinsameZeile(screen.getByText('Wittenberg'), screen.getAllByText('(50%)')[0]);
    expect(zeile.style.flexWrap).toBe('wrap');
  });

  it('ein langes Wort in der Antwort darf umbrechen', () => {
    zeigen();
    expect(screen.getByText('Wittenberg').style.overflowWrap).toBe('anywhere');
  });

  it('der Fuss aus Art und Stimmen bricht um, statt beides aneinanderzukleben', () => {
    zeigen();
    const fuss = gemeinsameZeile(screen.getByText('Einzelauswahl'), screen.getByText('2 Stimmen'));
    expect(fuss.style.flexWrap).toBe('wrap');
  });
});
