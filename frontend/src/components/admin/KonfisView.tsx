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
  trophy,
  flash,
  person,
  star,
  calendar,
  people
} from 'ionicons/icons';
import { useApp } from '../../contexts/AppContext';
import { filterBySearchTerm } from '../../utils/helpers';

interface Konfi {
  id: number;
  name: string;
  username?: string;
  jahrgang?: string;
  jahrgang_name?: string; // Backend liefert jahrgang_name
  // Backend liefert diese Felder:
  gottesdienst_points?: number;
  gemeinde_points?: number;
  // Legacy support für alte Struktur:
  points?: {
    gottesdienst: number;
    gemeinde: number;
  };
  badgeCount?: number;
  activities_count?: number;
}

interface Jahrgang {
  id: number;
  name: string;
}

interface Settings {
  target_gottesdienst?: string;
  target_gemeinde?: string;
}

interface KonfisViewProps {
  konfis: Konfi[];
  jahrgaenge: Jahrgang[];
  settings: Settings;
  onUpdate: () => void;
  onAddKonfiClick: () => void;
  onSelectKonfi: (konfi: Konfi) => void;
  onDeleteKonfi: (konfi: Konfi) => void;
}

const KonfisView: React.FC<KonfisViewProps> = ({ 
  konfis, 
  jahrgaenge, 
  settings, 
  onUpdate, 
  onAddKonfiClick,
  onSelectKonfi,
  onDeleteKonfi
}) => {
  const [presentActionSheet] = useIonActionSheet();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedJahrgang, setSelectedJahrgang] = useState('alle');
  const [sortBy, setSortBy] = useState('name'); // 'name', 'points'

  const getTotalPoints = (konfi: Konfi) => {
    // Support both new backend structure and legacy structure
    const gottesdienst = konfi.gottesdienst_points ?? konfi.points?.gottesdienst ?? 0;
    const gemeinde = konfi.gemeinde_points ?? konfi.points?.gemeinde ?? 0;
    return gottesdienst + gemeinde;
  };

  const filteredAndSortedKonfis = (() => {
    let result = konfis;
    
    // Suche nach Name/Username
    result = filterBySearchTerm(result, searchTerm, ['name', 'username']);
    
    // Filter nach Jahrgang - angepasst für jahrgang_name
    if (selectedJahrgang !== 'alle') {
      result = result.filter(konfi => 
        konfi.jahrgang_name === selectedJahrgang || konfi.jahrgang === selectedJahrgang
      );
    }
    
    // Sortierung
    if (sortBy === 'points') {
      result = result.sort((a, b) => {
        const totalA = getTotalPoints(a);
        const totalB = getTotalPoints(b);
        return totalB - totalA; // Absteigende Reihenfolge
      });
    } else {
      result = result.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    return result;
  })();

  const showGottesdienstTarget = parseInt(settings.target_gottesdienst || '10') > 0;
  const showGemeindeTarget = parseInt(settings.target_gemeinde || '10') > 0;

  const getProgressColor = (current: number, target: number) => {
    const percentage = (current / target) * 100;
    if (percentage >= 100) return 'success';
    if (percentage >= 75) return 'warning';
    return 'primary';
  };

  const getInitials = (name: string) => {
    const words = name.trim().split(/\s+/);
    if (words.length === 1) {
      return words[0].substring(0, 2).toUpperCase();
    }
    const firstInitial = words[0][0] || '';
    const lastInitial = words[words.length - 1][0] || '';
    return (firstInitial + lastInitial).toUpperCase();
  };

  return (
    <>
      {/* Header Card mit Statistiken - Dashboard-Style */}
      <div style={{
        background: 'linear-gradient(135deg, #5b21b6 0%, #4c1d95 100%)',
        borderRadius: '24px',
        padding: '0',
        margin: '16px',
        marginBottom: '16px',
        boxShadow: '0 20px 40px rgba(91, 33, 182, 0.3)',
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
            KONFIS
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
                    <span style={{ fontSize: '1.5rem' }}>{konfis.length}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                    Konfis
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
                    icon={star}
                    style={{
                      fontSize: '1.5rem',
                      color: 'rgba(255, 255, 255, 0.9)',
                      marginBottom: '8px',
                      display: 'block',
                      margin: '0 auto 8px auto'
                    }}
                  />
                  <div style={{ fontSize: '1.3rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '1.5rem' }}>{konfis.reduce((sum, k) => sum + getTotalPoints(k), 0)}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                    Punkte
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
                    <span style={{ fontSize: '1.5rem' }}>{jahrgaenge.length}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                    Jahrgänge
                  </div>
                </div>
              </IonCol>
            </IonRow>
          </IonGrid>
        </div>
      </div>

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
                    placeholder="Konfi suchen..."
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
                    header: 'Jahrgang wählen',
                    buttons: [
                      { text: 'Alle Jahrgänge', handler: () => setSelectedJahrgang('alle') },
                      ...jahrgaenge.map(jg => ({
                        text: jg.name,
                        handler: () => setSelectedJahrgang(jg.name)
                      })),
                      { text: 'Abbrechen', role: 'cancel' }
                    ]
                  });
                }}>
                  <IonIcon icon={people} slot="start" />
                  <IonLabel>
                    {selectedJahrgang === 'alle' ? 'Alle Jahrgänge' : selectedJahrgang || 'Jahrgang wählen'}
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
                      { text: 'Nach Name (A-Z)', handler: () => setSortBy('name') },
                      { text: 'Nach Punkte (hoch-niedrig)', handler: () => setSortBy('points') },
                      { text: 'Abbrechen', role: 'cancel' }
                    ]
                  });
                }}>
                  <IonIcon icon={swapVertical} slot="start" />
                  <IonLabel>
                    {sortBy === 'name' ? 'Nach Name (A-Z)' : 'Nach Punkte (hoch-niedrig)'}
                  </IonLabel>
                </IonItem>
              </IonCol>
            </IonRow>
          </IonGrid>
        </IonCardContent>
      </IonCard>

      {/* Konfis Liste */}
      <IonCard style={{ margin: '16px' }}>
        <IonCardContent style={{ padding: '8px 0' }}>
          <IonList lines="none" style={{ background: 'transparent' }}>
            {filteredAndSortedKonfis.map((konfi) => (
              <IonItemSliding key={konfi.id}>
                <IonItem
                  button
                  onClick={() => onSelectKonfi(konfi)}
                  style={{
                    '--min-height': '110px',
                    '--padding-start': '16px',
                    '--padding-top': '0px',
                    '--padding-bottom': '0px',
                    '--background': '#fbfbfb',
                    '--border-radius': '12px',
                    margin: '6px 8px',
                    boxShadow: 'none',
                    border: 'none',
                    borderRadius: '12px'
                  }}
                >
                  <IonLabel>
                    {/* Titel mit Icon und Status Badge in einer Reihe */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '8px',
                      position: 'relative'
                    }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        backgroundColor: '#5b21b6',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(91, 33, 182, 0.3)',
                        flexShrink: 0
                      }}>
                        <div style={{
                          color: 'white',
                          fontWeight: '600',
                          fontSize: '0.75rem'
                        }}>
                          {getInitials(konfi.name)}
                        </div>
                      </div>
                      <h2 style={{
                        fontWeight: '600',
                        fontSize: 'clamp(0.9rem, 2.5vw, 1.1rem)',
                        margin: '0',
                        color: '#333',
                        lineHeight: '1.3',
                        flex: 1,
                        minWidth: 0,
                        marginRight: '110px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {konfi.name}
                      </h2>

                      {/* Gesamt-Punkte Badge rechts */}
                      <span style={{
                        fontSize: '0.7rem',
                        color: '#5b21b6',
                        fontWeight: '600',
                        backgroundColor: 'rgba(91, 33, 182, 0.15)',
                        padding: '3px 6px',
                        borderRadius: '6px',
                        border: '1px solid rgba(91, 33, 182, 0.2)',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                        position: 'absolute',
                        right: '16px',
                        top: '50%',
                        transform: 'translateY(-50%)'
                      }}>
                        {getTotalPoints(konfi)} PKT
                      </span>
                    </div>

                    {/* Jahrgang Info */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.8rem',
                      color: '#666',
                      marginBottom: '6px'
                    }}>
                      <span style={{ fontWeight: '400', color: '#666' }}>
                        {konfi.jahrgang_name || konfi.jahrgang} • {konfi.badgeCount || 0} Badges
                      </span>
                    </div>

                    {/* Punkte Details */}
                    <div style={{
                      fontSize: '0.8rem',
                      color: '#666',
                      marginTop: '6px'
                    }}>
                      <div style={{
                        position: 'relative',
                        paddingRight: '60px',
                        minHeight: '44px',
                        display: 'flex',
                        alignItems: 'flex-start'
                      }}>
                        {/* Punkte mit Fortschrittsbalken */}
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}>
                          {/* Gottesdienst Balken */}
                          {showGottesdienstTarget && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }}>
                                <span style={{
                                  fontSize: '0.7rem',
                                  color: '#007aff',
                                  fontWeight: '600'
                                }}>
                                  Gottesdienst
                                </span>
                                <span style={{
                                  fontSize: '0.7rem',
                                  color: '#666',
                                  fontWeight: '500'
                                }}>
                                  {konfi.gottesdienst_points ?? konfi.points?.gottesdienst ?? 0}/{settings.target_gottesdienst}
                                </span>
                              </div>
                              <div style={{
                                width: '100%',
                                height: '4px',
                                backgroundColor: 'rgba(0, 122, 255, 0.15)',
                                borderRadius: '2px',
                                overflow: 'hidden'
                              }}>
                                <div style={{
                                  width: `${Math.min(100, ((konfi.gottesdienst_points ?? konfi.points?.gottesdienst ?? 0) / parseInt(settings.target_gottesdienst || '10')) * 100)}%`,
                                  height: '100%',
                                  backgroundColor: '#007aff',
                                  borderRadius: '2px',
                                  transition: 'width 0.3s ease'
                                }} />
                              </div>
                            </div>
                          )}

                          {/* Gemeinde Balken */}
                          {showGemeindeTarget && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }}>
                                <span style={{
                                  fontSize: '0.7rem',
                                  color: '#2dd36f',
                                  fontWeight: '600'
                                }}>
                                  Gemeinde
                                </span>
                                <span style={{
                                  fontSize: '0.7rem',
                                  color: '#666',
                                  fontWeight: '500'
                                }}>
                                  {konfi.gemeinde_points ?? konfi.points?.gemeinde ?? 0}/{settings.target_gemeinde}
                                </span>
                              </div>
                              <div style={{
                                width: '100%',
                                height: '4px',
                                backgroundColor: 'rgba(45, 211, 111, 0.15)',
                                borderRadius: '2px',
                                overflow: 'hidden'
                              }}>
                                <div style={{
                                  width: `${Math.min(100, ((konfi.gemeinde_points ?? konfi.points?.gemeinde ?? 0) / parseInt(settings.target_gemeinde || '10')) * 100)}%`,
                                  height: '100%',
                                  backgroundColor: '#2dd36f',
                                  borderRadius: '2px',
                                  transition: 'width 0.3s ease'
                                }} />
                              </div>
                            </div>
                          )}

                          {/* Gesamt Balken */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}>
                              <span style={{
                                fontSize: '0.7rem',
                                color: '#5b21b6',
                                fontWeight: '600'
                              }}>
                                Gesamt
                              </span>
                              <span style={{
                                fontSize: '0.7rem',
                                color: '#666',
                                fontWeight: '500'
                              }}>
                                {getTotalPoints(konfi)}/{(parseInt(settings.target_gottesdienst || '10') + parseInt(settings.target_gemeinde || '10'))}
                              </span>
                            </div>
                            <div style={{
                              width: '100%',
                              height: '4px',
                              backgroundColor: 'rgba(91, 33, 182, 0.15)',
                              borderRadius: '2px',
                              overflow: 'hidden'
                            }}>
                              <div style={{
                                width: `${Math.min(100, (getTotalPoints(konfi) / (parseInt(settings.target_gottesdienst || '10') + parseInt(settings.target_gemeinde || '10'))) * 100)}%`,
                                height: '100%',
                                backgroundColor: '#5b21b6',
                                borderRadius: '2px',
                                transition: 'width 0.3s ease'
                              }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </IonLabel>

                </IonItem>

                <IonItemOptions side="end">
                  <IonItemOption 
                    color="danger" 
                    onClick={() => onDeleteKonfi(konfi)}
                  >
                    <IonIcon icon={trash} />
                  </IonItemOption>
                </IonItemOptions>
              </IonItemSliding>
            ))}
            
            {filteredAndSortedKonfis.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px' }}>
                <IonIcon
                  icon={people}
                  style={{
                    fontSize: '3rem',
                    color: '#5b21b6',
                    marginBottom: '16px',
                    display: 'block',
                    margin: '0 auto 16px auto'
                  }}
                />
                <h3 style={{ color: '#666', margin: '0 0 8px 0' }}>Keine Konfirmanden gefunden</h3>
                <p style={{ color: '#999', margin: '0' }}>Versuche andere Suchkriterien!</p>
              </div>
            )}
          </IonList>
        </IonCardContent>
      </IonCard>
    </>
  );
};

export default KonfisView;