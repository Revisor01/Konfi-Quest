// Die Raumliste links in der Web-Fassung des Chats: Reiter mit roter Zahl,
// darunter die Suche, die Raeume als echte Links -- mit Kreis in der Farbe der Art, Name,
// Art (Gruppe, Direkt, Team ...), letzter Nachricht, Zeit und roter Zahl.
// Daten, Reiter, Suche und das Loeschrecht kommen aus useChatUebersicht, wie
// in der App-Uebersicht (components/chat/ChatOverview.tsx).

import React, { useLayoutEffect, useRef } from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_CHATS_GEFUELLT, ICON_HINZUFUEGEN } from '../../shared/icons';
import {
  letzteNachrichtText,
  raumAnzeigeName,
  raumArtMessenger,
  raumFarbe,
  raumSymbol,
  ungelesenVonRaum,
  zeitImMessenger,
} from '../chatRaeume';
import type { useChatUebersicht } from '../useChatUebersicht';
import WebKnopf from '../../web/WebKnopf';
import WebLink from '../../web/WebLink';
import WebSuche from '../../web/WebSuche';
import WebChips, { type WebChip } from '../../web/WebChips';
import { WebLaden, WebLeer } from '../../web/WebZustaende';
import { listenMerker } from './chatListenMerker';
import '../../../theme/web/chat.css';
import { CHAT_LEER, CHAT_REITER_BESCHRIFTUNG, CHAT_UNGELESEN_ZAHLTEXT, chatReiterFuer } from '../../../seiten/chats';

type Uebersicht = ReturnType<typeof useChatUebersicht>;

export interface WebChatListeProps {
  uebersicht: Uebersicht;
  /** Der Raum, der rechts offen ist. */
  offenerRaumId: number | null;
  /** Die Adresse eines Raums (fuer den Link). */
  adresseVon: (raumId: number) => string;
  onNeuerChat: () => void;
}

/** Ungelesene eines Raums: dieselbe Rechnung wie der Reiter "Ungelesen" (chatRaeume.ts). */
const ungelesenVon = ungelesenVonRaum;

const zahlText = (n: number): string => (n > 99 ? '99+' : String(n));

const WebChatListe: React.FC<WebChatListeProps> = ({ uebersicht, offenerRaumId, adresseVon, onNeuerChat }) => {
  const {
    user, rooms, loading, filteredRooms, chatUnreadByRoom,
    searchText, setSearchText, filterType, setFilterType, gehoertZumTeam,
  } = uebersicht;
  const raeume = rooms ?? [];
  const gesamtUngelesen = Object.values(chatUnreadByRoom).reduce((summe, n) => summe + n, 0);
  const jetzt = new Date();

  // Reiter aus der gemeinsamen Beschreibung (seiten/chats.ts); nur "Ungelesen" traegt eine Zahl.
  const chips: Array<WebChip<string>> = chatReiterFuer(gehoertZumTeam).map((r) => (r.schluessel === 'ungelesen'
    ? { wert: r.schluessel, label: r.label, zahl: gesamtUngelesen, rot: true, zahlText: CHAT_UNGELESEN_ZAHLTEXT }
    : { wert: r.schluessel, label: r.label }));

  // Scrollposition ueber den Seitenwechsel halten (chatListenMerker.ts): beim
  // ersten Zeichnen mit Raeumen zuruecksetzen, danach merken.
  const flaeche = useRef<HTMLDivElement>(null);
  const wiederhergestellt = useRef(false);
  useLayoutEffect(() => {
    if (wiederhergestellt.current || !flaeche.current || raeume.length === 0) return;
    wiederhergestellt.current = true;
    flaeche.current.scrollTop = listenMerker().scroll;
  }, [raeume.length]);

  // Nach einem Seitenwechsel per Tastatur steht der Fokus wieder auf der Zeile
  // des gewaehlten Raums: Die alte Seite wird mitsamt dem Fokus abgebaut.
  useLayoutEffect(() => {
    const merker = listenMerker();
    if (merker.fokus?.ziel !== 'zeile' || !flaeche.current || raeume.length === 0) return;
    const zeile = flaeche.current.querySelector<HTMLAnchorElement>(`a[href$="/room/${merker.fokus.raumId}"]`);
    zeile?.focus();
    // Einmal versucht, dann vergessen: Ein Merker, der nie greift (der Raum ist
    // weggefiltert), stuende sonst bei der naechsten Seite noch da.
    merker.fokus = null;
  }, [raeume.length]);

  // Wie ein Raum gewaehlt wurde, entscheidet, wohin der Fokus danach geht:
  // per Tastatur (Enter auf der Zeile, detail 0) zurueck auf die Zeile, per
  // Maus in die Eingabe -- wer einen Chat anklickt, will meist schreiben.
  const raumGewaehlt = (raumId: number, ereignis: React.MouseEvent) => {
    // Strg-, Umschalt- und Mittelklick oeffnen einen neuen Tab: Hier wechselt nichts.
    if (ereignis.button !== 0 || ereignis.ctrlKey || ereignis.metaKey || ereignis.shiftKey || ereignis.altKey) return;
    listenMerker().fokus = { ziel: ereignis.detail === 0 ? 'zeile' : 'eingabe', raumId };
  };

  // Pfeil hoch und runter wandern durch die Raeume (wie in einer Liste im Betriebssystem).
  const taste = (ereignis: React.KeyboardEvent<HTMLUListElement>) => {
    if (ereignis.key !== 'ArrowDown' && ereignis.key !== 'ArrowUp') return;
    const links = [...ereignis.currentTarget.querySelectorAll<HTMLAnchorElement>('a')];
    const aktuell = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (aktuell === -1) return;
    ereignis.preventDefault();
    links[aktuell + (ereignis.key === 'ArrowDown' ? 1 : -1)]?.focus();
  };

  const suchend = searchText.trim() !== '' || filterType !== 'alle';

  return (
    <aside className="web-chat-liste" aria-label="Chats">
      <div className="web-chat-liste__kopf">
        <h2 className="web-chat-liste__titel">Chats</h2>
        <WebKnopf art="primaer" klein onClick={onNeuerChat}>
          <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
          Neuer Chat
        </WebKnopf>
      </div>

      <div className="web-chat-liste__werkzeuge">
        {/* Reiter ZUERST, Suche darunter -- wie in der App (Simon, 06.09.2026:
            "dann filtert man erst und dann sucht man"); bis 09.10.2026 stand hier die Suche oben. */}
        <WebChips beschriftung={CHAT_REITER_BESCHRIFTUNG} chips={chips} wert={filterType} onWert={setFilterType} />
        <WebSuche beschriftung="Chats durchsuchen" platzhalter="Chats durchsuchen" wert={searchText} onWert={setSearchText} />
      </div>

      <div
        className="web-chat-liste__raeume"
        ref={flaeche}
        onScroll={(e) => { listenMerker().scroll = e.currentTarget.scrollTop; }}
      >
        {loading ? (
          <div className="web-chat-liste__laden">
            <WebLaden karten={0} text="Chats werden geladen" />
            {[0, 1, 2, 3, 4].map((i) => <span key={i} className="web-skelett web-chat-liste__skelett" aria-hidden="true" />)}
          </div>
        ) : filteredRooms.length === 0 ? (
          <WebLeer
            icon={ICON_CHATS_GEFUELLT}
            titel={suchend ? CHAT_LEER.gefiltert.titel : CHAT_LEER.keine.titel}
            text={suchend ? CHAT_LEER.gefiltert.text : CHAT_LEER.keine.text}
          />
        ) : (
          <ul className="web-chat-liste__eintraege" onKeyDown={taste}>
            {filteredRooms.map((room) => {
              const ungelesen = ungelesenVon(room, chatUnreadByRoom);
              const letzte = letzteNachrichtText(room, user?.display_name ?? '');
              const name = raumAnzeigeName(room, user?.id);
              const art = raumArtMessenger(room);
              const offen = room.id === offenerRaumId;
              return (
                <li key={room.id} onClickCapture={(e) => raumGewaehlt(room.id, e)}>
                  <WebLink
                    href={adresseVon(room.id)}
                    className={`web-chat-zeile${offen ? ' web-chat-zeile--offen' : ''}${ungelesen > 0 ? ' web-chat-zeile--ungelesen' : ''}`}
                    title={`${name} (${art})`}
                    aria-label={`${name}, ${art}${ungelesen > 0 ? `, ${ungelesen} ungelesene Nachrichten` : ''}${offen ? ', geöffnet' : ''}`}
                  >
                    <span className={`web-chat-kreis web-chat-kreis--${raumFarbe(room)}`} aria-hidden="true">
                      <IonIcon icon={raumSymbol(room)} />
                    </span>
                    <span className="web-chat-zeile__text">
                      <span className="web-chat-zeile__oben">
                        <span className="web-chat-zeile__name">{name}</span>
                        <time className="web-chat-zeile__zeit" dateTime={room.last_message?.created_at}>
                          {zeitImMessenger(room.last_message?.created_at, jetzt)}
                        </time>
                      </span>
                      <span className="web-chat-zeile__unten">
                        <span className="web-chat-zeile__vorschau">
                          <span className="web-chat-zeile__art">{art}</span>
                          {letzte ? (
                            <>
                              {letzte.absender && <span className="web-chat-zeile__absender">{letzte.absender}: </span>}
                              {letzte.text}
                            </>
                          ) : (
                            'Noch keine Nachrichten'
                          )}
                        </span>
                        {ungelesen > 0 && (
                          <span className="web-chat-zahl" aria-hidden="true">{zahlText(ungelesen)}</span>
                        )}
                      </span>
                    </span>
                  </WebLink>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
};

export default WebChatListe;
