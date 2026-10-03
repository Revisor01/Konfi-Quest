// Der geoeffnete Raum rechts in der Web-Fassung des Chats: Kopf mit Name,
// Mitgliedern und Aktionen, darunter der Verlauf, unten die Eingabe. Alles,
// was der Raum tut -- Nachrichten laden und live halten, Senden mit
// Warteschlange, Dateien, Umfragen, Reaktionen, Loeschen, Gelesen-Markierung,
// Mitglieder, Verwaltung -- kommt aus useChatRaum, derselben Quelle wie die
// App-Fassung (ChatRoom); hier steht nur die Oberflaeche.
//
// Gelesen wird der Raum nur, solange er hier offen ist (er wird nur gebaut,
// wenn er in der Adresse steht) und die Seite sichtbar ist (lesenNurSichtbar).

import React, { useEffect, useRef, useState } from 'react';
import { IonContent, IonIcon } from '@ionic/react';
import { ICON_AUFKLAPPEN_GEFUELLT, ICON_CHATS_GEFUELLT, ICON_DIAGRAMM, ICON_GRUPPE_GEFUELLT } from '../../shared/icons';
import { useApp } from '../../../contexts/AppContext';
import type { ChatRoomBase, ChatRoomOverview, Message } from '../../../types/chat';
import { anfangErreicht } from '../chatVerlauf';
import { mitgliederText, raumArtMessenger, raumFarbe, raumSymbol } from '../chatRaeume';
import { useChatRaum } from '../useChatRaum';
import WebKnopf from '../../web/WebKnopf';
import WebMenue, { type WebMenueEintrag } from './WebMenue';
import WebNachrichten from './WebNachrichten';
import WebChatEingabe from './WebChatEingabe';
import { entwurfLesen, entwurfMerken } from './chatEntwuerfe';
import '../../../theme/web/chat.css';

export interface WebChatRaumProps {
  room: ChatRoomBase;
  /** Dieselbe Zeile aus der Raumliste: Mitgliederzahl und Art kommen von dort. */
  listenRaum?: ChatRoomOverview;
  /** Zurueck zur Liste (nach Verlassen oder Loeschen). */
  onSchliessen: () => void;
  /** Den Raum fuer alle loeschen (nur Leitung); fehlt es, gibt es den Eintrag nicht. */
  onRaumLoeschen?: () => void;
  /**
   * Die neueste Nachricht des Raums hat gewechselt (eine eigene wurde
   * bestaetigt, eine fremde kam an): Die Raumliste daneben holt sich damit
   * ihre Vorschau und Zeit neu. Beim ersten Laden kommt kein Aufruf.
   */
  onVerlaufGeaendert?: () => void;
}

const kannTeilen = (): boolean => typeof navigator !== 'undefined' && typeof navigator.share === 'function';

const WebChatRaum: React.FC<WebChatRaumProps> = ({ room, listenRaum, onSchliessen, onRaumLoeschen, onVerlaufGeaendert }) => {
  const { setSuccess } = useApp();
  const chat = useChatRaum({
    room,
    onBack: onSchliessen,
    lesenNurSichtbar: true,
    modalKlasse: 'web-chat-modal',
    anfangsText: entwurfLesen(room.id),
  });
  const {
    user, isOnline, setError, messages, nachrichtenGeladen,
    contentRef, showScrollDown, handleScroll, handleScrollDownClick,
    initialUnreadRef, newDividerAnchorRef, newDividerRef,
    anfangBei, laedtAeltere, aeltereFehlgeschlagen, ladeAeltere,
    messageText, handleTextInputChange, sendMessage, uploading, uploadFortschritt,
    replyToMessage, setReplyToMessage, selectedFile, selectedFilePreview,
    dateiWaehlen, dateiUebernehmen, clearSelectedFile,
    showReactionPicker, reactionTargetMessage, auswahlAufheben,
    deleteMessage, nachrichtErneutSenden, nachrichtVerwerfen,
    toggleReaction, openReactionPicker, voteInPoll, handleFileClick, ladendeDatei, handleShareMessage,
    openPollModal, openMembersModal, getDisplayRoomName,
    canLeaveChat, istLeitung, darfTeamChatLeeren, handleClearChat, handleExportChat, handleLeaveChat,
  } = chat;

  // Die Vorschau in der Raumliste folgt dem Verlauf: Wechselt die neueste
  // Nachricht (nach dem ersten Laden), meldet der Raum es der Liste.
  const neuesteId = [...messages].reverse().find((n) => n.id > 0)?.id ?? null;
  const letzterStand = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    if (!nachrichtenGeladen) return;
    if (letzterStand.current === undefined) { letzterStand.current = neuesteId; return; }
    if (letzterStand.current !== neuesteId) {
      letzterStand.current = neuesteId;
      onVerlaufGeaendert?.();
    }
  }, [nachrichtenGeladen, neuesteId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Entwurf: was getippt, aber nicht gesendet ist, bleibt beim Raumwechsel stehen.
  useEffect(() => { entwurfMerken(room.id, messageText); }, [room.id, messageText]);

  const feldRef = useRef<HTMLTextAreaElement>(null);
  const [ablage, setAblage] = useState(false);

  // Die Zeile der Liste, ergaenzt um das, was nur der Raum selbst weiss: bei einem
  // Direktchat der Typ des Partners (Team-Chat ja oder nein).
  const partner = room.type === 'direct' ? room.participants?.find((p) => p.user_id !== user?.id) : undefined;
  const alsListenRaum: ChatRoomOverview = {
    unread_count: 0,
    partner_user_type: partner?.user_type,
    ...room,
    ...listenRaum,
  };
  const name = getDisplayRoomName();
  const art = raumArtMessenger(alsListenRaum);
  const istAdmin = user?.type === 'admin';

  const menue: WebMenueEintrag[] = [];
  const offline = 'Ohne Internetverbindung nicht möglich';
  if (istLeitung) {
    menue.push({ text: 'Chat-Verlauf exportieren', onWaehlen: handleExportChat, deaktiviert: !isOnline, title: isOnline ? undefined : offline });
  }
  if (darfTeamChatLeeren && room.is_team_chat) {
    menue.push({ text: 'Team-Chat leeren', onWaehlen: handleClearChat, gefahr: true, deaktiviert: !isOnline, title: isOnline ? undefined : offline });
  }
  if (canLeaveChat()) {
    menue.push({ text: 'Chat verlassen', onWaehlen: handleLeaveChat, gefahr: true, deaktiviert: !isOnline, title: isOnline ? undefined : offline });
  } else if (istAdmin && (room.type === 'group' || room.type === 'admin')) {
    // Die Leitung verlaesst keinen Chat -- sie loescht ihn. Der Eintrag bleibt
    // sichtbar und sagt, warum er gesperrt ist.
    menue.push({ text: 'Chat verlassen', onWaehlen: () => undefined, deaktiviert: true, title: 'Die Leitung kann Chats nicht verlassen. Chats können nur gelöscht werden.' });
  }
  if (istAdmin && (room.type === 'direct' || room.type === 'group') && onRaumLoeschen) {
    menue.push({ text: 'Chat löschen', onWaehlen: onRaumLoeschen, gefahr: true, deaktiviert: !isOnline, title: isOnline ? undefined : offline });
  }

  const kopieren = (message: Message) => {
    navigator.clipboard?.writeText(message.content)
      .then(() => setSuccess('Text kopiert'))
      .catch(() => setError('Der Text konnte nicht kopiert werden'));
  };

  // Eine Datei ueber den Verlauf ziehen: ablegen = als Anhang uebernehmen.
  const mitDatei = (ereignis: React.DragEvent) => Array.from(ereignis.dataTransfer?.types ?? []).includes('Files');

  return (
    <section
      className="web-chat-raum"
      aria-label={`Chat ${name}`}
      onDragEnter={(e) => { if (mitDatei(e)) { e.preventDefault(); setAblage(true); } }}
      onDragOver={(e) => { if (mitDatei(e)) e.preventDefault(); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setAblage(false); }}
      onDrop={(e) => {
        if (!mitDatei(e)) return;
        e.preventDefault();
        setAblage(false);
        const datei = e.dataTransfer.files[0];
        if (datei) void dateiUebernehmen(datei);
      }}
    >
      <header className="web-chat-raum__kopf">
        <span className={`web-chat-kreis web-chat-kreis--${raumFarbe(alsListenRaum)}`} aria-hidden="true">
          <IonIcon icon={raumSymbol(alsListenRaum)} />
        </span>
        <div className="web-chat-raum__titel">
          <h2 className="web-chat-raum__name">{name}</h2>
          <p className="web-chat-raum__untertitel">{mitgliederText(alsListenRaum, user?.id, art)}</p>
        </div>
        <div className="web-chat-raum__aktionen">
          {room.type !== 'direct' && (
            <WebKnopf art="text" symbol aria-label="Mitglieder anzeigen" title="Mitglieder anzeigen" onClick={openMembersModal}>
              <IonIcon icon={ICON_GRUPPE_GEFUELLT} aria-hidden="true" />
            </WebKnopf>
          )}
          {/* Umfragen anlegen bleibt der Leitung vorbehalten. */}
          {istAdmin && (
            <WebKnopf art="text" symbol aria-label="Umfrage erstellen" title="Umfrage erstellen" onClick={openPollModal}>
              <IonIcon icon={ICON_DIAGRAMM} aria-hidden="true" />
            </WebKnopf>
          )}
          {menue.length > 0 && <WebMenue beschriftung="Weitere Chat-Optionen" eintraege={menue} />}
        </div>
      </header>

      <IonContent
        ref={contentRef}
        className="web-chat-verlauf"
        scrollEvents
        onIonScroll={handleScroll}
        // Ein Klick neben den Picker schliesst ihn (wie in der App).
        onClick={() => { if (showReactionPicker) auswahlAufheben(); }}
      >
        {/* "Nach unten": nur, wenn man weiter oben liest. */}
        <div slot="fixed" className={`web-chat-runter${showScrollDown ? ' web-chat-runter--sichtbar' : ''}`} aria-hidden={!showScrollDown}>
          <button type="button" className="web-chat-runter__knopf" tabIndex={showScrollDown ? 0 : -1} aria-label="Zu den neuesten Nachrichten springen" onClick={handleScrollDownClick}>
            <IonIcon icon={ICON_AUFKLAPPEN_GEFUELLT} aria-hidden="true" />
          </button>
        </div>

        {nachrichtenGeladen && messages.length === 0 && (
          <div className="web-chat-leer">
            <IonIcon icon={ICON_CHATS_GEFUELLT} className="web-chat-leer__symbol" aria-hidden="true" />
            <p>Noch keine Nachrichten. Schreib die erste!</p>
          </div>
        )}

        <WebNachrichten
          messages={messages}
          room={room}
          user={user}
          pickerNachrichtId={showReactionPicker ? (reactionTargetMessage?.id ?? null) : null}
          initialUnreadRef={initialUnreadRef}
          newDividerAnchorRef={newDividerAnchorRef}
          newDividerRef={newDividerRef}
          laedtAeltere={laedtAeltere}
          aeltereFehlgeschlagen={aeltereFehlgeschlagen}
          anfangErreicht={anfangErreicht(messages, anfangBei)}
          onErneutLaden={() => { void ladeAeltere(true); }}
          ladendeDatei={ladendeDatei}
          uploadFortschritt={uploadFortschritt}
          kannTeilen={kannTeilen()}
          onAntworten={(message) => { setReplyToMessage(message); feldRef.current?.focus(); }}
          onKopieren={kopieren}
          onTeilen={(message) => { void handleShareMessage(message); }}
          onLoeschen={deleteMessage}
          onReaktion={toggleReaction}
          onPickerOeffnen={openReactionPicker}
          onPickerSchliessen={auswahlAufheben}
          onAbstimmen={voteInPoll}
          onDatei={handleFileClick}
          onError={setError}
          onErneutSenden={(message) => { void nachrichtErneutSenden(message); }}
          onVerwerfen={(message) => { void nachrichtVerwerfen(message); }}
        />
      </IonContent>

      <WebChatEingabe
        text={messageText}
        onText={handleTextInputChange}
        onSenden={() => { void sendMessage(); }}
        uploading={uploading}
        datei={selectedFile}
        dateiVorschau={selectedFilePreview}
        onDateiWaehlen={() => { void dateiWaehlen(); }}
        onDateiEntfernen={clearSelectedFile}
        onDateiUebernehmen={(datei) => { void dateiUebernehmen(datei); }}
        antwortAuf={replyToMessage}
        onAntwortVerwerfen={() => setReplyToMessage(null)}
        feldRef={feldRef}
      />

      {ablage && (
        <div className="web-chat-ablage" aria-hidden="true">
          <span>Datei hier ablegen, um sie anzuhängen</span>
        </div>
      )}
    </section>
  );
};

export default WebChatRaum;
