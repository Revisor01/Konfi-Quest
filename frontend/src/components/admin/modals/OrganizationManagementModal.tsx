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
  IonSelect,
  IonSelectOption,
  IonDatetime,
  IonDatetimeButton,
  IonModal,
  useIonAlert,
  useIonModal
} from '@ionic/react';
import {
  closeOutline,
  checkmarkOutline,
  createOutline,
  documentTextOutline,
  globeOutline,
  businessOutline,
  mailOutline,
  personOutline,
  shieldOutline,
  alertCircleOutline,
  people,
  flash,
  callOutline,
  locationOutline,
  add,
  timeOutline,
  cloudOfflineOutline
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useActionGuard } from '../../../hooks/useActionGuard';
import api from '../../../services/api';
import AdminPasswordResetModal from './AdminPasswordResetModal';

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
  kirchenkreis?: string;
  trial_ends_at?: string | null;
  is_trial?: boolean;
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

// Tarif-Stufen wie auf der Website (landing.html / marketing-copy.md).
// value als String fuer direkten Vergleich mit dem maxKonfis-Feld; '' = unbegrenzt.
const KONFI_TARIFE: { label: string; value: string }[] = [
  { label: 'Klein', value: '15' },
  { label: 'Standard', value: '50' },
  { label: 'Plus', value: '75' },
  { label: 'Groß', value: '100' },
  { label: 'Unbegrenzt', value: '' }
];

// Zeitraum-Schnellauswahl: Tage ab heute (0 = unbegrenzt, -1 = eigenes Datum)
const ZEITRAUM_OPTIONEN: { label: string; days: number }[] = [
  { label: '30 Tage (Testphase)', days: 30 },
  { label: '1 Jahr (365 Tage)', days: 365 },
  { label: 'Unbegrenzt', days: 0 },
  { label: 'Eigenes Datum…', days: -1 }
];

const OrganizationManagementModal: React.FC<OrganizationManagementModalProps> = ({
  organizationId,
  onClose,
  onSuccess
}) => {
  const { setSuccess, setError, isOnline, user } = useApp();
  // Super-Admin ist das Flag is_super_admin (org_admins koennen es zusaetzlich haben),
  // NICHT role_name==='super_admin' — sonst sieht ein org_admin mit Flag die Limit-Sektion nie.
  const isSuperAdmin = user?.is_super_admin === true || user?.role_name === 'super_admin';
  const { isSubmitting, guard } = useActionGuard();
  const [loading, setLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [presentAlert] = useIonAlert();
  const initializedRef = useRef(false);
  // Ref auf die IonPage dieses Modals — dient dem verschachtelten Passwort-Modal
  // als presentingElement, damit iOS den korrekten Card-Backdrop rendert.
  const pageRef = useRef<HTMLElement | null>(null);

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
    kirchenkreis: '',
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
  // Wird zusammen mit dem Modal gespeichert (kein separater Button).
  const [maxKonfis, setMaxKonfis] = useState<string>('');
  // "Eigenes Limit"-Modus: Zahlenfeld statt Tarif-Auswahl
  const [isCustomLimit, setIsCustomLimit] = useState(false);
  // Zeitraum-Enddatum (ISO-String) oder '' = unbegrenzt (nur super_admin)
  const [trialEndsAt, setTrialEndsAt] = useState<string>('');
  // is_trial: true = Testphase (Dashboard-Hinweis), false = Lizenz/unbegrenzt (kein Hinweis)
  const [isTrial, setIsTrial] = useState<boolean>(false);
  // "Eigenes Datum"-Modus fuer den Zeitraum (Datepicker statt Schnellauswahl)
  const [isCustomTrialDate, setIsCustomTrialDate] = useState<boolean>(false);

  const handleTrialChange = (value: string) => {
    setTrialEndsAt(value);
    if (initializedRef.current) setIsDirty(true);
  };

  const handleIsTrialChange = (value: boolean) => {
    setIsTrial(value);
    if (initializedRef.current) setIsDirty(true);
  };
  const [orgAdmins, setOrgAdmins] = useState<OrgAdmin[]>([]);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [newAdminData, setNewAdminData] = useState({ display_name: '', username: '', password: '' });
  const [addingAdmin, setAddingAdmin] = useState(false);
  // Welcher Admin wird im Passwort-Modal bearbeitet
  const [passwordAdmin, setPasswordAdmin] = useState<OrgAdmin | null>(null);

  const isEditMode = !!organizationId;

  // View/Edit-Modus: bestehende Org startet als read-only Uebersicht ('view'),
  // neue Org direkt im Formular ('edit'). Bearbeiten-Button oben wechselt um.
  const [viewMode, setViewMode] = useState<'view' | 'edit'>(organizationId ? 'view' : 'edit');

  // Neue Org: Default 30-Tage-Testphase vorbelegen (super_admin kann es aendern)
  useEffect(() => {
    if (!organizationId) {
      setTrialEndsAt(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());
      setIsTrial(true);
      setIsCustomTrialDate(false);
    }
  }, [organizationId]);

  // maxKonfis-Aenderung markiert das Modal als dirty (aktiviert Speichern-Button)
  const handleMaxKonfisChange = (value: string) => {
    setMaxKonfis(value);
    if (initializedRef.current) setIsDirty(true);
  };

  // Passwort-Aendern-Modal (useIonModal, Konventions-Muster)
  const [presentPasswordModal, dismissPasswordModal] = useIonModal(AdminPasswordResetModal, {
    adminId: passwordAdmin?.id ?? 0,
    adminName: passwordAdmin?.display_name ?? '',
    onClose: () => dismissPasswordModal(),
    onSuccess: () => dismissPasswordModal()
  });

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
      const loadedLimit = orgData.max_konfis !== null && orgData.max_konfis !== undefined ? String(orgData.max_konfis) : '';
      setMaxKonfis(loadedLimit);
      // Wenn der geladene Wert keinem Tarif entspricht (und nicht leer/unbegrenzt ist), ist es ein eigenes Limit
      setIsCustomLimit(loadedLimit !== '' && !KONFI_TARIFE.some(t => t.value === loadedLimit));
      setTrialEndsAt(orgData.trial_ends_at || '');
      setIsTrial(orgData.is_trial === true);
      // Wenn ein Datum gesetzt ist, das keiner Schnellauswahl entspricht -> "eigenes Datum"
      setIsCustomTrialDate(!!orgData.trial_ends_at);
      setFormData({
        display_name: orgData.display_name || '',
        description: orgData.description || '',
        contact_email: orgData.contact_email || '',
        contact_phone: orgData.contact_phone || '',
        address: orgData.address || '',
        website_url: orgData.website_url || '',
        kirchenkreis: orgData.kirchenkreis || '',
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

        // Konfi-Limit (Tarif) — nur super_admin setzt es. NULL = unbegrenzt.
        let limitValue: number | null = null;
        if (isSuperAdmin) {
          const trimmed = maxKonfis.trim();
          if (trimmed !== '') {
            const parsed = parseInt(trimmed, 10);
            if (isNaN(parsed) || parsed < 0) {
              setError('Das Konfi-Limit muss eine Zahl ab 0 oder leer sein');
              return;
            }
            limitValue = parsed;
          }
        }

        const orgData: any = {
          name: systemName,
          slug: systemName,
          display_name: formData.display_name.trim(),
          description: formData.description.trim() || null,
          contact_email: formData.contact_email.trim() || null,
          contact_phone: formData.contact_phone.trim() || null,
          address: formData.address.trim() || null,
          website_url: formData.website_url.trim() || null,
          kirchenkreis: formData.kirchenkreis.trim() || null,
          is_active: formData.is_active
        };

        // Zeitraum + Trial-Kennzeichnung nur super_admin.
        // Kein Datum -> unbegrenzt, dann ist es auch keine Testphase (is_trial=false).
        if (isSuperAdmin) {
          const endDate = trialEndsAt.trim() || null;
          orgData.trial_ends_at = endDate;
          orgData.is_trial = endDate ? isTrial : false;
        }

        if (!isEditMode) {
          orgData.admin_username = formData.admin_username.trim();
          orgData.admin_password = formData.admin_password.trim();
          orgData.admin_display_name = formData.admin_name.trim();
          // Limit direkt bei der Erstellung mitgeben (super_admin)
          if (isSuperAdmin) orgData.max_konfis = limitValue;
        }

        if (isEditMode) {
          await api.put(`/organizations/${organizationId}`, orgData);

          // Konfi-Limit wird zusammen mit dem Modal gespeichert (eigener Endpunkt).
          if (isSuperAdmin) {
            await api.patch(`/organizations/${organizationId}/limit`, { max_konfis: limitValue });
          }

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

  // Passwort aendern als eigenes Modal (useIonModal — Konventions-Muster mit
  // Anforderungs-Anzeige, Augen-Toggle und Vorschlag-Funktion).
  const openPasswordModal = (admin: OrgAdmin) => {
    if (!isOnline) {
      setError('Diese Aktion ist offline nicht möglich');
      return;
    }
    setPasswordAdmin(admin);
    // pageRef = IonPage dieses Modals -> iOS rendert den korrekten Card-Backdrop
    presentPasswordModal({ presentingElement: pageRef.current ?? undefined });
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
    <IonPage ref={pageRef}>
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
                    <div style={{ fontSize: '0.85rem', color: organization.is_active ? '#667eea' : '#6b7280', fontWeight: 600 }}>
                      {organization.is_active ? 'Aktiv' : 'Inaktiv'}
                    </div>
                  </div>
                </div>
                {organization.description && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', margin: '0 0 12px', color: '#555', fontSize: '0.9rem' }}>
                    <IonIcon icon={documentTextOutline} style={{ color: '#667eea', marginTop: '2px', flexShrink: 0 }} />
                    <span>{organization.description}</span>
                  </div>
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
                  {organization.kirchenkreis && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <IonIcon icon={businessOutline} style={{ color: '#667eea' }} />
                      <span>{organization.kirchenkreis}</span>
                    </div>
                  )}
                  {isSuperAdmin && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <IonIcon icon={timeOutline} style={{ color: '#667eea' }} />
                      {organization.trial_ends_at
                        ? (() => {
                            const end = new Date(organization.trial_ends_at);
                            const days = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                            const label = organization.is_trial ? 'Testphase' : 'Zugang';
                            return days >= 0
                              ? <span>{label} bis {end.toLocaleDateString('de-DE')} ({days} Tag{days === 1 ? '' : 'e'} übrig)</span>
                              : <span style={{ color: '#dc2626' }}>{label} abgelaufen ({end.toLocaleDateString('de-DE')})</span>;
                          })()
                        : <span>Unbegrenzt</span>}
                    </div>
                  )}
                  {organization.contact_email && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <IonIcon icon={mailOutline} style={{ color: '#667eea' }} />
                      <span>{organization.contact_email}</span>
                    </div>
                  )}
                  {organization.contact_phone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <IonIcon icon={callOutline} style={{ color: '#667eea' }} />
                      <span>{organization.contact_phone}</span>
                    </div>
                  )}
                  {organization.address && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <IonIcon icon={locationOutline} style={{ color: '#667eea', marginTop: '2px', flexShrink: 0 }} />
                      <span>{organization.address}</span>
                    </div>
                  )}
                  {organization.website_url && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <IonIcon icon={globeOutline} style={{ color: '#667eea' }} />
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

                <IonItem lines="full" style={{ '--background': 'transparent' }}>
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

                <IonItem lines="none" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">Kirchenkreis (optional)</IonLabel>
                  <IonInput
                    value={formData.kirchenkreis}
                    onIonInput={(e) => setFormData({ ...formData, kirchenkreis: e.detail.value! })}
                    placeholder="z.B. Kirchenkreis Dithmarschen"
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
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent style={{ padding: '16px' }}>
                {/* Bestehende Admins */}
                {orgAdmins.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {orgAdmins.map((admin) => (
                      <div key={admin.id} style={{ marginBottom: '8px' }}>
                        <IonItem
                          button
                          detail={false}
                          lines="none"
                          onClick={() => openPasswordModal(admin)}
                          style={{
                            '--background': 'transparent',
                            '--padding-start': '0',
                            '--padding-end': '0',
                            '--inner-padding-end': '0',
                            '--inner-border-width': '0',
                            '--border-style': 'none',
                            '--min-height': 'auto'
                          }}
                        >
                          <div
                            className="app-list-item app-list-item--teamer"
                            style={{ width: '100%', position: 'relative', overflow: 'hidden' }}
                          >
                            <div className="app-list-item__row">
                              <div className="app-list-item__main">
                                <div
                                  className="app-icon-circle app-icon-circle--lg app-icon-circle--teamer"
                                  style={{ color: 'white', fontWeight: '600' }}
                                >
                                  {getInitials(admin.display_name)}
                                </div>
                                <div className="app-list-item__content">
                                  <div className="app-list-item__title">{admin.display_name}</div>
                                  <div className="app-list-item__meta">
                                    <span className="app-list-item__meta-item">
                                      <IonIcon icon={personOutline} style={{ color: 'var(--app-color-teamer)' }} />
                                      {admin.username}
                                    </span>
                                    {admin.email && (
                                      <span className="app-list-item__meta-item">
                                        <IonIcon icon={mailOutline} style={{ color: 'var(--app-color-teamer)' }} />
                                        {admin.email}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </IonItem>
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

                {/* Hinzufügen-Button — gleiches Muster wie EventModal (expand block, outline) */}
                {!showAddAdmin && (
                  <div style={{ marginTop: '16px' }}>
                    <IonButton
                      expand="block"
                      fill="outline"
                      onClick={() => setShowAddAdmin(true)}
                    >
                      <IonIcon icon={add} slot="start" />
                      Administrator hinzufügen
                    </IonButton>
                  </div>
                )}
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* SEKTION: Konfi-Limit (nur super_admin, im Erstellen- und Bearbeiten-Modus) */}
        {isSuperAdmin && viewMode === 'edit' && (
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
                  {/* Tarif-Auswahl als Popover (Website-Stufen + Eigenes Limit) */}
                  <IonItem lines="full" style={{ '--background': 'transparent' }}>
                    <IonLabel position="stacked">Tarif</IonLabel>
                    <IonSelect
                      value={isCustomLimit ? '__custom__' : maxKonfis.trim()}
                      interface="popover"
                      placeholder="Tarif wählen"
                      onIonChange={(e) => {
                        const val = e.detail.value;
                        if (val === '__custom__') {
                          // Auf Eigenes Limit umschalten: Feld leeren falls es vorher ein Tarif war
                          setIsCustomLimit(true);
                        } else {
                          setIsCustomLimit(false);
                          handleMaxKonfisChange(val);
                        }
                      }}
                    >
                      {KONFI_TARIFE.map((tarif) => (
                        <IonSelectOption key={tarif.label} value={tarif.value}>
                          {tarif.label}{tarif.value ? ` — bis ${tarif.value} Konfis` : ' — unbegrenzt'}
                        </IonSelectOption>
                      ))}
                      <IonSelectOption value="__custom__">Eigenes Limit…</IonSelectOption>
                    </IonSelect>
                  </IonItem>

                  {/* Eigenes Limit-Feld nur wenn "Eigenes Limit" gewaehlt ist */}
                  {isCustomLimit && (
                    <IonItem lines="none" style={{ '--background': 'transparent' }}>
                      <IonLabel position="stacked">Eigenes Limit (leer = unbegrenzt)</IonLabel>
                      <IonInput
                        type="number"
                        inputmode="numeric"
                        min="0"
                        value={maxKonfis}
                        onIonInput={(e) => handleMaxKonfisChange(e.detail.value ?? '')}
                        placeholder="z.B. 30 — leer lassen für unbegrenzt"
                        disabled={!isOnline}
                      />
                    </IonItem>
                  )}
                </IonList>

                <IonItem lines="none" style={{ '--background': 'rgba(102, 126, 234, 0.08)', borderRadius: '10px', marginTop: '8px' }}>
                  <IonIcon icon={alertCircleOutline} slot="start" style={{ color: '#667eea' }} />
                  <IonLabel>
                    <p style={{ color: '#667eea', margin: 0, fontSize: '0.85rem' }}>
                      Bis zu 5 Konfis über dem Limit sind nach Bestätigung möglich. Danach ist ein Tarif-Upgrade nötig. Wird beim Speichern oben übernommen.
                    </p>
                  </IonLabel>
                </IonItem>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* SEKTION: Zeitraum (nur super_admin, im Erstellen- und Bearbeiten-Modus) */}
        {isSuperAdmin && viewMode === 'edit' && (
          <IonList inset={true} className="app-modal-section">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--organizations">
                <IonIcon icon={timeOutline} />
              </div>
              <IonLabel>Zeitraum</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent style={{ padding: '16px' }}>
                {/* aktueller Status */}
                <div style={{ marginBottom: '12px', fontSize: '0.9rem', color: '#444' }}>
                  {trialEndsAt
                    ? (() => {
                        const end = new Date(trialEndsAt);
                        const days = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                        const label = isTrial ? 'Testphase' : 'Zugang';
                        return days >= 0
                          ? <span>{label} läuft bis <strong>{end.toLocaleDateString('de-DE')}</strong> ({days} Tag{days === 1 ? '' : 'e'} übrig)</span>
                          : <span style={{ color: '#dc2626' }}>{label} ist seit <strong>{end.toLocaleDateString('de-DE')}</strong> abgelaufen ({Math.abs(days)} Tag{Math.abs(days) === 1 ? '' : 'e'})</span>;
                      })()
                    : <span><strong>Unbegrenzt</strong> — kein Ablaufdatum</span>}
                </div>

                <IonList style={{ background: 'transparent' }}>
                  {/* Zeitraum-Auswahl als Popover */}
                  <IonItem lines={isCustomTrialDate ? 'full' : 'full'} style={{ '--background': 'transparent' }}>
                    <IonLabel position="stacked">Zeitraum</IonLabel>
                    <IonSelect
                      value={isCustomTrialDate ? -1 : (trialEndsAt ? -2 : 0)}
                      interface="popover"
                      placeholder="Zeitraum wählen"
                      onIonChange={(e) => {
                        const days = e.detail.value as number;
                        if (days === -1) {
                          // Eigenes Datum: Datepicker einblenden, Default heute+30 falls leer
                          setIsCustomTrialDate(true);
                          if (!trialEndsAt) handleTrialChange(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());
                        } else if (days === -2) {
                          // no-op (Platzhalter fuer bereits gesetztes eigenes Datum)
                        } else if (days === 0) {
                          setIsCustomTrialDate(false);
                          handleTrialChange('');
                        } else {
                          setIsCustomTrialDate(false);
                          handleTrialChange(new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString());
                        }
                      }}
                    >
                      {ZEITRAUM_OPTIONEN.map((opt) => (
                        <IonSelectOption key={opt.label} value={opt.days}>{opt.label}</IonSelectOption>
                      ))}
                      {/* unsichtbarer Wert fuer "Datum gesetzt, aber keine Schnellauswahl aktiv" */}
                      {trialEndsAt && !isCustomTrialDate && <IonSelectOption value={-2}>Festes Datum</IonSelectOption>}
                    </IonSelect>
                  </IonItem>

                  {/* Eigenes Datum: Datepicker */}
                  {isCustomTrialDate && (
                    <IonItem lines="full" style={{ '--background': 'transparent' }}>
                      <IonLabel position="stacked">Enddatum</IonLabel>
                      <IonDatetimeButton datetime="trial-date-picker" />
                      <IonModal keepContentsMounted={true}>
                        <IonDatetime
                          id="trial-date-picker"
                          presentation="date"
                          value={trialEndsAt || undefined}
                          onIonChange={(e) => {
                            const v = e.detail.value as string;
                            if (v) handleTrialChange(new Date(v).toISOString());
                          }}
                        />
                      </IonModal>
                    </IonItem>
                  )}

                  {/* Trial-Haekchen: nur sinnvoll wenn ein Datum gesetzt ist */}
                  {trialEndsAt && (
                    <IonItem lines="none" style={{ '--background': 'transparent' }}>
                      <IonLabel>
                        <h3 style={{ fontWeight: '500', margin: '0 0 4px 0' }}>Als Testphase kennzeichnen</h3>
                        <p style={{ color: '#666', margin: 0, fontSize: '0.85rem' }}>Zeigt im Dashboard einen Hinweis mit Restlaufzeit</p>
                      </IonLabel>
                      <IonToggle slot="end" className="app-toggle--users" checked={isTrial} onIonChange={(e) => handleIsTrialChange(e.detail.checked)} />
                    </IonItem>
                  )}
                </IonList>

                <IonItem lines="none" style={{ '--background': 'rgba(102, 126, 234, 0.08)', borderRadius: '10px', marginTop: '12px' }}>
                  <IonIcon icon={alertCircleOutline} slot="start" style={{ color: '#667eea' }} />
                  <IonLabel>
                    <p style={{ color: '#667eea', margin: 0, fontSize: '0.85rem' }}>
                      Nach Ablauf des Zeitraums wird die Organisation automatisch gesperrt — niemand kann sich mehr anmelden. Ohne Datum bleibt der Zugang unbegrenzt. Wird beim Speichern oben übernommen.
                    </p>
                  </IonLabel>
                </IonItem>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* SEKTION: Statistiken — nur im View-Modus (im Bearbeiten ausgeblendet) */}
        {isEditMode && organization && viewMode === 'view' && (
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
