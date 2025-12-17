import React, { useState } from 'react';
import {
  IonCard,
  IonCardContent,
  IonIcon,
  IonLabel,
  IonList,
  IonListHeader,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonInput,
  useIonActionSheet
} from '@ionic/react';
import {
  trash,
  search,
  swapVertical,
  trophy,
  person,
  star,
  calendar,
  people,
  flash,
  filterOutline
} from 'ionicons/icons';
import { filterBySearchTerm } from '../../utils/helpers';

interface Konfi {
  id: number;
  name: string;
  username?: string;
  jahrgang?: string;
  jahrgang_name?: string;
  gottesdienst_points?: number;
  gemeinde_points?: number;
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
  const [sortBy, setSortBy] = useState('name');

  const getTotalPoints = (konfi: Konfi) => {
    const gottesdienst = konfi.gottesdienst_points ?? konfi.points?.gottesdienst ?? 0;
    const gemeinde = konfi.gemeinde_points ?? konfi.points?.gemeinde ?? 0;
    return gottesdienst + gemeinde;
  };

  const getGottesdienstPoints = (konfi: Konfi) => {
    return konfi.gottesdienst_points ?? konfi.points?.gottesdienst ?? 0;
  };

  const getGemeindePoints = (konfi: Konfi) => {
    return konfi.gemeinde_points ?? konfi.points?.gemeinde ?? 0;
  };

  const filteredAndSortedKonfis = (() => {
    let result = konfis;

    result = filterBySearchTerm(result, searchTerm, ['name', 'username']);

    if (selectedJahrgang !== 'alle') {
      result = result.filter(konfi =>
        konfi.jahrgang_name === selectedJahrgang || konfi.jahrgang === selectedJahrgang
      );
    }

    if (sortBy === 'points') {
      result = result.sort((a, b) => getTotalPoints(b) - getTotalPoints(a));
    } else {
      result = result.sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  })();

  const targetGottesdienst = parseInt(settings.target_gottesdienst || '10');
  const targetGemeinde = parseInt(settings.target_gemeinde || '10');
  const targetTotal = targetGottesdienst + targetGemeinde;

  const getInitials = (name: string) => {
    const words = name.trim().split(/\s+/);
    if (words.length === 1) {
      return words[0].substring(0, 2).toUpperCase();
    }
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  };

  return (
    <>
      {/* Header Card mit Statistiken */}
      <div className="app-gradient-header" style={{ margin: '16px', borderRadius: '20px' }}>
        <div style={{ padding: '24px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '20px'
          }}>
            <div>
              <h1 style={{
                fontSize: '1.8rem',
                fontWeight: '800',
                color: 'white',
                margin: '0 0 4px 0'
              }}>
                Konfirmanden
              </h1>
              <p style={{
                fontSize: '0.9rem',
                color: 'rgba(255,255,255,0.8)',
                margin: 0
              }}>
                {filteredAndSortedKonfis.length} von {konfis.length} angezeigt
              </p>
            </div>
            <div style={{
              backgroundColor: 'rgba(255,255,255,0.2)',
              borderRadius: '12px',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <IonIcon icon={star} style={{ color: '#fbbf24', fontSize: '1.1rem' }} />
              <span style={{ color: 'white', fontWeight: '700', fontSize: '1.1rem' }}>
                {konfis.reduce((sum, k) => sum + getTotalPoints(k), 0)}
              </span>
            </div>
          </div>

          {/* Statistik-Chips */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{
              backgroundColor: 'rgba(255,255,255,0.15)',
              borderRadius: '20px',
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <IonIcon icon={people} style={{ color: 'white', fontSize: '0.9rem' }} />
              <span style={{ color: 'white', fontSize: '0.85rem', fontWeight: '500' }}>
                {konfis.length} Konfis
              </span>
            </div>
            <div style={{
              backgroundColor: 'rgba(255,255,255,0.15)',
              borderRadius: '20px',
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <IonIcon icon={calendar} style={{ color: 'white', fontSize: '0.9rem' }} />
              <span style={{ color: 'white', fontSize: '0.85rem', fontWeight: '500' }}>
                {jahrgaenge.length} Jahrgänge
              </span>
            </div>
            <div style={{
              backgroundColor: 'rgba(255,255,255,0.15)',
              borderRadius: '20px',
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <IonIcon icon={trophy} style={{ color: '#fbbf24', fontSize: '0.9rem' }} />
              <span style={{ color: 'white', fontSize: '0.85rem', fontWeight: '500' }}>
                {konfis.reduce((sum, k) => sum + (k.badgeCount || 0), 0)} Badges
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Suche und Filter - iOS26 Pattern */}
      <IonList inset={true} style={{ margin: '16px' }}>
        <IonListHeader>
          <div className="app-section-icon app-section-icon--primary">
            <IonIcon icon={search} />
          </div>
          <IonLabel>Suche & Filter</IonLabel>
        </IonListHeader>
        <IonCard className="app-card">
          <IonCardContent style={{ padding: '12px 16px' }}>
            {/* Suchfeld */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: 'rgba(142, 142, 147, 0.12)',
              borderRadius: '10px',
              padding: '8px 12px',
              marginBottom: '12px'
            }}>
              <IonIcon icon={search} style={{ color: '#8e8e93', fontSize: '1.1rem' }} />
              <IonInput
                value={searchTerm}
                onIonInput={(e) => setSearchTerm(e.detail.value!)}
                placeholder="Konfi suchen..."
                style={{ '--padding-start': '0', '--padding-end': '0' }}
              />
            </div>

            {/* Filter Buttons */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => {
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
                }}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '10px 12px',
                  backgroundColor: selectedJahrgang !== 'alle' ? 'rgba(102, 126, 234, 0.15)' : 'rgba(142, 142, 147, 0.12)',
                  border: selectedJahrgang !== 'alle' ? '1px solid rgba(102, 126, 234, 0.3)' : '1px solid transparent',
                  borderRadius: '10px',
                  color: selectedJahrgang !== 'alle' ? '#667eea' : '#666',
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                <IonIcon icon={filterOutline} style={{ fontSize: '1rem' }} />
                {selectedJahrgang === 'alle' ? 'Jahrgang' : selectedJahrgang}
              </button>
              <button
                onClick={() => {
                  presentActionSheet({
                    header: 'Sortierung wählen',
                    buttons: [
                      { text: 'Nach Name (A-Z)', handler: () => setSortBy('name') },
                      { text: 'Nach Punkten', handler: () => setSortBy('points') },
                      { text: 'Abbrechen', role: 'cancel' }
                    ]
                  });
                }}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '10px 12px',
                  backgroundColor: sortBy !== 'name' ? 'rgba(102, 126, 234, 0.15)' : 'rgba(142, 142, 147, 0.12)',
                  border: sortBy !== 'name' ? '1px solid rgba(102, 126, 234, 0.3)' : '1px solid transparent',
                  borderRadius: '10px',
                  color: sortBy !== 'name' ? '#667eea' : '#666',
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                <IonIcon icon={swapVertical} style={{ fontSize: '1rem' }} />
                {sortBy === 'name' ? 'A-Z' : 'Punkte'}
              </button>
            </div>
          </IonCardContent>
        </IonCard>
      </IonList>

      {/* Konfis Liste - iOS26 Pattern */}
      <IonList inset={true} style={{ margin: '16px' }}>
        <IonListHeader>
          <div className="app-section-icon app-section-icon--primary">
            <IonIcon icon={people} />
          </div>
          <IonLabel>Konfirmanden ({filteredAndSortedKonfis.length})</IonLabel>
        </IonListHeader>
        <IonCard className="app-card">
          <IonCardContent style={{ padding: '8px' }}>
            {filteredAndSortedKonfis.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                <IonIcon
                  icon={people}
                  style={{ fontSize: '3rem', color: '#667eea', marginBottom: '12px', display: 'block' }}
                />
                <p style={{ color: '#666', margin: '0 0 4px 0', fontWeight: '600' }}>
                  Keine Konfirmanden gefunden
                </p>
                <p style={{ color: '#999', margin: 0, fontSize: '0.85rem' }}>
                  Versuche andere Suchkriterien
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredAndSortedKonfis.map((konfi) => (
                  <IonItemSliding key={konfi.id}>
                    <div
                      className="app-list-item"
                      onClick={() => onSelectKonfi(konfi)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="app-list-item__row">
                        <div className="app-list-item__main">
                          {/* Avatar */}
                          <div
                            className="app-icon-circle"
                            style={{
                              backgroundColor: '#667eea',
                              width: '44px',
                              height: '44px',
                              fontSize: '0.9rem'
                            }}
                          >
                            {getInitials(konfi.name)}
                          </div>

                          {/* Name und Info */}
                          <div className="app-list-item__content" style={{ flex: 1 }}>
                            <div className="app-list-item__title" style={{ fontSize: '1rem' }}>
                              {konfi.name}
                            </div>
                            <div className="app-list-item__meta">
                              <span className="app-list-item__meta-item">
                                <IonIcon icon={calendar} />
                                {konfi.jahrgang_name || konfi.jahrgang || 'Kein Jahrgang'}
                              </span>
                              <span className="app-list-item__meta-item">
                                <IonIcon icon={trophy} style={{ color: '#fbbf24' }} />
                                {konfi.badgeCount || 0}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Punkte-Anzeige rechts */}
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-end',
                          gap: '4px',
                          minWidth: '80px'
                        }}>
                          {/* Gesamtpunkte gross */}
                          <div style={{
                            fontSize: '1.3rem',
                            fontWeight: '800',
                            color: '#667eea'
                          }}>
                            {getTotalPoints(konfi)}
                          </div>
                          {/* Aufschlüsselung klein */}
                          <div style={{
                            display: 'flex',
                            gap: '8px',
                            fontSize: '0.75rem'
                          }}>
                            <span style={{ color: '#3b82f6', fontWeight: '600' }}>
                              {getGottesdienstPoints(konfi)}
                            </span>
                            <span style={{ color: '#ccc' }}>|</span>
                            <span style={{ color: '#22c55e', fontWeight: '600' }}>
                              {getGemeindePoints(konfi)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Progress Bars */}
                      <div style={{
                        marginTop: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}>
                        {/* Gottesdienst + Gemeinde nebeneinander */}
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {targetGottesdienst > 0 && (
                            <div style={{ flex: 1 }}>
                              <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                marginBottom: '2px'
                              }}>
                                <span style={{ fontSize: '0.65rem', color: '#3b82f6', fontWeight: '600' }}>
                                  Godi
                                </span>
                                <span style={{ fontSize: '0.65rem', color: '#999' }}>
                                  {getGottesdienstPoints(konfi)}/{targetGottesdienst}
                                </span>
                              </div>
                              <div style={{
                                height: '4px',
                                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                                borderRadius: '2px',
                                overflow: 'hidden'
                              }}>
                                <div style={{
                                  width: `${Math.min(100, (getGottesdienstPoints(konfi) / targetGottesdienst) * 100)}%`,
                                  height: '100%',
                                  backgroundColor: '#3b82f6',
                                  borderRadius: '2px',
                                  transition: 'width 0.3s ease'
                                }} />
                              </div>
                            </div>
                          )}
                          {targetGemeinde > 0 && (
                            <div style={{ flex: 1 }}>
                              <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                marginBottom: '2px'
                              }}>
                                <span style={{ fontSize: '0.65rem', color: '#22c55e', fontWeight: '600' }}>
                                  Gemeinde
                                </span>
                                <span style={{ fontSize: '0.65rem', color: '#999' }}>
                                  {getGemeindePoints(konfi)}/{targetGemeinde}
                                </span>
                              </div>
                              <div style={{
                                height: '4px',
                                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                                borderRadius: '2px',
                                overflow: 'hidden'
                              }}>
                                <div style={{
                                  width: `${Math.min(100, (getGemeindePoints(konfi) / targetGemeinde) * 100)}%`,
                                  height: '100%',
                                  backgroundColor: '#22c55e',
                                  borderRadius: '2px',
                                  transition: 'width 0.3s ease'
                                }} />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Gesamt-Bar */}
                        {targetTotal > 0 && (
                          <div>
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              marginBottom: '2px'
                            }}>
                              <span style={{ fontSize: '0.7rem', color: '#667eea', fontWeight: '700' }}>
                                Gesamt
                              </span>
                              <span style={{ fontSize: '0.7rem', color: '#666', fontWeight: '600' }}>
                                {getTotalPoints(konfi)}/{targetTotal}
                                {getTotalPoints(konfi) >= targetTotal && (
                                  <span style={{ color: '#10b981', marginLeft: '4px' }}>
                                    ({Math.round((getTotalPoints(konfi) / targetTotal) * 100)}%)
                                  </span>
                                )}
                              </span>
                            </div>
                            <div style={{
                              height: '6px',
                              backgroundColor: 'rgba(102, 126, 234, 0.15)',
                              borderRadius: '3px',
                              overflow: 'hidden'
                            }}>
                              <div style={{
                                width: `${Math.min(100, (getTotalPoints(konfi) / targetTotal) * 100)}%`,
                                height: '100%',
                                backgroundColor: getTotalPoints(konfi) >= targetTotal ? '#10b981' : '#667eea',
                                borderRadius: '3px',
                                transition: 'width 0.3s ease, background-color 0.3s ease'
                              }} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <IonItemOptions side="end">
                      <IonItemOption
                        onClick={() => onDeleteKonfi(konfi)}
                        style={{
                          '--background': 'transparent',
                          '--color': 'transparent',
                          padding: '0 8px',
                          minWidth: '56px'
                        }}
                      >
                        <div style={{
                          width: '44px',
                          height: '44px',
                          backgroundColor: '#ef4444',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)'
                        }}>
                          <IonIcon icon={trash} style={{ fontSize: '1.2rem', color: 'white' }} />
                        </div>
                      </IonItemOption>
                    </IonItemOptions>
                  </IonItemSliding>
                ))}
              </div>
            )}
          </IonCardContent>
        </IonCard>
      </IonList>
    </>
  );
};

export default KonfisView;
