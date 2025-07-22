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
  IonSegment,
  IonSegmentButton,
  IonAvatar,
  useIonActionSheet
} from '@ionic/react';
import { 
  add, 
  trash, 
  create, 
  search,
  people,
  person,
  shield,
  time,
  checkmark,
  close,
  key
} from 'ionicons/icons';
import { useApp } from '../../contexts/AppContext';
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
  const [presentActionSheet] = useIonActionSheet();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('alle');

  const filteredAndSortedUsers = (() => {
    let result = filterBySearchTerm(users, searchTerm, ['username', 'display_name', 'email', 'role_display_name']);
    
    // Filter by status/role
    if (selectedFilter === 'aktiv') {
      result = result.filter(user => user.is_active);
    } else if (selectedFilter === 'inaktiv') {
      result = result.filter(user => !user.is_active);
    } else if (selectedFilter === 'admin') {
      result = result.filter(user => user.role_name === 'admin');
    } else if (selectedFilter === 'teamer') {
      result = result.filter(user => user.role_name === 'teamer');
    } else if (selectedFilter === 'helper') {
      result = result.filter(user => user.role_name === 'helper');
    }
    
    // Sort by created_at (newest first)
    result = result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    return result;
  })();

  const getActiveUsers = () => {
    return users.filter(user => user.is_active);
  };

  const getInactiveUsers = () => {
    return users.filter(user => !user.is_active);
  };

  const getUsersByRole = (roleName: string) => {
    return users.filter(user => user.role_name === roleName);
  };

  const getRoleColor = (roleName: string) => {
    switch (roleName) {
      case 'admin': return 'danger';
      case 'teamer': return 'warning';
      case 'helper': return 'primary';
      default: return 'medium';
    }
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? 'success' : 'medium';
  };

  const getStatusText = (isActive: boolean) => {
    return isActive ? 'Aktiv' : 'Inaktiv';
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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

  return (
    <>
      {/* Header Card mit Statistiken - Blauer Gradient */}
      <IonCard style={{
        margin: '16px',
        borderRadius: '16px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)'
      }}>
        <IonCardContent>
          <IonGrid>
            <IonRow>
              <IonCol size="4">
                <div style={{ textAlign: 'center' }}>
                  <IonIcon icon={people} style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
                  <h3 style={{ margin: '0', fontSize: '1.5rem' }}>
                    {users.length}
                  </h3>
                  <p style={{ margin: '0', fontSize: '0.9rem', opacity: 0.8 }}>
                    Benutzer
                  </p>
                </div>
              </IonCol>
              <IonCol size="4">
                <div style={{ textAlign: 'center' }}>
                  <IonIcon icon={checkmark} style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
                  <h3 style={{ margin: '0', fontSize: '1.5rem' }}>
                    {getActiveUsers().length}
                  </h3>
                  <p style={{ margin: '0', fontSize: '0.9rem', opacity: 0.8 }}>
                    Aktiv
                  </p>
                </div>
              </IonCol>
              <IonCol size="4">
                <div style={{ textAlign: 'center' }}>
                  <IonIcon icon={shield} style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
                  <h3 style={{ margin: '0', fontSize: '1.5rem' }}>
                    {getUsersByRole('admin').length}
                  </h3>
                  <p style={{ margin: '0', fontSize: '0.9rem', opacity: 0.8 }}>
                    Admins
                  </p>
                </div>
              </IonCol>
            </IonRow>
          </IonGrid>
        </IonCardContent>
      </IonCard>

      {/* Search and Filter */}
      <IonCard style={{ margin: '16px' }}>
        <IonCardContent style={{ padding: '16px' }}>
          {/* Search Bar */}
          <IonItem 
            lines="none" 
            style={{ 
              '--background': '#f8f9fa',
              '--border-radius': '8px',
              marginBottom: '16px',
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
              placeholder="Benutzer suchen..."
              style={{ 
                '--color': '#000',
                '--placeholder-color': '#8e8e93'
              }}
            />
          </IonItem>

          {/* Tab Filter */}
          <IonSegment 
            value={selectedFilter} 
            onIonChange={(e) => setSelectedFilter(e.detail.value as string)}
            style={{ 
              '--background': '#f8f9fa',
              borderRadius: '8px',
              padding: '4px'
            }}
          >
            <IonSegmentButton value="alle">
              <IonIcon icon={people} style={{ fontSize: '1rem', marginRight: '4px' }} />
              <IonLabel>Alle</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="aktiv">
              <IonIcon icon={checkmark} style={{ fontSize: '1rem', marginRight: '4px' }} />
              <IonLabel>Aktiv</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="admin">
              <IonIcon icon={shield} style={{ fontSize: '1rem', marginRight: '4px' }} />
              <IonLabel>Admins</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="teamer">
              <IonIcon icon={person} style={{ fontSize: '1rem', marginRight: '4px' }} />
              <IonLabel>Teamer</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </IonCardContent>
      </IonCard>

      {/* Benutzer Liste */}
      <IonCard style={{ margin: '16px' }}>
        <IonCardContent style={{ padding: '0' }}>
          <IonList>
            {filteredAndSortedUsers.map((user) => (
              <IonItemSliding key={user.id}>
                <IonItem 
                  button={user.can_edit !== false}
                  onClick={user.can_edit !== false ? () => onSelectUser(user) : undefined}
                  style={{ 
                    '--min-height': '56px', 
                    '--padding-start': '16px',
                    opacity: user.can_edit !== false ? 1 : 0.5,
                    cursor: user.can_edit !== false ? 'pointer' : 'not-allowed'
                  }}
                >
                  <IonAvatar slot="start" style={{ marginRight: '12px' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: '600',
                      fontSize: '0.8rem'
                    }}>
                      {getInitials(user.display_name)}
                    </div>
                  </IonAvatar>
                  
                  <IonLabel>
                    <h2 style={{ 
                      fontWeight: '600', 
                      fontSize: '1rem',
                      margin: '0 0 2px 0'
                    }}>
                      {user.display_name}
                    </h2>
                    
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px', 
                      flexWrap: 'wrap',
                      margin: '0'
                    }}>
                      <span style={{ 
                        fontSize: '0.8rem',
                        color: '#666'
                      }}>
                        @{user.username}
                      </span>
                      
                      <IonBadge 
                        color={getRoleColor(user.role_name)}
                        style={{ 
                          fontSize: '0.7rem',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}
                      >
                        {user.role_display_name}
                      </IonBadge>
                      
                      <IonBadge 
                        color={getStatusColor(user.is_active)}
                        style={{ 
                          fontSize: '0.7rem',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}
                      >
                        {getStatusText(user.is_active)}
                      </IonBadge>
                      
                      {user.assigned_jahrgaenge_count > 0 && (
                        <IonBadge 
                          color="tertiary"
                          style={{ 
                            fontSize: '0.7rem',
                            padding: '2px 6px',
                            borderRadius: '4px'
                          }}
                        >
                          {user.assigned_jahrgaenge_count}J
                        </IonBadge>
                      )}
                      
                      <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '0.7rem', color: '#999' }}>
                        <span>Erstellt: {formatDate(user.created_at)}</span>
                        {user.last_login_at && (
                          <span style={{ marginTop: '2px' }}>
                            Login: {formatDate(user.last_login_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  </IonLabel>
                </IonItem>

                {user.can_edit !== false && (
                  <IonItemOptions side="end">
                    <IonItemOption 
                      color="primary" 
                      onClick={() => onSelectUser(user)}
                    >
                      <IonIcon icon={create} />
                    </IonItemOption>
                    <IonItemOption 
                      color="danger" 
                      onClick={() => onDeleteUser(user)}
                    >
                      <IonIcon icon={trash} />
                    </IonItemOption>
                  </IonItemOptions>
                )}
              </IonItemSliding>
            ))}
            
            {filteredAndSortedUsers.length === 0 && (
              <IonItem>
                <IonLabel style={{ textAlign: 'center', color: '#666' }}>
                  <p>Keine Benutzer gefunden</p>
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