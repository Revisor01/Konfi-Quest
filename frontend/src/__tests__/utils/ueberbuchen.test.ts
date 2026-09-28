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
import { bestaetigenMitRueckfrage, istEventVoll, ueberbuchenFrage } from '../../utils/ueberbuchen';

const vollFehler = (max = 1, belegt = 1) => Object.assign(new Error('Request failed with status code 400'), {
  response: {
    status: 400,
    data: {
      error: 'Das Event ist voll. Erhöhe die Teilnehmerzahl, um weitere Plätze zu vergeben.',
      error_code: 'event_voll', max, belegt
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
