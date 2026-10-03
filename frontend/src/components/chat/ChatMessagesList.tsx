import React from 'react';
import { Message } from '../../types/chat';
import MessageBubble from './MessageBubble';
import { neuenTrennerVerankern, tagesTrennerText } from './chatVerlauf';

/**
 * Nachrichtenliste des Chatraums (beim Aufteilen von ChatRoom.tsx hierher
 * gezogen, Verhalten unveraendert): Tages-Trenner, der einmalige
 * "Neue Nachrichten"-Trenner samt Anker-Logik und die Bubbles selbst.
 */

// Alles, was unveraendert an jede MessageBubble durchgereicht wird.
type BubbleDurchreichProps = Omit<React.ComponentProps<typeof MessageBubble>, 'message'>;

interface ChatMessagesListProps extends BubbleDurchreichProps {
  messages: Message[];
  // Beim Oeffnen eingefrorene Ungelesen-Anzahl; wird hier auf 0 gesetzt, wenn
  // derselbe Anker fuer diesen Raum bereits gezeigt wurde.
  initialUnreadRef: React.MutableRefObject<number | null>;
  // Message-ID, VOR der der "Neue Nachrichten"-Trenner steht — EINMAL beim
  // ersten vollstaendigen Laden eingefroren. Ein Index (laenge - unread) wuerde
  // bei jeder neu angehaengten (auch eigenen) Nachricht nach unten wandern.
  newDividerAnchorRef: React.MutableRefObject<number | null>;
  // DOM-Knoten des Trenners — Scrollziel des Initial-Loads (useChatScroll).
  newDividerRef: React.RefObject<HTMLDivElement | null>;
}

const ChatMessagesList: React.FC<ChatMessagesListProps> = ({
  messages,
  initialUnreadRef,
  newDividerAnchorRef,
  newDividerRef,
  ...bubbleProps
}) => {
  const { room } = bubbleProps;

  // Erste ungelesene Nachricht EINMAL per Message-ID verankern (Regeln und
  // Begruendung in chatVerlauf.neuenTrennerVerankern).
  neuenTrennerVerankern(messages, room?.id, initialUnreadRef, newDividerAnchorRef);

  let lastDayKey = '';
  return (
    <div style={{ paddingBottom: '0', position: 'relative' }}>
      {messages.map((message) => {
        const created = message.created_at ? new Date(message.created_at) : null;
        const dayKey = created && !isNaN(created.getTime()) ? created.toDateString() : '';
        const showDayDivider = dayKey && dayKey !== lastDayKey;
        if (showDayDivider) lastDayKey = dayKey;
        const showNewDivider = newDividerAnchorRef.current !== null && message.id === newDividerAnchorRef.current;
        return (
          // Key bevorzugt client_id: bleibt beim Tausch optimistische ->
          // Server-Nachricht identisch, die Bubble wird NICHT neu gemountet
          // (kein Aufblitzen/Ruckeln beim Bestaetigen der eigenen Nachricht).
          <React.Fragment key={message.client_id ?? message.clientId ?? message.id}>
            {showDayDivider && (
              <div
                data-day-divider={tagesTrennerText(created!)}
                style={{
                  display: 'flex', justifyContent: 'center', margin: 'var(--app-abstand-mittel) 0 var(--app-abstand-eng)',
                  // Trenner scrollen normal mit. Der oben SCHWEBENDE Chip
                  // (ein einziger) zeigt den aktuellen Tag -> kein Ueberlagern.
                  pointerEvents: 'none'
                }}
              >
                <span style={{
                  fontSize: 'var(--app-text-meta)', fontWeight: 'var(--app-schrift-halbfett)', color: 'var(--app-text-body)',
                  background: 'var(--app-surface-muted)',
                  padding: 'var(--app-abstand-mini) var(--app-abstand-mittelweit)', borderRadius: 'var(--app-radius-karte)', boxShadow: 'var(--app-schatten-flach)'
                }}>
                  {tagesTrennerText(created!)}
                </span>
              </div>
            )}
            {showNewDivider && (
              <div ref={newDividerRef} style={{ display: 'flex', alignItems: 'center', gap: 'var(--app-abstand-eng)', margin: 'var(--app-abstand-schmal) var(--app-abstand-mittel)' }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--app-color-events)' }} />
                <span style={{ fontSize: 'var(--app-text-meta)', fontWeight: 'var(--app-schrift-fett)', color: 'var(--app-text-events)' }}>Neue Nachrichten</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--app-color-events)' }} />
              </div>
            )}
            <MessageBubble
              message={message}
              {...bubbleProps}
            />
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default ChatMessagesList;
