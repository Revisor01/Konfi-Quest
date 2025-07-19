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
  useIonActionSheet
} from '@ionic/react';
import { 
  add, 
  trash, 
  create, 
  search,
  shield,
  shieldCheckmark,
  people,
  key,
  checkmark,
  close,
  lockClosed
} from 'ionicons/icons';
import { useApp } from '../../contexts/AppContext';
import { filterBySearchTerm } from '../../utils/helpers';

interface Role {
  id: number;
  name: string;
  display_name: string;
  description?: string;
  is_system_role: boolean;
  is_active: boolean;
  user_count: number;
  permission_count: number;
  created_at: string;
}

interface RolesViewProps {
  roles: Role[];
  onUpdate: () => void;
  onAddRoleClick: () => void;
  onSelectRole: (role: Role) => void;
  onDeleteRole: (role: Role) => void;
}

const RolesView: React.FC<RolesViewProps> = ({ 
  roles, 
  onUpdate, 
  onAddRoleClick,
  onSelectRole,
  onDeleteRole
}) => {
  const [presentActionSheet] = useIonActionSheet();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('alle');

  const filteredAndSortedRoles = (() => {
    let result = filterBySearchTerm(roles, searchTerm, ['name', 'display_name', 'description']);
    
    // Filter by type
    if (selectedFilter === 'system') {
      result = result.filter(role => role.is_system_role);
    } else if (selectedFilter === 'custom') {
      result = result.filter(role => !role.is_system_role);
    } else if (selectedFilter === 'aktiv') {
      result = result.filter(role => role.is_active);
    } else if (selectedFilter === 'inaktiv') {
      result = result.filter(role => !role.is_active);
    }
    
    // Sort by system roles first, then by created_at
    result = result.sort((a, b) => {
      if (a.is_system_role && !b.is_system_role) return -1;
      if (!a.is_system_role && b.is_system_role) return 1;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
    
    return result;
  })();

  const getSystemRoles = () => {
    return roles.filter(role => role.is_system_role);
  };

  const getCustomRoles = () => {
    return roles.filter(role => !role.is_system_role);
  };

  const getActiveRoles = () => {
    return roles.filter(role => role.is_active);
  };

  const getTotalUsers = () => {
    return roles.reduce((sum, role) => sum + role.user_count, 0);
  };

  const getRoleTypeColor = (role: Role) => {
    if (!role.is_active) return 'medium';
    if (role.is_system_role) {
      switch (role.name) {
        case 'admin': return 'danger';
        case 'teamer': return 'warning';
        case 'helper': return 'primary';
        default: return 'tertiary';
      }
    }
    return 'success';
  };

  const getRoleTypeIcon = (role: Role) => {
    if (role.is_system_role) {
      return lockClosed;
    }
    return shield;
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? 'success' : 'medium';
  };

  const getStatusText = (isActive: boolean) => {
    return isActive ? 'Aktiv' : 'Inaktiv';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <>
      {/* Header Card mit Statistiken - Lila Gradient */}
      <IonCard style={{
        margin: '16px',
        borderRadius: '16px',
        background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)',
        color: 'white',
        boxShadow: '0 8px 32px rgba(139, 92, 246, 0.3)'
      }}>
        <IonCardContent>
          <IonGrid>
            <IonRow>
              <IonCol size="4">
                <div style={{ textAlign: 'center' }}>
                  <IonIcon icon={shield} style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
                  <h3 style={{ margin: '0', fontSize: '1.5rem' }}>
                    {roles.length}
                  </h3>
                  <p style={{ margin: '0', fontSize: '0.9rem', opacity: 0.8 }}>
                    Rollen
                  </p>
                </div>
              </IonCol>
              <IonCol size="4">
                <div style={{ textAlign: 'center' }}>
                  <IonIcon icon={lockClosed} style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
                  <h3 style={{ margin: '0', fontSize: '1.5rem' }}>
                    {getSystemRoles().length}
                  </h3>
                  <p style={{ margin: '0', fontSize: '0.9rem', opacity: 0.8 }}>
                    System
                  </p>
                </div>
              </IonCol>
              <IonCol size="4">
                <div style={{ textAlign: 'center' }}>
                  <IonIcon icon={people} style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
                  <h3 style={{ margin: '0', fontSize: '1.5rem' }}>
                    {getTotalUsers()}
                  </h3>
                  <p style={{ margin: '0', fontSize: '0.9rem', opacity: 0.8 }}>
                    Benutzer
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
              placeholder="Rolle suchen..."
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
              <IonIcon icon={shield} style={{ fontSize: '1rem', marginRight: '4px' }} />
              <IonLabel>Alle</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="system">
              <IonIcon icon={lockClosed} style={{ fontSize: '1rem', marginRight: '4px' }} />
              <IonLabel>System</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="custom">
              <IonIcon icon={shieldCheckmark} style={{ fontSize: '1rem', marginRight: '4px' }} />
              <IonLabel>Eigene</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="aktiv">
              <IonIcon icon={checkmark} style={{ fontSize: '1rem', marginRight: '4px' }} />
              <IonLabel>Aktiv</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </IonCardContent>
      </IonCard>

      {/* Rollen Liste */}
      <IonCard style={{ margin: '16px' }}>
        <IonCardContent style={{ padding: '0' }}>
          <IonList>
            {filteredAndSortedRoles.map((role) => (
              <IonItemSliding key={role.id}>
                <IonItem 
                  button 
                  onClick={() => onSelectRole(role)}
                  style={{ '--min-height': '80px', '--padding-start': '16px' }}
                >
                  <div slot="start" style={{ 
                    width: '40px', 
                    height: '40px',
                    backgroundColor: getRoleTypeColor(role) === 'danger' ? '#f53d3d' :
                                    getRoleTypeColor(role) === 'warning' ? '#ffcc00' :
                                    getRoleTypeColor(role) === 'primary' ? '#3880ff' :
                                    getRoleTypeColor(role) === 'success' ? '#2dd36f' :
                                    getRoleTypeColor(role) === 'tertiary' ? '#7045f6' : '#929296',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '12px'
                  }}>
                    <IonIcon 
                      icon={getRoleTypeIcon(role)} 
                      style={{ 
                        fontSize: '1.2rem', 
                        color: 'white'
                      }} 
                    />
                  </div>
                  
                  <IonLabel>
                    <h2 style={{ 
                      fontWeight: '600', 
                      fontSize: '1.1rem',
                      margin: '0 0 6px 0'
                    }}>
                      {role.display_name}
                      {role.is_system_role && (
                        <IonIcon 
                          icon={lockClosed} 
                          style={{ 
                            fontSize: '0.9rem', 
                            marginLeft: '8px',
                            color: '#666'
                          }} 
                        />
                      )}
                    </h2>
                    
                    {role.description && (
                      <p style={{ 
                        margin: '0 0 6px 0',
                        fontSize: '0.85rem',
                        color: '#666'
                      }}>
                        {role.description}
                      </p>
                    )}
                    
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <IonChip 
                        color={getStatusColor(role.is_active)}
                        style={{ 
                          fontSize: '0.75rem', 
                          height: '22px',
                          opacity: 0.7,
                          '--background': role.is_active ? 'rgba(45, 211, 111, 0.15)' : 'rgba(146, 146, 150, 0.15)',
                          '--color': role.is_active ? '#2dd36f' : '#929296'
                        }}
                      >
                        {getStatusText(role.is_active)}
                      </IonChip>
                      
                      <IonChip 
                        color="primary"
                        style={{ 
                          fontSize: '0.75rem', 
                          height: '22px',
                          opacity: 0.7,
                          '--background': 'rgba(56, 128, 255, 0.15)',
                          '--color': '#3880ff'
                        }}
                      >
                        {role.user_count} {role.user_count === 1 ? 'Benutzer' : 'Benutzer'}
                      </IonChip>
                      
                      <IonChip 
                        color="tertiary"
                        style={{ 
                          fontSize: '0.75rem', 
                          height: '22px',
                          opacity: 0.7,
                          '--background': 'rgba(112, 69, 246, 0.15)',
                          '--color': '#7045f6'
                        }}
                      >
                        {role.permission_count} {role.permission_count === 1 ? 'Berechtigung' : 'Berechtigungen'}
                      </IonChip>
                      
                      {role.is_system_role && (
                        <IonChip 
                          color="warning"
                          style={{ 
                            fontSize: '0.75rem', 
                            height: '22px',
                            opacity: 0.7,
                            '--background': 'rgba(255, 204, 0, 0.15)',
                            '--color': '#ffcc00'
                          }}
                        >
                          System-Rolle
                        </IonChip>
                      )}
                    </div>
                    
                    <p style={{ 
                      margin: '0',
                      fontSize: '0.8rem',
                      color: '#999'
                    }}>
                      Rollenname: {role.name} • Erstellt: {formatDate(role.created_at)}
                    </p>
                  </IonLabel>
                </IonItem>

                <IonItemOptions side="end">
                  <IonItemOption 
                    color="primary" 
                    onClick={() => onSelectRole(role)}
                  >
                    <IonIcon icon={create} />
                  </IonItemOption>
                  {!role.is_system_role && (
                    <IonItemOption 
                      color="danger" 
                      onClick={() => onDeleteRole(role)}
                    >
                      <IonIcon icon={trash} />
                    </IonItemOption>
                  )}
                </IonItemOptions>
              </IonItemSliding>
            ))}
            
            {filteredAndSortedRoles.length === 0 && (
              <IonItem>
                <IonLabel style={{ textAlign: 'center', color: '#666' }}>
                  <p>Keine Rollen gefunden</p>
                </IonLabel>
              </IonItem>
            )}
          </IonList>
        </IonCardContent>
      </IonCard>
    </>
  );
};

export default RolesView;