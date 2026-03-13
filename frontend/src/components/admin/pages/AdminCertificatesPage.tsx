import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonButtons,
  IonButton,
  IonIcon,
  IonCard,
  IonCardContent,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonInput,
  IonToggle,
  IonSpinner,
  useIonAlert,
  useIonModal
} from '@ionic/react';
import {
  add,
  ribbon,
  ribbonOutline,
  checkmarkOutline,
  closeOutline,
  arrowBack,
  trash,
  createOutline
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import api from '../../../services/api';
import LoadingSpinner from '../../common/LoadingSpinner';
import { SectionHeader, ListSection } from '../../shared';

interface CertificateType {
  id: number;
  name: string;
  icon: string;
  is_active: boolean;
  created_at: string;
}

interface CertificateModalProps {
  certificateType?: CertificateType | null;
  onClose: () => void;
  onSuccess: () => void;
  dismiss?: () => void;
}

const CertificateModal: React.FC<CertificateModalProps> = ({
  certificateType,
  onClose,
  onSuccess,
  dismiss
}) => {
  const handleClose = () => {
    if (dismiss) {
      dismiss();
    } else {
      onClose();
    }
  };
  const { setSuccess, setError } = useApp();
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState(certificateType?.name || '');
  const [icon, setIcon] = useState(certificateType?.icon || 'ribbon');
  const [isActive, setIsActive] = useState(certificateType?.is_active ?? true);

  useEffect(() => {
    if (certificateType) {
      setName(certificateType.name);
      setIcon(certificateType.icon || 'ribbon');
      setIsActive(certificateType.is_active);
    } else {
      setName('');
      setIcon('ribbon');
      setIsActive(true);
    }
  }, [certificateType]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Name ist erforderlich');
      return;
    }

    setLoading(true);
    try {
      if (certificateType) {
        await api.put(`/teamer/certificate-types/${certificateType.id}`, {
          name: name.trim(),
          icon,
          is_active: isActive
        });
        setSuccess('Zertifikat aktualisiert');
      } else {
        await api.post('/teamer/certificate-types', {
          name: name.trim(),
          icon
        });
        setSuccess('Zertifikat erstellt');
      }

      onSuccess();
      handleClose();
    } catch (error: any) {
      setError(error.response?.data?.error || 'Fehler beim Speichern');
    } finally {
      setLoading(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={handleClose} disabled={loading}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
          <IonTitle>
            {certificateType ? 'Zertifikat bearbeiten' : 'Neues Zertifikat'}
          </IonTitle>
          <IonButtons slot="end">
            <IonButton
              onClick={handleSubmit}
              disabled={!name.trim() || loading}
            >
              {loading ? (
                <IonSpinner name="crescent" />
              ) : (
                <IonIcon icon={checkmarkOutline} />
              )}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--purple">
              <IonIcon icon={ribbon} />
            </div>
            <IonLabel>Zertifikat Details</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent>
              <IonList style={{ background: 'transparent', padding: '0' }}>
                <IonItem lines="full" style={{ '--background': 'transparent' }}>
                  <IonInput
                    label="Name"
                    labelPlacement="stacked"
                    value={name}
                    onIonInput={(e) => setName(e.detail.value || '')}
                    placeholder="z.B. JuLeiCa, Teamer-Card"
                    disabled={loading}
                  />
                </IonItem>
                <IonItem lines="full" style={{ '--background': 'transparent' }}>
                  <IonInput
                    label="Icon"
                    labelPlacement="stacked"
                    value={icon}
                    onIonInput={(e) => setIcon(e.detail.value || 'ribbon')}
                    placeholder="ribbon"
                    disabled={loading}
                  />
                </IonItem>
                {certificateType && (
                  <IonItem lines="none" style={{ '--background': 'transparent' }}>
                    <IonLabel>Aktiv</IonLabel>
                    <IonToggle
                      checked={isActive}
                      onIonChange={(e) => setIsActive(e.detail.checked)}
                      disabled={loading}
                    />
                  </IonItem>
                )}
              </IonList>
            </IonCardContent>
          </IonCard>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

const AdminCertificatesPage: React.FC = () => {
  const { pageRef, presentingElement } = useModalPage('admin-certificates');
  const { user, setSuccess, setError } = useApp();

  const [certificateTypes, setCertificateTypes] = useState<CertificateType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editCert, setEditCert] = useState<CertificateType | null>(null);
  const slidingRefs = useRef<Map<number, HTMLIonItemSlidingElement>>(new Map());

  const [presentAlert] = useIonAlert();

  const [presentCertModal, dismissCertModal] = useIonModal(CertificateModal, {
    certificateType: editCert,
    onClose: () => dismissCertModal(),
    onSuccess: () => {
      dismissCertModal();
      loadCertificateTypes();
    }
  });

  const loadCertificateTypes = async () => {
    try {
      const response = await api.get('/teamer/certificate-types');
      setCertificateTypes(response.data);
    } catch (error) {
      setError('Fehler beim Laden der Zertifikate');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCertificateTypes();
  }, []);

  const handleRefresh = async (event: CustomEvent) => {
    await loadCertificateTypes();
    (event.target as HTMLIonRefresherElement).complete();
  };

  const handleDelete = async (certType: CertificateType) => {
    presentAlert({
      header: 'Zertifikat loeschen',
      message: `"${certType.name}" wirklich loeschen?`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Loeschen',
          role: 'destructive',
          handler: async () => {
            const slidingElement = slidingRefs.current.get(certType.id);
            try {
              await api.delete(`/teamer/certificate-types/${certType.id}`);
              setSuccess(`"${certType.name}" geloescht`);
              loadCertificateTypes();
            } catch (error: any) {
              if (slidingElement) {
                await slidingElement.close();
              }
              setError(error.response?.data?.error || 'Fehler beim Loeschen');
            }
          }
        }
      ]
    });
  };

  const openCreateModal = () => {
    setEditCert(null);
    presentCertModal({ presentingElement });
  };

  const openEditModal = (certType: CertificateType) => {
    setEditCert(certType);
    presentCertModal({ presentingElement });
  };

  const isAdmin = ['org_admin', 'admin'].includes(user?.role_name || '');

  if (loading) {
    return (
      <IonPage ref={pageRef}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Zertifikate</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <LoadingSpinner fullScreen message="Zertifikate werden geladen..." />
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage ref={pageRef}>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={() => window.history.back()}>
              <IonIcon icon={arrowBack} />
            </IonButton>
          </IonButtons>
          <IonTitle>Zertifikate</IonTitle>
          {isAdmin && (
            <IonButtons slot="end">
              <IonButton onClick={openCreateModal}>
                <IonIcon icon={add} />
              </IonButton>
            </IonButtons>
          )}
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar className="app-condense-toolbar">
            <IonTitle size="large">Zertifikate</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent refreshingSpinner="crescent" />
        </IonRefresher>

        <SectionHeader
          title="Zertifikate"
          subtitle="Teamer:innen-Zertifikate"
          icon={ribbon}
          colors={{ primary: '#5b21b6', secondary: '#4c1d95' }}
          stats={[
            { value: certificateTypes.length, label: 'Gesamt' },
            { value: certificateTypes.filter(c => c.is_active).length, label: 'Aktiv' }
          ]}
        />

        <ListSection
          icon={ribbonOutline}
          title="Zertifikate"
          count={certificateTypes.length}
          iconColorClass="purple"
          emptyIcon={ribbon}
          emptyTitle="Keine Zertifikate"
          emptyMessage="Noch keine Zertifikate angelegt"
          emptyIconColor="#5b21b6"
        >
          {certificateTypes.map((certType, index) => (
            <IonItemSliding
              key={certType.id}
              ref={(el) => {
                if (el) {
                  slidingRefs.current.set(certType.id, el);
                } else {
                  slidingRefs.current.delete(certType.id);
                }
              }}
              style={{ marginBottom: index < certificateTypes.length - 1 ? '8px' : '0' }}
            >
              <IonItem
                button={isAdmin}
                onClick={isAdmin ? () => openEditModal(certType) : undefined}
                detail={false}
                lines="none"
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
                  className="app-list-item"
                  style={{
                    width: '100%',
                    borderLeftColor: '#5b21b6',
                    opacity: certType.is_active ? 1 : 0.5
                  }}
                >
                  <div className="app-list-item__row">
                    <div className="app-list-item__main">
                      <div className="app-icon-circle app-icon-circle--lg" style={{ backgroundColor: '#5b21b6' }}>
                        <IonIcon icon={ribbon} />
                      </div>
                      <div className="app-list-item__content">
                        <div className="app-list-item__title">
                          {certType.name}
                        </div>
                        <div className="app-list-item__meta">
                          <span className="app-list-item__meta-item">
                            {certType.is_active ? 'Aktiv' : 'Inaktiv'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </IonItem>

              {isAdmin && (
                <IonItemOptions side="end" style={{ '--ion-item-background': 'transparent', border: 'none' } as any}>
                  <IonItemOption
                    onClick={() => handleDelete(certType)}
                    style={{ '--background': 'transparent', '--color': 'transparent', padding: '0', minWidth: 'auto', '--border-width': '0' }}
                  >
                    <div className="app-icon-circle app-icon-circle--lg app-icon-circle--danger">
                      <IonIcon icon={trash} />
                    </div>
                  </IonItemOption>
                </IonItemOptions>
              )}
            </IonItemSliding>
          ))}
        </ListSection>
      </IonContent>
    </IonPage>
  );
};

export default AdminCertificatesPage;
