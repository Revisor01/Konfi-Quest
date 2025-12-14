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
  IonCardContent
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
            <IonButton
              onClick={handleClose}
              style={{
                '--background': '#f8f9fa',
                '--background-hover': '#e9ecef',
                '--color': '#6c757d',
                '--border-radius': '8px'
              }}
            >
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent style={{ '--padding-top': '16px' }}>
        {/* SEKTION: Chat-Optionen */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          margin: '16px 16px 12px 16px'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            backgroundColor: '#17a2b8',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(23, 162, 184, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.3)',
            flexShrink: 0
          }}>
            <IonIcon icon={chatbubbles} style={{ fontSize: '1rem', color: 'white' }} />
          </div>
          <h2 style={{
            fontWeight: '600',
            fontSize: '1.1rem',
            margin: '0',
            color: '#333'
          }}>
            Chat-Optionen
          </h2>
        </div>

        <IonCard className="app-card" style={{ margin: '0 16px 16px 16px' }}>
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

        {/* SEKTION: Hinweis */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          margin: '24px 16px 12px 16px'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            backgroundColor: '#17a2b8',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(23, 162, 184, 0.3)',
            flexShrink: 0
          }}>
            <IonIcon icon={informationCircle} style={{ fontSize: '1rem', color: 'white' }} />
          </div>
          <h2 style={{
            fontWeight: '600',
            fontSize: '1.1rem',
            margin: '0',
            color: '#333'
          }}>
            Jahrgangschats
          </h2>
        </div>

        <IonCard className="app-card" style={{ margin: '0 16px 16px 16px' }}>
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
      </IonContent>
    </IonPage>
  );
};

export default ChatOptionsModal;
