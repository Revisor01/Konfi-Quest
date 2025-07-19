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
  IonCheckbox,
  useIonActionSheet,
  useIonAlert
} from '@ionic/react';
import {
  calendar,
  location,
  time,
  people,
  star,
  checkmark,
  close,
  add,
  search,
  filter,
  informationCircle,
  warning,
  heart,
  flash,
  gift
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';
import LoadingSpinner from '../../common/LoadingSpinner';

interface Event {
  id: number;
  title: string;
  description?: string;
  date: string;
  location?: string;
  max_participants?: number;
  current_participants: number;
  points: number;
  type: 'gottesdienst' | 'gemeinde' | 'aktivitaet';
  registration_deadline?: string;
  is_registered: boolean;
  can_register: boolean;
  registration_message?: string;
  categories?: Category[];
}

interface Category {
  id: number;
  name: string;
  color: string;
}

const KonfiEventsPage: React.FC = () => {
  const { setSuccess, setError } = useApp();
  const [presentActionSheet] = useIonActionSheet();
  const [presentAlert] = useIonAlert();
  
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('alle');
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const response = await api.get('/konfi/events');
      setEvents(response.data);
    } catch (err) {
      setError('Fehler beim Laden der Events');
      console.error('Error loading events:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterEvent = async (event: Event) => {
    if (!event.can_register) {
      setError(event.registration_message || 'Anmeldung nicht möglich');
      return;
    }

    try {
      await api.post(`/konfi/events/${event.id}/register`);
      setSuccess(`Erfolgreich für "${event.title}" angemeldet!`);
      await loadEvents(); // Refresh events
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler bei der Anmeldung');
    }
  };

  const handleUnregisterEvent = async (event: Event) => {
    presentAlert({
      header: 'Abmelden bestätigen',
      message: `Möchtest du dich wirklich von "${event.title}" abmelden?`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Abmelden',
          role: 'destructive',
          handler: async () => {
            try {
              await api.delete(`/konfi/events/${event.id}/register`);
              setSuccess(`Von "${event.title}" abgemeldet`);
              await loadEvents();
            } catch (err: any) {
              setError(err.response?.data?.error || 'Fehler bei der Abmeldung');
            }
          }
        }
      ]
    });
  };

  const getFilteredEvents = () => {
    let filtered = events;

    // Search filter
    if (searchTerm.trim()) {
      filtered = filtered.filter(event =>
        event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.location?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Type filter
    switch (selectedFilter) {
      case 'gottesdienst':
        filtered = filtered.filter(event => event.type === 'gottesdienst');
        break;
      case 'gemeinde':
        filtered = filtered.filter(event => event.type === 'gemeinde');
        break;
      case 'aktivitaet':
        filtered = filtered.filter(event => event.type === 'aktivitaet');
        break;
      case 'angemeldet':
        filtered = filtered.filter(event => event.is_registered);
        break;
      case 'verfuegbar':
        filtered = filtered.filter(event => !event.is_registered && event.can_register);
        break;
    }

    // Sort by date
    return filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'gottesdienst': return '#8b5cf6';
      case 'gemeinde': return '#2dd36f';
      case 'aktivitaet': return '#3880ff';
      default: return '#667eea';
    }
  };

  const getTypeText = (type: string) => {
    switch (type) {
      case 'gottesdienst': return 'Gottesdienst';
      case 'gemeinde': return 'Gemeinde';
      case 'aktivitaet': return 'Aktivität';
      default: return type;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'gottesdienst': return heart;
      case 'gemeinde': return people;
      case 'aktivitaet': return flash;
      default: return calendar;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isEventSoon = (dateString: string) => {
    const eventDate = new Date(dateString);
    const now = new Date();
    const diffHours = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    return diffHours <= 48 && diffHours > 0; // Within 48 hours
  };

  const isEventPast = (dateString: string) => {
    return new Date(dateString) < new Date();
  };

  const getRegisteredCount = () => {
    return events.filter(event => event.is_registered).length;
  };

  const getAvailableCount = () => {
    return events.filter(event => !event.is_registered && event.can_register).length;
  };

  const filteredEvents = getFilteredEvents();

  if (loading) {
    return <LoadingSpinner message="Events werden geladen..." />;
  }

  return (
    <IonPage>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Events</IonTitle>
        </IonToolbar>
      </IonHeader>
      
      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar style={{ '--background': 'transparent', '--color': 'black' }}>
            <IonTitle size="large" style={{ color: 'black' }}>Events</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          loadEvents();
          e.detail.complete();
        }}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>

        {/* Header Statistiken */}
        <IonCard style={{
          margin: '16px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #3880ff 0%, #3171e0 100%)',
          color: 'white',
          boxShadow: '0 8px 32px rgba(56, 128, 255, 0.3)'
        }}>
          <IonCardContent>
            <IonGrid>
              <IonRow>
                <IonCol size="4">
                  <div style={{ textAlign: 'center' }}>
                    <IonIcon icon={calendar} style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
                    <h3 style={{ margin: '0', fontSize: '1.5rem' }}>
                      {events.length}
                    </h3>
                    <p style={{ margin: '0', fontSize: '0.9rem', opacity: 0.8 }}>
                      Events
                    </p>
                  </div>
                </IonCol>
                <IonCol size="4">
                  <div style={{ textAlign: 'center' }}>
                    <IonIcon icon={checkmark} style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
                    <h3 style={{ margin: '0', fontSize: '1.5rem' }}>
                      {getRegisteredCount()}
                    </h3>
                    <p style={{ margin: '0', fontSize: '0.9rem', opacity: 0.8 }}>
                      Angemeldet
                    </p>
                  </div>
                </IonCol>
                <IonCol size="4">
                  <div style={{ textAlign: 'center' }}>
                    <IonIcon icon={add} style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
                    <h3 style={{ margin: '0', fontSize: '1.5rem' }}>
                      {getAvailableCount()}
                    </h3>
                    <p style={{ margin: '0', fontSize: '0.9rem', opacity: 0.8 }}>
                      Verfügbar
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
                placeholder="Event suchen..."
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
              scrollable
            >
              <IonSegmentButton value="alle">
                <IonLabel>Alle</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="verfuegbar">
                <IonLabel>Verfügbar</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="angemeldet">
                <IonLabel>Angemeldet</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="gottesdienst">
                <IonLabel>Gottesdienst</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="gemeinde">
                <IonLabel>Gemeinde</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="aktivitaet">
                <IonLabel>Aktivität</IonLabel>
              </IonSegmentButton>
            </IonSegment>
          </IonCardContent>
        </IonCard>

        {/* Events Liste */}
        <div style={{ margin: '0 16px' }}>
          {filteredEvents.map((event) => (
            <IonCard 
              key={event.id} 
              button
              onClick={() => {
                setSelectedEvent(event);
                setIsDetailModalOpen(true);
              }}
              style={{ 
                marginBottom: '16px',
                borderRadius: '16px',
                opacity: isEventPast(event.date) ? 0.6 : 1,
                borderLeft: event.is_registered ? `4px solid #2dd36f` : `4px solid ${getTypeColor(event.type)}`
              }}
            >
              <IonCardContent style={{ padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '12px',
                    background: event.is_registered 
                      ? 'linear-gradient(135deg, #2dd36f 0%, #26c764 100%)'
                      : `linear-gradient(135deg, ${getTypeColor(event.type)} 0%, ${getTypeColor(event.type)}cc 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <IonIcon 
                      icon={event.is_registered ? checkmark : getTypeIcon(event.type)} 
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
                      {event.title}
                      {isEventSoon(event.date) && !isEventPast(event.date) && (
                        <IonIcon 
                          icon={warning} 
                          style={{ 
                            fontSize: '0.9rem', 
                            color: '#ffcc00', 
                            marginLeft: '6px' 
                          }} 
                        />
                      )}
                    </h3>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <IonIcon icon={calendar} style={{ fontSize: '0.9rem', color: '#666' }} />
                        <span style={{ fontSize: '0.85rem', color: '#666' }}>
                          {formatDate(event.date)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <IonIcon icon={time} style={{ fontSize: '0.9rem', color: '#666' }} />
                        <span style={{ fontSize: '0.85rem', color: '#666' }}>
                          {formatTime(event.date)}
                        </span>
                      </div>
                    </div>

                    {event.location && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                        <IonIcon icon={location} style={{ fontSize: '0.9rem', color: '#666' }} />
                        <span style={{ fontSize: '0.85rem', color: '#666' }}>
                          {event.location}
                        </span>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <IonChip 
                        color={event.is_registered ? 'success' : 'primary'}
                        style={{ 
                          fontSize: '0.75rem', 
                          height: '22px',
                          '--background': event.is_registered 
                            ? 'rgba(45, 211, 111, 0.15)' 
                            : `${getTypeColor(event.type)}20`,
                          '--color': event.is_registered ? '#2dd36f' : getTypeColor(event.type)
                        }}
                      >
                        {event.is_registered ? 'Angemeldet' : getTypeText(event.type)}
                      </IonChip>
                      
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
                        {event.points} {event.points === 1 ? 'Punkt' : 'Punkte'}
                      </IonChip>

                      {event.max_participants && (
                        <IonChip 
                          color="medium"
                          style={{ 
                            fontSize: '0.75rem', 
                            height: '22px',
                            '--background': 'rgba(146, 146, 150, 0.15)',
                            '--color': '#929296'
                          }}
                        >
                          <IonIcon icon={people} style={{ fontSize: '0.7rem', marginRight: '2px' }} />
                          {event.current_participants}/{event.max_participants}
                        </IonChip>
                      )}

                      {isEventSoon(event.date) && !isEventPast(event.date) && (
                        <IonChip 
                          color="warning"
                          style={{ 
                            fontSize: '0.75rem', 
                            height: '22px',
                            '--background': 'rgba(255, 204, 0, 0.15)',
                            '--color': '#ffcc00'
                          }}
                        >
                          Bald!
                        </IonChip>
                      )}

                      {isEventPast(event.date) && (
                        <IonChip 
                          color="medium"
                          style={{ 
                            fontSize: '0.75rem', 
                            height: '22px',
                            '--background': 'rgba(146, 146, 150, 0.15)',
                            '--color': '#929296'
                          }}
                        >
                          Vergangen
                        </IonChip>
                      )}
                    </div>
                  </div>
                </div>
              </IonCardContent>
            </IonCard>
          ))}

          {filteredEvents.length === 0 && (
            <IonCard style={{ marginBottom: '32px', textAlign: 'center', padding: '32px' }}>
              <IonIcon icon={calendar} style={{ fontSize: '3rem', color: '#ccc', marginBottom: '16px' }} />
              <h3 style={{ color: '#666', margin: '0 0 8px 0' }}>Keine Events gefunden</h3>
              <p style={{ color: '#999', margin: '0' }}>
                {searchTerm.trim() 
                  ? 'Versuche einen anderen Suchbegriff'
                  : 'Schau später wieder vorbei!'
                }
              </p>
            </IonCard>
          )}
        </div>

        {/* Event Detail Modal */}
        <IonModal isOpen={isDetailModalOpen} onDidDismiss={() => setIsDetailModalOpen(false)}>
          {selectedEvent && (
            <IonPage>
              <IonHeader>
                <IonToolbar>
                  <IonTitle>{selectedEvent.title}</IonTitle>
                  <IonButtons slot="end">
                    <IonButton onClick={() => setIsDetailModalOpen(false)}>
                      <IonIcon icon={close} />
                    </IonButton>
                  </IonButtons>
                </IonToolbar>
              </IonHeader>
              <IonContent>
                <div style={{ padding: '16px' }}>
                  {/* Event Header */}
                  <div style={{
                    background: `linear-gradient(135deg, ${getTypeColor(selectedEvent.type)} 0%, ${getTypeColor(selectedEvent.type)}cc 100%)`,
                    borderRadius: '16px',
                    padding: '24px',
                    color: 'white',
                    marginBottom: '16px',
                    textAlign: 'center'
                  }}>
                    <IonIcon 
                      icon={getTypeIcon(selectedEvent.type)} 
                      style={{ fontSize: '3rem', marginBottom: '12px' }} 
                    />
                    <h1 style={{ margin: '0 0 8px 0', fontSize: '1.4rem' }}>
                      {selectedEvent.title}
                    </h1>
                    <p style={{ margin: '0', opacity: 0.9 }}>
                      {getTypeText(selectedEvent.type)}
                    </p>
                  </div>

                  {/* Event Details */}
                  <IonCard>
                    <IonCardContent>
                      <h3 style={{ margin: '0 0 16px 0' }}>Event-Details</h3>
                      
                      <IonItem lines="none" style={{ '--padding-start': '0', '--inner-padding-end': '0' }}>
                        <IonIcon icon={calendar} slot="start" color="primary" />
                        <IonLabel>
                          <h3>Datum & Zeit</h3>
                          <p>{formatDate(selectedEvent.date)} um {formatTime(selectedEvent.date)}</p>
                        </IonLabel>
                      </IonItem>

                      {selectedEvent.location && (
                        <IonItem lines="none" style={{ '--padding-start': '0', '--inner-padding-end': '0' }}>
                          <IonIcon icon={location} slot="start" color="success" />
                          <IonLabel>
                            <h3>Ort</h3>
                            <p>{selectedEvent.location}</p>
                          </IonLabel>
                        </IonItem>
                      )}

                      <IonItem lines="none" style={{ '--padding-start': '0', '--inner-padding-end': '0' }}>
                        <IonIcon icon={star} slot="start" color="warning" />
                        <IonLabel>
                          <h3>Punkte</h3>
                          <p>{selectedEvent.points} {selectedEvent.points === 1 ? 'Punkt' : 'Punkte'}</p>
                        </IonLabel>
                      </IonItem>

                      {selectedEvent.max_participants && (
                        <IonItem lines="none" style={{ '--padding-start': '0', '--inner-padding-end': '0' }}>
                          <IonIcon icon={people} slot="start" color="tertiary" />
                          <IonLabel>
                            <h3>Teilnehmer</h3>
                            <p>{selectedEvent.current_participants} von {selectedEvent.max_participants} Plätzen belegt</p>
                          </IonLabel>
                        </IonItem>
                      )}

                      {selectedEvent.registration_deadline && (
                        <IonItem lines="none" style={{ '--padding-start': '0', '--inner-padding-end': '0' }}>
                          <IonIcon icon={time} slot="start" color="danger" />
                          <IonLabel>
                            <h3>Anmeldeschluss</h3>
                            <p>{formatDate(selectedEvent.registration_deadline)}</p>
                          </IonLabel>
                        </IonItem>
                      )}
                    </IonCardContent>
                  </IonCard>

                  {/* Description */}
                  {selectedEvent.description && (
                    <IonCard>
                      <IonCardContent>
                        <h3 style={{ margin: '0 0 12px 0' }}>Beschreibung</h3>
                        <p style={{ margin: '0', lineHeight: '1.5' }}>
                          {selectedEvent.description}
                        </p>
                      </IonCardContent>
                    </IonCard>
                  )}

                  {/* Categories */}
                  {selectedEvent.categories && selectedEvent.categories.length > 0 && (
                    <IonCard>
                      <IonCardContent>
                        <h3 style={{ margin: '0 0 12px 0' }}>Kategorien</h3>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {selectedEvent.categories.map(category => (
                            <IonChip 
                              key={category.id}
                              style={{ 
                                '--background': `${category.color}20`,
                                '--color': category.color,
                                fontSize: '0.8rem'
                              }}
                            >
                              {category.name}
                            </IonChip>
                          ))}
                        </div>
                      </IonCardContent>
                    </IonCard>
                  )}

                  {/* Action Buttons */}
                  <div style={{ marginTop: '24px' }}>
                    {selectedEvent.is_registered ? (
                      <IonButton 
                        expand="block" 
                        color="danger" 
                        onClick={() => handleUnregisterEvent(selectedEvent)}
                        disabled={isEventPast(selectedEvent.date)}
                      >
                        <IonIcon icon={close} slot="start" />
                        Abmelden
                      </IonButton>
                    ) : (
                      <IonButton 
                        expand="block" 
                        color="success" 
                        onClick={() => handleRegisterEvent(selectedEvent)}
                        disabled={!selectedEvent.can_register || isEventPast(selectedEvent.date)}
                      >
                        <IonIcon icon={checkmark} slot="start" />
                        {selectedEvent.can_register ? 'Anmelden' : 'Anmeldung nicht möglich'}
                      </IonButton>
                    )}

                    {!selectedEvent.can_register && selectedEvent.registration_message && (
                      <IonItem 
                        lines="none" 
                        style={{ 
                          '--background': 'rgba(245, 61, 61, 0.1)', 
                          marginTop: '8px',
                          borderRadius: '8px'
                        }}
                      >
                        <IonIcon icon={informationCircle} slot="start" color="danger" />
                        <IonLabel>
                          <p style={{ color: '#f53d3d', fontSize: '0.85rem' }}>
                            {selectedEvent.registration_message}
                          </p>
                        </IonLabel>
                      </IonItem>
                    )}
                  </div>
                </div>
              </IonContent>
            </IonPage>
          )}
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default KonfiEventsPage;