// Was die Seite einer Challenge in der Web-Fassung zeigt, solange sie keine
// Challenge zeigen kann -- sie laedt noch, es gibt sie nicht mehr, sie
// gehoert zu einem anderen Jahrgang, ohne Netz, Serverfehler: als Zustand
// der Detailseite (WebDetailSeite `laden` bzw. `leer`), unter demselben Kopf
// wie die Challenge. Dieselben Worte wie in der App (challengeHinweisTexte),
// mit dem Weg zurueck zur Liste. Bis 10.10.2026 stand das in
// WebChallengeHinweis, im eigenen Rahmen WebChallengeRahmen.

import React from 'react';
import WebKnopf from '../../../web/WebKnopf';
import type { WebDetailSeiteProps } from '../../../web/WebDetailSeite';
import { HINWEIS_TEXTE, type ChallengeHinweisArt } from '../../challengeHinweisTexte';

export function challengeZustand(
  art: ChallengeHinweisArt,
  /** Zurueck zur Liste -- mit Verlauf zurueck, ohne (nach einem Push) auf die Liste. */
  onBack: () => void,
  /** Bei 'offline' und 'fehler': neu laden. */
  onNochmal?: () => void,
): Pick<WebDetailSeiteProps, 'laden' | 'leer'> {
  if (art === 'laedt') return { laden: 'Challenge wird geladen...' };
  const daten = HINWEIS_TEXTE[art];
  return {
    leer: {
      icon: daten.icon,
      titel: daten.titel,
      text: daten.text,
      aktion: (
        <div className="web-formular__knoepfe">
          {onNochmal && (art === 'offline' || art === 'fehler') && <WebKnopf onClick={onNochmal}>Erneut versuchen</WebKnopf>}
          <WebKnopf art="primaer" onClick={onBack}>Zu den Challenges</WebKnopf>
        </div>
      ),
    },
  };
}
