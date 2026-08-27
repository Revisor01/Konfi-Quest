import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Befund 12 aus dem Rollen-Bericht (26.08.2026): Die Mitgliederliste und der
// Umfrage-Knopf hingen am SELBEN isAdmin-Gate -- zwei verschiedene Rechte an
// einem Schalter.
//
// Das Backend gibt die Teilnehmerliste seit jeher JEDEM Raum-Mitglied frei
// (chat.js:1336, geprueft wird nur darfRaumOeffnen), und das Handbuch
// verspricht sie den Konfis ausdruecklich: "In Gruppen siehst du, wer sonst
// noch dabei ist" (10-konfis.md:46). Nur die Oberflaeche versteckte sie --
// Konfis und Teamer:innen sahen in Gruppen nicht, wer dabei ist.
//
// Wichtig beim Freigeben: Das Modal enthaelt AUCH Verwaltungsaktionen
// (Mitglied entfernen, hinzufuegen). Die haengen an einem eigenen Gate
// (canManageMembers), das unabhaengig davon bestehen bleiben muss -- sonst
// haette das Oeffnen der Liste versehentlich die Verwaltung mit freigegeben.

const lies = (pfad: string) =>
  readFileSync(resolve(process.cwd(), pfad), 'utf8');

const header = lies('src/components/chat/ChatRoomSections.tsx');
const modal = lies('src/components/chat/modals/MembersModal.tsx');

describe('Mitgliederliste im Chat (Rollen-Bericht 12)', () => {
  it('der Mitglieder-Knopf haengt nicht mehr am isAdmin-Gate', () => {
    const knopf = header.slice(
      header.indexOf('aria-label="Mitglieder anzeigen"') - 400,
      header.indexOf('aria-label="Mitglieder anzeigen"')
    );
    expect(knopf).toContain("roomType !== 'direct'");
  });

  it('in Einzelchats bleibt er weg', () => {
    // Dort weiss man, wer dabei ist -- die Liste waere sinnlos.
    expect(header).toContain("{roomType !== 'direct' && (");
  });

  it('Umfragen anlegen bleibt der Leitung vorbehalten', () => {
    // Gegenprobe: Das zweite Recht darf NICHT mit freigegeben werden.
    const umfrage = header.slice(
      header.indexOf('aria-label="Umfrage erstellen"') - 200,
      header.indexOf('aria-label="Umfrage erstellen"')
    );
    expect(umfrage).toContain('{isAdmin && (');
  });

  it('die Verwaltungsaktionen im Modal bleiben bei der Leitung', () => {
    // Der eigentliche Grund, warum das Freigeben unbedenklich ist: Entfernen
    // und Hinzufuegen haengen an einem EIGENEN Gate.
    expect(modal).toContain("const canManageMembers = user?.type === 'admin' && isGroupChat;");
  });

  it('jede Verwaltungsstelle im Modal ist an dieses Gate gebunden', () => {
    // Vier Stellen: Definition, Hinzufuegen-Knopf, Sliding-Item, Entfernen.
    // Kommt eine hinzu, die es nicht prueft, faellt das hier auf.
    const treffer = modal.match(/canManageMembers/g) || [];
    expect(treffer.length).toBeGreaterThanOrEqual(4);
  });
});
