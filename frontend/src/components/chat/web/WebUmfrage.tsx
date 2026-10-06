// Eine Umfrage in der Nachricht (Web-Fassung): die Frage, wann sie endet, die
// Antworten als Schaltflaechen mit Balken, Stimmenzahl und -- bei einer
// Umfrage mit Namen -- den Waehlenden. Was eine Antwort zaehlt und wer sie
// gewaehlt hat, rechnet chatNachricht.umfrageOptionen, dieselbe Funktion wie
// in der Blase der App; abgestimmt wird ueber useUmfragenUndReaktionen.

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_CHATS_GEFUELLT, ICON_DIAGRAMM, ICON_GRUPPE_GEFUELLT, ICON_HAKEN_GEFUELLT, ICON_UHRZEIT_GEFUELLT } from '../../shared/icons';
import type { Message } from '../../../types/chat';
import { umfrageAblauf, umfrageArt, umfrageOptionen } from '../chatNachricht';

export interface WebUmfrageProps {
  message: Message;
  user: { id: number; type: string } | null;
  onAbstimmen: (messageId: number, optionIndex: number) => void;
}

const WebUmfrage: React.FC<WebUmfrageProps> = ({ message, user, onAbstimmen }) => {
  const optionen = umfrageOptionen(message, user);
  const ablauf = umfrageAblauf(message.expires_at);
  const exklusiv = !!message.exclusive_options;
  const stimmen = message.votes?.length || 0;

  return (
    <div className="web-chat-umfrage" role="group" aria-label={`Umfrage: ${message.question}`}>
      <div className="web-chat-umfrage__frage">
        <span className="web-chat-umfrage__symbol" aria-hidden="true"><IonIcon icon={ICON_DIAGRAMM} /></span>
        <span>{message.question}</span>
      </div>

      {ablauf && (
        <div className={ablauf.beendet ? 'web-chat-umfrage__ablauf web-chat-umfrage__ablauf--beendet' : 'web-chat-umfrage__ablauf'}>
          <IonIcon icon={ICON_UHRZEIT_GEFUELLT} aria-hidden="true" />
          <span>{ablauf.text}</span>
        </div>
      )}

      <ul className="web-chat-umfrage__optionen">
        {optionen.map((opt) => (
          <li key={opt.index}>
            <button
              type="button"
              className={`web-chat-option${opt.gewaehlt ? ' web-chat-option--gewaehlt' : ''}${opt.vergebenAnAndere ? ' web-chat-option--vergeben' : ''}`}
              aria-pressed={opt.gewaehlt}
              aria-disabled={opt.vergebenAnAndere}
              onClick={() => { if (!opt.vergebenAnAndere) onAbstimmen(message.id, opt.index); }}
            >
              {/* Balken nur bei Umfragen, bei denen Anteile etwas aussagen */}
              {!exklusiv && <span className="web-chat-option__balken" style={{ width: `${opt.prozent}%` }} aria-hidden="true" />}
              <span className="web-chat-option__zeile">
                <span className="web-chat-option__text">
                  {opt.gewaehlt && <IonIcon icon={ICON_HAKEN_GEFUELLT} aria-hidden="true" />}
                  {opt.text}
                </span>
                <span className="web-chat-option__stand">
                  {exklusiv
                    ? (opt.stimmen > 0 ? (opt.gewaehlt ? 'Deine Wahl' : 'Vergeben') : 'Frei')
                    : `${opt.stimmen} (${opt.prozent.toFixed(0)}%)`}
                </span>
              </span>
              {opt.namen.length > 0 && <span className="web-chat-option__namen">{opt.namen.join(', ')}</span>}
            </button>
          </li>
        ))}
      </ul>

      <div className="web-chat-umfrage__fuss">
        <span>
          <IonIcon icon={message.multiple_choice ? ICON_HAKEN_GEFUELLT : ICON_CHATS_GEFUELLT} aria-hidden="true" />
          {umfrageArt(message)}{message.anonymous === false ? ' · mit Namen' : ''}
        </span>
        <span>
          <IonIcon icon={ICON_GRUPPE_GEFUELLT} aria-hidden="true" />
          {stimmen} Stimme{stimmen !== 1 ? 'n' : ''}
        </span>
      </div>
    </div>
  );
};

export default WebUmfrage;
