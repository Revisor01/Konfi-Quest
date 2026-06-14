import React, { useState } from 'react';
import {
  IonButtons,
  IonButton,
  IonIcon,
  IonPopover,
  IonContent,
  IonList,
  IonListHeader,
  IonItem,
  IonLabel
} from '@ionic/react';
import { swapHorizontalOutline, checkmark } from 'ionicons/icons';
import { useApp } from '../../contexts/AppContext';

/**
 * Org-Switcher oben links im Header. Erscheint NUR, wenn der eingeloggte User in
 * mehreren Organisationen Mitglied ist (Multi-Org). Oeffnet ein Popover mit allen
 * Orgs; die aktive ist mit Haekchen markiert. Bei Auswahl wird ueber den
 * AppContext gewechselt (neues Token, Cache-Reset, Hard-Reload).
 *
 * Der Button hat bewusst KEINEN Groessen-Override, damit er exakt so gross ist
 * wie die Action-Buttons rechts im selben Header.
 */
const OrgSwitcherButton: React.FC = () => {
  const { organizations, activeOrgId, user, switchOrg } = useApp();
  const [popoverEvent, setPopoverEvent] = useState<MouseEvent | undefined>(undefined);
  const [isOpen, setIsOpen] = useState(false);

  // Nur bei echtem Multi-Org-User anzeigen
  if (!organizations || organizations.length <= 1) {
    return null;
  }

  // Aktuell aktive Org: explizit gesetzte aktive Org, sonst Primaer-Org.
  const currentId = activeOrgId ?? user?.organization_id ?? null;

  const open = (e: React.MouseEvent) => {
    setPopoverEvent(e.nativeEvent);
    setIsOpen(true);
  };

  const handleSelect = (orgId: number) => {
    setIsOpen(false);
    if (orgId !== currentId) {
      switchOrg(orgId);
    }
  };

  return (
    <>
      <IonButtons slot="start">
        <IonButton onClick={open}>
          <IonIcon slot="icon-only" icon={swapHorizontalOutline} className="app-icon-color--users" />
        </IonButton>
      </IonButtons>

      <IonPopover
        isOpen={isOpen}
        event={popoverEvent}
        onDidDismiss={() => setIsOpen(false)}
        side="bottom"
        alignment="start"
      >
        <IonContent>
          <IonList>
            <IonListHeader>
              <IonLabel>Organisation wechseln</IonLabel>
            </IonListHeader>
            {organizations.map((org) => (
              <IonItem
                key={org.id}
                button
                detail={false}
                onClick={() => handleSelect(org.id)}
              >
                <IonLabel>{org.display_name || org.name}</IonLabel>
                {org.id === currentId && (
                  <IonIcon slot="end" icon={checkmark} className="app-icon-color--users" />
                )}
              </IonItem>
            ))}
          </IonList>
        </IonContent>
      </IonPopover>
    </>
  );
};

export default OrgSwitcherButton;
