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
  calendar,
  star,
  person,
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
  category?: string;
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
  const [sortBy, setSortBy] = useState('name'); // 'name', 'points', 'type'

  const filteredAndSortedActivities = (() => {
    let result = filterBySearchTerm(activities, searchTerm, ['name', 'description', 'category']);
    
    // Filter by type
    if (selectedType !== 'alle') {
      result = result.filter(activity => activity.type === selectedType);
    }
    
    // Sortierung
    if (sortBy === 'points') {
      result = result.sort((a, b) => b.points - a.points);
    } else if (sortBy === 'type') {
      result = result.sort((a, b) => a.type.localeCompare(b.type));
    } else {
      // Default: nach Name sortieren
      result = result.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    return result;
  })();

  const getGottesdienstActivities = () => {
    return activities.filter(activity => activity.type === 'gottesdienst');
  };

  const getGemeindeActivities = () => {
    return activities.filter(activity => activity.type === 'gemeinde');
  };

  const getTotalPoints = () => {
    return activities.reduce((sum, activity) => sum + activity.points, 0);
  };

  const getAveragePoints = () => {
    if (activities.length === 0) return 0;
    return Math.round(getTotalPoints() / activities.length);
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
        background: 'linear-gradient(135deg, #2dd36f 0%, #28ba62 100%)',
        color: 'white',
        boxShadow: '0 8px 32px rgba(45, 211, 111, 0.3)'
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
                  <IonIcon icon={star} style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
                  <h3 style={{ margin: '0', fontSize: '1.5rem' }}>
                    {getTotalPoints()}
                  </h3>
                  <p style={{ margin: '0', fontSize: '0.9rem', opacity: 0.8 }}>
                    Punkte gesamt
                  </p>
                </div>
              </IonCol>
              <IonCol size="4">
                <div style={{ textAlign: 'center' }}>
                  <IonIcon icon={person} style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
                  <h3 style={{ margin: '0', fontSize: '1.5rem' }}>
                    {getAveragePoints()}
                  </h3>
                  <p style={{ margin: '0', fontSize: '0.9rem', opacity: 0.8 }}>
                    Ø Punkte
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
                    placeholder="Aktivität suchen..."
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
                    header: 'Aktivitätstyp wählen',
                    buttons: [
                      { text: 'Alle Aktivitäten', handler: () => setSelectedType('alle') },
                      { text: 'Gottesdienst', handler: () => setSelectedType('gottesdienst') },
                      { text: 'Gemeinde', handler: () => setSelectedType('gemeinde') },
                      { text: 'Abbrechen', role: 'cancel' }
                    ]
                  });
                }}>
                  <IonLabel>
                    {selectedType === 'alle' ? 'Alle Aktivitäten' : 
                     selectedType === 'gottesdienst' ? 'Gottesdienst' : 
                     'Gemeinde'}
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
                      { text: 'Nach Name sortieren', handler: () => setSortBy('name') },
                      { text: 'Nach Punkte sortieren', handler: () => setSortBy('points') },
                      { text: 'Nach Typ sortieren', handler: () => setSortBy('type') },
                      { text: 'Abbrechen', role: 'cancel' }
                    ]
                  });
                }}>
                  <IonLabel>
                    {sortBy === 'name' ? 'Nach Name sortieren' : 
                     sortBy === 'points' ? 'Nach Punkte sortieren' : 
                     'Nach Typ sortieren'}
                  </IonLabel>
                </IonItem>
              </IonCol>
            </IonRow>
          </IonGrid>
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
                    
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <IonChip 
                        color={getTypeColor(activity.type)}
                        style={{ 
                          fontSize: '0.75rem', 
                          height: '22px',
                          opacity: 0.7
                        }}
                      >
                        {getTypeText(activity.type)}
                      </IonChip>
                      
                      <IonChip 
                        color="tertiary"
                        style={{ 
                          fontSize: '0.75rem', 
                          height: '22px',
                          opacity: 0.7,
                          '--background': 'rgba(112, 69, 246, 0.15)',
                          '--color': '#7045f6'
                        }}
                      >
                        {activity.points} {activity.points === 1 ? 'Punkt' : 'Punkte'}
                      </IonChip>
                      
                      {activity.category && (
                        <IonChip 
                          color="warning"
                          style={{ 
                            fontSize: '0.75rem', 
                            height: '22px',
                            opacity: 0.7,
                            '--background': 'rgba(255, 204, 0, 0.15)',
                            '--color': '#ffcc00'
                          }}
                        >
                          {activity.category}
                        </IonChip>
                      )}
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