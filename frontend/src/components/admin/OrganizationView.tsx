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
  business,
  businessOutline,
  people,
  personOutline,
  createOutline,
  checkmarkCircle,
  flash,
  checkmark,
  closeCircle
} from 'ionicons/icons';
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
  const slidingRefs = useRef<Map<number, HTMLIonItemSlidingElement>>(new Map());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('alle');

  const filteredAndSortedOrganizations = (() => {
    let result = filterBySearchTerm(organizations, searchTerm, ['name', 'display_name', 'description', 'contact_email']);

    if (selectedFilter === 'aktiv') {
      result = result.filter(org => org.is_active);
    } else if (selectedFilter === 'inaktiv') {
      result = result.filter(org => !org.is_active);
    } else if (selectedFilter === 'gross') {
      result = result.filter(org => org.konfi_count > 10);
    } else if (selectedFilter === 'klein') {
      result = result.filter(org => org.konfi_count <= 10);
    }

    result = result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return result;
  })();

  const getActiveOrganizations = () => organizations.filter(org => org.is_active);
  const getTotalKonfis = () => organizations.reduce((sum, org) => sum + org.konfi_count, 0);
  const getTotalUsers = () => organizations.reduce((sum, org) => sum + org.user_count, 0);

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
      {/* Header - Dashboard-Style wie UsersView */}
      <div style={{
        background: 'linear-gradient(135deg, #2dd36f 0%, #16a34a 100%)',
        borderRadius: '24px',
        padding: '0',
        margin: '16px',
        marginBottom: '16px',
        boxShadow: '0 20px 40px rgba(45, 211, 111, 0.3)',
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
            ORGS
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
                    icon={business}
                    style={{
                      fontSize: '1.5rem',
                      color: 'rgba(255, 255, 255, 0.9)',
                      display: 'block',
                      margin: '0 auto 8px auto'
                    }}
                  />
                  <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>
                    {organizations.length}
                  </div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>
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
                    icon={people}
                    style={{
                      fontSize: '1.5rem',
                      color: 'rgba(255, 255, 255, 0.9)',
                      display: 'block',
                      margin: '0 auto 8px auto'
                    }}
                  />
                  <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>
                    {getTotalKonfis()}
                  </div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>
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
                    icon={personOutline}
                    style={{
                      fontSize: '1.5rem',
                      color: 'rgba(255, 255, 255, 0.9)',
                      display: 'block',
                      margin: '0 auto 8px auto'
                    }}
                  />
                  <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>
                    {getTotalUsers()}
                  </div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                    Team
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
              placeholder="Organisation suchen..."
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
            <IonSegmentButton value="gross">
              <IonLabel style={{ fontSize: '0.8rem' }}>Gross</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="klein">
              <IonLabel style={{ fontSize: '0.8rem' }}>Klein</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </IonCardContent>
      </IonCard>

      {/* Organisationen-Liste */}
      <IonCard style={{
        margin: '16px',
        borderRadius: '12px',
        background: 'white',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        border: '1px solid #e0e0e0'
      }}>
        <IonCardContent style={{ padding: '0' }}>
          <IonList lines="none" style={{ background: 'transparent', padding: '8px 0' }}>
            {filteredAndSortedOrganizations.map((organization) => (
              <IonItemSliding
                key={organization.id}
                ref={(ref) => {
                  if (ref) slidingRefs.current.set(organization.id, ref);
                }}
              >
                <IonItem
                  button
                  detail={false}
                  onClick={() => {
                    closeAllSlidingItems();
                    onSelectOrganization(organization);
                  }}
                  style={{
                    '--min-height': '88px',
                    '--padding-start': '16px',
                    '--padding-top': '12px',
                    '--padding-bottom': '12px',
                    '--background': '#fbfbfb',
                    '--border-radius': '12px',
                    margin: '4px 8px',
                    boxShadow: !organization.is_active
                      ? '0 2px 8px rgba(239, 68, 68, 0.15)'
                      : '0 2px 8px rgba(0,0,0,0.06)',
                    border: !organization.is_active
                      ? '1px solid #fca5a5'
                      : '1px solid #e0e0e0',
                    borderRadius: '12px',
                    opacity: organization.is_active ? 1 : 0.7
                  }}
                >
                  <IonLabel>
                    {/* Header mit Initialen-Icon */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '8px'
                    }}>
                      {/* Initialen-Icon - 36px */}
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        backgroundColor: organization.is_active ? '#2dd36f' : '#6b7280',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: organization.is_active
                          ? '0 2px 8px rgba(45, 211, 111, 0.4)'
                          : '0 2px 8px rgba(107, 114, 128, 0.4)',
                        flexShrink: 0,
                        color: 'white',
                        fontWeight: '700',
                        fontSize: '0.85rem'
                      }}>
                        {getInitials(organization.display_name)}
                      </div>

                      {/* Name */}
                      <h2 style={{
                        fontWeight: '600',
                        fontSize: 'clamp(0.95rem, 2.5vw, 1.05rem)',
                        margin: '0',
                        color: organization.is_active ? '#333' : '#999',
                        lineHeight: '1.3',
                        flex: 1,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {organization.display_name}
                      </h2>
                    </div>

                    {/* Details Row mit Icons */}
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '12px',
                      marginLeft: '48px',
                      fontSize: '0.8rem',
                      color: organization.is_active ? '#666' : '#999'
                    }}>
                      {/* Konfis */}
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <IonIcon icon={people} style={{ fontSize: '0.85rem', color: '#34c759' }} />
                        {organization.konfi_count} Konfis
                      </span>
                      {/* Team */}
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <IonIcon icon={personOutline} style={{ fontSize: '0.85rem', color: '#f59e0b' }} />
                        {organization.user_count} Team
                      </span>
                      {/* Events */}
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <IonIcon icon={flash} style={{ fontSize: '0.85rem', color: '#dc2626' }} />
                        {organization.event_count} Events
                      </span>
                      {/* Status */}
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <IonIcon
                          icon={organization.is_active ? checkmarkCircle : closeCircle}
                          style={{ fontSize: '0.85rem', color: organization.is_active ? '#34c759' : '#dc3545' }}
                        />
                        {organization.is_active ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </div>

                    {/* Beschreibung falls vorhanden */}
                    {organization.description && (
                      <div style={{
                        marginLeft: '48px',
                        marginTop: '6px',
                        fontSize: '0.75rem',
                        color: '#999',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {organization.description}
                      </div>
                    )}
                  </IonLabel>
                </IonItem>

                <IonItemOptions side="end" style={{ gap: '4px', '--ion-item-background': 'transparent' }}>
                  <IonItemOption
                    onClick={() => {
                      closeAllSlidingItems();
                      onSelectOrganization(organization);
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
                      backgroundColor: '#2dd36f',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 8px rgba(45, 211, 111, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)'
                    }}>
                      <IonIcon icon={createOutline} style={{ fontSize: '1.2rem', color: 'white' }} />
                    </div>
                  </IonItemOption>
                  <IonItemOption
                    onClick={() => {
                      closeAllSlidingItems();
                      onDeleteOrganization(organization);
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
              </IonItemSliding>
            ))}

            {filteredAndSortedOrganizations.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px' }}>
                <IonIcon
                  icon={businessOutline}
                  style={{
                    fontSize: '3rem',
                    color: '#2dd36f',
                    marginBottom: '16px',
                    display: 'block',
                    margin: '0 auto 16px auto'
                  }}
                />
                <h3 style={{ color: '#666', margin: '0 0 8px 0' }}>Keine Organisationen gefunden</h3>
                <p style={{ color: '#999', margin: '0' }}>Noch keine Gemeinden angelegt</p>
              </div>
            )}
          </IonList>
        </IonCardContent>
      </IonCard>
    </>
  );
};

export default OrganizationView;
