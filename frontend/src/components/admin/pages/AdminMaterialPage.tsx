import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  IonSelect,
  IonSelectOption,
  IonList,
  IonListHeader,
  IonCard,
  IonCardContent,
  IonItem,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonItemGroup,
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
  attachOutline,
  calendar,
  filterOutline,
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';
import { useOfflineQuery } from '../../../hooks/useOfflineQuery';
import { CACHE_TTL } from '../../../services/offlineCache';
import EmptyState from '../../shared/EmptyState';
import LoadingSpinner from '../../common/LoadingSpinner';
import { SectionHeader } from '../../shared';
import MaterialFormModal from '../modals/MaterialFormModal';
import { triggerPullHaptic } from '../../../utils/haptics';


interface Material {
  id: number;
  title: string;
  description?: string;
  events?: { id: number; name: string }[];
  event_count?: number;
  jahrgang_id?: number;
  jahrgang_name?: string;
  file_count?: number;
  created_at: string;
}

const AdminMaterialPage: React.FC = () => {
  const pageRef = useRef<HTMLElement>(null);
  const [presentingElement, setPresentingElement] = useState<HTMLElement | null>(null);
  const { user, setError, setSuccess, isOnline } = useApp();
  const [presentAlert] = useIonAlert();

  const [search, setSearch] = useState('');
  const [activeJahrgangId, setActiveJahrgangId] = useState<number | undefined>();
  const [segment, setSegment] = useState<'alle' | 'mit_event' | 'ohne_event'>('alle');
  const [editMaterial, setEditMaterial] = useState<Material | null>(null);

  useEffect(() => {
    setPresentingElement(pageRef.current);
  }, []);

  // Offline-Query: Jahrgaenge
  const { data: jahrgaenge } = useOfflineQuery<{ id: number; name: string }[]>(
    'admin:jahrgaenge:' + user?.organization_id,
    async () => { const res = await api.get('/jahrgaenge'); return res.data; },
    { ttl: CACHE_TTL.STAMMDATEN }
  );

  // Offline-Query: Material (cache-key enthält search + jahrgang filter)
  const { data: materials, loading, refresh: refreshMaterial } = useOfflineQuery<Material[]>(
    `admin:material:${user?.organization_id}:${search}:${activeJahrgangId || ''}`,
    async () => {
      const res = await api.get('/material', {
        params: {
          ...(search ? { search } : {}),
          ...(activeJahrgangId ? { jahrgang_id: activeJahrgangId } : {})
        }
      });
      return res.data;
    },
    { ttl: CACHE_TTL.PROFILE }
  );

  const filteredMaterials = (materials || []).filter(m => {
    if (segment === 'mit_event') return (m.event_count || 0) > 0;
    if (segment === 'ohne_event') return (m.event_count || 0) === 0;
    return true;
  });

  const handleDelete = (material: Material) => {
    if (!isOnline) return;
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
              refreshMaterial();
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
      refreshMaterial();
    }
  });

  const openCreateModal = () => {
    setEditMaterial(null);
    presentFormModal({ presentingElement: presentingElement || undefined });
  };

  const openEditModal = async (material: Material) => {
    try {
      const res = await api.get(`/material/${material.id}`);
      setEditMaterial(res.data);
      presentFormModal({ presentingElement: presentingElement || undefined });
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
    <IonPage ref={pageRef}>
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
          await refreshMaterial();
          e.detail.complete();
        }} onIonPull={triggerPullHaptic}>
          <IonRefresherContent />
        </IonRefresher>

        {loading ? (
          <LoadingSpinner message="Materialien werden geladen..." />
        ) : (
          <>
            <SectionHeader
              title="Material"
              subtitle="Dokumente und Dateien"
              icon={documentIcon}
              colors={{ primary: '#d97706', secondary: '#b45309' }}
              stats={[
                { value: (materials || []).length, label: 'Material' },
                { value: (materials || []).reduce((sum, m) => sum + (m.file_count || 0), 0), label: 'Dateien' }
              ]}
            />

            {/* Suche & Filter */}
            <IonList inset={true} style={{ margin: '16px' }}>
              <IonListHeader>
                <div className="app-section-icon app-section-icon--material">
                  <IonIcon icon={filterOutline} />
                </div>
                <IonLabel>Suche & Filter</IonLabel>
              </IonListHeader>
              <IonItemGroup>
                <IonSearchbar
                  className="ios26-searchbar-classic"
                  value={search}
                  onIonInput={(e) => setSearch(e.detail.value || '')}
                  placeholder="Material durchsuchen..."
                  debounce={300}
                />
                {/* Jahrgang-Filter Dropdown */}
                {(jahrgaenge || []).length > 0 && (
                  <IonItem lines="none" style={{ '--background': 'transparent' }}>
                    <IonSelect
                      interface="popover"
                      label="Jahrgang"
                      labelPlacement="stacked"
                      value={activeJahrgangId ?? 'alle'}
                      onIonChange={(e) => setActiveJahrgangId(e.detail.value === 'alle' ? undefined : e.detail.value)}
                      placeholder="Alle Jahrgänge"
                    >
                      <IonSelectOption value="alle">Alle Jahrgänge</IonSelectOption>
                      {(jahrgaenge || []).map(jg => (
                        <IonSelectOption key={jg.id} value={jg.id}>{jg.name}</IonSelectOption>
                      ))}
                    </IonSelect>
                  </IonItem>
                )}
              </IonItemGroup>
            </IonList>

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
                      message={
                        segment === 'ohne_event' && (materials || []).length > 0
                          ? 'Alle Materialien sind einem Event zugeordnet'
                          : segment === 'mit_event' && (materials || []).length > 0
                            ? 'Kein Material ist einem Event zugeordnet'
                            : 'Erstelle dein erstes Material mit dem + Button'
                      }
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
                              style={{ borderLeftColor: '#d97706' }}
                            >
                              <div className="app-list-item__row">
                                <div className="app-list-item__main">
                                  <div className="app-icon-circle" style={{ backgroundColor: '#d97706' }}>
                                    <IonIcon icon={documentIcon} />
                                  </div>
                                  <div className="app-list-item__content">
                                    <div className="app-list-item__title">
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
                                      {mat.file_count !== undefined && mat.file_count > 0 && (
                                        <span className="app-list-item__meta-item">
                                          <IonIcon icon={attachOutline} style={{ color: '#d97706' }} />
                                          {mat.file_count} {mat.file_count === 1 ? 'Datei' : 'Dateien'}
                                        </span>
                                      )}
                                      {(mat.event_count || 0) > 0 && (
                                        <span className="app-list-item__meta-item">
                                          <IonIcon icon={calendar} style={{ color: '#dc2626' }} />
                                          {mat.event_count} {mat.event_count === 1 ? 'Event' : 'Events'}
                                        </span>
                                      )}
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
