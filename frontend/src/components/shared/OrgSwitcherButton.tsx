import React, { useState } from 'react';
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
import { ICON_ORGANISATION, ICON_WECHSEL } from './icons';
import { UserOrganization } from '../../contexts/AppContext';
import { useGemeindeWechsel, useOffenJeGemeinde } from '../../hooks/useGemeindeWechsel';
import { offenJeOrgAusAntwort } from '../../utils/offenJeGemeinde';

// Kurzname für die Header-Anzeige (Platz neben dem Seitentitel ist knapp).
// Explizites Mapping für die bekannten Orgs; Fallback für kuenftige Orgs ist
// das letzte Slug-Segment, kapitalisiert (z.B. 'kirchengemeinde-heide' -> 'Heide').
// Eine Kurzform in den Organisationsdaten gibt es nicht; die Breite deckelt
// zusaetzlich das CSS (app-org-switcher-btn__name), der volle Name steht im
// aria-label des Knopfs und in der Liste.
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

// Die Regel, wie die Antwort gelesen wird, steht in utils/offenJeGemeinde.ts:
// Das App-Symbol liest dieselbe Antwort (BadgeContext, Befund BF-12).
export { offenJeOrgAusAntwort };

/**
 * Org-Switcher oben links im Header. Erscheint NUR, wenn der eingeloggte User in
 * mehreren Organisationen Mitglied ist (Multi-Org).
 *
 * Im breiten Fenster der Web-Version (ab 992 px, navigation/breitesLayout.ts)
 * steht er NICHT in der Kopfzeile (AppKopfzeile blendet ihn dort aus), sondern
 * als gestaltete Flaeche unten in der Leiste links: components/layout/
 * LeistenGemeinde.tsx (Simon, 03.10.2026). In den Apps und im schmalen
 * Fenster bleibt es bei diesem Knopf. Der Wechsel selbst steht fuer beide in
 * hooks/useGemeindeWechsel.ts.
 *
 * Der Button zeigt das Wechsel-Symbol UND den Namen der aktuell aktiven Org
 * (so weiß man immer, wo man ist).
 * Tippen oeffnet ein Popover mit allen Orgs; die aktive steht fett und leicht
 * hinterlegt -- dasselbe Muster wie app-list-item--selected in jeder anderen
 * Auswahl der App. Simon (25.09.2026, am Geraet): "der gruene Haken passt null
 * ins Design, mach das ausgewaehlt fett" und "der Name koennte kuerzer und
 * kleiner sein, das nimmt viel Platz weg" -- deshalb kein Haken mehr und der
 * Name am Knopf eine Stufe kleiner mit gedeckelter Breite.
 * Bei Auswahl wird über den AppContext gewechselt (neues Token, Cache-Reset,
 * org:switched-Event + Root-Navigation -> alle Views laden frisch in der neuen Org;
 * der Ablauf steht in hooks/useGemeindeWechsel.ts).
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
 * Abgefragt wird beim Oeffnen, damit die Zahl dann frisch ist. Schlaegt die
 * Abfrage fehl, bleibt die Liste ohne Zahlen benutzbar -- der Indikator ist
 * Beiwerk. Die Summe der Eintraege ist die Zahl am App-Symbol (Befund BF-12,
 * 27.09.2026): Server und BadgeContext rechnen sie aus derselben Aufteilung.
 */
const OrgSwitcherButton: React.FC = () => {
  // Wechseln, Startseite der Rolle und Stapel leeren, dazu die Zahlen je
  // Gemeinde: dieselben Hooks wie in der Leiste der Web-Version
  // (hooks/useGemeindeWechsel.ts) -- der Wechsel steht nur dort.
  const { gemeinden, aktiveId, aktive, mehrere, wechseln } = useGemeindeWechsel();
  const { offenJeOrg, laden } = useOffenJeGemeinde();
  const [popoverEvent, setPopoverEvent] = useState<MouseEvent | undefined>(undefined);
  const [isOpen, setIsOpen] = useState(false);

  // Nur bei echtem Multi-Org-User anzeigen
  if (!mehrere) {
    return null;
  }

  const currentId = aktiveId;
  const currentOrg = aktive;
  const currentShort = shortOrgName(currentOrg);

  const open = (e: React.MouseEvent) => {
    setPopoverEvent(e.nativeEvent);
    setIsOpen(true);
    void laden();
  };

  const handleSelect = async (orgId: number) => {
    setIsOpen(false);
    await wechseln(orgId);
  };

  return (
    <>
      <IonButtons slot="start">
        {/* Icon + aktiver Org-Name -> man sieht immer, in welcher Org man ist.
            Kein Groessen-/Farb-Override: Standard-Toolbar-Look wie die Buttons rechts. */}
        <IonButton
          onClick={open}
          className="app-org-switcher-btn"
          aria-label={`Gemeinde wechseln, gerade ${currentOrg?.display_name || currentOrg?.name || currentShort}`}
        >
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
              <IonLabel>Gemeinde wechseln</IonLabel>
            </IonListHeader>
            {gemeinden.map((org) => {
              const offen = offenJeOrg[org.id] || 0;
              const aktiv = org.id === currentId;
              return (
                <IonItem
                  key={org.id}
                  button
                  detail={false}
                  onClick={() => handleSelect(org.id)}
                  className={aktiv ? 'app-org-switcher__eintrag app-org-switcher__eintrag--aktiv' : 'app-org-switcher__eintrag'}
                  aria-current={aktiv ? 'true' : undefined}
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
