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
    is_active: true
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
      const response = await api.get(`/organizations/${organizationId}`);
      const orgData = response.data;
      
      setOrganization(orgData);
      setFormData({
        name: orgData.name,
        display_name: orgData.display_name,
        description: orgData.description || '',
        contact_email: orgData.contact_email || '',
        website_url: orgData.website_url || '',
        is_active: orgData.is_active
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

      if (isEditMode) {
        await api.put(`/organizations/${organizationId}`, orgData);
        setSuccess('Organisation erfolgreich aktualisiert');
      } else {
        await api.post('/organizations', orgData);
        setSuccess('Organisation erfolgreich erstellt');
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

        {/* Statistiken (nur im Edit-Modus) */}
        {isEditMode && organization && (
          <IonCard>
            <IonCardHeader>
              <IonCardTitle>
                <IonIcon icon={analytics} style={{ marginRight: '8px' }} />
                Statistiken
              </IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonGrid>
                <IonRow>
                  <IonCol size="6">
                    <div style={{ textAlign: 'center', padding: '16px' }}>
                      <IonIcon icon={people} style={{ fontSize: '2rem', color: '#667eea', marginBottom: '8px' }} />
                      <h3 style={{ margin: '0', fontSize: '1.5rem', color: '#667eea' }}>
                        {organization.user_count}
                      </h3>
                      <p style={{ margin: '0', fontSize: '0.9rem', color: '#666' }}>
                        Benutzer
                      </p>
                    </div>
                  </IonCol>
                  <IonCol size="6">
                    <div style={{ textAlign: 'center', padding: '16px' }}>
                      <IonIcon icon={people} style={{ fontSize: '2rem', color: '#2dd36f', marginBottom: '8px' }} />
                      <h3 style={{ margin: '0', fontSize: '1.5rem', color: '#2dd36f' }}>
                        {organization.konfi_count}
                      </h3>
                      <p style={{ margin: '0', fontSize: '0.9rem', color: '#666' }}>
                        Konfis
                      </p>
                    </div>
                  </IonCol>
                </IonRow>
                <IonRow>
                  <IonCol size="4">
                    <div style={{ textAlign: 'center', padding: '8px' }}>
                      <h4 style={{ margin: '0', fontSize: '1.2rem', color: '#3880ff' }}>
                        {organization.activity_count}
                      </h4>
                      <p style={{ margin: '0', fontSize: '0.8rem', color: '#666' }}>
                        Aktivitäten
                      </p>
                    </div>
                  </IonCol>
                  <IonCol size="4">
                    <div style={{ textAlign: 'center', padding: '8px' }}>
                      <h4 style={{ margin: '0', fontSize: '1.2rem', color: '#ffcc00' }}>
                        {organization.event_count}
                      </h4>
                      <p style={{ margin: '0', fontSize: '0.8rem', color: '#666' }}>
                        Events
                      </p>
                    </div>
                  </IonCol>
                  <IonCol size="4">
                    <div style={{ textAlign: 'center', padding: '8px' }}>
                      <h4 style={{ margin: '0', fontSize: '1.2rem', color: '#ff6b35' }}>
                        {organization.badge_count}
                      </h4>
                      <p style={{ margin: '0', fontSize: '0.8rem', color: '#666' }}>
                        Badges
                      </p>
                    </div>
                  </IonCol>
                </IonRow>
              </IonGrid>

              <IonItem lines="none" style={{ marginTop: '16px' }}>
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

        {/* Hinweise für neue Organisation */}
        {!isEditMode && (
          <IonCard>
            <IonCardContent>
              <IonItem lines="none">
                <IonIcon icon={checkmark} slot="start" color="success" />
                <IonLabel>
                  <IonText color="success">
                    <h3>Nach dem Erstellen</h3>
                    <p>
                      Nach dem Erstellen der Organisation wird automatisch eine Standard-Rollenverwaltung 
                      eingerichtet. Sie können dann Benutzer zur Organisation hinzufügen.
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