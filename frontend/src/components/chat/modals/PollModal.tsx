import React, { useState, useRef } from 'react';
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
  closeOutline,
  checkmarkOutline,
  addOutline,
  removeCircleOutline,
  helpCircleOutline,
  listOutline,
  settingsOutline,
  timeOutline
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';

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
  const { setError, setSuccess } = useApp();
  const pageRef = useRef<HTMLElement>(null);

  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multipleChoice, setMultipleChoice] = useState(false);
  const [hasExpiration, setHasExpiration] = useState(false);
  const [expirationHours, setExpirationHours] = useState(24);
  const [creating, setCreating] = useState(false);

  const resetForm = () => {
    setQuestion('');
    setOptions(['', '']);
    setMultipleChoice(false);
    setHasExpiration(false);
    setExpirationHours(24);
  };

  const addOption = () => {
    if (options.length < 10) {
      setOptions([...options, '']);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const createPoll = async () => {
    const trimmedQuestion = question.trim();
    const validOptions = options.filter(opt => opt.trim());

    if (!trimmedQuestion) {
      setError('Bitte gib eine Frage ein');
      return;
    }

    if (validOptions.length < 2) {
      setError('Bitte gib mindestens 2 Antwortmöglichkeiten ein');
      return;
    }

    setCreating(true);
    try {
      const pollData = {
        question: trimmedQuestion,
        options: validOptions,
        multiple_choice: multipleChoice,
        expires_in_hours: hasExpiration ? expirationHours : null
      };

      await api.post(`/chat/rooms/${roomId}/polls`, pollData);

      setSuccess('Umfrage erstellt');
      resetForm();
      onSuccess();
      handleClose();
    } catch (err) {
      setError('Fehler beim Erstellen der Umfrage');
 console.error('Error creating poll:', err);
    } finally {
      setCreating(false);
    }
  };

  const canCreate = () => {
    return question.trim() && options.filter(opt => opt.trim()).length >= 2;
  };

  return (
    <IonPage ref={pageRef}>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={handleClose} disabled={creating}>
              <IonIcon icon={closeOutline} slot="icon-only" />
            </IonButton>
          </IonButtons>
          <IonTitle>Neue Umfrage</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={createPoll} disabled={!canCreate() || creating}>
              {creating ? <IonSpinner name="crescent" /> : <IonIcon icon={checkmarkOutline} slot="icon-only" />}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Frage */}
          <IonList inset={true}>
            <IonListHeader>
              <div style={{
                width: '24px',
                height: '24px',
                backgroundColor: '#06b6d4',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '8px'
              }}>
                <IonIcon icon={helpCircleOutline} style={{ color: 'white', fontSize: '0.8rem' }} />
              </div>
              <IonLabel>Frage</IonLabel>
            </IonListHeader>
            <IonItemGroup>
              <IonItem>
                <IonTextarea
                  value={question}
                  onIonInput={(e) => setQuestion(e.detail.value!)}
                  placeholder="Deine Frage eingeben..."
                  rows={2}
                  maxlength={500}
                  label="Frage"
                  labelPlacement="stacked"
                />
              </IonItem>
            </IonItemGroup>
          </IonList>

          {/* Antwortmöglichkeiten */}
          <IonList inset={true}>
            <IonListHeader>
              <div style={{
                width: '24px',
                height: '24px',
                backgroundColor: '#06b6d4',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '8px'
              }}>
                <IonIcon icon={listOutline} style={{ color: 'white', fontSize: '0.8rem' }} />
              </div>
              <IonLabel>Antwortmöglichkeiten</IonLabel>
            </IonListHeader>
            <IonItemGroup>
              {options.map((option, index) => (
                <IonItem key={index}>
                  <IonInput
                    value={option}
                    onIonInput={(e) => updateOption(index, e.detail.value!)}
                    placeholder={`Option ${index + 1}`}
                    maxlength={200}
                    label={`Option ${index + 1}`}
                    labelPlacement="stacked"
                  />
                  {options.length > 2 && (
                    <IonButton
                      fill="clear"
                      slot="end"
                      onClick={() => removeOption(index)}
                      style={{ '--color': '#dc3545' }}
                    >
                      <IonIcon icon={removeCircleOutline} />
                    </IonButton>
                  )}
                </IonItem>
              ))}

              {/* Option hinzufügen */}
              {options.length < 10 && (
                <IonItem button onClick={addOption} detail={false}>
                  <IonIcon icon={addOutline} slot="start" style={{ color: '#06b6d4' }} />
                  <IonLabel style={{ color: '#06b6d4' }}>Option hinzufügen</IonLabel>
                </IonItem>
              )}
            </IonItemGroup>
          </IonList>

          {/* Einstellungen */}
          <IonList inset={true}>
            <IonListHeader>
              <div style={{
                width: '24px',
                height: '24px',
                backgroundColor: '#06b6d4',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '8px'
              }}>
                <IonIcon icon={settingsOutline} style={{ color: 'white', fontSize: '0.8rem' }} />
              </div>
              <IonLabel>Einstellungen</IonLabel>
            </IonListHeader>
            <IonItemGroup>
              <IonItem>
                <IonToggle
                  checked={multipleChoice}
                  onIonChange={(e) => setMultipleChoice(e.detail.checked)}
                  style={{
                    '--track-background-checked': '#06b6d4'
                  }}
                >
                  <IonLabel>
                    <h3>Mehrfachauswahl</h3>
                    <p style={{ fontSize: '0.8rem', color: '#8e8e93' }}>
                      Mehrere Antworten erlauben
                    </p>
                  </IonLabel>
                </IonToggle>
              </IonItem>

              <IonItem>
                <IonToggle
                  checked={hasExpiration}
                  onIonChange={(e) => setHasExpiration(e.detail.checked)}
                  style={{
                    '--track-background-checked': '#06b6d4'
                  }}
                >
                  <IonLabel>
                    <h3>Ablaufdatum</h3>
                    <p style={{ fontSize: '0.8rem', color: '#8e8e93' }}>
                      Umfrage automatisch schließen
                    </p>
                  </IonLabel>
                </IonToggle>
              </IonItem>

              {hasExpiration && (
                <IonItem>
                  <IonIcon icon={timeOutline} slot="start" style={{ color: '#06b6d4' }} />
                  <IonSelect
                    value={expirationHours}
                    onIonChange={(e) => setExpirationHours(e.detail.value)}
                    interface="popover"
                    label="Ablaufzeit"
                    labelPlacement="start"
                  >
                    <IonSelectOption value={1}>1 Stunde</IonSelectOption>
                    <IonSelectOption value={8}>8 Stunden</IonSelectOption>
                    <IonSelectOption value={24}>1 Tag</IonSelectOption>
                    <IonSelectOption value={168}>7 Tage</IonSelectOption>
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
