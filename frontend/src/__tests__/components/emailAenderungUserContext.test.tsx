// Gerüst zuerst: es registriert die Attrappen, bevor die Seiten geladen werden.
import {
  api, setUser, tokenStoreSetUser, refresh, onReload, zuruecksetzen, profilOeffnen, emailGespeichert,
  type Rolle,
} from './gerueste/profileDreiRollen';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Befund M9 (27.08.2026): Nach einer E-Mail-Aenderung aktualisierten das
// Teamer- und das Leitungs-Profil den User-Context und den TokenStore, das
// Konfi-Profil nicht. Dort lief nur onReload(), das ausschliesslich die
// Profildaten der Seite neu holt. Folge: Der Context (und damit die im
// TokenStore gespeicherte Kopie) trug die ALTE Adresse weiter, bis man sich
// abmeldete -- wieder der Drei-Ansichten-Fall, geteilte Stelle nur in zwei
// von drei Baeumen nachgezogen.
//
// Seit dem 09.10.2026 gerendert (vorher Quelltext): Das echte Profil meldet
// sein E-Mail-Modal an; der Test loest dessen Erfolgs-Rueckruf aus, wie es
// das Modal nach dem Speichern tut, und sieht nach, was danach im Context
// und im TokenStore steht.

beforeEach(zuruecksetzen);
afterEach(() => cleanup());

const erwarteNeueAdresseUeberall = () => {
  expect(api.get).toHaveBeenCalledWith('/auth/me');
  expect(setUser).toHaveBeenCalledTimes(1);
  expect(setUser.mock.calls[0][0]).toMatchObject({ email: 'neu@example.org' });
  expect(tokenStoreSetUser).toHaveBeenCalledTimes(1);
  expect((tokenStoreSetUser.mock.calls[0] as unknown[])[0]).toEqual(setUser.mock.calls[0][0]);
};

describe('E-Mail-Aenderung aktualisiert den User-Context', () => {
  describe('Konfi-Profil (Befund M9)', () => {
    it('holt die neue Adresse nach dem Speichern vom Server', async () => {
      await profilOeffnen('konfi');
      api.get.mockClear();
      await emailGespeichert();
      expect(api.get.mock.calls.map(([p]) => p)).toContain('/auth/me');
    });

    it('schreibt sie in den User-Context -- der Rest des Nutzers bleibt', async () => {
      await profilOeffnen('konfi');
      await emailGespeichert();
      expect(setUser).toHaveBeenCalledTimes(1);
      expect(setUser.mock.calls[0][0]).toEqual({
        id: 7, type: 'konfi', role_name: 'konfi', organization_id: 1, display_name: 'Emilia Test', email: 'neu@example.org',
      });
    });

    it('schreibt sie auch in den TokenStore', async () => {
      // Ohne diesen Schritt waere die Adresse nach einem Neustart der App
      // wieder die alte -- der Context wird daraus aufgebaut.
      await profilOeffnen('konfi');
      await emailGespeichert();
      expect(tokenStoreSetUser).toHaveBeenCalledTimes(1);
      expect((tokenStoreSetUser.mock.calls[0] as unknown[])[0]).toMatchObject({ id: 7, email: 'neu@example.org' });
    });

    it('laedt zusaetzlich die Profildaten der Seite neu', async () => {
      // Gegenprobe: Der bisherige onReload() darf nicht verloren gegangen
      // sein, sonst zeigte die Seite selbst die alte Adresse weiter an.
      await profilOeffnen('konfi');
      await emailGespeichert();
      expect(onReload).toHaveBeenCalledTimes(1);
    });
  });

  // Gegenprobe: Diese beiden Baeume waren schon vorher richtig und muessen es
  // bleiben. Faellt einer davon heraus, ist es derselbe Befund in die andere
  // Richtung.
  describe('Teamer- und Leitungs-Profil bleiben richtig', () => {
    it.each<[string, Rolle]>([
      ['das Teamer-Profil', 'teamer'],
      ['das Leitungs-Profil', 'admin'],
    ])('%s aktualisiert Context und TokenStore und laedt die Seite neu', async (_name, rolle) => {
      await profilOeffnen(rolle);
      api.get.mockClear();
      refresh.mockClear();
      await emailGespeichert();
      erwarteNeueAdresseUeberall();
      expect(refresh).toHaveBeenCalledTimes(1);
    });
  });

  it('scheitert die Abfrage, bleibt der Context unangetastet', async () => {
    await profilOeffnen('konfi');
    api.get.mockRejectedValueOnce(new Error('weg'));
    await emailGespeichert();
    expect(setUser).not.toHaveBeenCalled();
    expect(tokenStoreSetUser).not.toHaveBeenCalled();
    expect(onReload).toHaveBeenCalledTimes(1);
  });
});
