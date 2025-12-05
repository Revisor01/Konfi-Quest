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
  people,
  flash
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
  const [presentActionSheet] = useIonActionSheet();
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

      {/* Suchfeld */}
      <IonCard style={{ margin: '16px' }}>
        <IonCardContent style={{ padding: '14px 16px' }}>
          <IonItem
            lines="none"
            style={{
              '--background': '#f8f9fa',
              '--border-radius': '12px',
              '--padding-start': '12px',
              '--padding-end': '12px',
              margin: '0'
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
        </IonCardContent>
      </IonCard>

      {/* Filter */}
      <IonCard style={{ margin: '16px' }}>
        <IonCardContent style={{ padding: '14px 16px' }}>
          <IonSegment
            value={selectedType}
            onIonChange={(e) => setSelectedType(e.detail.value as string)}
            style={{
              '--background': '#f8f9fa',
              borderRadius: '12px',
              padding: '4px'
            }}
          >
            <IonSegmentButton value="alle">
              <IonLabel style={{ fontWeight: '600', fontSize: '0.75rem' }}>Alle</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="gemeinde">
              <IonLabel style={{ fontWeight: '600', fontSize: '0.75rem' }}>Gemeinde</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="gottesdienst">
              <IonLabel style={{ fontWeight: '600', fontSize: '0.75rem' }}>Gottesdienst</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </IonCardContent>
      </IonCard>

      {/* Aktivitäten Liste */}
      <IonCard style={{ margin: '16px' }}>
        <IonCardContent style={{ padding: '8px 0' }}>
          <IonList lines="none" style={{ background: 'transparent' }}>
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
                      gap: '6px',
                      marginLeft: '44px'
                    }}>
                      <span>
                        {getTypeText(activity.type)}
                        {activity.categories && activity.categories.length > 0 && (
                          <> • {activity.categories.map(cat => cat.name).join(', ')}</>
                        )}
                      </span>
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
    </>
  );
};

export default ActivitiesView;