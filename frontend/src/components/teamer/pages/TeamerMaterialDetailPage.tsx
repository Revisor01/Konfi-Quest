import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonIcon,
  IonLabel,
  IonList,
  IonListHeader,
  IonCard,
  IonCardContent,
  IonRefresher,
  IonRefresherContent,
  useIonModal
} from '@ionic/react';
import {
  document as documentIcon,
  imageOutline,
  videocamOutline,
  musicalNotesOutline,
  documentOutline,
  calendar,
  people,
  person,
  time,
  closeOutline,
  informationCircle,
  textOutline,
  create
} from 'ionicons/icons';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileViewer } from '@capacitor/file-viewer';
import { FileOpener } from '@capacitor-community/file-opener';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';
import LoadingSpinner from '../../common/LoadingSpinner';
import EmptyState from '../../shared/EmptyState';
import { SectionHeader } from '../../shared';
import FileViewerModal from '../../chat/modals/FileViewerModal';

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

interface TeamerMaterialDetailProps {
  materialId: number;
  onClose: () => void;
}

const TeamerMaterialDetailPage: React.FC<TeamerMaterialDetailProps> = ({ materialId, onClose }) => {
  const { setError } = useApp();

  const [material, setMaterial] = useState<MaterialDetail | null>(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    loadMaterial();
  }, [materialId]);

  const loadMaterial = async () => {
    try {
      const res = await api.get(`/material/${materialId}`);
      setMaterial(res.data);
    } catch {
      setError('Fehler beim Laden des Materials');
    } finally {
      setLoading(false);
    }
  };

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
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

  return (
    <IonPage>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={onClose}>
              <IonIcon icon={closeOutline} slot="icon-only" />
            </IonButton>
          </IonButtons>
          <IonTitle>{material?.title || 'Material'}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar className="app-condense-toolbar">
            <IonTitle size="large">{material?.title || 'Material'}</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonRefresher slot="fixed" onIonRefresh={async (e) => {
          await loadMaterial();
          e.detail.complete();
        }}>
          <IonRefresherContent />
        </IonRefresher>

        {loading ? (
          <LoadingSpinner message="Material wird geladen..." />
        ) : !material ? (
          <EmptyState
            icon={documentIcon}
            title="Nicht gefunden"
            message="Das Material konnte nicht geladen werden."
          />
        ) : (
          <>
            {/* Beschreibung */}
            {material.description && (
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
                      {material.description}
                    </p>
                  </IonCardContent>
                </IonCard>
              </IonList>
            )}

            {/* Info */}
            <IonList inset={true} className="app-segment-wrapper">
              <IonListHeader>
                <div className="app-section-icon app-section-icon--material">
                  <IonIcon icon={informationCircle} />
                </div>
                <IonLabel>Details</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent>
                  {material.event_name && (
                    <div className="app-info-row">
                      <IonIcon icon={calendar} className="app-info-row__icon" style={{ color: '#dc2626' }} />
                      <div className="app-info-row__content">
                        Event: {material.event_name}
                      </div>
                    </div>
                  )}
                  {material.jahrgang_name && (
                    <div className="app-info-row">
                      <IonIcon icon={people} className="app-info-row__icon" style={{ color: '#5b21b6' }} />
                      <div className="app-info-row__content">
                        Jahrgang: {material.jahrgang_name}
                      </div>
                    </div>
                  )}
                  <div className="app-info-row">
                    <IonIcon icon={create} className="app-info-row__icon" style={{ color: '#6c757d' }} />
                    <div className="app-info-row__content">
                      Erstellt am {formatDate(material.created_at)}
                    </div>
                  </div>
                  {material.admin_name && (
                    <div className="app-info-row">
                      <IonIcon icon={person} className="app-info-row__icon" style={{ color: '#6c757d' }} />
                      <div className="app-info-row__content">
                        Von {material.admin_name}
                      </div>
                    </div>
                  )}
                </IonCardContent>
              </IonCard>
            </IonList>

            {/* Dateien */}
            <SectionHeader
              title={material.title}
              subtitle="Dateien"
              icon={documentIcon}
              colors={{ primary: '#d97706', secondary: '#b45309' }}
              stats={[{ value: material.files?.length || 0, label: 'Dateien' }]}
            />
            <IonList inset={true} className="app-segment-wrapper">
              <IonCard className="app-card">
                <IonCardContent>
                  {(!material.files || material.files.length === 0) ? (
                    <EmptyState
                      icon={documentOutline}
                      title="Keine Dateien"
                      message="Dieses Material hat keine angehängten Dateien."
                      iconColor="#d97706"
                    />
                  ) : (
                    material.files.map((file, index) => (
                      <div
                        key={file.id}
                        className="app-list-item"
                        style={{
                          borderLeftColor: '#d97706',
                          cursor: 'pointer',
                          marginBottom: index < (material.files?.length || 0) - 1 ? '8px' : '0'
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
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default TeamerMaterialDetailPage;
