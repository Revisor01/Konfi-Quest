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
  IonToggle,
  IonCard,
  IonCardContent,
  IonIcon,
  IonCheckbox,
  IonList,
  IonListHeader,
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

  const getAllowedRoles = () => {
    return roles.filter(role => canAssignRole(role.name));
  };

  const getRoleColor = (roleName: string) => {
    switch (roleName) {
      case 'org_admin': return '#3b82f6';
      case 'admin': return '#ef4444';
      case 'teamer': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getRoleDisplayName = (roleName: string) => {
    switch (roleName) {
      case 'org_admin': return 'Admin';
      case 'admin': return 'Hauptamt';
      case 'teamer': return 'Team';
      default: return roleName;
    }
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

      <IonContent className="app-gradient-background">
        {/* SEKTION: Persönliche Daten */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--users">
              <IonIcon icon={personOutline} />
            </div>
            <IonLabel>Persönliche Daten</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent>
              <IonList style={{ background: 'transparent' }}>
                <IonItem lines="full" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">Anzeigename *</IonLabel>
                  <IonInput
                    value={formData.display_name}
                    onIonInput={(e) => setFormData({ ...formData, display_name: e.detail.value! })}
                    placeholder="Max Mustermann"
                    disabled={saving}
                  />
                </IonItem>

                <IonItem lines="full" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">Benutzername *</IonLabel>
                  <IonInput
                    value={formData.username}
                    onIonInput={(e) => setFormData({ ...formData, username: e.detail.value! })}
                    placeholder="max.mustermann"
                    disabled={saving}
                  />
                </IonItem>

                <IonItem lines="full" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">Funktionsbeschreibung (optional)</IonLabel>
                  <IonInput
                    value={formData.role_title}
                    onIonInput={(e) => setFormData({ ...formData, role_title: e.detail.value! })}
                    placeholder="z.B. Pastor, Diakonin, Jugendmitarbeiter"
                    disabled={saving}
                  />
                </IonItem>

                <IonItem lines="full" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">E-Mail (optional)</IonLabel>
                  <IonInput
                    type="email"
                    value={formData.email}
                    onIonInput={(e) => setFormData({ ...formData, email: e.detail.value! })}
                    placeholder="max@example.com"
                    disabled={saving}
                  />
                </IonItem>

                <IonItem lines="none" style={{ '--background': 'transparent' }}>
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
        </IonList>

        {/* SEKTION: Rolle und Status */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--users">
              <IonIcon icon={shieldOutline} />
            </div>
            <IonLabel>Rolle & Status</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: '16px 16px 8px 16px' }}>
              {/* Rolle - klickbare Liste */}
              <div style={{ marginBottom: '16px' }}>
                <IonLabel style={{ fontSize: '0.85rem', color: '#666', marginBottom: '8px', display: 'block' }}>
                  Rolle *
                </IonLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {getAllowedRoles().map(role => {
                    const isSelected = formData.role_id === role.id;
                    const roleColor = getRoleColor(role.name);

                    return (
                      <div
                        key={role.id}
                        onClick={() => !saving && setFormData({ ...formData, role_id: role.id })}
                        style={{
                          cursor: saving ? 'default' : 'pointer',
                          opacity: saving ? 0.6 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 16px',
                          borderRadius: '10px',
                          borderTop: '1px solid rgba(0,0,0,0.06)',
                          borderRight: '1px solid rgba(0,0,0,0.06)',
                          borderBottom: '1px solid rgba(0,0,0,0.06)',
                          borderLeft: `3px solid ${roleColor}`,
                          background: isSelected ? `${roleColor}15` : 'white'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div
                            className="app-icon-circle"
                            style={{ backgroundColor: roleColor, width: '32px', height: '32px' }}
                          >
                            <IonIcon icon={shieldOutline} style={{ fontSize: '0.9rem' }} />
                          </div>
                          <div>
                            <span style={{ fontWeight: '500', color: '#333', display: 'block' }}>
                              {getRoleDisplayName(role.name)}
                            </span>
                            {role.description && (
                              <span style={{ fontSize: '0.75rem', color: '#8e8e93' }}>
                                {role.description}
                              </span>
                            )}
                          </div>
                        </div>
                        <IonCheckbox
                          checked={isSelected}
                          disabled={saving}
                          style={{
                            '--checkbox-background-checked': roleColor,
                            '--border-color-checked': roleColor,
                            '--border-color': roleColor,
                            '--checkmark-color': 'white'
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Konto aktiv Toggle */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 0',
                borderTop: '1px solid rgba(0,0,0,0.06)'
              }}>
                <div>
                  <h3 style={{ fontWeight: '500', margin: '0 0 4px 0', fontSize: '0.95rem' }}>Konto aktiv</h3>
                  <p style={{ color: '#666', margin: 0, fontSize: '0.8rem' }}>
                    Benutzer kann sich anmelden
                  </p>
                </div>
                <IonToggle
                  checked={formData.is_active}
                  onIonChange={(e) => setFormData({ ...formData, is_active: e.detail.checked })}
                  disabled={saving}
                />
              </div>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* SEKTION: Jahrgang-Zuweisungen */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--users">
              <IonIcon icon={schoolOutline} />
            </div>
            <IonLabel>Jahrgang-Zuweisungen</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: '16px' }}>
            {jahrgaenge.length === 0 ? (
              <IonItem lines="none" style={{ '--background': 'transparent' }}>
                <IonLabel style={{ textAlign: 'center' }}>
                  <p style={{ color: '#999', margin: 0 }}>Keine Jahrgänge verfügbar</p>
                </IonLabel>
              </IonItem>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {jahrgaenge.map(jahrgang => {
                  const isAssigned = jahrgangAssignments[jahrgang.id] || false;

                  return (
                    <div
                      key={jahrgang.id}
                      className={`app-list-item app-list-item--users ${isAssigned ? 'app-list-item--selected' : ''}`}
                      onClick={() => !saving && handleJahrgangAssignment(jahrgang.id, !isAssigned)}
                      style={{
                        cursor: saving ? 'default' : 'pointer',
                        opacity: saving ? 0.6 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <span style={{ fontWeight: '500', color: '#333' }}>{jahrgang.name}</span>
                      <IonCheckbox
                        checked={isAssigned}
                        disabled={saving}
                        style={{
                          '--checkbox-background-checked': '#667eea',
                          '--border-color-checked': '#667eea',
                          '--checkmark-color': 'white'
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </IonCardContent>
        </IonCard>

        </IonList>

        {/* Bestehende Zuweisungen im Edit-Modus - als eigene Sektion */}
        {isEditMode && user?.assigned_jahrgaenge && user.assigned_jahrgaenge.length > 0 && (
          <IonList inset={true} style={{ margin: '16px' }}>
            <IonListHeader>
              <div className="app-section-icon app-section-icon--users">
                <IonIcon icon={checkmarkCircle} />
              </div>
              <IonLabel>Aktuelle Zuweisungen</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent style={{ padding: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {user.assigned_jahrgaenge.map(assignment => (
                    <div
                      key={assignment.id}
                      className="app-list-item app-list-item--users"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}
                    >
                      <IonIcon icon={checkmarkCircle} style={{ color: '#667eea', fontSize: '1.1rem', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: '500', fontSize: '0.9rem', color: '#333', display: 'block' }}>
                          {assignment.name}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#8e8e93' }}>
                          {new Date(assignment.assigned_at).toLocaleDateString('de-DE')}
                          {assignment.assigned_by_name && ` von ${assignment.assigned_by_name}`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}
      </IonContent>
    </IonPage>
  );
};

export default UserManagementModal;
