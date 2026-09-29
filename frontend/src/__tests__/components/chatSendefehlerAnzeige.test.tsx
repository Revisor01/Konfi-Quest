import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import MessageBubble from '../../components/chat/MessageBubble';
import { sendeFehlerText } from '../../components/chat/sendeFehler';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { Message, ChatRoomBase } from '../../types/chat';

// ---------------------------------------------------------------------------
// Der Grund an einer vom Server abgelehnten Chat-Nachricht (Nebenbefund Paket
// G2, 29.09.2026). Bisher stand dort nur das rote Warnsymbol. Den Weg dahin
// (kein Einreihen, kein zweiter Versuch) prüft chatSendefehlerGrund.test.tsx.
// ---------------------------------------------------------------------------

const raum: ChatRoomBase = { id: 3, name: 'Jahrgang', type: 'group' };
const ich = { id: 1, type: 'konfi' as const, display_name: 'Ich', role_name: 'konfi' };

const fehlgeschlagen = (status?: number): Message => ({
  id: -1,
  content: 'Plakat.pdf',
  sender_id: 1,
  sender_name: 'Ich',
  sender_type: 'konfi',
  created_at: '2026-09-29T08:00:00Z',
  message_type: 'file',
  file_name: 'Plakat.pdf',
  queueStatus: 'error',
  localId: 'lokal-1',
  clientId: 'lokal-1',
  ...(status !== undefined ? { sendeFehlerStatus: status } : {}),
});

const zeige = (message: Message, onRetry = vi.fn()) => {
  render(
    <MessageBubble
      message={message}
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
      onRetry={onRetry}
      onDeselectMessage={vi.fn()}
      textareaRef={{ current: null }}
    />
  );
  return onRetry;
};

afterEach(() => cleanup());

describe('Grund an der abgelehnten Nachricht', () => {
  it('413: "Nicht gesendet: Die Datei ist zu groß."', () => {
    zeige(fehlgeschlagen(413));
    expect(screen.getByText('Nicht gesendet: Die Datei ist zu groß.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Nachricht nicht gesendet' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Nachricht erneut senden' })).toBeNull();
  });

  it('415: "Nicht gesendet: Dieser Dateityp kann nicht gesendet werden."', () => {
    zeige(fehlgeschlagen(415));
    expect(screen.getByText('Nicht gesendet: Dieser Dateityp kann nicht gesendet werden.')).toBeTruthy();
  });

  it('vorübergehender Fehler (503) oder unbekannt: kein Grund, der Knopf bleibt "erneut senden"', () => {
    zeige(fehlgeschlagen(503));
    expect(screen.queryByText(/^Nicht gesendet:/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Nachricht erneut senden' })).toBeTruthy();
    cleanup();

    zeige(fehlgeschlagen());
    expect(screen.queryByText(/^Nicht gesendet:/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Nachricht erneut senden' })).toBeTruthy();
  });
});

describe('sendeFehlerText: feste Texte je Status', () => {
  it('endgültige Ablehnungen', () => {
    expect(sendeFehlerText(413)).toBe('Die Datei ist zu groß.');
    expect(sendeFehlerText(415)).toBe('Dieser Dateityp kann nicht gesendet werden.');
    for (const status of [400, 401, 403, 404, 409, 422]) {
      expect(sendeFehlerText(status)).toBe('Die Nachricht wurde nicht angenommen.');
    }
  });

  it('kein Text, wo ein neuer Versuch helfen kann', () => {
    for (const status of [undefined, 0, 408, 429, 500, 502, 503]) {
      expect(sendeFehlerText(status)).toBeNull();
    }
  });

  it('der Satz für 413 nennt keine Grenze -- der Chat hat zwei', () => {
    // 5 MB je Datei (chatUpload), 2 MB für Textdateien (utils/textDatei.js);
    // beide kommen als 413. Eine Zahl im Satz wäre für eine davon falsch.
    const server = (datei: string) => readFileSync(resolve(__dirname, '../../../../backend', datei), 'utf8');
    expect(server('createApp.js')).toContain('limits: { fileSize: 5 * 1024 * 1024 },\n    fileFilter: dateiFilter(\'chat\')');
    expect(server('utils/textDatei.js')).toContain("status: 413, error: 'Textdatei ist zu groß (max. 2 MB).'");
    expect(sendeFehlerText(413)).not.toMatch(/\d/);
  });

  it('der Satz für 415 ist der des Servers für einen nicht erlaubten Typ im Chat', () => {
    const regeln = readFileSync(resolve(__dirname, '../../../../backend/utils/uploadTypen.js'), 'utf8');
    expect(regeln).toContain(`text: '${sendeFehlerText(415)}'`);
  });
});
