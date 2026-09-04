import { fehlerText } from '../../../utils/fehler';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonItem,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonLabel,
  IonInput,
  IonTextarea,
  IonIcon,
  IonSpinner,
  IonList,
  IonListHeader,
  IonCard,
  IonCardContent,
  IonAccordion,
  IonAccordionGroup,
  useIonAlert,
  useIonModal
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
  musicalNotesOutline,
  linkOutline,
  addOutline,
  chevronDownOutline
} from 'ionicons/icons';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileViewer } from '@capacitor/file-viewer';
import { FileOpener } from '@capacitor-community/file-opener';
import { useApp } from '../../../contexts/AppContext';
import { useActionGuard } from '../../../hooks/useActionGuard';
import api from '../../../services/api';
import { writeQueue } from '../../../services/writeQueue';
import { networkMonitor } from '../../../services/networkMonitor';
import FileViewerModal from '../../shared/FileViewerModal';
import { safeUUID } from '../../../utils/uuid';
import { closeOpenSlidingItems } from '../../../utils/slidingItems';
import { istWebLink } from '../../../utils/linkDisplay';

interface MaterialFile {
  id: number;
  original_name: string;
  stored_name: string;
  mime_type: string;
  file_size: number;
  created_at: string;
}

interface EventOption {
  id: number;
  name: string;
  event_date?: string;
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
  events?: { id: number; name: string }[];
  jahrgang_id?: number;
  jahrgang_name?: string;
  jahrgaenge?: { id: number; name: string }[];
  files?: MaterialFile[];
  link_url?: string | null;
  // Mehrere Links (seit 01.09.2026, Tabelle material_links). link_url bleibt
  // als Alt-Feld der Spiegel des ersten Links.
  links?: { id: number; url: string; created_at?: string }[];
  ist_global?: boolean;
  created_by?: number | null;
  created_by_name?: string | null;
  created_at: string;
}

interface MaterialFormModalProps {
  material?: Material | null;
  // Schreibschutz (Entscheidung Simon, 01.09.2026): Bearbeiten kann nur die
  // erstellende Person oder die Leitung. Wer es nicht darf, sieht das
  // Material hier trotzdem -- ohne Speichern-Knopf, ohne Datei-Loeschen,
  // ohne Upload. Die verbindliche Pruefung macht der Server (403).
  nurLesen?: boolean;
  onClose: () => void;
  onSuccess: () => void;
  dismiss?: () => void;
}

const MaterialFormModal: React.FC<MaterialFormModalProps> = ({ material, nurLesen = false, onClose, onSuccess }) => {
  const { setError, setSuccess } = useApp();
  const [presentAlert] = useIonAlert();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pageRef = useRef<HTMLElement>(null);

  const [title, setTitle] = useState(material?.title || '');
  const [description, setDescription] = useState(material?.description || '');
  const [eventIds, setEventIds] = useState<number[]>(
    material?.events?.map(e => e.id) || (material?.event_id ? [material.event_id] : [])
  );
  const [jahrgangIds, setJahrgangIds] = useState<number[]>(
    material?.jahrgaenge?.map(j => j.id) || (material?.jahrgang_id ? [material.jahrgang_id] : [])
  );
  const [existingFiles, setExistingFiles] = useState<MaterialFile[]>(material?.files || []);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  // MEHRERE LINKS UND DATEIEN PARALLEL (Entscheidung Simon, 01.09.2026):
  // Das Entweder-Oder vom 31.08. ist weg, beide Bereiche sind immer
  // sichtbar und beide optional. Ein gecachter Eintrag von vorher traegt
  // nur link_url (Spiegel des ersten Links) -- dann startet die Liste mit
  // diesem einen Link.
  //
  // Der Sichtbarkeits-Umschalter vom 31.08. ist ebenfalls weg (Simon,
  // 01.09.2026: "wenn kein Jahrgang dann global. Fertig. Sonst nur
  // Jahrgang."). ist_global wird nicht mehr mitgeschickt; der Server
  // leitet es aus der Jahrgangs-Zuordnung ab.
  const [linkUrls, setLinkUrls] = useState<string[]>(
    material?.links?.map(l => l.url)
    ?? (material?.link_url ? [material.link_url] : [])
  );
  const { isSubmitting, guard } = useActionGuard();

  const [events, setEvents] = useState<EventOption[]>([]);
  const [jahrgaenge, setJahrgaenge] = useState<JahrgangOption[]>([]);

  // FileViewer Modal (In-App Dateivorschau)
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
    loadOptions();
  }, []);

  const loadOptions = async () => {
    try {
      const [eventsRes, jahrgaengeRes] = await Promise.all([
        api.get('/events'),
        api.get('/admin/jahrgaenge')
      ]);
      setEvents(eventsRes.data);
      setJahrgaenge(jahrgaengeRes.data);
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Die Dateiliste SOFORT auslesen, bevor der Input geleert wird
    // (Simons Befund 04.09.2026: "es passiert gar nichts", im Netz-Mitschnitt
    // fehlte der POST auf /material/:id/files).
    //
    // Vorher stand Array.from(e.target.files) INNERHALB des
    // setNewFiles(prev => ...)-Updaters. React ruft diesen Updater verzoegert
    // auf -- zu diesem Zeitpunkt hatte die Zeile darunter den Input laengst
    // geleert, und die Datei kam nie im State an. Gemessen: files.length
    // 1 -> 1 -> 0 ueber das change-Event hinweg.
    //
    // Das Leeren selbst bleibt noetig, damit dieselbe Datei ein zweites Mal
    // gewaehlt werden kann (ohne Wertwechsel feuert change nicht).
    const gewaehlt = e.target.files ? Array.from(e.target.files) : [];
    if (gewaehlt.length > 0) {
      setNewFiles(prev => [...prev, ...gewaehlt]);
    }
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
            } catch {
              setError('Fehler beim Löschen der Datei');
            }
          }
        }
      ]
    });
  };

  const handleSave = async () => {
    // Doppelter Boden zum ausgeblendeten Speichern-Knopf -- der Server
    // wuerde ohnehin mit 403 antworten (Ersteller-Regel, 01.09.2026).
    if (nurLesen) return;
    if (!title.trim()) {
      setError('Bitte einen Titel eingeben');
      return;
    }

    // Vorab-Pruefung im Formular, damit der Fehler ohne Netz sichtbar wird.
    // Die verbindliche Pruefung macht der Server (routes/material.js).
    // Leere Eingabefelder fallen still heraus, sie sind kein Fehler.
    const bereinigt = linkUrls.map(l => l.trim()).filter(l => l !== '');
    if (bereinigt.some(l => !istWebLink(l))) {
      setError('Der Link muss mit http:// oder https:// beginnen');
      return;
    }

    await guard(async () => {
      try {
        const payload = {
          title: title.trim(),
          description: description.trim() || null,
          event_ids: eventIds,
          jahrgang_ids: jahrgangIds,
          // Mehrere Links (01.09.2026). Das Alt-Feld link_url pflegt der
          // Server als Spiegel des ersten Links selbst.
          //
          // ist_global wird bewusst NICHT mehr mitgeschickt: Der Server
          // leitet die Sichtbarkeit aus der Jahrgangs-Zuordnung ab (keine
          // Jahrgaenge -> fuer alle Teamer:innen).
          link_urls: bereinigt
        };

        if (networkMonitor.isOnline) {
          // Online-Pfad: direkt senden
          let materialId = material?.id;

          if (material) {
            await api.put(`/material/${material.id}`, payload);
          } else {
            const res = await api.post('/material', payload);
            materialId = res.data.id;
          }

          // Neue Dateien hochladen -- unabhaengig von den Links, beides
          // ist parallel erlaubt (01.09.2026).
          if (newFiles.length > 0 && materialId) {
            const formData = new FormData();
            newFiles.forEach(file => {
              formData.append('files', file);
            });
            await api.post(`/material/${materialId}/files`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
            });
          }

        } else {
          // Offline-Pfad: Nur Metadaten queuen (Dateien nur online)
          await writeQueue.enqueue({
            method: material ? 'PUT' : 'POST',
            url: material ? `/material/${material.id}` : '/material',
            body: payload,
            maxRetries: 5,
            hasFileUpload: false,
            metadata: { type: 'admin', clientId: safeUUID(), label: material ? 'Material bearbeiten' : 'Material erstellen' },
          });

          if (newFiles.length > 0) {
            setSuccess('Material-Metadaten werden offline gespeichert. Dateien kannst du hochladen sobald du wieder online bist');
          } else {
            setSuccess('Material wird gespeichert sobald du wieder online bist');
          }
        }

        onSuccess();
      } catch (err) {
        setError(fehlerText(err, 'Fehler beim Speichern'));
      }
    });
  };

  return (
    <IonPage ref={pageRef}>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={onClose} aria-label="Schließen">
              <IonIcon icon={closeOutline} slot="icon-only" />
            </IonButton>
          </IonButtons>
          <IonTitle>{nurLesen ? 'Material ansehen' : material ? 'Material bearbeiten' : 'Neues Material'}</IonTitle>
          {/* Ohne Bearbeitungsrecht gibt es keinen Speichern-Knopf -- ein
              Knopf, der mit 403 endet, waere schlechter als keiner. */}
          {!nurLesen && (
            <IonButtons slot="end">
              <IonButton onClick={handleSave} disabled={isSubmitting} aria-label="Material speichern">
                {isSubmitting ? <IonSpinner name="crescent" /> : <IonIcon icon={checkmarkOutline} slot="icon-only" />}
              </IonButton>
            </IonButtons>
          )}
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        {/* Hinweis im Lese-Modus: WER bearbeiten darf, statt es nur stumm zu
            sperren. created_by_name kann fehlen (Konto geloescht). */}
        {nurLesen && (
          <IonList inset={true} className="app-segment-wrapper">
            <IonCard className="app-card">
              <IonCardContent>
                <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: 0 }}>
                  {material?.created_by_name
                    ? `Angelegt von ${material.created_by_name}. Bearbeiten und löschen kann nur diese Person oder die Gemeindeleitung.`
                    : 'Das Konto der erstellenden Person wurde gelöscht. Bearbeiten und löschen kann nur noch die Gemeindeleitung.'}
                </p>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* Titel & Beschreibung */}
        <IonList inset={true} className="app-segment-wrapper">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--material">
              <IonIcon icon={documentIcon} />
            </div>
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
                  readonly={nurLesen}
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
                  readonly={nurLesen}
                />
              </IonItem>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Der Sichtbarkeits-Umschalter vom 31.08. stand hier -- weg seit
            dem 01.09.2026 (Simon: "Sichtbarkeit ist auch ueberfluessig.
            Denn: wenn kein Jahrgang dann global. Fertig. Sonst nur
            Jahrgang."). Er verdoppelte nur die Jahrgangs-Zuordnung; die
            Sichtbarkeit steht jetzt direkt am Jahrgangs-Abschnitt und der
            Server leitet ist_global daraus ab. */}

        {/* Events zuordnen */}
        <IonList inset={true} className="app-segment-wrapper">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--material">
              <IonIcon icon={documentIcon} />
            </div>
            <IonLabel>Zuordnung</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: '0' }}>
              <IonAccordionGroup>
                <IonAccordion value="events" toggleIcon={chevronDownOutline} toggleIconSlot="end">
                  <IonItem slot="header" lines="none" style={{ '--padding-start': '16px' }}>
                    <IonLabel>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: '600', color: '#374151', margin: '0 0 2px 0' }}>
                        Events
                      </h3>
                      <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '0', fontWeight: '400' }}>
                        {eventIds.length > 0
                          ? `${eventIds.length} ${eventIds.length === 1 ? 'Event' : 'Events'} ausgewählt`
                          : 'Keine Events zugeordnet'}
                      </p>
                    </IonLabel>
                  </IonItem>
                  <div slot="content" style={{ padding: '4px 16px 12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {events
                        .filter(ev => new Date(ev.event_date || '') >= new Date(new Date().toDateString()) || eventIds.includes(ev.id))
                        .map(ev => {
                          const isSelected = eventIds.includes(ev.id);
                          return (
                            <div
                              key={ev.id}
                              className="app-list-item"
                              onClick={() => {
                                if (nurLesen) return;
                                if (isSelected) {
                                  setEventIds(eventIds.filter(id => id !== ev.id));
                                } else {
                                  setEventIds([...eventIds, ev.id]);
                                }
                              }}
                              style={{
                                cursor: 'pointer',
                                marginBottom: '0',
                                borderLeftColor: isSelected ? '#d97706' : '#e5e7eb',
                                backgroundColor: isSelected ? 'rgba(217, 119, 6, 0.08)' : undefined
                              }}
                            >
                              <div className="app-list-item__row">
                                <div className="app-list-item__main">
                                  <div className="app-list-item__content">
                                    <div className="app-list-item__title">{ev.name}</div>
                                    {ev.event_date && (
                                      <div className="app-list-item__subtitle">
                                        {new Date(ev.event_date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </IonAccordion>

                <IonAccordion value="jahrgaenge" toggleIcon={chevronDownOutline} toggleIconSlot="end">
                  <IonItem slot="header" lines="none" style={{ '--padding-start': '16px' }}>
                    <IonLabel>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: '600', color: '#374151', margin: '0 0 2px 0' }}>
                        Jahrgänge
                      </h3>
                      <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '0', fontWeight: '400' }}>
                        {jahrgangIds.length > 0
                          ? `Nur Teamer:innen ${jahrgangIds.length === 1 ? 'dieses Jahrgangs' : 'dieser Jahrgänge'} sehen das Material`
                          : 'Ohne Zuordnung sehen alle Teamer:innen das Material'}
                      </p>
                    </IonLabel>
                  </IonItem>
                  <div slot="content" style={{ padding: '4px 16px 12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {jahrgaenge.map(jg => {
                        const isSelected = jahrgangIds.includes(jg.id);
                        return (
                          <div
                            key={jg.id}
                            className="app-list-item"
                            onClick={() => {
                              if (nurLesen) return;
                              if (isSelected) {
                                setJahrgangIds(jahrgangIds.filter(id => id !== jg.id));
                              } else {
                                setJahrgangIds([...jahrgangIds, jg.id]);
                              }
                            }}
                            style={{
                              cursor: 'pointer',
                              marginBottom: '0',
                              borderLeftColor: isSelected ? '#d97706' : '#e5e7eb',
                              backgroundColor: isSelected ? 'rgba(217, 119, 6, 0.08)' : undefined
                            }}
                          >
                            <div className="app-list-item__row">
                              <div className="app-list-item__main">
                                <div className="app-list-item__content">
                                  <div className="app-list-item__title">{jg.name}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </IonAccordion>
              </IonAccordionGroup>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Links (Entscheidung Simon, 01.09.2026): Der Datei-oder-Link-
            Umschalter vom 31.08. stand hier -- weg. Links und Dateien sind
            parallel erlaubt, beide Bereiche immer sichtbar, beide optional.
            Leere Eingabefelder fallen beim Speichern still heraus. */}
        {(!nurLesen || linkUrls.length > 0) && (
          <IonList inset={true} className="app-segment-wrapper">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--material">
                <IonIcon icon={linkOutline} />
              </div>
              <IonLabel>Links</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent>
                {/* Entfernen per Wischen wie bei den Dateien darunter
                    (Simons Hinweis 03.09.2026) -- der Muelleimer neben dem
                    Feld war die letzte Stelle im Modal mit einem Loeschknopf
                    in der Zeile.
                    Die Geste liegt bewusst auf der ganzen Zeile, nicht nur
                    auf dem Eingabefeld: Ionic gibt einem Wisch, der IM Feld
                    beginnt, weiterhin der Textmarkierung -- gewischt wird
                    vom Rand her, wie ueberall sonst. */}
                {linkUrls.map((url, index) => (
                  <IonItemSliding key={index} disabled={nurLesen}>
                    <IonItem
                      lines={index < linkUrls.length - 1 ? 'full' : 'none'}
                      style={{ '--background': 'transparent' }}
                    >
                      <IonInput
                        label={`Adresse ${linkUrls.length > 1 ? index + 1 : ''}`.trim()}
                        labelPlacement="stacked"
                        type="url"
                        inputmode="url"
                        autocapitalize="off"
                        value={url}
                        onIonInput={(e) => {
                          const wert = e.detail.value || '';
                          setLinkUrls(prev => prev.map((l, i) => (i === index ? wert : l)));
                        }}
                        placeholder="https://konfi-quest.de/gottesbilder"
                        readonly={nurLesen}
                      />
                    </IonItem>
                    {!nurLesen && (
                      <IonItemOptions className="app-swipe-actions" side="end">
                        <IonItemOption
                          className="app-swipe-action"
                          onClick={() => {
                            closeOpenSlidingItems();
                            setLinkUrls(prev => prev.filter((_, i) => i !== index));
                          }}
                          aria-label="Link entfernen"
                        >
                          <div className="app-icon-circle app-icon-circle--lg app-icon-circle--danger">
                            <IonIcon icon={trash} />
                          </div>
                        </IonItemOption>
                      </IonItemOptions>
                    )}
                  </IonItemSliding>
                ))}
                {linkUrls.length === 0 && (
                  <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '0 0 4px 0' }}>
                    Verknüpfte Internetseiten öffnen sich im Browser — zum Beispiel eine eigene Seite oder ein YouTube-Video.
                  </p>
                )}
                {!nurLesen && (
                  <IonButton
                    expand="block"
                    fill="outline"
                    onClick={() => setLinkUrls(prev => [...prev, ''])}
                    style={{ marginTop: '8px' }}
                  >
                    <IonIcon icon={addOutline} slot="start" />
                    Link hinzufügen
                  </IonButton>
                )}
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* Bestehende Dateien */}
        {existingFiles.length > 0 && (
          <IonList inset={true} className="app-segment-wrapper">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--material">
                <IonIcon icon={attachOutline} />
              </div>
              <IonLabel>Vorhandene Dateien</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {existingFiles.map((file, index) => (
                    <IonItemSliding key={file.id} style={{ marginBottom: index < existingFiles.length - 1 ? '8px' : '0' }}>
                      <IonItem
                        button
                        detail={false}
                        lines="none"
                        className="app-item-transparent"
                        onClick={() => openFile(file)}
                      >
                        <div className="app-list-item" style={{ borderLeftColor: '#d97706' }}>
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
                      </IonItem>
                      {/* Datei-Loeschen zaehlt als Bearbeitung des Materials
                          (Entscheidung Simon, 01.09.2026) -- im Lese-Modus
                          gibt es den Wisch-Knopf nicht. Ansehen bleibt. */}
                      {!nurLesen && (
                        <IonItemOptions className="app-swipe-actions" side="end">
                          <IonItemOption
                            className="app-swipe-action"
                            onClick={() => { closeOpenSlidingItems(); handleDeleteExistingFile(file); }}
                            aria-label="Datei löschen"
                          >
                            <div className="app-icon-circle app-icon-circle--lg app-icon-circle--danger">
                              <IonIcon icon={trash} />
                            </div>
                          </IonItemOption>
                        </IonItemOptions>
                      )}
                    </IonItemSliding>
                  ))}
                </div>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* Neue Dateien. Dateien anhaengen zaehlt als Bearbeitung des
            Materials (Entscheidung Simon, 01.09.2026) -- im Lese-Modus fehlt
            der ganze Abschnitt. */}
        {!nurLesen && (
        <IonList inset={true} className="app-segment-wrapper">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--material">
              <IonIcon icon={cloudUploadOutline} />
            </div>
            <IonLabel>Dateien hinzufügen</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent>
              {newFiles.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '12px' }}>
                  {newFiles.map((file, index) => (
                    <IonItemSliding key={index} style={{ marginBottom: index < newFiles.length - 1 ? '8px' : '0' }}>
                      <IonItem
                        button
                        detail={false}
                        lines="none"
                        className="app-item-transparent"
                        onClick={() => {
                          openInAppViewer(file, file.name, file.type);
                        }}
                      >
                        <div className="app-list-item" style={{ borderLeftColor: '#d97706' }}>
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
                          </div>
                        </div>
                      </IonItem>
                      <IonItemOptions className="app-swipe-actions" side="end">
                        <IonItemOption
                          className="app-swipe-action"
                          onClick={() => { closeOpenSlidingItems(); removeNewFile(index); }}
                          aria-label="Datei entfernen"
                        >
                          <div className="app-icon-circle app-icon-circle--lg app-icon-circle--danger">
                            <IonIcon icon={trash} />
                          </div>
                        </IonItemOption>
                      </IonItemOptions>
                    </IonItemSliding>
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
                fill="solid"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  '--background': 'var(--ion-color-primary)',
                  marginTop: '16px',
                  padding: '0 16px'
                }}
              >
                <IonIcon icon={cloudUploadOutline} slot="start" />
                Datei auswählen
              </IonButton>
            </IonCardContent>
          </IonCard>
        </IonList>
        )}

        <div className="ion-padding-bottom" />
      </IonContent>
    </IonPage>
  );
};

export default MaterialFormModal;
