import React, { useState, useEffect, useCallback } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonIcon,
  IonChip,
  IonLabel,
  IonList,
  IonListHeader,
  IonCard,
  IonCardContent,
  IonItem,
  useIonModal
} from '@ionic/react';
import {
  document as documentIcon,
  documentOutline,
  attachOutline,
  calendarOutline
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import api from '../../../services/api';
import EmptyState from '../../shared/EmptyState';
import LoadingSpinner from '../../common/LoadingSpinner';
import TeamerMaterialDetailPage from './TeamerMaterialDetailPage';

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

const TeamerMaterialPage: React.FC = () => {
  const { setError } = useApp();
  const { presentingElement } = useModalPage('teamer-material');

  const [materials, setMaterials] = useState<Material[]>([]);
  const [jahrgaenge, setJahrgaenge] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeJahrgangId, setActiveJahrgangId] = useState<number | undefined>();
  const [selectedMaterialId, setSelectedMaterialId] = useState<number | null>(null);

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
      setLoading(true);
      const matRes = await api.get('/material', {
        params: {
          ...(search ? { search } : {}),
          ...(activeJahrgangId ? { jahrgang_id: activeJahrgangId } : {})
        }
      });
      setMaterials(matRes.data);
    } catch {
      setError('Fehler beim Laden der Materialien');
    }
    setLoading(false);
  }, [search, activeJahrgangId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Detail Modal
  const [presentDetailModal, dismissDetailModal] = useIonModal(TeamerMaterialDetailPage, {
    materialId: selectedMaterialId,
    onClose: () => dismissDetailModal()
  });

  const openDetail = (matId: number) => {
    setSelectedMaterialId(matId);
    presentDetailModal({ presentingElement: presentingElement });
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
          <IonTitle>Material</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar className="app-condense-toolbar">
            <IonTitle size="large">Material</IonTitle>
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

            {/* Material-Liste */}
            {materials.length === 0 ? (
              <EmptyState
                icon={documentOutline}
                title="Keine Materialien"
                message="Noch keine Materialien vorhanden."
                iconColor="#d97706"
              />
            ) : (
              <IonList inset={true} className="app-segment-wrapper">
                <IonListHeader>
                  <div className="app-section-icon" style={{ backgroundColor: 'rgba(217, 119, 6, 0.15)', color: '#d97706' }}>
                    <IonIcon icon={documentIcon} />
                  </div>
                  <IonLabel>Materialien ({materials.length})</IonLabel>
                </IonListHeader>
                <IonCard className="app-card">
                  <IonCardContent>
                    {materials.map((mat, index) => (
                      <IonItem
                        key={mat.id}
                        button
                        onClick={() => openDetail(mat.id)}
                        detail={false}
                        lines="none"
                        style={{
                          '--background': 'transparent',
                          '--padding-start': '0',
                          '--padding-end': '0',
                          '--inner-padding-end': '0',
                          '--inner-border-width': '0',
                          '--border-style': 'none',
                          '--min-height': 'auto',
                          marginBottom: index < materials.length - 1 ? '8px' : '0'
                        }}
                      >
                        <div
                          className="app-list-item"
                          style={{
                            width: '100%',
                            borderLeftColor: '#d97706',
                            position: 'relative',
                            overflow: 'hidden'
                          }}
                        >
                          {/* Corner Badges */}
                          {(mat.event_name || mat.jahrgang_name) && (
                            <div style={{
                              position: 'absolute',
                              top: '0',
                              right: '0',
                              display: 'flex',
                              flexDirection: 'row',
                              zIndex: 10
                            }}>
                              {mat.event_name && (
                                <div style={{
                                  backgroundColor: '#dc2626',
                                  color: 'white',
                                  fontSize: '0.65rem',
                                  fontWeight: '700',
                                  padding: '4px 8px',
                                  borderRadius: '0 0 0 8px'
                                }}>
                                  {mat.event_name.length > 15 ? mat.event_name.substring(0, 15) + '...' : mat.event_name}
                                </div>
                              )}
                              {mat.jahrgang_name && (
                                <>
                                  {mat.event_name && <div style={{ width: '2px', background: 'white' }} />}
                                  <div className="app-corner-badge" style={{ backgroundColor: '#5b21b6', position: 'static' }}>
                                    {mat.jahrgang_name}
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
                                    paddingRight: (mat.event_name || mat.jahrgang_name) ? '80px' : '0',
                                    paddingTop: (mat.event_name || mat.jahrgang_name) ? '4px' : '0'
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
                                  {mat.file_count !== undefined && mat.file_count > 0 && (
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
                    ))}
                  </IonCardContent>
                </IonCard>
              </IonList>
            )}
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default TeamerMaterialPage;
