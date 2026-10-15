// Das Postfach hinter der Glocke -- Mitteilungen und Warteschlange -- als
// Logik ohne Darstellung (Simon, 15.10.2026: im Browser bekommt jedes Fenster,
// das noch ein App-Modal oeffnet, ein kompaktes Web-Fenster). Die App zeigt es
// im Modal (common/PostfachModal.tsx), der Browser ab 992 px im Dialog
// (common/web/WebPostfachDialog.tsx). Was geladen wird, was als gelesen gilt,
// wohin ein Klick fuehrt und was sich wegwischen laesst, steht nur hier,
// damit beide nicht auseinanderlaufen.
//
// Die Texte stehen NICHT alle hier: Leerzustand, Offline-Zeile und der
// Klartext des Punkts liegen unten als Konstanten, die der Dialog liest --
// das Modal schreibt dieselben Woerter selbst aus. Die Warteschlange zeigt
// das Modal mit der Karte der Terminseiten (shared/WartendeVorgaengeKarte),
// der Dialog baut sie mit denselben Ueberschriften und Ersatztexten nach.
// Dass beide Fassungen dieselben Texte zeigen, prueft
// postfachWebDialog.test.tsx an beiden (describe.each app/web).
//
// Laden:          GET /notifications/postfach { limit, vor? }
// Eine gelesen:   PUT /notifications/postfach/:id/gelesen
// Alle gelesen:   PUT /notifications/postfach/gelesen
// Wegwischen:     nur auf dem Geraet (services/writeQueue, useWartendeVorgaenge)
//
// Die Zahl an der Glocke bleibt, wie sie ist (Mitteilung = Sichtbarkeit,
// CLAUDE.md): Beide Fassungen melden dem BadgeContext dasselbe
// (postfachGelesen, danach refreshAllCounts), der Server zaehlt wie bisher.

import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { trackHandlung, serverSchluesselMesswert } from '../../services/analytics';
import { useApp } from '../../contexts/AppContext';
import { useBadge } from '../../contexts/BadgeContext';
import { useWartendeVorgaenge } from '../../hooks/useWartendeVorgaenge';
import {
  ICON_ABZEICHEN_GEFUELLT,
  ICON_WARTEND_GEFUELLT,
  ICON_ZUSAGE_GEFUELLT,
  ICON_ABSAGE,
  ICON_TERMIN_GEFUELLT,
  ICON_CHATS_GEFUELLT,
  ICON_CHALLENGE_GEFUELLT,
  ICON_INFO_GEFUELLT,
} from '../shared/icons';
import { getIconFromIoniconsName, istEmojiIcon } from '../../utils/badgeIcons';
import {
  POSTFACH_OEFFNEN_EVENT,
  PostfachAntwort,
  PostfachBereich,
  PostfachEintrag,
  postfachPraesentationsElement,
} from '../../utils/postfach';
import {
  buildPushTargetUrl,
  resolveOrgForPush,
  pushZielMelden,
  PushUserType,
} from '../../utils/pushNavigation';

/** Wie viele Mitteilungen je Seite geladen werden. */
export const POSTFACH_SEITENGROESSE = 30;

// Die Texte des Dialogs im Browser. Das Modal der App schreibt dieselben
// Woerter aus (Quelltext-Waechter in eckBadgesSymbolStattText.test.tsx lesen
// sie dort); dass beide gleich bleiben, prueft postfachWebDialog.test.tsx an
// beiden Fassungen.

/** Der Leerzustand. */
export const POSTFACH_LEER = {
  titel: 'Nichts Neues',
  text: 'Hier landen Punkte, Badges, Events, Anträge und Entscheidungen — auch die, deren Push du verpasst hast.',
} as const;

/** Was fehlt, wenn die Mitteilungen nicht kommen (OfflinePlatzhalter: „… ist offline nicht verfügbar."). */
export const POSTFACH_OFFLINE_WAS = 'Deine Mitteilungen';

/** Klartext des Punkts an einer ungelesenen Mitteilung. */
export const POSTFACH_UNGELESEN_TEXT = 'Neu — ungelesen';

/** Was im Farbkreis steht: ein Ionicon -- oder ein Emoji als Text. */
export type EintragSymbol = { icon: string; emoji?: undefined } | { emoji: string; icon?: undefined };

/**
 * Das Symbol im Farbkreis einer Mitteilung. Je Bereich eines; bei
 * Antraegen sagt es zusaetzlich, was Sache ist -- offen, verbucht oder
 * abgelehnt -- mit denselben Symbolen wie die Antragsliste der Leitung
 * (admin/ActivityRequestsView).
 *
 * Abzeichen zeigen IHR Symbol, nicht das generische Band (Simon, 25.09.2026:
 * "Im Postfach werden die Icons nicht genutzt bei Badges"). Die Schreibstelle
 * (badges.js) legt badge_icon in data ab -- gemessen in Produktion am
 * 25.09.2026: alle 629 Abzeichen-Mitteilungen tragen es. Aufgeloest wird der
 * gespeicherte Name ueber utils/badgeIcons wie ueberall sonst; Emoji (⛪, 👶
 * -- 54 der 629) kommen als Text, weil IonIcon sie nicht kann. Fehlt das
 * Feld, bleibt das Band.
 */
export const eintragSymbol = (eintrag: PostfachEintrag, bereich: PostfachBereich): EintragSymbol => {
  switch (bereich) {
    case 'badges': {
      const gespeichert = eintrag.data?.badge_icon;
      if (typeof gespeichert === 'string' && istEmojiIcon(gespeichert)) {
        return { emoji: gespeichert.trim() };
      }
      return { icon: getIconFromIoniconsName(typeof gespeichert === 'string' ? gespeichert : null, ICON_ABZEICHEN_GEFUELLT) };
    }
    case 'activities': {
      if (eintrag.type === 'activity_request_decision' || eintrag.type === 'activity_request_status') {
        return { icon: eintrag.data?.status === 'approved' ? ICON_ZUSAGE_GEFUELLT : ICON_ABSAGE };
      }
      return { icon: ICON_WARTEND_GEFUELLT };
    }
    case 'events':
      return { icon: ICON_TERMIN_GEFUELLT };
    case 'chat':
      return { icon: ICON_CHATS_GEFUELLT };
    case 'challenges':
      return { icon: ICON_CHALLENGE_GEFUELLT };
    default:
      return { icon: ICON_INFO_GEFUELLT };
  }
};

/**
 * Auf und zu: Die Glocke sagt nur "auf" (utils/postfach, Fenster-Ereignis),
 * das eine Postfach auf App-Ebene hoert zu -- in beiden Fassungen dieselbe
 * Stelle, damit Messung und Oeffnen nicht doppelt laufen.
 */
export const usePostfachSchalter = () => {
  const [offen, setOffen] = useState(false);
  // Das Element, das auf iOS hinter die Karte zuruecktritt (utils/postfach).
  const [praesentiertVon, setPraesentiertVon] = useState<HTMLElement | undefined>(undefined);

  useEffect(() => {
    const auf = () => {
      setPraesentiertVon(postfachPraesentationsElement());
      setOffen(true);
      // Anonyme Messung (docs/messung/umami.md, S8): wird die Glocke genutzt?
      trackHandlung('postfach-angesehen');
    };
    window.addEventListener(POSTFACH_OEFFNEN_EVENT, auf);
    return () => window.removeEventListener(POSTFACH_OEFFNEN_EVENT, auf);
  }, []);

  const schliessen = useCallback(() => setOffen(false), []);

  return { offen, praesentiertVon, schliessen };
};

export interface PostfachOptionen {
  /** Ist das Postfach gerade offen? Erst dann wird geladen. */
  offen: boolean;
  /** Schliesst das Postfach (vor dem Sprung zum Ziel einer Mitteilung). */
  schliessen: () => void;
}

/** Inhalt und Handgriffe des Postfachs -- fuer das Modal der App und den Dialog des Browsers. */
export const usePostfach = ({ offen, schliessen }: PostfachOptionen) => {
  const { user, activeOrgId, organizations, switchOrg } = useApp();
  const { refreshAllCounts, postfachGelesen } = useBadge();
  const { wartend, gescheitert, vergessen, alleVergessen } = useWartendeVorgaenge();

  const [eintraege, setEintraege] = useState<PostfachEintrag[]>([]);
  const [ungelesen, setUngelesen] = useState(0);
  const [weitere, setWeitere] = useState(false);
  const [laedt, setLaedt] = useState(false);
  const [ladefehler, setLadefehler] = useState(false);
  // Zwischen Klick und Sprung: Wechsel in die Gemeinde der Mitteilung (switchOrg).
  const [oeffnet, setOeffnet] = useState(false);
  // Solange switchOrg laeuft: in welche Gemeinde (name null, wenn der Server
  // keinen mitgeschickt hat). Der Dialog des Browsers sagt damit, warum er
  // steht -- der Wechsel wartet auf die Warteschlange und den Server.
  const [gemeindeWechsel, setGemeindeWechsel] = useState<{ name: string | null } | null>(null);

  // Gemeindename nur zeigen, wenn es etwas zu unterscheiden gibt.
  const mehrereGemeinden = (organizations?.length ?? 0) > 1;

  const laden = useCallback(async (vor?: number) => {
    setLaedt(true);
    setLadefehler(false);
    try {
      const { data } = await api.get<PostfachAntwort>('/notifications/postfach', {
        params: { limit: POSTFACH_SEITENGROESSE, ...(vor ? { vor } : {}) },
      });
      const neue = Array.isArray(data?.eintraege) ? data.eintraege : [];
      setEintraege(prev => (vor ? [...prev, ...neue] : neue));
      setUngelesen(Number(data?.ungelesen) || 0);
      setWeitere(Boolean(data?.weitere));
    } catch {
      // Offline oder Server nicht erreichbar: Die Warteschlange oben ist
      // trotzdem da, die Mitteilungen bekommen eine Zeile, die sagt, was fehlt.
      setLadefehler(true);
    } finally {
      setLaedt(false);
    }
  }, []);

  // Beim Oeffnen frisch laden — nicht beim Montieren: Das Modal der App haengt
  // ab dem Start im Baum, die Liste braucht aber erst jemand, der die Glocke
  // tippt. Der Dialog des Browsers steht nur, solange er offen ist.
  useEffect(() => {
    if (offen) laden();
  }, [offen, laden]);

  const alsGelesenMerken = (id: number) => {
    setEintraege(prev => prev.map(e => (e.id === id && !e.read_at ? { ...e, read_at: new Date().toISOString() } : e)));
  };

  const antippen = async (eintrag: PostfachEintrag) => {
    // Anonyme Messung (S8): nur die ART der Mitteilung aus einer festen Liste
    // -- kein Titel, kein Inhalt, keine Kennung, keine Gemeinde.
    trackHandlung('mitteilung-angetippt', { art: serverSchluesselMesswert(eintrag.type) });
    if (!eintrag.read_at) {
      // Optimistisch: sofort als gelesen zeigen, der Server zieht nach. Geht
      // der PUT schief (offline), steht die Mitteilung beim naechsten Laden
      // wieder als ungelesen da — das ist der richtige Stand.
      alsGelesenMerken(eintrag.id);
      setUngelesen(n => Math.max(0, n - 1));
      // Die Glocke (und das App-Symbol) zaehlt sofort mit, nicht erst nach
      // der naechsten Server-Zaehlung (Befund Simon 27.09.2026).
      postfachGelesen(1);
      api.put(`/notifications/postfach/${eintrag.id}/gelesen`)
        .then(() => refreshAllCounts())
        .catch(() => { /* siehe oben */ });
    }

    // Ziel wie beim Push-Tap (AppContext, pushNotificationActionPerformed):
    // erst die Gemeinde des Inhalts, dann die Route mit der Rolle DORT.
    setOeffnet(true);
    let ziel: string;
    try {
      const aktuellerTyp = (user?.type || 'konfi') as PushUserType;
      const zielTyp = await resolveOrgForPush(
        { organization_id: eintrag.organization_id ?? undefined },
        aktuellerTyp,
        {
          getActiveOrgId: () => activeOrgId,
          getUserOrgId: () => user?.organization_id ?? null,
          // Ob gewechselt wird, entscheidet resolveOrgForPush allein; hier
          // wird nur mitgeschrieben, DASS es geschieht.
          switchOrg: (orgId: number) => {
            setGemeindeWechsel({ name: eintrag.organization_name || null });
            return switchOrg(orgId);
          },
        }
      );
      ziel = buildPushTargetUrl(eintrag.type, eintrag.data, zielTyp);
    } finally {
      setOeffnet(false);
      setGemeindeWechsel(null);
    }

    schliessen();
    // 'inApp': Die App laeuft schon, und man kommt von einer Seite, zu der man
    // zurueckwill -- der Seiten-Stack bleibt deshalb stehen (26.09.2026).
    if (ziel) pushZielMelden(ziel, 'inApp');
  };

  const alleGelesen = async () => {
    setEintraege(prev => prev.map(e => (e.read_at ? e : { ...e, read_at: new Date().toISOString() })));
    setUngelesen(0);
    postfachGelesen('alle');
    try {
      await api.put('/notifications/postfach/gelesen');
      await refreshAllCounts();
    } catch {
      // Offline: Der Server hat es nicht — beim naechsten Laden steht der
      // echte Stand wieder da.
    }
  };

  const aeltesteId = eintraege.length > 0 ? eintraege[eintraege.length - 1].id : undefined;
  /** Die naechste Seite: aelter als die aelteste bekannte Mitteilung (Cursor `vor`). */
  const aeltereLaden = () => laden(aeltesteId);

  return {
    eintraege,
    ungelesen,
    weitere,
    laedt,
    ladefehler,
    oeffnet,
    gemeindeWechsel,
    mehrereGemeinden,
    listeLeer: eintraege.length === 0,
    wartend,
    gescheitert,
    hatWarteschlange: wartend.length > 0 || gescheitert.length > 0,
    vergessen,
    alleVergessen,
    antippen,
    alleGelesen,
    aeltereLaden,
  };
};

export default usePostfach;
