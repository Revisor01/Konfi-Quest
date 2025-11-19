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
  IonInput,
  IonList,
  IonCheckbox,
  IonSearchbar,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonAvatar,
  IonChip,
  IonText,
  IonModal
} from '@ionic/react';
import { close, checkmarkOutline, people, person } from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';
import LoadingSpinner from '../../common/LoadingSpinner';

interface Konfi {
  id: number;
  name: string;
  jahrgang?: string;
}

interface Admin {
  id: number;
  display_name: string;
}

interface GroupChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const GroupChatModal: React.FC<GroupChatModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { setError, setSuccess } = useApp();
  const pageRef = useRef<HTMLElement>(null);
  const [groupName, setGroupName] = useState('');
  const [searchText, setSearchText] = useState('');
  const [konfis, setKonfis] = useState<Konfi[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [konfisRes, adminsRes] = await Promise.all([
        api.get('/admin/konfis'),
        api.get('/admin/users') // Assuming this endpoint exists
      ]);
      
      setKonfis(konfisRes.data);
      setAdmins(adminsRes.data || []); // Fallback if admin endpoint doesn't exist
    } catch (err) {
      setError('Fehler beim Laden der Benutzer');
      console.error('Error loading users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleParticipantToggle = (id: string) => {
    const newSelected = new Set(selectedParticipants);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedParticipants(newSelected);
  };

  const createGroupChat = async () => {
    if (!groupName.trim()) {
      setError('Bitte geben Sie einen Gruppennamen ein');
      return;
    }

    if (selectedParticipants.size === 0) {
      setError('Bitte wählen Sie mindestens einen Teilnehmer aus');
      return;
    }

    setCreating(true);
    try {
      const participants = Array.from(selectedParticipants);
      const groupData = {
        name: groupName.trim(),
        type: 'group',
        participants: participants
      };

      await api.post('/chat/rooms', groupData);
      
      setSuccess(`Gruppenchat "${groupName}" erstellt`);
      resetForm();
      onSuccess();
    } catch (err) {
      setError('Fehler beim Erstellen des Gruppenchats');
      console.error('Error creating group chat:', err);
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setGroupName('');
    setSearchText('');
    setSelectedParticipants(new Set());
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const filteredKonfis = konfis.filter(konfi =>
    konfi.name.toLowerCase().includes(searchText.toLowerCase()) ||
    (konfi.jahrgang && konfi.jahrgang.toLowerCase().includes(searchText.toLowerCase()))
  );

  const filteredAdmins = admins.filter(admin =>
    admin.display_name.toLowerCase().includes(searchText.toLowerCase())
  );

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
            <IonTitle>Gruppenchat erstellen</IonTitle>
            <IonButtons slot="start">
              <IonButton onClick={handleClose}>
                <IonIcon icon={close} />
              </IonButton>
            </IonButtons>
            <IonButtons slot="end">
              <IonButton
                onClick={createGroupChat}
                disabled={!groupName.trim() || selectedParticipants.size === 0 || creating}
              >
                <IonIcon icon={checkmarkOutline} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        
        <IonContent>
          {loading ? (
            <LoadingSpinner message="Benutzer werden geladen..." />
          ) : (
            <>
              {/* Group Name Input */}
              <IonCard style={{ margin: '16px' }}>
                <IonCardHeader>
                  <IonCardTitle style={{ fontSize: '1.1rem' }}>Gruppendetails</IonCardTitle>
                </IonCardHeader>
                <IonCardContent>
                  <IonItem>
                    <IonLabel position="stacked">Gruppenname *</IonLabel>
                    <IonInput
                      value={groupName}
                      onIonInput={(e) => setGroupName(e.detail.value!)}
                      placeholder="z.B. Konfi 2025 Projektgruppe"
                      clearInput={true}
                    />
                  </IonItem>
                </IonCardContent>
              </IonCard>

              {/* Selected Participants Display */}
              {selectedParticipants.size > 0 && (
                <IonCard style={{ margin: '16px' }}>
                  <IonCardHeader>
                    <IonCardTitle style={{ fontSize: '1rem' }}>
                      Ausgewählte Teilnehmer ({selectedParticipants.size})
                    </IonCardTitle>
                  </IonCardHeader>
                  <IonCardContent>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {Array.from(selectedParticipants).map(participantId => {
                        const [type, id] = participantId.split('-');
                        let name = '';
                        
                        if (type === 'konfi') {
                          const konfi = konfis.find(k => k.id.toString() === id);
                          name = konfi?.name || 'Unbekannt';
                        } else if (type === 'admin') {
                          const admin = admins.find(a => a.id.toString() === id);
                          name = admin?.display_name || 'Unbekannt';
                        }
                        
                        return (
                          <IonChip
                            key={participantId}
                            color={type === 'admin' ? 'tertiary' : 'primary'}
                            onClick={() => handleParticipantToggle(participantId)}
                          >
                            <IonIcon icon={type === 'admin' ? person : people} />
                            <IonLabel>{name}</IonLabel>
                            <IonIcon icon={close} />
                          </IonChip>
                        );
                      })}
                    </div>
                  </IonCardContent>
                </IonCard>
              )}

              {/* Search */}
              <div style={{ padding: '0 16px' }}>
                <IonSearchbar
                  value={searchText}
                  onIonInput={(e) => setSearchText(e.detail.value!)}
                  placeholder="Teilnehmer suchen..."
                  style={{
                    '--background': '#f8f9fa',
                    '--border-radius': '12px'
                  }}
                />
              </div>

              {/* Admins List */}
              {admins.length > 0 && (
                <IonCard style={{ margin: '16px' }}>
                  <IonCardHeader>
                    <IonCardTitle style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <IonIcon icon={person} color="tertiary" />
                      Admins
                    </IonCardTitle>
                  </IonCardHeader>
                  <IonCardContent style={{ padding: '0' }}>
                    <IonList>
                      {filteredAdmins.map((admin) => {
                        const participantId = `admin-${admin.id}`;
                        const isSelected = selectedParticipants.has(participantId);
                        
                        return (
                          <IonItem 
                            key={admin.id} 
                            button 
                            onClick={() => handleParticipantToggle(participantId)}
                          >
                            <IonAvatar slot="start" style={{ 
                              width: '40px', 
                              height: '40px',
                              backgroundColor: '#7045f6'
                            }}>
                              <div style={{ 
                                color: 'white', 
                                fontSize: '1rem', 
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '100%'
                              }}>
                                {admin.display_name.charAt(0).toUpperCase()}
                              </div>
                            </IonAvatar>
                            
                            <IonLabel>
                              <h3>{admin.display_name}</h3>
                              <p>Admin</p>
                            </IonLabel>
                            
                            <IonCheckbox 
                              slot="end" 
                              checked={isSelected}
                              color="tertiary"
                            />
                          </IonItem>
                        );
                      })}
                    </IonList>
                  </IonCardContent>
                </IonCard>
              )}

              {/* Konfis List */}
              <IonCard style={{ margin: '16px' }}>
                <IonCardHeader>
                  <IonCardTitle style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <IonIcon icon={people} color="primary" />
                    Konfirmanden ({filteredKonfis.length})
                  </IonCardTitle>
                </IonCardHeader>
                <IonCardContent style={{ padding: '0' }}>
                  {filteredKonfis.length === 0 ? (
                    <IonItem>
                      <IonLabel style={{ textAlign: 'center', color: '#666' }}>
                        <p>Keine Konfirmanden gefunden</p>
                      </IonLabel>
                    </IonItem>
                  ) : (
                    <IonList>
                      {filteredKonfis.map((konfi) => {
                        const participantId = `konfi-${konfi.id}`;
                        const isSelected = selectedParticipants.has(participantId);
                        
                        return (
                          <IonItem 
                            key={konfi.id} 
                            button 
                            onClick={() => handleParticipantToggle(participantId)}
                          >
                            <IonAvatar slot="start" style={{ 
                              width: '40px', 
                              height: '40px',
                              backgroundColor: '#17a2b8'
                            }}>
                              <div style={{ 
                                color: 'white', 
                                fontSize: '1rem', 
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '100%'
                              }}>
                                {konfi.name.charAt(0).toUpperCase()}
                              </div>
                            </IonAvatar>
                            
                            <IonLabel>
                              <h3>{konfi.name}</h3>
                              <p>{konfi.jahrgang || 'Kein Jahrgang'}</p>
                            </IonLabel>
                            
                            <IonCheckbox 
                              slot="end" 
                              checked={isSelected}
                              color="primary"
                            />
                          </IonItem>
                        );
                      })}
                    </IonList>
                  )}
                </IonCardContent>
              </IonCard>
            </>
          )}
        </IonContent>
      </IonPage>
    </IonModal>
  );
};

export default GroupChatModal;