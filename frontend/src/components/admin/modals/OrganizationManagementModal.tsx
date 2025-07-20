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
  IonCardHeader,
  IonCardTitle,
  IonGrid,
  IonRow,
  IonCol,
  IonIcon,
  IonList,
  IonChip,
  IonText,
  IonTextarea
} from '@ionic/react';
import { 
  save, 
  close, 
  business,
  mail,
  globe,
  people,
  analytics,
  checkmark,
  warning
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';

interface Organization {
  id: number;
  name: string;
  display_name: string;
  description?: string;
  contact_email?: string;
  website_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  user_count: number;
  konfi_count: number;
  activity_count: number;
  event_count: number;
  badge_count: number;
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
  
  // Form data
  const [formData, setFormData] = useState({
    name: '',
    display_name: '',
    description: '',
    contact_email: '',
    website_url: '',
    is_active: true,
    admin_username: '',
    admin_password: '',
    admin_display_name: ''
  });

  // Organization data
  const [organization, setOrganization] = useState<Organization | null>(null);

  const isEditMode = !!organizationId;

  useEffect(() => {
    if (isEditMode) {
      loadOrganization();
    }
  }, [organizationId]);

  const loadOrganization = async () => {
    if (!organizationId) return;
    
    setLoading(true);
    try {
      console.log('Loading organization:', organizationId);
      const response = await api.get(`/organizations/${organizationId}`);
      const orgData = response.data;
      console.log('Organization data received:', orgData);
      
      setOrganization(orgData);
      setFormData({
        name: orgData.name || '',
        display_name: orgData.display_name || '',
        description: orgData.description || '',
        contact_email: orgData.contact_email || '',
        website_url: orgData.website_url || '',
        is_active: orgData.is_active !== undefined ? orgData.is_active : true,
        admin_username: '',
        admin_password: '',
        admin_display_name: ''
      });
    } catch (err) {
      setError('Fehler beim Laden der Organisation');
      console.error('Error loading organization:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.display_name.trim()) {
      setError('Name und Anzeigename sind erforderlich');
      return;
    }

    // Validate admin fields for new organizations
    if (!isEditMode) {
      if (!formData.admin_username.trim() || !formData.admin_password.trim() || !formData.admin_display_name.trim()) {
        setError('Admin-Benutzername, Passwort und Name sind erforderlich');
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

    // Validate website format if provided
    if (formData.website_url.trim()) {
      try {
        const url = formData.website_url.trim();
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          formData.website_url = 'https://' + url;
        }
        new URL(formData.website_url);
      } catch {
        setError('Ungültige Website-URL');
        return;
      }
    }

    setLoading(true);
    try {
      // Prepare organization data
      const orgData: any = {
        name: formData.name.trim(),
        slug: formData.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''),
        display_name: formData.display_name.trim(),
        description: formData.description.trim() || null,
        contact_email: formData.contact_email.trim() || null,
        website_url: formData.website_url.trim() || null,
        is_active: formData.is_active
      };

      // Add admin data for new organizations
      if (!isEditMode) {
        orgData.admin_username = formData.admin_username.trim();
        orgData.admin_password = formData.admin_password.trim();
        orgData.admin_display_name = formData.admin_display_name.trim();
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
      setError(err.response?.data?.error || 'Fehler beim Speichern der Organisation');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? 'success' : 'medium';
  };

  const getStatusText = (isActive: boolean) => {
    return isActive ? 'Aktiv' : 'Inaktiv';
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{isEditMode ? 'Organisation bearbeiten' : 'Neue Organisation'}</IonTitle>
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
          <IonCardHeader>
            <IonCardTitle>
              <IonIcon icon={business} style={{ marginRight: '8px' }} />
              Organisations-Informationen
            </IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonItem>
              <IonLabel position="stacked">Systemname *</IonLabel>
              <IonInput
                value={formData.name}
                onIonInput={(e) => setFormData({ ...formData, name: e.detail.value! })}
                placeholder="kirchspiel-west"
                required
              />
              <IonText slot="helper">
                Eindeutiger Systemname (nur Kleinbuchstaben, Zahlen und Bindestriche)
              </IonText>
            </IonItem>

            <IonItem>
              <IonLabel position="stacked">Anzeigename *</IonLabel>
              <IonInput
                value={formData.display_name}
                onIonInput={(e) => setFormData({ ...formData, display_name: e.detail.value! })}
                placeholder="Kirchspiel West"
                required
              />
            </IonItem>

            <IonItem>
              <IonLabel position="stacked">Beschreibung</IonLabel>
              <IonTextarea
                value={formData.description}
                onIonInput={(e) => setFormData({ ...formData, description: e.detail.value! })}
                placeholder="Kurze Beschreibung der Organisation"
                autoGrow={true}
                rows={2}
              />
            </IonItem>
          </IonCardContent>
        </IonCard>

        {/* Kontakt-Informationen */}
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>
              <IonIcon icon={mail} style={{ marginRight: '8px' }} />
              Kontakt-Informationen
            </IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonItem>
              <IonIcon icon={mail} slot="start" color="primary" />
              <IonLabel position="stacked">E-Mail</IonLabel>
              <IonInput
                type="email"
                value={formData.contact_email}
                onIonInput={(e) => setFormData({ ...formData, contact_email: e.detail.value! })}
                placeholder="kontakt@kirchspiel-west.de"
              />
            </IonItem>

            <IonItem>
              <IonIcon icon={globe} slot="start" color="primary" />
              <IonLabel position="stacked">Website</IonLabel>
              <IonInput
                type="url"
                value={formData.website_url}
                onIonInput={(e) => setFormData({ ...formData, website_url: e.detail.value! })}
                placeholder="https://www.kirchspiel-west.de"
              />
            </IonItem>
          </IonCardContent>
        </IonCard>

        {/* Status */}
        <IonCard>
          <IonCardContent>
            <IonItem>
              <IonLabel>
                <h3>Aktiv</h3>
                <p>Organisation kann verwendet werden</p>
              </IonLabel>
              <IonToggle
                checked={formData.is_active}
                onIonChange={(e) => setFormData({ ...formData, is_active: e.detail.checked })}
              />
            </IonItem>

            {!formData.is_active && (
              <IonItem lines="none" style={{ '--background': 'rgba(245, 61, 61, 0.1)', marginTop: '8px' }}>
                <IonIcon icon={warning} slot="start" color="danger" />
                <IonLabel>
                  <IonText color="danger">
                    <p style={{ fontWeight: '500' }}>
                      Inaktive Organisationen können nicht verwendet werden.
                    </p>
                  </IonText>
                </IonLabel>
              </IonItem>
            )}
          </IonCardContent>
        </IonCard>

        {/* Info (nur im Edit-Modus) */}
        {isEditMode && organization && (
          <IonCard>
            <IonCardContent>
              <IonItem lines="none">
                <IonLabel>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <IonChip 
                      color={getStatusColor(organization.is_active)}
                      style={{ fontSize: '0.8rem' }}
                    >
                      {getStatusText(organization.is_active)}
                    </IonChip>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#666', margin: '8px 0 0' }}>
                    Erstellt: {formatDate(organization.created_at)} • 
                    Zuletzt bearbeitet: {formatDate(organization.updated_at)}
                  </p>
                </IonLabel>
              </IonItem>
            </IonCardContent>
          </IonCard>
        )}

        {/* Admin-Erstellung für neue Organisation */}
        {!isEditMode && (
          <IonCard>
            <IonCardHeader>
              <IonCardTitle>
                <IonIcon icon={checkmark} style={{ marginRight: '8px' }} />
                Administrator-Zugang
              </IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonItem>
                <IonLabel position="stacked">Admin-Benutzername *</IonLabel>
                <IonInput
                  value={formData.admin_username || ''}
                  onIonInput={(e) => setFormData({ ...formData, admin_username: e.detail.value! })}
                  placeholder="admin"
                  required
                />
              </IonItem>

              <IonItem>
                <IonLabel position="stacked">Admin-Passwort *</IonLabel>
                <IonInput
                  type="password"
                  value={formData.admin_password || ''}
                  onIonInput={(e) => setFormData({ ...formData, admin_password: e.detail.value! })}
                  placeholder="Sicheres Passwort"
                  required
                />
              </IonItem>

              <IonItem>
                <IonLabel position="stacked">Admin-Name *</IonLabel>
                <IonInput
                  value={formData.admin_display_name || ''}
                  onIonInput={(e) => setFormData({ ...formData, admin_display_name: e.detail.value! })}
                  placeholder="Pastor Müller"
                  required
                />
              </IonItem>

              <IonItem lines="none" style={{ '--background': 'rgba(56, 128, 255, 0.1)', marginTop: '16px' }}>
                <IonIcon icon={checkmark} slot="start" color="primary" />
                <IonLabel>
                  <IonText color="primary">
                    <p style={{ fontWeight: '500' }}>
                      Ein Administrator-Account wird automatisch mit Vollzugriff erstellt.
                    </p>
                  </IonText>
                </IonLabel>
              </IonItem>
            </IonCardContent>
          </IonCard>
        )}
      </IonContent>
    </IonPage>
  );
};

export default OrganizationManagementModal;