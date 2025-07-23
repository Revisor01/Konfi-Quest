import React, { useState, useEffect, useRef } from 'react';
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
  IonList,
  IonSearchbar,
  IonAvatar,
  IonText
} from '@ionic/react';
import { close, person, people, chevronForward } from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';
import LoadingSpinner from '../../common/LoadingSpinner';

interface User {
  id: number;
  name?: string;
  display_name?: string;
  type: 'admin' | 'konfi';
  jahrgang?: string;
}

interface DirectMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const DirectMessageModal: React.FC<DirectMessageModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user, setError, setSuccess } = useApp();
  const pageRef = useRef<HTMLElement>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const [konfisRes, adminsRes] = await Promise.all([
        api.get('/admin/konfis'),
        api.get('/users').catch(() => ({ data: [] })) // Fallback if endpoint doesn't exist
      ]);
      
      const allUsers: User[] = [
        ...konfisRes.data.map((konfi: any) => ({ ...konfi, type: 'konfi' as const })),
        ...adminsRes.data.map((admin: any) => ({ ...admin, type: 'admin' as const }))
      ];
      
      // Filter out current user
      const filteredUsers = allUsers.filter(u => 
        !(u.id === user?.id && u.type === user?.type)
      );
      
      setUsers(filteredUsers);
    } catch (err) {
      setError('Fehler beim Laden der Benutzer');
      console.error('Error loading users:', err);
    } finally {
      setLoading(false);
    }
  };

  const createDirectMessage = async (targetUser: User) => {
    setCreating(true);
    try {
      const response = await api.post('/chat/direct', {
        target_user_id: targetUser.id,
        target_user_type: targetUser.type
      });
      
      setSuccess(`Direktnachricht mit ${targetUser.name || targetUser.display_name} erstellt`);
      onSuccess();
      handleClose();
    } catch (err) {
      setError('Fehler beim Erstellen der Direktnachricht');
      console.error('Error creating direct message:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    setSearchText('');
    onClose();
  };

  const filteredUsers = users.filter(user => {
    const name = user.name || user.display_name || '';
    return name.toLowerCase().includes(searchText.toLowerCase()) ||
           (user.jahrgang && user.jahrgang.toLowerCase().includes(searchText.toLowerCase()));
  });

  const getUserDisplayName = (user: User) => {
    return user.name || user.display_name || 'Unbekannt';
  };

  return (
    <IonModal 
      isOpen={isOpen} 
      onDidDismiss={handleClose}
      presentingElement={pageRef.current || undefined}
      canDismiss={true}
      backdropDismiss={true}
    >
      <IonPage ref={pageRef}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Direktnachricht</IonTitle>
            <IonButtons slot="start">
              <IonButton onClick={handleClose}>
                <IonIcon icon={close} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        
        <IonContent>
          {loading ? (
            <LoadingSpinner message="Benutzer werden geladen..." />
          ) : (
            <>
              {/* Search */}
              <div style={{ padding: '16px', paddingBottom: '8px' }}>
                <IonSearchbar
                  value={searchText}
                  onIonInput={(e) => setSearchText(e.detail.value!)}
                  placeholder="Person suchen..."
                  style={{
                    '--background': '#f8f9fa',
                    '--border-radius': '12px'
                  }}
                />
              </div>

              {/* Users List */}
              <div style={{ padding: '0 16px' }}>
                {filteredUsers.length === 0 ? (
                  <IonText color="medium" style={{ 
                    display: 'block', 
                    textAlign: 'center', 
                    padding: '32px 16px' 
                  }}>
                    <p>Keine Personen gefunden</p>
                  </IonText>
                ) : (
                  <IonList>
                    {filteredUsers.map((targetUser) => (
                      <IonItem 
                        key={`${targetUser.type}-${targetUser.id}`}
                        button 
                        onClick={() => createDirectMessage(targetUser)}
                        disabled={creating}
                        style={{ '--min-height': '60px' }}
                      >
                        <IonAvatar slot="start" style={{ 
                          width: '40px', 
                          height: '40px',
                          backgroundColor: targetUser.type === 'admin' ? '#7045f6' : '#3880ff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <IonIcon 
                            icon={targetUser.type === 'admin' ? person : people} 
                            style={{ 
                              fontSize: '1.2rem', 
                              color: 'white'
                            }} 
                          />
                        </IonAvatar>
                        
                        <IonLabel>
                          <h3 style={{ fontWeight: '600', margin: '0 0 4px 0' }}>
                            {getUserDisplayName(targetUser)}
                          </h3>
                          <p style={{ 
                            margin: '0', 
                            fontSize: '0.9rem', 
                            color: '#666' 
                          }}>
                            {targetUser.type === 'admin' ? 'Admin' : 
                             (targetUser.jahrgang ? `Jahrgang ${targetUser.jahrgang}` : 'Konfi')}
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
                )}
              </div>

              {/* Info */}
              <div style={{ 
                margin: '24px 16px 0 16px',
                padding: '16px',
                backgroundColor: '#f8f9fa',
                borderRadius: '12px'
              }}>
                <IonText color="medium">
                  <p style={{ 
                    margin: '0', 
                    fontSize: '0.9rem',
                    lineHeight: '1.4' 
                  }}>
                    Wählen Sie eine Person aus, um eine private Unterhaltung zu starten.
                  </p>
                </IonText>
              </div>
            </>
          )}
        </IonContent>
      </IonPage>
    </IonModal>
  );
};

export default DirectMessageModal;