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
  useIonModal,
  useIonAlert,
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
  IonSpinner,
  IonDatetime,
  IonDatetimeButton,
  IonModal,
  IonToggle
} from '@ionic/react';
import {
  add,
  school,
  checkmarkOutline,
  closeOutline,
  arrowBack,
  calendar,
  trash,
  schoolOutline,
  settingsOutline
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import { useLiveRefresh } from '../../../contexts/LiveUpdateContext';
import api from '../../../services/api';
import { writeQueue } from '../../../services/writeQueue';
import { networkMonitor } from '../../../services/networkMonitor';
import { useOfflineQuery } from '../../../hooks/useOfflineQuery';
import { CACHE_TTL } from '../../../services/offlineCache';
import LoadingSpinner from '../../common/LoadingSpinner';
import { SectionHeader, ListSection } from '../../shared';
import { triggerPullHaptic } from '../../../utils/haptics';

interface Jahrgang {
  id: number;
  name: string;
  confirmation_date?: string;
  created_at: string;
  gottesdienst_enabled?: boolean;
  gemeinde_enabled?: boolean;
  target_gottesdienst?: number;
  target_gemeinde?: number;
  konfi_count?: number;
  gottesdienst_points_total?: number;
  gemeinde_points_total?: number;
}

interface JahrgangModalProps {
  jahrgang?: Jahrgang | null;
  onClose: () => void;
  onSuccess: () => void;
  dismiss?: () => void;
}

const JahrgangModal: React.FC<JahrgangModalProps> = ({
  jahrgang,
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
  
  const [formData, setFormData] = useState({
    name: '',
    confirmation_date: '',
    gottesdienst_enabled: true,
    gemeinde_enabled: true,
    target_gottesdienst: 10,
    target_gemeinde: 10
  });

  useEffect(() => {
    if (jahrgang) {
      setFormData({
        name: jahrgang.name,
        confirmation_date: jahrgang.confirmation_date || '',
        gottesdienst_enabled: jahrgang.gottesdienst_enabled ?? true,
        gemeinde_enabled: jahrgang.gemeinde_enabled ?? true,
        target_gottesdienst: jahrgang.target_gottesdienst ?? 10,
        target_gemeinde: jahrgang.target_gemeinde ?? 10
      });
    } else {
      setFormData({
        name: '',
        confirmation_date: '',
        gottesdienst_enabled: true,
        gemeinde_enabled: true,
        target_gottesdienst: 10,
        target_gemeinde: 10
      });
    }
  }, [jahrgang]);

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError('Name ist erforderlich');
      return;
    }

    const payload = {
      name: formData.name.trim(),
      confirmation_date: formData.confirmation_date.trim() || null,
      gottesdienst_enabled: formData.gottesdienst_enabled,
      gemeinde_enabled: formData.gemeinde_enabled,
      target_gottesdienst: formData.target_gottesdienst,
      target_gemeinde: formData.target_gemeinde
    };

    if (networkMonitor.isOnline) {
      setLoading(true);
      try {
        if (jahrgang) {
          await api.put(`/admin/jahrgaenge/${jahrgang.id}`, payload);
          setSuccess('Jahrgang aktualisiert');
        } else {
          await api.post('/admin/jahrgaenge', payload);
          setSuccess('Jahrgang erstellt');
        }

        onSuccess();
        handleClose();
      } catch (error: any) {
        if (error.response?.data?.error) {
          setError(error.response.data.error);
        } else {
          setError('Fehler beim Speichern des Jahrgangs');
        }
      } finally {
        setLoading(false);
      }
    } else {
      await writeQueue.enqueue({
        method: jahrgang ? 'PUT' : 'POST',
        url: jahrgang ? `/admin/jahrgaenge/${jahrgang.id}` : '/admin/jahrgaenge',
        body: payload,
        maxRetries: 5,
        hasFileUpload: false,
        metadata: {
          type: 'admin',
          clientId: crypto.randomUUID(),
          label: jahrgang ? 'Jahrgang bearbeiten' : 'Jahrgang erstellen'
        }
      });
      setSuccess('Wird gespeichert sobald du wieder online bist');
      onSuccess();
      handleClose();
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>
            {jahrgang ? 'Jahrgang bearbeiten' : 'Neuer Jahrgang'}
          </IonTitle>
          <IonButtons slot="start">
            <IonButton onClick={handleClose} disabled={loading}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton
              onClick={handleSubmit}
              disabled={!formData.name.trim() || loading}
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
        {/* Jahrgang Details - iOS26 Pattern */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--jahrgang">
              <IonIcon icon={school} />
            </div>
            <IonLabel>Jahrgang Details</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent>
              <IonList style={{ background: 'transparent', padding: '0' }}>
                <IonItem lines="full" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">Name *</IonLabel>
                  <IonInput
                    value={formData.name}
                    onIonInput={(e) => setFormData({ ...formData, name: e.detail.value! })}
                    placeholder="z.B. Jahrgang 2024/2025"
                    disabled={loading}
                    clearInput={true}
                  />
                </IonItem>
                <IonItem lines="none" style={{ '--background': 'transparent', marginBottom: '8px' }}>
                  <IonLabel position="stacked">Konfirmationsdatum</IonLabel>
                  <IonDatetimeButton datetime="confirmation-date" disabled={loading} />
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Punkte-Konfiguration */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--users">
              <IonIcon icon={settingsOutline} />
            </div>
            <IonLabel>Punkte-Konfiguration</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent>
              <IonList style={{ background: 'transparent', padding: '0' }}>
                <IonItem lines="full" style={{ '--background': 'transparent' }}>
                  <IonLabel>Gottesdienst-Punkte aktiviert</IonLabel>
                  <IonToggle
                    slot="end"
                    checked={formData.gottesdienst_enabled}
                    onIonChange={(e) => setFormData({ ...formData, gottesdienst_enabled: e.detail.checked })}
                    disabled={loading || (!formData.gemeinde_enabled)}
                  />
                </IonItem>
                {!formData.gemeinde_enabled && formData.gottesdienst_enabled && (
                  <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '4px', paddingLeft: '16px' }}>
                    Mindestens ein Punkt-Typ muss aktiv bleiben.{jahrgang?.konfi_count ? ` ${jahrgang.konfi_count} Konfis haben bereits Gottesdienst-Punkte.` : ''}
                  </div>
                )}
                {formData.gottesdienst_enabled && (
                  <IonItem lines="full" style={{ '--background': 'transparent' }}>
                    <IonLabel position="stacked">Ziel Gottesdienst</IonLabel>
                    <IonInput
                      type="number"
                      min="0"
                      value={formData.target_gottesdienst}
                      onIonInput={(e) => {
                        const val = parseInt(e.detail.value || '0', 10);
                        if (!isNaN(val) && val >= 0) {
                          setFormData({ ...formData, target_gottesdienst: val });
                        }
                      }}
                      disabled={loading}
                    />
                  </IonItem>
                )}
                <IonItem lines="full" style={{ '--background': 'transparent' }}>
                  <IonLabel>Gemeinde-Punkte aktiviert</IonLabel>
                  <IonToggle
                    slot="end"
                    checked={formData.gemeinde_enabled}
                    onIonChange={(e) => setFormData({ ...formData, gemeinde_enabled: e.detail.checked })}
                    disabled={loading || (!formData.gottesdienst_enabled)}
                  />
                </IonItem>
                {!formData.gottesdienst_enabled && formData.gemeinde_enabled && (
                  <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '4px', paddingLeft: '16px' }}>
                    Mindestens ein Punkt-Typ muss aktiv bleiben.{jahrgang?.konfi_count ? ` ${jahrgang.konfi_count} Konfis haben bereits Gemeinde-Punkte.` : ''}
                  </div>
                )}
                {formData.gemeinde_enabled && (
                  <IonItem lines="none" style={{ '--background': 'transparent' }}>
                    <IonLabel position="stacked">Ziel Gemeinde</IonLabel>
                    <IonInput
                      type="number"
                      min="0"
                      value={formData.target_gemeinde}
                      onIonInput={(e) => {
                        const val = parseInt(e.detail.value || '0', 10);
                        if (!isNaN(val) && val >= 0) {
                          setFormData({ ...formData, target_gemeinde: val });
                        }
                      }}
                      disabled={loading}
                    />
                  </IonItem>
                )}
              </IonList>
            </IonCardContent>
          </IonCard>
        </IonList>

        <IonModal keepContentsMounted={true}>
          <IonDatetime
            id="confirmation-date"
            presentation="date"
            locale="de-DE"
            value={formData.confirmation_date || undefined}
            onIonChange={(e) => {
              const value = e.detail.value;
              if (typeof value === 'string') {
                setFormData({ ...formData, confirmation_date: value.split('T')[0] });
              }
            }}
            disabled={loading}
          />
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

const AdminJahrgaengeePage: React.FC = () => {
  const { pageRef, presentingElement, cleanupModals } = useModalPage('admin-jahrgaenge');
  const { user, setSuccess, setError, isOnline } = useApp();

  // Offline-Query: Jahrgaenge
  const { data: jahrgaenge, loading, refresh: refreshJahrgaenge } = useOfflineQuery<Jahrgang[]>(
    'admin:jahrgaenge-detail:' + user?.organization_id,
    async () => { const res = await api.get('/admin/jahrgaenge'); return res.data; },
    { ttl: CACHE_TTL.STAMMDATEN }
  );

  const [editJahrgang, setEditJahrgang] = useState<Jahrgang | null>(null);
  const slidingRefs = useRef<Map<number, HTMLIonItemSlidingElement>>(new Map());

  // Alert Hook für Bestätigungsdialoge
  const [presentAlert] = useIonAlert();

  // Modal mit useIonModal Hook
  const [presentJahrgangModalHook, dismissJahrgangModalHook] = useIonModal(JahrgangModal, {
    jahrgang: editJahrgang,
    onClose: () => dismissJahrgangModalHook(),
    onSuccess: () => {
      dismissJahrgangModalHook();
      refreshJahrgaenge();
    }
  });

  // Subscribe to live updates for jahrgaenge
  useLiveRefresh('jahrgaenge', refreshJahrgaenge);

  const handleRefresh = async (event: CustomEvent) => {
    await refreshJahrgaenge();
    (event.target as HTMLIonRefresherElement).complete();
  };

  const handleDeleteWithSlideClose = async (jahrgang: Jahrgang, forceDelete = false) => {
    if (!isOnline) return;
    const performDelete = async () => {
      const slidingElement = slidingRefs.current.get(jahrgang.id);
      try {
        const url = forceDelete ? `/admin/jahrgaenge/${jahrgang.id}?force=true` : `/admin/jahrgaenge/${jahrgang.id}`;
        await api.delete(url);
        setSuccess(`Jahrgang "${jahrgang.name}" gelöscht`);
        refreshJahrgaenge();
      } catch (error: any) {
        if (slidingElement) {
          await slidingElement.close();
        }

        if (error.response?.data?.canForceDelete) {
          // Org Admin kann trotzdem löschen
          presentAlert({
            header: 'Chat-Nachrichten vorhanden',
            message: `${error.response.data.error}\n\nAls Organisation-Admin können Sie dennoch löschen. Dadurch werden ALLE Chat-Nachrichten unwiderruflich gelöscht!`,
            buttons: [
              { text: 'Abbrechen', role: 'cancel' },
              {
                text: 'Dennoch löschen',
                role: 'destructive',
                handler: () => handleDeleteWithSlideClose(jahrgang, true)
              }
            ]
          });
        } else {
          const errorMessage = error.response?.data?.error || 'Fehler beim Löschen des Jahrgangs';
          setError(errorMessage);
        }
      }
    };

    if (forceDelete) {
      await performDelete();
    } else {
      presentAlert({
        header: 'Jahrgang löschen',
        message: `Jahrgang "${jahrgang.name}" wirklich löschen?`,
        buttons: [
          { text: 'Abbrechen', role: 'cancel' },
          {
            text: 'Löschen',
            role: 'destructive',
            handler: performDelete
          }
        ]
      });
    }
  };

  const openCreateModal = () => {
    setEditJahrgang(null);
    presentJahrgangModalHook({ presentingElement });
  };

  const openEditModal = (jahrgang: Jahrgang) => {
    setEditJahrgang(jahrgang);
    presentJahrgangModalHook({ presentingElement });
  };

  // Rollen-basierte Berechtigungen (org_admin und admin duerfen alles)
  const isAdmin = ['org_admin', 'admin'].includes(user?.role_name || '');
  const canCreate = isAdmin;
  const canEdit = isAdmin;
  const canDelete = isAdmin;


  return (
    <IonPage ref={pageRef}>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={() => window.history.back()}>
              <IonIcon icon={arrowBack} />
            </IonButton>
          </IonButtons>
          <IonTitle>Jahrgänge</IonTitle>
          {canCreate && (
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
            <IonTitle size="large">Jahrgänge</IonTitle>
          </IonToolbar>
        </IonHeader>
        
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh} onIonPull={triggerPullHaptic}>
          <IonRefresherContent refreshingSpinner="crescent" />
        </IonRefresher>

        {loading ? (
          <LoadingSpinner message="Jahrgänge werden geladen..." />
        ) : (
          <>
            <SectionHeader
              title="Jahrgänge"
              subtitle="Konfirmand:innen verwalten"
              icon={school}
              preset="jahrgang"
              stats={[
                { value: (jahrgaenge || []).length, label: 'GESAMT' }
              ]}
            />

        {/* Jahrgaenge List */}
        <ListSection
          icon={schoolOutline}
          title="Jahrgänge"
          count={(jahrgaenge || []).length}
          iconColorClass="jahrgang"
          emptyIcon={school}
          emptyTitle="Keine Jahrgänge gefunden"
          emptyMessage="Noch keine Jahrgänge angelegt"
          emptyIconColor="#007aff"
        >
                  {(jahrgaenge || []).map((jahrgang, index) => (
                    <IonItemSliding
                      key={jahrgang.id}
                      ref={(el) => {
                        if (el) {
                          slidingRefs.current.set(jahrgang.id, el);
                        } else {
                          slidingRefs.current.delete(jahrgang.id);
                        }
                      }}
                      style={{ marginBottom: index < (jahrgaenge || []).length - 1 ? '8px' : '0' }}
                    >
                      <IonItem
                        button={canEdit}
                        onClick={canEdit ? () => openEditModal(jahrgang) : undefined}
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
                          className="app-list-item app-list-item--jahrgang"
                          style={{ width: '100%' }}
                        >
                          <div className="app-list-item__row">
                            <div className="app-list-item__main">
                              <div className="app-icon-circle app-icon-circle--lg app-icon-circle--jahrgang">
                                <IonIcon icon={school} />
                              </div>
                              <div className="app-list-item__content">
                                <div className="app-list-item__title">
                                  {jahrgang.name}
                                </div>
                                {jahrgang.confirmation_date && (
                                  <div className="app-list-item__meta">
                                    <span className="app-list-item__meta-item">
                                      <IonIcon icon={calendar} style={{ color: '#007aff' }} />
                                      {new Date(jahrgang.confirmation_date).toLocaleDateString('de-DE')}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </IonItem>

                      {canDelete && (
                        <IonItemOptions side="end" style={{ '--ion-item-background': 'transparent', border: 'none' }}>
                          <IonItemOption
                            onClick={() => handleDeleteWithSlideClose(jahrgang)}
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
          </>
        )}

      </IonContent>
    </IonPage>
  );
};

export default AdminJahrgaengeePage;