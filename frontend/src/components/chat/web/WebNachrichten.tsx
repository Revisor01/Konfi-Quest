// Der Verlauf in der Web-Fassung: Kopf ("Anfang des Chats", Ladeanzeige, Knopf
// zum erneuten Versuch), Tages-Trenner, der einmalige "Neue Nachrichten"-
// Trenner und die Nachrichten. Die Anker-Logik des Trenners ist dieselbe
// Funktion wie in der App-Liste (chatVerlauf.neuenTrennerVerankern); die
// Marker data-day-divider liest useChatScroll (Tag der obersten Nachricht).

import React from 'react';
import type { Message } from '../../../types/chat';
import { neuenTrennerVerankern, tagesTrennerText } from '../chatVerlauf';
import { setztFort } from '../chatNachricht';
import WebNachricht, { type WebNachrichtProps } from './WebNachricht';

export interface WebNachrichtenProps extends Omit<WebNachrichtProps, 'message' | 'fortsetzung' | 'pickerOffen'> {
  messages: Message[];
  /** Die Nachricht, deren Picker offen ist (oder null). */
  pickerNachrichtId: number | null;
  initialUnreadRef: React.MutableRefObject<number | null>;
  newDividerAnchorRef: React.MutableRefObject<number | null>;
  newDividerRef: React.RefObject<HTMLDivElement | null>;
  // Blaettern nach oben
  laedtAeltere: boolean;
  aeltereFehlgeschlagen: boolean;
  anfangErreicht: boolean;
  onErneutLaden: () => void;
  /** Das Element, das beim Nachladen von Bildern waechst (useUntenBleiben). */
  listeRef?: React.Ref<HTMLDivElement>;
}

const WebNachrichten: React.FC<WebNachrichtenProps> = ({
  messages, pickerNachrichtId, initialUnreadRef, newDividerAnchorRef, newDividerRef,
  laedtAeltere, aeltereFehlgeschlagen, anfangErreicht, onErneutLaden, listeRef, ...nachrichtProps
}) => {
  neuenTrennerVerankern(messages, nachrichtProps.room.id, initialUnreadRef, newDividerAnchorRef);

  // Nach Tagen gruppiert: Der Tages-Trenner klebt oben (position: sticky) und
  // gibt den Platz frei, wenn der Tag zu Ende ist -- ein schwebender Chip wie
  // in der App braucht es hier nicht.
  const gruppen: Array<{ schluessel: string; text: string; eintraege: Array<{ message: Message; index: number }> }> = [];
  messages.forEach((message, index) => {
    const erstellt = message.created_at ? new Date(message.created_at) : null;
    const tag = erstellt && !isNaN(erstellt.getTime()) ? erstellt.toDateString() : '';
    const letzte = gruppen[gruppen.length - 1];
    if (tag && (!letzte || letzte.schluessel !== tag)) {
      gruppen.push({ schluessel: tag, text: tagesTrennerText(erstellt!), eintraege: [{ message, index }] });
    } else if (letzte) {
      letzte.eintraege.push({ message, index });
    } else {
      gruppen.push({ schluessel: '', text: '', eintraege: [{ message, index }] });
    }
  });

  return (
    // role=log: Vorleseprogramme sagen neue Nachrichten an, ohne den Fokus zu bewegen.
    <div className="web-chat-verlaufsliste" role="log" aria-label="Nachrichten" ref={listeRef}>
      {/* Die Zeile steht immer da und behaelt ihre Hoehe: Kaeme sie erst mit
          der Ladeanzeige dazu, schoebe sie die Nachrichten darunter nach unten. */}
      {messages.length > 0 && (
        <div className="web-chat-anfang" role="status" aria-live="polite" data-chat-verlauf-anfang>
          {laedtAeltere ? (
            <span>Ältere Nachrichten werden geladen...</span>
          ) : aeltereFehlgeschlagen ? (
            <button type="button" className="web-chat-anfang__knopf" onClick={onErneutLaden}>Ältere Nachrichten laden</button>
          ) : anfangErreicht ? (
            <span>Anfang des Chats</span>
          ) : null}
        </div>
      )}

      {gruppen.map((gruppe) => (
        <div key={gruppe.schluessel || 'ohne-datum'} className="web-chat-tagesgruppe" role="group" aria-label={gruppe.text || undefined}>
          {gruppe.text && (
            <div className="web-chat-tag" data-day-divider={gruppe.text}>
              <span>{gruppe.text}</span>
            </div>
          )}
          {gruppe.eintraege.map(({ message, index }, position) => {
            const neuTrenner = newDividerAnchorRef.current !== null && message.id === newDividerAnchorRef.current;
            const fortsetzung = position > 0 && !neuTrenner && setztFort(messages[index - 1], message);
            return (
              // Key bevorzugt client_id: bleibt beim Tausch optimistische ->
              // Server-Nachricht identisch, die Nachricht wird NICHT neu gemountet.
              <React.Fragment key={message.client_id ?? message.clientId ?? message.id}>
                {neuTrenner && (
                  <div className="web-chat-neu" ref={newDividerRef}>
                    <span>Neue Nachrichten</span>
                  </div>
                )}
                <WebNachricht
                  {...nachrichtProps}
                  message={message}
                  fortsetzung={fortsetzung}
                  pickerOffen={pickerNachrichtId === message.id}
                />
              </React.Fragment>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default WebNachrichten;
