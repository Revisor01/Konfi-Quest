import { describe, it, expect, vi, afterEach } from 'vitest';
import React, { useState } from 'react';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import MessageBubble from '../../components/chat/MessageBubble';
import type { Message, ChatRoomBase } from '../../types/chat';

// ---------------------------------------------------------------------------
// Chat: Die Aktionen zu einer Nachricht (Reaktion, Antworten, Teilen, Löschen)
// öffneten nur über den langen Druck bzw. das Kontextmenü. Am Rechner hieß
// das: ein unsichtbarer Rechtsklick; ein langer Mausdruck tat nichts, und per
// Tastatur gab es gar keinen Weg (Nebenbefund Paket M, 26.09.2026; Simon,
// 27.09.2026: „Der Long press im Chat im Browser, das sollten wir noch
// beheben").
//
// Jetzt steht neben jeder Nachricht ein echter Knopf „Aktionen zu dieser
// Nachricht": am Rechner beim Überfahren sichtbar, per Tab immer erreichbar,
// auf Touch-Geräten unsichtbar und ohne Trefffläche (dort bleibt der lange
// Druck). Er löst dieselbe Umschaltung aus wie der lange Druck.
// ---------------------------------------------------------------------------

const wurzel = resolve(__dirname, '../../..');
const lies = (datei: string) => readFileSync(resolve(wurzel, datei), 'utf-8');

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

// Hält die Auswahl wie ChatRoom: onLongPress schaltet um, onDeselectMessage
// schließt Leiste UND Reaktions-Picker.
const Raum: React.FC<{ beiLongPress: (m: Message) => void; beiAbwahl: () => void }> = ({ beiLongPress, beiAbwahl }) => {
  const [auswahl, setAuswahl] = useState<Message | null>(null);
  const [picker, setPicker] = useState(false);
  const [ziel, setZiel] = useState<Message | null>(null);
  return (
    <MessageBubble
      message={nachricht}
      room={raum}
      user={ich}
      selectedMessage={auswahl}
      showReactionPicker={picker}
      reactionTargetMessage={ziel}
      onLongPress={(m) => { beiLongPress(m); setAuswahl((a) => (a?.id === m.id ? null : m)); setPicker(false); }}
      onReply={vi.fn()}
      onShare={vi.fn()}
      onDelete={vi.fn()}
      onToggleReaction={() => setPicker(false)}
      onOpenReactionPicker={(m) => { setZiel(m); setPicker(true); }}
      onVoteInPoll={vi.fn()}
      onFileClick={vi.fn()}
      onError={vi.fn()}
      onDeselectMessage={() => { beiAbwahl(); setAuswahl(null); setPicker(false); setZiel(null); }}
      textareaRef={{ current: null }}
    />
  );
};

const aufbauen = () => {
  const beiLongPress = vi.fn();
  const beiAbwahl = vi.fn();
  render(<Raum beiLongPress={beiLongPress} beiAbwahl={beiAbwahl} />);
  const knopf = screen.getByRole('button', { name: 'Aktionen zu dieser Nachricht' });
  return { knopf, beiLongPress, beiAbwahl };
};

afterEach(() => cleanup());

describe('Aktionen zu einer Chat-Nachricht ohne langen Druck', () => {
  it('je Nachricht ein echter Knopf, per Tab erreichbar, zunächst zugeklappt', () => {
    const { knopf } = aufbauen();
    expect(knopf.tagName).toBe('BUTTON');
    expect(knopf.getAttribute('type')).toBe('button');
    expect(knopf.tabIndex).toBe(0);
    expect(knopf.getAttribute('aria-expanded')).toBe('false');
    knopf.focus();
    expect(document.activeElement).toBe(knopf);
  });

  it('Klick öffnet dieselbe Auswahl wie der lange Druck, der Fokus wandert in die Leiste', () => {
    const { knopf, beiLongPress } = aufbauen();
    fireEvent.click(knopf, { detail: 1 });
    expect(beiLongPress).toHaveBeenCalledTimes(1);
    expect(beiLongPress).toHaveBeenCalledWith(nachricht);
    expect(knopf.getAttribute('aria-expanded')).toBe('true');
    const leiste = document.getElementById(knopf.getAttribute('aria-controls') || '');
    expect(leiste).not.toBeNull();
    for (const name of ['Reaktion hinzufügen', 'Antworten', 'Teilen', 'Nachricht löschen']) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Reaktion hinzufügen' }));
  });

  it('ein zweiter Klick klappt wieder zu', () => {
    const { knopf } = aufbauen();
    fireEvent.click(knopf, { detail: 1 });
    fireEvent.click(knopf, { detail: 1 });
    expect(knopf.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('button', { name: 'Antworten' })).toBeNull();
  });

  it('Escape in der Leiste schließt und gibt den Fokus an den Knopf zurück', () => {
    const { knopf, beiAbwahl } = aufbauen();
    fireEvent.click(knopf, { detail: 1 });
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    expect(beiAbwahl).toHaveBeenCalledTimes(1);
    expect(knopf.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('button', { name: 'Antworten' })).toBeNull();
    expect(document.activeElement).toBe(knopf);
  });

  it('Escape ohne offene Auswahl bleibt unberührt (ein Fenster darüber darf es haben)', () => {
    const { knopf, beiAbwahl } = aufbauen();
    const ereignis = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    knopf.dispatchEvent(ereignis);
    expect(beiAbwahl).not.toHaveBeenCalled();
    expect(ereignis.defaultPrevented).toBe(false);
  });

  it('Reaktion per Tastatur: Enter legt den Fokus auf die erste Reaktion, nach der Wahl zurück auf den Knopf', () => {
    const { knopf } = aufbauen();
    fireEvent.click(knopf, { detail: 1 });
    // Enter auf dem Element löst über tastaturKlick einen echten click() aus
    // (detail 0 — so erkennt die Blase die Tastatur).
    fireEvent.keyDown(screen.getByRole('button', { name: 'Reaktion hinzufügen' }), { key: 'Enter' });
    const reaktionen = screen.getAllByRole('button', { name: /^Mit .+ reagieren$/ });
    expect(reaktionen.length).toBe(6);
    expect(document.activeElement).toBe(reaktionen[0]);
    fireEvent.click(reaktionen[0]);
    expect(screen.queryAllByRole('button', { name: /^Mit .+ reagieren$/ }).length).toBe(0);
    expect(document.activeElement).toBe(knopf);
  });

  it('Escape im Reaktions-Picker schließt alles und kehrt zum Knopf zurück', () => {
    const { knopf, beiAbwahl } = aufbauen();
    fireEvent.click(knopf, { detail: 1 });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Reaktion hinzufügen' }), { key: 'Enter' });
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    expect(beiAbwahl).toHaveBeenCalledTimes(1);
    expect(screen.queryAllByRole('button', { name: /^Mit .+ reagieren$/ }).length).toBe(0);
    expect(knopf.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(knopf);
  });

  it('Mausklick auf „Reaktion hinzufügen" verschiebt den Fokus nicht', () => {
    const { knopf } = aufbauen();
    fireEvent.click(knopf, { detail: 1 });
    const hinzu = screen.getByRole('button', { name: 'Reaktion hinzufügen' });
    hinzu.blur();
    fireEvent.click(hinzu, { detail: 1 });
    const reaktionen = screen.getAllByRole('button', { name: /^Mit .+ reagieren$/ });
    expect(document.activeElement).not.toBe(reaktionen[0]);
  });
});

describe('Sichtbarkeit und Touch-Verhalten (Quelltext)', () => {
  const css = lies('src/theme/barrierefreiheit.css');

  it('der Knopf ist geparkt, nicht entfernt: Deckkraft 0 statt display:none', () => {
    const regel = css.match(/\.app-chat-aktionen-knopf\s*\{([^}]*)\}/);
    expect(regel).not.toBeNull();
    expect(regel![1]).toMatch(/opacity:\s*0\s*;/);
    expect(regel![1]).not.toMatch(/display:\s*none|visibility:\s*hidden/);
  });

  it('am Rechner beim Überfahren und bei offener Auswahl sichtbar, per Tastatur immer', () => {
    const maus = css.match(/@media \(hover: hover\) and \(pointer: fine\)\s*\{([\s\S]*?)\n\}/);
    expect(maus).not.toBeNull();
    expect(maus![1]).toMatch(/\.app-chat-nachricht:hover \.app-chat-aktionen-knopf/);
    expect(maus![1]).toMatch(/\.app-chat-aktionen-knopf\[aria-expanded="true"\]/);
    expect(css).toMatch(/\.app-chat-aktionen-knopf:focus-visible\s*\{[^}]*opacity:\s*1/);
  });

  it('auf Touch-Geräten ohne Trefffläche — dort bleibt der lange Druck', () => {
    const touch = css.match(/@media not all and \(hover: hover\) and \(pointer: fine\)\s*\{([\s\S]*?)\n\}/);
    expect(touch).not.toBeNull();
    expect(touch![1]).toMatch(/\.app-chat-aktionen-knopf:not\(:focus-visible\)\s*\{[^}]*pointer-events:\s*none/);
    const blase = lies('src/components/chat/MessageBubble.tsx');
    expect(blase).toMatch(/onContextMenu=/);
    expect(blase).toMatch(/onTouchStart=/);
  });

  it('ChatRoom schließt beim Abwählen auch den Reaktions-Picker', () => {
    const raumQuelle = lies('src/components/chat/ChatRoom.tsx');
    const m = raumQuelle.match(/onDeselectMessage=\{([\s\S]*?)\}\n/);
    expect(m).not.toBeNull();
    expect(m![1]).toMatch(/setSelectedMessage\(null\)/);
    expect(m![1]).toMatch(/setShowReactionPicker\(false\)/);
    expect(m![1]).toMatch(/setReactionTargetMessage\(null\)/);
  });
});
