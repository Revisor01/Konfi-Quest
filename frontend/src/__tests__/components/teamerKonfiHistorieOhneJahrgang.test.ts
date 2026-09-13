import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Der Einstieg "Konfi-Historie" im Teamer-Profil (Befund 7.2, 12.09.2026).
//
// Er hing an `profile.konfi_data?.jahrgang_name`. Wird der Jahrgang einer
// frueheren Konfizeit geloescht, liefert das Backend konfi_data WEITER — nur
// jahrgang_name ist dann leer (teamer.js: `konfiProfile?.jahrgang_name || ''`).
// Der Einstieg verschwand damit, obwohl Punkte und Abzeichen aus dieser Zeit
// unveraendert dahinter liegen.
//
// Das Backend macht es an derselben Stelle ausdruecklich richtig und warnt im
// Kommentar davor, sich auf den Namen zu verlassen: "NICHT am jahrgang_name
// festmachen: wird der alte Jahrgang geloescht, ist jahrgang_id=NULL ->
// jahrgang_name=NULL, aber die WERTE (Punkte/Badges) bleiben und muessen weiter
// sichtbar sein."
//
// Geprueft wird der Quelltext: Die Bedingung haengt an einer API-Antwort, die
// ein Rendering-Test nachbauen muesste — dann prueft er die Attrappe, nicht die
// Bedingung.

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

const seite = lies('src/components/teamer/pages/TeamerProfilePage.tsx');
const backend = lies('../backend/routes/teamer.js');

describe('Konfi-Historie haengt an den Daten, nicht am Jahrgangsnamen', () => {
  it('zeigt den Einstieg, sobald es eine Konfi-Vergangenheit gibt', () => {
    expect(seite).toContain('{profile.konfi_data && (');
  });

  it('macht den Einstieg NICHT vom Jahrgangsnamen abhaengig', () => {
    // Die Gegenprobe: Genau diese Bedingung war der Fehler.
    expect(seite).not.toContain('profile.konfi_data?.jahrgang_name && (');
  });

  it('behandelt den Jahrgangsnamen als optional', () => {
    // Er ist leer, wenn der Jahrgang geloescht wurde — der Typ muss das sagen,
    // sonst verlaesst sich die naechste Aenderung wieder darauf.
    expect(seite).toContain('jahrgang_name?: string;');
  });
});

describe('Das Backend liefert die Historie unabhaengig vom Jahrgang', () => {
  it('entscheidet ueber das Vorhandensein des Konfi-Profils', () => {
    // Die Quelle der Wahrheit, an der das Frontend jetzt haengt.
    expect(backend).toContain('const isPromotedKonfi = !!konfiProfile;');
    expect(backend).toContain('konfi_data: isPromotedKonfi ? {');
  });

  it('liefert einen leeren Namen statt konfi_data wegzulassen', () => {
    // Der Fall, den der Einstieg vorher nicht ueberlebte.
    expect(backend).toContain("jahrgang_name: konfiProfile?.jahrgang_name || ''");
  });

  it('gibt reinen Teamer:innen ohne Konfi-Vergangenheit null', () => {
    // Fuer sie soll der Einstieg weiterhin fehlen — er fuehrte ins Leere.
    expect(backend).toContain('} : null');
  });
});
