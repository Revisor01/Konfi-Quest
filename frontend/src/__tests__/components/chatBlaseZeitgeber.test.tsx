// Chat-Blase: Der lange Druck (500 ms) endet mit der Blase. Verschwindet sie
// vorher -- Raum verlassen, Nachricht geloescht --, oeffnet kein spaeter
// Zeitgeber mehr die Auswahl einer Nachricht, die es nicht mehr gibt (offene
// Befunde, Tests und CI: "Zeitgeber, die das Schliessen einer Seite überleben").
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import MessageBubble from '../../components/chat/MessageBubble';
import type { Message, ChatRoomBase } from '../../types/chat';

const nachricht: Message = {
  id: 41,
  content: 'Treffen wir uns um sieben?',
  sender_id: 7,
  sender_name: 'Kim',
  sender_type: 'konfi',
  created_at: '2026-09-27T08:00:00Z',
  message_type: 'text',
};
const raum: ChatRoomBase = { id: 3, name: 'Jahrgang', type: 'group' };
const ich = { id: 1, type: 'admin' as const, display_name: 'Leitung', role_name: 'admin' };

const blase = (onLongPress: (m: Message) => void) => render(
  <MessageBubble
    message={nachricht}
    room={raum}
    user={ich}
    selectedMessage={null}
    showReactionPicker={false}
    reactionTargetMessage={null}
    onLongPress={onLongPress}
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
  />,
);

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Chat-Blase: langer Druck und Abbau', () => {
  it('erlaubter Fall: 500 ms gedrueckt oeffnet die Auswahl genau einmal', () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    blase(onLongPress);
    fireEvent.touchStart(screen.getByText('Treffen wir uns um sieben?'));
    act(() => { vi.advanceTimersByTime(500); });
    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onLongPress).toHaveBeenCalledWith(nachricht);
  });

  it('losgelassen vor 500 ms: keine Auswahl', () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    blase(onLongPress);
    const text = screen.getByText('Treffen wir uns um sieben?');
    fireEvent.touchStart(text);
    act(() => { vi.advanceTimersByTime(200); });
    fireEvent.touchEnd(text);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('verbotener Fall: die Blase verschwindet waehrend des Drueckens -- kein spaeter Aufruf, kein offener Zeitgeber', () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    const { unmount } = blase(onLongPress);
    fireEvent.touchStart(screen.getByText('Treffen wir uns um sieben?'));
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(onLongPress).not.toHaveBeenCalled();
  });
});
