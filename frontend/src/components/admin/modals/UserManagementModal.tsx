import React, { useState, useEffect } from 'react';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonPage,
  IonButtons,
  IonButton,
  IonItem,
  IonLabel,
  IonInput,
  useIonActionSheet,
  IonToggle,
  IonCard,
  IonCardContent,
  IonIcon,
  IonCheckbox,
  IonList,
  IonText,
  IonSpinner
} from '@ionic/react';
import {
  closeOutline,
  checkmarkOutline,
  checkmarkCircle,
  personOutline,
  shieldOutline,
  schoolOutline
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';

interface User {
  id: number;
  username: string;
  email?: string;
  display_name: string;
  role_title?: string; // Funktionsbeschreibung z.B. "Pastor", "Diakonin"
  is_active: boolean;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
  role_id: number;
  role_name: string;
  role_display_name: string;
  assigned_jahrgaenge?: AssignedJahrgang[];
}

interface AssignedJahrgang {
  id: number;
  name: string;
  can_view: boolean;
  can_edit: boolean;
  assigned_at: string;
  assigned_by_name?: string;
}

interface Role {
  id: number;
  name: string;
  display_name: string;
  description?: string;
  is_system_role: boolean;
  is_active: boolean;
  user_count: number;
}

interface Jahrgang {
  id: number;
  name: string;
}

interface UserManagementModalProps {
  userId?: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

const UserManagementModal: React.FC<UserManagementModalProps> = ({
  userId,
  onClose,
  onSuccess
}) => {
  const { setSuccess, setError, user: currentUser } = useApp();
  const [presentActionSheet] = useIonActionSheet();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    display_name: '',
    role_title: '', // Funktionsbeschreibung z.B. "Pastor", "Diakonin"
    password: '',
    role_id: 0,
    is_active: true
  });

  // Available data
  const [roles, setRoles] = useState<Role[]>([]);
  const [jahrgaenge, setJahrgaenge] = useState<Jahrgang[]>([]);
  const [user, setUser] = useState<User | null>(null);

  // Jahrgang assignments
  const [jahrgangAssignments, setJahrgangAssignments] = useState<{ [key: number]: boolean }>({});

  const isEditMode = !!userId;

  // Hierarchie-Check: Kann der aktuelle User diese Rolle zuweisen?
  const canAssignRole = (roleName: string) => {
    const userRole = currentUser?.role_name;

    // Konfis werden über separate KonfiModal erstellt
    if (roleName === 'konfi') return false;

    if (userRole === 'org_admin') {
      return roleName !== 'konfi';
    } else if (userRole === 'admin') {
      return roleName !== 'org_admin' && roleName !== 'admin' && roleName !== 'konfi';
    }
    return false;
  };

  useEffect(() => {
    loadInitialData();
    if (isEditMode) {
      loadUser();
    }
  }, [userId]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [rolesResponse, jahrgaengeResponse] = await Promise.all([
        api.get('/roles'),
        api.get('/admin/jahrgaenge')
      ]);
      setRoles(rolesResponse.data);
      setJahrgaenge(jahrgaengeResponse.data);
    } catch (err) {
      console.error('Error loading initial data:', err);
      setError('Fehler beim Laden der Daten');
    } finally {
      if (!isEditMode) setLoading(false);
    }
  };

  const loadUser = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const response = await api.get(`/users/${userId}`);
      const userData = response.data;

      setUser(userData);
      setFormData({
        username: userData.username,
        email: userData.email || '',
        display_name: userData.display_name,
        role_title: userData.role_title || '',
        password: '',
        role_id: userData.role_id,
        is_active: userData.is_active
      });

      const assignments: { [key: number]: boolean } = {};
      if (userData.assigned_jahrgaenge) {
        userData.assigned_jahrgaenge.forEach((assignment: AssignedJahrgang) => {
          assignments[assignment.id] = assignment.can_view || assignment.can_edit;
        });
      }
      setJahrgangAssignments(assignments);
    } catch (err) {
      setError('Fehler beim Laden des Benutzers');
      console.error('Error loading user:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.username.trim() || !formData.display_name.trim() || !formData.role_id) {
      setError('Benutzername, Anzeigename und Rolle sind erforderlich');
      return;
    }

    if (!isEditMode && !formData.password.trim()) {
      setError('Passwort ist für neue Benutzer erforderlich');
      return;
    }

    setSaving(true);
    try {
      const userData: any = {
        username: formData.username.trim(),
        email: formData.email.trim() || null,
        display_name: formData.display_name.trim(),
        role_title: formData.role_title.trim() || null,
        role_id: formData.role_id,
        is_active: formData.is_active
      };

      if (formData.password.trim()) {
        userData.password = formData.password;
      }

      let userIdForAssignments = userId;
      if (isEditMode) {
        await api.put(`/users/${userId}`, userData);
        setSuccess('Benutzer erfolgreich aktualisiert');
      } else {
        const response = await api.post('/users', userData);
        userIdForAssignments = response.data.id;
        setSuccess('Benutzer erfolgreich erstellt');
      }

      // Update jahrgang assignments
      const assignments = Object.entries(jahrgangAssignments)
        .filter(([_, isAssigned]) => isAssigned)
        .map(([jahrgangId, _]) => ({
          jahrgang_id: parseInt(jahrgangId),
          can_view: true,
          can_edit: true
        }));

      if (userIdForAssignments) {
        await api.post(`/users/${userIdForAssignments}/jahrgaenge`, {
          jahrgang_assignments: assignments
        });
      }

      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Speichern des Benutzers');
    } finally {
      setSaving(false);
    }
  };

  const handleJahrgangAssignment = (jahrgangId: number, value: boolean) => {
    setJahrgangAssignments(prev => ({
      ...prev,
      [jahrgangId]: value
    }));
  };

  const getSelectedRole = () => {
    return roles.find(role => role.id === formData.role_id);
  };

  const presentRoleActionSheet = () => {
    const allowedRoles = roles.filter(role => canAssignRole(role.name));

    const buttons = allowedRoles.map(role => ({
      text: role.display_name,
      handler: () => {
        setFormData({ ...formData, role_id: role.id });
      }
    }));

    buttons.push({
      text: 'Abbrechen',
      handler: () => { }
    });

    presentActionSheet({
      header: 'Rolle auswählen',
      buttons: buttons
    });
  };

  const isValid = formData.username.trim() && formData.display_name.trim() && formData.role_id > 0;

  if (loading) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle>{isEditMode ? 'Benutzer bearbeiten' : 'Neuer Benutzer'}</IonTitle>
            <IonButtons slot="start">
              <IonButton onClick={onClose}>
                <IonIcon icon={closeOutline} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
            <IonSpinner name="crescent" />
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{isEditMode ? 'Benutzer bearbeiten' : 'Neuer Benutzer'}</IonTitle>
          <IonButtons slot="start">
            <IonButton onClick={onClose} disabled={saving}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton onClick={handleSave} disabled={!isValid || saving}>
              {saving ? <IonSpinner name="crescent" /> : <IonIcon icon={checkmarkOutline} />}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent style={{ '--padding-top': '16px' }}>
        {/* SEKTION: Persönliche Daten */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          margin: '16px 16px 12px 16px'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            backgroundColor: '#667eea',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
            flexShrink: 0
          }}>
            <IonIcon icon={personOutline} style={{ fontSize: '1rem', color: 'white' }} />
          </div>
          <h2 style={{
            fontWeight: '600',
            fontSize: '1.1rem',
            margin: '0',
            color: '#333'
          }}>
            Persönliche Daten
          </h2>
        </div>

        <IonCard style={{
          margin: '0 16px 16px 16px',
          borderRadius: '12px',
          background: 'white',
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          border: '1px solid #e0e0e0'
        }}>
          <IonCardContent style={{ padding: '16px' }}>
            <IonList style={{ background: 'transparent' }} lines="none">
              <IonItem style={{ '--background': '#f8f9fa', '--border-radius': '10px', marginBottom: '8px' }}>
                <IonLabel position="stacked">Anzeigename *</IonLabel>
                <IonInput
                  value={formData.display_name}
                  onIonInput={(e) => setFormData({ ...formData, display_name: e.detail.value! })}
                  placeholder="Max Mustermann"
                  disabled={saving}
                />
              </IonItem>

              <IonItem style={{ '--background': '#f8f9fa', '--border-radius': '10px', marginBottom: '8px' }}>
                <IonLabel position="stacked">Benutzername *</IonLabel>
                <IonInput
                  value={formData.username}
                  onIonInput={(e) => setFormData({ ...formData, username: e.detail.value! })}
                  placeholder="max.mustermann"
                  disabled={saving}
                />
              </IonItem>

              <IonItem style={{ '--background': '#f8f9fa', '--border-radius': '10px', marginBottom: '8px' }}>
                <IonLabel position="stacked">Funktionsbeschreibung (optional)</IonLabel>
                <IonInput
                  value={formData.role_title}
                  onIonInput={(e) => setFormData({ ...formData, role_title: e.detail.value! })}
                  placeholder="z.B. Pastor, Diakonin, Jugendmitarbeiter"
                  disabled={saving}
                />
              </IonItem>

              <IonItem style={{ '--background': '#f8f9fa', '--border-radius': '10px', marginBottom: '8px' }}>
                <IonLabel position="stacked">E-Mail (optional)</IonLabel>
                <IonInput
                  type="email"
                  value={formData.email}
                  onIonInput={(e) => setFormData({ ...formData, email: e.detail.value! })}
                  placeholder="max@example.com"
                  disabled={saving}
                />
              </IonItem>

              <IonItem style={{ '--background': '#f8f9fa', '--border-radius': '10px' }}>
                <IonLabel position="stacked">
                  Passwort {!isEditMode && <span style={{ color: '#ef4444' }}>*</span>}
                </IonLabel>
                <IonInput
                  type="password"
                  value={formData.password}
                  onIonInput={(e) => setFormData({ ...formData, password: e.detail.value! })}
                  placeholder={isEditMode ? "Leer lassen um nicht zu ändern" : "Passwort eingeben"}
                  disabled={saving}
                />
              </IonItem>
            </IonList>
          </IonCardContent>
        </IonCard>

        {/* SEKTION: Rolle und Status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          margin: '16px 16px 12px 16px'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            backgroundColor: '#667eea',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
            flexShrink: 0
          }}>
            <IonIcon icon={shieldOutline} style={{ fontSize: '1rem', color: 'white' }} />
          </div>
          <h2 style={{
            fontWeight: '600',
            fontSize: '1.1rem',
            margin: '0',
            color: '#333'
          }}>
            Rolle & Status
          </h2>
        </div>

        <IonCard style={{
          margin: '0 16px 16px 16px',
          borderRadius: '12px',
          background: 'white',
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          border: '1px solid #e0e0e0'
        }}>
          <IonCardContent style={{ padding: '16px' }}>
            <IonList style={{ background: 'transparent' }} lines="none">
              <IonItem
                button
                onClick={presentRoleActionSheet}
                disabled={saving}
                style={{
                  '--background': '#f8f9fa',
                  '--border-radius': '10px',
                  marginBottom: '12px'
                }}
              >
                <IonLabel>
                  <h3 style={{ fontWeight: '500', margin: '0 0 4px 0' }}>Rolle *</h3>
                  <p style={{ color: getSelectedRole() ? '#333' : '#999', margin: 0 }}>
                    {getSelectedRole() ? getSelectedRole()?.display_name : 'Rolle auswählen...'}
                  </p>
                </IonLabel>
              </IonItem>

              {getSelectedRole() && getSelectedRole()?.description && (
                <IonItem lines="none" style={{ '--background': 'transparent', marginBottom: '12px' }}>
                  <IonText color="medium">
                    <p style={{ fontSize: '0.85rem', margin: 0, fontStyle: 'italic' }}>
                      {getSelectedRole()?.description}
                    </p>
                  </IonText>
                </IonItem>
              )}

              <IonItem style={{ '--background': '#f8f9fa', '--border-radius': '10px' }}>
                <IonLabel>
                  <h3 style={{ fontWeight: '500', margin: '0 0 4px 0' }}>Konto aktiv</h3>
                  <p style={{ color: '#666', margin: 0, fontSize: '0.85rem' }}>
                    Benutzer kann sich anmelden
                  </p>
                </IonLabel>
                <IonToggle
                  slot="end"
                  checked={formData.is_active}
                  onIonChange={(e) => setFormData({ ...formData, is_active: e.detail.checked })}
                  disabled={saving}
                  style={{ marginRight: '0' }}
                />
              </IonItem>
            </IonList>
          </IonCardContent>
        </IonCard>

        {/* SEKTION: Jahrgang-Zuweisungen */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          margin: '16px 16px 12px 16px'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            backgroundColor: '#667eea',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
            flexShrink: 0
          }}>
            <IonIcon icon={schoolOutline} style={{ fontSize: '1rem', color: 'white' }} />
          </div>
          <h2 style={{
            fontWeight: '600',
            fontSize: '1.1rem',
            margin: '0',
            color: '#333'
          }}>
            Jahrgang-Zuweisungen
          </h2>
        </div>

        <IonCard style={{
          margin: '0 16px 16px 16px',
          borderRadius: '12px',
          background: 'white',
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          border: '1px solid #e0e0e0'
        }}>
          <IonCardContent style={{ padding: '16px' }}>
            {jahrgaenge.length === 0 ? (
              <IonItem lines="none" style={{ '--background': 'transparent' }}>
                <IonLabel style={{ textAlign: 'center' }}>
                  <p style={{ color: '#999', margin: 0 }}>Keine Jahrgänge verfügbar</p>
                </IonLabel>
              </IonItem>
            ) : (
              <IonList style={{ background: 'transparent' }} lines="none">
                {jahrgaenge.map(jahrgang => {
                  const isAssigned = jahrgangAssignments[jahrgang.id] || false;

                  return (
                    <IonItem
                      key={jahrgang.id}
                      style={{
                        '--background': isAssigned ? 'rgba(102, 126, 234, 0.08)' : '#f8f9fa',
                        '--border-radius': '8px',
                        marginBottom: '6px'
                      }}
                    >
                      <IonCheckbox
                        checked={isAssigned}
                        onIonChange={(e) => handleJahrgangAssignment(jahrgang.id, e.detail.checked)}
                        slot="start"
                        disabled={saving}
                        style={{ '--border-color': '#667eea', '--background-checked': '#667eea' }}
                      />
                      <IonLabel>
                        <h3 style={{ fontWeight: '500', margin: 0 }}>{jahrgang.name}</h3>
                      </IonLabel>
                      {isAssigned && (
                        <IonIcon
                          icon={checkmarkCircle}
                          slot="end"
                          style={{ color: '#667eea' }}
                        />
                      )}
                    </IonItem>
                  );
                })}

              </IonList>
            )}
          </IonCardContent>
        </IonCard>

        {/* Bestehende Zuweisungen im Edit-Modus */}
        {isEditMode && user?.assigned_jahrgaenge && user.assigned_jahrgaenge.length > 0 && (
          <>
            <IonCard style={{
              margin: '0 16px 24px 16px',
              borderRadius: '12px',
              background: 'white',
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
              border: '1px solid #e0e0e0'
            }}>
              <IonCardContent style={{ padding: '16px' }}>
                <IonList style={{ background: 'transparent' }} lines="none">
                  {user.assigned_jahrgaenge.map(assignment => (
                    <IonItem key={assignment.id} style={{ '--background': '#f8f9fa', '--border-radius': '8px', marginBottom: '6px' }}>
                      <IonIcon icon={checkmarkCircle} slot="start" style={{ color: '#667eea' }} />
                      <IonLabel>
                        <h3 style={{ fontWeight: '500', margin: '0 0 4px 0' }}>{assignment.name}</h3>
                        <p style={{ fontSize: '0.8rem', color: '#666', margin: 0 }}>
                          Zugewiesen: {new Date(assignment.assigned_at).toLocaleDateString('de-DE')}
                          {assignment.assigned_by_name && ` von ${assignment.assigned_by_name}`}
                        </p>
                      </IonLabel>
                    </IonItem>
                  ))}
                </IonList>
              </IonCardContent>
            </IonCard>
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default UserManagementModal;
