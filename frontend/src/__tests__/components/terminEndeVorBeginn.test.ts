// Ende vor Beginn wird im Termin-Formular abgewiesen (Audit 26.09.2026, Leitung BF-03)
//
// DER BEFUND: Das Formular pruefte Name, Datum und Pflicht-ohne-Jahrgang, aber
// nie, ob das Ende nach dem Beginn liegt. Der Ende-Picker hatte kein `min`.
// Wer beim Ende versehentlich einen frueheren Tag waehlte, speicherte ohne
// Warnung; die Leitungsliste sortierte den Termin sofort unter "Vergangen".
//
// Geprueft wird die Regel selbst (endeVorBeginn, dieselbe wie im Backend) und
// dass das Formular sie benutzt: am Ende-Picker als `min`, beim Speichern als
// Meldung "Das Ende liegt vor dem Beginn".

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { endeVorBeginn, ENDE_VOR_BEGINN } from '../../utils/terminVorbelegung';

describe('endeVorBeginn: die Regel', () => {
  it('Ende einen Tag vor dem Beginn ist ein Widerspruch', () => {
    expect(endeVorBeginn('2026-10-10T18:00:00', '2026-10-09T20:00:00')).toBe(true);
  });

  it('auch eine Viertelstunde zu frueh', () => {
    expect(endeVorBeginn('2026-10-10T18:00:00', '2026-10-10T17:45:00')).toBe(true);
  });

  it('Ende nach dem Beginn ist in Ordnung', () => {
    expect(endeVorBeginn('2026-10-10T18:00:00', '2026-10-10T20:00:00')).toBe(false);
  });

  it('Ende genau auf dem Beginn ist erlaubt', () => {
    expect(endeVorBeginn('2026-10-10T18:00:00', '2026-10-10T18:00:00')).toBe(false);
  });

  it('kein Ende ist erlaubt', () => {
    expect(endeVorBeginn('2026-10-10T18:00:00', '')).toBe(false);
  });

  it('ein unlesbarer Wert ist nicht Sache dieser Pruefung', () => {
    expect(endeVorBeginn('2026-10-10T18:00:00', 'kein Datum')).toBe(false);
  });

  it('die Meldung ist wortgleich mit dem Backend', () => {
    expect(ENDE_VOR_BEGINN).toBe('Das Ende liegt vor dem Beginn');
  });
});

describe('Das Termin-Formular benutzt die Regel', () => {
  const ohneKommentare = (text: string) =>
    text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const modal = ohneKommentare(
    readFileSync(resolve(process.cwd(), 'src/components/admin/modals/EventModal.tsx'), 'utf8')
  );

  it('der Ende-Picker beginnt beim Beginn (min)', () => {
    const start = modal.indexOf('id="end-time-picker"');
    expect(start).toBeGreaterThan(-1);
    const picker = modal.slice(start, modal.indexOf('/>', start));
    expect(picker).toContain('min={formData.event_date || undefined}');
  });

  it('Speichern bricht mit der Meldung ab, bevor etwas gesendet wird', () => {
    const pruefung = modal.indexOf('endeVorBeginn(formData.event_date, formData.event_end_time)');
    const senden = modal.indexOf("api.post('/events'");
    expect(pruefung).toBeGreaterThan(-1);
    expect(senden).toBeGreaterThan(-1);
    expect(pruefung).toBeLessThan(senden);
    expect(modal.slice(pruefung, pruefung + 120)).toContain('setError(ENDE_VOR_BEGINN)');
  });
});
