import React, { useState, useEffect } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonIcon,
  IonChip,
  IonLabel,
  IonList,
  IonListHeader,
  IonCard,
  IonCardContent,
  IonItem,
  IonRefresher,
  IonRefresherContent
} from '@ionic/react';
import {
  document as documentIcon,
  imageOutline,
  videocamOutline,
  musicalNotesOutline,
  documentOutline,
  downloadOutline,
  calendarOutline,
  personOutline
} from 'ionicons/icons';
import { useParams } from 'react-router-dom';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';
import LoadingSpinner from '../../common/LoadingSpinner';
import EmptyState from '../../shared/EmptyState';

interface MaterialFile {
  id: number;
  original_name: string;
  stored_name: string;
  mime_type: string;
  file_size: number;
  created_at: string;
}

interface MaterialTag {
  id: number;
  name: string;
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
  tags?: MaterialTag[];
  files?: MaterialFile[];
  created_at: string;
}

const TeamerMaterialDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { setError } = useApp();

  const [material, setMaterial] = useState<MaterialDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMaterial();
  }, [id]);

  const loadMaterial = async () => {
    try {
      const res = await api.get(`/material/${id}`);
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

  const handleDownload = async (file: MaterialFile) => {
    try {
      const res = await api.get(`/material/files/${file.stored_name}`, {
        responseType: 'blob'
      });
      const url = URL.createObjectURL(res.data);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = file.original_name;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError('Fehler beim Herunterladen der Datei');
    }
  };

  return (
    <IonPage>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/teamer/material" />
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
            {/* Tags */}
            {material.tags && material.tags.length > 0 && (
              <div style={{ padding: '8px 16px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {material.tags.map(tag => (
                  <IonChip
                    key={tag.id}
                    style={{
                      backgroundColor: '#d97706',
                      color: 'white'
                    }}
                  >
                    <IonLabel>{tag.name}</IonLabel>
                  </IonChip>
                ))}
              </div>
            )}

            {/* Beschreibung */}
            {material.description && (
              <IonList inset={true} className="app-segment-wrapper">
                <IonListHeader>
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
                <IonLabel>Informationen</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent>
                  {material.event_name && (
                    <div className="app-info-row">
                      <IonIcon icon={calendarOutline} className="app-info-row__icon" style={{ color: '#dc2626' }} />
                      <div className="app-info-row__content">
                        Event: {material.event_name}
                      </div>
                    </div>
                  )}
                  {material.jahrgang_name && (
                    <div className="app-info-row">
                      <IonIcon icon={personOutline} className="app-info-row__icon" style={{ color: '#5b21b6' }} />
                      <div className="app-info-row__content">
                        Jahrgang: {material.jahrgang_name}
                      </div>
                    </div>
                  )}
                  <div className="app-info-row">
                    <IonIcon icon={calendarOutline} className="app-info-row__icon" style={{ color: '#6c757d' }} />
                    <div className="app-info-row__content">
                      Erstellt am {formatDate(material.created_at)}
                    </div>
                  </div>
                  {material.admin_name && (
                    <div className="app-info-row">
                      <IonIcon icon={personOutline} className="app-info-row__icon" style={{ color: '#6c757d' }} />
                      <div className="app-info-row__content">
                        Von {material.admin_name}
                      </div>
                    </div>
                  )}
                </IonCardContent>
              </IonCard>
            </IonList>

            {/* Dateien */}
            <IonList inset={true} className="app-segment-wrapper">
              <IonListHeader>
                <div className="app-section-icon" style={{ backgroundColor: 'rgba(217, 119, 6, 0.15)', color: '#d97706' }}>
                  <IonIcon icon={documentIcon} />
                </div>
                <IonLabel>Dateien ({material.files?.length || 0})</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent>
                  {(!material.files || material.files.length === 0) ? (
                    <EmptyState
                      icon={documentIcon}
                      title="Keine Dateien"
                      message="Dieses Material hat keine angehaengten Dateien."
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
                        onClick={() => handleDownload(file)}
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
                                <span className="app-list-item__meta-item">
                                  <IonIcon icon={downloadOutline} style={{ color: '#d97706' }} />
                                  Herunterladen
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
