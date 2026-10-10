// Eine Umfrage in der Nachricht (Web-Fassung): die Frage, wann sie endet, was
// fuer sie gilt (Regelzeilen), die Antworten als Schaltflaechen mit Balken,
// Stimmenzahl und -- bei einer Umfrage mit Namen -- den Waehlenden. Was eine
// Antwort zaehlt, wer sie gewaehlt hat und welche Regeln gelten, rechnet
// chatNachricht, dieselben Funktionen wie in der Blase der App; abgestimmt
// wird ueber useUmfragenUndReaktionen.

import React, { useState } from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_CHATS_GEFUELLT, ICON_DIAGRAMM, ICON_GRUPPE_GEFUELLT, ICON_HAKEN_GEFUELLT, ICON_UHRZEIT_GEFUELLT } from '../../shared/icons';
import type { Message } from '../../../types/chat';
import {
  darfNamenAufdecken,
  umfrageAblauf,
  umfrageArt,
  umfrageGesperrt,
  umfrageMitAbgabeSchritt,
  umfrageOptionen,
  umfrageRegeln,
} from '../chatNachricht';

export interface WebUmfrageProps {
  message: Message;
  user: { id: number; type: string } | null;
  onAbstimmen: (messageId: number, auswahl: number | number[]) => void;
  onNamenAufdecken?: (pollId: number) => void;
}

const WebUmfrage: React.FC<WebUmfrageProps> = ({ message, user, onAbstimmen, onNamenAufdecken }) => {
  const optionen = umfrageOptionen(message, user);
  const ablauf = umfrageAblauf(message.expires_at);
  const regeln = umfrageRegeln(message, user);
  const gesperrt = umfrageGesperrt(message, user);
  const mitAbgabe = umfrageMitAbgabeSchritt(message) && !gesperrt;
  const exklusiv = !!message.exclusive_options;
  const stimmen = message.votes?.length || 0;
  // Auswahl vor dem Abgeben (nur bei einmaliger Antwort mit Mehrfachauswahl).
  const [auswahl, setAuswahl] = useState<number[]>([]);

  const antippen = (index: number) => {
    if (mitAbgabe) {
      setAuswahl((vorher) => vorher.includes(index) ? vorher.filter((i) => i !== index) : [...vorher, index]);
      return;
    }
    onAbstimmen(message.id, index);
  };

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

      <ul className="web-chat-umfrage__regeln" aria-label="Was für diese Umfrage gilt">
        {regeln.map((zeile) => <li key={zeile}>{zeile}</li>)}
      </ul>

      <ul className="web-chat-umfrage__optionen">
        {optionen.map((opt) => {
          const markiert = opt.gewaehlt || (mitAbgabe && auswahl.includes(opt.index));
          const zu = opt.vergebenAnAndere || gesperrt;
          return (
            <li key={opt.index}>
              <button
                type="button"
                className={`web-chat-option${markiert ? ' web-chat-option--gewaehlt' : ''}${opt.vergebenAnAndere ? ' web-chat-option--vergeben' : ''}${gesperrt && !opt.vergebenAnAndere ? ' web-chat-option--fest' : ''}`}
                aria-pressed={markiert}
                aria-disabled={zu}
                onClick={() => { if (!zu) antippen(opt.index); }}
              >
                {/* Balken nur bei Umfragen, bei denen Anteile etwas aussagen */}
                {!exklusiv && <span className="web-chat-option__balken" style={{ width: `${opt.prozent}%` }} aria-hidden="true" />}
                <span className="web-chat-option__zeile">
                  <span className="web-chat-option__text">
                    {markiert && <IonIcon icon={ICON_HAKEN_GEFUELLT} aria-hidden="true" />}
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
          );
        })}
      </ul>

      {mitAbgabe && (
        <button
          type="button"
          className="web-chat-umfrage__aktion"
          disabled={auswahl.length === 0}
          onClick={() => onAbstimmen(message.id, [...auswahl].sort((a, b) => a - b))}
        >
          Antwort abgeben
        </button>
      )}

      {onNamenAufdecken && message.poll_id != null && darfNamenAufdecken(message, user) && (
        <button
          type="button"
          className="web-chat-umfrage__aktion web-chat-umfrage__aktion--leise"
          onClick={() => onNamenAufdecken(message.poll_id as number)}
        >
          Namen aufdecken
        </button>
      )}

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
