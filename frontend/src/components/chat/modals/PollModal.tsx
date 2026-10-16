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
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonToggle,
  IonSelect,
  IonSelectOption,
  IonList,
  IonItemGroup,
  IonListHeader,
  IonSpinner
} from '@ionic/react';
import {
  ICON_EINSTELLUNGEN,
  ICON_ENTFERNEN,
  ICON_HAKEN,
  ICON_HILFE,
  ICON_HINZUFUEGEN,
  ICON_LISTE,
  ICON_OFFLINE,
  ICON_SCHLIESSEN,
  ICON_UHRZEIT,
} from '../../shared/icons';
import { useApp } from '../../../contexts/AppContext';
import {
  ABLAUF_STUNDEN,
  FRAGE_MAX_ZEICHEN,
  OPTIONEN_MAX,
  OPTIONEN_MIN,
  OPTION_MAX_ZEICHEN,
  UMFRAGE_HINWEISE,
  useUmfrageFormular,
} from '../useUmfrageFormular';

interface PollModalProps {
  onClose: () => void;
  onSuccess: () => void;
  roomId: number;
  dismiss?: () => void;
}

const PollModal: React.FC<PollModalProps> = ({ onClose, onSuccess, roomId, dismiss }) => {
  const handleClose = () => {
    if (dismiss) {
      dismiss();
    } else {
      onClose();
    }
  };
  const { isOnline } = useApp();
  const pageRef = useRef<HTMLElement>(null);

  // Felder, Prüfung und der Weg zum Server: useUmfrageFormular -- dieselbe
  // Logik wie im Dialog des Browsers (web/WebUmfrageDialog).
  const {
    question, setQuestion, options, addOption, removeOption, updateOption,
    multipleChoice, setMultipleChoice, anonymous, namenAnzeigenSetzen,
    exclusiveOptions, exklusivSetzen, einmaligeAntwort, setEinmaligeAntwort,
    namenSpaeter, setNamenSpaeter, hasExpiration, setHasExpiration,
    expirationHours, setExpirationHours, creating, kannErstellen, erstellen,
  } = useUmfrageFormular({ roomId });

  const createPoll = async () => {
    if (await erstellen()) {
      onSuccess();
      handleClose();
    }
  };

  return (
    <IonPage ref={pageRef}>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton className="app-modal-close-btn" onClick={handleClose} disabled={creating} aria-label="Schließen">
              <IonIcon icon={ICON_SCHLIESSEN} slot="icon-only" />
            </IonButton>
          </IonButtons>
          <IonTitle>Neue Umfrage</IonTitle>
          <IonButtons slot="end">
            <IonButton className="app-modal-submit-btn app-modal-submit-btn--chat" onClick={createPoll} disabled={!kannErstellen || creating || !isOnline} aria-label="Umfrage erstellen">
              {!isOnline ? <><IonIcon icon={ICON_OFFLINE} /> Du bist offline</> : creating ? <IonSpinner name="crescent" /> : <IonIcon icon={ICON_HAKEN} slot="icon-only" />}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--app-abstand-basis)' }}>

          {/* Frage */}
          <IonList inset={true}>
            <IonListHeader>
              <div className="app-section-icon app-section-icon--chat">
                <IonIcon icon={ICON_HILFE} />
              </div>
              <IonLabel>Frage</IonLabel>
            </IonListHeader>
            <IonItemGroup>
              <IonItem>
                <IonTextarea
                  aria-label="Frage"
                  value={question}
                  onIonInput={(e) => setQuestion(e.detail.value!)}
                  placeholder="Deine Frage eingeben..."
                  rows={2}
                  maxlength={FRAGE_MAX_ZEICHEN}
                  label="Frage"
                  labelPlacement="stacked"
                  autocapitalize="sentences"
                  autoCorrect="on"
                />
              </IonItem>
            </IonItemGroup>
          </IonList>

          {/* Antwortmoeglichkeiten */}
          <IonList inset={true}>
            <IonListHeader>
              <div className="app-section-icon app-section-icon--chat">
                <IonIcon icon={ICON_LISTE} />
              </div>
              <IonLabel>Antwortmöglichkeiten</IonLabel>
            </IonListHeader>
            <IonItemGroup>
              {options.map((option, index) => (
                <IonItem key={index}>
                  <IonInput
                    aria-label={`Option ${index + 1}`}
                    value={option}
                    onIonInput={(e) => updateOption(index, e.detail.value!)}
                    placeholder={`Option ${index + 1}`}
                    maxlength={OPTION_MAX_ZEICHEN}
                    label={`Option ${index + 1}`}
                    labelPlacement="stacked"
                    autocapitalize="sentences"
                    autoCorrect="on"
                  />
                  {options.length > OPTIONEN_MIN && (
                    <IonButton aria-label="Antwortoption entfernen"
                      fill="clear"
                      slot="end"
                      onClick={() => removeOption(index)}
                      style={{ '--color': 'var(--app-color-danger)' }}
                    >
                      <IonIcon icon={ICON_ENTFERNEN} />
                    </IonButton>
                  )}
                </IonItem>
              ))}

              {/* Option hinzufügen */}
              {options.length < OPTIONEN_MAX && (
                <IonItem button onClick={addOption} detail={false}>
                  <IonIcon icon={ICON_HINZUFUEGEN} slot="start" style={{ color: 'var(--app-text-chat)' }} />
                  <IonLabel style={{ color: 'var(--app-text-chat)' }}>Option hinzufügen</IonLabel>
                </IonItem>
              )}
            </IonItemGroup>
          </IonList>

          {/* Einstellungen */}
          <IonList inset={true}>
            <IonListHeader>
              <div className="app-section-icon app-section-icon--chat">
                <IonIcon icon={ICON_EINSTELLUNGEN} />
              </div>
              <IonLabel>Einstellungen</IonLabel>
            </IonListHeader>
            <IonItemGroup>
              {/* Muster wie beim Challenge-Erstellen: Label links (Titel +
                  mehrzeilige Erklärung über globale Klassen), Toggle rechts. */}
              <IonItem>
                <IonLabel>
                  <h3 className="app-toggle-item__title">Mehrfachauswahl</h3>
                  <p className="app-toggle-item__hint">
                    {UMFRAGE_HINWEISE.mehrfachauswahl(exclusiveOptions)}
                  </p>
                </IonLabel>
                <IonToggle aria-label="Mehrfachauswahl"
                  slot="end"
                  className="app-toggle--chat"
                  checked={multipleChoice}
                  disabled={exclusiveOptions}
                  onIonChange={(e) => setMultipleChoice(e.detail.checked)}
                 
                />
              </IonItem>

              <IonItem>
                <IonLabel>
                  <h3 className="app-toggle-item__title">Namen anzeigen</h3>
                  <p className="app-toggle-item__hint">
                    {UMFRAGE_HINWEISE.namenAnzeigen(anonymous)}
                  </p>
                </IonLabel>
                <IonToggle aria-label="Namen anzeigen"
                  slot="end"
                  className="app-toggle--chat"
                  checked={!anonymous}
                  onIonChange={(e) => namenAnzeigenSetzen(e.detail.checked)}
                 
                />
              </IonItem>

              {!anonymous && (
                <IonItem>
                  <IonLabel>
                    <h3 className="app-toggle-item__title">Namen erst später aufdecken</h3>
                    <p className="app-toggle-item__hint">
                      {UMFRAGE_HINWEISE.namenSpaeter}
                    </p>
                  </IonLabel>
                  <IonToggle aria-label="Namen erst später aufdecken"
                    slot="end"
                    className="app-toggle--chat"
                    checked={namenSpaeter}
                    onIonChange={(e) => setNamenSpaeter(e.detail.checked)}
                  />
                </IonItem>
              )}

              <IonItem>
                <IonLabel>
                  <h3 className="app-toggle-item__title">Nur einmal antworten</h3>
                  <p className="app-toggle-item__hint">
                    {UMFRAGE_HINWEISE.einmalig}
                  </p>
                </IonLabel>
                <IonToggle aria-label="Nur einmal antworten"
                  slot="end"
                  className="app-toggle--chat"
                  checked={einmaligeAntwort}
                  onIonChange={(e) => setEinmaligeAntwort(e.detail.checked)}
                />
              </IonItem>

              <IonItem>
                <IonLabel>
                  <h3 className="app-toggle-item__title">Exklusive Optionen</h3>
                  <p className="app-toggle-item__hint">
                    {UMFRAGE_HINWEISE.exklusiv}
                  </p>
                </IonLabel>
                <IonToggle aria-label="Exklusive Optionen"
                  slot="end"
                  className="app-toggle--chat"
                  checked={exclusiveOptions}
                  onIonChange={(e) => exklusivSetzen(e.detail.checked)}
                 
                />
              </IonItem>

              <IonItem>
                <IonLabel>
                  <h3 className="app-toggle-item__title">Ablaufdatum</h3>
                  <p className="app-toggle-item__hint">
                    {UMFRAGE_HINWEISE.ablauf}
                  </p>
                </IonLabel>
                <IonToggle aria-label="Ablaufdatum"
                  slot="end"
                  className="app-toggle--chat"
                  checked={hasExpiration}
                  onIonChange={(e) => setHasExpiration(e.detail.checked)}
                 
                />
              </IonItem>

              {hasExpiration && (
                <IonItem>
                  <IonIcon icon={ICON_UHRZEIT} slot="start" style={{ color: 'var(--app-text-chat)' }} />
                  <IonSelect
                    label="Ablaufzeit"
                    value={expirationHours}
                    onIonChange={(e) => setExpirationHours(e.detail.value)}
                    interface="popover"
                    interfaceOptions={{ arrow: false }}
                    labelPlacement="start"
                  >
                    {ABLAUF_STUNDEN.map(({ stunden, label }) => (
                      <IonSelectOption key={stunden} value={stunden}>{label}</IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>
              )}
            </IonItemGroup>
          </IonList>

        </div>
      </IonContent>
    </IonPage>
  );
};

export default PollModal;
