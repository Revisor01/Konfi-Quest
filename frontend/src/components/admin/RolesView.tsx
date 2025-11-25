import React, { useState } from 'react';
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
  IonInput,
  IonSegment,
  IonSegmentButton
} from '@ionic/react';
import {
  search,
  shield,
  people,
  checkmark,
  lockClosed
} from 'ionicons/icons';
import { filterBySearchTerm } from '../../utils/helpers';

interface Role {
  id: number;
  name: string;
  display_name: string;
  description?: string;
  is_system_role: boolean;
  is_active: boolean;
  user_count: number;
  created_at: string;
}

interface RolesViewProps {
  roles: Role[];
  onUpdate: () => void;
}

// Vereinfachte Read-Only Ansicht - Rollen sind jetzt hardcoded (5 System-Rollen)
const RolesView: React.FC<RolesViewProps> = ({ roles }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('alle');

  const filteredAndSortedRoles = (() => {
    let result = filterBySearchTerm(roles, searchTerm, ['name', 'display_name', 'description']);

    // Filter by status
    if (selectedFilter === 'aktiv') {
      result = result.filter(role => role.is_active);
    } else if (selectedFilter === 'inaktiv') {
      result = result.filter(role => !role.is_active);
    }

    // Sortierung nach Hierarchie
    const roleOrder: { [key: string]: number } = {
      'org_admin': 1, 'admin': 2, 'teamer': 3, 'konfi': 4
    };
    result = result.sort((a, b) => {
      return (roleOrder[a.name] || 99) - (roleOrder[b.name] || 99);
    });

    return result;
  })();

  const getTotalUsers = () => {
    return roles.reduce((sum, role) => sum + role.user_count, 0);
  };

  const getRoleTypeColor = (role: Role) => {
    if (!role.is_active) return 'medium';
    switch (role.name) {
      case 'org_admin': return 'primary';
      case 'admin': return 'danger';
      case 'teamer': return 'warning';
      case 'konfi': return 'success';
      default: return 'tertiary';
    }
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? 'success' : 'medium';
  };

  const getStatusText = (isActive: boolean) => {
    return isActive ? 'Aktiv' : 'Inaktiv';
  };

  return (
    <>
      {/* Header Card mit Statistiken */}
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
              <IonCol size="6">
                <div style={{ textAlign: 'center' }}>
                  <IonIcon icon={shield} style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
                  <h3 style={{ margin: '0', fontSize: '1.5rem' }}>
                    {roles.length}
                  </h3>
                  <p style={{ margin: '0', fontSize: '0.9rem', opacity: 0.8 }}>
                    System-Rollen
                  </p>
                </div>
              </IonCol>
              <IonCol size="6">
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
            <IonSegmentButton value="aktiv">
              <IonIcon icon={checkmark} style={{ fontSize: '1rem', marginRight: '4px' }} />
              <IonLabel>Aktiv</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </IonCardContent>
      </IonCard>

      {/* Rollen Liste - Read-Only */}
      <IonCard style={{ margin: '16px' }}>
        <IonCardContent style={{ padding: '0' }}>
          <IonList>
            {filteredAndSortedRoles.map((role) => (
              <IonItem
                key={role.id}
                style={{
                  '--min-height': '56px',
                  '--padding-start': '16px'
                }}
              >
                <div slot="start" style={{
                  width: '32px',
                  height: '32px',
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
                    icon={lockClosed}
                    style={{
                      fontSize: '1rem',
                      color: 'white'
                    }}
                  />
                </div>

                <IonLabel>
                  <h2 style={{
                    fontWeight: '600',
                    fontSize: '1rem',
                    margin: '0 0 2px 0'
                  }}>
                    {role.display_name}
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
                      {role.name}
                    </span>

                    <IonBadge
                      color={getStatusColor(role.is_active)}
                      style={{
                        fontSize: '0.7rem',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}
                    >
                      {getStatusText(role.is_active)}
                    </IonBadge>

                    <IonBadge
                      color="primary"
                      style={{
                        fontSize: '0.7rem',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}
                    >
                      {role.user_count} Benutzer
                    </IonBadge>
                  </div>
                </IonLabel>
              </IonItem>
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