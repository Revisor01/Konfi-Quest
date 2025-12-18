import React, { useState } from 'react';
import {
  IonCard,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonIcon,
  IonLabel,
  IonList,
  IonListHeader,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonItem,
  IonSearchbar,
  IonSelect,
  IonSelectOption
} from '@ionic/react';
import {
  trash,
  swapVertical,
  star,
  calendar,
  people,
  peopleOutline,
  ribbonOutline,
  searchOutline
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
      result = [...result].sort((a, b) => getTotalPoints(b) - getTotalPoints(a));
    } else {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
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

  // Farbe: Lila für alle auf dem Weg, Grün für fertige
  const getStatusColor = (konfi: Konfi) => {
    const total = getTotalPoints(konfi);
    const percent = targetTotal > 0 ? (total / targetTotal) * 100 : 0;
    if (percent >= 100) return '#10b981'; // Grün - Ziel erreicht
    return '#5b21b6'; // Lila - Auf dem Weg (Sektionsfarbe)
  };

  return (
    <>
      {/* Header - Dashboard-Style */}
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

      {/* Suche & Filter - iOS26 Pattern wie Chat */}
      <IonList inset={true} style={{ margin: '16px' }}>
        <IonListHeader>
          <div className="app-section-icon app-section-icon--primary">
            <IonIcon icon={searchOutline} />
          </div>
          <IonLabel>Suche & Filter</IonLabel>
        </IonListHeader>
        <IonCard className="app-card">
          <IonCardContent style={{ padding: '0' }}>
            {/* Suchfeld */}
            <IonSearchbar
              value={searchTerm}
              onIonInput={(e) => setSearchTerm(e.detail.value!)}
              placeholder="Konfi suchen..."
              style={{
                '--background': 'transparent',
                '--box-shadow': 'none',
                '--border-radius': '0',
                padding: '8px 8px 0 8px'
              }}
            />

            {/* Trennlinie */}
            <div style={{ height: '1px', backgroundColor: 'rgba(0, 0, 0, 0.08)', margin: '0 16px' }} />

            {/* Filter Selects */}
            <div style={{ display: 'flex' }}>
              {/* Jahrgang Filter */}
              <IonItem lines="none" style={{ '--background': 'transparent', flex: 1 }}>
                <IonSelect
                  value={selectedJahrgang}
                  onIonChange={(e) => setSelectedJahrgang(e.detail.value)}
                  interface="popover"
                  placeholder="Jahrgang"
                  style={{ width: '100%' }}
                >
                  <IonSelectOption value="alle">Alle Jahrgänge</IonSelectOption>
                  {jahrgaenge.map(jg => (
                    <IonSelectOption key={jg.id} value={jg.name}>{jg.name}</IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>

              {/* Vertikale Trennlinie */}
              <div style={{ width: '1px', backgroundColor: 'rgba(0, 0, 0, 0.08)', margin: '8px 0' }} />

              {/* Sortierung */}
              <IonItem lines="none" style={{ '--background': 'transparent', flex: 1 }}>
                <IonIcon icon={swapVertical} slot="start" style={{ color: '#5b21b6', marginRight: '8px' }} />
                <IonSelect
                  value={sortBy}
                  onIonChange={(e) => setSortBy(e.detail.value)}
                  interface="popover"
                  style={{ width: '100%' }}
                >
                  <IonSelectOption value="name">Name (A-Z)</IonSelectOption>
                  <IonSelectOption value="points">Punkte</IonSelectOption>
                </IonSelect>
              </IonItem>
            </div>
          </IonCardContent>
        </IonCard>
      </IonList>

      {/* Konfis Liste - iOS26 Pattern */}
      <IonList inset={true} style={{ margin: '16px' }}>
        <IonListHeader>
          <div className="app-section-icon app-section-icon--primary">
            <IonIcon icon={peopleOutline} />
          </div>
          <IonLabel>Konfirmanden ({filteredAndSortedKonfis.length})</IonLabel>
        </IonListHeader>
        <IonCard className="app-card">
          <IonCardContent style={{ padding: '16px' }}>
            {filteredAndSortedKonfis.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px' }}>
                <IonIcon
                  icon={peopleOutline}
                  style={{
                    fontSize: '3rem',
                    color: '#5b21b6',
                    marginBottom: '16px',
                    display: 'block',
                    margin: '0 auto 16px auto'
                  }}
                />
                <h3 style={{ color: '#666', margin: '0 0 8px 0' }}>Keine Konfirmanden gefunden</h3>
                <p style={{ color: '#999', margin: '0' }}>
                  {searchTerm ? 'Versuche andere Suchbegriffe' : 'Noch keine Konfis angelegt'}
                </p>
              </div>
            ) : (
              <IonList lines="none" style={{ background: 'transparent', padding: '0', margin: '0' }}>
                {filteredAndSortedKonfis.map((konfi, index) => {
                  const statusColor = getStatusColor(konfi);
                  const totalPoints = getTotalPoints(konfi);
                  const godiPoints = getGottesdienstPoints(konfi);
                  const gemPoints = getGemeindePoints(konfi);
                  const percentTotal = targetTotal > 0 ? Math.round((totalPoints / targetTotal) * 100) : 0;
                  const percentGodi = targetGottesdienst > 0 ? Math.round((godiPoints / targetGottesdienst) * 100) : 0;
                  const percentGem = targetGemeinde > 0 ? Math.round((gemPoints / targetGemeinde) * 100) : 0;
                  const isComplete = percentTotal >= 100;

                  return (
                    <IonItemSliding key={konfi.id} style={{ marginBottom: index < filteredAndSortedKonfis.length - 1 ? '8px' : '0' }}>
                      <IonItem
                        button
                        onClick={() => onSelectKonfi(konfi)}
                        detail={false}
                        lines="none"
                        style={{
                          '--background': 'transparent',
                          '--padding-start': '0',
                          '--padding-end': '0',
                          '--inner-padding-end': '0',
                          '--inner-border-width': '0',
                          '--border-style': 'none',
                          '--min-height': 'auto'
                        }}
                      >
                        <div
                          className="app-list-item app-list-item--primary"
                          style={{
                            width: '100%',
                            borderLeftColor: statusColor,
                            position: 'relative',
                            overflow: 'hidden'
                          }}
                        >

                          <div className="app-list-item__row">
                            <div className="app-list-item__main">
                              {/* Avatar */}
                              <div
                                className="app-icon-circle app-icon-circle--lg"
                                style={{ backgroundColor: statusColor, color: 'white', fontWeight: '600' }}
                              >
                                {getInitials(konfi.name)}
                              </div>

                              {/* Content */}
                              <div className="app-list-item__content">
                                {/* Zeile 1: Name */}
                                <div className="app-list-item__title">
                                  {konfi.name}
                                </div>

                                {/* Zeile 2: Jahrgang + Badges */}
                                <div className="app-list-item__meta">
                                  <span className="app-list-item__meta-item">
                                    <IonIcon icon={calendar} style={{ color: '#5b21b6' }} />
                                    {konfi.jahrgang_name || konfi.jahrgang || 'Kein Jahrgang'}
                                  </span>
                                  <span className="app-list-item__meta-item">
                                    <IonIcon icon={ribbonOutline} style={{ color: '#fbbf24' }} />
                                    {konfi.badgeCount || 0} Badges
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Punkte rechts */}
                            <div style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'flex-end',
                              justifyContent: 'center',
                              minWidth: '50px'
                            }}>
                              <div style={{
                                fontSize: '1.4rem',
                                fontWeight: '800',
                                color: statusColor
                              }}>
                                {totalPoints}
                              </div>
                              <div style={{
                                fontSize: '0.7rem',
                                color: '#999'
                              }}>
                                /{targetTotal}
                              </div>
                            </div>
                          </div>

                          {/* 3 Progress Bars - Godi + Gemeinde nebeneinander, Gesamt darunter */}
                          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {/* Gottesdienst + Gemeinde nebeneinander */}
                            <div style={{ display: 'flex', gap: '8px' }}>
                              {/* Gottesdienst */}
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                  <span style={{ fontSize: '0.65rem', color: '#3b82f6', fontWeight: '600' }}>Godi</span>
                                  <span style={{ fontSize: '0.65rem', color: '#999' }}>{godiPoints}/{targetGottesdienst}</span>
                                </div>
                                <div style={{
                                  height: '4px',
                                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                                  borderRadius: '2px',
                                  overflow: 'hidden'
                                }}>
                                  <div style={{
                                    width: `${Math.min(100, percentGodi)}%`,
                                    height: '100%',
                                    backgroundColor: '#3b82f6',
                                    borderRadius: '2px',
                                    transition: 'width 0.3s ease'
                                  }} />
                                </div>
                              </div>

                              {/* Gemeinde */}
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                  <span style={{ fontSize: '0.65rem', color: '#22c55e', fontWeight: '600' }}>Gemeinde</span>
                                  <span style={{ fontSize: '0.65rem', color: '#999' }}>{gemPoints}/{targetGemeinde}</span>
                                </div>
                                <div style={{
                                  height: '4px',
                                  backgroundColor: 'rgba(34, 197, 94, 0.15)',
                                  borderRadius: '2px',
                                  overflow: 'hidden'
                                }}>
                                  <div style={{
                                    width: `${Math.min(100, percentGem)}%`,
                                    height: '100%',
                                    backgroundColor: '#22c55e',
                                    borderRadius: '2px',
                                    transition: 'width 0.3s ease'
                                  }} />
                                </div>
                              </div>
                            </div>

                            {/* Gesamt - Lila */}
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                <span style={{ fontSize: '0.7rem', color: '#5b21b6', fontWeight: '700' }}>Gesamt</span>
                                <span style={{ fontSize: '0.7rem', color: '#666', fontWeight: '600' }}>
                                  {totalPoints}/{targetTotal}
                                  {percentTotal > 100 && <span style={{ color: '#10b981', marginLeft: '4px' }}>({percentTotal}%)</span>}
                                </span>
                              </div>
                              <div style={{
                                height: '6px',
                                backgroundColor: 'rgba(91, 33, 182, 0.12)',
                                borderRadius: '3px',
                                overflow: 'hidden'
                              }}>
                                <div style={{
                                  width: `${Math.min(100, percentTotal)}%`,
                                  height: '100%',
                                  backgroundColor: '#5b21b6',
                                  borderRadius: '3px',
                                  transition: 'width 0.3s ease'
                                }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </IonItem>

                      <IonItemOptions side="end" style={{ '--ion-item-background': 'transparent', border: 'none' } as any}>
                        <IonItemOption
                          onClick={() => onDeleteKonfi(konfi)}
                          style={{ '--background': 'transparent', '--color': 'transparent', padding: '0', minWidth: 'auto', '--border-width': '0' }}
                        >
                          <div className="app-icon-circle app-icon-circle--lg app-icon-circle--danger">
                            <IonIcon icon={trash} />
                          </div>
                        </IonItemOption>
                      </IonItemOptions>
                    </IonItemSliding>
                  );
                })}
              </IonList>
            )}
          </IonCardContent>
        </IonCard>
      </IonList>
    </>
  );
};

export default KonfisView;
