/**
 * Großschreibung im Chat-Eingabefeld — nach jedem Tastendruck mit dem ganzen
 * Text aufgerufen; geprüft wird nur das zuletzt getippte Zeichen.
 *
 * Regel (Simon, 27.09.2026, Variante A):
 *   - Textanfang → groß. Leerraum davor (Umbrüche, Leerzeichen) zählt noch
 *     als Textanfang.
 *   - Nach . ! oder ? plus mindestens einem Leerraum (auch Umbrüche) → groß.
 *   - Ein oder mehrere Umbrüche OHNE Satzzeichen davor → unverändert.
 *     Bis zum 27.09.2026 zählte jeder Umbruch als Satzende
 *     („asjjkdfss,⏎x" wurde zu „asjjkdfss,⏎X").
 *   - Nur Kleinbuchstaben (auch ä, ö, ü) werden hochgestellt; alles andere
 *     bleibt, wie es ist.
 *
 * Die Handy-Tastatur kann über autocapitalize="sentences" selbst
 * großschreiben; das liegt beim Betriebssystem, nicht hier.
 */
export const autoCapitalize = (value: string): string => {
  if (!value) return '';

  const newChar = value.slice(-1);
  if (newChar === newChar.toUpperCase() || !/[a-zäöü]/.test(newChar)) {
    return value;
  }

  const before = value.slice(0, -1);
  const atStart = before.trim().length === 0;
  const afterSentenceEnd = /[.!?]\s+$/.test(before);

  if (atStart || afterSentenceEnd) {
    return before + newChar.toUpperCase();
  }

  return value;
};
