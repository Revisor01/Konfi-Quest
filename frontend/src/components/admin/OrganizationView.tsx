import React, { useState, useRef } from 'react';
import {
  IonCard,
  IonCardContent,
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
  checkmark,
  createOutline,
  personOutline,
  calendarOutline
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
        background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
        borderRadius: '24px',
        padding: '0',
        margin: '16px',
        marginBottom: '16px',
        boxShadow: '0 20px 40px rgba(17, 153, 142, 0.3)',
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
              <IonIcon icon={business} style={{ fontSize: '1.5rem', color: 'white' }} />
            </div>
            <div>
              <h1 style={{
                margin: 0,
                fontSize: '1.5rem',
                fontWeight: '700',
                color: 'white'
              }}>
                Organisationen
              </h1>
              <p style={{
                margin: '2px 0 0 0',
                fontSize: '0.85rem',
                color: 'rgba(255,255,255,0.8)'
              }}>
                Gemeinden und Einrichtungen verwalten
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
                {organizations.length}
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
                {getActiveOrganizations().length}
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
                {getTotalKonfis()}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)', marginTop: '2px' }}>
                Konfis
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
                {getTotalUsers()}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)', marginTop: '2px' }}>
                Team
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
          backgroundColor: '#11998e',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(17, 153, 142, 0.3)',
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

      {/* Organisationen-Liste Section */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        margin: '16px 16px 12px 16px'
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          backgroundColor: '#38ef7d',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(56, 239, 125, 0.3)',
          flexShrink: 0
        }}>
          <IonIcon icon={businessOutline} style={{ fontSize: '1rem', color: 'white' }} />
        </div>
        <h2 style={{
          fontWeight: '600',
          fontSize: '1.1rem',
          margin: '0',
          color: '#333'
        }}>
          Organisationen ({filteredAndSortedOrganizations.length})
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
                    '--min-height': '90px',
                    '--padding-start': '16px',
                    '--padding-top': '0px',
                    '--padding-bottom': '0px',
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
                    opacity: organization.is_active ? 1 : 0.8
                  }}
                >
                  <IonLabel>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '6px'
                    }}>
                      {/* Avatar */}
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: '600',
                        fontSize: '0.9rem',
                        boxShadow: '0 2px 8px rgba(17, 153, 142, 0.4)',
                        flexShrink: 0
                      }}>
                        {getInitials(organization.display_name)}
                      </div>

                      {/* Name */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h2 style={{
                          fontWeight: '600',
                          fontSize: 'clamp(0.9rem, 2.5vw, 1rem)',
                          margin: '0',
                          color: organization.is_active ? '#1a1a1a' : '#999',
                          lineHeight: '1.3',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {organization.display_name}
                        </h2>
                        <p style={{
                          fontSize: '0.8rem',
                          color: '#666',
                          margin: '2px 0 0 0'
                        }}>
                          {organization.name}
                        </p>
                      </div>

                      {/* Status Badge */}
                      <IonBadge
                        color={organization.is_active ? 'success' : 'medium'}
                        style={{
                          fontSize: '0.7rem',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          flexShrink: 0
                        }}
                      >
                        {organization.is_active ? 'Aktiv' : 'Inaktiv'}
                      </IonBadge>
                    </div>

                    {/* Details Row */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      fontSize: '0.8rem',
                      color: organization.is_active ? '#666' : '#999',
                      marginLeft: '52px'
                    }}>
                      <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        color: '#11998e'
                      }}>
                        <IonIcon icon={people} style={{ fontSize: '0.8rem' }} />
                        {organization.konfi_count} Konfis
                      </span>

                      <span style={{ color: '#ccc' }}>|</span>

                      <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        color: '#667eea'
                      }}>
                        <IonIcon icon={personOutline} style={{ fontSize: '0.8rem' }} />
                        {organization.user_count} Team
                      </span>

                      {organization.activity_count > 0 && (
                        <>
                          <span style={{ color: '#ccc' }}>|</span>
                          <span style={{ color: '#f59e0b' }}>
                            {organization.activity_count}A
                          </span>
                        </>
                      )}

                      {organization.contact_email && (
                        <>
                          <span style={{ color: '#ccc' }}>|</span>
                          <span style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            color: '#999',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '120px'
                          }}>
                            {organization.contact_email}
                          </span>
                        </>
                      )}
                    </div>
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
                      backgroundColor: '#11998e',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 8px rgba(17, 153, 142, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)'
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
              <IonItem lines="none">
                <IonLabel style={{ textAlign: 'center', color: '#999', padding: '32px 0' }}>
                  <IonIcon icon={businessOutline} style={{ fontSize: '2rem', marginBottom: '8px', display: 'block' }} />
                  <p style={{ margin: 0 }}>Keine Organisationen gefunden</p>
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
