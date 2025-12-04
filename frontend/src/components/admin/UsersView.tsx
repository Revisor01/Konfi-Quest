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
  IonBadge,
  IonList,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonInput,
  IonSegment,
  IonSegmentButton
} from '@ionic/react';
import {
  trash,
  search,
  people,
  person,
  personOutline,
  shield,
  shieldOutline,
  checkmark,
  checkmarkCircle,
  closeCircle,
  createOutline,
  calendarOutline
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
            fontSize: '4rem',
            fontWeight: '900',
            color: 'rgba(255, 255, 255, 0.1)',
            margin: '0',
            lineHeight: '0.8',
            letterSpacing: '-2px'
          }}>
            TEAM
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
                    Teamer
                  </div>
                </div>
              </IonCol>
            </IonRow>
          </IonGrid>
        </div>
      </div>

      {/* Suchfeld */}
      <IonCard style={{
        margin: '16px',
        borderRadius: '12px',
        background: 'white',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        border: '1px solid #e0e0e0'
      }}>
        <IonCardContent style={{ padding: '16px' }}>
          {/* Search Bar */}
          <IonItem
            lines="none"
            style={{
              '--background': '#f8f9fa',
              '--border-radius': '10px',
              marginBottom: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
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
              placeholder="Name oder Benutzername suchen..."
              style={{
                '--color': '#000',
                '--placeholder-color': '#8e8e93'
              }}
            />
          </IonItem>

          {/* Filter Tabs */}
          <IonSegment
            value={selectedFilter}
            onIonChange={(e) => setSelectedFilter(e.detail.value as string)}
            style={{
              '--background': '#f8f9fa',
              borderRadius: '10px',
              padding: '4px'
            }}
          >
            <IonSegmentButton value="alle">
              <IonLabel style={{ fontSize: '0.8rem' }}>Alle</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="aktiv">
              <IonLabel style={{ fontSize: '0.8rem' }}>Aktiv</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="admin">
              <IonLabel style={{ fontSize: '0.8rem' }}>Admins</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="teamer">
              <IonLabel style={{ fontSize: '0.8rem' }}>Teamer</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </IonCardContent>
      </IonCard>

      {/* Benutzer-Liste */}
      <IonCard style={{
        margin: '16px',
        borderRadius: '12px',
        background: 'white',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        border: '1px solid #e0e0e0'
      }}>
        <IonCardContent style={{ padding: '0' }}>
          <IonList lines="none" style={{ background: 'transparent', padding: '8px 0' }}>
            {filteredAndSortedUsers.map((user) => (
              <IonItemSliding
                key={user.id}
                ref={(ref) => {
                  if (ref) slidingRefs.current.set(user.id, ref);
                }}
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
                    opacity: user.is_active ? 1 : 0.6
                  }}
                >
                  <IonLabel>
                    {/* Header mit Icon wie EventsView */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '4px'
                    }}>
                      {/* Role Icon - 32px wie EventsView */}
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: getRoleColor(user.role_name),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: `0 2px 8px ${getRoleColor(user.role_name)}40`,
                        flexShrink: 0
                      }}>
                        <IonIcon
                          icon={user.role_name === 'org_admin' ? shield : user.role_name === 'admin' ? shield : person}
                          style={{ fontSize: '0.9rem', color: 'white' }}
                        />
                      </div>

                      {/* Name */}
                      <h2 style={{
                        fontWeight: '600',
                        fontSize: 'clamp(0.9rem, 2.5vw, 1rem)',
                        margin: '0',
                        color: user.is_active ? '#333' : '#999',
                        lineHeight: '1.3',
                        flex: 1,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {user.display_name}
                      </h2>
                    </div>

                    {/* Details Row - vereinfacht */}
                    <div style={{
                      fontSize: '0.8rem',
                      color: user.is_active ? '#666' : '#999',
                      marginLeft: '44px'
                    }}>
                      {user.role_display_name}
                      {user.role_title && ` · ${user.role_title}`}
                      {user.assigned_jahrgaenge_count > 0 && ` · ${user.assigned_jahrgaenge_count} Jg.`}
                    </div>
                  </IonLabel>
                </IonItem>

                {user.can_edit !== false && (
                  <IonItemOptions side="end" style={{ gap: '4px', '--ion-item-background': 'transparent' }}>
                    <IonItemOption
                      onClick={() => {
                        closeAllSlidingItems();
                        onSelectUser(user);
                      }}
                      style={{
                        '--background': 'transparent',
                        '--background-activated': 'transparent',
                        '--background-focused': 'transparent',
                        '--background-hover': 'transparent',
                        '--color': 'transparent',
                        '--ripple-color': 'transparent',
                        padding: '0 2px',
                        minWidth: '48px',
                        maxWidth: '48px'
                      }}
                    >
                      <div style={{
                        width: '44px',
                        height: '44px',
                        backgroundColor: '#667eea',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(102, 126, 234, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)'
                      }}>
                        <IonIcon icon={createOutline} style={{ fontSize: '1.2rem', color: 'white' }} />
                      </div>
                    </IonItemOption>
                    <IonItemOption
                      onClick={() => {
                        closeAllSlidingItems();
                        onDeleteUser(user);
                      }}
                      style={{
                        '--background': 'transparent',
                        '--background-activated': 'transparent',
                        '--background-focused': 'transparent',
                        '--background-hover': 'transparent',
                        '--color': 'transparent',
                        '--ripple-color': 'transparent',
                        padding: '0 2px',
                        paddingRight: '12px',
                        minWidth: '48px',
                        maxWidth: '60px'
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

            {filteredAndSortedUsers.length === 0 && (
              <IonItem lines="none">
                <IonLabel style={{ textAlign: 'center', color: '#999', padding: '32px 0' }}>
                  <IonIcon icon={personOutline} style={{ fontSize: '2rem', marginBottom: '8px', display: 'block' }} />
                  <p style={{ margin: 0 }}>Keine Benutzer gefunden</p>
                </IonLabel>
              </IonItem>
            )}
          </IonList>
        </IonCardContent>
      </IonCard>
    </>
  );
};

export default UsersView;
