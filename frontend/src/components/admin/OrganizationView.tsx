import React, { useState, useRef } from 'react';
import {
  IonCard,
  IonCardContent,
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
  IonSegmentButton,
  IonRefresher,
  IonRefresherContent
} from '@ionic/react';
import {
  trash,
  business,
  businessOutline,
  people,
  personOutline,
  createOutline,
  checkmarkCircle,
  flash,
  closeCircle,
  filterOutline
} from 'ionicons/icons';
import { filterBySearchTerm } from '../../utils/helpers';
import { SectionHeader, ListSection } from '../shared';

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

  const handleRefresh = (event: CustomEvent) => {
    onUpdate();
    setTimeout(() => event.detail.complete(), 500);
  };

  return (
    <>
      <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
        <IonRefresherContent />
      </IonRefresher>

      <SectionHeader
        title="Organisationen"
        subtitle="Gemeinden verwalten"
        icon={business}
        preset="organizations"
        stats={[
          { value: organizations.length, label: 'Gesamt' },
          { value: getTotalKonfis(), label: 'Konfis' },
          { value: getTotalUsers(), label: 'Team' }
        ]}
      />

      {/* Suche & Filter */}
      <IonList inset={true} className="app-segment-wrapper">
        <IonListHeader>
          <div className="app-section-icon app-section-icon--organizations">
            <IonIcon icon={filterOutline} />
          </div>
          <IonLabel>Suche & Filter</IonLabel>
        </IonListHeader>
        <IonCard className="app-card">
          <IonCardContent>
            <IonList>
              {/* Suchfeld */}
              <IonItem lines="full">
                <IonLabel position="stacked">Organisation suchen</IonLabel>
                <IonInput
                  value={searchTerm}
                  onIonInput={(e) => setSearchTerm(e.detail.value!)}
                  placeholder="Name eingeben..."
                  clearInput={true}
                />
              </IonItem>
              {/* Filter */}
              <IonItem lines="none">
                <IonLabel position="stacked">Status</IonLabel>
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
                  <IonSegmentButton value="gross">
                    <IonLabel>Gross</IonLabel>
                  </IonSegmentButton>
                  <IonSegmentButton value="klein">
                    <IonLabel>Klein</IonLabel>
                  </IonSegmentButton>
                </IonSegment>
              </IonItem>
            </IonList>
          </IonCardContent>
        </IonCard>
      </IonList>

      {/* Organisationen-Liste */}
      <ListSection
        icon={businessOutline}
        title="Organisationen"
        count={filteredAndSortedOrganizations.length}
        iconColorClass="organizations"
        isEmpty={filteredAndSortedOrganizations.length === 0}
        emptyIcon={businessOutline}
        emptyTitle="Keine Organisationen gefunden"
        emptyMessage="Noch keine Gemeinden angelegt"
        emptyIconColor="#667eea"
      >
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
                  className="app-list-item app-list-item--organizations"
                  style={{
                    '--padding-start': '16px',
                    '--padding-top': '12px',
                    '--padding-bottom': '12px',
                    opacity: organization.is_active ? 1 : 0.7
                  }}
                >
                  <IonLabel>
                    {/* Header mit Initialen-Icon */}
                    <div className="app-list-item__main">
                      {/* Initialen-Icon */}
                      <div
                        className="app-avatar-initials app-avatar-initials--sm"
                        style={{ backgroundColor: organization.is_active ? '#667eea' : '#6b7280' }}
                      >
                        {getInitials(organization.display_name)}
                      </div>

                      {/* Name */}
                      <div className="app-list-item__content">
                        <div
                          className="app-list-item__title"
                          style={!organization.is_active ? { color: '#999' } : undefined}
                        >
                          {organization.display_name}
                        </div>
                      </div>
                    </div>

                    {/* Details Row mit Icons */}
                    <div className="app-list-item__meta" style={!organization.is_active ? { color: '#999' } : undefined}>
                      {/* Konfis */}
                      <span className="app-list-item__meta-item">
                        <IonIcon icon={people} className="app-icon-color--participants" />
                        {organization.konfi_count} Konfis
                      </span>
                      {/* Team */}
                      <span className="app-list-item__meta-item">
                        <IonIcon icon={personOutline} className="app-icon-color--badges" />
                        {organization.user_count} Team
                      </span>
                      {/* Events */}
                      <span className="app-list-item__meta-item">
                        <IonIcon icon={flash} className="app-icon-color--events" />
                        {organization.event_count} Events
                      </span>
                      {/* Status */}
                      <span className="app-list-item__meta-item">
                        <IonIcon
                          icon={organization.is_active ? checkmarkCircle : closeCircle}
                          className={organization.is_active ? 'app-icon-color--success' : 'app-icon-color--danger'}
                        />
                        {organization.is_active ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </div>

                    {/* Beschreibung falls vorhanden */}
                    {organization.description && (
                      <div className="app-list-item__subtitle">
                        {organization.description}
                      </div>
                    )}
                  </IonLabel>
                </IonItem>

                <IonItemOptions side="end" className="app-swipe-actions">
                  <IonItemOption
                    onClick={() => {
                      closeAllSlidingItems();
                      onSelectOrganization(organization);
                    }}
                    className="app-swipe-action"
                  >
                    <div className="app-icon-circle app-icon-circle--lg app-icon-circle--organizations">
                      <IonIcon icon={createOutline} />
                    </div>
                  </IonItemOption>
                  <IonItemOption
                    onClick={() => {
                      closeAllSlidingItems();
                      onDeleteOrganization(organization);
                    }}
                    className="app-swipe-action"
                  >
                    <div className="app-icon-circle app-icon-circle--lg app-icon-circle--danger">
                      <IonIcon icon={trash} />
                    </div>
                  </IonItemOption>
                </IonItemOptions>
              </IonItemSliding>
            ))}

      </ListSection>
    </>
  );
};

export default OrganizationView;
