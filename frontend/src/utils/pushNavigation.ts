// Push-Tap-Navigation (Multi-Org-fähig).
//
// Jeder Push-Payload trägt seit dem Multi-Org-Ausbau eine organization_id —
// die Organisation des INHALTS. Ist die App beim Antippen auf eine andere
// Organisation geschaltet, wird VOR der Navigation über den bestehenden
// switchOrg-Flow gewechselt und erst nach abgeschlossenem Wechsel navigiert
// (ein harter Reload würde im nativen WebView die asynchronen
// Preferences-Writes abschneiden — und reisst beim Start die App ab, siehe
// PUSH_ZIEL_EVENT weiter unten).
//
// Wichtig (String vs. Number): FCM-data-Werte sind IMMER Strings, die Org im
// Client eine Number — verglichen wird deshalb auf beiden Seiten per String().

export type PushUserType = 'admin' | 'teamer' | 'konfi' | 'user';

/**
 * Ereignis, mit dem das Ziel eines angetippten Pushes an den Router uebergeben
 * wird. Der Tap-Handler liegt in AppContext und hat dort keinen Router-Zugriff;
 * navigation/PushZielNavigation lauscht innerhalb des Routers darauf.
 *
 * WARUM NICHT window.location.href (Maltes Befund 23.09.2026, Android):
 * "Da oeffnet sich die App fuer ganz kurz und stuerzt direkt ab." Eine
 * Zuweisung an location.href baut die App im nativen WebView vollstaendig neu
 * auf (capacitor://localhost) — und zwar genau, waehrend Android die Activity
 * hochfaehrt. Derselbe harte Reload war in App.tsx schon einmal die Ursache
 * ('auth:relogin-required': "konnte beim Wiederaufbau crashen"), und der
 * Kopfkommentar oben warnt selbst davor, weil er ausserdem die asynchronen
 * Preferences-Writes abschneidet.
 */
export const PUSH_ZIEL_EVENT = 'push:navigate';

/*
 * Merker fuer das Ziel: Ein Org-Wechsel vor der Navigation erhoeht orgVersion
 * und montiert damit den gesamten Router-Subtree neu (siehe App.tsx). Das
 * Ereignis kann deshalb in der Luecke zwischen Abbau und Aufbau landen, in der
 * niemand lauscht. Die neu montierte Komponente holt das Ziel dann hier ab.
 *
 * Das Ziel wird nur EINMAL herausgegeben — bliebe es stehen, sprang die App
 * bei jedem weiteren Montieren des Routers zurueck auf das alte Push-Ziel.
 */
let wartendesZiel: string | null = null;

/** Ziel eines angetippten Pushes an den Router uebergeben. Leeres Ziel = nichts tun. */
export const pushZielMelden = (ziel: string): void => {
  if (!ziel) return;
  wartendesZiel = ziel;
  window.dispatchEvent(new CustomEvent(PUSH_ZIEL_EVENT, { detail: { ziel } }));
};

/** Wartendes Ziel holen und dabei verbrauchen. Nichts da -> null. */
export const pushZielAbholen = (): string | null => {
  const ziel = wartendesZiel;
  wartendesZiel = null;
  return ziel;
};

export interface PushOrgSwitchDeps {
  // tokenStore-Getter (frisch, KEINE Closure-Werte — der Push-Effect in
  // AppContext hat nur [user] als Dependency, Closure-Werte wären veraltet).
  getActiveOrgId: () => number | null;
  getUserOrgId: () => number | null | undefined;
  // switchOrg aus dem AppContext: liefert ok + den User-Typ in der ZIEL-Org
  // (die Rolle kann pro Organisation unterschiedlich sein).
  switchOrg: (orgId: number) => Promise<{ ok: boolean; type?: PushUserType }>;
}

/**
 * Wechselt bei Bedarf in die Organisation des Push-Inhalts und liefert den
 * User-Typ, mit dem anschliessend die Ziel-Route gebaut wird.
 *
 * Fallbacks (bewusst konservativ — heutiges Verhalten beibehalten):
 * - keine organization_id im Payload (alte Pushes während des Rollouts),
 * - aktive Org unbekannt,
 * - Wechsel schlägt fehl (offline, Mitgliedschaft entzogen).
 */
export const resolveOrgForPush = async (
  data: Record<string, unknown> | undefined,
  currentType: PushUserType,
  deps: PushOrgSwitchDeps
): Promise<PushUserType> => {
  const raw = data?.organization_id;
  if (raw === undefined || raw === null || raw === '') return currentType;

  const targetOrgId = parseInt(String(raw), 10);
  if (!Number.isInteger(targetOrgId) || targetOrgId <= 0) return currentType;

  // Aktive Org: null im tokenStore heisst "Primär-Org" -> dann zählt die
  // organization_id des Users (wird bei switchOrg auf die aktive Org gesetzt).
  const currentOrgId = deps.getActiveOrgId() ?? deps.getUserOrgId() ?? null;
  if (currentOrgId === null) return currentType;
  if (String(currentOrgId) === String(targetOrgId)) return currentType;

  try {
    const result = await deps.switchOrg(targetOrgId);
    if (result?.ok) {
      return result.type || currentType;
    }
  } catch {
    // Fehlgeschlagener Wechsel: nicht abstürzen, mit dem alten Kontext
    // navigieren (wie vor dem Multi-Org-Ausbau).
  }
  return currentType;
};

/**
 * Ziel-URL für einen angetippten Push. Reine Funktion — der userType muss
 * bereits der Typ in der ZIEL-Organisation sein (siehe resolveOrgForPush).
 * Leerer String = keine Navigation (unbekannter Typ).
 */
export const buildPushTargetUrl = (
  notificationType: string | undefined,
  data: Record<string, unknown> | undefined,
  userType: PushUserType
): string => {
  const routePrefix = userType === 'admin' ? '/admin' : userType === 'teamer' ? '/teamer' : '/konfi';

  switch (notificationType) {
    case 'chat':
      // Direkt in den Raum: Die Route ist /chat/room/:roomId — der
      // fruehere Query-Parameter (?room=) wurde von keiner Seite
      // konsumiert, der Tap landete nur auf der Chat-Übersicht.
      if (data?.roomId) {
        return `${routePrefix}/chat/room/${data.roomId}`;
      }
      return `${routePrefix}/chat`;

    // activity_request_submitted und activity_request_decision sind die
    // beiden In-App-Mitteilungen zum Antrag (Tabelle notifications,
    // 25.09.2026): "Antrag eingereicht" an die antragstellende Person und
    // die Entscheidung der Leitung. Sie kamen nie als Push, sondern nur ins
    // Postfach -- und das navigiert seit dem 25.09.2026 ueber dieselbe
    // Funktion wie ein Push-Tap. Ziel wie beim Push zum selben Vorgang: die
    // Antragsliste der Rolle.
    case 'activity_request_status':
    case 'new_activity_request':
    case 'activity_request_submitted':
    case 'activity_request_decision':
      // Antrags-Ansicht je Rolle. Der Kommentar hier sagte bis 27.08.2026
      // "Teamer hat keine Requests-Page" und schickte sie aufs Dashboard --
      // /teamer/requests existiert inzwischen (Befund N1, Push-Bericht).
      return `${routePrefix}/requests`;

    case 'badge_earned':
      // Abzeichen-Seite je Rolle. Auch hier war der Kommentar veraltet
      // ("Teamer hat keine Badges-Page" -> Profil): /teamer/badges gibt es
      // (Befund N1). Beides landete in der richtigen Rolle, nur eine Ebene
      // zu hoch.
      return `${routePrefix}/badges`;

    case 'new_event': {
      // "Anmeldung möglich"-Push: direkt zum Event-Detail, wenn die ID
      // mitkommt (Konfi hat eine Detail-Route). Sonst zur Events-Liste.
      const evId = data?.event_id || data?.eventId;
      if (evId && userType === 'konfi') {
        return `/konfi/events/${evId}`;
      }
      return `${routePrefix}/events`;
    }

    // Anmeldung, Abmeldung, Nachruecken, Teilnahme, Erinnerung: zum Termin.
    //
    // Simons Befund am Geraet (24.09.2026): "Der Push leitet mich nur zur
    // allgemeinen Events-Liste und nicht ins Event." Auf beiden Wegen --
    // Teamer meldet sich an (Push an die Leitung), Konfi wird ueber das Web
    // hinzugefuegt (Push an den Konfi).
    //
    // Die Kennung kam in all diesen Pushes immer schon mit; sie wurde hier
    // nur nie gelesen. event_changed und event_cancelled machen es laengst
    // so -- das Muster war da, nur nicht ueberall ausgerollt.
    //
    // Fuer ALLE drei Rollen (seit 24.09.2026): Teamer:innen bekamen hier
    // bewusst die Liste, weil /teamer/events/:id fehlte -- ein Link dorthin
    // fiel in den Catch-all und landete auf dem Dashboard. Die Route gibt es
    // jetzt (rollenBaeume.ts, Umleitung auf ?eventId=), also dasselbe Ziel
    // wie bei Konfi und Leitung.
    case 'event_registered':
    case 'event_unregistered':
    case 'waitlist_promotion':
    case 'event_attendance':
    case 'event_reminder': {
      const evId = data?.event_id || data?.eventId;
      if (evId) {
        return `${routePrefix}/events/${evId}`;
      }
      return `${routePrefix}/events`;
    }

    // Zuruecknahme der Absage (16.09.2026): dasselbe Ziel wie die Absage.
    // Der Push sagt "prüf bitte, ob du Zeit hast, und melde dich sonst ab" —
    // genau das geht am Termin, nicht auf der Liste.
    case 'event_reactivated':
    case 'event_cancelled': {
      // Absage: zum Termin, wenn die Kennung mitkommt. Dort steht der Grund
      // ausfuehrlich und darunter, wer abgesagt hat — auf der Liste steht nur
      // "Abgesagt". Seit dem 24.09.2026 fuer alle drei Rollen: Teamer:innen
      // haben ihre Detailroute (rollenBaeume.ts, /teamer/events/:id).
      //
      // Der Termin ist abgesagt, aber nicht weg: Alle Detailansichten
      // oeffnen abgesagte Termine, und die Listen, aus denen Konfi- und
      // Teamer-Detail ihren Termin nehmen, behalten abgesagte Termine fuer
      // die Angemeldeten — also fuer genau die, die diesen Push bekommen haben.
      //
      // Wird ein GELOESCHTER Termin gemeldet, schickt der Server keine
      // Kennung mit (pushService): Dann bleibt es bei der Liste, statt auf
      // eine Seite zu springen, die es nicht mehr gibt.
      const evId = data?.event_id || data?.eventId;
      if (evId) {
        return `${routePrefix}/events/${evId}`;
      }
      return `${routePrefix}/events`;
    }

    case 'level_up':
    case 'activity_assigned':
    case 'bonus_points':
      // Dashboard (Punkte/Level)
      return userType === 'admin' ? '/admin/konfis' : `${routePrefix}/dashboard`;

    case 'event_unregistration': {
      // Konfi-Abmeldung bei der Leitung: seit dem 25.09.2026 traegt sie die
      // Termin-Kennung (Postfach: die Mitteilung bleibt stehen und soll an
      // den Termin fuehren, nicht auf die Liste). Aeltere Pushes ohne
      // Kennung landen wie bisher auf der Liste.
      const evId = data?.event_id || data?.eventId;
      if (evId) {
        return `${routePrefix}/events/${evId}`;
      }
      return `${routePrefix}/events`;
    }

    case 'events_pending_approval':
      // Admin: ausstehende Verbuchungen
      return userType === 'admin' ? '/admin/events' : `${routePrefix}/events`;

    case 'new_konfi_registration':
      // Admin: neue Registrierung
      return userType === 'admin' ? '/admin/konfis' : `${routePrefix}/dashboard`;

    case 'challenge_started':
      // Neue Challenge gestartet -> Challenge-Tab des Konfi (Leitung
      // bekommt diesen Push nicht, fällt aber sauber auf ihre
      // Challenge-Verwaltung zurück).
      return `${routePrefix}/challenges`;

    case 'challenge_submission':
      // Neuer Beitrag -> Moderation in der Leitungs-Ansicht.
      return userType === 'konfi' ? '/konfi/challenges' : `${routePrefix}/challenges`;

    case 'wrapped':
      // Bestandsluecke: Das Wrapped-Modal liegt auf dem Dashboard —
      // ohne diesen Fall lief der Tap ins Leere (default-Zweig).
      return `${routePrefix}/dashboard`;

    // ------------------------------------------------------------------
    // Ab hier: die zehn Typen, die bis zum 27.08.2026 im default-Zweig
    // landeten und damit KEIN Ziel hatten (Befund M2, Push-Bericht).
    // Der Tap oeffnete die App nur dort, wo sie zuletzt stand.
    // ------------------------------------------------------------------

    case 'event_changed':
    case 'event_opt_in':
    case 'event_opt_out':
    case 'mandatory_event_created': {
      // Termin-Detail, wenn die ID mitkommt. Bis zum 24.09.2026 nur fuer
      // Konfi und Leitung -- Teamer:innen hatten keine Detailroute; seit
      // /teamer/events/:id (rollenBaeume.ts) gilt es fuer alle drei Rollen.
      const evId = data?.event_id || data?.eventId;
      if (evId) {
        return `${routePrefix}/events/${evId}`;
      }
      return `${routePrefix}/events`;
    }

    case 'teamer_event_booking':
    case 'teamer_event_cancellation': {
      // Meldungen an die Leitung ueber Teamer-Buchungen: zum Termin, wenn die
      // Kennung mitkommt -- dort steht, WER sich an-/abgemeldet hat, und bei
      // einer Absage der Grund. Auf der Liste steht davon nichts.
      //
      // ACHTUNG, Stolperstelle: Diese beiden Pushes tragen die Kennung als
      // `eventId` (camelCase, pushService.js:2261), waehrend die Konfi-Pushes
      // `event_id` senden. Deshalb hier wie ueberall beide lesen.
      //
      // Andere Rollen bekommen diese Pushes nicht, fallen aber sauber auf ihre
      // eigene Liste zurueck.
      const evId = data?.event_id || data?.eventId;
      if (evId && (userType === 'konfi' || userType === 'admin')) {
        return `${routePrefix}/events/${evId}`;
      }
      return `${routePrefix}/events`;
    }

    case 'challenge_badge_earned':
      // Stempel aus einer Challenge -> Abzeichen-Seite der Rolle.
      return `${routePrefix}/badges`;

    case 'challenge_submission_hidden':
      // Eigener Beitrag ausgeblendet -> Challenge-Bereich, dort steht die
      // Begruendung am Beitrag.
      return `${routePrefix}/challenges`;

    case 'certificate':
      // Zertifikat -> Profil, dort liegt der Download.
      return `${routePrefix}/profile`;

    case 'jahrgang_deletion_warning':
      // Vorwarnung zur Jahrgangs-Archivierung. Betrifft die Leitung:
      // Einstellungen -> Jahrgaenge. Teamer:innen und Konfis haben diese
      // Seite nicht, fuer sie bleibt das Dashboard.
      return userType === 'admin'
        ? '/admin/settings/jahrgaenge'
        : `${routePrefix}/dashboard`;

    default:
      console.warn('Unbekannter Notification-Typ:', notificationType);
      return '';
  }
};
