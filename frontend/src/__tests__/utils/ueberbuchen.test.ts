/**
 * Wartende bestaetigen: bei vollem Event erst nachfragen, dann ueberbuchen
 * (Simon, 28.09.2026, Variante c).
 *
 * Der Server lehnt das Bestaetigen einer Wartenden bei vollem Event mit 400
 * und error_code 'event_voll' ab und nimmt es mit `ueberbuchen: true` an
 * (backend/tests/routes/bestaetigenUeberbuchen.test.js). Bis hierher zeigte
 * die App nur "Fehler beim Bestätigen des Teilnehmers" -- ohne Grund und ohne
 * Ausweg. Dieser Test haelt den Ablauf fest: senden, bei "voll" fragen, nach
 * dem Ja mit Flag erneut senden; jeder andere Fehler geht unveraendert weiter.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bestaetigenMitRueckfrage, eintragenMitRueckfrage, istEventVoll, ueberbuchenFrage } from '../../utils/ueberbuchen';

const vollFehler = (max = 1, belegt = 1, seite?: 'konfi' | 'team') => Object.assign(new Error('Request failed with status code 400'), {
  response: {
    status: 400,
    data: {
      error: 'Das Event ist voll. Erhöhe die Teilnehmerzahl, um weitere Plätze zu vergeben.',
      error_code: 'event_voll', max, belegt, ...(seite ? { seite } : {})
    }
  }
});

describe('istEventVoll', () => {
  it('erkennt die Antwort am error_code', () => {
    expect(istEventVoll({ error_code: 'event_voll' })).toBe(true);
  });
  it('alles andere ist nicht "voll"', () => {
    expect(istEventVoll(undefined)).toBe(false);
    expect(istEventVoll({ error: 'Das Event ist voll. Erhöhe die Teilnehmerzahl, um weitere Plätze zu vergeben.' })).toBe(false);
    expect(istEventVoll({ error_code: 'status_ungueltig' })).toBe(false);
  });
});

describe('ueberbuchenFrage', () => {
  it('nennt Person, Plaetze und die Folge', () => {
    expect(ueberbuchenFrage('Mia', { max: 12, belegt: 12 })).toEqual({
      header: 'Das Event ist voll',
      message: 'Alle 12 Plätze sind vergeben. Mia trotzdem bestätigen? Das Event ist dann überbucht.'
    });
  });
  it('sagt, wenn schon ueberbucht ist', () => {
    expect(ueberbuchenFrage('Mia', { max: 12, belegt: 13 }).message)
      .toBe('Alle 12 Plätze sind vergeben, 13 sind bestätigt. Mia trotzdem bestätigen? Das Event ist dann überbucht.');
  });
  it('kommt ohne Zahlen und ohne Namen aus', () => {
    expect(ueberbuchenFrage(undefined, {}).message)
      .toBe('Alle Plätze sind vergeben. Diese Person trotzdem bestätigen? Das Event ist dann überbucht.');
  });
});

describe('ueberbuchenFrage: Team-Plaetze und Eintragen', () => {
  it('nennt die Team-Plaetze, wenn das Team voll ist', () => {
    expect(ueberbuchenFrage('Jonas', { max: 2, belegt: 2, seite: 'team' })).toEqual({
      header: 'Die Team-Plätze sind voll',
      message: 'Alle 2 Team-Plätze sind vergeben. Jonas trotzdem bestätigen? Das Event ist dann überbucht.'
    });
  });
  it('sagt "eintragen" beim Hinzufuegen von Hand', () => {
    expect(ueberbuchenFrage('Mia', { max: 12, belegt: 12, seite: 'konfi' }, 'eintragen').message)
      .toBe('Alle 12 Plätze sind vergeben. Mia trotzdem eintragen? Das Event ist dann überbucht.');
  });
});

describe('bestaetigenMitRueckfrage', () => {
  it('Platz frei: einmal senden, ohne Flag, ohne Rueckfrage', async () => {
    const senden = vi.fn().mockResolvedValue(undefined);
    const fragen = vi.fn();

    expect(await bestaetigenMitRueckfrage(senden, fragen, 'Mia')).toBe('bestaetigt');
    expect(senden.mock.calls).toEqual([[false]]);
    expect(fragen).not.toHaveBeenCalled();
  });

  it('voll und Ja: fragt mit Zahlen und sendet dann mit Flag', async () => {
    const senden = vi.fn().mockRejectedValueOnce(vollFehler(12, 12)).mockResolvedValueOnce(undefined);
    const fragen = vi.fn().mockResolvedValue(true);

    expect(await bestaetigenMitRueckfrage(senden, fragen, 'Mia')).toBe('ueberbucht');
    expect(fragen).toHaveBeenCalledWith({
      header: 'Das Event ist voll',
      message: 'Alle 12 Plätze sind vergeben. Mia trotzdem bestätigen? Das Event ist dann überbucht.'
    });
    expect(senden.mock.calls).toEqual([[false], [true]]);
  });

  it('voll und Abbrechen: kein zweiter Versuch', async () => {
    const senden = vi.fn().mockRejectedValueOnce(vollFehler());
    const fragen = vi.fn().mockResolvedValue(false);

    expect(await bestaetigenMitRueckfrage(senden, fragen, 'Mia')).toBe('abgebrochen');
    expect(senden.mock.calls).toEqual([[false]]);
  });

  it('jeder andere Fehler geht unveraendert weiter, ohne Rueckfrage', async () => {
    const anderer = Object.assign(new Error('x'), { response: { status: 400, data: { error: 'Dieses Event ist abgesagt' } } });
    const senden = vi.fn().mockRejectedValue(anderer);
    const fragen = vi.fn();

    await expect(bestaetigenMitRueckfrage(senden, fragen, 'Mia')).rejects.toBe(anderer);
    expect(fragen).not.toHaveBeenCalled();
    expect(senden).toHaveBeenCalledTimes(1);
  });

  it('scheitert der zweite Versuch, geht dessen Fehler weiter', async () => {
    const zweiter = Object.assign(new Error('y'), { response: { status: 500, data: { error: 'Datenbankfehler' } } });
    const senden = vi.fn().mockRejectedValueOnce(vollFehler()).mockRejectedValueOnce(zweiter);

    await expect(bestaetigenMitRueckfrage(senden, vi.fn().mockResolvedValue(true), 'Mia')).rejects.toBe(zweiter);
  });
});

type Person = { id: number; name: string; seite: 'konfi' | 'team' };
const beschreibe = (p: Person) => ({ name: p.name, seite: p.seite });
const mia: Person = { id: 1, name: 'Mia', seite: 'konfi' };
const ben: Person = { id: 2, name: 'Ben', seite: 'konfi' };
const ida: Person = { id: 3, name: 'Ida', seite: 'konfi' };
const jonas: Person = { id: 4, name: 'Jonas', seite: 'team' };

describe('eintragenMitRueckfrage: von Hand eintragen, eine Rueckfrage je Kontingent', () => {
  it('Platz fuer alle: jede Person einmal, ohne Flag, ohne Rueckfrage', async () => {
    const senden = vi.fn().mockResolvedValue(undefined);
    const fragen = vi.fn();

    const ergebnis = await eintragenMitRueckfrage([mia, ben], senden, fragen, beschreibe);

    expect(ergebnis).toEqual({ eingetragen: [mia, ben], offen: [] });
    expect(senden.mock.calls).toEqual([[mia, false], [ben, false]]);
    expect(fragen).not.toHaveBeenCalled();
  });

  it('voll ab der zweiten: fragt einmal fuer die uebrigen und traegt sie mit Flag ein', async () => {
    const senden = vi.fn()
      .mockResolvedValueOnce(undefined) // Mia: letzter Platz
      .mockRejectedValueOnce(vollFehler(12, 12, 'konfi')) // Ben: voll
      .mockResolvedValue(undefined);
    const fragen = vi.fn().mockResolvedValue(true);

    const ergebnis = await eintragenMitRueckfrage([mia, ben, ida], senden, fragen, beschreibe);

    expect(ergebnis).toEqual({ eingetragen: [mia, ben, ida], offen: [] });
    expect(fragen).toHaveBeenCalledTimes(1);
    expect(fragen).toHaveBeenCalledWith({
      header: 'Das Event ist voll',
      message: 'Alle 12 Plätze sind vergeben. Die übrigen 2 trotzdem eintragen? Das Event ist dann überbucht.'
    });
    expect(senden.mock.calls).toEqual([[mia, false], [ben, false], [ben, true], [ida, true]]);
  });

  it('schon voll bei der ersten von mehreren: "Die 2 Ausgewählten"', async () => {
    const senden = vi.fn().mockRejectedValueOnce(vollFehler(12, 12, 'konfi')).mockResolvedValue(undefined);
    const fragen = vi.fn().mockResolvedValue(true);

    await eintragenMitRueckfrage([mia, ben], senden, fragen, beschreibe);

    expect(fragen.mock.calls[0][0].message)
      .toBe('Alle 12 Plätze sind vergeben. Die 2 Ausgewählten trotzdem eintragen? Das Event ist dann überbucht.');
  });

  it('eine einzelne Person wird mit Namen gefragt', async () => {
    const senden = vi.fn().mockRejectedValueOnce(vollFehler(2, 2, 'team')).mockResolvedValue(undefined);
    const fragen = vi.fn().mockResolvedValue(true);

    await eintragenMitRueckfrage([jonas], senden, fragen, beschreibe);

    expect(fragen).toHaveBeenCalledWith({
      header: 'Die Team-Plätze sind voll',
      message: 'Alle 2 Team-Plätze sind vergeben. Jonas trotzdem eintragen? Das Event ist dann überbucht.'
    });
  });

  it('das Ja fuer die Konfis gilt nicht fuer das Team: dort wird eigens gefragt', async () => {
    const senden = vi.fn()
      .mockRejectedValueOnce(vollFehler(1, 1, 'konfi')) // Mia
      .mockResolvedValueOnce(undefined)                 // Mia mit Flag
      .mockRejectedValueOnce(vollFehler(1, 1, 'team'))  // Jonas
      .mockResolvedValueOnce(undefined);                // Jonas mit Flag
    const fragen = vi.fn().mockResolvedValue(true);

    const ergebnis = await eintragenMitRueckfrage([mia, jonas], senden, fragen, beschreibe);

    expect(ergebnis.eingetragen).toEqual([mia, jonas]);
    expect(fragen).toHaveBeenCalledTimes(2);
    expect(senden.mock.calls).toEqual([[mia, false], [mia, true], [jonas, false], [jonas, true]]);
  });

  it('Abbrechen: wer schon drin ist, bleibt; der Rest bleibt offen', async () => {
    const senden = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(vollFehler(1, 1, 'konfi'));
    const fragen = vi.fn().mockResolvedValue(false);

    const ergebnis = await eintragenMitRueckfrage([mia, ben, ida], senden, fragen, beschreibe);

    expect(ergebnis).toEqual({ eingetragen: [mia], offen: [ben, ida], abgebrochen: true });
    expect(senden).toHaveBeenCalledTimes(2);
  });

  it('ein anderer Fehler endet den Durchlauf und kommt mit zurueck', async () => {
    const anderer = Object.assign(new Error('x'), { response: { status: 403, data: { error: 'Ben gehört zu keinem Jahrgang dieses Events' } } });
    const senden = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(anderer);
    const fragen = vi.fn();

    const ergebnis = await eintragenMitRueckfrage([mia, ben, ida], senden, fragen, beschreibe);

    expect(ergebnis).toEqual({ eingetragen: [mia], offen: [ben, ida], fehler: anderer });
    expect(fragen).not.toHaveBeenCalled();
  });
});

describe('Das Hinzufuegen von Hand nutzt den Ablauf', () => {
  const quelle = readFileSync(
    resolve(__dirname, '../../components/admin/modals/ParticipantManagementModal.tsx'), 'utf8'
  );

  it('traegt ueber eintragenMitRueckfrage ein und schickt ueberbuchen immer ausdruecklich mit', () => {
    expect(quelle).toContain('eintragenMitRueckfrage(');
    expect(quelle).toMatch(/ueberbuchen\s*\}/);
    expect(quelle).not.toMatch(/for \(const konfiId of selectedKonfis\)/);
  });
});

describe('Die Detailansicht der Leitung nutzt den Ablauf', () => {
  const quelle = readFileSync(
    resolve(__dirname, '../../components/admin/views/EventDetailView.tsx'), 'utf8'
  );

  it('bestaetigt Wartende ueber bestaetigenMitRueckfrage und schickt das Flag nur von dort', () => {
    expect(quelle).toContain('bestaetigenMitRueckfrage(');
    expect(quelle).toMatch(/ueberbuchen \? \{ status: 'confirmed', ueberbuchen: true \} : \{ status: 'confirmed' \}/);
  });

  it('zeigt bei anderen Fehlern den Grund vom Server statt nur den festen Text', () => {
    expect(quelle).not.toContain("setError('Fehler beim Bestätigen des Teilnehmers')");
    expect(quelle).toContain("fehlerText(error, 'Fehler beim Bestätigen des Teilnehmers')");
  });
});
