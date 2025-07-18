import React, { useState, useRef } from 'react';
import {
  IonModal,
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
  IonCheckbox,
  IonText,
  IonNote
} from '@ionic/react';
import { close, checkmark, add, remove } from 'ionicons/icons';
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
      setError('Bitte geben Sie eine Frage ein');
      return;
    }

    if (validOptions.length < 2) {
      setError('Bitte geben Sie mindestens 2 Antwortmöglichkeiten ein');
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
            <IonTitle>Umfrage erstellen</IonTitle>
            <IonButtons slot="start">
              <IonButton onClick={handleClose}>
                <IonIcon icon={close} />
              </IonButton>
            </IonButtons>
            <IonButtons slot="end">
              <IonButton 
                onClick={createPoll} 
                disabled={!canCreate() || creating}
                color="primary"
              >
                <IonIcon icon={checkmark} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        
        <IonContent>
          <div style={{ padding: '16px' }}>
            {/* Question Input */}
            <div style={{ marginBottom: '24px' }}>
              <IonItem>
                <IonLabel position="stacked">Frage</IonLabel>
                <IonTextarea
                  value={question}
                  onIonInput={(e) => setQuestion(e.detail.value!)}
                  placeholder="Ihre Frage eingeben..."
                  rows={2}
                  maxlength={500}
                />
              </IonItem>
            </div>
            
            {/* Options Section */}
            <div style={{ marginBottom: '24px' }}>
              <IonText>
                <h3 style={{ margin: '0 0 8px 0' }}>Antwortmöglichkeiten</h3>
                <IonNote color="medium">Mindestens 2 Optionen erforderlich</IonNote>
              </IonText>
              
              <div style={{ marginTop: '16px' }}>
                {options.map((option, index) => (
                  <IonItem key={index} style={{ marginBottom: '8px' }}>
                    <IonLabel position="stacked">Option {index + 1}</IonLabel>
                    <IonInput
                      value={option}
                      onIonInput={(e) => updateOption(index, e.detail.value!)}
                      placeholder={`Option ${index + 1} eingeben...`}
                      maxlength={200}
                    />
                    {options.length > 2 && (
                      <IonButton
                        fill="clear"
                        slot="end"
                        onClick={() => removeOption(index)}
                        color="danger"
                      >
                        <IonIcon icon={remove} />
                      </IonButton>
                    )}
                  </IonItem>
                ))}
                
                {/* Add Option Button */}
                {options.length < 10 && (
                  <IonItem 
                    button 
                    onClick={addOption}
                    style={{ marginTop: '8px' }}
                  >
                    <IonIcon icon={add} slot="start" />
                    <IonLabel>Weitere Option hinzufügen</IonLabel>
                  </IonItem>
                )}
              </div>
            </div>
            
            {/* Settings Section */}
            <div style={{ marginBottom: '24px' }}>
              <IonText>
                <h3 style={{ margin: '0 0 16px 0' }}>Einstellungen</h3>
              </IonText>
              
              {/* Multiple Choice Toggle */}
              <IonItem style={{ marginBottom: '12px' }}>
                <IonLabel>
                  <h3>Mehrfachauswahl</h3>
                  <IonNote color="medium">
                    Erlaubt es Nutzern, mehrere Antworten zu wählen
                  </IonNote>
                </IonLabel>
                <IonToggle
                  checked={multipleChoice}
                  onIonChange={(e) => setMultipleChoice(e.detail.checked)}
                />
              </IonItem>
              
              {/* Expiration Toggle */}
              <IonItem style={{ marginBottom: '12px' }}>
                <IonLabel>
                  <h3>Ablaufdatum</h3>
                  <IonNote color="medium">
                    Umfrage automatisch nach bestimmtem Datum schließen
                  </IonNote>
                </IonLabel>
                <IonToggle
                  checked={hasExpiration}
                  onIonChange={(e) => setHasExpiration(e.detail.checked)}
                />
              </IonItem>
              
              {/* Expiration Duration Picker */}
              {hasExpiration && (
                <IonItem style={{ marginTop: '12px' }}>
                  <IonLabel position="stacked">Ablaufzeit</IonLabel>
                  <IonSelect
                    value={expirationHours}
                    onIonChange={(e) => setExpirationHours(e.detail.value)}
                    interface="popover"
                    placeholder="Wählen Sie eine Dauer"
                  >
                    <IonSelectOption value={1}>1 Stunde</IonSelectOption>
                    <IonSelectOption value={8}>8 Stunden</IonSelectOption>
                    <IonSelectOption value={24}>1 Tag</IonSelectOption>
                    <IonSelectOption value={168}>7 Tage</IonSelectOption>
                  </IonSelect>
                </IonItem>
              )}
            </div>
          </div>
        </IonContent>
    </IonPage>
  );
};

export default PollModal;