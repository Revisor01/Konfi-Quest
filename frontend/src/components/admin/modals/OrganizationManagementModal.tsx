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
  flash
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
    website_url: '',
    is_active: true,
    // Admin-Daten fuer neue Organisation
    admin_name: '',        // Anzeigename des Admins (z.B. "Pastor Mueller")
    admin_username: '',    // Login-Name (z.B. "pmueller")
    admin_password: ''
  });

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [orgAdmin, setOrgAdmin] = useState<OrgAdmin | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

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
        website_url: orgData.website_url || '',
        is_active: orgData.is_active !== undefined ? orgData.is_active : true,
        admin_name: '',
        admin_username: '',
        admin_password: ''
      });

      // Org-Admin laden
      try {
        const usersResponse = await api.get(`/organizations/${organizationId}/admins`);
        if (usersResponse.data && usersResponse.data.length > 0) {
          setOrgAdmin(usersResponse.data[0]);
        }
      } catch (err) {
        console.log('Could not load org admin:', err);
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
        setError('Ungueltige E-Mail-Adresse');
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

  const handleResetPassword = async () => {
    if (!orgAdmin || !newPassword.trim()) {
      setError('Bitte geben Sie ein neues Passwort ein');
      return;
    }

    if (newPassword.length < 6) {
      setError('Das Passwort muss mindestens 6 Zeichen lang sein');
      return;
    }

    setResettingPassword(true);
    try {
      await api.put(`/users/${orgAdmin.id}/reset-password`, { password: newPassword });
      setSuccess('Passwort erfolgreich zurueckgesetzt');
      setNewPassword('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Zuruecksetzen des Passworts');
    } finally {
      setResettingPassword(false);
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

      <IonContent style={{ '--padding-top': '16px' }}>
        {/* SEKTION: Organisations-Daten */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 16px 12px 16px' }}>
          <div style={{
            width: '32px', height: '32px', backgroundColor: '#2dd36f', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(45, 211, 111, 0.3)'
          }}>
            <IonIcon icon={businessOutline} style={{ fontSize: '1rem', color: 'white' }} />
          </div>
          <h2 style={{ fontWeight: '600', fontSize: '1.1rem', margin: '0', color: '#333' }}>
            Organisation
          </h2>
        </div>

        <IonCard style={{ margin: '0 16px 16px 16px', borderRadius: '12px', background: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', border: '1px solid #e0e0e0' }}>
          <IonCardContent style={{ padding: '16px' }}>
            <IonList style={{ background: 'transparent' }} lines="none">
              <IonItem style={{ '--background': '#f8f9fa', '--border-radius': '10px', marginBottom: '8px' }}>
                <IonLabel position="stacked">Name der Organisation *</IonLabel>
                <IonInput
                  value={formData.display_name}
                  onIonInput={(e) => setFormData({ ...formData, display_name: e.detail.value! })}
                  placeholder="z.B. Kirchspiel West"
                  disabled={saving}
                />
              </IonItem>

              <IonItem style={{ '--background': '#f8f9fa', '--border-radius': '10px' }}>
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

        {/* SEKTION: Kontakt */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 16px 12px 16px' }}>
          <div style={{
            width: '32px', height: '32px', backgroundColor: '#2dd36f', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(45, 211, 111, 0.3)'
          }}>
            <IonIcon icon={mailOutline} style={{ fontSize: '1rem', color: 'white' }} />
          </div>
          <h2 style={{ fontWeight: '600', fontSize: '1.1rem', margin: '0', color: '#333' }}>Kontakt</h2>
        </div>

        <IonCard style={{ margin: '0 16px 16px 16px', borderRadius: '12px', background: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', border: '1px solid #e0e0e0' }}>
          <IonCardContent style={{ padding: '16px' }}>
            <IonList style={{ background: 'transparent' }} lines="none">
              <IonItem style={{ '--background': '#f8f9fa', '--border-radius': '10px', marginBottom: '8px' }}>
                <IonLabel position="stacked">E-Mail</IonLabel>
                <IonInput type="email" value={formData.contact_email} onIonInput={(e) => setFormData({ ...formData, contact_email: e.detail.value! })} placeholder="kontakt@beispiel.de" disabled={saving} />
              </IonItem>
              <IonItem style={{ '--background': '#f8f9fa', '--border-radius': '10px' }}>
                <IonLabel position="stacked">Website</IonLabel>
                <IonInput type="url" value={formData.website_url} onIonInput={(e) => setFormData({ ...formData, website_url: e.detail.value! })} placeholder="https://www.beispiel.de" disabled={saving} />
              </IonItem>
            </IonList>
          </IonCardContent>
        </IonCard>

        {/* SEKTION: Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 16px 12px 16px' }}>
          <div style={{
            width: '32px', height: '32px', backgroundColor: '#2dd36f', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(45, 211, 111, 0.3)'
          }}>
            <IonIcon icon={shieldOutline} style={{ fontSize: '1rem', color: 'white' }} />
          </div>
          <h2 style={{ fontWeight: '600', fontSize: '1.1rem', margin: '0', color: '#333' }}>Status</h2>
        </div>

        <IonCard style={{ margin: '0 16px 16px 16px', borderRadius: '12px', background: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', border: '1px solid #e0e0e0' }}>
          <IonCardContent style={{ padding: '16px' }}>
            <IonList style={{ background: 'transparent' }} lines="none">
              <IonItem style={{ '--background': '#f8f9fa', '--border-radius': '10px' }}>
                <IonLabel>
                  <h3 style={{ fontWeight: '500', margin: '0 0 4px 0' }}>Organisation aktiv</h3>
                  <p style={{ color: '#666', margin: 0, fontSize: '0.85rem' }}>Benutzer koennen sich anmelden</p>
                </IonLabel>
                <IonToggle slot="end" checked={formData.is_active} onIonChange={(e) => setFormData({ ...formData, is_active: e.detail.checked })} disabled={saving} />
              </IonItem>
              {!formData.is_active && (
                <IonItem lines="none" style={{ '--background': 'rgba(239, 68, 68, 0.08)', '--border-radius': '10px', marginTop: '8px' }}>
                  <IonIcon icon={alertCircleOutline} slot="start" style={{ color: '#ef4444' }} />
                  <IonLabel><p style={{ color: '#ef4444', margin: 0, fontWeight: '500' }}>Inaktive Organisationen sind gesperrt</p></IonLabel>
                </IonItem>
              )}
            </IonList>
          </IonCardContent>
        </IonCard>

        {/* SEKTION: Administrator erstellen (nur bei neuer Organisation) */}
        {!isEditMode && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 16px 12px 16px' }}>
              <div style={{
                width: '32px', height: '32px', backgroundColor: '#2dd36f', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(45, 211, 111, 0.3)'
              }}>
                <IonIcon icon={personOutline} style={{ fontSize: '1rem', color: 'white' }} />
              </div>
              <h2 style={{ fontWeight: '600', fontSize: '1.1rem', margin: '0', color: '#333' }}>
                Organisations-Administrator
              </h2>
            </div>

            <IonCard style={{ margin: '0 16px 16px 16px', borderRadius: '12px', background: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', border: '1px solid #e0e0e0' }}>
              <IonCardContent style={{ padding: '16px' }}>
                <IonList style={{ background: 'transparent' }} lines="none">
                  <IonItem style={{ '--background': '#f8f9fa', '--border-radius': '10px', marginBottom: '8px' }}>
                    <IonLabel position="stacked">Name des Administrators *</IonLabel>
                    <IonInput value={formData.admin_name} onIonInput={(e) => setFormData({ ...formData, admin_name: e.detail.value! })} placeholder="z.B. Pastor Mueller" disabled={saving} />
                  </IonItem>
                  <IonItem style={{ '--background': '#f8f9fa', '--border-radius': '10px', marginBottom: '8px' }}>
                    <IonLabel position="stacked">Login-Benutzername *</IonLabel>
                    <IonInput value={formData.admin_username} onIonInput={(e) => setFormData({ ...formData, admin_username: e.detail.value! })} placeholder="z.B. pmueller" disabled={saving} />
                  </IonItem>
                  <IonItem style={{ '--background': '#f8f9fa', '--border-radius': '10px' }}>
                    <IonLabel position="stacked">Passwort *</IonLabel>
                    <IonInput type="password" value={formData.admin_password} onIonInput={(e) => setFormData({ ...formData, admin_password: e.detail.value! })} placeholder="Mindestens 6 Zeichen" disabled={saving} />
                  </IonItem>
                </IonList>

                <IonItem lines="none" style={{ '--background': 'rgba(45, 211, 111, 0.08)', '--border-radius': '10px', marginTop: '12px' }}>
                  <IonIcon icon={shieldOutline} slot="start" style={{ color: '#2dd36f' }} />
                  <IonLabel>
                    <p style={{ color: '#2dd36f', margin: 0, fontWeight: '500', fontSize: '0.85rem' }}>
                      Der Administrator kann die gesamte Organisation verwalten
                    </p>
                  </IonLabel>
                </IonItem>
              </IonCardContent>
            </IonCard>
          </>
        )}

        {/* SEKTION: Organisations-Administrator verwalten (nur im Edit-Modus) */}
        {isEditMode && orgAdmin && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 16px 12px 16px' }}>
              <div style={{
                width: '32px', height: '32px', backgroundColor: '#2dd36f', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(45, 211, 111, 0.3)'
              }}>
                <IonIcon icon={personOutline} style={{ fontSize: '1rem', color: 'white' }} />
              </div>
              <h2 style={{ fontWeight: '600', fontSize: '1.1rem', margin: '0', color: '#333' }}>
                Organisations-Administrator
              </h2>
            </div>

            <IonCard style={{ margin: '0 16px 16px 16px', borderRadius: '12px', background: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', border: '1px solid #e0e0e0' }}>
              <IonCardContent style={{ padding: '16px' }}>
                <IonList style={{ background: 'transparent' }} lines="none">
                  <IonItem style={{ '--background': '#f8f9fa', '--border-radius': '10px', marginBottom: '8px' }}>
                    {/* Initialen-Icon */}
                    <div slot="start" style={{
                      width: '40px', height: '40px', borderRadius: '50%',
                      backgroundColor: '#2dd36f', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontWeight: '700', fontSize: '0.9rem',
                      boxShadow: '0 2px 8px rgba(45, 211, 111, 0.3)'
                    }}>
                      {getInitials(orgAdmin.display_name)}
                    </div>
                    <IonLabel>
                      <h3 style={{ fontWeight: '600', margin: '0 0 4px 0' }}>{orgAdmin.display_name}</h3>
                      <p style={{ color: '#666', margin: 0, fontSize: '0.85rem' }}>
                        Login: {orgAdmin.username}
                        {orgAdmin.email && ` · ${orgAdmin.email}`}
                      </p>
                    </IonLabel>
                  </IonItem>
                </IonList>

                {/* Passwort zuruecksetzen */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px', marginBottom: '8px' }}>
                  <IonIcon icon={keyOutline} style={{ color: '#2dd36f', fontSize: '1rem' }} />
                  <span style={{ fontWeight: '500', fontSize: '0.9rem', color: '#333' }}>Passwort zuruecksetzen</span>
                </div>

                <IonList style={{ background: 'transparent' }} lines="none">
                  <IonItem style={{ '--background': '#f8f9fa', '--border-radius': '10px', marginBottom: '8px' }}>
                    <IonInput type="password" value={newPassword} onIonInput={(e) => setNewPassword(e.detail.value!)} placeholder="Neues Passwort eingeben" disabled={resettingPassword} />
                  </IonItem>
                </IonList>

                <IonButton expand="block" onClick={handleResetPassword} disabled={!newPassword.trim() || resettingPassword} style={{ '--background': '#2dd36f', '--background-activated': '#16a34a', marginTop: '8px' }}>
                  {resettingPassword ? <IonSpinner name="crescent" /> : 'Passwort zuruecksetzen'}
                </IonButton>
              </IonCardContent>
            </IonCard>
          </>
        )}

        {/* SEKTION: Statistiken (nur im Edit-Modus) */}
        {isEditMode && organization && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 16px 12px 16px' }}>
              <div style={{
                width: '32px', height: '32px', backgroundColor: '#2dd36f', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(45, 211, 111, 0.3)'
              }}>
                <IonIcon icon={businessOutline} style={{ fontSize: '1rem', color: 'white' }} />
              </div>
              <h2 style={{ fontWeight: '600', fontSize: '1.1rem', margin: '0', color: '#333' }}>Statistiken</h2>
            </div>

            <IonCard style={{ margin: '0 16px 24px 16px', borderRadius: '12px', background: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', border: '1px solid #e0e0e0' }}>
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
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default OrganizationManagementModal;
