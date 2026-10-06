// Der Chat in der Web-Fassung (Browser ab 992 px): ein Messenger wie
// WhatsApp Web -- links die Raeume, rechts der geoeffnete Raum.
//
//   /…/chat              die Liste, rechts der Hinweis "Chat auswaehlen"
//   /…/chat/room/:id     dieselbe Ansicht mit dem Raum
//
// Beide Adressen sind in navigation/rollenBaeume.ts zwei Seiten des Routers
// (Uebersicht und Raum); beide zeichnen diese Ansicht. Ein Klick auf einen
// Raum navigiert ohne Seitenuebergang (WebLink: push, 'none'), die Adresse
// wechselt, die Zurueck-Taste des Browsers fuehrt zum vorigen Raum.
//
// Zwei Dinge halten das trotz zweier Seiten ruhig:
//   - Eine Seite, die der Router hinter einer neueren abgelegt hat, baut
//     nichts auf (aktiv): sonst liefe ihr Raum im Hintergrund weiter und
//     markierte Nachrichten als gelesen, die niemand sieht.
//   - Suchbegriff, Reiter und Scrollposition der Liste bleiben ueber den
//     Seitenwechsel stehen (chatListenMerker.ts).
//
// Wer die Liste und den Raum mit Daten versorgt, steht in useChatUebersicht
// und useChatRaum -- dieselben Hooks wie in der App.

import React, { useCallback, useEffect } from 'react';
import { IonPage, useIonRouter } from '@ionic/react';
import { ICON_CHATS_GEFUELLT } from '../../shared/icons';
import AppKopfzeile from '../../shared/AppKopfzeile';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import { useOfflineQuery } from '../../../hooks/useOfflineQuery';
import { CACHE_TTL } from '../../../services/offlineCache';
import api from '../../../services/api';
import { useAppLocation } from '../../../navigation/useAppLocation';
import type { ChatRoomBase, ChatRoomOverview } from '../../../types/chat';
import { useChatUebersicht } from '../useChatUebersicht';
import { WebFehler, WebLaden, WebLeer } from '../../web/WebZustaende';
import WebKnopf from '../../web/WebKnopf';
import WebChatListe from './WebChatListe';
import WebChatRaum from './WebChatRaum';
import { chatListeAdresse, chatRaumAdresse } from './chatAdresse';
import { listenMerkerFuer } from './chatListenMerker';
import { useOhneSeitenanimation } from './useOhneSeitenanimation';
import '../../../theme/web/chat.css';

export interface WebChatProps {
  /** Der Raum aus der Adresse; null bei der Liste. */
  roomId: number | null;
}

/** Der rechte Teil: den Raum laden (Cache zuerst, wie die App) und zeigen. */
const RaumRechts: React.FC<{
  roomId: number;
  listenRaum?: ChatRoomOverview;
  onSchliessen: () => void;
  onRaumLoeschen?: () => void;
  onVerlaufGeaendert: () => void;
}> = ({ roomId, listenRaum, onSchliessen, onRaumLoeschen, onVerlaufGeaendert }) => {
  // Raum-Metadaten per Offline-Cache: offline (oder bei Reconnect) zeigt der
  // Cache sofort den Raum, sodass er mit seinem Nachrichten-Cache erscheint.
  const { data: room, loading, isOffline, refresh } = useOfflineQuery<ChatRoomBase>(
    'chat:room:' + roomId,
    () => api.get(`/chat/rooms/${roomId}`).then((r) => r.data),
    { ttl: CACHE_TTL.CHAT_ROOMS, enabled: !!roomId },
  );

  if (!room && loading) {
    return (
      <div className="web-chat-haupt__zustand">
        <WebLaden karten={0} text="Chat wird geladen" />
        <span className="web-skelett web-chat-haupt__skelett" aria-hidden="true" />
      </div>
    );
  }
  if (!room) {
    return (
      <div className="web-chat-haupt__zustand">
        <WebFehler
          text={isOffline
            ? 'Dieser Chat ist offline noch nicht verfügbar. Sobald du wieder online bist, wird er geladen.'
            : 'Fehler beim Laden des Chat-Raums.'}
          onErneut={() => { void refresh(); }}
        />
        <WebKnopf onClick={onSchliessen}>Zurück zur Übersicht</WebKnopf>
      </div>
    );
  }
  // key: Ein anderer Raum baut den ganzen Raum neu auf -- Nachrichten, Eingabe
  // und Socket gehoeren genau einem Raum.
  return (
    <WebChatRaum
      key={room.id}
      room={room}
      listenRaum={listenRaum}
      onSchliessen={onSchliessen}
      onRaumLoeschen={onRaumLoeschen}
      onVerlaufGeaendert={onVerlaufGeaendert}
    />
  );
};

/** Der Inhalt der Seite, nur gebaut, solange sie vorn liegt. */
const WebChatInhalt: React.FC<WebChatProps> = ({ roomId }) => {
  // Auch die Zurueck-Taste wechselt den Raum ohne Seitenuebergang.
  useOhneSeitenanimation();
  const { user } = useApp();
  const router = useIonRouter();
  const typ = user?.type;
  const adresseVon = useCallback((id: number) => chatRaumAdresse(typ, id), [typ]);
  const oeffnen = (id: number) => router.push(adresseVon(id), 'none', 'push');
  // Zur Liste, ohne dass der Verlauf den geschlossenen Raum als Schritt zurueck behaelt.
  const schliessen = () => router.push(chatListeAdresse(typ), 'none', 'replace');

  // Konto UND Gemeinde: Raeume und Entwuerfe gehoeren zu beiden.
  const merker = listenMerkerFuer(user ? `${user.id}:${user.organization_id ?? ''}` : undefined);
  const uebersicht = useChatUebersicht({
    onSelectRoom: (room) => oeffnen(room.id),
    anfang: { suche: merker.suche, filter: merker.filter, raeume: merker.raeume },
  });
  const { searchText, filterType, rooms, deleteRoom, neuenChatStarten, refresh } = uebersicht;

  // Suche, Reiter und Raeume fuer den naechsten Seitenwechsel merken.
  useEffect(() => {
    merker.suche = searchText;
    merker.filter = filterType;
    if (rooms) merker.raeume = rooms;
  }, [merker, searchText, filterType, rooms]);

  const listenRaum = roomId !== null ? (rooms ?? []).find((r) => r.id === roomId) : undefined;

  return (
    <div className="web-chat">
      <WebChatListe
        uebersicht={uebersicht}
        offenerRaumId={roomId}
        adresseVon={adresseVon}
        onNeuerChat={() => neuenChatStarten(undefined, 'web-chat-modal')}
      />
      <section className="web-chat-haupt" aria-label={roomId !== null ? 'Geöffneter Chat' : 'Kein Chat geöffnet'}>
        {roomId !== null ? (
          <RaumRechts
            roomId={roomId}
            listenRaum={listenRaum}
            onSchliessen={schliessen}
            onRaumLoeschen={listenRaum ? () => deleteRoom(listenRaum, schliessen) : undefined}
            onVerlaufGeaendert={() => { void refresh(); }}
          />
        ) : (
          <div className="web-chat-haupt__leer">
            <WebLeer
              icon={ICON_CHATS_GEFUELLT}
              titel="Chat auswählen"
              text="Wähle links einen Chat aus der Liste oder starte einen neuen."
              aktion={(
                <WebKnopf art="primaer" onClick={() => neuenChatStarten(undefined, 'web-chat-modal')}>
                  Neuer Chat
                </WebKnopf>
              )}
            />
          </div>
        )}
      </section>
    </div>
  );
};

/** Die Adresse ohne abschliessenden Schraegstrich. */
const ohneSchlussstrich = (pfad: string): string => pfad.replace(/\/+$/, '');

const WebChat: React.FC<WebChatProps> = ({ roomId }) => {
  const { user } = useApp();
  const location = useAppLocation();
  const tabId = location.pathname.startsWith('/admin') ? 'admin-chat' : 'chat';
  const { pageRef } = useModalPage(tabId);

  // Liegt diese Seite hinter einer neueren im Stapel des Routers, ruht sie.
  // Der Router legt beim Vorwaerts-Navigieren (ein Raum nach dem anderen) die
  // alte Seite nur ab, statt sie abzubauen -- und meldet das Ablegen nicht an
  // die Seite (ionViewDidLeave kommt nur beim Zurueckgehen). Der Standort ist
  // dagegen auch in abgelegten Seiten der aktuelle: Steht er nicht mehr auf
  // der eigenen Adresse, baut die Seite nichts auf.
  const eigeneAdresse = roomId !== null ? chatRaumAdresse(user?.type, roomId) : chatListeAdresse(user?.type);
  const aktiv = ohneSchlussstrich(location.pathname) === eigeneAdresse;

  return (
    <IonPage ref={pageRef}>
      {aktiv && <AppKopfzeile titel="Chat" gemeindeUmschalter={false} />}
      {/* Kein Scroll auf der Seite selbst: Liste und Verlauf scrollen fuer sich. */}
      <div className="web-chat-seite">
        {aktiv && <WebChatInhalt roomId={roomId} />}
      </div>
    </IonPage>
  );
};

export default WebChat;
