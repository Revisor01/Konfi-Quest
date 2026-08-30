import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Simons Kritik vom 29.08.2026: "nichtmal dann weiß ich, ob es richtig
// angezeigt wird". Detailansichten zeigten offline ihren Grundstand aus dem
// Listen-Cache, aber Abschnitte, deren Daten an der Detail-Route haengen,
// verschwanden wortlos — die Bedingung lautete `length > 0`, und offline
// blieb die Liste leer. Wer die Seite so sah, konnte nicht unterscheiden, ob
// es keine Teilnehmer gibt oder ob sie nur nicht geladen wurden.
//
// DREI ANSICHTEN: Der Platzhalter gehoert in alle drei Baeume. Genau dieses
// Muster wurde hier schon dreimal halb erledigt (Offline-Rueckfall in
// Termin- und Personenansicht, jeweils eine Ansicht vergessen).

const lies = (pfad: string) =>
  readFileSync(resolve(process.cwd(), pfad), 'utf8');

const konfiTermin = lies('src/components/konfi/views/EventDetailView.tsx');
const adminTermin = lies('src/components/admin/views/EventDetailView.tsx');
const adminKonfi = lies('src/components/admin/views/KonfiDetailView.tsx');
const platzhalter = lies('src/components/shared/OfflinePlatzhalter.tsx');

describe('Offline sagt die App, was fehlt — in allen drei Ansichten', () => {
  it('Konfi-Terminansicht: Teilnehmerliste und Zeitfenster', () => {
    expect(konfiTermin).toContain('<OfflinePlatzhalter was="Die Teilnehmerliste" />');
    expect(konfiTermin).toContain('<OfflinePlatzhalter was="Die Zeitfenster-Auswahl" />');
  });

  it('Leitungs-Terminansicht: Teilnehmerliste', () => {
    expect(adminTermin).toContain('<OfflinePlatzhalter was="Die Teilnehmerliste" />');
  });

  it('Leitungs-Personenansicht: Punkte-Historie', () => {
    expect(adminKonfi).toContain('OfflinePlatzhalter was="Die Aktivitäten- und Punkte-Historie"');
  });

  it('der Platzhalter erscheint NUR offline, nicht bei echter Leere', () => {
    // Sonst stuende "offline nicht verfügbar" an einem Termin, zu dem sich
    // schlicht noch niemand angemeldet hat.
    for (const [name, quelle] of [['konfi', konfiTermin], ['adminTermin', adminTermin], ['adminKonfi', adminKonfi]] as const) {
      const stellen = quelle.split('<OfflinePlatzhalter').slice(1);
      expect(stellen.length, name).toBeGreaterThan(0);
      for (const stelle of stellen) {
        const davor = quelle.slice(0, quelle.indexOf(stelle) );
        expect(davor.slice(-260), name).toContain('!isOnline');
      }
    }
  });
});

describe('Der Platzhalter selbst', () => {
  it('nennt, was fehlt, statt nur "offline"', () => {
    expect(platzhalter).toContain('ist offline nicht verfügbar');
  });

  it('ist als Information gestaltet, nicht als Fehler', () => {
    // Wolken-Symbol, kein Warndreieck.
    expect(platzhalter).toContain('cloudOfflineOutline');
    expect(platzhalter).not.toContain('alertCircle');
  });

  it('blendet das Symbol fuer Screenreader aus — der Text spricht', () => {
    expect(platzhalter).toContain('aria-hidden="true"');
  });
});
