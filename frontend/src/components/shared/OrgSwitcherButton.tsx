import React, { useCallback, useState } from 'react';
import {
  IonBadge,
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
import { useIonRouter } from '@ionic/react';
import { ICON_HAKEN_GEFUELLT, ICON_ORGANISATION, ICON_WECHSEL } from './icons';
import { useApp } from '../../contexts/AppContext';
import { UserOrganization } from '../../contexts/AppContext';
import api from '../../services/api';

// Kurzname für die Header-Anzeige (Platz neben dem Seitentitel ist knapp).
// Explizites Mapping für die bekannten Orgs; Fallback für kuenftige Orgs ist
// das letzte Slug-Segment, kapitalisiert (z.B. 'kirchengemeinde-heide' -> 'Heide').
const ORG_SHORT_NAMES: Record<string, string> = {
  'kirchspiel-west': 'West',
  'kirchengemeinde-hennstedt': 'Hennstedt',
  'kirchengemeinde-heide': 'Heide',
  'test-demo': 'Test'
};

const shortOrgName = (org?: UserOrganization): string => {
  if (!org) return '';
  const slug = org.slug || '';
  if (ORG_SHORT_NAMES[slug]) return ORG_SHORT_NAMES[slug];
  // Fallback: letztes Slug-Segment kapitalisieren, sonst display_name/name.
  const last = slug.split('-').filter(Boolean).pop();
  if (last) return last.charAt(0).toUpperCase() + last.slice(1);
  return org.display_name || org.name || '';
};

/**
 * Was je Gemeinde offen ist, aus der Antwort von
 * GET /notifications/badge-counts/je-organisation. Nur Gemeinden mit einer
 * Zahl groesser 0 bleiben stehen -- "nichts offen" heisst: kein Eintrag,
 * keine Zahl. Aeltere Server ohne die Route oder ohne das Feld ergeben ein
 * leeres Objekt, kein Fehler.
 */
export const offenJeOrgAusAntwort = (data: unknown): Record<number, number> => {
  const ergebnis: Record<number, number> = {};
  const roh = (data as { jeOrganisation?: unknown } | null | undefined)?.jeOrganisation;
  if (!roh || typeof roh !== 'object') return ergebnis;
  Object.entries(roh as Record<string, unknown>).forEach(([orgId, eintrag]) => {
    const offen = Number((eintrag as { offen?: unknown } | null | undefined)?.offen) || 0;
    const id = Number(orgId);
    if (offen > 0 && Number.isFinite(id)) ergebnis[id] = offen;
  });
  return ergebnis;
};

/**
 * Org-Switcher oben links im Header. Erscheint NUR, wenn der eingeloggte User in
 * mehreren Organisationen Mitglied ist (Multi-Org). Der Button zeigt das Wechsel-
 * Symbol UND den Namen der aktuell aktiven Org (so weiß man immer, wo man ist).
 * Tippen oeffnet ein Popover mit allen Orgs; die aktive ist mit Haekchen markiert.
 * Bei Auswahl wird über den AppContext gewechselt (neues Token, Cache-Reset,
 * org:switched-Event + Root-Navigation -> alle Views laden frisch in der neuen Org).
 *
 * Das Icon hat KEINE Farbklasse -> Standard-Toolbar-Farbe, genau wie die
 * Action-Buttons rechts im selben Header.
 *
 * INDIKATOR JE GEMEINDE (25.09.2026, Simon: "an jede Org einen Indikator
 * haengen -- das wuerde helfen, wenn was offen ist"): Beim Oeffnen der Liste
 * fragt der Knopf einmal ab, was je Gemeinde offen ist, und zeigt die Zahl
 * als rote Kugel am Eintrag -- dieselbe Form wie die Zahl am Reiter. So sieht
 * man, wo Arbeit liegt, statt erst hineinzuwechseln. "Offen" meint dasselbe
 * wie am App-Symbol, nur je Gemeinde aufgeteilt; die Rolle und die
 * Jahrgangsbindung gelten dabei je Gemeinde (der Server rechnet das).
 *
 * Abgefragt wird erst beim Oeffnen, nicht mit jedem Zaehler-Refresh: Die Liste
 * ist selten offen, und die Zahl soll dann frisch sein. Schlaegt die Abfrage
 * fehl, bleibt die Liste ohne Zahlen benutzbar -- der Indikator ist Beiwerk.
 */
const OrgSwitcherButton: React.FC = () => {
  const { organizations, activeOrgId, user, switchOrg } = useApp();
  const router = useIonRouter();
  const [popoverEvent, setPopoverEvent] = useState<MouseEvent | undefined>(undefined);
  const [isOpen, setIsOpen] = useState(false);
  const [offenJeOrg, setOffenJeOrg] = useState<Record<number, number>>({});

  const ladeOffenJeOrg = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications/badge-counts/je-organisation');
      setOffenJeOrg(offenJeOrgAusAntwort(data));
    } catch {
      // Ohne Zahl bleibt die Liste, wie sie war -- kein Hinweis, kein Fehler.
    }
  }, []);

  // Nur bei echtem Multi-Org-User anzeigen
  if (!organizations || organizations.length <= 1) {
    return null;
  }

  // Aktuell aktive Org: explizit gesetzte aktive Org, sonst Primaer-Org.
  const currentId = activeOrgId ?? user?.organization_id ?? null;
  const currentOrg = organizations.find(o => o.id === currentId);
  const currentShort = shortOrgName(currentOrg);

  const open = (e: React.MouseEvent) => {
    setPopoverEvent(e.nativeEvent);
    setIsOpen(true);
    void ladeOffenJeOrg();
  };

  const handleSelect = async (orgId: number) => {
    setIsOpen(false);
    if (orgId === currentId) return;

    const target = organizations.find(o => o.id === orgId);
    await switchOrg(orgId);

    // Auf die Startseite der (neuen) Rolle navigieren und dabei den Page-Stack
    // der alten Org leeren (Ionic: direction 'root'). Das stellt sicher, dass im
    // nativen WebView nicht eine gecachte Page der alten Org sichtbar bleibt.
    const role = target?.role_name;
    const home = role === 'konfi' ? '/konfi/dashboard'
      : role === 'teamer' ? '/teamer/dashboard'
      : '/admin/konfis';
    router.push(home, 'root', 'replace');
  };

  return (
    <>
      <IonButtons slot="start">
        {/* Icon + aktiver Org-Name -> man sieht immer, in welcher Org man ist.
            Kein Groessen-/Farb-Override: Standard-Toolbar-Look wie die Buttons rechts. */}
        <IonButton onClick={open} className="app-org-switcher-btn">
          <IonIcon slot="start" icon={ICON_WECHSEL} />
          <span className="app-org-switcher-btn__name">{currentShort}</span>
        </IonButton>
      </IonButtons>

      <IonPopover
        isOpen={isOpen}
        event={popoverEvent}
        onDidDismiss={() => setIsOpen(false)}
        side="bottom"
        alignment="start"
        // Mehr Hoehe + komfortable Breite für die Org-Liste
        style={{ '--width': '280px', '--max-height': '70vh' } as React.CSSProperties}
      >
        <IonContent>
          <IonList>
            <IonListHeader>
              <IonLabel>Organisation wechseln</IonLabel>
            </IonListHeader>
            {organizations.map((org) => {
              const offen = offenJeOrg[org.id] || 0;
              return (
                <IonItem
                  key={org.id}
                  button
                  detail={false}
                  onClick={() => handleSelect(org.id)}
                >
                  <IonIcon slot="start" icon={ICON_ORGANISATION} />
                  <IonLabel>{org.display_name || org.name}</IonLabel>
                  {/* Rote Zahl wie am Reiter (MainTabs): "da liegt etwas". Bei 0
                      nichts -- ruhige Liste, die Zahl ist der Hinweis. */}
                  {offen > 0 && (
                    <IonBadge
                      slot="end"
                      color="danger"
                      className="app-org-switcher__offen"
                      aria-label={`${offen} offen`}
                    >
                      {offen > 99 ? '99+' : offen}
                    </IonBadge>
                  )}
                  {org.id === currentId && (
                    <IonIcon slot="end" icon={ICON_HAKEN_GEFUELLT} color="success" />
                  )}
                </IonItem>
              );
            })}
          </IonList>
        </IonContent>
      </IonPopover>
    </>
  );
};

export default OrgSwitcherButton;
