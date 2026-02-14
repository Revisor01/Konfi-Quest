import React, { useState, useEffect, useRef } from 'react';
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
  IonList,
  IonListHeader,
  IonAccordion,
  IonAccordionGroup,
  useIonAlert
} from '@ionic/react';
import {
  close,
  checkmark,
  camera,
  trash,
  checkmarkCircle,
  calendarOutline,
  textOutline,
  starOutline,
  homeOutline,
  peopleOutline,
  imageOutline,
  pricetag
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
  const accordionGroupRef = useRef<HTMLIonAccordionGroupElement>(null);

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

      <IonContent className="app-gradient-background">
        {/* Aktivität Sektion - iOS26 Pattern mit Akkordeon */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--success">
              <IonIcon icon={starOutline} />
            </div>
            <IonLabel>Aktivität wählen</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: '0' }}>
              <IonAccordionGroup ref={accordionGroupRef}>
                <IonAccordion value="activity-picker">
                  <IonItem slot="header" lines="none" style={{ '--padding-start': '16px' }}>
                    <IonLabel>
                      <h3 style={{ fontSize: '0.9rem', fontWeight: '500', color: '#666', margin: '0 0 4px 0' }}>
                        Aktivität auswählen
                      </h3>
                      {selectedActivity && (
                        <p style={{ fontSize: '0.85rem', color: '#333', margin: '0', fontWeight: '500' }}>
                          {selectedActivity.name}
                        </p>
                      )}
                    </IonLabel>
                  </IonItem>
                  <div slot="content" style={{ padding: '0 16px 16px' }}>
                    {/* Aktivitäten Liste */}
                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                      {activities.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '16px', color: '#888' }}>
                          Keine Aktivitäten gefunden
                        </div>
                      ) : (
                        activities.map(activity => {
                          const isSelected = formData.activity_id === activity.id.toString();
                          const colorVariant = activity.type === 'gottesdienst' ? 'info' : 'activities';
                          const typeColor = activity.type === 'gottesdienst' ? '#007aff' : '#059669';

                          return (
                            <div
                              key={activity.id}
                              className={`app-list-item app-list-item--${colorVariant}${isSelected ? ' app-list-item--selected' : ''}`}
                              onClick={() => {
                                setFormData(prev => ({ ...prev, activity_id: activity.id.toString() }));
                                if (accordionGroupRef.current) {
                                  accordionGroupRef.current.value = undefined;
                                }
                              }}
                              style={{ cursor: 'pointer', position: 'relative' }}
                            >
                              {/* Punkte Eselsohr oben rechts */}
                              <div style={{
                                position: 'absolute',
                                top: '0',
                                right: '0',
                                background: `linear-gradient(135deg, ${typeColor} 0%, ${typeColor}dd 100%)`,
                                borderRadius: '0 10px 0 10px',
                                padding: '3px 8px',
                                fontSize: '0.65rem',
                                fontWeight: '700',
                                color: 'white',
                                whiteSpace: 'nowrap'
                              }}>
                                +{activity.points}P
                              </div>

                              <div className="app-list-item__row">
                                <div className="app-list-item__main">
                                  {/* Icon */}
                                  <div className={`app-icon-circle app-icon-circle--${colorVariant}`}>
                                    <IonIcon icon={activity.type === 'gottesdienst' ? homeOutline : peopleOutline} />
                                  </div>

                                  {/* Content */}
                                  <div className="app-list-item__content">
                                    <div className="app-list-item__title" style={{ paddingRight: '50px' }}>
                                      {activity.name}
                                    </div>
                                    {activity.category_names && (
                                      <div className="app-list-item__meta">
                                        <span className="app-list-item__meta-item">
                                          <IonIcon icon={pricetag} style={{ color: '#8b5cf6' }} />
                                          {activity.category_names}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </IonAccordion>
              </IonAccordionGroup>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Datum Sektion - iOS26 Pattern */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--success">
              <IonIcon icon={calendarOutline} />
            </div>
            <IonLabel>Datum wählen</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent>
              <IonItem lines="none" style={{ '--background': 'transparent' }}>
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
        </IonList>

        {/* Anmerkungen Sektion - iOS26 Pattern */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--success">
              <IonIcon icon={textOutline} />
            </div>
            <IonLabel>Anmerkungen (optional)</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent>
              <IonItem lines="none" style={{ '--background': 'transparent' }}>
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
        </IonList>

        {/* Foto Sektion - iOS26 Pattern */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--success">
              <IonIcon icon={imageOutline} />
            </div>
            <IonLabel>Foto als Nachweis (optional)</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent>
              <div
                onClick={handlePhotoSelect}
                style={{
                  padding: '16px',
                  backgroundColor: photoPreview ? 'rgba(5, 150, 105, 0.08)' : 'transparent',
                  borderRadius: '10px',
                  border: photoPreview ? '1px solid rgba(5, 150, 105, 0.2)' : '1px dashed #c7c7cc',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {photoPreview ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <IonIcon
                        icon={checkmarkCircle}
                        style={{ fontSize: '1.2rem', color: '#059669' }}
                      />
                      <span style={{ fontWeight: '600', color: '#059669' }}>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                    <IonIcon
                      icon={camera}
                      style={{ fontSize: '1.2rem', color: '#059669' }}
                    />
                    <span style={{ fontWeight: '500', color: '#666' }}>
                      Foto hinzufügen
                    </span>
                  </div>
                )}
              </div>
            </IonCardContent>
          </IonCard>
        </IonList>

      </IonContent>
    </IonPage>
  );
};

export default ActivityRequestModal;
