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
      {/* Header - Dashboard-Style mit Gradient */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '24px',
        padding: '0',
        margin: '16px',
        marginBottom: '16px',
        boxShadow: '0 20px 40px rgba(102, 126, 234, 0.3)',
        position: 'relative',
        overflow: 'hidden',
        minHeight: '180px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Background Pattern */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0.1,
          background: `radial-gradient(circle at 20% 80%, white 2px, transparent 2px),
                       radial-gradient(circle at 80% 20%, white 2px, transparent 2px),
                       radial-gradient(circle at 40% 40%, white 1px, transparent 1px)`,
          backgroundSize: '60px 60px, 80px 80px, 40px 40px'
        }} />

        {/* Header Content */}
        <div style={{ padding: '20px', position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              backgroundColor: 'rgba(255,255,255,0.2)',
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(10px)'
            }}>
              <IonIcon icon={people} style={{ fontSize: '1.5rem', color: 'white' }} />
            </div>
            <div>
              <h1 style={{
                margin: 0,
                fontSize: '1.5rem',
                fontWeight: '700',
                color: 'white'
              }}>
                Team-Verwaltung
              </h1>
              <p style={{
                margin: '2px 0 0 0',
                fontSize: '0.85rem',
                color: 'rgba(255,255,255,0.8)'
              }}>
                Admins, Teamer und Rollen verwalten
              </p>
            </div>
          </div>

          {/* Stats Row */}
          <div style={{
            display: 'flex',
            gap: '12px',
            marginTop: '8px'
          }}>
            <div style={{
              flex: 1,
              backgroundColor: 'rgba(255,255,255,0.15)',
              borderRadius: '12px',
              padding: '12px',
              textAlign: 'center',
              backdropFilter: 'blur(10px)'
            }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'white' }}>
                {users.length}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)', marginTop: '2px' }}>
                Gesamt
              </div>
            </div>
            <div style={{
              flex: 1,
              backgroundColor: 'rgba(255,255,255,0.15)',
              borderRadius: '12px',
              padding: '12px',
              textAlign: 'center',
              backdropFilter: 'blur(10px)'
            }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'white' }}>
                {getActiveUsers().length}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)', marginTop: '2px' }}>
                Aktiv
              </div>
            </div>
            <div style={{
              flex: 1,
              backgroundColor: 'rgba(255,255,255,0.15)',
              borderRadius: '12px',
              padding: '12px',
              textAlign: 'center',
              backdropFilter: 'blur(10px)'
            }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'white' }}>
                {getAdminUsers().length}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)', marginTop: '2px' }}>
                Admins
              </div>
            </div>
            <div style={{
              flex: 1,
              backgroundColor: 'rgba(255,255,255,0.15)',
              borderRadius: '12px',
              padding: '12px',
              textAlign: 'center',
              backdropFilter: 'blur(10px)'
            }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'white' }}>
                {getTeamerUsers().length}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)', marginTop: '2px' }}>
                Teamer
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Suche und Filter Section */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        margin: '16px 16px 12px 16px'
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          backgroundColor: '#667eea',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
          flexShrink: 0
        }}>
          <IonIcon icon={search} style={{ fontSize: '1rem', color: 'white' }} />
        </div>
        <h2 style={{
          fontWeight: '600',
          fontSize: '1.1rem',
          margin: '0',
          color: '#333'
        }}>
          Suche & Filter
        </h2>
      </div>

      <IonCard style={{
        margin: '0 16px 16px 16px',
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

      {/* Benutzer-Liste Section */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        margin: '16px 16px 12px 16px'
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          backgroundColor: '#764ba2',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(118, 75, 162, 0.3)',
          flexShrink: 0
        }}>
          <IonIcon icon={personOutline} style={{ fontSize: '1rem', color: 'white' }} />
        </div>
        <h2 style={{
          fontWeight: '600',
          fontSize: '1.1rem',
          margin: '0',
          color: '#333'
        }}>
          Benutzer ({filteredAndSortedUsers.length})
        </h2>
      </div>

      <IonCard style={{
        margin: '0 16px 16px 16px',
        borderRadius: '12px',
        background: 'white',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        border: '1px solid #e0e0e0'
      }}>
        <IonCardContent style={{ padding: '0' }}>
          <IonList style={{ background: 'transparent' }}>
            {filteredAndSortedUsers.map((user) => (
              <IonItemSliding
                key={user.id}
                ref={(ref) => {
                  if (ref) slidingRefs.current.set(user.id, ref);
                }}
              >
                <IonItem
                  button={user.can_edit !== false}
                  onClick={() => {
                    if (user.can_edit !== false) {
                      closeAllSlidingItems();
                      onSelectUser(user);
                    }
                  }}
                  style={{
                    '--min-height': '72px',
                    '--padding-start': '16px',
                    '--padding-end': '16px',
                    '--background': 'transparent'
                  }}
                >
                  {/* Avatar */}
                  <div slot="start" style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: `linear-gradient(135deg, ${getRoleColor(user.role_name)} 0%, ${getRoleColor(user.role_name)}dd 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: '600',
                    fontSize: '0.95rem',
                    marginRight: '12px',
                    boxShadow: `0 4px 12px ${getRoleColor(user.role_name)}40`
                  }}>
                    {getInitials(user.display_name)}
                  </div>

                  <IonLabel>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '4px'
                    }}>
                      <h2 style={{
                        fontWeight: '600',
                        fontSize: '1rem',
                        margin: '0',
                        color: '#1a1a1a'
                      }}>
                        {user.display_name}
                      </h2>
                      {!user.is_active && (
                        <IonIcon
                          icon={closeCircle}
                          style={{ fontSize: '0.9rem', color: '#ef4444' }}
                        />
                      )}
                    </div>

                    <p style={{
                      fontSize: '0.8rem',
                      color: '#666',
                      margin: '0 0 6px 0'
                    }}>
                      @{user.username}
                      {user.email && ` | ${user.email}`}
                    </p>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      flexWrap: 'wrap'
                    }}>
                      <IonBadge
                        color={getRoleBadgeColor(user.role_name)}
                        style={{
                          fontSize: '0.7rem',
                          padding: '3px 8px',
                          borderRadius: '6px'
                        }}
                      >
                        {user.role_display_name}
                      </IonBadge>

                      {user.assigned_jahrgaenge_count > 0 && (
                        <IonBadge
                          color="tertiary"
                          style={{
                            fontSize: '0.7rem',
                            padding: '3px 8px',
                            borderRadius: '6px'
                          }}
                        >
                          {user.assigned_jahrgaenge_count} Jahrgang{user.assigned_jahrgaenge_count > 1 ? 'e' : ''}
                        </IonBadge>
                      )}

                      {user.last_login_at && (
                        <span style={{
                          fontSize: '0.7rem',
                          color: '#999',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}>
                          <IonIcon icon={calendarOutline} style={{ fontSize: '0.75rem' }} />
                          {formatDate(user.last_login_at)}
                        </span>
                      )}
                    </div>
                  </IonLabel>
                </IonItem>

                {user.can_edit !== false && (
                  <IonItemOptions side="end">
                    <IonItemOption
                      color="primary"
                      onClick={() => {
                        closeAllSlidingItems();
                        onSelectUser(user);
                      }}
                      style={{ borderRadius: '0' }}
                    >
                      <IonIcon icon={createOutline} slot="icon-only" />
                    </IonItemOption>
                    <IonItemOption
                      color="danger"
                      onClick={() => {
                        closeAllSlidingItems();
                        onDeleteUser(user);
                      }}
                      style={{ borderRadius: '0' }}
                    >
                      <IonIcon icon={trash} slot="icon-only" />
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
