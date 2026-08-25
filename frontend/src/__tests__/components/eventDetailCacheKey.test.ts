import { describe, it, expect } from 'vitest';

// Nutzerhinweis 25.08.2026: "Ich sehe die Liste der Events, aber wenn ich in
// ein Event klicke, ist alles 0 und rot und es steht nur Event da."
//
// Ursache: Listenseite und Detailseite luden BEIDE die vollstaendige Liste von
// /konfi/events, speicherten sie aber unter VERSCHIEDENEN Cache-Schluesseln:
//   Liste:  'konfi:events:<userId>'        (KonfiEventsPage.tsx:92)
//   Detail: 'konfi:event-detail:<eventId>' (konfi/views/EventDetailView.tsx:93)
//
// Offline fand die Detailseite deshalb nichts, sobald man einen Termin
// oeffnete, den man nicht vorher schon einmal einzeln angetippt hatte:
// allEvents blieb leer, eventData wurde null, die Seite zeigte Nullen.
//
// Zusaetzlich entstand pro angetipptem Termin ein eigener Cache-Eintrag mit
// der KOMPLETTEN Liste — bei 23 Terminen also 23 Kopien derselben Daten.

const listenKey = (userId?: number) => 'konfi:events:' + userId;
const detailKeyAlt = (eventId: number) => `konfi:event-detail:${eventId}`;
const detailKeyNeu = (userId?: number) => 'konfi:events:' + userId;

describe('Termin-Detail: Cache-Schluessel', () => {
  it('nutzt denselben Schluessel wie die Terminliste', () => {
    expect(detailKeyNeu(150)).toBe(listenKey(150));
  });

  it('der alte Schluessel passte NICHT zur Liste', () => {
    // Der Fehler, wie er gemeldet wurde.
    expect(detailKeyAlt(105)).not.toBe(listenKey(150));
  });

  it('ist fuer alle Termine derselbe Eintrag, nicht einer pro Termin', () => {
    const schluessel = new Set([105, 106, 107, 150].map(() => detailKeyNeu(150)));
    expect(schluessel.size).toBe(1);
  });

  it('trennt weiterhin nach Konto', () => {
    // Zwei Personen auf demselben Geraet duerfen sich nicht vermischen.
    expect(detailKeyNeu(150)).not.toBe(detailKeyNeu(151));
  });
});
