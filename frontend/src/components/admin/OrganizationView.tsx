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
  business,
  people,
  checkmark,
  close,
  globe,
  analytics,
  calendar,
  trophy
} from 'ionicons/icons';
import { useApp } from '../../contexts/AppContext';
import { filterBySearchTerm } from '../../utils/helpers';

interface Organization {
  id: number;
  name: string;
  display_name: string;
  description?: string;
  contact_email?: string;
  website_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Statistics
  user_count: number;
  konfi_count: number;
  activity_count: number;
  event_count: number;
  badge_count: number;
}

interface OrganizationViewProps {
  organizations: Organization[];
  onUpdate: () => void;
  onAddOrganizationClick: () => void;
  onSelectOrganization: (organization: Organization) => void;
  onDeleteOrganization: (organization: Organization) => void;
}

const OrganizationView: React.FC<OrganizationViewProps> = ({ 
  organizations, 
  onUpdate, 
  onAddOrganizationClick,
  onSelectOrganization,
  onDeleteOrganization
}) => {
  const [presentActionSheet] = useIonActionSheet();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('alle');

  const filteredAndSortedOrganizations = (() => {
    let result = filterBySearchTerm(organizations, searchTerm, ['name', 'display_name', 'description', 'contact_email']);
    
    // Filter by status
    if (selectedFilter === 'aktiv') {
      result = result.filter(org => org.is_active);
    } else if (selectedFilter === 'inaktiv') {
      result = result.filter(org => !org.is_active);
    } else if (selectedFilter === 'groß') {
      result = result.filter(org => org.konfi_count > 10);
    } else if (selectedFilter === 'klein') {
      result = result.filter(org => org.konfi_count <= 10);
    }
    
    // Sort by created_at (newest first)
    result = result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    return result;
  })();

  const getActiveOrganizations = () => {
    return organizations.filter(org => org.is_active);
  };

  const getInactiveOrganizations = () => {
    return organizations.filter(org => !org.is_active);
  };

  const getTotalKonfis = () => {
    return organizations.reduce((sum, org) => sum + org.konfi_count, 0);
  };

  const getTotalUsers = () => {
    return organizations.reduce((sum, org) => sum + org.user_count, 0);
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? 'success' : 'medium';
  };

  const getStatusText = (isActive: boolean) => {
    return isActive ? 'Aktiv' : 'Inaktiv';
  };

  const getOrganizationSizeColor = (konfiCount: number) => {
    if (konfiCount === 0) return 'medium';
    if (konfiCount <= 5) return 'primary';
    if (konfiCount <= 15) return 'warning';
    return 'success';
  };

  const getOrganizationSizeText = (konfiCount: number) => {
    if (konfiCount === 0) return 'Keine Konfis';
    if (konfiCount <= 5) return 'Klein';
    if (konfiCount <= 15) return 'Mittel';
    return 'Groß';
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
      {/* Header Card mit Statistiken - Grüner Gradient */}
      <IonCard style={{
        margin: '16px',
        borderRadius: '16px',
        background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
        color: 'white',
        boxShadow: '0 8px 32px rgba(17, 153, 142, 0.3)'
      }}>
        <IonCardContent>
          <IonGrid>
            <IonRow>
              <IonCol size="3">
                <div style={{ textAlign: 'center' }}>
                  <IonIcon icon={business} style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
                  <h3 style={{ margin: '0', fontSize: '1.5rem' }}>
                    {organizations.length}
                  </h3>
                  <p style={{ margin: '0', fontSize: '0.9rem', opacity: 0.8 }}>
                    Orgs
                  </p>
                </div>
              </IonCol>
              <IonCol size="3">
                <div style={{ textAlign: 'center' }}>
                  <IonIcon icon={checkmark} style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
                  <h3 style={{ margin: '0', fontSize: '1.5rem' }}>
                    {getActiveOrganizations().length}
                  </h3>
                  <p style={{ margin: '0', fontSize: '0.9rem', opacity: 0.8 }}>
                    Aktiv
                  </p>
                </div>
              </IonCol>
              <IonCol size="3">
                <div style={{ textAlign: 'center' }}>
                  <IonIcon icon={people} style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
                  <h3 style={{ margin: '0', fontSize: '1.5rem' }}>
                    {getTotalKonfis()}
                  </h3>
                  <p style={{ margin: '0', fontSize: '0.9rem', opacity: 0.8 }}>
                    Konfis
                  </p>
                </div>
              </IonCol>
              <IonCol size="3">
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
              placeholder="Organisation suchen..."
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
              <IonIcon icon={business} style={{ fontSize: '1rem', marginRight: '4px' }} />
              <IonLabel>Alle</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="aktiv">
              <IonIcon icon={checkmark} style={{ fontSize: '1rem', marginRight: '4px' }} />
              <IonLabel>Aktiv</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="groß">
              <IonIcon icon={analytics} style={{ fontSize: '1rem', marginRight: '4px' }} />
              <IonLabel>Groß</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="klein">
              <IonIcon icon={people} style={{ fontSize: '1rem', marginRight: '4px' }} />
              <IonLabel>Klein</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </IonCardContent>
      </IonCard>

      {/* Organisationen Liste */}
      <IonCard style={{ margin: '16px' }}>
        <IonCardContent style={{ padding: '0' }}>
          <IonList>
            {filteredAndSortedOrganizations.map((organization) => (
              <IonItemSliding key={organization.id}>
                <IonItem 
                  button 
                  onClick={() => onSelectOrganization(organization)}
                  style={{ '--min-height': '64px', '--padding-start': '16px' }}
                >
                  <IonAvatar slot="start" style={{ marginRight: '12px' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: '600',
                      fontSize: '0.85rem'
                    }}>
                      {getInitials(organization.display_name)}
                    </div>
                  </IonAvatar>
                  
                  <IonLabel>
                    <h2 style={{ 
                      fontWeight: '600', 
                      fontSize: '1rem',
                      margin: '0 0 2px 0'
                    }}>
                      {organization.display_name}
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
                        {organization.name}
                      </span>
                      
                      <IonBadge 
                        color={getStatusColor(organization.is_active)}
                        style={{ 
                          fontSize: '0.7rem',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}
                      >
                        {getStatusText(organization.is_active)}
                      </IonBadge>
                      
                      <IonBadge 
                        color={getOrganizationSizeColor(organization.konfi_count)}
                        style={{ 
                          fontSize: '0.7rem',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}
                      >
                        {organization.konfi_count}K
                      </IonBadge>
                      
                      <IonBadge 
                        color="tertiary"
                        style={{ 
                          fontSize: '0.7rem',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}
                      >
                        {organization.user_count}U
                      </IonBadge>
                      
                      {organization.activity_count > 0 && (
                        <IonBadge 
                          color="primary"
                          style={{ 
                            fontSize: '0.7rem',
                            padding: '2px 6px',
                            borderRadius: '4px'
                          }}
                        >
                          {organization.activity_count}A
                        </IonBadge>
                      )}
                      
                      {organization.contact_email && (
                        <span style={{ 
                          fontSize: '0.7rem',
                          color: '#999',
                          marginLeft: 'auto'
                        }}>
                          {organization.contact_email}
                        </span>
                      )}
                    </div>
                  </IonLabel>
                </IonItem>

                <IonItemOptions side="end">
                  <IonItemOption 
                    color="primary" 
                    onClick={() => onSelectOrganization(organization)}
                  >
                    <IonIcon icon={create} />
                  </IonItemOption>
                  <IonItemOption 
                    color="danger" 
                    onClick={() => onDeleteOrganization(organization)}
                  >
                    <IonIcon icon={trash} />
                  </IonItemOption>
                </IonItemOptions>
              </IonItemSliding>
            ))}
            
            {filteredAndSortedOrganizations.length === 0 && (
              <IonItem>
                <IonLabel style={{ textAlign: 'center', color: '#666' }}>
                  <p>Keine Organisationen gefunden</p>
                </IonLabel>
              </IonItem>
            )}
          </IonList>
        </IonCardContent>
      </IonCard>
    </>
  );
};

export default OrganizationView;