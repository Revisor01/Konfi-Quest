import React from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonButtons,
  IonIcon,
  IonList,
  IonItem,
  IonLabel,
  IonCard,
  IonCardContent,
  IonListHeader
} from '@ionic/react';
import {
  closeOutline,
  people,
  person,
  chatbubbles,
  informationCircle
} from 'ionicons/icons';

interface ChatOptionsModalProps {
  onClose: () => void;
  onSelectOption: (option: 'group' | 'direct' | 'jahrgang') => void;
  dismiss?: () => void;
}

const ChatOptionsModal: React.FC<ChatOptionsModalProps> = ({ onClose, onSelectOption, dismiss }) => {
  const handleClose = () => {
    if (dismiss) {
      dismiss();
    } else {
      onClose();
    }
  };

  const chatOptions = [
    {
      type: 'group' as const,
      title: 'Gruppenchat erstellen',
      subtitle: 'Chat mit ausgewählten Teilnehmern',
      icon: people,
      color: '#2dd36f'
    },
    {
      type: 'direct' as const,
      title: 'Direktnachricht',
      subtitle: '1-zu-1 Unterhaltung starten',
      icon: person,
      color: '#17a2b8'
    }
  ];

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Neuen Chat erstellen</IonTitle>
          <IonButtons slot="start">
            <IonButton className="app-modal-close-btn" onClick={handleClose}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        {/* Chat-Optionen */}
        <IonList inset={true} className="app-modal-section">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--chat">
              <IonIcon icon={chatbubbles} />
            </div>
            <IonLabel>Chat-Optionen</IonLabel>
          </IonListHeader>

        <IonCard className="app-card">
          <IonCardContent style={{ padding: '8px 0' }}>
            <IonList lines="none" style={{ background: 'transparent' }}>
              {chatOptions.map((option) => (
                <IonItem
                  key={option.type}
                  button
                  onClick={() => {
                    onSelectOption(option.type);
                    handleClose();
                  }}
                  detail={false}
                  style={{
                    '--min-height': '70px',
                    '--padding-start': '16px',
                    '--background': '#fbfbfb',
                    '--border-radius': '12px',
                    margin: '4px 8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    border: '1px solid #e0e0e0',
                    borderRadius: '12px'
                  }}
                >
                  <div style={{
                    width: '44px',
                    height: '44px',
                    backgroundColor: option.color,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '12px',
                    flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                  }}>
                    <IonIcon
                      icon={option.icon}
                      style={{
                        fontSize: '1.3rem',
                        color: 'white'
                      }}
                    />
                  </div>

                  <IonLabel>
                    <h2 style={{ fontWeight: '600', fontSize: '1rem', marginBottom: '4px' }}>
                      {option.title}
                    </h2>
                    <p style={{
                      margin: '0',
                      fontSize: '0.85rem',
                      color: '#666'
                    }}>
                      {option.subtitle}
                    </p>
                  </IonLabel>
                </IonItem>
              ))}
            </IonList>
          </IonCardContent>
        </IonCard>
        </IonList>

        {/* Hinweis */}
        <IonList inset={true} className="app-modal-section">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--chat">
              <IonIcon icon={informationCircle} />
            </div>
            <IonLabel>Jahrgangschats</IonLabel>
          </IonListHeader>

        <IonCard className="app-card">
          <IonCardContent style={{ padding: '16px' }}>
            <p style={{
              margin: '0',
              fontSize: '0.9rem',
              color: '#666',
              lineHeight: '1.5'
            }}>
              Jahrgangschats werden automatisch für alle Jahrgänge erstellt und sind in der Chat-Übersicht verfügbar.
            </p>
          </IonCardContent>
        </IonCard>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default ChatOptionsModal;
