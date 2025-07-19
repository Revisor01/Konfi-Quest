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
  IonSegment,
  IonSegmentButton,
  useIonActionSheet
} from '@ionic/react';
import { 
  add, 
  trash, 
  create, 
  search,
  calendar,
  star,
  home,
  people
} from 'ionicons/icons';
import { useApp } from '../../contexts/AppContext';
import { filterBySearchTerm } from '../../utils/helpers';

interface Activity {
  id: number;
  name: string;
  description?: string;
  points: number;
  type: 'gottesdienst' | 'gemeinde';
  categories?: {id: number, name: string}[];
  created_at: string;
}

interface ActivitiesViewProps {
  activities: Activity[];
  onUpdate: () => void;
  onAddActivityClick: () => void;
  onSelectActivity: (activity: Activity) => void;
  onDeleteActivity: (activity: Activity) => void;
}

const ActivitiesView: React.FC<ActivitiesViewProps> = ({ 
  activities, 
  onUpdate, 
  onAddActivityClick,
  onSelectActivity,
  onDeleteActivity
}) => {
  const [presentActionSheet] = useIonActionSheet();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('alle');

  const filteredAndSortedActivities = (() => {
    let result = filterBySearchTerm(activities, searchTerm, ['name', 'description']);
    
    // Filter by type
    if (selectedType !== 'alle') {
      result = result.filter(activity => activity.type === selectedType);
    }
    
    // Sort by name
    result = result.sort((a, b) => a.name.localeCompare(b.name));
    
    return result;
  })();

  const getGottesdienstActivities = () => {
    return activities.filter(activity => activity.type === 'gottesdienst');
  };

  const getGemeindeActivities = () => {
    return activities.filter(activity => activity.type === 'gemeinde');
  };


  const getTypeColor = (type: string) => {
    switch (type) {
      case 'gottesdienst': return 'primary';
      case 'gemeinde': return 'success';
      default: return 'medium';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'gottesdienst': return home;
      case 'gemeinde': return people;
      default: return calendar;
    }
  };

  const getTypeText = (type: string) => {
    switch (type) {
      case 'gottesdienst': return 'Gottesdienst';
      case 'gemeinde': return 'Gemeinde';
      default: return 'Unbekannt';
    }
  };

  return (
    <>
      {/* Header Card mit Statistiken */}
      <IonCard style={{
        margin: '16px',
        borderRadius: '16px',
        background: 'linear-gradient(135deg, #007aff 0%, #5856d6 100%)',
        color: 'white',
        boxShadow: '0 8px 32px rgba(0, 122, 255, 0.3)'
      }}>
        <IonCardContent>
          <IonGrid>
            <IonRow>
              <IonCol size="4">
                <div style={{ textAlign: 'center' }}>
                  <IonIcon icon={calendar} style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
                  <h3 style={{ margin: '0', fontSize: '1.5rem' }}>
                    {activities.length}
                  </h3>
                  <p style={{ margin: '0', fontSize: '0.9rem', opacity: 0.8 }}>
                    Aktivitäten
                  </p>
                </div>
              </IonCol>
              <IonCol size="4">
                <div style={{ textAlign: 'center' }}>
                  <IonIcon icon={people} style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
                  <h3 style={{ margin: '0', fontSize: '1.5rem' }}>
                    {getGemeindeActivities().length}
                  </h3>
                  <p style={{ margin: '0', fontSize: '0.9rem', opacity: 0.8 }}>
                    Gemeinde
                  </p>
                </div>
              </IonCol>
              <IonCol size="4">
                <div style={{ textAlign: 'center' }}>
                  <IonIcon icon={home} style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
                  <h3 style={{ margin: '0', fontSize: '1.5rem' }}>
                    {getGottesdienstActivities().length}
                  </h3>
                  <p style={{ margin: '0', fontSize: '0.9rem', opacity: 0.8 }}>
                    Gottesdienst
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
              placeholder="Aktivität suchen..."
              style={{ 
                '--color': '#000',
                '--placeholder-color': '#8e8e93'
              }}
            />
          </IonItem>

          {/* Tab Filter */}
          <IonSegment 
            value={selectedType} 
            onIonChange={(e) => setSelectedType(e.detail.value as string)}
            style={{ 
              '--background': '#f8f9fa',
              borderRadius: '8px',
              padding: '4px'
            }}
          >
            <IonSegmentButton value="alle">
              <IonIcon icon={calendar} style={{ fontSize: '1rem', marginRight: '4px' }} />
              <IonLabel>Alle</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="gemeinde">
              <IonIcon icon={people} style={{ fontSize: '1rem', marginRight: '4px' }} />
              <IonLabel>Gemeinde</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="gottesdienst">
              <IonIcon icon={home} style={{ fontSize: '1rem', marginRight: '4px' }} />
              <IonLabel>Gottesdienst</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </IonCardContent>
      </IonCard>

      {/* Aktivitäten Liste */}
      <IonCard style={{ margin: '16px' }}>
        <IonCardContent style={{ padding: '0' }}>
          <IonList>
            {filteredAndSortedActivities.map((activity) => (
              <IonItemSliding key={activity.id}>
                <IonItem 
                  button 
                  onClick={() => onSelectActivity(activity)}
                  style={{ '--min-height': '70px', '--padding-start': '16px' }}
                >
                  <div slot="start" style={{ 
                    width: '40px', 
                    height: '40px',
                    backgroundColor: activity.type === 'gottesdienst' ? '#3880ff' : '#2dd36f',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '12px'
                  }}>
                    <IonIcon 
                      icon={getTypeIcon(activity.type)} 
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
                      {activity.name}
                    </h2>
                    
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <IonBadge 
                          color={getTypeColor(activity.type)}
                          style={{ fontSize: '0.75rem' }}
                        >
                          {activity.points} {activity.points === 1 ? 'Punkt' : 'Punkte'}
                        </IonBadge>
                        
                        {activity.categories && activity.categories.length > 0 && (
                          <span style={{ 
                            fontSize: '0.8rem', 
                            color: '#666',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '120px'
                          }}>
                            {activity.categories.map(cat => cat.name).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {activity.description && (
                      <p style={{ 
                        margin: '0',
                        fontSize: '0.85rem',
                        color: '#666',
                        display: '-webkit-box',
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {activity.description}
                      </p>
                    )}
                  </IonLabel>
                </IonItem>

                <IonItemOptions side="end">
                  <IonItemOption 
                    color="danger" 
                    onClick={() => onDeleteActivity(activity)}
                  >
                    <IonIcon icon={trash} />
                  </IonItemOption>
                </IonItemOptions>
              </IonItemSliding>
            ))}
            
            {filteredAndSortedActivities.length === 0 && (
              <IonItem>
                <IonLabel style={{ textAlign: 'center', color: '#666' }}>
                  <p>Keine Aktivitäten gefunden</p>
                </IonLabel>
              </IonItem>
            )}
          </IonList>
        </IonCardContent>
      </IonCard>
    </>
  );
};

export default ActivitiesView;