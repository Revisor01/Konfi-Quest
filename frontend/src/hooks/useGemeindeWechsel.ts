import { useCallback, useState } from 'react';
import { useIonRouter } from '@ionic/react';
import { useApp } from '../contexts/AppContext';
import type { UserOrganization } from '../contexts/AppContext';
import api from '../services/api';
import { offenJeOrgAusAntwort } from '../utils/offenJeGemeinde';

// Der Gemeinde-Wechsel -- EINE Stelle fuer beide Umschalter.
//
// Es gibt zwei Gesichter desselben Vorgangs: den Knopf in der Kopfzeile der
// App (components/shared/OrgSwitcherButton.tsx) und die gestaltete Flaeche
// unten in der Leiste der Web-Version (components/layout/LeistenGemeinde.tsx,
// Simon 03.10.2026: im breiten Fenster nur dort, nicht mehr in der Kopfzeile).
// Beide rufen diese Hooks. Was beim Wechsel geschieht -- wechseln, auf die
// Startseite der Rolle in der neuen Gemeinde gehen und dabei den Seitenstapel
// der alten leeren --, steht deshalb nur hier. Stuende es zweimal, liefe die
// Leiste beim naechsten Umbau der Startseiten anders als die App.

/**
 * Die Startseite einer Rolle in einer Gemeinde. Wie rollenStart() in
 * navigation/routes.ts, aber nach dem Rollennamen der GEMEINDE (org_admin,
 * admin, teamer, konfi) statt nach dem Baum -- und ohne die Seitenbaeume
 * mitzuladen, die der Kopfzeilen-Knopf sonst nicht braucht.
 */
export const startseiteDerRolle = (rolle?: string): string =>
  rolle === 'konfi' ? '/konfi/dashboard'
    : rolle === 'teamer' ? '/teamer/dashboard'
      : '/admin/konfis';

// Eine feste leere Liste: Ein neues [] je Aufruf liesse alles, was von
// `gemeinden` abhaengt, bei jedem Rendern neu rechnen.
const KEINE_GEMEINDEN: UserOrganization[] = [];

export interface GemeindeWechsel {
  /** Alle Gemeinden des Kontos (leer, solange nichts geladen ist). */
  gemeinden: UserOrganization[];
  /** Kennung der Gemeinde, in der man gerade arbeitet. */
  aktiveId: number | null;
  /** Die Gemeinde, in der man gerade arbeitet. */
  aktive: UserOrganization | undefined;
  /** Nur bei mehr als einer Gemeinde gibt es etwas zu waehlen. */
  mehrere: boolean;
  /** Die Gemeinde wechseln und auf die Startseite der dortigen Rolle gehen. */
  wechseln: (orgId: number) => Promise<void>;
}

export function useGemeindeWechsel(): GemeindeWechsel {
  const { organizations, activeOrgId, user, switchOrg } = useApp();
  const router = useIonRouter();

  const gemeinden = organizations ?? KEINE_GEMEINDEN;
  // Aktuell aktive Gemeinde: explizit gesetzte, sonst die Stamm-Gemeinde.
  const aktiveId = activeOrgId ?? user?.organization_id ?? null;
  const aktive = gemeinden.find((o) => o.id === aktiveId);

  const wechseln = useCallback(async (orgId: number): Promise<void> => {
    if (orgId === aktiveId) return;

    const ziel = gemeinden.find((o) => o.id === orgId);
    await switchOrg(orgId);

    // Auf die Startseite der (neuen) Rolle navigieren und dabei den
    // Page-Stack der alten Gemeinde leeren (Ionic: Richtung 'root'). Das
    // stellt sicher, dass im nativen WebView nicht eine gecachte Seite der
    // alten Gemeinde sichtbar bleibt.
    router.push(startseiteDerRolle(ziel?.role_name), 'root', 'replace');
  }, [aktiveId, gemeinden, switchOrg, router]);

  return { gemeinden, aktiveId, aktive, mehrere: gemeinden.length > 1, wechseln };
}

export interface OffenJeGemeinde {
  /** Gemeinde-Kennung -> Zahl offener Vorgaenge; Gemeinden ohne Offenes fehlen. */
  offenJeOrg: Record<number, number>;
  /** Jetzt neu abfragen (beim Oeffnen der Liste). */
  laden: () => Promise<void>;
}

/**
 * Was je Gemeinde offen ist, fuer die rote Zahl am Eintrag der Liste
 * (Simon, 25.09.2026: "an jede Org einen Indikator haengen -- das wuerde
 * helfen, wenn was offen ist"). Abgefragt wird beim Oeffnen der Liste, damit
 * die Zahl dann frisch ist. Schlaegt die Abfrage fehl, bleibt die Liste ohne
 * Zahlen benutzbar -- der Indikator ist Beiwerk, kein Hinweis, kein Fehler.
 * Wie die Antwort gelesen wird, steht in utils/offenJeGemeinde.ts.
 */
export function useOffenJeGemeinde(): OffenJeGemeinde {
  const [offenJeOrg, setOffenJeOrg] = useState<Record<number, number>>({});

  const laden = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications/badge-counts/je-organisation');
      setOffenJeOrg(offenJeOrgAusAntwort(data));
    } catch {
      // Ohne Zahl bleibt die Liste, wie sie war -- kein Hinweis, kein Fehler.
    }
  }, []);

  return { offenJeOrg, laden };
}
