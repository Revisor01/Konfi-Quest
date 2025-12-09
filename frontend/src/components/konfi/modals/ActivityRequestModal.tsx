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
  IonTextarea,
  IonDatetime,
  IonDatetimeButton,
  IonModal,
  IonProgressBar,
  useIonActionSheet,
  useIonAlert
} from '@ionic/react';
import { 
  close, 
  checkmark, 
  camera, 
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
      const response = await api.get('/konfi/activities');
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
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = false;
    input.onchange = (e: Event) => handleFileSelect(e);
    input.click();
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
              <IonIcon icon={checkmark} />
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
        
        <IonCard style={{ margin: '0 16px 16px 16px', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', border: '1px solid #e0e0e0' }}>
          <IonCardContent style={{ padding: '16px' }}>
            <IonItem button onClick={handleActivitySelect} disabled={loading || submitting} lines="none" style={{ '--background': '#f8f9fa', '--border-radius': '10px' }}>
              <IonLabel>
                {selectedActivity ? (
                  <>
                    <h3 style={{ fontWeight: '600' }}>{selectedActivity.name}</h3>
                    <p>{selectedActivity.points} {selectedActivity.points === 1 ? 'Punkt' : 'Punkte'} - {selectedActivity.type === 'gottesdienst' ? 'Gottesdienst' : 'Gemeinde'}</p>
                  </>
                ) : (
                  <>
                    <h3 style={{ fontWeight: '600' }}>Aktivität auswählen</h3>
                    <p>Tippe hier um eine Aktivität zu wählen</p>
                  </>
                )}
              </IonLabel>
            </IonItem>

            {selectedActivity && (
              <div style={{
                marginTop: '12px',
                margin: '12px 16px 0 16px',
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
                  <span style={{ color: '#666', fontWeight: '500' }}>
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
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          margin: '16px 16px 8px 16px'
        }}>
          <div style={{ 
            width: '32px', 
            height: '32px',
            backgroundColor: '#2dd36f',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(45, 211, 111, 0.3)',
            flexShrink: 0
          }}>
            <IonIcon icon={calendar} style={{ fontSize: '1rem', color: 'white' }} />
          </div>
          <h2 style={{ 
            fontWeight: '600', 
            fontSize: '1.1rem',
            margin: '0',
            color: '#333'
          }}>
            Datum wählen
          </h2>
        </div>
        
        <IonCard style={{ margin: '0 16px 16px 16px', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', border: '1px solid #e0e0e0' }}>
          <IonCardContent style={{ padding: '16px' }}>
            <IonItem lines="none" style={{ '--background': '#f8f9fa', '--border-radius': '10px' }}>
              <IonDatetimeButton datetime="date-picker" />
              <IonModal keepContentsMounted={true}>
                <IonDatetime
                  id="date-picker"
                  value={formData.requested_date}
                  onIonChange={(e) => setFormData(prev => ({ ...prev, requested_date: e.detail.value as string }))}
                  presentation="date"
                  max={new Date().toISOString().split('T')[0]}
                  firstDayOfWeek={1}
                />
              </IonModal>
            </IonItem>
          </IonCardContent>
        </IonCard>

        {/* Description */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          margin: '16px 16px 8px 16px'
        }}>
          <div style={{ 
            width: '32px', 
            height: '32px',
            backgroundColor: '#ffcc00',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(255, 204, 0, 0.3)',
            flexShrink: 0
          }}>
            <IonIcon icon={text} style={{ fontSize: '1rem', color: 'white' }} />
          </div>
          <h2 style={{ 
            fontWeight: '600', 
            fontSize: '1.1rem',
            margin: '0',
            color: '#333'
          }}>
            Anmerkungen (optional)
          </h2>
        </div>
        
        <IonCard style={{ margin: '0 16px 16px 16px', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', border: '1px solid #e0e0e0' }}>
          <IonCardContent style={{ padding: '16px' }}>
            <IonItem lines="none" style={{ '--background': '#f8f9fa', '--border-radius': '10px' }}>
              <IonTextarea
                value={formData.description}
                onIonInput={(e) => setFormData(prev => ({ ...prev, description: e.detail.value! }))}
                placeholder="Anmerkungen... (optional)"
                autoGrow={true}
                rows={2}
              />
            </IonItem>
          </IonCardContent>
        </IonCard>

        {/* Photo */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          margin: '16px 16px 8px 16px'
        }}>
          <div style={{ 
            width: '32px', 
            height: '32px',
            backgroundColor: '#7045f6',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(112, 69, 246, 0.3)',
            flexShrink: 0
          }}>
            <IonIcon icon={camera} style={{ fontSize: '1rem', color: 'white' }} />
          </div>
          <h2 style={{ 
            fontWeight: '600', 
            fontSize: '1.1rem',
            margin: '0',
            color: '#333'
          }}>
            Foto als Nachweis (optional)
          </h2>
        </div>
        
        <IonCard style={{ margin: '0 16px 16px 16px', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', border: '1px solid #e0e0e0' }}>
          <IonCardContent style={{ padding: '16px' }}>
            <div
              onClick={handlePhotoSelect}
              style={{
                padding: '16px',
                backgroundColor: photoPreview ? '#e8f5e8' : '#f8f9fa',
                borderRadius: '10px',
                border: photoPreview ? '1px solid #c3e6cb' : '1px solid #e9ecef',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {photoPreview ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <IonIcon 
                      icon={checkmarkCircle}
                      style={{ fontSize: '1.2rem', color: '#28a745' }}
                    />
                    <span style={{ fontWeight: '600', color: '#28a745' }}>
                      Foto ausgewählt
                    </span>
                  </div>
                  <IonButton 
                    fill="clear" 
                    color="danger"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      removePhoto();
                    }}
                  >
                    <IonIcon icon={trash} />
                  </IonButton>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <IonIcon 
                    icon={camera}
                    style={{ fontSize: '1.2rem', color: '#7045f6' }}
                  />
                  <span style={{ fontWeight: '500', color: '#666' }}>
                    Foto hinzufügen
                  </span>
                </div>
              )}
            </div>
          </IonCardContent>
        </IonCard>

      </IonContent>
    </IonPage>
  );
};

export default ActivityRequestModal;