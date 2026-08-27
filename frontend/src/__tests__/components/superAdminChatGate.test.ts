import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Befund aus dem Dashboard/Profil-Durchgang (26.08.2026): super_admin fiel im
// Chat zwischen verschieden definierte "Leitung"-Gates -- sah den Muelleimer,
// bekam vom Backend 403.
//
// Ursache, am Code nachgesehen: `istLeitung` wurde fuer den EXPORT gebaut
// (dort ist super_admin richtig) und dann fuer den Muelleimer mitbenutzt.
// Zwei Rechte an einer Variable -- dasselbe Muster wie bei der
// Mitgliederliste im Chat (Rollen-Bericht 12).
//
// Welche Seite recht hat: das Backend. `chat.js:2304-2305` laesst beim Leeren
// des Team-Chats nur admin und org_admin durch, und das passt zur Rolle:
// super_admin ist organisationsuebergreifend und fuer die Org-VERWALTUNG
// zustaendig (rbac.js:57) -- Inhalte einer fremden Gemeinde zu loeschen
// gehoert nicht dazu.

const lies = (pfad: string) =>
  readFileSync(resolve(process.cwd(), pfad), 'utf8');

const chatRoom = lies('src/components/chat/ChatRoom.tsx');
const backend = lies('../backend/routes/chat.js');

describe('super_admin und der Team-Chat-Muelleimer', () => {
  it('das Leeren haengt an einem eigenen, engeren Gate', () => {
    expect(chatRoom).toContain(
      "const darfTeamChatLeeren = user?.type === 'admin'\n    && ['admin', 'org_admin'].includes(user?.role_name || '');"
    );
  });

  it('der Muelleimer nutzt dieses Gate, nicht mehr istLeitung', () => {
    expect(chatRoom).toContain('onClearChat={darfTeamChatLeeren && room?.is_team_chat');
    expect(chatRoom).not.toContain('onClearChat={istLeitung');
  });

  it('der Export behaelt super_admin', () => {
    // Gegenprobe: Dort war die weite Definition richtig und darf nicht
    // mitgeaendert werden. Das Trennen der Gates ist der Punkt, nicht das
    // Verengen von beidem.
    expect(chatRoom).toContain(
      "const istLeitung = user?.type === 'admin'\n    && ['admin', 'org_admin', 'super_admin'].includes(user?.role_name || '');"
    );
    const menue = chatRoom.slice(
      chatRoom.indexOf('const handleChatOptions'),
      chatRoom.indexOf('Chat-Verlauf exportieren')
    );
    expect(menue).toContain('if (istLeitung)');
  });

  it('das Frontend-Gate deckt sich jetzt mit dem Server', () => {
    // Die eigentliche Zusicherung: Beide Seiten meinen dieselbe Menge.
    // Aendert sich eine, faellt es hier auf.
    expect(backend).toContain(
      "if (req.user.type !== 'admin' || !['org_admin', 'admin'].includes(req.user.role_name)) {"
    );
  });
});
