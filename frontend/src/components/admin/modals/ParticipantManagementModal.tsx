// Konfis, Team oder Leitung hinzufügen -- das Modal der App. Laden, Auswahl,
// Filter, Prüfung und der Weg zum Server stehen in useTeilnehmerHinzufuegen --
// derselbe Hook wie im Dialog des Browsers ab 992 px
// (web/termine/WebTeilnehmerHinzufuegenDialog.tsx; Simon, 15.10.2026). Hier
// stehen nur die Darstellung der App und ihre Rückfrage (Alert).
import React from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonButtons,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonIcon,
  IonInput,
  IonCard,
  IonCardContent,
  IonSelect,
  IonSelectOption,
  useIonAlert
} from '@ionic/react';
import {
  ICON_FILTER,
  ICON_HAKEN,
  ICON_OFFLINE,
  ICON_PERSON_GEFUELLT,
  ICON_PERSON_HINZUFUEGEN_GEFUELLT,
  ICON_SCHLIESSEN,
  ICON_SUCHE_GEFUELLT,
} from '../../shared/icons';
import { tastaturKlick } from '../../../utils/tastatur';
import type { UeberbuchenFrage } from '../../../utils/ueberbuchen';
import { rollenName, rollenDarstellung } from '../../../utils/rollenNamen';
import { personUnterzeile, useTeilnehmerHinzufuegen, zeitfensterBeschriftung, type HinzufuegenRolle } from './useTeilnehmerHinzufuegen';

interface ParticipantManagementModalProps {
  eventId: number;
  onClose: () => void;
  onSuccess: () => void;
  dismiss?: () => void;
  // 'leitung' = Admins/Org-Admins zuordnen (31.08.2026). Bewusst pro Termin;
  // niemand rutscht automatisch in einen Event-Chat.
  filterRole?: HinzufuegenRolle | null;
}

const ParticipantManagementModal: React.FC<ParticipantManagementModalProps> = ({
  eventId,
  onClose,
  onSuccess,
  dismiss,
  filterRole
}) => {
  const [presentAlert] = useIonAlert();

  const handleClose = () => {
    if (dismiss) {
      dismiss();
    } else {
      onClose();
    }
  };

  // Rueckfrage "voll -- trotzdem eintragen?" als Ja/Nein-Alert, wie beim
  // Bestaetigen von der Warteliste (EventDetailView). Tippen neben den Dialog
  // ist ein Nein; ein zweites resolve nach dem Button bleibt wirkungslos.
  const frageUeberbuchen = (frage: UeberbuchenFrage) => new Promise<boolean>((resolve) => {
    presentAlert({
      header: frage.header,
      message: frage.message,
      buttons: [
        { text: 'Abbrechen', role: 'cancel', handler: () => resolve(false) },
        { text: 'Trotzdem eintragen', handler: () => resolve(true) }
      ],
      onDidDismiss: () => resolve(false)
    });
  });

  const {
    isOnline,
    searchTerm,
    setSearchTerm,
    selectedJahrgang,
    setSelectedJahrgang,
    selectedTimeslot,
    setSelectedTimeslot,
    eventData,
    eventJahrgaenge,
    hasEventJahrgaenge,
    availableJahrgaenge,
    jahrgangsGrenzeAktiv,
    filteredKonfis,
    selectedKonfis,
    handleKonfiSelection,
    alleGewaehlt,
    alleUmschalten,
    handleAddParticipants,
    loading,
    isSubmitting,
  } = useTeilnehmerHinzufuegen({ eventId, filterRole, onSuccess, frageUeberbuchen });

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{filterRole === 'teamer' ? 'Teamer:in hinzufügen' : filterRole === 'leitung' ? 'Leitung hinzufügen' : filterRole === 'konfi' ? 'Kind hinzufügen' : 'Teilnehmer:innen verwalten'}</IonTitle>
          <IonButtons slot="start">
            {/* NICHT an loading haengen: Bleibt der Ladezustand haengen,
                waere das Modal sonst nur noch per Swipe zu verlassen.
                Die Rueckfrage bei ungespeicherten Aenderungen laeuft
                ueber canDismiss der Seite. */}
            <IonButton onClick={handleClose} className="app-modal-close-btn" aria-label="Schließen">
              <IonIcon icon={ICON_SCHLIESSEN} slot="icon-only" />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            {selectedKonfis.length > 0 && (
              <IonButton onClick={handleAddParticipants} disabled={loading || isSubmitting || !isOnline} className="app-modal-submit-btn app-modal-submit-btn--events" aria-label="Teilnehmer:innen hinzufügen">
                {!isOnline ? <><IonIcon icon={ICON_OFFLINE} /> Du bist offline</> : <IonIcon icon={ICON_HAKEN} slot="icon-only" />}
              </IonButton>
            )}
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">

          {/* Suche & Filter - iOS26 Pattern */}
          <IonList inset={true} className="app-modal-section">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--events">
                <IonIcon icon={ICON_FILTER} />
              </div>
              <IonLabel>Suche & Filter</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent>
                <IonList style={{ background: 'transparent' }}>
                  {/* Suchfeld */}
                  <IonItem lines={eventJahrgaenge.length !== 1 || (eventData?.has_timeslots && eventData.timeslots && eventData.timeslots.length > 0) ? 'full' : 'none'} style={{ '--background': 'transparent' }}>
                    <IonLabel position="stacked">Person suchen</IonLabel>
                    <IonInput aria-label="Person suchen"
                      value={searchTerm}
                      onIonInput={(e) => setSearchTerm(e.detail.value!)}
                      placeholder="Name eingeben..."
                      clearInput={true}
                    />
                  </IonItem>
                  {/* Jahrgang Filter - nur wenn Event mehrere Jahrgänge hat oder gar keine */}
                  {(eventJahrgaenge.length !== 1) && (
                    <IonItem lines={eventData?.has_timeslots && eventData.timeslots && eventData.timeslots.length > 0 ? 'full' : 'none'} style={{ '--background': 'transparent' }}>
                      <IonLabel position="stacked">Jahrgang</IonLabel>
                      <IonSelect aria-label="Jahrgang"
                        value={selectedJahrgang}
                        onIonChange={(e) => setSelectedJahrgang(e.detail.value!)}
                        placeholder="Jahrgang wählen"
                        interface="popover"
                        interfaceOptions={{ arrow: false }}
                      >
                        {hasEventJahrgaenge ? (
                          <>
                            <IonSelectOption value="alle">Alle Event-Jahrgänge</IonSelectOption>
                            {eventJahrgaenge.map(jg => (
                              <IonSelectOption key={jg} value={jg}>{jg}</IonSelectOption>
                            ))}
                          </>
                        ) : (
                          <>
                            <IonSelectOption value="alle">Alle Jahrgänge</IonSelectOption>
                            {availableJahrgaenge.map(jg => (
                              <IonSelectOption key={jg} value={jg}>{jg}</IonSelectOption>
                            ))}
                          </>
                        )}
                      </IonSelect>
                    </IonItem>
                  )}
                  {/* Zeitslot Auswahl */}
                  {eventData?.has_timeslots && eventData.timeslots && eventData.timeslots.length > 0 && (
                    <IonItem lines="none" style={{ '--background': 'transparent' }}>
                      <IonLabel position="stacked">Zeitslot</IonLabel>
                      <IonSelect aria-label="Zeitslot"
                        value={selectedTimeslot}
                        onIonChange={(e) => setSelectedTimeslot(e.detail.value)}
                        placeholder="Zeitslot wählen"
                        interface="popover"
                        interfaceOptions={{ arrow: false }}
                      >
                        <IonSelectOption value={null}>Zeitslot wählen...</IonSelectOption>
                        {eventData.timeslots.map((timeslot) => (
                          <IonSelectOption
                            key={timeslot.id}
                            value={timeslot.id}
                          >
                            {zeitfensterBeschriftung(timeslot)}
                          </IonSelectOption>
                        ))}
                      </IonSelect>
                    </IonItem>
                  )}
                </IonList>
              </IonCardContent>
            </IonCard>
          </IonList>

          {/* Personen Liste - iOS26 Pattern */}
          <IonList inset={true} className="app-modal-section">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--events">
                <IonIcon icon={ICON_PERSON_HINZUFUEGEN_GEFUELLT} />
              </div>
              <IonLabel>Personen ({filteredKonfis.length})</IonLabel>
              {filteredKonfis.length > 0 && (
                <IonButton
                  fill="clear"
                  size="small"
                  onClick={alleUmschalten}
                >
                  {alleGewaehlt ? 'Keine' : 'Alle'}
                </IonButton>
              )}
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent>
                {/* Warum jemand fehlt: Eine leere oder kuerzere Liste ohne
                    Erklaerung liesse die Leitung nach der Person suchen. */}
                {jahrgangsGrenzeAktiv && (
                  <p
                    data-testid="jahrgangs-hinweis"
                    style={{
                      margin: '0 0 var(--app-abstand-basis) 0',
                      fontSize: 'var(--app-text-klein)',
                      color: 'var(--app-text-secondary)'
                    }}
                  >
                    Angeboten werden nur Personen aus {eventJahrgaenge.length === 1 ? 'dem Jahrgang' : 'den Jahrgängen'} dieses
                    Events ({eventJahrgaenge.join(', ')}). Die Gemeindeleitung ist davon ausgenommen.
                  </p>
                )}
                {filteredKonfis.length === 0 ? (
                  <div style={{
                    padding: 'var(--app-abstand-riesig) var(--app-abstand-gross)',
                    textAlign: 'center',
                    color: 'var(--app-text-secondary)'
                  }}>
                    <IonIcon icon={ICON_SUCHE_GEFUELLT} style={{ fontSize: 'var(--app-anzeige-riesig)', opacity: 0.3, marginBottom: 'var(--app-abstand-basis)' }} />
                    <p style={{ margin: '0', fontSize: 'var(--app-text-standard)' }}>
                      {jahrgangsGrenzeAktiv
                        ? 'Keine passenden Personen — nur wer zu einem Jahrgang dieses Events gehört, lässt sich eintragen'
                        : 'Keine Personen gefunden'}
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--app-abstand-eng)' }}>
                    {filteredKonfis.map((konfi) => {
                      const isSelected = selectedKonfis.includes(konfi.id);
                      // Team und Leitung in der Farbe ihrer Rolle (utils/
                      // rollenNamen: rollenDarstellung, 02.10.2026) -- bis
                      // dahin trug jede Person die Termin-Farbe. Konfis bleiben
                      // in der Termin-Farbe wie bisher.
                      const imTeam = konfi.role_name !== 'konfi';
                      const rolle = imTeam ? rollenDarstellung(konfi.role_name) : null;

                      return (
                        <div role="button" tabIndex={0} onKeyDown={tastaturKlick}
                          key={konfi.id}
                          className={`app-list-item ${rolle ? rolle.strich : 'app-list-item--events'}${rolle && isSelected ? ' app-list-item--selected' : ''}`}
                          onClick={() => handleKonfiSelection(konfi.id)}
                          style={{
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '0',
                            background: !rolle && isSelected ? 'rgba(var(--app-color-events-rgb), 0.08)' : undefined
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--app-abstand-mittel)', flex: 1, minWidth: 0 }}>
                            <div className={`app-icon-circle ${rolle ? rolle.kreis : 'app-icon-circle--events'}`}>
                              <IonIcon icon={ICON_PERSON_GEFUELLT} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="app-list-item__title">{konfi.name}</div>
                              <div className="app-list-item__subtitle">
                                {/* Das Wort nach der Rolle (utils/rollenNamen):
                                    Gemeindeleitung und Leitung hiessen hier
                                    beide "Leitung". */}
                                {personUnterzeile(konfi, rollenName)}
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

export default ParticipantManagementModal;