// Der voreingestellte Anmeldeschluss liegt nie in der Vergangenheit
// (Befund Simon, 17.09.2026)
//
// SIMONS BEFUND: "wenn Termin Anmeldung zu sofort muss das Endstadium in der
// Zukunft liegen. Tut es gerade nicht."
//
// DER FEHLER: Das Terminformular setzte den Anmeldeschluss beim Neuanlegen
// fest auf "24 Stunden vor Beginn". Bei jedem Termin, der in weniger als
// 24 Stunden beginnt, lag er damit in der Vergangenheit — und der Termin war
// in der Sekunde seiner Entstehung geschlossen (registration_status
// 'closed'), ohne dass irgendwo eine Warnung stand.
//
// Schlimmer noch der Zustand direkt beim OEFFNEN des Formulars: Der
// voreingestellte Beginn ist "jetzt + 30 Minuten", der Schluss stand auf
// "Beginn - 1 Stunde" — also eine halbe Stunde VOR dem Aufmachen des
// Formulars. Wer nur einen Namen eintrug und speicherte, bekam einen Termin,
// zu dem sich niemand anmelden kann.
//
// Geprueft wird die Funktion, die den Vorschlag rechnet, mit fest
// vorgegebenem "jetzt" — nicht die echte Uhr. Sonst waere der Test von der
// Laufzeit abhaengig.

import { describe, it, expect } from 'vitest';
import { anmeldeschlussVorschlag } from '../../components/admin/modals/EventModal';

const JETZT = new Date('2026-09-17T14:00:00');
const stunden = (h: number) => new Date(JETZT.getTime() + h * 60 * 60 * 1000);
const minuten = (m: number) => new Date(JETZT.getTime() + m * 60 * 1000);

describe('anmeldeschlussVorschlag: der Vorschlag liegt nie in der Vergangenheit', () => {
  it('Simons Fall: Termin in 3 Stunden — der Schluss liegt NACH jetzt (vorher: gestern)', () => {
    const vorschlag = anmeldeschlussVorschlag(stunden(3), JETZT);
    expect(vorschlag.getTime()).toBeGreaterThan(JETZT.getTime());
  });

  it('und der Schluss liegt trotzdem VOR dem Beginn — sonst waere er keiner', () => {
    const beginn = stunden(3);
    const vorschlag = anmeldeschlussVorschlag(beginn, JETZT);
    expect(vorschlag.getTime()).toBeLessThan(beginn.getTime());
  });

  it('bei 3 Stunden Vorlauf liegt er genau in der Mitte: 15:30 Uhr', () => {
    // Konkreter Wert statt "irgendwo dazwischen" — die Haelfte von drei
    // Stunden ist anderthalb Stunden.
    const vorschlag = anmeldeschlussVorschlag(stunden(3), JETZT);
    expect(vorschlag.toISOString()).toBe(new Date('2026-09-17T15:30:00').toISOString());
  });

  it('der Zustand beim OEFFNEN des Formulars: Beginn jetzt+30min ergibt Schluss jetzt+15min', () => {
    // Vorher: Beginn - 1 Stunde = jetzt - 30 Minuten. Der Termin war zu,
    // bevor jemand den Namen getippt hatte.
    const vorschlag = anmeldeschlussVorschlag(minuten(30), JETZT);
    expect(vorschlag.toISOString()).toBe(new Date('2026-09-17T14:15:00').toISOString());
    expect(vorschlag.getTime()).toBeGreaterThan(JETZT.getTime());
  });

  it('bei genuegend Vorlauf bleiben es die gewohnten 24 Stunden vor Beginn', () => {
    // Die Voreinstellung aendert sich NUR dort, wo sie nicht funktioniert.
    const beginn = stunden(24 * 7);
    const vorschlag = anmeldeschlussVorschlag(beginn, JETZT);
    expect(vorschlag.toISOString()).toBe(
      new Date(beginn.getTime() - 24 * 60 * 60 * 1000).toISOString()
    );
  });

  it('bei genau 24 Stunden Vorlauf faellt der Schluss auf jetzt — und rueckt deshalb nach vorn', () => {
    // Grenzfall: 24 Stunden davor waere exakt "jetzt". Das ist kein offenes
    // Fenster, also greift die Haelfte-Regel.
    const vorschlag = anmeldeschlussVorschlag(stunden(24), JETZT);
    expect(vorschlag.toISOString()).toBe(new Date('2026-09-18T02:00:00').toISOString());
  });

  it('bei sehr kurzem Vorlauf (5 Minuten) gilt der Beginn selbst als Schluss', () => {
    const beginn = minuten(5);
    const vorschlag = anmeldeschlussVorschlag(beginn, JETZT);
    expect(vorschlag.toISOString()).toBe(beginn.toISOString());
  });

  it('ein nachgetragener Termin in der Vergangenheit behaelt den Schluss davor', () => {
    // Wer einen Termin von letzter Woche eintraegt, soll auch einen Schluss
    // von letzter Woche bekommen — das Backend laesst diesen Fall zu.
    const beginn = stunden(-48);
    const vorschlag = anmeldeschlussVorschlag(beginn, JETZT);
    expect(vorschlag.toISOString()).toBe(
      new Date(beginn.getTime() - 24 * 60 * 60 * 1000).toISOString()
    );
    expect(vorschlag.getTime()).toBeLessThan(beginn.getTime());
  });

  it('ueber eine ganze Reihe von Vorlaufzeiten gilt immer: jetzt <= Schluss <= Beginn', () => {
    for (const vorlaufMinuten of [1, 5, 9, 10, 11, 30, 60, 180, 600, 1439, 1440, 1441, 4320]) {
      const beginn = minuten(vorlaufMinuten);
      const vorschlag = anmeldeschlussVorschlag(beginn, JETZT);
      expect(vorschlag.getTime()).toBeGreaterThanOrEqual(JETZT.getTime());
      expect(vorschlag.getTime()).toBeLessThanOrEqual(beginn.getTime());
    }
  });
});
