import React, { useState, useEffect } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonIcon,
  IonCard,
  IonCardContent,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonDatetime,
  IonImg,
  IonProgressBar,
  useIonActionSheet,
  useIonAlert
} from '@ionic/react';
import { 
  close, 
  send, 
  camera, 
  image, 
  trash,
  checkmarkCircle,
  calendar,
  text,
  star,
  home,
  people
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';

interface Activity {
  id: number;
  name: string;
  description?: string;
  points: number;
  type: 'gottesdienst' | 'gemeinde';
  category_names?: string;
}

interface ActivityRequestModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const ActivityRequestModal: React.FC<ActivityRequestModalProps> = ({
  onClose,
  onSuccess
}) => {
  const { setSuccess, setError } = useApp();
  const [presentActionSheet] = useIonActionSheet();
  const [presentAlert] = useIonAlert();

  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [formData, setFormData] = useState({
    activity_id: '',
    description: '',
    requested_date: new Date().toISOString().split('T')[0],
    photo_file: null as File | null
  });
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    loadActivities();
  }, []);

  const loadActivities = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/activities');
      setActivities(response.data);
    } catch (err) {
      setError('Fehler beim Laden der Aktivitäten');
      console.error('Error loading activities:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleActivitySelect = () => {
    if (activities.length === 0) {
      setError('Keine Aktivitäten verfügbar');
      return;
    }

    const buttons = activities.map(activity => ({
      text: `${activity.name} (${activity.points} ${activity.points === 1 ? 'Punkt' : 'Punkte'})`,
      handler: () => {
        setFormData(prev => ({ ...prev, activity_id: activity.id.toString() }));
      }
    }));

    buttons.push({
      text: 'Abbrechen',
      handler: () => {}
    });

    presentActionSheet({
      header: 'Aktivität auswählen',
      buttons
    });
  };

  const handlePhotoSelect = () => {
    presentActionSheet({
      header: 'Foto hinzufügen',
      buttons: [
        {
          text: 'Kamera',
          icon: camera,
          handler: () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.setAttribute('capture', 'environment');
            input.onchange = (e: Event) => handleFileSelect(e);
            input.click();
          }
        },
        {
          text: 'Galerie',
          icon: image,
          handler: () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = (e: Event) => handleFileSelect(e);
            input.click();
          }
        },
        {
          text: 'Abbrechen',
          role: 'cancel'
        }
      ]
    });
  };

  const handleFileSelect = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Foto ist zu groß. Maximal 5MB erlaubt.');
        return;
      }

      setFormData(prev => ({ ...prev, photo_file: file }));
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadPhoto = async (): Promise<string | null> => {
    if (!formData.photo_file) return null;

    const uploadFormData = new FormData();
    uploadFormData.append('photo', formData.photo_file);

    try {
      const response = await api.post('/konfi/upload-photo', uploadFormData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
          }
        }
      });

      return response.data.filename;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Fehler beim Hochladen des Fotos');
    }
  };

  const handleSubmit = async () => {
    if (!formData.activity_id) {
      setError('Bitte wähle eine Aktivität aus');
      return;
    }

    // Description is now optional - no validation needed

    if (!formData.photo_file) {
      presentAlert({
        header: 'Kein Foto',
        message: 'Anträge benötigen normalerweise ein Foto als Nachweis. Möchtest du trotzdem fortfahren?',
        buttons: [
          { text: 'Abbrechen', role: 'cancel' },
          { text: 'Ohne Foto fortfahren', handler: () => submitRequest() }
        ]
      });
      return;
    }

    submitRequest();
  };

  const submitRequest = async () => {
    setSubmitting(true);
    setUploadProgress(0);

    try {
      let photoFilename: string | null = null;
      
      if (formData.photo_file) {
        photoFilename = await uploadPhoto();
      }

      const requestData = {
        activity_id: parseInt(formData.activity_id),
        description: formData.description.trim(),
        requested_date: formData.requested_date,
        photo_filename: photoFilename
      };

      await api.post('/konfi/requests', requestData);
      
      setSuccess('Antrag erfolgreich eingereicht!');
      onSuccess();
    } catch (error: any) {
      setError(error.response?.data?.error || error.message || 'Fehler beim Einreichen des Antrags');
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
    }
  };

  const removePhoto = () => {
    setFormData(prev => ({ ...prev, photo_file: null }));
    setPhotoPreview(null);
  };

  const selectedActivity = activities.find(a => a.id.toString() === formData.activity_id);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Neuer Antrag</IonTitle>
          <IonButtons slot="start">
            <IonButton onClick={onClose} disabled={submitting}>
              <IonIcon icon={close} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton onClick={handleSubmit} disabled={submitting || loading}>
              <IonIcon icon={send} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
        {submitting && uploadProgress > 0 && (
          <IonProgressBar value={uploadProgress / 100} />
        )}
      </IonHeader>
      
      <IonContent style={{ '--padding-top': '16px' }}>
        {/* Activity Selection */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          margin: '16px 16px 8px 16px'
        }}>
          <div style={{ 
            width: '32px', 
            height: '32px',
            backgroundColor: '#ff9500',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(255, 149, 0, 0.3)',
            flexShrink: 0
          }}>
            <IonIcon icon={star} style={{ fontSize: '1rem', color: 'white' }} />
          </div>
          <h2 style={{ 
            fontWeight: '600', 
            fontSize: '1.1rem',
            margin: '0',
            color: '#333'
          }}>
            Aktivität wählen
          </h2>
        </div>
        
        <IonCard style={{ margin: '0 16px 16px 16px', borderRadius: '12px' }}>
          <IonCardContent style={{ padding: '12px 0' }}>
            <IonItem button onClick={handleActivitySelect} disabled={loading || submitting}>
              <IonLabel>
                {selectedActivity ? (
                  <>
                    <h3>{selectedActivity.name}</h3>
                    <p>{selectedActivity.points} {selectedActivity.points === 1 ? 'Punkt' : 'Punkte'} • {selectedActivity.type === 'gottesdienst' ? 'Gottesdienst' : 'Gemeinde'}</p>
                  </>
                ) : (
                  <>
                    <h3>Aktivität auswählen</h3>
                    <p>Tippe hier um eine Aktivität zu wählen</p>
                  </>
                )}
              </IonLabel>
            </IonItem>

            {selectedActivity && (
              <div style={{
                marginTop: '12px',
                padding: '12px',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                border: '1px solid #e9ecef'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <IonIcon 
                    icon={selectedActivity.type === 'gottesdienst' ? home : people}
                    color={selectedActivity.type === 'gottesdienst' ? 'primary' : 'success'}
                  />
                  <span style={{ fontWeight: '600', color: '#333' }}>
                    {selectedActivity.type === 'gottesdienst' ? 'Gottesdienst' : 'Gemeinde'}
                  </span>
                  <span style={{ color: '#007aff', fontWeight: '500' }}>
                    • {selectedActivity.points} {selectedActivity.points === 1 ? 'Punkt' : 'Punkte'}
                  </span>
                </div>
                
                {selectedActivity.description && (
                  <p style={{ margin: '0', fontSize: '0.85rem', color: '#666' }}>
                    {selectedActivity.description}
                  </p>
                )}
                
                {selectedActivity.category_names && (
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#8e8e93' }}>
                    Kategorien: {selectedActivity.category_names}
                  </p>
                )}
              </div>
            )}
          </IonCardContent>
        </IonCard>

        {/* Date Selection */}
        <IonCard style={{ margin: '0 16px 16px 16px', borderRadius: '12px' }}>
            <IonCardContent>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '16px'
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  backgroundColor: '#2dd36f',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <IonIcon icon={calendar} style={{ fontSize: '1rem', color: 'white' }} />
                </div>
                <h3 style={{ margin: '0', fontSize: '1.1rem', fontWeight: '600' }}>
                  Datum
                </h3>
              </div>
              
              <IonItem>
                <IonLabel position="stacked">Wann hast du die Aktivität gemacht?</IonLabel>
                <IonDatetime
                  value={formData.requested_date}
                  onIonChange={(e) => setFormData(prev => ({ ...prev, requested_date: e.detail.value as string }))}
                  presentation="date"
                  max={new Date().toISOString().split('T')[0]}
                  style={{ width: '100%' }}
                />
              </IonItem>
            </IonCardContent>
        </IonCard>

        {/* Description */}
        <IonCard style={{ margin: '0 16px 16px 16px', borderRadius: '12px' }}>
            <IonCardContent>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '16px'
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  backgroundColor: '#ffcc00',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <IonIcon icon={text} style={{ fontSize: '1rem', color: 'white' }} />
                </div>
                <h3 style={{ margin: '0', fontSize: '1.1rem', fontWeight: '600' }}>
                  Beschreibung *
                </h3>
              </div>
              
              <IonItem>
                <IonLabel position="stacked">Was genau hast du gemacht?</IonLabel>
                <IonTextarea
                  value={formData.description}
                  onIonInput={(e) => setFormData(prev => ({ ...prev, description: e.detail.value! }))}
                  placeholder="Beschreibe ausführlich, was du gemacht hast..."
                  autoGrow={true}
                  rows={4}
                />
              </IonItem>
            </IonCardContent>
        </IonCard>

        {/* Photo */}
        <IonCard style={{ margin: '0 16px 16px 16px', borderRadius: '12px' }}>
            <IonCardContent>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '16px'
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  backgroundColor: '#7045f6',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <IonIcon icon={camera} style={{ fontSize: '1rem', color: 'white' }} />
                </div>
                <h3 style={{ margin: '0', fontSize: '1.1rem', fontWeight: '600' }}>
                  Foto als Nachweis
                </h3>
              </div>
              
              {photoPreview ? (
                <div style={{ textAlign: 'center' }}>
                  <IonImg 
                    src={photoPreview} 
                    alt="Foto Vorschau"
                    style={{ 
                      maxHeight: '200px',
                      borderRadius: '8px',
                      border: '2px solid #e9ecef',
                      marginBottom: '16px'
                    }}
                  />
                  <IonButton 
                    fill="outline" 
                    color="danger"
                    size="small"
                    onClick={removePhoto}
                  >
                    <IonIcon icon={trash} slot="start" />
                    Foto entfernen
                  </IonButton>
                </div>
              ) : (
                <div>
                  <IonButton 
                    expand="block" 
                    fill="outline"
                    onClick={handlePhotoSelect}
                    disabled={submitting}
                  >
                    <IonIcon icon={camera} slot="start" />
                    Foto hinzufügen
                  </IonButton>
                  <p style={{ 
                    margin: '8px 0 0 0', 
                    fontSize: '0.85rem', 
                    color: '#666',
                    textAlign: 'center'
                  }}>
                    Empfohlen: Lade ein Foto als Nachweis hoch
                  </p>
                </div>
              )}
            </IonCardContent>
        </IonCard>

        {/* Info Card */}
        <IonCard style={{ margin: '0 16px 16px 16px', borderRadius: '12px', background: 'rgba(45, 211, 111, 0.1)', border: '1px solid rgba(45, 211, 111, 0.3)' }}>
            <IonCardContent>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <IonIcon icon={checkmarkCircle} color="success" style={{ fontSize: '1.5rem' }} />
                <div>
                  <p style={{ margin: '0', fontSize: '0.9rem', color: '#2dd36f', fontWeight: '600' }}>
                    Antrag wird geprüft
                  </p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#666' }}>
                    Ein Admin prüft deinen Antrag und du bekommst eine Rückmeldung
                  </p>
                </div>
              </div>
            </IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
};

export default ActivityRequestModal;