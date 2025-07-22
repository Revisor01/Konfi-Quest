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
  useIonActionSheet,
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
  const { setSuccess, setError, user } = useApp();
  const [presentActionSheet] = useIonActionSheet();
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
  
  // Jahrgang assignments - simplified to just assignment toggle
  const [jahrgangAssignments, setJahrgangAssignments] = useState<{[key: number]: boolean}>({});

  const isEditMode = !!userId;

  // Hierarchie-Check: Kann der aktuelle User diese Rolle zuweisen?
  const canAssignRole = (roleName: string) => {
    const userRole = user?.role_name;
    
    if (userRole === 'org_admin') {
      return true; // org_admin kann alle Rollen zuweisen
    } else if (userRole === 'admin') {
      return roleName !== 'org_admin' && roleName !== 'admin'; // admin kann nicht org_admin oder admin zuweisen
    } else if (userRole === 'teamer') {
      return roleName === 'konfi'; // teamer kann nur konfi zuweisen
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

      // Set jahrgang assignments - simplified to just assigned status
      const assignments: {[key: number]: boolean} = {};
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

      // Update jahrgang assignments - set both can_view and can_edit to true for assigned jahrgaenge
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
      setLoading(false);
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
      text: `${role.display_name} (${role.name})`,
      handler: () => {
        setFormData({ ...formData, role_id: role.id });
      }
    }));

    buttons.push({
      text: 'Abbrechen',
      role: 'cancel'
    });

    presentActionSheet({
      header: 'Rolle auswählen',
      buttons: buttons
    });
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
              <IonIcon icon={checkmark} />
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
            <IonItem button onClick={presentRoleActionSheet}>
              <IonIcon icon={shield} slot="start" color="danger" />
              <IonLabel>
                <h3>Rolle *</h3>
                <p>{getSelectedRole() ? `${getSelectedRole()?.display_name} (${getSelectedRole()?.name})` : 'Rolle auswählen'}</p>
              </IonLabel>
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
                  const isAssigned = jahrgangAssignments[jahrgang.id] || false;
                  
                  return (
                    <IonItem key={jahrgang.id}>
                      <IonCheckbox
                        checked={isAssigned}
                        onIonChange={(e) => handleJahrgangAssignment(jahrgang.id, e.detail.checked)}
                        slot="start"
                      />
                      <IonLabel>
                        <h3>{jahrgang.name}</h3>
                        <p>Jahrgang zuweisen</p>
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
                  <IonIcon icon={checkmark} color="success" slot="start" />
                  <IonLabel>
                    <h3>{assignment.name}</h3>
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