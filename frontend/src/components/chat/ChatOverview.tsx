import React from 'react';
import { useAppLocation } from '../../navigation/useAppLocation';
import {
  IonPage,
  IonContent,
  IonItem,
  IonInput,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonCard,
  IonCardContent,
  IonButton,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonList,
  IonListHeader,
  IonItemGroup,
  IonLabel,
  IonSegment,
  IonSegmentButton,
} from '@ionic/react';
import AppKopfzeile, { AppKopfzeileGross } from '../shared/AppKopfzeile';
import {
  ICON_CHATS,
  ICON_CHATS_GEFUELLT,
  ICON_FILTER,
  ICON_GRUPPE_GEFUELLT,
  ICON_HINZUFUEGEN_GEFUELLT,
  ICON_LOESCHEN_GEFUELLT,
  ICON_PERSON_GEFUELLT,
  ICON_SUCHE_GEFUELLT,
  ICON_TERMIN_GEFUELLT,
  ICON_UHRZEIT_GEFUELLT,
} from '../shared/icons';

import ZaehlerKugel from '../shared/ZaehlerKugel';
import { SectionHeader, EmptyState } from '../shared';
import { useModalPage } from '../../contexts/ModalContext';
import LoadingSpinner from '../common/LoadingSpinner';
import { ChatRoomOverview } from '../../types/chat';
import { triggerPullHaptic } from '../../utils/haptics';
import { closeOpenSlidingItems } from '../../utils/slidingItems';
import { raumAnzeigeName, raumArt, raumFarbe, raumSymbol, zeitKurz } from './chatRaeume';
import { useChatUebersicht } from './useChatUebersicht';
import { CHAT_LEER, chatReiterFuer } from '../../seiten/chats';

interface ChatOverviewProps {
  onSelectRoom: (room: ChatRoomOverview) => void;
  // Im iPad-Split-View aktuell rechts geoeffneter Raum (für Highlighting).
  selectedRoomId?: number | null;
}

interface ChatOverviewRef {
  loadChatRooms: () => void;
}

const ChatOverview = React.forwardRef<ChatOverviewRef, ChatOverviewProps>(({ onSelectRoom, selectedRoomId }, ref) => {
  // Laden, Live-Updates, Suche, Reiter, Neuer Chat und Loeschen liegen in
  // useChatUebersicht -- dieselbe Quelle wie die Raumliste der Web-Fassung.
  const {
    rooms,
    loading,
    refresh,
    chatUnreadByRoom,
    searchText,
    setSearchText,
    filterType,
    setFilterType,
    isAdmin,
    gehoertZumTeam,
    filteredRooms,
    user,
    neuenChatStarten,
    deleteRoom,
  } = useChatUebersicht({ onSelectRoom });

  // Nutze den useModalPage Hook, um die Seite zu registrieren
  const location = useAppLocation();
  // Bestimme die korrekte Tab-ID basierend auf dem Pfad
  const tabId = location.pathname.startsWith('/admin') ? 'admin-chat' : 'chat';
  const { pageRef } = useModalPage(tabId);

  const handleCreateNewChat = () => {
    neuenChatStarten(pageRef.current || undefined);
  };

  // Expose refresh to parent component (backward-compatible as loadChatRooms)
  React.useImperativeHandle(ref, () => ({
    loadChatRooms: () => refresh()
  }));

  const getRoomColorClass = raumFarbe;
  const formatLastMessageTime = (dateString: string) => zeitKurz(dateString);
  const getDisplayRoomName = (room: ChatRoomOverview) => raumAnzeigeName(room, user?.id);
  const getRoomIcon = raumSymbol;
  const getRoomSubtitle = raumArt;

  const getRoomTypeIcon = (room: ChatRoomOverview) => {
    if (room.event_id) return ICON_TERMIN_GEFUELLT;
    if (room.type === 'jahrgang') return ICON_GRUPPE_GEFUELLT;
    if (room.type === 'admin' || room.type === 'group') return ICON_CHATS_GEFUELLT;
    if (room.type === 'direct') return ICON_PERSON_GEFUELLT;
    return ICON_CHATS_GEFUELLT;
  };

  if (loading) {
    return <LoadingSpinner message="Chaträume werden geladen..." />;
  }

  return (
    <IonPage ref={pageRef}>
      <AppKopfzeile
        titel="Chat"
        rechts={(
          <IonButton aria-label="Neuen Chat starten" onClick={handleCreateNewChat}>
            <IonIcon icon={ICON_HINZUFUEGEN_GEFUELLT} />
          </IonButton>
        )}
      />

      <IonContent className="app-gradient-background" fullscreen>
        <AppKopfzeileGross titel="Chat" />

        <IonRefresher slot="fixed" onIonRefresh={async (e) => {
          await refresh();
          e.detail.complete();
        }} onIonPull={triggerPullHaptic}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>

        <SectionHeader
          title="Deine Chats"
          subtitle="Nachrichten und Gruppen"
          icon={ICON_CHATS_GEFUELLT}
          colors={{ primary: 'var(--app-color-chat)', secondary: 'var(--app-color-chat-dunkel)' }}
          stats={[
            // CHATS und UNGELESEN entsprechen je einem Reiter und schalten
            // dorthin (gleiches Muster wie Challenges/Anfragen/Nutzende).
            // AKTIV hat keinen Reiter und bleibt reine Anzeige.
            {
              value: (rooms || []).length,
              label: 'CHATS',
              onClick: () => setFilterType('alle'),
              active: filterType === 'alle'
            },
            {
              value: Object.values(chatUnreadByRoom).reduce((sum, c) => sum + c, 0),
              label: 'UNGELESEN',
              onClick: () => setFilterType('ungelesen'),
              active: filterType === 'ungelesen'
            },
            { value: (rooms || []).filter(room => room.last_message && new Date(room.last_message.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length, label: 'AKTIV' }
          ]}
        />

        {/* Reiter ZUERST, Suche darunter (Simon, 06.09.2026): "dann
            filtert man erst und dann sucht man." Vorher stand die Suche
            oben -- man tippte einen Namen und schraenkte danach die Menge
            ein, also gegen die eigene Erwartung. */}
        <div className="app-segment-wrapper">
          <IonSegment value={filterType} onIonChange={(e) => setFilterType(String(e.detail.value))}>
            {/* Reiter aus der gemeinsamen Beschreibung (seiten/chats.ts); "Team" nur fuers Team. */}
            {chatReiterFuer(gehoertZumTeam).map((r) => (
              <IonSegmentButton key={r.schluessel} value={r.schluessel}><IonLabel>{r.kurz ?? r.label}</IonLabel></IonSegmentButton>
            ))}
          </IonSegment>
        </div>

        {/* Suche -- steht UNTER den Reitern, siehe Kommentar oben */}
        <IonList inset={true} style={{ margin: 'var(--app-abstand-basis)' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--chat">
              <IonIcon icon={ICON_FILTER} />
            </div>
            <IonLabel>Suche</IonLabel>
          </IonListHeader>
          <IonItemGroup>
            <IonItem>
              <IonIcon
                icon={ICON_SUCHE_GEFUELLT}
                slot="start"
                style={{
                  color: 'var(--app-text-system)',
                  fontSize: 'var(--app-text-standard)'
                }}
              />
              <IonInput aria-label="Chaträume durchsuchen"
                value={searchText}
                onIonInput={(e) => setSearchText(e.detail.value!)}
                placeholder="Chaträume durchsuchen..."
              />
            </IonItem>
          </IonItemGroup>
        </IonList>

        {/* Chat Rooms Liste - Karten-Design mit farbigem Rand + Swipe */}
        <IonList inset={true} style={{ margin: 'var(--app-abstand-basis)' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--chat">
              <IonIcon icon={ICON_CHATS} />
            </div>
            <IonLabel>Chats ({filteredRooms.length})</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: filteredRooms.length === 0 ? 'var(--app-abstand-basis)' : 'var(--app-abstand-mittel)' }}>
              {filteredRooms.length === 0 ? (
                <EmptyState
                  icon={ICON_CHATS_GEFUELLT}
                  // Wie im Browser: ohne Raeume die Einladung, mit Suche oder
                  // Reiter der Hinweis darauf (seiten/chats.ts). Bis 09.10.2026
                  // stand hier immer "Erstelle deinen ersten Chat!".
                  title={(searchText.trim() !== '' || filterType !== 'alle') ? CHAT_LEER.gefiltert.titel : CHAT_LEER.keine.titel}
                  message={(searchText.trim() !== '' || filterType !== 'alle') ? CHAT_LEER.gefiltert.text : CHAT_LEER.keine.text}
                  iconColor="var(--app-color-chat)"
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {filteredRooms.map((room) => {
                    const colorClass = getRoomColorClass(room);
                    // Nur Admins dürfen direct/group Chats löschen
                    const canDelete = isAdmin && (room.type === 'direct' || room.type === 'group');

                    return (
                      <IonItemSliding key={room.id} disabled={!canDelete}>
                        <IonItem
                          onClick={() => onSelectRoom(room)}
                          lines="none"
                          detail={false}
                          style={{
                            '--background': 'transparent',
                            '--padding-start': '0',
                            '--padding-end': '0',
                            '--inner-padding-end': '0',
                            '--inner-border-width': '0',
                            '--border-style': 'none',
                            '--min-height': 'auto'
                          }}
                        >
                          <div
                            className={`app-list-item app-list-item--${colorClass}${selectedRoomId === room.id ? ' app-list-item--selected' : ''}`}
                            style={{
                              width: '100%',
                              position: 'relative',
                              overflow: 'hidden'
                            }}
                          >
                            {/* Eselsohr-Style Corner Badge - Chat-Typ als Icon */}
                            <div className="app-corner-badges">
                              <div
                                className={`app-corner-badge app-corner-badge--${colorClass}`}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--app-abstand-mini) var(--app-abstand-eng)' }}
                                title={getRoomSubtitle(room)}
                                role="img"
                                aria-label={getRoomSubtitle(room)}
                              >
                                <IonIcon icon={getRoomTypeIcon(room)} style={{ color: 'white', fontSize: 'var(--app-text-sekundaer)' }} />
                              </div>
                            </div>

                            <div className="app-list-item__row">
                              <div className="app-list-item__main">
                                {/* Symbol mit Zaehler-Kugel; Lage siehe .app-zaehler-anker */}
                                <div className="app-zaehler-anker">
                                  <div
                                    className={`app-icon-circle app-icon-circle--lg app-icon-circle--${colorClass}`}
                                  >
                                    <IonIcon icon={getRoomIcon(room)} />
                                  </div>
                                  <ZaehlerKugel
                                    anzahl={chatUnreadByRoom[room.id] ?? room.unread_count ?? 0}
                                    label="ungelesene Nachrichten"
                                  />
                                </div>

                                {/* Content */}
                                <div className="app-list-item__content">
                                  <div
                                    className="app-list-item__title"
                                    style={{
                                      paddingRight: 'var(--app-abstand-riesig)',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    {getDisplayRoomName(room)}
                                  </div>
                                  <div className="app-list-item__meta">
                                    {room.last_message?.created_at && (
                                      <span className="app-list-item__meta-item">
                                        <IonIcon icon={ICON_UHRZEIT_GEFUELLT} style={{ color: 'var(--app-text-events)' }} />
                                        {formatLastMessageTime(room.last_message.created_at)}
                                      </span>
                                    )}
                                    {room.type !== 'direct' && (
                                      <span className="app-list-item__meta-item">
                                        <IonIcon icon={ICON_GRUPPE_GEFUELLT} style={{ color: 'var(--app-color-success)' }} />
                                        {room.participant_count || 0}
                                      </span>
                                    )}
                                  </div>
                                  {/* Letzte Nachricht */}
                                  {room.last_message && (room.last_message.content || room.last_message.file_name) && (
                                    <div className="app-list-item__subtitle" style={{
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 'var(--app-abstand-mini)'
                                    }}>
                                      <IonIcon icon={ICON_CHATS_GEFUELLT} style={{ fontSize: 'var(--app-text-klein)', color: 'var(--app-text-system)', flexShrink: 0 }} />
                                      <span style={{ fontWeight: 'var(--app-schrift-halbfett)', color: 'var(--app-text-primary)' }}>
                                        {room.last_message.sender_name}:
                                      </span>{' '}
                                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {room.last_message.content || room.last_message.file_name || 'Datei'}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </IonItem>

                        {/* Swipe Delete für direct/group chats */}
                        {canDelete && (
                          <IonItemOptions side="end" className="app-swipe-actions">
                            <IonItemOption
                              onClick={() => { closeOpenSlidingItems(); deleteRoom(room); }}
                              aria-label="Chat löschen"
                              className="app-swipe-action"
                            >
                              <div className="app-icon-circle app-icon-circle--lg app-icon-circle--danger">
                                <IonIcon icon={ICON_LOESCHEN_GEFUELLT} />
                              </div>
                            </IonItemOption>
                          </IonItemOptions>
                        )}
                      </IonItemSliding>
                    );
                  })}
                </div>
              )}
            </IonCardContent>
          </IonCard>
        </IonList>
      </IonContent>
    </IonPage>
  );
});

export default ChatOverview;