import React, { useState, useRef } from 'react';
import {
  IonCard,
  IonCardContent,
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
  flashOutline,
  search
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
      {/* Header - Kompaktes Banner-Design */}
      <div style={{
        background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
        borderRadius: '20px',
        padding: '24px',
        margin: '16px',
        marginBottom: '16px',
        boxShadow: '0 8px 32px rgba(5, 150, 105, 0.25)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Dekorative Kreise im Hintergrund */}
        <div style={{
          position: 'absolute',
          top: '-30px',
          right: '-30px',
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.1)'
        }} />
        <div style={{
          position: 'absolute',
          bottom: '-20px',
          left: '-20px',
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.08)'
        }} />

        {/* Header mit Icon */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '20px',
          position: 'relative',
          zIndex: 1
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            background: 'rgba(255, 255, 255, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <IonIcon icon={flash} style={{ fontSize: '1.6rem', color: 'white' }} />
          </div>
          <div>
            <h2 style={{
              margin: '0',
              fontSize: '1.4rem',
              fontWeight: '700',
              color: 'white'
            }}>
              Aktivitäten
            </h2>
            <p style={{
              margin: '2px 0 0 0',
              fontSize: '0.85rem',
              color: 'rgba(255, 255, 255, 0.8)'
            }}>
              Punkte und Aufgaben
            </p>
          </div>
        </div>

        {/* Stats Row */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '8px',
          position: 'relative',
          zIndex: 1
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '12px',
            padding: '10px 12px',
            textAlign: 'center',
            flex: '1 1 0',
            maxWidth: '100px'
          }}>
            <div style={{ fontSize: '1.3rem', fontWeight: '800', color: 'white' }}>
              {activities.length}
            </div>
            <div style={{ fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.85)', fontWeight: '600', letterSpacing: '0.3px' }}>
              GESAMT
            </div>
          </div>
          <div style={{
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '12px',
            padding: '10px 12px',
            textAlign: 'center',
            flex: '1 1 0',
            maxWidth: '100px'
          }}>
            <div style={{ fontSize: '1.3rem', fontWeight: '800', color: 'white' }}>
              {getGemeindeActivities().length}
            </div>
            <div style={{ fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.85)', fontWeight: '600', letterSpacing: '0.3px' }}>
              GEMEINDE
            </div>
          </div>
          <div style={{
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '12px',
            padding: '10px 12px',
            textAlign: 'center',
            flex: '1 1 0',
            maxWidth: '100px'
          }}>
            <div style={{ fontSize: '1.3rem', fontWeight: '800', color: 'white' }}>
              {getGottesdienstActivities().length}
            </div>
            <div style={{ fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.85)', fontWeight: '600', letterSpacing: '0.3px' }}>
              GODI
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation - einfaches IonSegment */}
      <div style={{ margin: '16px' }}>
        <IonSegment
          value={selectedType}
          onIonChange={(e) => setSelectedType(e.detail.value as string)}
        >
          <IonSegmentButton value="alle">
            <IonLabel>Alle</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="gemeinde">
            <IonLabel>Gemeinde</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="gottesdienst">
            <IonLabel>GoDi</IonLabel>
          </IonSegmentButton>
        </IonSegment>
      </div>

      {/* Suche */}
      <IonList inset={true} style={{ margin: '16px' }}>
        <IonCard className="app-card">
          <IonCardContent style={{ padding: '8px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <IonIcon icon={search} style={{ color: '#8e8e93', fontSize: '1.2rem', flexShrink: 0 }} />
              <IonInput
                value={searchTerm}
                onIonInput={(e) => setSearchTerm(e.detail.value!)}
                placeholder="Aktivität suchen..."
                clearInput={true}
                style={{ '--padding-start': '0' }}
              />
            </div>
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
            {filteredAndSortedActivities.map((activity, index) => {
              const typeColor = activity.type === 'gottesdienst' ? '#007aff' : '#2dd36f';

              return (
              <IonItemSliding
                key={activity.id}
                ref={(el) => {
                  if (el) {
                    slidingRefs.current.set(activity.id, el);
                  } else {
                    slidingRefs.current.delete(activity.id);
                  }
                }}
                style={{ marginBottom: index < filteredAndSortedActivities.length - 1 ? '8px' : '0' }}
              >
                <IonItem
                  button={canEdit}
                  onClick={canEdit ? () => onSelectActivity(activity) : undefined}
                  detail={false}
                  lines="none"
                  style={{
                    '--background': 'transparent',
                    '--padding-start': '0',
                    '--padding-end': '0',
                    '--inner-padding-end': '0',
                    '--inner-border-width': '0',
                    '--border-style': 'none',
                    '--min-height': 'auto',
                    opacity: canEdit ? 1 : 0.6,
                    cursor: canEdit ? 'pointer' : 'default'
                  }}
                >
                  <div
                    className="app-list-item app-list-item--activities"
                    style={{
                      width: '100%',
                      borderLeftColor: typeColor,
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    {/* Eselsohr-Style Corner Badge */}
                    <div
                      className="app-corner-badge"
                      style={{ backgroundColor: typeColor }}
                    >
                      +{activity.points}P
                    </div>

                    <div className="app-list-item__row">
                      <div className="app-list-item__main">
                        {/* Activity Icon */}
                        <div
                          className="app-icon-circle app-icon-circle--lg"
                          style={{ backgroundColor: typeColor }}
                        >
                          <IonIcon icon={getTypeIcon(activity.type)} />
                        </div>

                        {/* Content */}
                        <div className="app-list-item__content">
                          {/* Zeile 1: Name */}
                          <div
                            className="app-list-item__title"
                            style={{ paddingRight: '60px' }}
                          >
                            {activity.name}
                          </div>

                          {/* Zeile 2: Typ + Kategorien */}
                          <div className="app-list-item__meta">
                            <span className="app-list-item__meta-item">
                              <IonIcon icon={getTypeIcon(activity.type)} style={{ color: typeColor }} />
                              {getTypeText(activity.type)}
                            </span>
                            {activity.categories && activity.categories.length > 0 && (
                              <span className="app-list-item__meta-item">
                                <IonIcon icon={pricetag} style={{ color: '#ff9500' }} />
                                {activity.categories.map(cat => cat.name).join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </IonItem>

                {canDelete && (
                  <IonItemOptions side="end" style={{ '--ion-item-background': 'transparent', border: 'none', gap: '0' } as any}>
                    <IonItemOption
                      onClick={() => handleDeleteWithSlideClose(activity)}
                      style={{ '--background': 'transparent', '--color': 'transparent', padding: '0', minWidth: 'auto', '--border-width': '0' }}
                    >
                      <div className="app-icon-circle app-icon-circle--lg app-icon-circle--danger">
                        <IonIcon icon={trash} />
                      </div>
                    </IonItemOption>
                  </IonItemOptions>
                )}
              </IonItemSliding>
              );
            })}
            
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