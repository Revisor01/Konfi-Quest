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
  IonSelect,
  IonSelectOption,
  IonToggle,
  IonCard,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonIcon,
  IonCheckbox,
  IonList,
  IonChip,
  IonText
} from '@ionic/react';
import { 
  save, 
  close, 
  person, 
  shield,
  mail,
  key,
  school,
  checkmark
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';

interface User {
  id: number;
  username: string;
  email?: string;
  display_name: string;
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
  permission_count: number;
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
  const { setSuccess, setError } = useApp();
  const [loading, setLoading] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    display_name: '',
    password: '',
    role_id: 0,
    is_active: true
  });

  // Available data
  const [roles, setRoles] = useState<Role[]>([]);
  const [jahrgaenge, setJahrgaenge] = useState<Jahrgang[]>([]);
  const [user, setUser] = useState<User | null>(null);
  
  // Jahrgang assignments
  const [jahrgangAssignments, setJahrgangAssignments] = useState<{[key: number]: {can_view: boolean, can_edit: boolean}}>({});

  const isEditMode = !!userId;

  useEffect(() => {
    loadInitialData();
    if (isEditMode) {
      loadUser();
    }
  }, [userId]);

  const loadInitialData = async () => {
    try {
      // Load roles
      const rolesResponse = await api.get('/roles');
      setRoles(rolesResponse.data);

      // Load jahrgaenge
      const jahrgaengeResponse = await api.get('/admin/jahrgaenge');
      setJahrgaenge(jahrgaengeResponse.data);
    } catch (err) {
      console.error('Error loading initial data:', err);
      setError('Fehler beim Laden der Daten');
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
        password: '', // Never pre-fill password
        role_id: userData.role_id,
        is_active: userData.is_active
      });

      // Set jahrgang assignments
      const assignments: {[key: number]: {can_view: boolean, can_edit: boolean}} = {};
      if (userData.assigned_jahrgaenge) {
        userData.assigned_jahrgaenge.forEach((assignment: AssignedJahrgang) => {
          assignments[assignment.id] = {
            can_view: assignment.can_view,
            can_edit: assignment.can_edit
          };
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

    setLoading(true);
    try {
      // Prepare user data
      const userData: any = {
        username: formData.username.trim(),
        email: formData.email.trim() || null,
        display_name: formData.display_name.trim(),
        role_id: formData.role_id,
        is_active: formData.is_active
      };

      if (formData.password.trim()) {
        userData.password = formData.password;
      }

      // Create or update user
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
        .filter(([_, assignment]) => assignment.can_view || assignment.can_edit)
        .map(([jahrgangId, assignment]) => ({
          jahrgang_id: parseInt(jahrgangId),
          can_view: assignment.can_view,
          can_edit: assignment.can_edit
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
      setLoading(false);
    }
  };

  const handleJahrgangAssignment = (jahrgangId: number, field: 'can_view' | 'can_edit', value: boolean) => {
    setJahrgangAssignments(prev => ({
      ...prev,
      [jahrgangId]: {
        ...prev[jahrgangId],
        [field]: value,
        // If can_edit is true, can_view must also be true
        ...(field === 'can_edit' && value ? { can_view: true } : {}),
        // If can_view is false, can_edit must also be false
        ...(field === 'can_view' && !value ? { can_edit: false } : {})
      }
    }));
  };

  const getSelectedRole = () => {
    return roles.find(role => role.id === formData.role_id);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{isEditMode ? 'Benutzer bearbeiten' : 'Neuer Benutzer'}</IonTitle>
          <IonButtons slot="start">
            <IonButton onClick={onClose}>
              <IonIcon icon={close} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton onClick={handleSave} disabled={loading}>
              <IonIcon icon={save} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {/* Basis-Informationen */}
        <IonCard>
          <IonCardContent>
            <IonItem>
              <IonIcon icon={person} slot="start" color="primary" />
              <IonLabel position="stacked">Benutzername *</IonLabel>
              <IonInput
                value={formData.username}
                onIonInput={(e) => setFormData({ ...formData, username: e.detail.value! })}
                placeholder="benutzername"
                required
              />
            </IonItem>

            <IonItem>
              <IonIcon icon={person} slot="start" color="primary" />
              <IonLabel position="stacked">Anzeigename *</IonLabel>
              <IonInput
                value={formData.display_name}
                onIonInput={(e) => setFormData({ ...formData, display_name: e.detail.value! })}
                placeholder="Max Mustermann"
                required
              />
            </IonItem>

            <IonItem>
              <IonIcon icon={mail} slot="start" color="primary" />
              <IonLabel position="stacked">E-Mail</IonLabel>
              <IonInput
                type="email"
                value={formData.email}
                onIonInput={(e) => setFormData({ ...formData, email: e.detail.value! })}
                placeholder="user@example.com"
              />
            </IonItem>

            <IonItem>
              <IonIcon icon={key} slot="start" color="warning" />
              <IonLabel position="stacked">
                Passwort {!isEditMode && <span style={{ color: 'red' }}>*</span>}
              </IonLabel>
              <IonInput
                type="password"
                value={formData.password}
                onIonInput={(e) => setFormData({ ...formData, password: e.detail.value! })}
                placeholder={isEditMode ? "Leer lassen, um nicht zu ändern" : "Passwort eingeben"}
              />
            </IonItem>
          </IonCardContent>
        </IonCard>

        {/* Rolle und Status */}
        <IonCard>
          <IonCardContent>
            <IonItem>
              <IonIcon icon={shield} slot="start" color="danger" />
              <IonLabel position="stacked">Rolle *</IonLabel>
              <IonSelect
                value={formData.role_id}
                onIonChange={(e) => setFormData({ ...formData, role_id: e.detail.value })}
                placeholder="Rolle auswählen"
              >
                {roles.map(role => (
                  <IonSelectOption key={role.id} value={role.id}>
                    {role.display_name} ({role.name})
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>

            {getSelectedRole() && (
              <IonItem lines="none">
                <IonLabel>
                  <p style={{ fontSize: '0.85rem', color: '#666', fontStyle: 'italic' }}>
                    {getSelectedRole()?.description}
                  </p>
                </IonLabel>
              </IonItem>
            )}

            <IonItem>
              <IonLabel>
                <h3>Aktiv</h3>
                <p>Benutzer kann sich anmelden</p>
              </IonLabel>
              <IonToggle
                checked={formData.is_active}
                onIonChange={(e) => setFormData({ ...formData, is_active: e.detail.checked })}
              />
            </IonItem>
          </IonCardContent>
        </IonCard>

        {/* Jahrgang-Zuweisungen */}
        <IonCard>
          <IonCardContent>
            <IonItem lines="none">
              <IonIcon icon={school} slot="start" color="tertiary" />
              <IonLabel>
                <h2>Jahrgang-Zuweisungen</h2>
                <p>Bestimme, auf welche Jahrgänge der Benutzer zugreifen kann</p>
              </IonLabel>
            </IonItem>

            {jahrgaenge.length === 0 ? (
              <IonItem>
                <IonLabel>
                  <p style={{ textAlign: 'center', color: '#666' }}>
                    Keine Jahrgänge verfügbar
                  </p>
                </IonLabel>
              </IonItem>
            ) : (
              <IonList>
                {jahrgaenge.map(jahrgang => {
                  const assignment = jahrgangAssignments[jahrgang.id] || { can_view: false, can_edit: false };
                  
                  return (
                    <IonItem key={jahrgang.id}>
                      <IonLabel>
                        <h3>{jahrgang.name}</h3>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}>
                            <IonCheckbox
                              checked={assignment.can_view}
                              onIonChange={(e) => handleJahrgangAssignment(jahrgang.id, 'can_view', e.detail.checked)}
                            />
                            Anzeigen
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}>
                            <IonCheckbox
                              checked={assignment.can_edit}
                              onIonChange={(e) => handleJahrgangAssignment(jahrgang.id, 'can_edit', e.detail.checked)}
                            />
                            Bearbeiten
                          </label>
                        </div>
                      </IonLabel>
                    </IonItem>
                  );
                })}
              </IonList>
            )}

            <IonItem lines="none">
              <IonText color="medium">
                <p style={{ fontSize: '0.8rem', margin: '8px 0 0' }}>
                  Hinweis: Admin-Benutzer haben automatisch Zugriff auf alle Jahrgänge.
                  "Bearbeiten" beinhaltet automatisch auch "Anzeigen".
                </p>
              </IonText>
            </IonItem>
          </IonCardContent>
        </IonCard>

        {/* Bestehende Zuweisungen anzeigen (nur im Edit-Modus) */}
        {isEditMode && user?.assigned_jahrgaenge && user.assigned_jahrgaenge.length > 0 && (
          <IonCard>
            <IonCardContent>
              <IonItem lines="none">
                <IonLabel>
                  <h2>Aktuelle Zuweisungen</h2>
                </IonLabel>
              </IonItem>

              {user.assigned_jahrgaenge.map(assignment => (
                <IonItem key={assignment.id}>
                  <IonLabel>
                    <h3>{assignment.name}</h3>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                      {assignment.can_view && (
                        <IonChip color="primary" style={{ fontSize: '0.75rem', height: '20px' }}>
                          Anzeigen
                        </IonChip>
                      )}
                      {assignment.can_edit && (
                        <IonChip color="success" style={{ fontSize: '0.75rem', height: '20px' }}>
                          Bearbeiten
                        </IonChip>
                      )}
                    </div>
                    <p style={{ fontSize: '0.8rem', color: '#666', margin: '4px 0 0' }}>
                      Zugewiesen: {new Date(assignment.assigned_at).toLocaleDateString('de-DE')}
                      {assignment.assigned_by_name && ` von ${assignment.assigned_by_name}`}
                    </p>
                  </IonLabel>
                </IonItem>
              ))}
            </IonCardContent>
          </IonCard>
        )}
      </IonContent>
    </IonPage>
  );
};

export default UserManagementModal;