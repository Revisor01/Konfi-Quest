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
  IonList,
  IonListHeader,
  IonSpinner,
  IonTextarea
} from '@ionic/react';
import {
  closeOutline,
  checkmarkOutline,
  businessOutline,
  mailOutline,
  personOutline,
  shieldOutline,
  keyOutline,
  alertCircleOutline,
  people,
  flash,
  callOutline,
  locationOutline,
  addOutline
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';

interface Organization {
  id: number;
  name: string;
  slug: string;
  display_name: string;
  description?: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  website_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  user_count: number;
  konfi_count: number;
  event_count: number;
}

interface OrgAdmin {
  id: number;
  username: string;
  display_name: string;
  email?: string;
  is_active: boolean;
}

interface OrganizationManagementModalProps {
  organizationId?: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

const OrganizationManagementModal: React.FC<OrganizationManagementModalProps> = ({
  organizationId,
  onClose,
  onSuccess
}) => {
  const { setSuccess, setError } = useApp();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form data - Systemname wird automatisch generiert
  const [formData, setFormData] = useState({
    display_name: '',
    description: '',
    contact_email: '',
    contact_phone: '',
    address: '',
    website_url: '',
    is_active: true,
    // Admin-Daten für neue Organisation
    admin_name: '',        // Anzeigename des Admins (z.B. "Pastor Müller")
    admin_username: '',    // Login-Name (z.B. "pmueller")
    admin_password: ''
  });

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [orgAdmins, setOrgAdmins] = useState<OrgAdmin[]>([]);
  const [newPassword, setNewPassword] = useState('');
  const [selectedAdminId, setSelectedAdminId] = useState<number | null>(null);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [newAdminData, setNewAdminData] = useState({ display_name: '', username: '', password: '' });
  const [addingAdmin, setAddingAdmin] = useState(false);

  const isEditMode = !!organizationId;

  // Initialen berechnen
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Systemname automatisch aus display_name generieren
  const generateSystemName = (displayName: string) => {
    return displayName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  useEffect(() => {
    if (isEditMode) {
      loadOrganization();
    }
  }, [organizationId]);

  const loadOrganization = async () => {
    if (!organizationId) return;

    setLoading(true);
    try {
      const response = await api.get(`/organizations/${organizationId}`);
      const orgData = response.data;

      setOrganization(orgData);
      setFormData({
        display_name: orgData.display_name || '',
        description: orgData.description || '',
        contact_email: orgData.contact_email || '',
        contact_phone: orgData.contact_phone || '',
        address: orgData.address || '',
        website_url: orgData.website_url || '',
        is_active: orgData.is_active !== undefined ? orgData.is_active : true,
        admin_name: '',
        admin_username: '',
        admin_password: ''
      });

      // Org-Admins laden
      try {
        const usersResponse = await api.get(`/organizations/${organizationId}/admins`);
        if (usersResponse.data) {
          setOrgAdmins(usersResponse.data);
        }
      } catch (err) {
        console.log('Could not load org admins:', err);
      }
    } catch (err) {
      setError('Fehler beim Laden der Organisation');
      console.error('Error loading organization:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.display_name.trim()) {
      setError('Name der Organisation ist erforderlich');
      return;
    }

    // Validate admin fields for new organizations
    if (!isEditMode) {
      if (!formData.admin_name.trim() || !formData.admin_username.trim() || !formData.admin_password.trim()) {
        setError('Alle Administrator-Felder sind erforderlich');
        return;
      }
      if (formData.admin_password.length < 6) {
        setError('Das Passwort muss mindestens 6 Zeichen lang sein');
        return;
      }
    }

    // Validate email format if provided
    if (formData.contact_email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.contact_email.trim())) {
        setError('Ungültige E-Mail-Adresse');
        return;
      }
    }

    setSaving(true);
    try {
      const systemName = generateSystemName(formData.display_name);

      const orgData: any = {
        name: systemName,
        slug: systemName,
        display_name: formData.display_name.trim(),
        description: formData.description.trim() || null,
        contact_email: formData.contact_email.trim() || null,
        contact_phone: formData.contact_phone.trim() || null,
        address: formData.address.trim() || null,
        website_url: formData.website_url.trim() || null,
        is_active: formData.is_active
      };

      if (!isEditMode) {
        orgData.admin_username = formData.admin_username.trim();
        orgData.admin_password = formData.admin_password.trim();
        orgData.admin_display_name = formData.admin_name.trim();
      }

      if (isEditMode) {
        await api.put(`/organizations/${organizationId}`, orgData);
        setSuccess('Organisation erfolgreich aktualisiert');
      } else {
        await api.post('/organizations', orgData);
        setSuccess('Organisation und Administrator erfolgreich erstellt');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async (adminId: number) => {
    if (!newPassword.trim()) {
      setError('Bitte geben Sie ein neues Passwort ein');
      return;
    }

    if (newPassword.length < 6) {
      setError('Das Passwort muss mindestens 6 Zeichen lang sein');
      return;
    }

    setResettingPassword(true);
    setSelectedAdminId(adminId);
    try {
      await api.put(`/users/${adminId}/reset-password`, { password: newPassword });
      setSuccess('Passwort erfolgreich zurückgesetzt');
      setNewPassword('');
      setSelectedAdminId(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Zurücksetzen des Passworts');
    } finally {
      setResettingPassword(false);
    }
  };

  const handleAddAdmin = async () => {
    if (!newAdminData.display_name.trim() || !newAdminData.username.trim() || !newAdminData.password.trim()) {
      setError('Alle Felder sind erforderlich');
      return;
    }

    if (newAdminData.password.length < 8) {
      setError('Das Passwort muss mindestens 8 Zeichen lang sein');
      return;
    }

    setAddingAdmin(true);
    try {
      const response = await api.post(`/organizations/${organizationId}/admins`, newAdminData);
      setOrgAdmins([...orgAdmins, response.data]);
      setNewAdminData({ display_name: '', username: '', password: '' });
      setShowAddAdmin(false);
      setSuccess('Neuer Administrator erfolgreich hinzugefügt');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Hinzufügen des Administrators');
    } finally {
      setAddingAdmin(false);
    }
  };

  const isValid = formData.display_name.trim() &&
    (isEditMode || (formData.admin_name.trim() && formData.admin_username.trim() && formData.admin_password.trim()));

  if (loading) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle>{isEditMode ? 'Organisation bearbeiten' : 'Neue Organisation'}</IonTitle>
            <IonButtons slot="start">
              <IonButton onClick={onClose}><IonIcon icon={closeOutline} /></IonButton>
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
          <IonTitle>{isEditMode ? 'Organisation bearbeiten' : 'Neue Organisation'}</IonTitle>
          <IonButtons slot="start">
            <IonButton onClick={onClose} disabled={saving}><IonIcon icon={closeOutline} /></IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton onClick={handleSave} disabled={!isValid || saving}>
              {saving ? <IonSpinner name="crescent" /> : <IonIcon icon={checkmarkOutline} />}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        {/* SEKTION: Organisations-Daten */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--organizations">
              <IonIcon icon={businessOutline} />
            </div>
            <IonLabel>Organisation</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: '16px' }}>
              <IonList style={{ background: 'transparent' }}>
                <IonItem lines="full" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">Name der Organisation *</IonLabel>
                  <IonInput
                    value={formData.display_name}
                    onIonInput={(e) => setFormData({ ...formData, display_name: e.detail.value! })}
                    placeholder="z.B. Kirchspiel West"
                    disabled={saving}
                  />
                </IonItem>

                <IonItem lines="none" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">Beschreibung (optional)</IonLabel>
                  <IonTextarea
                    value={formData.description}
                    onIonInput={(e) => setFormData({ ...formData, description: e.detail.value! })}
                    placeholder="Kurze Beschreibung"
                    autoGrow={true}
                    rows={2}
                    disabled={saving}
                  />
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* SEKTION: Kontakt */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--organizations">
              <IonIcon icon={mailOutline} />
            </div>
            <IonLabel>Kontakt</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: '16px' }}>
              <IonList style={{ background: 'transparent' }}>
                <IonItem lines="full" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">E-Mail</IonLabel>
                  <IonInput type="email" value={formData.contact_email} onIonInput={(e) => setFormData({ ...formData, contact_email: e.detail.value! })} placeholder="kontakt@beispiel.de" disabled={saving} />
                </IonItem>
                <IonItem lines="full" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">Telefon</IonLabel>
                  <IonInput type="tel" value={formData.contact_phone} onIonInput={(e) => setFormData({ ...formData, contact_phone: e.detail.value! })} placeholder="04834 12345" disabled={saving} />
                </IonItem>
                <IonItem lines="full" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">Adresse</IonLabel>
                  <IonTextarea
                    value={formData.address}
                    onIonInput={(e) => setFormData({ ...formData, address: e.detail.value! })}
                    placeholder="Kirchstraße 1, 25764 Wesselburen"
                    autoGrow={true}
                    rows={2}
                    disabled={saving}
                  />
                </IonItem>
                <IonItem lines="none" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">Website</IonLabel>
                  <IonInput type="url" value={formData.website_url} onIonInput={(e) => setFormData({ ...formData, website_url: e.detail.value! })} placeholder="https://www.beispiel.de" disabled={saving} />
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* SEKTION: Status */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--organizations">
              <IonIcon icon={shieldOutline} />
            </div>
            <IonLabel>Status</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: '16px' }}>
              <IonList style={{ background: 'transparent' }}>
                <IonItem lines="none" style={{ '--background': 'transparent' }}>
                  <IonLabel>
                    <h3 style={{ fontWeight: '500', margin: '0 0 4px 0' }}>Organisation aktiv</h3>
                    <p style={{ color: '#666', margin: 0, fontSize: '0.85rem' }}>Benutzer können sich anmelden</p>
                  </IonLabel>
                  <IonToggle slot="end" checked={formData.is_active} onIonChange={(e) => setFormData({ ...formData, is_active: e.detail.checked })} disabled={saving} />
                </IonItem>
                {!formData.is_active && (
                  <IonItem lines="none" style={{ '--background': 'rgba(239, 68, 68, 0.08)', borderRadius: '10px', marginTop: '8px' }}>
                    <IonIcon icon={alertCircleOutline} slot="start" style={{ color: '#ef4444' }} />
                    <IonLabel><p style={{ color: '#ef4444', margin: 0, fontWeight: '500' }}>Inaktive Organisationen sind gesperrt</p></IonLabel>
                  </IonItem>
                )}
              </IonList>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* SEKTION: Administrator erstellen (nur bei neuer Organisation) */}
        {!isEditMode && (
          <IonList inset={true} style={{ margin: '16px' }}>
            <IonListHeader>
              <div className="app-section-icon app-section-icon--organizations">
                <IonIcon icon={personOutline} />
              </div>
              <IonLabel>Organisations-Administrator</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent style={{ padding: '16px' }}>
                <IonList style={{ background: 'transparent' }}>
                  <IonItem lines="full" style={{ '--background': 'transparent' }}>
                    <IonLabel position="stacked">Name des Administrators *</IonLabel>
                    <IonInput value={formData.admin_name} onIonInput={(e) => setFormData({ ...formData, admin_name: e.detail.value! })} placeholder="z.B. Pastor Mueller" disabled={saving} />
                  </IonItem>
                  <IonItem lines="full" style={{ '--background': 'transparent' }}>
                    <IonLabel position="stacked">Login-Benutzername *</IonLabel>
                    <IonInput value={formData.admin_username} onIonInput={(e) => setFormData({ ...formData, admin_username: e.detail.value! })} placeholder="z.B. pmueller" disabled={saving} />
                  </IonItem>
                  <IonItem lines="none" style={{ '--background': 'transparent' }}>
                    <IonLabel position="stacked">Passwort *</IonLabel>
                    <IonInput type="password" value={formData.admin_password} onIonInput={(e) => setFormData({ ...formData, admin_password: e.detail.value! })} placeholder="Mindestens 6 Zeichen" disabled={saving} />
                  </IonItem>
                </IonList>

                <IonItem lines="none" style={{ '--background': 'rgba(45, 211, 111, 0.08)', borderRadius: '10px', marginTop: '12px' }}>
                  <IonIcon icon={shieldOutline} slot="start" style={{ color: '#2dd36f' }} />
                  <IonLabel>
                    <p style={{ color: '#2dd36f', margin: 0, fontWeight: '500', fontSize: '0.85rem' }}>
                      Der Administrator kann die gesamte Organisation verwalten
                    </p>
                  </IonLabel>
                </IonItem>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* SEKTION: Organisations-Administratoren verwalten (nur im Edit-Modus) */}
        {isEditMode && (
          <IonList inset={true} style={{ margin: '16px' }}>
            <IonListHeader>
              <div className="app-section-icon app-section-icon--organizations">
                <IonIcon icon={personOutline} />
              </div>
              <IonLabel>Organisations-Administratoren</IonLabel>
              <IonButton
                size="small"
                fill="clear"
                onClick={() => setShowAddAdmin(!showAddAdmin)}
                style={{ '--color': '#2dd36f' }}
              >
                <IonIcon icon={addOutline} slot="start" />
                Hinzufügen
              </IonButton>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent style={{ padding: '16px' }}>
                {/* Bestehende Admins */}
                {orgAdmins.length > 0 ? (
                  <IonList style={{ background: 'transparent' }} lines="none">
                    {orgAdmins.map((admin) => (
                      <div key={admin.id} style={{ marginBottom: '16px' }}>
                        <IonItem style={{ '--background': '#f8f9fa', '--border-radius': '10px', marginBottom: '8px' }}>
                          <div slot="start" style={{
                            width: '40px', height: '40px', borderRadius: '50%',
                            backgroundColor: admin.is_active ? '#2dd36f' : '#6b7280',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'white', fontWeight: '700', fontSize: '0.9rem',
                            boxShadow: admin.is_active ? '0 2px 8px rgba(45, 211, 111, 0.3)' : 'none'
                          }}>
                            {getInitials(admin.display_name)}
                          </div>
                          <IonLabel>
                            <h3 style={{ fontWeight: '600', margin: '0 0 4px 0' }}>{admin.display_name}</h3>
                            <p style={{ color: '#666', margin: 0, fontSize: '0.85rem' }}>
                              Login: {admin.username}
                              {admin.email && ` · ${admin.email}`}
                            </p>
                          </IonLabel>
                        </IonItem>

                        {/* Passwort zurücksetzen für diesen Admin */}
                        <div style={{ marginLeft: '48px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <IonIcon icon={keyOutline} style={{ color: '#2dd36f', fontSize: '0.9rem' }} />
                            <span style={{ fontWeight: '500', fontSize: '0.85rem', color: '#666' }}>Passwort zurücksetzen</span>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <IonInput
                              type="password"
                              value={selectedAdminId === admin.id ? newPassword : ''}
                              onIonInput={(e) => {
                                setSelectedAdminId(admin.id);
                                setNewPassword(e.detail.value!);
                              }}
                              placeholder="Neues Passwort"
                              disabled={resettingPassword}
                              style={{
                                '--background': '#f8f9fa',
                                '--padding-start': '12px',
                                '--padding-end': '12px',
                                borderRadius: '8px',
                                flex: 1
                              }}
                            />
                            <IonButton
                              size="small"
                              onClick={() => handleResetPassword(admin.id)}
                              disabled={selectedAdminId !== admin.id || !newPassword.trim() || resettingPassword}
                              style={{ '--background': '#2dd36f', '--background-activated': '#16a34a' }}
                            >
                              {resettingPassword && selectedAdminId === admin.id ? <IonSpinner name="crescent" /> : 'Setzen'}
                            </IonButton>
                          </div>
                        </div>
                      </div>
                    ))}
                  </IonList>
                ) : (
                  <div style={{ textAlign: 'center', padding: '16px', color: '#666' }}>
                    <IonIcon icon={alertCircleOutline} style={{ fontSize: '2rem', color: '#f59e0b', marginBottom: '8px', display: 'block' }} />
                    Kein Administrator vorhanden
                  </div>
                )}

                {/* Neuen Admin hinzufügen */}
                {showAddAdmin && (
                  <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(45, 211, 111, 0.05)', borderRadius: '12px', border: '1px dashed #2dd36f' }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: '600', color: '#333' }}>Neuen Administrator hinzufügen</h4>
                    <IonList style={{ background: 'transparent' }} lines="none">
                      <IonItem style={{ '--background': 'white', '--border-radius': '10px', marginBottom: '8px' }}>
                        <IonLabel position="stacked">Name *</IonLabel>
                        <IonInput
                          value={newAdminData.display_name}
                          onIonInput={(e) => setNewAdminData({ ...newAdminData, display_name: e.detail.value! })}
                          placeholder="z.B. Pastor Müller"
                          disabled={addingAdmin}
                        />
                      </IonItem>
                      <IonItem style={{ '--background': 'white', '--border-radius': '10px', marginBottom: '8px' }}>
                        <IonLabel position="stacked">Login-Benutzername *</IonLabel>
                        <IonInput
                          value={newAdminData.username}
                          onIonInput={(e) => setNewAdminData({ ...newAdminData, username: e.detail.value! })}
                          placeholder="z.B. pmueller"
                          disabled={addingAdmin}
                        />
                      </IonItem>
                      <IonItem style={{ '--background': 'white', '--border-radius': '10px', marginBottom: '8px' }}>
                        <IonLabel position="stacked">Passwort *</IonLabel>
                        <IonInput
                          type="password"
                          value={newAdminData.password}
                          onIonInput={(e) => setNewAdminData({ ...newAdminData, password: e.detail.value! })}
                          placeholder="Mindestens 6 Zeichen"
                          disabled={addingAdmin}
                        />
                      </IonItem>
                    </IonList>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                      <IonButton
                        expand="block"
                        fill="outline"
                        onClick={() => {
                          setShowAddAdmin(false);
                          setNewAdminData({ display_name: '', username: '', password: '' });
                        }}
                        disabled={addingAdmin}
                        style={{ flex: 1, '--border-color': '#666', '--color': '#666' }}
                      >
                        Abbrechen
                      </IonButton>
                      <IonButton
                        expand="block"
                        onClick={handleAddAdmin}
                        disabled={!newAdminData.display_name.trim() || !newAdminData.username.trim() || !newAdminData.password.trim() || addingAdmin}
                        style={{ flex: 1, '--background': '#2dd36f', '--background-activated': '#16a34a' }}
                      >
                        {addingAdmin ? <IonSpinner name="crescent" /> : 'Hinzufügen'}
                      </IonButton>
                    </div>
                  </div>
                )}
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* SEKTION: Statistiken (nur im Edit-Modus) */}
        {isEditMode && organization && (
          <IonList inset={true} style={{ margin: '16px' }}>
            <IonListHeader>
              <div className="app-section-icon app-section-icon--organizations">
                <IonIcon icon={businessOutline} />
              </div>
              <IonLabel>Statistiken</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent style={{ padding: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <div style={{ background: '#f8f9fa', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                    <IonIcon icon={people} style={{ fontSize: '1.2rem', color: '#34c759', display: 'block', margin: '0 auto 4px' }} />
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#2dd36f' }}>{organization.konfi_count || 0}</div>
                    <div style={{ fontSize: '0.75rem', color: '#666' }}>Konfis</div>
                  </div>
                  <div style={{ background: '#f8f9fa', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                    <IonIcon icon={personOutline} style={{ fontSize: '1.2rem', color: '#f59e0b', display: 'block', margin: '0 auto 4px' }} />
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#2dd36f' }}>{organization.user_count || 0}</div>
                    <div style={{ fontSize: '0.75rem', color: '#666' }}>Team</div>
                  </div>
                  <div style={{ background: '#f8f9fa', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                    <IonIcon icon={flash} style={{ fontSize: '1.2rem', color: '#dc2626', display: 'block', margin: '0 auto 4px' }} />
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#2dd36f' }}>{organization.event_count || 0}</div>
                    <div style={{ fontSize: '0.75rem', color: '#666' }}>Events</div>
                  </div>
                </div>

                <IonItem lines="none" style={{ '--background': 'transparent', marginTop: '12px' }}>
                  <IonLabel>
                    <p style={{ fontSize: '0.8rem', color: '#999', margin: 0, textAlign: 'center' }}>
                      Erstellt: {new Date(organization.created_at).toLocaleDateString('de-DE')}
                      {' · '}
                      Aktualisiert: {new Date(organization.updated_at).toLocaleDateString('de-DE')}
                    </p>
                  </IonLabel>
                </IonItem>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}
      </IonContent>
    </IonPage>
  );
};

export default OrganizationManagementModal;
