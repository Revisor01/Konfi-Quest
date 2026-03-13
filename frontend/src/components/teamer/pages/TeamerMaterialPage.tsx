import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  IonItemGroup,
  IonButtons,
  IonButton,
  useIonModal
} from '@ionic/react';
import {
  document as documentIcon,
  documentOutline,
  imageOutline,
  videocamOutline,
  musicalNotesOutline,
  attachOutline,
  calendar,
  filter,
  arrowBack,
  people,
  person,
  time,
  informationCircle,
  textOutline,
  create
} from 'ionicons/icons';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileViewer } from '@capacitor/file-viewer';
import { FileOpener } from '@capacitor-community/file-opener';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import api from '../../../services/api';
import { SectionHeader } from '../../shared';
import EmptyState from '../../shared/EmptyState';
import LoadingSpinner from '../../common/LoadingSpinner';
import FileViewerModal from '../../chat/modals/FileViewerModal';

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

interface MaterialFile {
  id: number;
  original_name: string;
  stored_name: string;
  mime_type: string;
  file_size: number;
  created_at: string;
}

interface MaterialDetail {
  id: number;
  title: string;
  description?: string;
  event_id?: number;
  event_name?: string;
  jahrgang_id?: number;
  jahrgang_name?: string;
  admin_name?: string;
  files?: MaterialFile[];
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
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // FileViewer Modal (In-App Dateivorschau mit Backdrop)
  const viewerDataRef = useRef({ blobUrl: '', fileName: '', mimeType: '' });
  const [presentFileViewer, dismissFileViewer] = useIonModal(FileViewerModal, {
    get blobUrl() { return viewerDataRef.current.blobUrl; },
    get fileName() { return viewerDataRef.current.fileName; },
    get mimeType() { return viewerDataRef.current.mimeType; },
    onClose: () => {
      dismissFileViewer();
      if (viewerDataRef.current.blobUrl) {
        URL.revokeObjectURL(viewerDataRef.current.blobUrl);
        viewerDataRef.current = { blobUrl: '', fileName: '', mimeType: '' };
      }
    }
  });

  const openInAppViewer = useCallback((blob: Blob, fileName: string, mimeType: string) => {
    const url = URL.createObjectURL(new Blob([blob], { type: mimeType }));
    viewerDataRef.current = { blobUrl: url, fileName, mimeType };
    presentFileViewer();
  }, [presentFileViewer]);

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

  // Detail oeffnen - API laden und inline anzeigen
  const openDetail = async (matId: number) => {
    try {
      setDetailLoading(true);
      const res = await api.get(`/material/${matId}`);
      setSelectedMaterial(res.data);
    } catch {
      setError('Fehler beim Laden des Materials');
    } finally {
      setDetailLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatDateLong = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  // File-Handling Funktionen
  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return imageOutline;
    if (mimeType.startsWith('video/')) return videocamOutline;
    if (mimeType.startsWith('audio/')) return musicalNotesOutline;
    return documentOutline;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const openFile = async (file: MaterialFile) => {
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
      const response = await api.get(`/material/files/${file.stored_name}`, {
        responseType: 'blob'
      });
      const blob = response.data;
      const base64Data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(blob);
      });

      const ext = file.original_name.split('.').pop() || '';
      const tempPath = `temp/material_${file.id}.${ext}`;

      try {
        await Filesystem.mkdir({ path: 'temp', directory: Directory.Documents, recursive: true });
      } catch { /* existiert bereits */ }

      await Filesystem.writeFile({
        path: tempPath,
        data: base64Data,
        directory: Directory.Documents,
        recursive: true
      });

      const fileUri = await Filesystem.getUri({ directory: Directory.Documents, path: tempPath });

      if (file.mime_type.startsWith('image/')) {
        await FileOpener.open({ filePath: fileUri.uri, contentType: file.mime_type });
      } else {
        await FileViewer.openDocumentFromLocalPath({ path: fileUri.uri });
      }
    } catch (err) {
      console.warn('Native file viewer failed, using in-app fallback:', err);
      try {
        const response = await api.get(`/material/files/${file.stored_name}`, { responseType: 'blob' });
        openInAppViewer(response.data, file.original_name, file.mime_type);
      } catch {
        setError('Fehler beim Öffnen der Datei');
      }
    }
  };

  // === INLINE DETAIL VIEW ===
  if (selectedMaterial) {
    return (
      <IonPage>
        <IonHeader translucent={true}>
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton onClick={() => setSelectedMaterial(null)}>
                <IonIcon icon={arrowBack} slot="icon-only" />
              </IonButton>
            </IonButtons>
            <IonTitle>{selectedMaterial.title}</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonContent className="app-gradient-background" fullscreen>
          <IonHeader collapse="condense">
            <IonToolbar className="app-condense-toolbar">
              <IonTitle size="large">{selectedMaterial.title}</IonTitle>
            </IonToolbar>
          </IonHeader>

          <IonRefresher slot="fixed" onIonRefresh={async (e) => {
            try {
              const res = await api.get(`/material/${selectedMaterial.id}`);
              setSelectedMaterial(res.data);
            } catch { /* ignore */ }
            e.detail.complete();
          }}>
            <IonRefresherContent />
          </IonRefresher>

          {/* SectionHeader */}
          <SectionHeader
            title={selectedMaterial.title}
            subtitle="Material"
            icon={documentIcon}
            colors={{ primary: '#d97706', secondary: '#b45309' }}
            stats={[{ value: selectedMaterial.files?.length || 0, label: 'Dateien' }]}
          />

          {/* Beschreibung */}
          {selectedMaterial.description && (
            <IonList inset={true} className="app-segment-wrapper">
              <IonListHeader>
                <div className="app-section-icon app-section-icon--material">
                  <IonIcon icon={textOutline} />
                </div>
                <IonLabel>Beschreibung</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent>
                  <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5', color: '#374151', margin: 0 }}>
                    {selectedMaterial.description}
                  </p>
                </IonCardContent>
              </IonCard>
            </IonList>
          )}

          {/* Details */}
          <IonList inset={true} className="app-segment-wrapper">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--material">
                <IonIcon icon={informationCircle} />
              </div>
              <IonLabel>Details</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent>
                {selectedMaterial.event_name && (
                  <div className="app-info-row">
                    <IonIcon icon={calendar} className="app-info-row__icon" style={{ color: '#dc2626' }} />
                    <div className="app-info-row__content">
                      Event: {selectedMaterial.event_name}
                    </div>
                  </div>
                )}
                {selectedMaterial.jahrgang_name && (
                  <div className="app-info-row">
                    <IonIcon icon={people} className="app-info-row__icon" style={{ color: '#5b21b6' }} />
                    <div className="app-info-row__content">
                      Jahrgang: {selectedMaterial.jahrgang_name}
                    </div>
                  </div>
                )}
                <div className="app-info-row">
                  <IonIcon icon={create} className="app-info-row__icon" style={{ color: '#6c757d' }} />
                  <div className="app-info-row__content">
                    Erstellt am {formatDateLong(selectedMaterial.created_at)}
                  </div>
                </div>
                {selectedMaterial.admin_name && (
                  <div className="app-info-row">
                    <IonIcon icon={person} className="app-info-row__icon" style={{ color: '#6c757d' }} />
                    <div className="app-info-row__content">
                      Von {selectedMaterial.admin_name}
                    </div>
                  </div>
                )}
              </IonCardContent>
            </IonCard>
          </IonList>

          {/* Dateien */}
          <IonList inset={true} className="app-segment-wrapper">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--material">
                <IonIcon icon={documentIcon} />
              </div>
              <IonLabel>Dateien ({selectedMaterial.files?.length || 0})</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent>
                {(!selectedMaterial.files || selectedMaterial.files.length === 0) ? (
                  <EmptyState
                    icon={documentOutline}
                    title="Keine Dateien"
                    message="Dieses Material hat keine angehängten Dateien."
                    iconColor="#d97706"
                  />
                ) : (
                  selectedMaterial.files.map((file, index) => (
                    <div
                      key={file.id}
                      className="app-list-item"
                      style={{
                        borderLeftColor: '#d97706',
                        cursor: 'pointer',
                        marginBottom: index < (selectedMaterial.files?.length || 0) - 1 ? '8px' : '0'
                      }}
                      onClick={() => openFile(file)}
                    >
                      <div className="app-list-item__row">
                        <div className="app-list-item__main">
                          <div className="app-icon-circle" style={{ backgroundColor: '#d97706' }}>
                            <IonIcon icon={getFileIcon(file.mime_type)} />
                          </div>
                          <div className="app-list-item__content">
                            <div className="app-list-item__title">{file.original_name}</div>
                            <div className="app-list-item__meta">
                              <span className="app-list-item__meta-item">
                                {formatFileSize(file.file_size)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </IonCardContent>
            </IonCard>
          </IonList>

          <div className="ion-padding-bottom" />
        </IonContent>
      </IonPage>
    );
  }

  // === MATERIAL LIST VIEW ===
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

        {loading || detailLoading ? (
          <LoadingSpinner message={detailLoading ? 'Material wird geladen...' : 'Materialien werden geladen...'} />
        ) : (
          <>
            <SectionHeader
              title="Material"
              subtitle="Dokumente und Dateien"
              icon={documentIcon}
              colors={{ primary: '#d97706', secondary: '#b45309' }}
              stats={[
                { value: materials.length, label: 'Material' },
                { value: materials.reduce((sum, m) => sum + (m.file_count || 0), 0), label: 'Dateien' }
              ]}
            />

            {/* Suche & Filter */}
            <IonList inset={true} style={{ margin: '0 16px 16px' }}>
              <IonListHeader>
                <div className="app-section-icon app-section-icon--material">
                  <IonIcon icon={filter} />
                </div>
                <IonLabel>Suche & Filter</IonLabel>
              </IonListHeader>
              <IonItemGroup>
                <IonSearchbar
                  value={search}
                  onIonInput={(e) => setSearch(e.detail.value || '')}
                  placeholder="Material durchsuchen..."
                  debounce={300}
                  style={{ width: '100%' }}
                />
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
              </IonItemGroup>
            </IonList>

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
                  <div className="app-section-icon app-section-icon--material">
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
                          {/* Corner Badge - nur Event */}
                          {mat.event_name && (
                            <div style={{
                              position: 'absolute',
                              top: '0',
                              right: '0',
                              display: 'flex',
                              flexDirection: 'row',
                              zIndex: 10
                            }}>
                              <div className="app-corner-badge" style={{ backgroundColor: '#dc2626', whiteSpace: 'nowrap' }}>
                                {mat.event_name.length > 20 ? mat.event_name.substring(0, 20) + '...' : mat.event_name}
                              </div>
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
                                    paddingRight: mat.event_name ? '80px' : '0',
                                    paddingTop: mat.event_name ? '4px' : '0'
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
                                    <IonIcon icon={calendar} style={{ color: '#dc2626' }} />
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
