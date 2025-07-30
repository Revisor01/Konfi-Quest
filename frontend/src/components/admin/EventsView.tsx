import React, { useState, useRef } from 'react';
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
import { parseLocalTime, getLocalNow } from '../../utils/dateUtils';

interface Category {
  id: number;
  name: string;
}

interface Event {
  id: number;
  name: string;
  description?: string;
  event_date: string;
  event_end_time?: string;
  location?: string;
  location_maps_url?: string;
  points: number;
  categories?: Category[];
  type: string;
  max_participants: number;
  registration_opens_at?: string;
  registration_closes_at?: string;
  registered_count: number;
  registration_status: 'upcoming' | 'open' | 'closed';
  created_at: string;
  waitlist_enabled?: boolean;
  max_waitlist_size?: number;
}

interface EventsViewProps {
  events: Event[];
  onUpdate: () => void;
  onAddEventClick: () => void;
  onSelectEvent: (event: Event) => void;
  onDeleteEvent?: (event: Event) => void;
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
  const slidingRefs = useRef<Map<number, HTMLIonItemSlidingElement>>(new Map());

  const filteredAndSortedEvents = (() => {
    let result = events.filter(event => {
      const searchFields = [
        event.name,
        event.description || '',
        ...(event.categories?.map(cat => cat.name) || [])
      ];
      return searchFields.some(field => 
        field.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
    
    // Filter by status
    if (selectedStatus !== 'alle') {
      result = result.filter(event => calculateRegistrationStatus(event) === selectedStatus);
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

  const getOpenEvents = () => {
    return events.filter(event => calculateRegistrationStatus(event) === 'open');
  };

  const getTotalPoints = () => {
    return events.reduce((sum, event) => sum + event.points, 0);
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

  const calculateRegistrationStatus = (event: Event): 'upcoming' | 'open' | 'closed' => {
    // Use the backend-calculated status directly
    return event.registration_status;
  };

  const getRegistrationStatusColor = (event: Event) => {
    const status = calculateRegistrationStatus(event);
    switch (status) {
      case 'upcoming': return 'medium';
      case 'open': return 'success';
      case 'closed': return 'danger';
      default: return 'medium';
    }
  };

  const getRegistrationStatusText = (event: Event) => {
    const status = calculateRegistrationStatus(event);
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
        background: 'linear-gradient(135deg, #eb445a 0%, #e91e63 50%, #d81b60 100%)',
        color: 'white',
        boxShadow: '0 8px 32px rgba(235, 68, 90, 0.4)'
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
                    {getOpenEvents().length}
                  </h3>
                  <p style={{ margin: '0', fontSize: '0.9rem', opacity: 0.8 }}>
                    Buchbar
                  </p>
                </div>
              </IonCol>
              <IonCol size="4">
                <div style={{ textAlign: 'center' }}>
                  <IonIcon icon={calendar} style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
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
                  style={{ '--min-height': '80px', '--padding-start': '16px', '--padding-top': '12px', '--padding-bottom': '12px' }}
                >
                  <IonLabel>
                    {/* Titel und Status */}
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      marginBottom: '8px'
                    }}>
                      <h2 style={{ 
                        fontWeight: '600', 
                        fontSize: '1.1rem',
                        margin: '0',
                        color: '#333'
                      }}>
                        {event.name}
                      </h2>
                      <span style={{
                        fontSize: '0.8rem',
                        color: calculateRegistrationStatus(event) === 'open' ? '#28a745' : 
                              calculateRegistrationStatus(event) === 'upcoming' ? '#6c757d' : '#dc3545',
                        fontWeight: '500'
                      }}>
                        ({calculateRegistrationStatus(event) === 'open' ? 'offen' : 
                          calculateRegistrationStatus(event) === 'upcoming' ? 'bald' : 'geschlossen'})
                      </span>
                    </div>
                    
                    {/* Teilnehmer, Warteliste, Punkte */}
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      gap: '16px',
                      marginBottom: '8px',
                      fontSize: '0.85rem',
                      color: '#666'
                    }}>
                      <span style={{ fontWeight: '500', color: '#333' }}>
                        {event.registered_count}/{event.max_participants}
                      </span>
                      
                      {event.waitlist_enabled && (
                        <span style={{ color: '#6c757d' }}>
                          • Warteliste: {(event as any).pending_count || 0}/{event.max_waitlist_size || 0}
                        </span>
                      )}
                      
                      {event.points > 0 && (
                        <span style={{ color: '#6c757d' }}>
                          • {event.points} Punkte
                        </span>
                      )}
                    </div>
                    
                    {/* Datum und Zeit */}
                    <div style={{ 
                      fontSize: '0.85rem',
                      color: '#666',
                      marginBottom: '4px'
                    }}>
                      <span style={{ fontWeight: '500', color: '#333' }}>
                        {formatDate(event.event_date)}
                      </span>
                      <span style={{ color: '#6c757d', margin: '0 8px' }}>
                        {formatTime(event.event_date)}
                        {event.event_end_time && ` - ${formatTime(event.event_end_time)}`}
                      </span>
                    </div>
                    
                    {/* Ort */}
                    {event.location && (
                      <div style={{ 
                        fontSize: '0.85rem',
                        color: '#666',
                        marginBottom: '4px'
                      }}>
                        {event.location}
                      </div>
                    )}
                    
                    {/* Kategorien */}
                    {event.categories && event.categories.length > 0 && (
                      <div style={{ 
                        fontSize: '0.8rem',
                        color: '#8e8e93'
                      }}>
                        {event.categories.map(cat => cat.name).join(', ')}
                      </div>
                    )}
                  </IonLabel>
                </IonItem>

                {onDeleteEvent && (
                  <IonItemOptions side="end">
                    <IonItemOption 
                      color="danger" 
                      onClick={() => onDeleteEvent(event)}
                    >
                      <IonIcon icon={trash} />
                    </IonItemOption>
                  </IonItemOptions>
                )}
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