import React from 'react';
import { IonButtons, IonButton, IonIcon, useIonActionSheet } from '@ionic/react';
import { swapHorizontalOutline } from 'ionicons/icons';
import { useApp } from '../../contexts/AppContext';

/**
 * Org-Switcher oben links im Header. Erscheint NUR, wenn der eingeloggte User in
 * mehreren Organisationen Mitglied ist (Multi-Org). Oeffnet ein Action-Sheet mit
 * allen Orgs; die aktive ist markiert. Bei Auswahl wird ueber den AppContext
 * gewechselt (neues Token, Cache-Invalidierung, Reload).
 */
const OrgSwitcherButton: React.FC = () => {
  const { organizations, activeOrgId, user, switchOrg } = useApp();
  const [presentActionSheet] = useIonActionSheet();

  // Nur bei echtem Multi-Org-User anzeigen
  if (!organizations || organizations.length <= 1) {
    return null;
  }

  // Die aktuell aktive Org: explizit gesetzte aktive Org, sonst Primaer-Org
  // (= organization_id des Users).
  const currentId = activeOrgId ?? user?.organization_id ?? null;

  const openSwitcher = () => {
    presentActionSheet({
      header: 'Organisation wechseln',
      buttons: [
        ...organizations.map((org) => ({
          text: org.id === currentId ? `${org.name}  •` : org.name,
          handler: () => {
            if (org.id !== currentId) {
              switchOrg(org.id);
            }
          }
        })),
        { text: 'Abbrechen', role: 'cancel' }
      ]
    });
  };

  return (
    <IonButtons slot="start">
      <IonButton onClick={openSwitcher}>
        <IonIcon
          slot="icon-only"
          icon={swapHorizontalOutline}
          className="app-icon-color--users"
          style={{ fontSize: '1.6rem' }}
        />
      </IonButton>
    </IonButtons>
  );
};

export default OrgSwitcherButton;
