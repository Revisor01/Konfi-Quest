import React, { useState, useEffect } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonCard,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonIcon,
  IonButton,
  IonItem,
  IonLabel,
  IonChip,
  IonList,
  IonSegment,
  IonSegmentButton,
  IonInput,
  IonModal,
  IonButtons,
  IonTextarea,
  IonSelect,
  IonSelectOption,
  IonImg,
  IonFab,
  IonFabButton,
  useIonActionSheet,
  useIonAlert
} from '@ionic/react';
import {
  add,
  document,
  camera,
  image,
  time,
  checkmark,
  close,
  search,
  hourglass,
  warning,
  star,
  flash,
  calendar,
  person,
  send,
  eye,
  trash
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';
import LoadingSpinner from '../../common/LoadingSpinner';

interface ActivityRequest {
  id: number;
  activity_id?: number;
  activity_title?: string;
  custom_activity_title?: string;
  description: string;
  photo_url?: string;
  status: 'pending' | 'approved' | 'rejected';
  points_requested?: number;
  points_awarded?: number;
  submitted_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  admin_notes?: string;
}

interface Activity {
  id: number;
  title: string;
  points: number;
  type: string;
}

const KonfiRequestsPage: React.FC = () => {
  const { setSuccess, setError } = useApp();
  const [presentActionSheet] = useIonActionSheet();
  const [presentAlert] = useIonAlert();
  
  const [requests, setRequests] = useState<ActivityRequest[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('alle');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ActivityRequest | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    activity_id: '',
    custom_activity_title: '',
    description: '',
    points_requested: '',
    photo_file: null as File | null
  });
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [requestsResponse, activitiesResponse] = await Promise.all([
        api.get('/konfi/requests'),
        api.get('/konfi/activities')
      ]);
      setRequests(requestsResponse.data);
      setActivities(activitiesResponse.data);
    } catch (err) {
      setError('Fehler beim Laden der Daten');
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoSelect = () => {
    presentActionSheet({
      header: 'Foto hinzufügen',
      buttons: [
        {
          text: 'Kamera',
          icon: camera,
          handler: () => {
            // TODO: Implement camera capture
            const input = window.document.createElement('input');
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
            const input = window.document.createElement('input');
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
      setFormData(prev => ({ ...prev, photo_file: file }));
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitRequest = async () => {
    if (!formData.description.trim()) {
      setError('Beschreibung ist erforderlich');
      return;
    }

    if (!formData.activity_id && !formData.custom_activity_title.trim()) {
      setError('Bitte wähle eine Aktivität oder gib einen eigenen Titel ein');
      return;
    }

    if (!formData.activity_id && !formData.points_requested) {
      setError('Bitte gib die gewünschten Punkte für die eigene Aktivität an');
      return;
    }

    setSubmitting(true);
    try {
      const submitData = new FormData();
      
      if (formData.activity_id) {
        submitData.append('activity_id', formData.activity_id);
      } else {
        submitData.append('custom_activity_title', formData.custom_activity_title.trim());
        submitData.append('points_requested', formData.points_requested);
      }
      
      submitData.append('description', formData.description.trim());
      
      if (formData.photo_file) {
        submitData.append('photo', formData.photo_file);
      }

      await api.post('/konfi/requests', submitData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setSuccess('Antrag erfolgreich eingereicht!');
      setIsCreateModalOpen(false);
      resetForm();
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Einreichen des Antrags');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRequest = async (request: ActivityRequest) => {
    if (request.status !== 'pending') {
      setError('Nur ausstehende Anträge können gelöscht werden');
      return;
    }

    presentAlert({
      header: 'Antrag löschen',
      message: 'Möchtest du diesen Antrag wirklich löschen?',
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: async () => {
            try {
              await api.delete(`/konfi/requests/${request.id}`);
              setSuccess('Antrag gelöscht');
              await loadData();
            } catch (err: any) {
              setError(err.response?.data?.error || 'Fehler beim Löschen');
            }
          }
        }
      ]
    });
  };

  const resetForm = () => {
    setFormData({
      activity_id: '',
      custom_activity_title: '',
      description: '',
      points_requested: '',
      photo_file: null
    });
    setPhotoPreview(null);
  };

  const getFilteredRequests = () => {
    let filtered = requests;

    // Search filter
    if (searchTerm.trim()) {
      filtered = filtered.filter(request =>
        (request.activity_title || request.custom_activity_title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    switch (selectedFilter) {
      case 'pending':
        filtered = filtered.filter(request => request.status === 'pending');
        break;
      case 'approved':
        filtered = filtered.filter(request => request.status === 'approved');
        break;
      case 'rejected':
        filtered = filtered.filter(request => request.status === 'rejected');
        break;
    }

    // Sort by submitted_at (newest first)
    return filtered.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'success';
      case 'rejected': return 'danger';
      case 'pending': return 'warning';
      default: return 'medium';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return 'Genehmigt';
      case 'rejected': return 'Abgelehnt';
      case 'pending': return 'Ausstehend';
      default: return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return checkmark;
      case 'rejected': return close;
      case 'pending': return hourglass;
      default: return document;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPendingCount = () => {
    return requests.filter(request => request.status === 'pending').length;
  };

  const getApprovedCount = () => {
    return requests.filter(request => request.status === 'approved').length;
  };

  const getTotalPoints = () => {
    return requests
      .filter(request => request.status === 'approved')
      .reduce((sum, request) => sum + (request.points_awarded || 0), 0);
  };

  const filteredRequests = getFilteredRequests();

  if (loading) {
    return <LoadingSpinner message="Anträge werden geladen..." />;
  }

  return (
    <IonPage>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Anträge</IonTitle>
        </IonToolbar>
      </IonHeader>
      
      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar style={{ '--background': 'transparent', '--color': 'black' }}>
            <IonTitle size="large" style={{ color: 'black' }}>Anträge</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          loadData();
          e.detail.complete();
        }}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>

        {/* Header Statistiken */}
        <IonCard style={{
          margin: '16px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #2dd36f 0%, #26c764 100%)',
          color: 'white',
          boxShadow: '0 8px 32px rgba(45, 211, 111, 0.3)'
        }}>
          <IonCardContent>
            <IonGrid>
              <IonRow>
                <IonCol size="4">
                  <div style={{ textAlign: 'center' }}>
                    <IonIcon icon={document} style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
                    <h3 style={{ margin: '0', fontSize: '1.5rem' }}>
                      {requests.length}
                    </h3>
                    <p style={{ margin: '0', fontSize: '0.9rem', opacity: 0.8 }}>
                      Anträge
                    </p>
                  </div>
                </IonCol>
                <IonCol size="4">
                  <div style={{ textAlign: 'center' }}>
                    <IonIcon icon={hourglass} style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
                    <h3 style={{ margin: '0', fontSize: '1.5rem' }}>
                      {getPendingCount()}
                    </h3>
                    <p style={{ margin: '0', fontSize: '0.9rem', opacity: 0.8 }}>
                      Ausstehend
                    </p>
                  </div>
                </IonCol>
                <IonCol size="4">
                  <div style={{ textAlign: 'center' }}>
                    <IonIcon icon={star} style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
                    <h3 style={{ margin: '0', fontSize: '1.5rem' }}>
                      {getTotalPoints()}
                    </h3>
                    <p style={{ margin: '0', fontSize: '0.9rem', opacity: 0.8 }}>
                      Punkte
                    </p>
                  </div>
                </IonCol>
              </IonRow>
            </IonGrid>
          </IonCardContent>
        </IonCard>

        {/* Search and Filter */}
        <IonCard style={{ margin: '16px' }}>
          <IonCardContent style={{ padding: '16px' }}>
            {/* Search Bar */}
            <IonItem 
              lines="none" 
              style={{ 
                '--background': '#f8f9fa',
                '--border-radius': '8px',
                marginBottom: '16px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                '--padding-start': '12px',
                '--padding-end': '12px',
                '--min-height': '44px'
              }}
            >
              <IonIcon 
                icon={search} 
                slot="start" 
                style={{ 
                  color: '#8e8e93',
                  marginRight: '8px',
                  fontSize: '1rem'
                }} 
              />
              <IonInput
                value={searchTerm}
                onIonInput={(e) => setSearchTerm(e.detail.value!)}
                placeholder="Antrag suchen..."
                style={{ 
                  '--color': '#000',
                  '--placeholder-color': '#8e8e93'
                }}
              />
            </IonItem>

            {/* Filter Tabs */}
            <IonSegment 
              value={selectedFilter} 
              onIonChange={(e) => setSelectedFilter(e.detail.value as string)}
              style={{ 
                '--background': '#f8f9fa',
                borderRadius: '8px',
                padding: '4px'
              }}
            >
              <IonSegmentButton value="alle">
                <IonIcon icon={document} style={{ fontSize: '1rem', marginRight: '4px' }} />
                <IonLabel>Alle</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="pending">
                <IonIcon icon={hourglass} style={{ fontSize: '1rem', marginRight: '4px' }} />
                <IonLabel>Ausstehend</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="approved">
                <IonIcon icon={checkmark} style={{ fontSize: '1rem', marginRight: '4px' }} />
                <IonLabel>Genehmigt</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="rejected">
                <IonIcon icon={close} style={{ fontSize: '1rem', marginRight: '4px' }} />
                <IonLabel>Abgelehnt</IonLabel>
              </IonSegmentButton>
            </IonSegment>
          </IonCardContent>
        </IonCard>

        {/* Requests Liste */}
        <div style={{ margin: '0 16px', paddingBottom: '100px' }}>
          {filteredRequests.map((request) => (
            <IonCard 
              key={request.id} 
              button
              onClick={() => {
                setSelectedRequest(request);
                setIsDetailModalOpen(true);
              }}
              style={{ 
                marginBottom: '16px',
                borderRadius: '16px',
                borderLeft: `4px solid ${
                  request.status === 'approved' ? '#2dd36f' :
                  request.status === 'rejected' ? '#f53d3d' : '#ffcc00'
                }`
              }}
            >
              <IonCardContent style={{ padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '12px',
                    background: `linear-gradient(135deg, ${
                      request.status === 'approved' ? '#2dd36f' :
                      request.status === 'rejected' ? '#f53d3d' : '#ffcc00'
                    } 0%, ${
                      request.status === 'approved' ? '#26c764' :
                      request.status === 'rejected' ? '#f53d3d' : '#e6b800'
                    } 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <IonIcon 
                      icon={getStatusIcon(request.status)} 
                      style={{ fontSize: '1.4rem', color: 'white' }} 
                    />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ 
                      margin: '0 0 8px 0', 
                      fontSize: '1.1rem', 
                      fontWeight: '600',
                      lineHeight: '1.3'
                    }}>
                      {request.activity_title || request.custom_activity_title}
                    </h3>

                    <p style={{ 
                      margin: '0 0 12px 0', 
                      fontSize: '0.85rem', 
                      color: '#666',
                      lineHeight: '1.4',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {request.description}
                    </p>

                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <IonChip 
                        color={getStatusColor(request.status)}
                        style={{ 
                          fontSize: '0.75rem', 
                          height: '22px',
                          '--background': `${
                            request.status === 'approved' ? 'rgba(45, 211, 111, 0.15)' :
                            request.status === 'rejected' ? 'rgba(245, 61, 61, 0.15)' :
                            'rgba(255, 204, 0, 0.15)'
                          }`,
                          '--color': `${
                            request.status === 'approved' ? '#2dd36f' :
                            request.status === 'rejected' ? '#f53d3d' : '#ffcc00'
                          }`
                        }}
                      >
                        {getStatusText(request.status)}
                      </IonChip>
                      
                      {(request.points_awarded || request.points_requested) && (
                        <IonChip 
                          color="warning"
                          style={{ 
                            fontSize: '0.75rem', 
                            height: '22px',
                            '--background': 'rgba(255, 204, 0, 0.15)',
                            '--color': '#ffcc00'
                          }}
                        >
                          <IonIcon icon={star} style={{ fontSize: '0.7rem', marginRight: '2px' }} />
                          {request.points_awarded || request.points_requested} {(request.points_awarded || request.points_requested) === 1 ? 'Punkt' : 'Punkte'}
                        </IonChip>
                      )}

                      {request.photo_url && (
                        <IonChip 
                          color="tertiary"
                          style={{ 
                            fontSize: '0.75rem', 
                            height: '22px',
                            '--background': 'rgba(112, 69, 246, 0.15)',
                            '--color': '#7045f6'
                          }}
                        >
                          <IonIcon icon={image} style={{ fontSize: '0.7rem', marginRight: '2px' }} />
                          Foto
                        </IonChip>
                      )}

                      {request.status === 'pending' && (
                        <IonButton 
                          size="small" 
                          fill="clear" 
                          color="danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRequest(request);
                          }}
                          style={{ height: '22px', '--padding-start': '4px', '--padding-end': '4px' }}
                        >
                          <IonIcon icon={trash} style={{ fontSize: '0.8rem' }} />
                        </IonButton>
                      )}
                    </div>

                    <p style={{ 
                      margin: '8px 0 0 0',
                      fontSize: '0.8rem',
                      color: '#999'
                    }}>
                      Eingereicht: {formatDate(request.submitted_at)}
                      {request.reviewed_at && ` • Bearbeitet: ${formatDate(request.reviewed_at)}`}
                    </p>
                  </div>
                </div>
              </IonCardContent>
            </IonCard>
          ))}

          {filteredRequests.length === 0 && (
            <IonCard style={{ textAlign: 'center', padding: '32px' }}>
              <IonIcon icon={document} style={{ fontSize: '3rem', color: '#ccc', marginBottom: '16px' }} />
              <h3 style={{ color: '#666', margin: '0 0 8px 0' }}>Keine Anträge gefunden</h3>
              <p style={{ color: '#999', margin: '0 0 16px 0' }}>
                {searchTerm.trim() 
                  ? 'Versuche einen anderen Suchbegriff'
                  : 'Du hast noch keine Anträge eingereicht'
                }
              </p>
            </IonCard>
          )}
        </div>


        {/* Create Request Modal */}
        <IonModal isOpen={isCreateModalOpen} onDidDismiss={() => setIsCreateModalOpen(false)}>
          <IonPage>
            <IonHeader>
              <IonToolbar>
                <IonTitle>Neuer Antrag</IonTitle>
                <IonButtons slot="start">
                  <IonButton onClick={() => {
                    setIsCreateModalOpen(false);
                    resetForm();
                  }}>
                    <IonIcon icon={close} />
                  </IonButton>
                </IonButtons>
                <IonButtons slot="end">
                  <IonButton 
                    onClick={handleSubmitRequest}
                    disabled={submitting}
                  >
                    <IonIcon icon={send} />
                  </IonButton>
                </IonButtons>
              </IonToolbar>
            </IonHeader>
            <IonContent>
              <div style={{ padding: '16px' }}>
                {/* Activity Selection */}
                <IonCard>
                  <IonCardContent>
                    <h3 style={{ margin: '0 0 16px 0' }}>Aktivität auswählen</h3>
                    
                    <IonItem>
                      <IonLabel position="stacked">Vorhandene Aktivität</IonLabel>
                      <IonSelect
                        value={formData.activity_id}
                        onIonChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          activity_id: e.detail.value,
                          custom_activity_title: '',
                          points_requested: ''
                        }))}
                        placeholder="Aktivität auswählen (optional)"
                      >
                        {activities.map(activity => (
                          <IonSelectOption key={activity.id} value={activity.id.toString()}>
                            {activity.title} ({activity.points} {activity.points === 1 ? 'Punkt' : 'Punkte'})
                          </IonSelectOption>
                        ))}
                      </IonSelect>
                    </IonItem>

                    <div style={{ 
                      textAlign: 'center', 
                      margin: '16px 0',
                      fontSize: '0.9rem',
                      color: '#666'
                    }}>
                      oder
                    </div>

                    <IonItem>
                      <IonLabel position="stacked">Eigene Aktivität</IonLabel>
                      <IonInput
                        value={formData.custom_activity_title}
                        onIonInput={(e) => setFormData(prev => ({ 
                          ...prev, 
                          custom_activity_title: e.detail.value!,
                          activity_id: ''
                        }))}
                        placeholder="Titel der eigenen Aktivität"
                        disabled={!!formData.activity_id}
                      />
                    </IonItem>

                    {formData.custom_activity_title && !formData.activity_id && (
                      <IonItem>
                        <IonLabel position="stacked">Gewünschte Punkte</IonLabel>
                        <IonInput
                          type="number"
                          value={formData.points_requested}
                          onIonInput={(e) => setFormData(prev => ({ 
                            ...prev, 
                            points_requested: e.detail.value!
                          }))}
                          placeholder="Anzahl Punkte"
                          min="1"
                          max="50"
                        />
                      </IonItem>
                    )}
                  </IonCardContent>
                </IonCard>

                {/* Description */}
                <IonCard>
                  <IonCardContent>
                    <h3 style={{ margin: '0 0 16px 0' }}>Beschreibung *</h3>
                    <IonItem>
                      <IonLabel position="stacked">Was hast du gemacht?</IonLabel>
                      <IonTextarea
                        value={formData.description}
                        onIonInput={(e) => setFormData(prev => ({ ...prev, description: e.detail.value! }))}
                        placeholder="Beschreibe ausführlich, was du gemacht hast und warum du dafür Punkte erhalten solltest..."
                        autoGrow={true}
                        rows={4}
                      />
                    </IonItem>
                  </IonCardContent>
                </IonCard>

                {/* Photo */}
                <IonCard>
                  <IonCardContent>
                    <h3 style={{ margin: '0 0 16px 0' }}>Foto (optional)</h3>
                    
                    {photoPreview ? (
                      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                        <IonImg 
                          src={photoPreview} 
                          alt="Foto Vorschau"
                          style={{ 
                            maxHeight: '200px',
                            borderRadius: '8px',
                            border: '2px solid #e9ecef'
                          }}
                        />
                        <IonButton 
                          fill="clear" 
                          color="danger"
                          size="small"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, photo_file: null }));
                            setPhotoPreview(null);
                          }}
                          style={{ marginTop: '8px' }}
                        >
                          <IonIcon icon={trash} slot="start" />
                          Foto entfernen
                        </IonButton>
                      </div>
                    ) : (
                      <IonButton 
                        expand="block" 
                        fill="outline"
                        onClick={handlePhotoSelect}
                      >
                        <IonIcon icon={camera} slot="start" />
                        Foto hinzufügen
                      </IonButton>
                    )}
                  </IonCardContent>
                </IonCard>

                {/* Submit Info */}
                <IonCard style={{ background: 'rgba(45, 211, 111, 0.1)' }}>
                  <IonCardContent>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <IonIcon icon={checkmark} color="success" />
                      <p style={{ margin: '0', fontSize: '0.9rem', color: '#2dd36f', fontWeight: '500' }}>
                        Dein Antrag wird von einem Admin geprüft und du erhältst eine Rückmeldung.
                      </p>
                    </div>
                  </IonCardContent>
                </IonCard>
              </div>
            </IonContent>
          </IonPage>
        </IonModal>

        {/* Request Detail Modal */}
        <IonModal isOpen={isDetailModalOpen} onDidDismiss={() => setIsDetailModalOpen(false)}>
          {selectedRequest && (
            <IonPage>
              <IonHeader>
                <IonToolbar>
                  <IonTitle>{selectedRequest.activity_title || selectedRequest.custom_activity_title}</IonTitle>
                  <IonButtons slot="end">
                    <IonButton onClick={() => setIsDetailModalOpen(false)}>
                      <IonIcon icon={close} />
                    </IonButton>
                  </IonButtons>
                </IonToolbar>
              </IonHeader>
              <IonContent>
                <div style={{ padding: '16px' }}>
                  {/* Status Header */}
                  <div style={{
                    background: `linear-gradient(135deg, ${
                      selectedRequest.status === 'approved' ? '#2dd36f' :
                      selectedRequest.status === 'rejected' ? '#f53d3d' : '#ffcc00'
                    } 0%, ${
                      selectedRequest.status === 'approved' ? '#26c764' :
                      selectedRequest.status === 'rejected' ? '#f53d3d' : '#e6b800'
                    } 100%)`,
                    borderRadius: '16px',
                    padding: '24px',
                    color: 'white',
                    marginBottom: '16px',
                    textAlign: 'center'
                  }}>
                    <IonIcon 
                      icon={getStatusIcon(selectedRequest.status)} 
                      style={{ fontSize: '3rem', marginBottom: '12px' }} 
                    />
                    <h1 style={{ margin: '0 0 8px 0', fontSize: '1.4rem' }}>
                      {selectedRequest.activity_title || selectedRequest.custom_activity_title}
                    </h1>
                    <p style={{ margin: '0', opacity: 0.9 }}>
                      Status: {getStatusText(selectedRequest.status)}
                    </p>
                  </div>

                  {/* Request Details */}
                  <IonCard>
                    <IonCardContent>
                      <h3 style={{ margin: '0 0 16px 0' }}>Details</h3>
                      
                      <IonItem lines="none" style={{ '--padding-start': '0', '--inner-padding-end': '0' }}>
                        <IonIcon icon={calendar} slot="start" color="primary" />
                        <IonLabel>
                          <h4>Eingereicht</h4>
                          <p>{formatDate(selectedRequest.submitted_at)}</p>
                        </IonLabel>
                      </IonItem>

                      {selectedRequest.reviewed_at && (
                        <IonItem lines="none" style={{ '--padding-start': '0', '--inner-padding-end': '0' }}>
                          <IonIcon icon={person} slot="start" color="success" />
                          <IonLabel>
                            <h4>Bearbeitet</h4>
                            <p>{formatDate(selectedRequest.reviewed_at)}</p>
                            {selectedRequest.reviewed_by && <p>von {selectedRequest.reviewed_by}</p>}
                          </IonLabel>
                        </IonItem>
                      )}

                      <IonItem lines="none" style={{ '--padding-start': '0', '--inner-padding-end': '0' }}>
                        <IonIcon icon={star} slot="start" color="warning" />
                        <IonLabel>
                          <h4>Punkte</h4>
                          <p>
                            {selectedRequest.status === 'approved' 
                              ? `${selectedRequest.points_awarded} Punkte erhalten`
                              : `${selectedRequest.points_requested || 'Unbekannt'} Punkte beantragt`
                            }
                          </p>
                        </IonLabel>
                      </IonItem>
                    </IonCardContent>
                  </IonCard>

                  {/* Description */}
                  <IonCard>
                    <IonCardContent>
                      <h3 style={{ margin: '0 0 12px 0' }}>Beschreibung</h3>
                      <p style={{ margin: '0', lineHeight: '1.5' }}>
                        {selectedRequest.description}
                      </p>
                    </IonCardContent>
                  </IonCard>

                  {/* Photo */}
                  {selectedRequest.photo_url && (
                    <IonCard>
                      <IonCardContent>
                        <h3 style={{ margin: '0 0 12px 0' }}>Foto</h3>
                        <IonImg 
                          src={selectedRequest.photo_url} 
                          alt="Antrag Foto"
                          style={{ 
                            borderRadius: '8px',
                            border: '1px solid #e9ecef'
                          }}
                        />
                      </IonCardContent>
                    </IonCard>
                  )}

                  {/* Admin Notes */}
                  {selectedRequest.admin_notes && (
                    <IonCard>
                      <IonCardContent>
                        <h3 style={{ margin: '0 0 12px 0' }}>Admin-Notizen</h3>
                        <p style={{ 
                          margin: '0', 
                          lineHeight: '1.5',
                          fontStyle: 'italic',
                          color: selectedRequest.status === 'rejected' ? '#f53d3d' : '#666'
                        }}>
                          {selectedRequest.admin_notes}
                        </p>
                      </IonCardContent>
                    </IonCard>
                  )}

                  {/* Actions */}
                  {selectedRequest.status === 'pending' && (
                    <div style={{ marginTop: '24px' }}>
                      <IonButton 
                        expand="block" 
                        color="danger" 
                        onClick={() => handleDeleteRequest(selectedRequest)}
                      >
                        <IonIcon icon={trash} slot="start" />
                        Antrag löschen
                      </IonButton>
                    </div>
                  )}
                </div>
              </IonContent>
            </IonPage>
          )}
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default KonfiRequestsPage;