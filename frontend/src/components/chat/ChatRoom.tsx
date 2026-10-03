import { ICON_AUFKLAPPEN_GEFUELLT } from '../shared/icons';
import React from 'react';
import {
  IonContent,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
} from '@ionic/react';
import { ChatRoomProps as ChatRoomComponentProps } from '../../types/chat';
import ChatMessagesList from './ChatMessagesList';
import ChatVerlaufAnfang from './ChatVerlaufAnfang';
import { ChatHeader, MessageInput } from './ChatRoomSections';
import AppKopfzeile from '../shared/AppKopfzeile';
import { triggerPullHaptic } from '../../utils/haptics';
import { useChatRaum } from './useChatRaum';
import { anfangErreicht } from './chatVerlauf';

// Die App-Fassung eines geoeffneten Chatraums. Alles, was der Raum tut, liegt
// in useChatRaum -- dieselbe Quelle wie die Web-Fassung (web/WebChatRaum);
// hier steht nur, wie es auf dem Telefon aussieht.
const ChatRoom: React.FC<ChatRoomComponentProps> = ({ room, onBack, presentingElement }) => {
  const {
    user,
    isOnline,
    setError,
    messages,
    loadMessages,
    anfangBei,
    laedtAeltere,
    aeltereFehlgeschlagen,
    ladeAeltere,
    contentRef,
    floatingDay,
    showScrollDown,
    handleScroll,
    handleScrollDownClick,
    handleTextareaFocus,
    initialUnreadRef,
    newDividerAnchorRef,
    newDividerRef,
    messageText,
    handleTextInputChange,
    sendMessage,
    uploading,
    uploadFortschritt,
    textareaRef,
    replyToMessage,
    setReplyToMessage,
    selectedFile,
    selectedFilePreview,
    dateiWaehlen,
    clearSelectedFile,
    selectedMessage,
    showReactionPicker,
    reactionTargetMessage,
    handleLongPress,
    handleShareMessage,
    deleteMessage,
    handleRetryMessage,
    toggleReaction,
    openReactionPicker,
    voteInPoll,
    handleFileClick,
    ladendeDatei,
    auswahlAufheben,
    openPollModal,
    openMembersModal,
    getDisplayRoomName,
    canLeaveChat,
    istLeitung,
    darfTeamChatLeeren,
    handleChatOptions,
    handleClearChat,
  } = useChatRaum({ room, onBack, presentingElement });

  // Early return nach allen Hooks wenn room noch nicht geladen ist
  if (!room) {
    return (
      <>
        {/* Opak wie der ChatHeader danach, sonst springt die Kopfzeile beim
            Wechsel vom Laden zum Raum. */}
        <AppKopfzeile titel="Chat wird geladen..." onZurueck={onBack} translucent={false} gemeindeUmschalter={false} />
        <IonContent className="app-gradient-background" fullscreen>
          <div style={{ textAlign: 'center', padding: 'var(--app-abstand-riesig)' }}>
            <p>Chat wird geladen...</p>
          </div>
        </IonContent>
      </>
    );
  }

  return (
    <>
      <ChatHeader
        roomName={getDisplayRoomName()}
        roomType={room?.type ?? 'group'}
        isAdmin={user?.type === 'admin'}
        // Menue-Button auch für die Leitung zeigen, wenn sie den Chat zwar
        // nicht verlassen darf, aber exportieren kann.
        canLeave={canLeaveChat() || istLeitung}
        isOnline={isOnline}
        onBack={onBack}
        onOpenMembers={openMembersModal}
        onOpenPoll={openPollModal}
        onLeaveChat={handleChatOptions}
        // Mülleimer nur im automatischen Team-Chat und nur für die Leitung —
        // der Server prüft beides ebenfalls.
        onClearChat={darfTeamChatLeeren && room?.is_team_chat ? handleClearChat : null}
        eventId={room?.event_id ?? null}
        partnerType={
          room?.type === 'direct'
            ? (room.participants?.find(p => p.user_id !== user?.id)?.user_type ?? null)
            : null
        }
      />

      <IonContent
        ref={contentRef}
        className="app-gradient-background"
        scrollEvents
        onIonScroll={handleScroll}
        onClick={() => {
          if (selectedMessage || showReactionPicker) auswahlAufheben();
        }}
      >
        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          loadMessages();
          e.detail.complete();
        }} onIonPull={triggerPullHaptic}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>

        {/* Schwebender Tages-Chip (WhatsApp-Style): slot="fixed" -> bleibt
            ausserhalb des Scroll-Containers immer oben sichtbar; der Text wird
            beim Scrollen aus der obersten sichtbaren Nachricht aktualisiert. */}
        {floatingDay && messages.length > 0 && (
          <div slot="fixed" style={{
            position: 'absolute', top: '6px', left: 0, right: 0,
            display: 'flex', justifyContent: 'center', zIndex: 10, pointerEvents: 'none'
          }}>
            <span style={{
              fontSize: 'var(--app-text-meta)', fontWeight: 'var(--app-schrift-halbfett)', color: 'var(--app-text-body)',
              background: 'var(--app-surface-muted)', backdropFilter: 'blur(4px)',
              padding: 'var(--app-abstand-mini) var(--app-abstand-mittelweit)', borderRadius: 'var(--app-radius-karte)', boxShadow: 'var(--app-schatten-flach)'
            }}>
              {floatingDay}
            </span>
          </div>
        )}

        {/* "Nach unten"-Button: slot="fixed" -> haengt ueber dem Scroll-Inhalt
            unten rechts, direkt oberhalb des Eingabefelds. Erscheint nur, wenn
            man weiter oben liest (SCROLL_DOWN_THRESHOLD). */}
        <div
          slot="fixed"
          style={{
            position: 'absolute',
            right: '16px',
            bottom: 'calc(16px + env(safe-area-inset-bottom))',
            zIndex: 11,
            opacity: showScrollDown ? 1 : 0,
            transform: showScrollDown ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.9)',
            pointerEvents: showScrollDown ? 'auto' : 'none',
            transition: 'opacity 180ms ease, transform 180ms ease'
          }}
          aria-hidden={!showScrollDown}
        >
          <button
            type="button"
            onClick={handleScrollDownClick}
            aria-label="Zu den neuesten Nachrichten springen"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--app-radius-kreis)',
              border: 'none',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              backgroundColor: 'var(--app-surface-card)',
              backdropFilter: 'blur(10px)',
              boxShadow: 'var(--app-schatten-karte-stark)'
            }}
          >
            <IonIcon icon={ICON_AUFKLAPPEN_GEFUELLT} style={{ fontSize: 'var(--app-text-titel)', color: 'var(--app-text-chat)' }} />
          </button>
        </div>

        {user?.type === 'admin' && room && (room.type === 'group' || room.type === 'admin') && (
          <div style={{
            margin: 'var(--app-abstand-eng) var(--app-abstand-basis) 0',
            padding: 'var(--app-abstand-eng) var(--app-abstand-mittel)',
            backgroundColor: 'rgba(0,0,0,0.05)',
            borderRadius: 'var(--app-radius-klein)',
            fontSize: 'var(--app-text-hinweis)',
            color: 'var(--app-text-secondary)',
            textAlign: 'center'
          }}>
            Die Leitung kann Chats nicht verlassen. Chats können nur gelöscht werden.
          </div>
        )}

        {messages.length > 0 && (
          <ChatVerlaufAnfang
            laedt={laedtAeltere}
            fehler={aeltereFehlgeschlagen}
            anfang={anfangErreicht(messages, anfangBei)}
            onErneutLaden={() => { ladeAeltere(true); }}
          />
        )}

        <ChatMessagesList
          messages={messages}
          initialUnreadRef={initialUnreadRef}
          newDividerAnchorRef={newDividerAnchorRef}
          newDividerRef={newDividerRef}
          room={room}
          user={user}
          selectedMessage={selectedMessage}
          showReactionPicker={showReactionPicker}
          reactionTargetMessage={reactionTargetMessage}
          onLongPress={handleLongPress}
          onReply={setReplyToMessage}
          onShare={handleShareMessage}
          onDelete={deleteMessage}
          onToggleReaction={toggleReaction}
          onOpenReactionPicker={openReactionPicker}
          onVoteInPoll={voteInPoll}
          onFileClick={handleFileClick}
          ladendeDatei={ladendeDatei}
          uploadFortschritt={uploadFortschritt}
          onError={setError}
          // Abwählen schließt auch den Reaktions-Picker (Escape darin, 27.09.2026).
          // Nach Antworten und Löschen ist er ohnehin zu -- dort ändert sich nichts.
          onDeselectMessage={auswahlAufheben}
          textareaRef={textareaRef}
          onRetry={handleRetryMessage}
        />
      </IonContent>

      <MessageInput
        messageText={messageText}
        uploading={uploading}
        selectedFile={selectedFile}
        selectedFilePreview={selectedFilePreview}
        replyToMessage={replyToMessage}
        textareaRef={textareaRef}
        onTextChange={handleTextInputChange}
        onFocus={handleTextareaFocus}
        onSend={sendMessage}
        onDateiWaehlen={dateiWaehlen}
        onClearFile={clearSelectedFile}
        onClearReply={() => setReplyToMessage(null)}
      />

    </>
  );
};

export default ChatRoom;
