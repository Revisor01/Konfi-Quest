// Quelltext ohne Kommentare -- fuer die Waechter-Tests, die bewusst Quelltext
// lesen (Abwesenheit, "steht nur an einer Stelle"). Ohne ihn schlaegt eine
// Pruefung an einer Zeichenkette an, die nur in einer Erklaerung steht -- im
// Repo dreimal passiert.
//
// Lag bis 09.10.2026 in components/abgesagteTermineAnsichten.test.ts. Seit
// die Datei rendert, steht der Helfer hier: Ein Import aus einer Testdatei
// liesse Vitest deren Suite -- samt Attrappen -- ein zweites Mal registrieren.

/**
 * Entfernt Zeilen- und Blockkommentare sowie JSX-Kommentare aus dem Quelltext.
 * Zeichenketten bleiben stehen -- sie sind Code, und ein Text wie
 * "Kein Grund zur Absage angegeben." ist genau das, was geprueft werden soll.
 */
export const ohneKommentare = (quelltext: string): string =>
  quelltext
    // /* ... */ und damit auch die JSX-Form {/* ... */}
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // // ... bis Zeilenende. Das Muster verlangt Zeilenanfang oder ein
    // Zeichen davor, das kein ':' oder '/' ist -- sonst zerschnitte es
    // "https://..." in einer Zeichenkette.
    .replace(/(^|[^:/])\/\/[^\n]*/g, '$1');
