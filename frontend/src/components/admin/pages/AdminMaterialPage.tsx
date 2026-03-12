import React, { useState, useEffect, useCallback } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonIcon,
  IonChip,
  IonList,
  IonListHeader,
  IonCard,
  IonCardContent,
  IonItem,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonRefresher,
  IonRefresherContent,
  useIonAlert,
  useIonModal
} from '@ionic/react';
import {
  document as documentIcon,
  documentOutline,
  add,
  arrowBack,
  trash,
  createOutline,
  attachOutline,
  calendarOutline,
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import api from '../../../services/api';
import EmptyState from '../../shared/EmptyState';
import LoadingSpinner from '../../common/LoadingSpinner';
import MaterialFormModal from '../modals/MaterialFormModal';

interface Material {
  id: number;
  title: string;
  description?: string;
  event_id?: number;
  event_name?: string;
  jahrgang_id?: number;
  jahrgang_name?: string;
  file_count?: number;
  created_at: string;
}

const AdminMaterialPage: React.FC = () => {
  const { presentingElement } = useModalPage('admin-material');
  const { setError, setSuccess } = useApp();
  const [presentAlert] = useIonAlert();

  const [materials, setMaterials] = useState<Material[]>([]);
  const [jahrgaenge, setJahrgaenge] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeJahrgangId, setActiveJahrgangId] = useState<number | undefined>();
  const [segment, setSegment] = useState<'alle' | 'mit_event' | 'ohne_event'>('alle');
  const [editMaterial, setEditMaterial] = useState<Material | null>(null);

  // Jahrgaenge einmalig laden
  useEffect(() => {
    const loadJahrgaenge = async () => {
      try {
        const res = await api.get('/jahrgaenge');
        setJahrgaenge(res.data);
      } catch {
        // Nicht kritisch
      }
    };
    loadJahrgaenge();
  }, []);

  const loadData = useCallback(async () => {
    try {
      const res = await api.get('/material', {
        params: {
          ...(search ? { search } : {}),
          ...(activeJahrgangId ? { jahrgang_id: activeJahrgangId } : {})
        }
      });
      setMaterials(res.data);
    } catch {
      setError('Fehler beim Laden der Materialien');
    } finally {
      setLoading(false);
    }
  }, [search, activeJahrgangId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredMaterials = materials.filter(m => {
    if (segment === 'mit_event') return !!m.event_id;
    if (segment === 'ohne_event') return !m.event_id;
    return true;
  });

  const handleDelete = (material: Material) => {
    presentAlert({
      header: 'Material löschen',
      message: `"${material.title}" wirklich löschen? Alle zugehörigen Dateien werden ebenfalls gelöscht.`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: async () => {
            try {
              await api.delete(`/material/${material.id}`);
              setSuccess('Material gelöscht');
              loadData();
            } catch (err: any) {
              setError(err.response?.data?.error || 'Fehler beim Löschen');
            }
          }
        }
      ]
    });
  };

  // Material Form Modal
  const [presentFormModal, dismissFormModal] = useIonModal(MaterialFormModal, {
    material: editMaterial,
    onClose: () => {
      setEditMaterial(null);
      dismissFormModal();
    },
    onSuccess: () => {
      setEditMaterial(null);
      dismissFormModal();
      loadData();
    }
  });

  const openCreateModal = () => {
    setEditMaterial(null);
    presentFormModal({ presentingElement: presentingElement });
  };

  const openEditModal = async (material: Material) => {
    try {
      const res = await api.get(`/material/${material.id}`);
      setEditMaterial(res.data);
      presentFormModal({ presentingElement: presentingElement });
    } catch {
      setError('Fehler beim Laden des Materials');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <IonPage>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={() => window.history.back()}>
              <IonIcon icon={arrowBack} />
            </IonButton>
          </IonButtons>
          <IonTitle>Material verwalten</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={openCreateModal}>
              <IonIcon icon={add} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar className="app-condense-toolbar">
            <IonTitle size="large">Material verwalten</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonRefresher slot="fixed" onIonRefresh={async (e) => {
          await loadData();
          e.detail.complete();
        }}>
          <IonRefresherContent />
        </IonRefresher>

        {loading ? (
          <LoadingSpinner message="Materialien werden geladen..." />
        ) : (
          <>
            {/* Jahrgang-Filter Chips */}
            {jahrgaenge.length > 0 && (
              <div style={{ padding: '0 16px 8px', overflowX: 'auto', whiteSpace: 'nowrap', WebkitOverflowScrolling: 'touch', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '12px', color: '#6c757d', flexShrink: 0 }}>Jahrgang:</span>
                <IonChip
                  onClick={() => setActiveJahrgangId(undefined)}
                  style={{
                    backgroundColor: !activeJahrgangId ? '#d97706' : 'transparent',
                    color: !activeJahrgangId ? 'white' : '#d97706',
                    border: '1px solid #d97706'
                  }}
                >
                  <IonLabel>Alle</IonLabel>
                </IonChip>
                {jahrgaenge.map(jg => (
                  <IonChip
                    key={jg.id}
                    onClick={() => setActiveJahrgangId(activeJahrgangId === jg.id ? undefined : jg.id)}
                    style={{
                      backgroundColor: activeJahrgangId === jg.id ? '#d97706' : 'transparent',
                      color: activeJahrgangId === jg.id ? 'white' : '#d97706',
                      border: '1px solid #d97706'
                    }}
                  >
                    <IonLabel>{jg.name}</IonLabel>
                  </IonChip>
                ))}
              </div>
            )}

            {/* Suchleiste */}
            <div style={{ padding: '0 16px' }}>
              <IonSearchbar
                value={search}
                onIonInput={(e) => setSearch(e.detail.value || '')}
                placeholder="Material durchsuchen..."
                debounce={300}
              />
            </div>

            {/* Segment */}
            <div className="app-segment-wrapper">
              <IonSegment
                value={segment}
                onIonChange={(e) => setSegment(e.detail.value as any)}
              >
                <IonSegmentButton value="alle">
                  <IonLabel>Alle</IonLabel>
                </IonSegmentButton>
                <IonSegmentButton value="mit_event">
                  <IonLabel>Mit Event</IonLabel>
                </IonSegmentButton>
                <IonSegmentButton value="ohne_event">
                  <IonLabel>Ohne Event</IonLabel>
                </IonSegmentButton>
              </IonSegment>
            </div>

            {/* Material-Liste */}
            <IonList inset={true} className="app-segment-wrapper">
              <IonListHeader>
                <div className="app-section-icon app-section-icon--material">
                  <IonIcon icon={documentIcon} />
                </div>
                <IonLabel>Materialien ({filteredMaterials.length})</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent>
                  {filteredMaterials.length === 0 ? (
                    <EmptyState
                      icon={documentOutline}
                      title="Keine Materialien"
                      message="Erstelle dein erstes Material mit dem + Button"
                      iconColor="#d97706"
                    />
                  ) : (
                    <IonList className="app-list-inner" lines="none">
                      {filteredMaterials.map((mat, index) => (
                        <IonItemSliding key={mat.id} style={{ marginBottom: index < filteredMaterials.length - 1 ? '8px' : '0' }}>
                          <IonItem
                            button
                            onClick={() => openEditModal(mat)}
                            detail={false}
                            lines="none"
                            className="app-item-transparent"
                          >
                            <div
                              className="app-list-item"
                              style={{
                                borderLeftColor: '#d97706',
                                position: 'relative',
                                overflow: 'hidden'
                              }}
                            >
                              {/* Corner Badges */}
                              {(mat.event_name || (mat.file_count && mat.file_count > 0)) && (
                                <div style={{
                                  position: 'absolute',
                                  top: '0',
                                  right: '0',
                                  display: 'flex',
                                  flexDirection: 'row',
                                  zIndex: 10
                                }}>
                                  {mat.event_name && (
                                    <div className="app-corner-badge" style={{ backgroundColor: '#dc2626', position: 'static' }}>
                                      {mat.event_name.length > 15 ? mat.event_name.substring(0, 15) + '...' : mat.event_name}
                                    </div>
                                  )}
                                  {mat.file_count && mat.file_count > 0 && (
                                    <>
                                      {mat.event_name && <div style={{ width: '2px', background: 'white' }} />}
                                      <div style={{
                                        backgroundColor: '#d97706',
                                        color: 'white',
                                        fontSize: '0.65rem',
                                        fontWeight: '700',
                                        padding: '4px 8px',
                                        borderRadius: '0 0 8px 8px'
                                      }}>
                                        {mat.file_count} {mat.file_count === 1 ? 'Datei' : 'Dateien'}
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}

                              <div className="app-list-item__row">
                                <div className="app-list-item__main">
                                  <div className="app-icon-circle" style={{ backgroundColor: '#d97706' }}>
                                    <IonIcon icon={documentIcon} />
                                  </div>
                                  <div className="app-list-item__content">
                                    <div
                                      className="app-list-item__title"
                                      style={{
                                        paddingRight: (mat.event_name || (mat.file_count && mat.file_count > 0)) ? '80px' : '0',
                                        paddingTop: (mat.event_name || (mat.file_count && mat.file_count > 0)) ? '4px' : '0'
                                      }}
                                    >
                                      {mat.title}
                                    </div>
                                    {mat.description && (
                                      <div className="app-list-item__subtitle" style={{
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical'
                                      }}>
                                        {mat.description}
                                      </div>
                                    )}
                                    <div className="app-list-item__meta">
                                      {mat.file_count !== undefined && (
                                        <span className="app-list-item__meta-item">
                                          <IonIcon icon={attachOutline} style={{ color: '#d97706' }} />
                                          {mat.file_count} {mat.file_count === 1 ? 'Datei' : 'Dateien'}
                                        </span>
                                      )}
                                      <span className="app-list-item__meta-item">
                                        <IonIcon icon={calendarOutline} style={{ color: '#6c757d' }} />
                                        {formatDate(mat.created_at)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </IonItem>
                          <IonItemOptions className="app-swipe-actions" side="end">
                            <IonItemOption
                              className="app-swipe-action"
                              onClick={() => handleDelete(mat)}
                            >
                              <div className="app-icon-circle app-icon-circle--lg app-icon-circle--danger">
                                <IonIcon icon={trash} />
                              </div>
                            </IonItemOption>
                          </IonItemOptions>
                        </IonItemSliding>
                      ))}
                    </IonList>
                  )}
                </IonCardContent>
              </IonCard>
            </IonList>

          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default AdminMaterialPage;
