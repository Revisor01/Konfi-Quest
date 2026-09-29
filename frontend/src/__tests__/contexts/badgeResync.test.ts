import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

// Mitteilungen bleiben beim Oeffnen der App liegen -- fuer jede Rolle
// (Simon, 29.09.2026: "warum sollten die keine Benachrichtigungen
// behalten?").
//
// Bis dahin rief AppContext beim Aktivwerden fuer Leitungskonten
// removeAllDeliveredNotifications() auf. Auf dem iPhone setzte das auch die
// Zahl am App-Symbol auf null (Befund 28.08.2026), deshalb schickte AppContext
// danach 'badge:resync' an BadgeContext. Auf Android nahm es die Marke am
// Symbol ganz (sie haengt dort an der liegenden Mitteilung). Beides entfaellt:
// Die App raeumt nur noch gezielt weg -- eine angetippte Mitteilung, einen
// geoeffneten Chat, die Events.
//
// Geprueft wird an der Quelle, ueber ALLE Dateien: Ein Render-Test muesste
// Capacitor und den ganzen Context nachbauen und saehe einen zweiten Aufruf
// an anderer Stelle nicht.

const SRC = resolve(__dirname, '../..');
const lies = (p: string) => readFileSync(join(SRC, p), 'utf-8');

const quellen = (ordner: string): string[] => readdirSync(ordner).flatMap((name) => {
  const pfad = join(ordner, name);
  if (statSync(pfad).isDirectory()) return name === '__tests__' ? [] : quellen(pfad);
  return /\.(ts|tsx)$/.test(name) ? [pfad] : [];
});

describe('Mitteilungen bleiben beim Oeffnen liegen', () => {
  it('VERBOTEN: kein Code raeumt alle zugestellten Mitteilungen auf einmal weg', () => {
    const treffer = quellen(SRC).filter((p) => readFileSync(p, 'utf-8').includes('removeAllDeliveredNotifications'));
    expect(treffer).toEqual([]);
  });

  it('VERBOTEN: AppContext entscheidet beim Aktivwerden nicht mehr nach Rolle ueber das Aufraeumen', () => {
    const s = lies('contexts/AppContext.tsx');
    expect(s).not.toContain('removeAllDelivered');
    expect(s).not.toContain('raeumtBeimAktivwerdenAllesAuf');
    expect(s).not.toContain("if (user?.type === 'admin') {");
  });

  it('ERLAUBT: gezieltes Wegraeumen und die Zahl am Symbol bleiben verdrahtet', () => {
    expect(lies('contexts/AppContext.tsx')).toContain('removeDeliveredById');
    const badge = lies('contexts/BadgeContext.tsx');
    expect(badge).toContain('removeDeliveredForChatRoom(roomId)');
    expect(badge).toContain('setzeGeraeteBadge');
  });
});
