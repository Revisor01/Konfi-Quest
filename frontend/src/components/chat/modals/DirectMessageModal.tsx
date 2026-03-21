import React, { useState, useEffect, useRef } from 'react';
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
  IonList,
  IonSearchbar,
  IonAvatar,
  IonText,
  IonListHeader,
  IonCard,
  IonCardContent
} from '@ionic/react';
import { close, person, people, chevronForward, searchOutline, peopleOutline, informationCircleOutline } from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useActionGuard } from '../../../hooks/useActionGuard';
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
  onClose: () => void;
  onSuccess: () => void;
  dismiss?: () => void;
}

const DirectMessageModal: React.FC<DirectMessageModalProps> = ({ onClose, onSuccess, dismiss }) => {
  const { user, setError, setSuccess } = useApp();
  const pageRef = useRef<HTMLElement>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(true);
  const { isSubmitting: creating, guard } = useActionGuard();

  useEffect(() => {
    loadUsers();
  }, []);

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
    await guard(async () => {
      try {
        await api.post('/chat/direct', {
          target_user_id: targetUser.id,
          target_user_type: targetUser.type
        });

        setSuccess(`Direktnachricht mit ${targetUser.name || targetUser.display_name} erstellt`);
        onSuccess();
        handleClose();
      } catch (err) {
        setError('Fehler beim Erstellen der Direktnachricht');
        console.error('Error creating direct message:', err);
      }
    });
  };

  const handleClose = () => {
    setSearchText('');
    if (dismiss) {
      dismiss();
    } else {
      onClose();
    }
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
    <IonPage ref={pageRef}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Direktnachricht</IonTitle>
          <IonButtons slot="start">
            <IonButton className="app-modal-close-btn" onClick={handleClose}>
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
            {/* Suche */}
            <IonList inset={true} className="app-modal-section">
              <IonListHeader>
                <div className="app-section-icon app-section-icon--chat">
                  <IonIcon icon={searchOutline} />
                </div>
                <IonLabel>Suche</IonLabel>
              </IonListHeader>
              <IonSearchbar
                value={searchText}
                onIonInput={(e) => setSearchText(e.detail.value!)}
                placeholder="Person suchen..."
                style={{
                  '--background': '#f8f9fa',
                  '--border-radius': '12px'
                }}
              />
            </IonList>

            {/* Kontakte */}
            <IonList inset={true} className="app-modal-section">
              <IonListHeader>
                <div className="app-section-icon app-section-icon--chat">
                  <IonIcon icon={peopleOutline} />
                </div>
                <IonLabel>Kontakte ({filteredUsers.length})</IonLabel>
              </IonListHeader>
              {filteredUsers.length === 0 ? (
                <IonCard className="app-card">
                  <IonCardContent style={{ textAlign: 'center', padding: '32px 16px' }}>
                    <p style={{ margin: 0, color: '#666' }}>Keine Personen gefunden</p>
                  </IonCardContent>
                </IonCard>
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
                        backgroundColor: '#17a2b8',
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
            </IonList>

            {/* Hinweis */}
            <IonList inset={true} className="app-modal-section">
              <IonListHeader>
                <div className="app-section-icon app-section-icon--chat">
                  <IonIcon icon={informationCircleOutline} />
                </div>
                <IonLabel>Hinweis</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#666', lineHeight: '1.4' }}>
                    Wähle eine Person aus, um eine private Unterhaltung zu starten.
                  </p>
                </IonCardContent>
              </IonCard>
            </IonList>
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default DirectMessageModal;
