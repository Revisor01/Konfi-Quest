// Was die Seite einer Challenge in der Web-Fassung zeigt, solange sie keine
// Challenge zeigen kann -- sie laedt noch, es gibt sie nicht mehr, sie
// gehoert zu einem anderen Jahrgang, ohne Netz, Serverfehler. Dieselben
// Worte wie in der App (challengeHinweisTexte), mit dem Weg zurueck zur
// Liste.
//
// NUR DER INHALT, ohne Rahmen: Die Seite einer Challenge haelt EINEN
// WebChallengeRahmen fuer alle Zustaende. Ein Rahmen, der beim Wechsel von
// "laedt" zur Challenge ab- und neu aufgebaut wuerde, liesse Ionics
// IonContent mitten im Messen verschwinden (TypeError in readDimensions).

import React from 'react';
import WebKnopf from '../../../web/WebKnopf';
import { WebLaden, WebLeer } from '../../../web/WebZustaende';
import { HINWEIS_TEXTE, type ChallengeHinweisArt } from '../../challengeHinweisTexte';

export interface WebChallengeHinweisProps {
  art: ChallengeHinweisArt;
  /** Zurueck zur Liste -- mit Verlauf zurueck, ohne (nach einem Push) auf die Liste. */
  onBack: () => void;
  /** Bei 'offline' und 'fehler': neu laden. */
  onNochmal?: () => void;
}

const WebChallengeHinweis: React.FC<WebChallengeHinweisProps> = ({ art, onBack, onNochmal }) => {
  if (art === 'laedt') return <WebLaden karten={2} text="Challenge wird geladen..." />;
  const daten = HINWEIS_TEXTE[art];
  return (
    <div className="web-karte">
      <WebLeer
        icon={daten.icon}
        titel={daten.titel}
        text={daten.text}
        aktion={(
          <div className="web-formular__knoepfe">
            {onNochmal && (art === 'offline' || art === 'fehler') && <WebKnopf onClick={onNochmal}>Erneut versuchen</WebKnopf>}
            <WebKnopf art="primaer" onClick={onBack}>Zu den Challenges</WebKnopf>
          </div>
        )}
      />
    </div>
  );
};

export default WebChallengeHinweis;
