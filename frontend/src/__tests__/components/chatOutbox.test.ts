import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockWriteFile = vi.fn(async () => undefined);
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: { writeFile: (...args: any[]) => mockWriteFile(...args) },
  Directory: { Data: 'DATA' },
}));

const mockEnqueue = vi.fn(async () => undefined);
vi.mock('../../services/writeQueue', () => ({
  writeQueue: { enqueue: (...args: any[]) => mockEnqueue(...args) },
}));

import {
  queueItemZuBubble,
  fehlgeschlageneZuBubble,
  ergaenzeLokaleBubbles,
  chatNachrichtEinreihen,
} from '../../components/chat/chatOutbox';

const absender = { id: 7, name: 'Test Konfi', type: 'konfi' as const };

const queueItem = (clientId: string, createdAt: number, body: Record<string, any> = { content: 'hallo' }) => ({
  id: `q-${clientId}`,
  method: 'POST' as const,
  url: '/chat/rooms/1/messages',
  body: { client_id: clientId, ...body },
  maxRetries: 5,
  retryCount: 0,
  createdAt,
  hasFileUpload: !!body._localFilePath,
  metadata: { type: 'chat' as const, clientId, roomId: 1 },
});

const fehlRecord = (clientId: string, createdAt: number, extra: Record<string, any> = {}) => ({
  clientId,
  roomId: 1,
  content: 'kaputt gegangen',
  createdAt,
  failedAt: createdAt + 1000,
  error: { status: 500, message: 'Serverfehler' },
  ...extra,
});

describe('chatOutbox — Bubbles aus Queue und Fehl-Merker rekonstruieren', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('wartendes Queue-Item wird zur pending-Bubble mit client_id-Verknuepfung', () => {
    const bubble = queueItemZuBubble(queueItem('c1', 1000), absender);

    expect(bubble.queueStatus).toBe('pending');
    expect(bubble.localId).toBe('c1');
    expect(bubble.clientId).toBe('c1');
    expect(bubble.content).toBe('hallo');
    expect(bubble.message_type).toBe('text');
    expect(bubble.sender_id).toBe(7);
    expect(bubble.id).toBeLessThan(0);
  });

  it('Datei-Item wird als Bild-Bubble rekonstruiert', () => {
    const bubble = queueItemZuBubble(
      queueItem('c2', 2000, { content: '', _fileName: 'foto.jpg', _fileType: 'image/jpeg', _localFilePath: 'queue-uploads/x' }),
      absender
    );

    expect(bubble.message_type).toBe('image');
    expect(bubble.file_name).toBe('foto.jpg');
    expect(bubble.content).toBe('foto.jpg');
  });

  it('endgueltig fehlgeschlagene Nachricht wird zur error-Bubble (Retry-Knopf)', () => {
    const bubble = fehlgeschlageneZuBubble(fehlRecord('c3', 3000), absender);

    expect(bubble.queueStatus).toBe('error');
    expect(bubble.localId).toBe('c3');
    expect(bubble.content).toBe('kaputt gegangen');
  });

  it('ergaenzt nur unbekannte Nachrichten — Server-Kopie und vorhandene Bubbles gewinnen', () => {
    const vorhanden = [
      // Vom Server bereits zugestellte Kopie (client_id gesetzt)
      { id: 10, content: 'hallo', client_id: 'c-server', created_at: '2026-08-24T10:00:00Z' } as any,
      // Noch offene lokale Bubble
      { id: -1, content: 'offen', localId: 'c-lokal', queueStatus: 'pending', created_at: '2026-08-24T10:01:00Z' } as any,
    ];
    const ergebnis = ergaenzeLokaleBubbles(
      vorhanden,
      [queueItem('c-server', 1000), queueItem('c-lokal', 2000), queueItem('c-neu', 3000)],
      [fehlRecord('c-fehl', 4000)],
      absender
    );

    expect(ergebnis).toHaveLength(4);
    expect(ergebnis[2].localId).toBe('c-neu');
    expect(ergebnis[2].queueStatus).toBe('pending');
    expect(ergebnis[3].localId).toBe('c-fehl');
    expect(ergebnis[3].queueStatus).toBe('error');
  });

  it('steht eine client_id im Merker UND wieder in der Queue, gewinnt die Queue (pending)', () => {
    const ergebnis = ergaenzeLokaleBubbles(
      [],
      [queueItem('c-doppelt', 1000)],
      [fehlRecord('c-doppelt', 1000)],
      absender
    );

    expect(ergebnis).toHaveLength(1);
    expect(ergebnis[0].queueStatus).toBe('pending');
  });

  it('ohne neue Eintraege bleibt die Liste identisch (gleiche Referenz)', () => {
    const vorhanden = [{ id: 1, content: 'x', created_at: '2026-08-24T10:00:00Z' } as any];
    expect(ergaenzeLokaleBubbles(vorhanden, [], [], absender)).toBe(vorhanden);
  });
});

describe('chatOutbox — chatNachrichtEinreihen persistiert die Nachricht', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Textnachricht landet mit client_id und Raum-URL in der Queue', async () => {
    await chatNachrichtEinreihen(42, { clientId: 'c-text', content: 'moin', replyToId: 99 });

    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    const item = mockEnqueue.mock.calls[0][0];
    expect(item.url).toBe('/chat/rooms/42/messages');
    expect(item.body.content).toBe('moin');
    expect(item.body.client_id).toBe('c-text');
    expect(item.body.reply_to).toBe('99');
    expect(item.hasFileUpload).toBe(false);
    expect(item.metadata).toEqual({ type: 'chat', clientId: 'c-text', roomId: 42, label: 'Chat-Nachricht' });
  });

  it('Datei wird vor dem Einreihen lokal gesichert (ueberlebt App-Neustart)', async () => {
    const file = new File(['abc'], 'bild.png', { type: 'image/png' });
    await chatNachrichtEinreihen(1, { clientId: 'c-file', content: '', file });

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    expect(mockWriteFile.mock.calls[0][0]).toMatchObject({
      path: 'queue-uploads/queue_c-file_bild.png',
      directory: 'DATA',
    });
    const item = mockEnqueue.mock.calls[0][0];
    expect(item.hasFileUpload).toBe(true);
    expect(item.body._localFilePath).toBe('queue-uploads/queue_c-file_bild.png');
    expect(item.body._fileName).toBe('bild.png');
    expect(item.body._fileType).toBe('image/png');
  });
});
