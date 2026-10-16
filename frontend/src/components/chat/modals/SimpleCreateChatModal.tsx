// „Neuer Chat" als Modal der App. Laden, Filter, Prüfung und die beiden Wege
// zum Server stehen in useNeuerChat -- derselbe Hook wie im Dialog des
// Browsers ab 992 px (web/WebNeuerChatDialog.tsx; Simon, 15.10.2026: „neuer
// chat modal ist noch app"). Hier steht nur die Darstellung der App.
import React, { useRef } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonButtons,
  IonIcon,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonInput,
  IonSpinner,
  IonSegment,
  IonSegmentButton,
  IonList,
  IonItem,
  IonItemGroup,
  IonListHeader,
  IonCard,
  IonCardContent,
  useIonAlert
} from '@ionic/react';
import {
  ICON_FILTER,
  ICON_GRUPPE,
  ICON_GRUPPE_GEFUELLT,
  ICON_HAKEN,
  ICON_OFFLINE,
  ICON_PERSON,
  ICON_PERSON_GEFUELLT,
  ICON_SCHLIESSEN,
  ICON_SUCHE_GEFUELLT,
  ICON_TERMIN_GEFUELLT,
} from '../../shared/icons';
import { ChatUser } from '../../../types/user';
import { istTeamTyp } from '../../../utils/chatRoles';
import { rollenDarstellung } from '../../../utils/rollenNamen';
import { tastaturKlick } from '../../../utils/tastatur';
import { personName, useNeuerChat } from '../useNeuerChat';

interface SimpleCreateChatModalProps {
  onClose: () => void;
  // roomId der neu erstellten/gefundenen Unterhaltung -> Aufrufer kann direkt
  // in den Chat navigieren statt auf der Liste zu landen.
  onSuccess: (roomId?: number) => void;
  dismiss?: () => void;
}

const SimpleCreateChatModal: React.FC<SimpleCreateChatModalProps> = ({ onClose, onSuccess, dismiss }) => {
  const [presentUnsavedAlert] = useIonAlert();
  const pageRef = useRef<HTMLElement>(null);

  const doClose = () => {
    if (dismiss) {
      dismiss();
    } else {
      onClose();
    }
  };

  const {
    isOnline,
    isAdmin,
    isTeamer,
    chatType,
    setChatType,
    isDirty,
    filteredUsers,
    loading,
    creating,
    searchText,
    setSearchText,
    selectedRole,
    setSelectedRole,
    selectedJahrgang,
    setSelectedJahrgang,
    availableJahrgaenge,
    groupName,
    setGroupName,
    selectedParticipants,
    handleParticipantToggle,
    createDirectMessage,
    createGroupChat,
    isFormValid,
    zuruecksetzen,
  } = useNeuerChat({
    // Erst schliessen (und alles auf Anfang), dann meldet der Aufrufer den Raum.
    onAngelegt: (roomId) => {
      handleModalClose();
      onSuccess(roomId);
    },
  });

  const handleClose = () => {
    if (isDirty) {
      presentUnsavedAlert({
        header: 'Ungespeicherte Änderungen',
        message: 'Möchtest du die Änderungen verwerfen?',
        buttons: [
          { text: 'Abbrechen', role: 'cancel' },
          { text: 'Verwerfen', role: 'destructive', handler: () => doClose() }
        ]
      });
    } else {
      doClose();
    }
  };

  const handleModalClose = () => {
    zuruecksetzen();
    doClose();
  };

  const getUserDisplayName = (user: ChatUser) => personName(user);

  return (
    <IonPage ref={pageRef}>
      {/* Fixierter Header */}
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton className="app-modal-close-btn" onClick={handleClose} disabled={creating} aria-label="Schließen">
              <IonIcon icon={ICON_SCHLIESSEN} slot="icon-only" />
            </IonButton>
          </IonButtons>
          <IonTitle>{chatType === 'direct' ? 'Neue Direktnachricht' : 'Neuer Gruppenchat'}</IonTitle>
          {chatType === 'group' && (
            <IonButtons slot="end">
              <IonButton className="app-modal-submit-btn app-modal-submit-btn--chat" onClick={createGroupChat} disabled={!isFormValid || creating || !isOnline} aria-label="Gruppenchat erstellen">
                {!isOnline ? <><IonIcon icon={ICON_OFFLINE} /> Du bist offline</> : creating ? <IonSpinner name="crescent" /> : <IonIcon icon={ICON_HAKEN} slot="icon-only" />}
              </IonButton>
            </IonButtons>
          )}
        </IonToolbar>
        {/* Segment im Header für Admin und Teamer:innen */}
        {(isAdmin || isTeamer) && (
          <IonToolbar>
            <IonSegment
              value={chatType}
              onIonChange={(e) => setChatType(e.detail.value as 'direct' | 'group')}
            >
              <IonSegmentButton value="direct">
                <IonLabel>Direktnachricht</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="group">
                <IonLabel>Gruppenchat</IonLabel>
              </IonSegmentButton>
            </IonSegment>
          </IonToolbar>
        )}
      </IonHeader>

      <IonContent className="app-gradient-background">

          {/* Gruppenname Input für Group Chat - iOS26 Pattern */}
          {chatType === 'group' && (
            <IonList inset={true} className="app-modal-section">
              <IonListHeader>
                <div className="app-section-icon app-section-icon--chat">
                  <IonIcon icon={ICON_GRUPPE} />
                </div>
                <IonLabel>Gruppenname</IonLabel>
              </IonListHeader>
              <IonItemGroup>
                <IonItem>
                  <IonInput aria-label="Gruppenname eingeben"
                    value={groupName}
                    onIonInput={(e) => setGroupName(e.detail.value!)}
                    placeholder="Gruppenname eingeben"
                    clearInput={true}
                    disabled={creating}
                  />
                </IonItem>
              </IonItemGroup>
            </IonList>
          )}

          {/* Filter mit Suche - iOS26 Pattern */}
          <IonList inset={true} className="app-modal-section">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--chat">
                <IonIcon icon={ICON_FILTER} />
              </div>
              <IonLabel>Suche & Filter</IonLabel>
            </IonListHeader>
            <IonItemGroup>
              {/* Suchfeld */}
              <IonItem>
                <IonIcon
                  icon={ICON_SUCHE_GEFUELLT}
                  slot="start"
                  style={{
                    color: 'var(--app-text-system)',
                    fontSize: 'var(--app-text-standard)'
                  }}
                />
                <IonInput aria-label="Person suchen"
                  value={searchText}
                  onIonInput={(e) => setSearchText(e.detail.value!)}
                  placeholder="Person suchen..."
                />
              </IonItem>
              {/* Rolle Filter - für Admins und Teamer:innen */}
              {(isAdmin || isTeamer) && (
                <IonItem>
                  <IonIcon
                    icon={ICON_PERSON}
                    slot="start"
                    style={{ color: 'var(--app-text-system)', fontSize: 'var(--app-text-standard)' }}
                  />
                  <IonSelect aria-label="Nach Rolle filtern"
                    value={selectedRole}
                    onIonChange={(e) => setSelectedRole(e.detail.value!)}
                    placeholder="Alle Rollen"
                    interface="popover"
                    interfaceOptions={{ arrow: false }}
                    style={{ width: '100%' }}
                  >
                    <IonSelectOption value="alle">Alle</IonSelectOption>
                    <IonSelectOption value="konfi">Konfis</IonSelectOption>
                    <IonSelectOption value="admin">Team</IonSelectOption>
                  </IonSelect>
                </IonItem>
              )}
              {/* Jahrgang Filter - für Admins und Teamer:innen */}
              {(isAdmin || isTeamer) && availableJahrgaenge.length > 0 && (
                <IonItem>
                  <IonIcon
                    icon={ICON_TERMIN_GEFUELLT}
                    slot="start"
                    style={{ color: 'var(--app-text-system)', fontSize: 'var(--app-text-standard)' }}
                  />
                  <IonSelect aria-label="Nach Jahrgang filtern"
                    value={selectedJahrgang}
                    onIonChange={(e) => setSelectedJahrgang(e.detail.value!)}
                    placeholder="Alle Jahrgänge"
                    interface="popover"
                    interfaceOptions={{ arrow: false }}
                    style={{ width: '100%' }}
                  >
                    <IonSelectOption value="alle">Alle Jahrgänge</IonSelectOption>
                    {availableJahrgaenge.map(jg => (
                      <IonSelectOption key={jg} value={jg}>{jg}</IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>
              )}
            </IonItemGroup>
          </IonList>

          {/* Users List - IonListHeader ueber der Card */}
          <IonList inset={true} className="app-modal-section">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--chat">
                <IonIcon icon={ICON_GRUPPE} />
              </div>
              <IonLabel>Personen ({filteredUsers.length})</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent style={{ padding: filteredUsers.length === 0 ? 'var(--app-abstand-basis)' : 'var(--app-abstand-mittel)' }}>
                {loading ? (
                  <div style={{ padding: 'var(--app-abstand-riesig) var(--app-abstand-gross)', textAlign: 'center' }}>
                    <IonSpinner name="crescent" />
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div style={{
                    padding: 'var(--app-abstand-riesig) var(--app-abstand-gross)',
                    textAlign: 'center',
                    color: 'var(--app-text-secondary)'
                  }}>
                    <IonIcon icon={ICON_SUCHE_GEFUELLT} style={{ fontSize: 'var(--app-anzeige-riesig)', opacity: 0.3, marginBottom: 'var(--app-abstand-basis)' }} />
                    <p style={{ margin: '0', fontSize: 'var(--app-text-standard)' }}>Keine Personen gefunden</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {filteredUsers.map((targetUser) => {
                      const participantId = `${targetUser.type}-${targetUser.id}`;
                      const isSelected = selectedParticipants.has(participantId);
                      // Teamer:innen gehören zum Team, nicht zu den Konfis —
                      // sonst Konfi-Farbe und keine Funktionsbezeichnung.
                      const isAdmin = istTeamTyp(targetUser.type);
                      // Strich, Kreis, Eck-Marke und Schrift in der Farbe der
                      // Rolle, aus EINER Stelle (utils/rollenNamen:
                      // rollenDarstellung, 02.10.2026). Konfis wie bisher.
                      const rolle = rollenDarstellung(isAdmin ? targetUser : 'konfi');

                      return (
                        <div role="button" tabIndex={0} onKeyDown={tastaturKlick}
                          key={participantId}
                          className={`app-list-item ${rolle.strich}${isSelected ? ' app-list-item--selected' : ''}`}
                          onClick={() => {
                            if (!creating) {
                              if (chatType === 'direct') {
                                createDirectMessage(targetUser);
                              } else {
                                handleParticipantToggle(participantId);
                              }
                            }
                          }}
                          style={{
                            cursor: creating ? 'default' : 'pointer',
                            opacity: creating ? 0.6 : 1,
                            position: 'relative',
                            overflow: 'hidden'
                          }}
                        >
                          {/* Eselsohr mit Rolle als Icon, im Team in der Farbe
                              der Rolle: Gemeindeleitung Indigo, Leitung Petrol,
                              Teamer:in Beere. */}
                          <div className="app-corner-badges">
                            <div
                              className={`app-corner-badge ${rolle.marke}`}
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--app-abstand-mini) var(--app-abstand-eng)' }}
                              title={isAdmin ? (targetUser.role_description || 'Leitung') : 'Konfi'}
                              role="img"
                              aria-label={isAdmin ? (targetUser.role_description || 'Leitung') : 'Konfi'}
                            >
                              <IonIcon icon={isAdmin ? ICON_GRUPPE_GEFUELLT : ICON_PERSON_GEFUELLT} style={{ color: 'white', fontSize: 'var(--app-text-sekundaer)' }} />
                            </div>
                          </div>

                          <div className="app-list-item__row" style={chatType === 'group' ? { paddingRight: 'var(--app-abstand-eng)' } : undefined}>
                            <div className="app-list-item__main">
                              <div className={`app-icon-circle app-icon-circle--lg ${rolle.kreis}`}>
                                <IonIcon icon={ICON_PERSON_GEFUELLT} />
                              </div>
                              <div className="app-list-item__content">
                                <div className="app-list-item__title" style={{ paddingRight: 'var(--app-freiraum-aktion-l)' }}>
                                  {getUserDisplayName(targetUser)}
                                </div>
                                {isAdmin && targetUser.role_description && (
                                  <div className="app-list-item__meta">
                                    <span className="app-list-item__meta-item">
                                      <IonIcon icon={ICON_GRUPPE} className={rolle.schrift} />
                                      {targetUser.role_description}
                                    </span>
                                  </div>
                                )}
                                {!isAdmin && (targetUser.jahrgang_name || targetUser.jahrgang) && (
                                  <div className="app-list-item__meta">
                                    <span className="app-list-item__meta-item">
                                      <IonIcon icon={ICON_TERMIN_GEFUELLT} style={{ color: 'var(--app-text-jahrgang)' }} />
                                      {targetUser.jahrgang_name || targetUser.jahrgang}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>

                          </div>
                        </div>
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
};

export default SimpleCreateChatModal;
