import React, { useState } from 'react';
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonBadge,
  IonList,
  IonChip,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonInput,
  IonSelect,
  IonSelectOption,
  useIonActionSheet
} from '@ionic/react';
import { 
  add, 
  trash, 
  create, 
  search, 
  swapVertical, 
  flash,
  people,
  calendar,
  time,
  location
} from 'ionicons/icons';
import { useApp } from '../../contexts/AppContext';
import { filterBySearchTerm } from '../../utils/helpers';

interface Event {
  id: number;
  name: string;
  description?: string;
  event_date: string;
  location?: string;
  location_maps_url?: string;
  points: number;
  category?: string;
  type: string;
  max_participants: number;
  registration_opens_at?: string;
  registration_closes_at?: string;
  registered_count: number;
  registration_status: 'upcoming' | 'open' | 'closed';
  created_at: string;
}

interface EventsViewProps {
  events: Event[];
  onUpdate: () => void;
  onAddEventClick: () => void;
  onSelectEvent: (event: Event) => void;
  onDeleteEvent: (event: Event) => void;
}

const EventsView: React.FC<EventsViewProps> = ({ 
  events, 
  onUpdate, 
  onAddEventClick,
  onSelectEvent,
  onDeleteEvent
}) => {
  const [presentActionSheet] = useIonActionSheet();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('alle');
  const [sortBy, setSortBy] = useState('date'); // 'date', 'name', 'participants'

  const filteredAndSortedEvents = (() => {
    let result = filterBySearchTerm(events, searchTerm, ['name', 'description', 'category']);
    
    // Filter by status
    if (selectedStatus !== 'alle') {
      result = result.filter(event => event.registration_status === selectedStatus);
    }
    
    // Sortierung
    if (sortBy === 'name') {
      result = result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'participants') {
      result = result.sort((a, b) => b.registered_count - a.registered_count);
    } else {
      // Default: nach Datum sortieren
      result = result.sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
    }
    
    return result;
  })();

  const getUpcomingEvents = () => {
    const now = new Date();
    return events.filter(event => new Date(event.event_date) > now);
  };

  const getPastEvents = () => {
    const now = new Date();
    return events.filter(event => new Date(event.event_date) <= now);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRegistrationStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming': return 'medium';
      case 'open': return 'success';
      case 'closed': return 'danger';
      default: return 'medium';
    }
  };

  const getRegistrationStatusText = (status: string) => {
    switch (status) {
      case 'upcoming': return 'Bald verfügbar';
      case 'open': return 'Anmeldung offen';
      case 'closed': return 'Anmeldung geschlossen';
      default: return 'Unbekannt';
    }
  };

  const getTotalRegistrations = () => {
    return events.reduce((sum, event) => sum + event.registered_count, 0);
  };

  const getAverageParticipation = () => {
    if (events.length === 0) return 0;
    const total = events.reduce((sum, event) => sum + (event.registered_count / event.max_participants), 0);
    return Math.round((total / events.length) * 100);
  };

  return (
    <>
      {/* Header Card mit Statistiken */}
      <IonCard style={{
        margin: '16px',
        borderRadius: '16px',
        background: 'linear-gradient(135deg, #eb445a 0%, #e91e63 100%)',
        color: 'white',
        boxShadow: '0 8px 32px rgba(235, 68, 90, 0.3)'
      }}>
        <IonCardContent>
          <IonGrid>
            <IonRow>
              <IonCol size="4">
                <div style={{ textAlign: 'center' }}>
                  <IonIcon icon={flash} style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
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
                  <IonIcon icon={people} style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
                  <h3 style={{ margin: '0', fontSize: '1.5rem' }}>
                    {getTotalRegistrations()}
                  </h3>
                  <p style={{ margin: '0', fontSize: '0.9rem', opacity: 0.8 }}>
                    Anmeldungen
                  </p>
                </div>
              </IonCol>
              <IonCol size="4">
                <div style={{ textAlign: 'center' }}>
                  <IonIcon icon={calendar} style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
                  <h3 style={{ margin: '0', fontSize: '1.5rem' }}>
                    {getUpcomingEvents().length}
                  </h3>
                  <p style={{ margin: '0', fontSize: '0.9rem', opacity: 0.8 }}>
                    Anstehend
                  </p>
                </div>
              </IonCol>
            </IonRow>
          </IonGrid>
        </IonCardContent>
      </IonCard>

      {/* Controls Card */}
      <IonCard style={{ margin: '16px' }}>
        <IonCardContent style={{ padding: '16px' }}>
          <IonGrid>
            <IonRow>
              <IonCol size="12">
                <IonItem 
                  lines="none" 
                  style={{ 
                    '--background': '#f8f9fa',
                    '--border-radius': '8px',
                    marginBottom: '12px',
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
              </IonCol>
            </IonRow>
            <IonRow>
              <IonCol size="12">
                <IonItem button lines="none" style={{ '--background': '#f8f9fa', '--border-radius': '8px', marginBottom: '12px' }} onClick={() => {
                  presentActionSheet({
                    header: 'Status filtern',
                    buttons: [
                      { text: 'Alle Events', handler: () => setSelectedStatus('alle') },
                      { text: 'Anmeldung offen', handler: () => setSelectedStatus('open') },
                      { text: 'Anmeldung geschlossen', handler: () => setSelectedStatus('closed') },
                      { text: 'Bald verfügbar', handler: () => setSelectedStatus('upcoming') },
                      { text: 'Abbrechen', role: 'cancel' }
                    ]
                  });
                }}>
                  <IonLabel>
                    {selectedStatus === 'alle' ? 'Alle Events' : 
                     selectedStatus === 'open' ? 'Anmeldung offen' : 
                     selectedStatus === 'closed' ? 'Anmeldung geschlossen' : 
                     'Bald verfügbar'}
                  </IonLabel>
                </IonItem>
              </IonCol>
            </IonRow>
            <IonRow>
              <IonCol size="12">
                <IonItem button lines="none" style={{ '--background': '#f8f9fa', '--border-radius': '8px' }} onClick={() => {
                  presentActionSheet({
                    header: 'Sortierung wählen',
                    buttons: [
                      { text: 'Nach Datum sortieren', handler: () => setSortBy('date') },
                      { text: 'Nach Name sortieren', handler: () => setSortBy('name') },
                      { text: 'Nach Teilnehmern sortieren', handler: () => setSortBy('participants') },
                      { text: 'Abbrechen', role: 'cancel' }
                    ]
                  });
                }}>
                  <IonLabel>
                    {sortBy === 'date' ? 'Nach Datum sortieren' : 
                     sortBy === 'name' ? 'Nach Name sortieren' : 
                     'Nach Teilnehmern sortieren'}
                  </IonLabel>
                </IonItem>
              </IonCol>
            </IonRow>
          </IonGrid>
        </IonCardContent>
      </IonCard>

      {/* Events Liste */}
      <IonCard style={{ margin: '16px' }}>
        <IonCardContent style={{ padding: '0' }}>
          <IonList>
            {filteredAndSortedEvents.map((event) => (
              <IonItemSliding key={event.id}>
                <IonItem 
                  button 
                  onClick={() => onSelectEvent(event)}
                  style={{ '--min-height': '80px', '--padding-start': '16px' }}
                >
                  <div slot="start" style={{ 
                    width: '40px', 
                    height: '40px',
                    backgroundColor: '#eb445a',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '12px'
                  }}>
                    <IonIcon 
                      icon={flash} 
                      style={{ 
                        fontSize: '1.2rem', 
                        color: 'white'
                      }} 
                    />
                  </div>
                  <IonLabel>
                    <h2 style={{ 
                      fontWeight: '600', 
                      fontSize: '1.1rem',
                      margin: '0 0 6px 0'
                    }}>
                      {event.name}
                    </h2>
                    
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <IonChip 
                        color={getRegistrationStatusColor(event.registration_status)}
                        style={{ 
                          fontSize: '0.7rem', 
                          height: '20px',
                          opacity: 0.8
                        }}
                      >
                        {getRegistrationStatusText(event.registration_status)}
                      </IonChip>
                      
                      <IonChip 
                        color="primary"
                        style={{ 
                          fontSize: '0.7rem', 
                          height: '20px',
                          opacity: 0.7,
                          '--background': 'rgba(56, 128, 255, 0.15)',
                          '--color': '#3880ff'
                        }}
                      >
                        {event.registered_count}/{event.max_participants}
                      </IonChip>
                      
                      {event.points > 0 && (
                        <IonChip 
                          color="tertiary"
                          style={{ 
                            fontSize: '0.7rem', 
                            height: '20px',
                            opacity: 0.7,
                            '--background': 'rgba(112, 69, 246, 0.15)',
                            '--color': '#7045f6'
                          }}
                        >
                          {event.points} Punkte
                        </IonChip>
                      )}
                    </div>
                    
                    <p style={{ 
                      margin: '0',
                      fontSize: '0.85rem',
                      color: '#666'
                    }}>
                      {formatDate(event.event_date)} {formatTime(event.event_date)}
                      {event.location && ` • ${event.location}`}
                      {event.category && ` • ${event.category}`}
                    </p>
                  </IonLabel>
                </IonItem>

                <IonItemOptions side="end">
                  <IonItemOption 
                    color="danger" 
                    onClick={() => onDeleteEvent(event)}
                  >
                    <IonIcon icon={trash} />
                  </IonItemOption>
                </IonItemOptions>
              </IonItemSliding>
            ))}
            
            {filteredAndSortedEvents.length === 0 && (
              <IonItem>
                <IonLabel style={{ textAlign: 'center', color: '#666' }}>
                  <p>Keine Events gefunden</p>
                </IonLabel>
              </IonItem>
            )}
          </IonList>
        </IonCardContent>
      </IonCard>
    </>
  );
};

export default EventsView;