import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Beim Typisieren aufgefallen (30.08.2026): SimpleCreateChatModal prüfte vor
// dem Anlegen eines Direktchats, ob schon einer existiert -- über
// `chat.participants` der Raumliste. GET /chat/rooms liefert dieses Feld aber
// gar nicht (chat.js, SELECT ohne participants; nur participant_count und
// partner_user_type). Die Prüfung war damit immer false, der Hinweis "Chat
// existiert bereits" erschien nie.
//
// Gebraucht wird sie auch nicht: POST /chat/direct gibt einen bestehenden Raum
// mit created:false zurück, und /chat/available-users blendet Partner mit
// bestehendem Direktchat ohnehin aus. Der tote Zweig ist deshalb entfernt --
// dieser Test haelt fest, dass er nicht als vermeintliche Verbesserung
// zurueckkehrt, solange die Raumliste keine Teilnehmer mitliefert.

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

const modal = lies('src/components/chat/modals/SimpleCreateChatModal.tsx');
const chatRoute = lies('../backend/routes/chat.js');

/** Quelltext ohne Kommentarzeilen — sonst schlagen die eigenen Erklaerungen an. */
const ohneKommentare = (quelle: string) =>
  quelle
    .split('\n')
    .filter((zeile) => !zeile.trim().startsWith('//'))
    .join('\n');

const modalCode = ohneKommentare(modal);

describe('Direktchat-Doppelpruefung im Chat-Anlegen-Dialog', () => {
  it('prueft nicht mehr gegen chat.participants der Raumliste', () => {
    expect(modalCode).not.toContain('chat.participants');
    expect(modalCode).not.toContain('checkDirectChatExists');
  });

  it('zeigt keinen "Chat existiert bereits"-Hinweis mehr', () => {
    expect(modalCode).not.toContain('Chat existiert bereits');
    expect(modalCode).not.toContain('presentDuplicateAlert');
  });

  it('laedt die Raumliste nicht mehr nur fuer diese Pruefung', () => {
    expect(modalCode).not.toContain('loadExistingChats');
    expect(modalCode).not.toContain("api.get('/chat/rooms')");
  });

  it('GET /chat/rooms liefert weiterhin keine Teilnehmerliste', () => {
    const roomsRoute = chatRoute.slice(
      chatRoute.indexOf("router.get('/rooms'"),
      chatRoute.indexOf("router.get('/rooms/:roomId'")
    );
    expect(roomsRoute).toContain('participant_count');
    expect(roomsRoute).not.toContain('room.participants');
  });

  it('POST /chat/direct liefert einen bestehenden Raum zurueck statt zu doppeln', () => {
    const direct = chatRoute.slice(
      chatRoute.indexOf("router.post('/direct'"),
      chatRoute.indexOf("router.post('/rooms'")
    );
    expect(direct).toContain('existingRoomQuery');
    expect(direct).toContain('room_id: existingRoom.id, created: false');
  });
});
