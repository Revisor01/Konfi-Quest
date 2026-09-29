// Chat-Typen kennen alle drei Nutzertypen (Audit 26.09.2026, Screens
// Konfi/Teamer BF-12 a)
//
// `chat_participants.user_type` fuehrt 'admin', 'teamer' und 'konfi'
// (types/chat.ts, ChatUserType). Einzelne Stellen im Chat beschrieben den
// Wert trotzdem nur mit zwei: der Raum-Typ der ChatRoomView
// (`user_type: 'admin' | 'konfi'`, daraus liest ChatRoom den Direktchat-
// Partner) und die vorlaeufige Reaktion (`user!.type as 'admin' | 'konfi'`).
// Eine Typluege: Ein Vergleich `=== 'teamer'` waere dort nie aufgefallen.
//
// Der Waechter liest die Quelltexte des Chats und verlangt, dass keine
// Zwei-Werte-Vereinigung aus 'admin' und 'konfi' ohne 'teamer' mehr steht.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const WURZEL = join(__dirname, '..', '..', 'components', 'chat');

function dateien(ordner: string): string[] {
  return readdirSync(ordner).flatMap((name) => {
    const pfad = join(ordner, name);
    if (statSync(pfad).isDirectory()) return dateien(pfad);
    return /\.(ts|tsx)$/.test(name) ? [pfad] : [];
  });
}

// 'admin' | 'konfi' oder 'konfi' | 'admin', ohne dass direkt ein weiteres
// Glied ('teamer', 'user') folgt.
const ZWEI_WERTE = /'(admin|konfi)'\s*\|\s*'(admin|konfi)'(?!\s*\|)/;

describe('Chat: Nutzertyp mit drei Werten', () => {
  it('keine Stelle im Chat beschreibt user_type nur mit admin und konfi', () => {
    const treffer = dateien(WURZEL).flatMap((pfad) =>
      readFileSync(pfad, 'utf8').split('\n')
        .map((zeile, i) => ({ zeile, nr: i + 1 }))
        .filter(({ zeile }) => ZWEI_WERTE.test(zeile) && !zeile.trim().startsWith('//'))
        .map(({ nr }) => `${relative(WURZEL, pfad)}:${nr}`)
    );
    expect(treffer).toEqual([]);
  });

  it('ChatRoomView nutzt den gemeinsamen Raum-Typ aus types/chat', () => {
    const quelle = readFileSync(join(WURZEL, 'views', 'ChatRoomView.tsx'), 'utf8');
    expect(quelle).toMatch(/import type \{ ChatRoomBase \} from '..\/..\/..\/types\/chat'/);
    expect(quelle).toContain('useOfflineQuery<ChatRoomBase>');
    expect(quelle).not.toMatch(/interface ChatRoomData/);
  });
});
