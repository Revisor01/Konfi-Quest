import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Befund M9 (27.08.2026): Nach einer E-Mail-Aenderung aktualisierten das
// Teamer- und das Leitungs-Profil den User-Context und den TokenStore, das
// Konfi-Profil nicht. Dort lief nur onReload(), das ausschliesslich die
// Profildaten der Seite neu holt. Folge: Der Context (und damit die im
// TokenStore gespeicherte Kopie) trug die ALTE Adresse weiter, bis man sich
// abmeldete -- wieder der Drei-Ansichten-Fall, geteilte Stelle nur in zwei
// von drei Baeumen nachgezogen.
//
// Geprueft wird die Verdrahtung an der Quelldatei, wie bei den uebrigen
// Zaehler- und Kontext-Befunden: Das Modal haengt an useIonModal, Netzstatus
// und geladenen Profildaten -- das zu rendern fuehrte mehr Annahmen ein, als
// der Test absichert.

const lies = (pfad: string) =>
  readFileSync(resolve(process.cwd(), pfad), 'utf8');

const konfiProfil = lies('src/components/konfi/views/ProfileView.tsx');
const teamerProfil = lies('src/components/teamer/pages/TeamerProfilePage.tsx');
const adminProfil = lies('src/components/admin/pages/AdminProfilePage.tsx');

// Schneidet den onSuccess-Zweig des ChangeEmailModal heraus, damit ein
// setUser an einer voellig anderen Stelle der Datei den Test nicht gruen
// faerbt.
const emailZweig = (quelle: string) => {
  const start = quelle.indexOf('presentEmailModal');
  expect(start).toBeGreaterThan(-1);
  const ende = quelle.indexOf('presentPasswordModal', start);
  return quelle.slice(start, ende > start ? ende : quelle.length);
};

describe('E-Mail-Aenderung aktualisiert den User-Context', () => {
  describe('Konfi-Profil (Befund M9)', () => {
    const zweig = emailZweig(konfiProfil);

    it('holt die neue Adresse nach dem Speichern vom Server', () => {
      expect(zweig).toContain("api.get('/auth/me')");
    });

    it('schreibt sie in den User-Context', () => {
      expect(zweig).toContain('setUser(updatedUser)');
    });

    it('schreibt sie auch in den TokenStore', () => {
      // Ohne diesen Schritt waere die Adresse nach einem Neustart der App
      // wieder die alte -- der Context wird daraus aufgebaut.
      expect(zweig).toContain('setTokenStoreUser(updatedUser)');
    });

    it('laedt zusaetzlich die Profildaten der Seite neu', () => {
      // Gegenprobe: Der bisherige onReload() darf nicht verloren gegangen
      // sein, sonst zeigte die Seite selbst die alte Adresse weiter an.
      expect(zweig).toContain('onReload()');
    });
  });

  // Gegenprobe: Diese beiden Baeume waren schon vorher richtig und muessen es
  // bleiben. Faellt einer davon heraus, ist es derselbe Befund in die andere
  // Richtung.
  describe('Teamer- und Leitungs-Profil bleiben richtig', () => {
    it('das Teamer-Profil aktualisiert Context und TokenStore', () => {
      const zweig = emailZweig(teamerProfil);
      expect(zweig).toContain("api.get('/auth/me')");
      expect(zweig).toContain('setUser(updatedUser)');
      expect(zweig).toContain('setTokenStoreUser(updatedUser)');
    });

    it('das Leitungs-Profil aktualisiert Context und TokenStore', () => {
      const zweig = emailZweig(adminProfil);
      expect(zweig).toContain("api.get('/auth/me')");
      expect(zweig).toContain('setUser(updatedUser)');
      expect(zweig).toContain('setTokenStoreUser(updatedUser)');
    });
  });
});
