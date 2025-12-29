import React, { useState, useRef } from 'react';
import {
  IonCard,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonInput,
  IonSegment,
  IonSegmentButton
} from '@ionic/react';
import {
  trash,
  calendar,
  home,
  people,
  flash,
  pricetag,
  filterOutline,
  flashOutline
} from 'ionicons/icons';
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
  canEdit: boolean;
  canDelete: boolean;
}

const ActivitiesView: React.FC<ActivitiesViewProps> = ({
  activities,
  onUpdate,
  onAddActivityClick,
  onSelectActivity,
  onDeleteActivity,
  canEdit,
  canDelete
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('alle');
  const slidingRefs = useRef<Map<number, HTMLIonItemSlidingElement>>(new Map());

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
      case 'gemeinde': return 'primary';
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

  const handleDeleteWithSlideClose = async (activity: Activity) => {
    const slidingElement = slidingRefs.current.get(activity.id);
    
    try {
      await onDeleteActivity(activity);
      // Bei erfolgreichem Löschen schließt sich das Sliding automatisch durch den Re-render
    } catch (error) {
      // Bei Fehler: Sliding automatisch schließen für bessere UX
      if (slidingElement) {
        await slidingElement.close();
      }
      // Der Fehler wird bereits im Parent (AdminActivitiesPage) behandelt und angezeigt
    }
  };

  return (
    <>
      {/* Header - Dashboard-Style */}
      <div style={{
        background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
        borderRadius: '24px',
        padding: '0',
        margin: '16px',
        marginBottom: '16px',
        boxShadow: '0 20px 40px rgba(22, 163, 74, 0.3)',
        position: 'relative',
        overflow: 'hidden',
        minHeight: '220px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Überschrift - groß und überlappend */}
        <div style={{
          position: 'absolute',
          top: '-5px',
          left: '12px',
          zIndex: 1
        }}>
          <h2 style={{
            fontSize: '4rem',
            fontWeight: '900',
            color: 'rgba(255, 255, 255, 0.1)',
            margin: '0',
            lineHeight: '0.8',
            letterSpacing: '-2px'
          }}>
            AKTIVITÄTEN
          </h2>
        </div>

        {/* Content */}
        <div style={{
          position: 'relative',
          zIndex: 2,
          padding: '70px 24px 24px 24px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <IonGrid style={{ padding: '0', margin: '0 4px' }}>
            <IonRow>
              <IonCol size="4" style={{ padding: '0 4px' }}>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '12px',
                  padding: '16px 12px',
                  color: 'white',
                  textAlign: 'center'
                }}>
                  <IonIcon
                    icon={calendar}
                    style={{
                      fontSize: '1.5rem',
                      color: 'rgba(255, 255, 255, 0.9)',
                      marginBottom: '8px',
                      display: 'block',
                      margin: '0 auto 8px auto'
                    }}
                  />
                  <div style={{ fontSize: '1.3rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '1.5rem' }}>{activities.length}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                    Gesamt
                  </div>
                </div>
              </IonCol>
              <IonCol size="4" style={{ padding: '0 4px' }}>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '12px',
                  padding: '16px 12px',
                  color: 'white',
                  textAlign: 'center'
                }}>
                  <IonIcon
                    icon={people}
                    style={{
                      fontSize: '1.5rem',
                      color: 'rgba(255, 255, 255, 0.9)',
                      marginBottom: '8px',
                      display: 'block',
                      margin: '0 auto 8px auto'
                    }}
                  />
                  <div style={{ fontSize: '1.3rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '1.5rem' }}>{getGemeindeActivities().length}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                    Gemeinde
                  </div>
                </div>
              </IonCol>
              <IonCol size="4" style={{ padding: '0 4px' }}>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '12px',
                  padding: '16px 12px',
                  color: 'white',
                  textAlign: 'center'
                }}>
                  <IonIcon
                    icon={home}
                    style={{
                      fontSize: '1.5rem',
                      color: 'rgba(255, 255, 255, 0.9)',
                      marginBottom: '8px',
                      display: 'block',
                      margin: '0 auto 8px auto'
                    }}
                  />
                  <div style={{ fontSize: '1.3rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '1.5rem' }}>{getGottesdienstActivities().length}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                    GoDi
                  </div>
                </div>
              </IonCol>
            </IonRow>
          </IonGrid>
        </div>
      </div>

      {/* Suche & Filter - iOS26 Pattern */}
      <IonList inset={true} style={{ margin: '16px' }}>
        <IonListHeader>
          <div className="app-section-icon app-section-icon--activities">
            <IonIcon icon={filterOutline} />
          </div>
          <IonLabel>Suche & Filter</IonLabel>
        </IonListHeader>
        <IonCard className="app-card">
          <IonCardContent style={{ padding: '16px' }}>
            <IonList style={{ background: 'transparent' }}>
              {/* Suchfeld */}
              <IonItem lines="full" style={{ '--background': 'transparent' }}>
                <IonLabel position="stacked">Aktivität suchen</IonLabel>
                <IonInput
                  value={searchTerm}
                  onIonInput={(e) => setSearchTerm(e.detail.value!)}
                  placeholder="Name eingeben..."
                  clearInput={true}
                />
              </IonItem>
              {/* Typ Filter */}
              <IonItem lines="none" style={{ '--background': 'transparent' }}>
                <IonLabel position="stacked">Typ</IonLabel>
                <IonSegment
                  value={selectedType}
                  onIonChange={(e) => setSelectedType(e.detail.value as string)}
                  style={{ marginTop: '8px' }}
                >
                  <IonSegmentButton value="alle">
                    <IonLabel style={{ fontSize: '0.8rem' }}>Alle</IonLabel>
                  </IonSegmentButton>
                  <IonSegmentButton value="gemeinde">
                    <IonLabel style={{ fontSize: '0.8rem' }}>Gemeinde</IonLabel>
                  </IonSegmentButton>
                  <IonSegmentButton value="gottesdienst">
                    <IonLabel style={{ fontSize: '0.8rem' }}>GoDi</IonLabel>
                  </IonSegmentButton>
                </IonSegment>
              </IonItem>
            </IonList>
          </IonCardContent>
        </IonCard>
      </IonList>

      {/* Aktivitäten Liste - iOS26 Pattern */}
      <IonList inset={true} style={{ margin: '16px' }}>
        <IonListHeader>
          <div className="app-section-icon app-section-icon--activities">
            <IonIcon icon={flashOutline} />
          </div>
          <IonLabel>Aktivitäten ({filteredAndSortedActivities.length})</IonLabel>
        </IonListHeader>
        <IonCard className="app-card">
          <IonCardContent style={{ padding: '16px' }}>
            <IonList lines="none" style={{ background: 'transparent', padding: '0', margin: '0' }}>
            {filteredAndSortedActivities.map((activity) => (
              <IonItemSliding
                key={activity.id}
                ref={(el) => {
                  if (el) {
                    slidingRefs.current.set(activity.id, el);
                  } else {
                    slidingRefs.current.delete(activity.id);
                  }
                }}
              >
                <IonItem
                  button={canEdit}
                  onClick={canEdit ? () => onSelectActivity(activity) : undefined}
                  detail={false}
                  style={{
                    '--min-height': '72px',
                    '--padding-start': '16px',
                    '--padding-top': '0px',
                    '--padding-bottom': '0px',
                    '--background': '#fbfbfb',
                    '--border-radius': '12px',
                    margin: '4px 8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    border: '1px solid #e0e0e0',
                    borderRadius: '12px',
                    opacity: canEdit ? 1 : 0.6,
                    cursor: canEdit ? 'pointer' : 'default'
                  }}
                >
                  <IonLabel>
                    {/* Header mit Icon und Badge */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '6px',
                      position: 'relative'
                    }}>
                      {/* Activity Icon - 32px wie andere Views */}
                      <div style={{
                        width: '32px',
                        height: '32px',
                        backgroundColor: activity.type === 'gottesdienst' ? '#007aff' : '#2dd36f',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: activity.type === 'gottesdienst'
                          ? '0 2px 8px rgba(0, 122, 255, 0.4)'
                          : '0 2px 8px rgba(45, 211, 111, 0.4)'
                      }}>
                        <IonIcon
                          icon={getTypeIcon(activity.type)}
                          style={{
                            fontSize: '0.9rem',
                            color: 'white'
                          }}
                        />
                      </div>

                      {/* Activity Name */}
                      <h2 style={{
                        fontWeight: '600',
                        fontSize: 'clamp(0.9rem, 2.5vw, 1rem)',
                        margin: '0',
                        color: '#333',
                        lineHeight: '1.3',
                        flex: 1,
                        minWidth: 0,
                        maxWidth: 'calc(100% - 100px)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {activity.name}
                      </h2>

                      {/* Points Badge */}
                      <span style={{
                        fontSize: '0.7rem',
                        color: activity.type === 'gottesdienst' ? '#007aff' : '#2dd36f',
                        fontWeight: '600',
                        backgroundColor: activity.type === 'gottesdienst' ? 'rgba(0, 122, 255, 0.15)' : 'rgba(45, 211, 111, 0.15)',
                        padding: '3px 6px',
                        borderRadius: '6px',
                        border: activity.type === 'gottesdienst' ? '1px solid rgba(0, 122, 255, 0.3)' : '1px solid rgba(45, 211, 111, 0.3)',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                        position: 'absolute',
                        right: '0px',
                        top: '50%',
                        transform: 'translateY(-50%)'
                      }}>
                        +{activity.points}
                      </span>
                    </div>

                    {/* Type and Categories */}
                    <div style={{
                      fontSize: '0.8rem',
                      color: '#666',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      marginLeft: '44px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <IonIcon
                          icon={getTypeIcon(activity.type)}
                          style={{
                            fontSize: '0.8rem',
                            color: activity.type === 'gottesdienst' ? '#007aff' : '#2dd36f'
                          }}
                        />
                        <span>{getTypeText(activity.type)}</span>
                      </div>
                      {activity.categories && activity.categories.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <IonIcon icon={pricetag} style={{ fontSize: '0.8rem', color: '#ff9500' }} />
                          <span>{activity.categories.map(cat => cat.name).join(', ')}</span>
                        </div>
                      )}
                    </div>
                  </IonLabel>
                </IonItem>

                {canDelete && (
                  <IonItemOptions side="end" style={{ gap: '4px', '--ion-item-background': 'transparent' }}>
                    <IonItemOption
                      onClick={() => handleDeleteWithSlideClose(activity)}
                      style={{
                        '--background': 'transparent',
                        '--background-activated': 'transparent',
                        '--background-focused': 'transparent',
                        '--background-hover': 'transparent',
                        '--color': 'transparent',
                        '--ripple-color': 'transparent',
                        padding: '0 2px',
                        paddingRight: '20px',
                        minWidth: '48px',
                        maxWidth: '68px'
                      }}
                    >
                      <div style={{
                        width: '44px',
                        height: '44px',
                        backgroundColor: '#dc3545',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(220, 53, 69, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)'
                      }}>
                        <IonIcon icon={trash} style={{ fontSize: '1.2rem', color: 'white' }} />
                      </div>
                    </IonItemOption>
                  </IonItemOptions>
                )}
              </IonItemSliding>
            ))}
            
            {filteredAndSortedActivities.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px' }}>
                <IonIcon
                  icon={flash}
                  style={{
                    fontSize: '3rem',
                    color: '#16a34a',
                    marginBottom: '16px',
                    display: 'block',
                    margin: '0 auto 16px auto'
                  }}
                />
                <h3 style={{ color: '#666', margin: '0 0 8px 0' }}>Keine Aktivitäten gefunden</h3>
                <p style={{ color: '#999', margin: '0' }}>Noch keine Aktivitäten angelegt</p>
              </div>
            )}
            </IonList>
          </IonCardContent>
        </IonCard>
      </IonList>
    </>
  );
};

export default ActivitiesView;