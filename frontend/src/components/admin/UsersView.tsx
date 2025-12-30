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
  people,
  person,
  personOutline,
  shield,
  createOutline,
  at,
  school,
  time,
  briefcaseOutline,
  filterOutline,
  peopleOutline
} from 'ionicons/icons';
import { filterBySearchTerm } from '../../utils/helpers';

interface User {
  id: number;
  username: string;
  email?: string;
  display_name: string;
  role_title?: string; // Funktionsbeschreibung z.B. "Pastor", "Diakonin"
  is_active: boolean;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
  role_name: string;
  role_display_name: string;
  assigned_jahrgaenge_count: number;
  can_edit?: boolean;
}

interface UsersViewProps {
  users: User[];
  onUpdate: () => void;
  onAddUserClick: () => void;
  onSelectUser: (user: User) => void;
  onDeleteUser: (user: User) => void;
}

const UsersView: React.FC<UsersViewProps> = ({
  users,
  onUpdate,
  onAddUserClick,
  onSelectUser,
  onDeleteUser
}) => {
  const slidingRefs = useRef<Map<number, HTMLIonItemSlidingElement>>(new Map());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('alle');

  const filteredAndSortedUsers = (() => {
    let result = filterBySearchTerm(users, searchTerm, ['username', 'display_name', 'email', 'role_display_name']);

    if (selectedFilter === 'aktiv') {
      result = result.filter(user => user.is_active);
    } else if (selectedFilter === 'inaktiv') {
      result = result.filter(user => !user.is_active);
    } else if (selectedFilter === 'admin') {
      result = result.filter(user => user.role_name === 'admin' || user.role_name === 'org_admin');
    } else if (selectedFilter === 'teamer') {
      result = result.filter(user => user.role_name === 'teamer');
    }

    // Sort: org_admin first, then admin, then teamer, then by name
    result = result.sort((a, b) => {
      const roleOrder: { [key: string]: number } = {
        'org_admin': 1, 'admin': 2, 'teamer': 3
      };
      const orderA = roleOrder[a.role_name] || 99;
      const orderB = roleOrder[b.role_name] || 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.display_name.localeCompare(b.display_name);
    });

    return result;
  })();

  const getActiveUsers = () => users.filter(user => user.is_active);
  const getAdminUsers = () => users.filter(user => user.role_name === 'admin' || user.role_name === 'org_admin');
  const getTeamerUsers = () => users.filter(user => user.role_name === 'teamer');

  const getRoleColor = (roleName: string) => {
    switch (roleName) {
      case 'org_admin': return '#3b82f6';
      case 'admin': return '#ef4444';
      case 'teamer': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getRoleBadgeColor = (roleName: string) => {
    switch (roleName) {
      case 'org_admin': return 'primary';
      case 'admin': return 'danger';
      case 'teamer': return 'warning';
      default: return 'medium';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getInitials = (displayName: string) => {
    return displayName
      .split(' ')
      .map(name => name.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const closeAllSlidingItems = () => {
    slidingRefs.current.forEach(ref => ref?.close());
  };

  return (
    <>
      {/* Header - Dashboard-Style wie EventsView */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '24px',
        padding: '0',
        margin: '16px',
        marginBottom: '16px',
        boxShadow: '0 20px 40px rgba(102, 126, 234, 0.3)',
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
            fontSize: '2.8rem',
            fontWeight: '900',
            color: 'rgba(255, 255, 255, 0.1)',
            margin: '0',
            lineHeight: '0.8',
            letterSpacing: '-2px'
          }}>
            BENUTZER:INNEN
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
                      display: 'block',
                      margin: '0 auto 8px auto'
                    }}
                  />
                  <div style={{ fontSize: '1.3rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '1.5rem' }}>{users.length}</span>
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
                    icon={shield}
                    style={{
                      fontSize: '1.5rem',
                      color: 'rgba(255, 255, 255, 0.9)',
                      display: 'block',
                      margin: '0 auto 8px auto'
                    }}
                  />
                  <div style={{ fontSize: '1.3rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '1.5rem' }}>{getAdminUsers().length}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                    Admins
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
                    icon={person}
                    style={{
                      fontSize: '1.5rem',
                      color: 'rgba(255, 255, 255, 0.9)',
                      display: 'block',
                      margin: '0 auto 8px auto'
                    }}
                  />
                  <div style={{ fontSize: '1.3rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '1.5rem' }}>{getTeamerUsers().length}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                    Team
                  </div>
                </div>
              </IonCol>
            </IonRow>
          </IonGrid>
        </div>
      </div>

      {/* Tab Navigation - einfaches IonSegment */}
      <div style={{ margin: '16px' }}>
        <IonSegment
          value={selectedFilter}
          onIonChange={(e) => setSelectedFilter(e.detail.value as string)}
        >
          <IonSegmentButton value="alle">
            <IonLabel>Alle</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="aktiv">
            <IonLabel>Aktiv</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="admin">
            <IonLabel>Admin</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="teamer">
            <IonLabel>Team</IonLabel>
          </IonSegmentButton>
        </IonSegment>
      </div>

      {/* Suche */}
      <IonList inset={true} style={{ margin: '16px' }}>
        <IonCard className="app-card">
          <IonCardContent style={{ padding: '8px 16px' }}>
            <IonItem lines="none" style={{ '--background': 'transparent', '--padding-start': '0' }}>
              <IonIcon icon={filterOutline} slot="start" style={{ color: '#667eea', marginRight: '12px' }} />
              <IonInput
                value={searchTerm}
                onIonInput={(e) => setSearchTerm(e.detail.value!)}
                placeholder="Benutzer:in suchen..."
                clearInput={true}
              />
            </IonItem>
          </IonCardContent>
        </IonCard>
      </IonList>

      {/* Benutzer-Liste - iOS26 Pattern */}
      <IonList inset={true} style={{ margin: '16px' }}>
        <IonListHeader>
          <div className="app-section-icon app-section-icon--users">
            <IonIcon icon={peopleOutline} />
          </div>
          <IonLabel>Benutzer:innen ({filteredAndSortedUsers.length})</IonLabel>
        </IonListHeader>
        <IonCard className="app-card">
          <IonCardContent style={{ padding: '16px' }}>
            <IonList lines="none" style={{ background: 'transparent', padding: '0', margin: '0' }}>
            {filteredAndSortedUsers.map((user, index) => {
              const roleColor = getRoleColor(user.role_name);

              return (
              <IonItemSliding
                key={user.id}
                ref={(ref) => {
                  if (ref) slidingRefs.current.set(user.id, ref);
                }}
                style={{ marginBottom: index < filteredAndSortedUsers.length - 1 ? '8px' : '0' }}
              >
                <IonItem
                  button={user.can_edit !== false}
                  detail={false}
                  onClick={() => {
                    if (user.can_edit !== false) {
                      closeAllSlidingItems();
                      onSelectUser(user);
                    }
                  }}
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
                    className="app-list-item app-list-item--users"
                    style={{
                      width: '100%',
                      borderLeftColor: roleColor,
                      opacity: user.is_active ? 1 : 0.6,
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    {/* Eselsohr-Style Corner Badge */}
                    <div
                      className="app-corner-badge"
                      style={{ backgroundColor: roleColor }}
                    >
                      {user.role_name === 'org_admin' ? 'Org Admin' : user.role_name === 'admin' ? 'Hauptamt' : 'Team'}
                    </div>

                    <div className="app-list-item__row">
                      <div className="app-list-item__main">
                        {/* Role Icon */}
                        <div
                          className="app-icon-circle app-icon-circle--lg"
                          style={{ backgroundColor: roleColor }}
                        >
                          <IonIcon icon={user.role_name === 'org_admin' || user.role_name === 'admin' ? shield : person} />
                        </div>

                        {/* Content */}
                        <div className="app-list-item__content">
                          {/* Zeile 1: Name */}
                          <div
                            className="app-list-item__title"
                            style={{
                              color: user.is_active ? '#333' : '#999',
                              paddingRight: '70px'
                            }}
                          >
                            {user.display_name}
                          </div>

                          {/* Zeile 2: Username + Titel */}
                          <div className="app-list-item__meta">
                            <span className="app-list-item__meta-item">
                              <IonIcon icon={at} style={{ color: user.is_active ? '#007aff' : '#999' }} />
                              {user.username}
                            </span>
                            {user.role_title && (
                              <span className="app-list-item__meta-item">
                                <IonIcon icon={briefcaseOutline} style={{ color: user.is_active ? '#f59e0b' : '#999' }} />
                                {user.role_title}
                              </span>
                            )}
                          </div>

                          {/* Zeile 3: Jahrgänge + Login */}
                          <div className="app-list-item__meta" style={{ marginTop: '4px' }}>
                            {user.assigned_jahrgaenge_count > 0 && (
                              <span className="app-list-item__meta-item">
                                <IonIcon icon={school} style={{ color: user.is_active ? '#007aff' : '#999' }} />
                                {user.assigned_jahrgaenge_count} Jg.
                              </span>
                            )}
                            {user.last_login_at && (
                              <span className="app-list-item__meta-item">
                                <IonIcon icon={time} style={{ color: user.is_active ? '#34c759' : '#999' }} />
                                {formatDate(user.last_login_at)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </IonItem>

                {user.can_edit !== false && (
                  <IonItemOptions side="end" style={{ '--ion-item-background': 'transparent', border: 'none', gap: '0' } as any}>
                    <IonItemOption
                      onClick={() => {
                        closeAllSlidingItems();
                        onSelectUser(user);
                      }}
                      style={{ '--background': 'transparent', '--color': 'transparent', padding: '0', minWidth: 'auto', '--border-width': '0' }}
                    >
                      <div className="app-icon-circle app-icon-circle--lg app-icon-circle--users">
                        <IonIcon icon={createOutline} />
                      </div>
                    </IonItemOption>
                    <IonItemOption
                      onClick={() => {
                        closeAllSlidingItems();
                        onDeleteUser(user);
                      }}
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

            {filteredAndSortedUsers.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px' }}>
                <IonIcon
                  icon={personOutline}
                  style={{
                    fontSize: '3rem',
                    color: '#667eea',
                    marginBottom: '16px',
                    display: 'block',
                    margin: '0 auto 16px auto'
                  }}
                />
                <h3 style={{ color: '#666', margin: '0 0 8px 0' }}>Keine Benutzer:innen gefunden</h3>
                <p style={{ color: '#999', margin: '0' }}>Noch keine Teammitglieder angelegt</p>
              </div>
            )}
            </IonList>
          </IonCardContent>
        </IonCard>
      </IonList>
    </>
  );
};

export default UsersView;
