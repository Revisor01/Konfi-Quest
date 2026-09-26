import type { KeyboardEvent } from 'react';

/**
 * Enter im Feld löst die übergebene Aktion aus — die implizite Absendung,
 * die native <input>-Felder in einem <form> von sich aus haben.
 *
 * Ionic-Eingabefelder bekommen sie nicht: Das native <input> steckt im
 * Shadow-DOM von ion-input und gehört damit zu keinem <form> des Dokuments;
 * ion-input selbst behandelt Enter nicht (Ionic 9.0.3, ion-input.js: onKeydown
 * ruft nur checkClearOnEdit). Auf den Anmeldeseiten hieß das: Nach dem
 * Passwort zur Maus greifen (Audit 26.09.2026, UI BF-02).
 *
 * Während einer IME-Komposition (z. B. japanische Tastatur) bestätigt Enter
 * nur die Zeichenwahl — dann wird nichts abgeschickt.
 */
export const beiEnter = (aktion: () => void) => (ereignis: KeyboardEvent<HTMLElement>): void => {
  if (ereignis.key !== 'Enter' || ereignis.nativeEvent.isComposing) return;
  ereignis.preventDefault();
  aktion();
};
