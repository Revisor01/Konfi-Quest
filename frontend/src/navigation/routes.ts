import type React from 'react';
import { BAEUME } from './rollenBaeume';

// Routen, Tabs und Umleitungen als DATEN — eine Quelle für alle drei Rollen.
//
// Vorher standen sie dreimal fast wortgleich als JSX in MainTabs.tsx (420
// Zeilen, drei Blöcke à ~80 Zeilen). Das war genau das Muster, bei dem eine
// Änderung zwei Rollen vergisst: Simons stehende Warnung "Eine Änderung in
// nur einem der drei Bäume ist für zwei Drittel der Nutzer nicht gemacht" —
// im August 2026 mehrfach eingetreten.
//
// Jetzt rendert EIN Renderer (RoleTabs) aus dieser Tabelle. Eine neue Route
// hier gilt zwangsläufig für ihre Rolle, und der Test in
// __tests__/navigation/ iteriert über dieselbe Tabelle: Was hier steht, wird
// automatisch geprüft — keine Rolle kann vergessen werden.
//
// Zweiter Zweck: Beim Wechsel des Routers (Ionic 8 -> 9 bedeutet
// react-router 5 -> 6, das nächste Mal wieder etwas anderes) ändert sich nur
// der Renderer, nicht 68 einzelne JSX-Stellen.

export type Rolle = 'admin' | 'teamer' | 'konfi' | 'super_admin';

/** Welcher Zähler am Tab hängt. Die Werte kommen aus dem BadgeContext. */
export type BadgeKey = 'chat' | 'events' | 'challenges' | 'badges';

/**
 * Eine Route. Entweder ohne Parameter, oder mit — dann gehören `param` (wie
 * er in der URL heißt) und `propName` (wie die Seite ihn erwartet) zusammen.
 * Der Typ erzwingt das Paar: eines ohne das andere wäre eine Seite, die ihren
 * Parameter nie bekommt.
 *
 * Ausnahme sind Seiten, die sich den Wert selbst per useParams holen — die
 * tragen schlicht keines von beidem.
 */
export type RouteDef =
  | {
      /** Pfad wie er in der URL steht — der Vertrag nach außen. */
      path: string;
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any --
      Props sind kontravariant: Eine Tabelle, die Seiten mit UND ohne
      Parameter-Props traegt, laesst sich nur ueber any gemeinsam typisieren
      (ComponentType<Record<string, unknown>> nimmt die spezielleren Seiten
      gerade nicht an). Dass Route und Props zusammenpassen, sichert
      stattdessen __tests__/navigation/. */
      page: React.ComponentType<any>;
      param?: undefined;
      propName?: undefined;
    }
  | {
      path: string;
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any --
      Props sind kontravariant: Eine Tabelle, die Seiten mit UND ohne
      Parameter-Props traegt, laesst sich nur ueber any gemeinsam typisieren
      (ComponentType<Record<string, unknown>> nimmt die spezielleren Seiten
      gerade nicht an). Dass Route und Props zusammenpassen, sichert
      stattdessen __tests__/navigation/. */
      page: React.ComponentType<any>;
      /** Name des Parameters in der URL. */
      param: 'id' | 'roomId';
      /** Unter welchem Prop-Namen die Seite den Wert erwartet (als Zahl). */
      propName: 'konfiId' | 'eventId' | 'roomId' | 'challengeId' | 'anfrageId';
    };

export interface RedirectDef {
  from: string;
  to: string;
}

export interface TabDef {
  tab: string;
  href: string;
  icon: string;
  label: string;
  badge?: BadgeKey;
}

/**
 * Ein Eintrag der Seitenleiste, der kein Reiter ist (Web-Version, 03.10.2026).
 *
 * Die Seitenleiste links zeigt die Reiter (`tabs`) und danach diese
 * Eintraege. `path` muss eine Route desselben Baums sein, sonst landet der
 * Klick im Catch-all auf der Startseite (rollenBaeume.test.ts prueft das).
 * `icon` ist ein Symbol aus components/shared/icons.ts, wie bei den Reitern.
 * `gruppe` fasst Eintraege unter einer Ueberschrift zusammen; Eintraege ohne
 * Gruppe stehen direkt unter den Reitern.
 */
export interface MenueEintrag {
  path: string;
  label: string;
  icon: string;
  gruppe?: string;
}

export interface RollenBaum {
  /** Wohin nach dem Anmelden und von "/" bzw. "/login". */
  home: string;
  routes: RouteDef[];
  redirects: RedirectDef[];
  tabs: TabDef[];
  /** Weitere Eintraege der Seitenleiste (nur Web-Version, breites Fenster). */
  menue?: MenueEintrag[];
  /**
   * Das eigene Profil, unten in der Seitenleiste ueber „Abmelden". Ohne
   * Angabe steht dort kein Profil-Eintrag (Support-Konto ohne Gemeinde: es
   * hat keine Profilseite).
   */
  profil?: MenueEintrag;
}

/**
 * Startseite je Rolle. Stand vorher viermal ausgeschrieben (LoginView,
 * OrgSwitcherButton und zweimal in pushNavigation) — jede Kopie eine
 * Gelegenheit, eine Rolle zu vergessen.
 */
export const rollenStart = (rolle: Rolle): string => BAEUME[rolle].home;

/**
 * Der eine aktive Eintrag der Seitenleiste: der mit dem längsten passenden
 * Pfad (Pfad gleich oder darunter, wie bei Ionics Reiterleiste). Beim Team
 * liegen „Material" (/teamer/profile/material) und „Profil"
 * (/teamer/profile) ineinander -- auf der Materialseite darf nur „Material"
 * hervorgehoben sein. Ohne Treffer: null.
 */
export const aktiverPfad = (pathname: string, pfade: readonly string[]): string | null => {
  let bester: string | null = null;
  for (const pfad of pfade) {
    const passt = pathname === pfad || pathname.startsWith(pfad.endsWith('/') ? pfad : `${pfad}/`);
    if (passt && (bester === null || pfad.length > bester.length)) bester = pfad;
  }
  return bester;
};

/** Tab-Leiste verstecken: in Chat-Räumen aller Rollen. */
export const istTabLeisteVersteckt = (pfad: string): boolean =>
  /^\/(admin|teamer|konfi)\/chat\/room\//.test(pfad);

// Die Bäume stehen in rollenBaeume.ts — dort, wo auch die Seiten importiert
// werden. Diese Datei traegt nur Typen und Helfer.
export { BAEUME };
