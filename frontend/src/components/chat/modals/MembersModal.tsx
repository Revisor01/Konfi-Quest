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
  IonList,
  IonItemGroup,
  IonListHeader,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonInput,
  IonItem,
  IonCard,
  IonCardContent,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  useIonAlert
} from '@ionic/react';
import {
  ICON_FILTER,
  ICON_GRUPPE,
  ICON_GRUPPE_GEFUELLT,
  ICON_HAKEN,
  ICON_LOESCHEN_GEFUELLT,
  ICON_OFFLINE,
  ICON_PERSON_GEFUELLT,
  ICON_PERSON_HINZUFUEGEN,
  ICON_SCHLIESSEN,
  ICON_SUCHE_GEFUELLT,
  ICON_TERMIN_GEFUELLT,
} from '../../shared/icons';
import LoadingSpinner from '../../common/LoadingSpinner';
import { ChatUser } from '../../../types/user';
import { triggerPullHaptic } from '../../../utils/haptics';
import { closeOpenSlidingItems } from '../../../utils/slidingItems';
import { tastaturKlick } from '../../../utils/tastatur';
import { rollenDarstellung } from '../../../utils/rollenNamen';
import {
  MITGLIED_ENTFERNEN_TITEL,
  anzeigeName,
  istTeamPerson,
  jahrgangVon,
  mitgliedEntfernenFrage,
  personKennung,
  rollenText,
  useChatMitglieder,
  type ChatTeilnehmer,
} from '../useChatMitglieder';

interface MembersModalProps {
  onClose: () => void;
  onSuccess: () => void;
  roomId: number;
  roomType: string;
  presentingElement?: HTMLElement | null;
}

const MembersModal: React.FC<MembersModalProps> = ({
  onClose,
  onSuccess,
  roomId,
  roomType
}) => {
  const [presentRemoveAlert] = useIonAlert();
  const pageRef = useRef<HTMLElement>(null);

  // Laden, Auswahl, Rechte und die Wege zum Server: useChatMitglieder --
  // dieselbe Logik wie im Dialog des Browsers (web/WebMitgliederDialog).
  const {
    isOnline, sortedParticipants, loading, adding, showAddMode, setShowAddMode,
    searchText, setSearchText, selectedUsers, canManageMembers, filteredAvailableUsers,
    loadParticipants, loadAllUsers, handleUserToggle, addSelectedUsers,
    entfernenOfflineBlockiert, mitgliedEntfernen, zuruecksetzen,
  } = useChatMitglieder({ roomId, roomType });

  const hinzufuegen = async () => {
    if (await addSelectedUsers()) onSuccess();
  };

  const confirmRemoveUser = (participant: ChatTeilnehmer) => {
    if (entfernenOfflineBlockiert()) return;
    presentRemoveAlert({
      header: MITGLIED_ENTFERNEN_TITEL,
      message: mitgliedEntfernenFrage(participant.name),
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Entfernen',
          role: 'destructive',
          handler: async () => {
            if (await mitgliedEntfernen(participant)) onSuccess();
          }
        }
      ]
    });
  };

  const handleClose = () => {
    zuruecksetzen();
    onClose();
  };

  // Render User Item - mit CSS-Klassen
  const renderUserItem = (
    targetUser: ChatUser | ChatTeilnehmer,
    isSelectable: boolean,
    isSelected: boolean,
    onToggle?: () => void
  ) => {
    const isTeam = istTeamPerson(targetUser);
    const name = anzeigeName(targetUser);
    const participantId = `${isTeam ? 'admin' : 'konfi'}-${'user_id' in targetUser ? targetUser.user_id : targetUser.id}`;
    const roleText = rollenText(targetUser);
    const jahrgang = jahrgangVon(targetUser);
    // Strich, Kreis, Eck-Marke und Schrift in der Farbe der Rolle -- aus EINER
    // Stelle (utils/rollenNamen: rollenDarstellung, 02.10.2026). Bis dahin
    // las nur die Eck-Marke die Rolle; Strich und Kreis trugen die
    // allgemeine Team-Farbe (Beere) auch fuer jede Leitung. Ohne Rolle in der
    // Antwort entscheidet der Typ; Konfis bleiben in ihrer Farbe.
    const rolle = rollenDarstellung(isTeam ? targetUser : 'konfi');

    return (
      <div role={isSelectable ? 'button' : undefined} tabIndex={isSelectable ? 0 : undefined} onKeyDown={isSelectable ? tastaturKlick : undefined} aria-pressed={isSelectable ? isSelected : undefined}
        key={participantId}
        className={`app-list-item ${rolle.strich} ${isSelected ? 'app-list-item--selected' : ''}`}
        onClick={isSelectable ? onToggle : undefined}
        style={{ cursor: isSelectable ? 'pointer' : 'default', position: 'relative', overflow: 'hidden', width: '100%' }}
      >
        {/* Eselsohr mit Rolle als Icon */}
        <div className="app-corner-badges">
          <div
            className={`app-corner-badge ${rolle.marke}`}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--app-abstand-mini) var(--app-abstand-eng)' }}
            title={roleText}
            role="img"
            aria-label={roleText}
          >
            <IonIcon icon={isTeam ? ICON_GRUPPE_GEFUELLT : ICON_PERSON_GEFUELLT} style={{ color: 'white', fontSize: 'var(--app-text-sekundaer)' }} />
          </div>
        </div>

        <div className="app-list-item__row">
          <div className="app-list-item__main">
            <div className={`app-icon-circle app-icon-circle--lg ${rolle.kreis}`}>
              <IonIcon icon={ICON_PERSON_GEFUELLT} />
            </div>
            <div className="app-list-item__content">
              <div className="app-list-item__title" style={{ paddingRight: 'var(--app-freiraum-aktion-l)' }}>{name}</div>
              {/* Meta-Zeile: Jahrgang fuer Konfi, Rolle/Funktion fuer Team (Admin/Teamer) */}
              {isTeam && roleText && (
                <div className="app-list-item__meta">
                  <span className="app-list-item__meta-item">
                    <IonIcon icon={ICON_GRUPPE} className={rolle.schrift} />
                    {roleText}
                  </span>
                </div>
              )}
              {!isTeam && jahrgang && (
                <div className="app-list-item__meta">
                  <span className="app-list-item__meta-item">
                    <IonIcon icon={ICON_TERMIN_GEFUELLT} style={{ color: 'var(--app-text-jahrgang)' }} />
                    {jahrgang}
                  </span>
                </div>
              )}
            </div>
          </div>
          {/* Keine Checkbox / kein Haekchen: die Auswahl wird allein ueber die
              Hintergrundfaerbung des Listen-Elements (app-list-item--selected)
              markiert — konsistent mit allen anderen Auswahllisten der App. */}
        </div>
      </div>
    );
  };

  return (
    <IonPage ref={pageRef}>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton className="app-modal-close-btn" onClick={handleClose} aria-label="Schließen">
              <IonIcon icon={ICON_SCHLIESSEN} slot="icon-only" />
            </IonButton>
          </IonButtons>

          <IonTitle>
            {showAddMode ? 'Mitglied hinzufügen' : 'Mitglieder'}
          </IonTitle>

          {canManageMembers && (
            <IonButtons slot="end">
              {showAddMode ? (
                <IonButton
                  className="app-modal-submit-btn app-modal-submit-btn--chat"
                  onClick={hinzufuegen}
                  disabled={selectedUsers.size === 0 || adding || !isOnline}
                  aria-label="Ausgewählte Mitglieder hinzufügen"
                >
                  {!isOnline ? <><IonIcon icon={ICON_OFFLINE} /> Du bist offline</> : adding ? <IonSpinner name="crescent" /> : <IonIcon icon={ICON_HAKEN} slot="icon-only" />}
                </IonButton>
              ) : (
                <IonButton onClick={() => setShowAddMode(true)} aria-label="Mitglieder hinzufügen">
                  <IonIcon icon={ICON_PERSON_HINZUFUEGEN} slot="icon-only" />
                </IonButton>
              )}
            </IonButtons>
          )}
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          Promise.all([loadParticipants(), loadAllUsers()]).finally(() => {
            e.detail.complete();
          });
        }} onIonPull={triggerPullHaptic}>
          <IonRefresherContent />
        </IonRefresher>

          {showAddMode ? (
            <>
              {/* Suche - iOS26 Pattern */}
              <IonList inset={true} className="app-modal-section">
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
                    <IonInput aria-label="Person suchen"
                      value={searchText}
                      onIonInput={(e) => setSearchText(e.detail.value!)}
                      placeholder="Person suchen..."
                    />
                  </IonItem>
                </IonItemGroup>
              </IonList>

              {/* Verfügbare Personen - IonListHeader über der Card */}
              <IonList inset={true} className="app-modal-section">
                <IonListHeader>
                  <div className="app-section-icon app-section-icon--chat">
                    <IonIcon icon={ICON_GRUPPE} />
                  </div>
                  <IonLabel>Verfügbare Personen ({filteredAvailableUsers.length})</IonLabel>
                </IonListHeader>
                <IonCard className="app-card">
                  <IonCardContent style={{ padding: filteredAvailableUsers.length === 0 ? 'var(--app-abstand-basis)' : 'var(--app-abstand-mittel)' }}>
                    {filteredAvailableUsers.length === 0 ? (
                      <div style={{
                        padding: 'var(--app-abstand-riesig) var(--app-abstand-gross)',
                        textAlign: 'center',
                        color: 'var(--app-text-secondary)'
                      }}>
                        <IonIcon icon={ICON_SUCHE_GEFUELLT} style={{ fontSize: 'var(--app-anzeige-riesig)', opacity: 0.3, marginBottom: 'var(--app-abstand-basis)' }} />
                        <p style={{ margin: '0', fontSize: 'var(--app-text-standard)' }}>Keine verfügbaren Personen gefunden</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {filteredAvailableUsers.map((u) => {
                          return renderUserItem(
                            u,
                            true,
                            selectedUsers.has(personKennung(u)),
                            () => handleUserToggle(u)
                          );
                        })}
                      </div>
                    )}
                  </IonCardContent>
                </IonCard>
              </IonList>
            </>
          ) : (
            <>
              {loading ? (
                <LoadingSpinner message="Mitglieder werden geladen..." />
              ) : (
                <IonList inset={true} className="app-modal-section">
                  <IonListHeader>
                    <div className="app-section-icon app-section-icon--chat">
                      <IonIcon icon={ICON_GRUPPE} />
                    </div>
                    <IonLabel>Mitglieder ({sortedParticipants.length})</IonLabel>
                  </IonListHeader>
                  <IonCard className="app-card">
                    <IonCardContent style={{ padding: sortedParticipants.length === 0 ? 'var(--app-abstand-basis)' : 'var(--app-abstand-mittel)' }}>
                      {sortedParticipants.length === 0 ? (
                        <div style={{
                          padding: 'var(--app-abstand-riesig) var(--app-abstand-gross)',
                          textAlign: 'center',
                          color: 'var(--app-text-secondary)'
                        }}>
                          <IonIcon icon={ICON_GRUPPE} style={{ fontSize: 'var(--app-anzeige-riesig)', opacity: 0.3, marginBottom: 'var(--app-abstand-basis)' }} />
                          <p style={{ margin: '0', fontSize: 'var(--app-text-standard)' }}>Keine Mitglieder</p>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {sortedParticipants.map((p) => (
                            <IonItemSliding key={`${p.user_type}-${p.user_id}`} disabled={!canManageMembers}>
                              <IonItem
                                detail={false}
                                lines="none"
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
                                {renderUserItem(p, false, false)}
                              </IonItem>
                              {canManageMembers && (
                                <IonItemOptions side="end" className="app-swipe-actions">
                                  <IonItemOption
                                    onClick={() => { closeOpenSlidingItems(); confirmRemoveUser(p); }}
                                    aria-label="Mitglied entfernen"
                                    className="app-swipe-action"
                                  >
                                    <div className="app-icon-circle app-icon-circle--lg app-icon-circle--danger">
                                      <IonIcon icon={ICON_LOESCHEN_GEFUELLT} />
                                    </div>
                                  </IonItemOption>
                                </IonItemOptions>
                              )}
                            </IonItemSliding>
                          ))}
                        </div>
                      )}
                    </IonCardContent>
                  </IonCard>
                </IonList>
              )}
            </>
          )}
      </IonContent>

    </IonPage>
  );
};

export default MembersModal;
