import React, { useState, useEffect, useRef } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonIcon,
  IonSpinner,
  IonSelect,
  IonSelectOption,
  IonList,
  IonListHeader,
  IonCard,
  IonCardContent,
  IonChip,
  useIonAlert
} from '@ionic/react';
import {
  checkmarkOutline,
  closeOutline,
  trash,
  attachOutline,
  cloudUploadOutline,
  document as documentIcon,
  imageOutline,
  videocamOutline,
  musicalNotesOutline
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';

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

interface EventOption {
  id: number;
  name: string;
}

interface JahrgangOption {
  id: number;
  name: string;
}

interface Material {
  id: number;
  title: string;
  description?: string;
  event_id?: number;
  event_name?: string;
  jahrgang_id?: number;
  jahrgang_name?: string;
  tags?: MaterialTag[];
  files?: MaterialFile[];
  created_at: string;
}

interface MaterialFormModalProps {
  material?: Material | null;
  onClose: () => void;
  onSuccess: () => void;
  dismiss?: () => void;
}

const MaterialFormModal: React.FC<MaterialFormModalProps> = ({ material, onClose, onSuccess }) => {
  const { setError, setSuccess } = useApp();
  const [presentAlert] = useIonAlert();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(material?.title || '');
  const [description, setDescription] = useState(material?.description || '');
  const [eventId, setEventId] = useState<number | undefined>(material?.event_id);
  const [jahrgangId, setJahrgangId] = useState<number | undefined>(material?.jahrgang_id);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(
    material?.tags?.map(t => t.id) || []
  );
  const [existingFiles, setExistingFiles] = useState<MaterialFile[]>(material?.files || []);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const [events, setEvents] = useState<EventOption[]>([]);
  const [jahrgaenge, setJahrgaenge] = useState<JahrgangOption[]>([]);
  const [tags, setTags] = useState<MaterialTag[]>([]);

  useEffect(() => {
    loadOptions();
  }, []);

  const loadOptions = async () => {
    try {
      const [eventsRes, jahrgaengeRes, tagsRes] = await Promise.all([
        api.get('/events'),
        api.get('/admin/jahrgaenge'),
        api.get('/material/tags')
      ]);
      setEvents(eventsRes.data);
      setJahrgaenge(jahrgaengeRes.data);
      setTags(tagsRes.data);
    } catch {
      // Optionen laden fehlgeschlagen
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return imageOutline;
    if (mimeType.startsWith('video/')) return videocamOutline;
    if (mimeType.startsWith('audio/')) return musicalNotesOutline;
    return documentIcon;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const toggleTag = (tagId: number) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setNewFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
    // Input zurücksetzen
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeNewFile = (index: number) => {
    setNewFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDeleteExistingFile = (file: MaterialFile) => {
    presentAlert({
      header: 'Datei löschen',
      message: `"${file.original_name}" wirklich löschen?`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: async () => {
            try {
              await api.delete(`/material/files/${file.id}`);
              setExistingFiles(prev => prev.filter(f => f.id !== file.id));
              setSuccess('Datei gelöscht');
            } catch {
              setError('Fehler beim Löschen der Datei');
            }
          }
        }
      ]
    });
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Bitte einen Titel eingeben');
      return;
    }

    setSaving(true);
    try {
      let materialId = material?.id;

      const payload: any = {
        title: title.trim(),
        description: description.trim() || null,
        event_id: eventId || null,
        jahrgang_id: jahrgangId || null,
        tag_ids: selectedTagIds
      };

      if (material) {
        await api.put(`/material/${material.id}`, payload);
      } else {
        const res = await api.post('/material', payload);
        materialId = res.data.id;
      }

      // Neue Dateien hochladen
      if (newFiles.length > 0 && materialId) {
        const formData = new FormData();
        newFiles.forEach(file => {
          formData.append('files', file);
        });
        await api.post(`/material/${materialId}/files`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      setSuccess(material ? 'Material aktualisiert' : 'Material erstellt');
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={onClose}>
              <IonIcon icon={closeOutline} slot="icon-only" />
            </IonButton>
          </IonButtons>
          <IonTitle>{material ? 'Material bearbeiten' : 'Neues Material'}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={handleSave} disabled={saving}>
              {saving ? <IonSpinner name="crescent" /> : <IonIcon icon={checkmarkOutline} slot="icon-only" />}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        {/* Titel & Beschreibung */}
        <IonList inset={true} className="app-segment-wrapper">
          <IonListHeader>
            <IonLabel>Grunddaten</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent>
              <IonItem lines="full" style={{ '--background': 'transparent' }}>
                <IonInput
                  label="Titel"
                  labelPlacement="stacked"
                  value={title}
                  onIonInput={(e) => setTitle(e.detail.value || '')}
                  placeholder="Material-Titel"
                  required
                />
              </IonItem>
              <IonItem lines="none" style={{ '--background': 'transparent' }}>
                <IonTextarea
                  label="Beschreibung"
                  labelPlacement="stacked"
                  value={description}
                  onIonInput={(e) => setDescription(e.detail.value || '')}
                  placeholder="Optionale Beschreibung..."
                  autoGrow={true}
                  rows={3}
                />
              </IonItem>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Event & Jahrgang */}
        <IonList inset={true} className="app-segment-wrapper">
          <IonListHeader>
            <IonLabel>Zuordnung</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent>
              <IonItem lines="full" style={{ '--background': 'transparent' }}>
                <IonSelect
                  label="Event"
                  labelPlacement="stacked"
                  value={eventId || 0}
                  onIonChange={(e) => setEventId(e.detail.value === 0 ? undefined : e.detail.value)}
                  placeholder="Kein Event"
                  interface="alert"
                >
                  <IonSelectOption value={0}>Kein Event</IonSelectOption>
                  {events.map(ev => (
                    <IonSelectOption key={ev.id} value={ev.id}>
                      {ev.name} ({new Date((ev as any).event_date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })})
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
              <IonItem lines="none" style={{ '--background': 'transparent' }}>
                <IonSelect
                  label="Jahrgang"
                  labelPlacement="stacked"
                  value={jahrgangId || 0}
                  onIonChange={(e) => setJahrgangId(e.detail.value === 0 ? undefined : e.detail.value)}
                  placeholder="Kein Jahrgang"
                  interface="alert"
                >
                  <IonSelectOption value={0}>Kein Jahrgang</IonSelectOption>
                  {jahrgaenge.map(jg => (
                    <IonSelectOption key={jg.id} value={jg.id}>{jg.name}</IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Tags */}
        {tags.length > 0 && (
          <IonList inset={true} className="app-segment-wrapper">
            <IonListHeader>
              <IonLabel>Tags</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {tags.map(tag => (
                    <IonChip
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      style={{
                        backgroundColor: selectedTagIds.includes(tag.id) ? '#d97706' : 'transparent',
                        color: selectedTagIds.includes(tag.id) ? 'white' : '#d97706',
                        border: `1px solid #d97706`
                      }}
                    >
                      <IonLabel>{tag.name}</IonLabel>
                    </IonChip>
                  ))}
                </div>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* Bestehende Dateien */}
        {existingFiles.length > 0 && (
          <IonList inset={true} className="app-segment-wrapper">
            <IonListHeader>
              <IonLabel>Vorhandene Dateien</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent>
                {existingFiles.map(file => (
                  <div
                    key={file.id}
                    className="app-list-item"
                    style={{ borderLeftColor: '#d97706' }}
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
                      <IonButton
                        fill="clear"
                        color="danger"
                        onClick={() => handleDeleteExistingFile(file)}
                      >
                        <IonIcon icon={trash} slot="icon-only" />
                      </IonButton>
                    </div>
                  </div>
                ))}
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* Neue Dateien */}
        <IonList inset={true} className="app-segment-wrapper">
          <IonListHeader>
            <IonLabel>Dateien hinzufügen</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent>
              {newFiles.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  {newFiles.map((file, index) => (
                    <div
                      key={index}
                      className="app-list-item"
                      style={{ borderLeftColor: '#d97706' }}
                    >
                      <div className="app-list-item__row">
                        <div className="app-list-item__main">
                          <div className="app-icon-circle" style={{ backgroundColor: '#d97706' }}>
                            <IonIcon icon={attachOutline} />
                          </div>
                          <div className="app-list-item__content">
                            <div className="app-list-item__title">{file.name}</div>
                            <div className="app-list-item__meta">
                              <span className="app-list-item__meta-item">
                                {formatFileSize(file.size)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <IonButton
                          fill="clear"
                          color="danger"
                          onClick={() => removeNewFile(index)}
                        >
                          <IonIcon icon={trash} slot="icon-only" />
                        </IonButton>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,application/pdf,video/*,audio/*,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
              <IonButton
                expand="block"
                fill="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <IonIcon icon={cloudUploadOutline} slot="start" />
                Dateien auswählen
              </IonButton>
            </IonCardContent>
          </IonCard>
        </IonList>

        <div className="ion-padding-bottom" />
      </IonContent>
    </IonPage>
  );
};

export default MaterialFormModal;
