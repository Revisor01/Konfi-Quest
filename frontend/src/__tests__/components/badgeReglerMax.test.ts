import { describe, it, expect } from 'vitest';
import { reglerMaximum as reglerMax } from '../../components/admin/useBadgeFormular';

// Der Wert-Regler im BadgeManagementModal war fest auf max={20} begrenzt,
// obwohl das Backend keine Obergrenze kennt (routes/badges.js: isInt({min:1}),
// kein max). In Produktion gibt es dadurch Abzeichen mit 25, 26 und 30
// (nachgemessen 25.08.2026, vier Organisationen).
//
// Ionic klemmt den Wert bei Nutzerinteraktion auf max herunter
// (range.js emitValueChange -> ensureValueInBounds). Aus "30 Punkte" waere
// beim ersten Anfassen des Reglers "20 Punkte" geworden — das Abzeichen ginge
// schlagartig an alle mit 20 Punkten, nicht rueckholbar (kein Entzug).
//
// Der Hoechstwert waechst deshalb mit dem geladenen Wert mit. Seit 11.10.2026
// prueft der Test die Funktion selbst (useBadgeFormular), die der Regler der
// App und das Zahlenfeld des Web-Dialogs lesen -- vorher eine Abschrift.

describe('Abzeichen: Hoechstwert des Wert-Reglers', () => {
  it('bleibt bei 20 fuer neue Abzeichen und Werte darunter', () => {
    expect(reglerMax(10)).toBe(20);
    expect(reglerMax(20)).toBe(20);
    expect(reglerMax(1)).toBe(20);
  });

  it('waechst mit, damit bestehende Werte nicht gekappt werden', () => {
    // Genau die Werte aus Produktion (Abzeichen 63/98/118/172, 51, 15/157/160)
    expect(reglerMax(25)).toBe(25);
    expect(reglerMax(26)).toBe(26);
    expect(reglerMax(30)).toBe(30);
  });

  it('faengt fehlende Werte ab, ohne unter 20 zu fallen', () => {
    expect(reglerMax(undefined)).toBe(20);
    expect(reglerMax(null)).toBe(20);
    expect(reglerMax(0)).toBe(20);
  });
});
