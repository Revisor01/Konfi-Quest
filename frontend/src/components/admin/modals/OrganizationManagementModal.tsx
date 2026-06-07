import React, { useState, useEffect, useRef } from 'react';
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
  IonTextarea,
  useIonAlert
} from '@ionic/react';
import {
  closeOutline,
  checkmarkOutline,
  createOutline,
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
  addOutline,
  cloudOfflineOutline
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useActionGuard } from '../../../hooks/useActionGuard';
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
  max_konfis?: number | null;
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
  const { setSuccess, setError, isOnline, user } = useApp();
  const isSuperAdmin = user?.role_name === 'super_admin';
  const { isSubmitting, guard } = useActionGuard();
  const [loading, setLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [presentAlert] = useIonAlert();
  const initializedRef = useRef(false);

  const doClose = () => onClose();

  const handleClose = () => {
    if (isDirty) {
      presentAlert({
        header: 'Ungespeicherte Änderungen',
        message: 'Möchtest du die Änderungen verwerfen?',
        buttons: [
          { text: 'Abbrechen', role: 'cancel' },
          { text: 'Verwerfen', role: 'destructive', handler: () => doClose() }
        ]
      });
    } else {
      doClose();
    }
  };

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

  // isDirty nach Initialisierung bei jeder formData-Änderung setzen
  useEffect(() => {
    if (initializedRef.current) {
      setIsDirty(true);
    }
  }, [formData]);

  const [organization, setOrganization] = useState<Organization | null>(null);
  // Konfi-Limit (nur für super_admin sichtbar/setzbar). Leeres Feld = unbegrenzt (NULL).
  const [maxKonfis, setMaxKonfis] = useState<string>('');
  const [savingLimit, setSavingLimit] = useState(false);
  const [orgAdmins, setOrgAdmins] = useState<OrgAdmin[]>([]);
  const [newPassword, setNewPassword] = useState('');
  const [selectedAdminId, setSelectedAdminId] = useState<number | null>(null);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [newAdminData, setNewAdminData] = useState({ display_name: '', username: '', password: '' });
  const [addingAdmin, setAddingAdmin] = useState(false);

  const isEditMode = !!organizationId;

  // View/Edit-Modus: bestehende Org startet als read-only Uebersicht ('view'),
  // neue Org direkt im Formular ('edit'). Bearbeiten-Button oben wechselt um.
  const [viewMode, setViewMode] = useState<'view' | 'edit'>(organizationId ? 'view' : 'edit');
  // Welcher Admin ist fuer Passwort-Reset aufgeklappt (per Klick, nicht dauerhaft).
  const [passwordAdminId, setPasswordAdminId] = useState<number | null>(null);

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
      loadOrganization().then(() => {
        setTimeout(() => { initializedRef.current = true; }, 100);
      });
    } else {
      setTimeout(() => { initializedRef.current = true; }, 100);
    }
  }, [organizationId]);

  const loadOrganization = async () => {
    if (!organizationId) return;

    setLoading(true);
    try {
      const response = await api.get(`/organizations/${organizationId}`);
      const orgData = response.data;

      setOrganization(orgData);
      setMaxKonfis(orgData.max_konfis !== null && orgData.max_konfis !== undefined ? String(orgData.max_konfis) : '');
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
 console.warn('Org-Admins konnten nicht geladen werden:', err);
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

    await guard(async () => {
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

        setIsDirty(false);
        onSuccess();
      } catch (err: any) {
        setError(err.response?.data?.error || 'Fehler beim Speichern');
      }
    });
  };

  const handleSaveLimit = async () => {
    if (!organizationId) return;

    const trimmed = maxKonfis.trim();
    let value: number | null;
    if (trimmed === '') {
      value = null; // unbegrenzt
    } else {
      const parsed = parseInt(trimmed, 10);
      if (isNaN(parsed) || parsed < 0) {
        setError('Das Konfi-Limit muss eine Zahl ab 0 oder leer sein');
        return;
      }
      value = parsed;
    }

    setSavingLimit(true);
    try {
      await api.patch(`/organizations/${organizationId}/limit`, { max_konfis: value });
      setSuccess(value === null ? 'Konfi-Limit aufgehoben (unbegrenzt)' : `Konfi-Limit auf ${value} gesetzt`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Speichern des Konfi-Limits');
    } finally {
      setSavingLimit(false);
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
              <IonButton onClick={handleClose} className="app-modal-close-btn"><IonIcon icon={closeOutline} /></IonButton>
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
          <IonTitle>{!isEditMode ? 'Neue Organisation' : viewMode === 'view' ? 'Organisation' : 'Organisation bearbeiten'}</IonTitle>
          <IonButtons slot="start">
            <IonButton onClick={onClose} disabled={isSubmitting} className="app-modal-close-btn"><IonIcon icon={closeOutline} /></IonButton>
          </IonButtons>
          <IonButtons slot="end">
            {isEditMode && viewMode === 'view' ? (
              <IonButton onClick={() => setViewMode('edit')} className="app-modal-submit-btn app-modal-submit-btn--settings">
                <IonIcon icon={createOutline} />
              </IonButton>
            ) : (
              <IonButton onClick={handleSave} disabled={!isValid || isSubmitting || !isOnline} className="app-modal-submit-btn app-modal-submit-btn--settings">
                {!isOnline ? <><IonIcon icon={cloudOfflineOutline} /> Du bist offline</> : isSubmitting ? <IonSpinner name="crescent" /> : <IonIcon icon={checkmarkOutline} />}
              </IonButton>
            )}
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        {/* VIEW-MODUS: alle Infos der Organisation auf einen Blick (read-only) */}
        {isEditMode && viewMode === 'view' && organization && (
          <IonList inset={true} className="app-modal-section">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--organizations">
                <IonIcon icon={businessOutline} />
              </div>
              <IonLabel>Überblick</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent style={{ padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div className="app-avatar-initials app-avatar-initials--sm" style={{ backgroundColor: organization.is_active ? '#667eea' : '#6b7280' }}>
                    {getInitials(organization.display_name)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{organization.display_name}</div>
                    <div style={{ fontSize: '0.85rem', color: organization.is_active ? '#16a34a' : '#6b7280', fontWeight: 600 }}>
                      {organization.is_active ? 'Aktiv' : 'Inaktiv'}
                    </div>
                  </div>
                </div>
                {organization.description && (
                  <p style={{ margin: '0 0 12px', color: '#555', fontSize: '0.9rem' }}>{organization.description}</p>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.88rem', color: '#444' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <IonIcon icon={people} style={{ color: '#667eea' }} />
                    <span>
                      {maxKonfis
                        ? `${organization.konfi_count} / ${maxKonfis} Konfis`
                        : `${organization.konfi_count} Konfis (unbegrenzt)`}
                    </span>
                  </div>
                  {organization.contact_email && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <IonIcon icon={mailOutline} style={{ color: '#667eea' }} />
                      <span>{organization.contact_email}</span>
                    </div>
                  )}
                  {organization.website_url && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <IonIcon icon={businessOutline} style={{ color: '#667eea' }} />
                      <span>{organization.website_url}</span>
                    </div>
                  )}
                </div>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* SEKTION: Organisations-Daten (nur Edit-Modus) */}
        {viewMode === 'edit' && (
        <IonList inset={true} className="app-modal-section">
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
                    disabled={isSubmitting}
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
                    disabled={isSubmitting}
                  />
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>
        </IonList>
        )}

        {/* SEKTION: Kontakt (nur Edit-Modus) */}
        {viewMode === 'edit' && (
        <IonList inset={true} className="app-modal-section">
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
                  <IonInput type="email" value={formData.contact_email} onIonInput={(e) => setFormData({ ...formData, contact_email: e.detail.value! })} placeholder="kontakt@beispiel.de" disabled={isSubmitting} />
                </IonItem>
                <IonItem lines="full" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">Telefon</IonLabel>
                  <IonInput type="tel" value={formData.contact_phone} onIonInput={(e) => setFormData({ ...formData, contact_phone: e.detail.value! })} placeholder="04834 12345" disabled={isSubmitting} />
                </IonItem>
                <IonItem lines="full" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">Adresse</IonLabel>
                  <IonTextarea
                    value={formData.address}
                    onIonInput={(e) => setFormData({ ...formData, address: e.detail.value! })}
                    placeholder="Kirchstraße 1, 25764 Wesselburen"
                    autoGrow={true}
                    rows={2}
                    disabled={isSubmitting}
                  />
                </IonItem>
                <IonItem lines="none" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">Website</IonLabel>
                  <IonInput type="url" value={formData.website_url} onIonInput={(e) => setFormData({ ...formData, website_url: e.detail.value! })} placeholder="https://www.beispiel.de" disabled={isSubmitting} />
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>
        </IonList>
        )}

        {/* SEKTION: Status (Aktiv/Inaktiv-Toggle, nur Edit-Modus) */}
        {viewMode === 'edit' && (
        <IonList inset={true} className="app-modal-section">
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
                  <IonToggle slot="end" className="app-toggle--users" checked={formData.is_active} onIonChange={(e) => setFormData({ ...formData, is_active: e.detail.checked })} disabled={isSubmitting} />
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
        )}

        {/* SEKTION: Administrator erstellen (nur bei neuer Organisation) */}
        {!isEditMode && (
          <IonList inset={true} className="app-modal-section">
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
                    <IonInput value={formData.admin_name} onIonInput={(e) => setFormData({ ...formData, admin_name: e.detail.value! })} placeholder="z.B. Pastor Müller" disabled={isSubmitting} />
                  </IonItem>
                  <IonItem lines="full" style={{ '--background': 'transparent' }}>
                    <IonLabel position="stacked">Login-Benutzername *</IonLabel>
                    <IonInput value={formData.admin_username} onIonInput={(e) => setFormData({ ...formData, admin_username: e.detail.value! })} placeholder="z.B. pmueller" disabled={isSubmitting} />
                  </IonItem>
                  <IonItem lines="none" style={{ '--background': 'transparent' }}>
                    <IonLabel position="stacked">Passwort *</IonLabel>
                    <IonInput type="password" value={formData.admin_password} onIonInput={(e) => setFormData({ ...formData, admin_password: e.detail.value! })} placeholder="Mindestens 6 Zeichen" disabled={isSubmitting} />
                  </IonItem>
                </IonList>

                <IonItem lines="none" style={{ '--background': 'rgba(102, 126, 234, 0.08)', borderRadius: '10px', marginTop: '12px' }}>
                  <IonIcon icon={shieldOutline} slot="start" style={{ color: '#667eea' }} />
                  <IonLabel>
                    <p style={{ color: '#667eea', margin: 0, fontWeight: '500', fontSize: '0.85rem' }}>
                      Der Administrator kann die gesamte Organisation verwalten
                    </p>
                  </IonLabel>
                </IonItem>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* SEKTION: Organisations-Administratoren verwalten (nur im Edit-Modus) */}
        {isEditMode && viewMode === 'edit' && (
          <IonList inset={true} className="app-modal-section">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--organizations">
                <IonIcon icon={personOutline} />
              </div>
              <IonLabel>Organisations-Administratoren</IonLabel>
              <IonButton
                size="small"
                fill="clear"
                onClick={() => setShowAddAdmin(!showAddAdmin)}
                style={{ '--color': '#667eea' }}
              >
                <IonIcon icon={addOutline} slot="start" />
                Hinzufügen
              </IonButton>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent style={{ padding: '16px' }}>
                {/* Bestehende Admins */}
                {orgAdmins.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {orgAdmins.map((admin) => (
                      <div key={admin.id} style={{ marginBottom: '16px' }}>
                        <IonItem
                          button
                          detail={false}
                          onClick={() => {
                            // Passwort-Reset-Feld per Klick auf den Admin auf-/zuklappen
                            if (passwordAdminId === admin.id) {
                              setPasswordAdminId(null);
                            } else {
                              setPasswordAdminId(admin.id);
                              setSelectedAdminId(admin.id);
                              setNewPassword('');
                            }
                          }}
                          className="app-list-item app-list-item--organizations"
                          style={{ '--padding-start': '16px', '--padding-top': '10px', '--padding-bottom': '10px', marginBottom: '8px' }}
                        >
                          <IonLabel>
                            <div className="app-list-item__main">
                              <div
                                className="app-avatar-initials app-avatar-initials--sm"
                                style={{ backgroundColor: admin.is_active ? '#667eea' : '#6b7280' }}
                              >
                                {getInitials(admin.display_name)}
                              </div>
                              <div className="app-list-item__content">
                                <div className="app-list-item__title">{admin.display_name}</div>
                              </div>
                            </div>
                            <div className="app-list-item__meta">
                              <span className="app-list-item__meta-item">
                                <IonIcon icon={personOutline} className="app-icon-color--badges" />
                                {admin.username}
                              </span>
                              {admin.email && (
                                <span className="app-list-item__meta-item">
                                  <IonIcon icon={mailOutline} className="app-icon-color--organizations" />
                                  {admin.email}
                                </span>
                              )}
                              <span className="app-list-item__meta-item">
                                <IonIcon icon={keyOutline} className="app-icon-color--events" />
                                Passwort
                              </span>
                            </div>
                          </IonLabel>
                        </IonItem>

                        {/* Passwort zurücksetzen — erst nach Klick auf den Admin sichtbar */}
                        {passwordAdminId === admin.id && (
                        <div style={{ marginLeft: '48px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <IonIcon icon={keyOutline} style={{ color: '#667eea', fontSize: '0.9rem' }} />
                            <span style={{ fontWeight: '500', fontSize: '0.85rem', color: '#666' }}>Neues Passwort setzen</span>
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
                              disabled={selectedAdminId !== admin.id || !newPassword.trim() || resettingPassword || !isOnline}
                              style={{ '--background': '#667eea', '--background-activated': '#5a67d8' }}
                            >
                              {!isOnline ? <><IonIcon icon={cloudOfflineOutline} /> Du bist offline</> : resettingPassword && selectedAdminId === admin.id ? <IonSpinner name="crescent" /> : 'Setzen'}
                            </IonButton>
                          </div>
                        </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '16px', color: '#666' }}>
                    <IonIcon icon={alertCircleOutline} style={{ fontSize: '2rem', color: 'var(--app-color-badges)', marginBottom: '8px', display: 'block' }} />
                    Kein Administrator vorhanden
                  </div>
                )}

                {/* Neuen Admin hinzufügen */}
                {showAddAdmin && (
                  <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(102, 126, 234, 0.05)', borderRadius: '12px', border: '1px dashed #667eea' }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: '600', color: '#333' }}>Neuen Administrator hinzufügen</h4>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
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
                    </div>
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
                        disabled={!newAdminData.display_name.trim() || !newAdminData.username.trim() || !newAdminData.password.trim() || addingAdmin || !isOnline}
                        style={{ flex: 1, '--background': '#667eea', '--background-activated': '#5a67d8' }}
                      >
                        {!isOnline ? <><IonIcon icon={cloudOfflineOutline} /> Du bist offline</> : addingAdmin ? <IonSpinner name="crescent" /> : 'Hinzufügen'}
                      </IonButton>
                    </div>
                  </div>
                )}
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* SEKTION: Konfi-Limit (nur super_admin, nur im Edit-Modus) */}
        {isEditMode && isSuperAdmin && viewMode === 'edit' && (
          <IonList inset={true} className="app-modal-section">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--organizations">
                <IonIcon icon={people} />
              </div>
              <IonLabel>Konfi-Limit (Tarif)</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent style={{ padding: '16px' }}>
                <IonList style={{ background: 'transparent' }}>
                  <IonItem lines="none" style={{ '--background': 'transparent' }}>
                    <IonLabel position="stacked">Maximale Anzahl Konfis (leer = unbegrenzt)</IonLabel>
                    <IonInput
                      type="number"
                      inputmode="numeric"
                      min="0"
                      value={maxKonfis}
                      onIonInput={(e) => setMaxKonfis(e.detail.value ?? '')}
                      placeholder="z.B. 15 — leer lassen für unbegrenzt"
                      disabled={savingLimit || !isOnline}
                    />
                  </IonItem>
                </IonList>

                <IonItem lines="none" style={{ '--background': 'rgba(102, 126, 234, 0.08)', borderRadius: '10px', marginTop: '8px' }}>
                  <IonIcon icon={alertCircleOutline} slot="start" style={{ color: '#667eea' }} />
                  <IonLabel>
                    <p style={{ color: '#667eea', margin: 0, fontSize: '0.85rem' }}>
                      Bis zu 5 Konfis über dem Limit sind nach Bestätigung möglich. Danach ist ein Tarif-Upgrade nötig.
                    </p>
                  </IonLabel>
                </IonItem>

                <IonButton
                  expand="block"
                  onClick={handleSaveLimit}
                  disabled={savingLimit || !isOnline}
                  style={{ marginTop: '12px', '--background': '#667eea', '--background-activated': '#5a67d8' }}
                >
                  {!isOnline ? <><IonIcon icon={cloudOfflineOutline} /> Du bist offline</> : savingLimit ? <IonSpinner name="crescent" /> : 'Konfi-Limit speichern'}
                </IonButton>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* SEKTION: Statistiken (nur im Edit-Modus) */}
        {isEditMode && organization && (
          <IonList inset={true} className="app-modal-section">
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
                    <IonIcon icon={people} style={{ fontSize: '1.2rem', color: '#667eea', display: 'block', margin: '0 auto 4px' }} />
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#667eea' }}>{organization.konfi_count || 0}</div>
                    <div style={{ fontSize: '0.75rem', color: '#666' }}>Konfis</div>
                  </div>
                  <div style={{ background: '#f8f9fa', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                    <IonIcon icon={personOutline} style={{ fontSize: '1.2rem', color: 'var(--app-color-badges)', display: 'block', margin: '0 auto 4px' }} />
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#667eea' }}>{organization.user_count || 0}</div>
                    <div style={{ fontSize: '0.75rem', color: '#666' }}>Team</div>
                  </div>
                  <div style={{ background: '#f8f9fa', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                    <IonIcon icon={flash} style={{ fontSize: '1.2rem', color: 'var(--app-color-events)', display: 'block', margin: '0 auto 4px' }} />
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#667eea' }}>{organization.event_count || 0}</div>
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
