import React, { useRef } from 'react';
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
  IonList,
  IonItem,
  IonLabel,
  IonAvatar
} from '@ionic/react';
import { 
  close, 
  people, 
  person, 
  chatbubbles,
  chevronForward
} from 'ionicons/icons';

interface ChatOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectOption: (option: 'group' | 'direct' | 'jahrgang') => void;
}

const ChatOptionsModal: React.FC<ChatOptionsModalProps> = ({ isOpen, onClose, onSelectOption }) => {
  const pageRef = useRef<HTMLElement>(null);

  const chatOptions = [
    {
      type: 'group' as const,
      title: 'Gruppenchat erstellen',
      subtitle: 'Chat mit ausgewählten Teilnehmer:innen',
      icon: people,
      color: '#2dd36f'
    },
    {
      type: 'direct' as const,
      title: 'Direktnachricht',
      subtitle: '1-zu-1 Unterhaltung starten',
      icon: person,
      color: '#ff6b35'
    }
  ];

  return (
    <IonModal 
      isOpen={isOpen} 
      onDidDismiss={onClose}
      presentingElement={pageRef.current || undefined}
      canDismiss={true}
      backdropDismiss={true}
    >
      <IonPage ref={pageRef}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Neuen Chat erstellen</IonTitle>
            <IonButtons slot="start">
              <IonButton onClick={onClose}>
                <IonIcon icon={close} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        
        <IonContent>
          <div style={{ padding: '16px 0' }}>
            <IonList>
              {chatOptions.map((option) => (
                <IonItem 
                  key={option.type}
                  button 
                  onClick={() => {
                    onSelectOption(option.type);
                    onClose();
                  }}
                  style={{ '--min-height': '64px' }}
                >
                  <IonAvatar slot="start" style={{ 
                    width: '44px', 
                    height: '44px',
                    backgroundColor: option.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <IonIcon 
                      icon={option.icon} 
                      style={{ 
                        fontSize: '1.3rem', 
                        color: 'white'
                      }} 
                    />
                  </IonAvatar>
                  
                  <IonLabel>
                    <h2 style={{ fontWeight: '600', margin: '0 0 4px 0' }}>
                      {option.title}
                    </h2>
                    <p style={{ 
                      margin: '0', 
                      fontSize: '0.9rem', 
                      color: '#666' 
                    }}>
                      {option.subtitle}
                    </p>
                  </IonLabel>

                  <IonIcon 
                    icon={chevronForward} 
                    slot="end" 
                    style={{ color: '#c7c7cc' }}
                  />
                </IonItem>
              ))}
            </IonList>

            {/* Hinweis zu Jahrgangschats */}
            <div style={{ 
              margin: '24px 16px 0 16px',
              padding: '16px',
              backgroundColor: '#f8f9fa',
              borderRadius: '12px'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px',
                marginBottom: '8px'
              }}>
                <IonIcon 
                  icon={chatbubbles} 
                  style={{ 
                    fontSize: '1.2rem', 
                    color: '#17a2b8' 
                  }} 
                />
                <h3 style={{ 
                  margin: '0', 
                  fontSize: '1rem', 
                  fontWeight: '600',
                  color: '#17a2b8'
                }}>
                  Jahrgangschats
                </h3>
              </div>
              <p style={{ 
                margin: '0', 
                fontSize: '0.9rem', 
                color: '#666',
                lineHeight: '1.4'
              }}>
                Jahrgangschats werden automatisch für alle Jahrgänge erstellt und sind in der Chat-Übersicht verfügbar.
              </p>
            </div>
          </div>
        </IonContent>
      </IonPage>
    </IonModal>
  );
};

export default ChatOptionsModal;