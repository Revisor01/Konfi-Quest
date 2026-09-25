import React, { useCallback, useEffect, useState } from 'react';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonList,
  IonListHeader,
  IonLabel,
  IonSpinner,
  IonCard,
  IonCardContent,
  IonIcon,
} from '@ionic/react';
import api from '../../services/api';
import { useApp } from '../../contexts/AppContext';
import { useBadge } from '../../contexts/BadgeContext';
import { useWartendeVorgaenge } from '../../hooks/useWartendeVorgaenge';
import WartendeVorgaengeKarte from '../shared/WartendeVorgaengeKarte';
import EmptyState from '../shared/EmptyState';
import OfflinePlatzhalter from '../shared/OfflinePlatzhalter';
import {
  ICON_GLOCKE,
  ICON_BENACHRICHTIGUNG,
  ICON_ABZEICHEN_GEFUELLT,
  ICON_WARTEND_GEFUELLT,
  ICON_ZUSAGE_GEFUELLT,
  ICON_ABSAGE,
  ICON_TERMIN_GEFUELLT,
  ICON_CHATS_GEFUELLT,
  ICON_CHALLENGE_GEFUELLT,
  ICON_INFO_GEFUELLT,
  ICON_ORGANISATION_GEFUELLT,
  ICON_SCHLIESSEN,
} from '../shared/icons';
import { getIconFromIoniconsName, istEmojiIcon } from '../../utils/badgeIcons';
import {
  POSTFACH_OEFFNEN_EVENT,
  PostfachAntwort,
  PostfachBereich,
  PostfachEintrag,
  mitteilungsTitel,
  postfachBereich,
  postfachPraesentationsElement,
  zeitpunktText,
} from '../../utils/postfach';
import {
  buildPushTargetUrl,
  resolveOrgForPush,
  pushZielMelden,
  PushUserType,
} from '../../utils/pushNavigation';

/** Wie viele Mitteilungen je Seite geladen werden. */
export const POSTFACH_SEITENGROESSE = 30;

/** Was im Farbkreis steht: ein Ionicon -- oder ein Emoji als Text. */
type EintragSymbol = { icon: string; emoji?: undefined } | { emoji: string; icon?: undefined };

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
const eintragSymbol = (eintrag: PostfachEintrag, bereich: PostfachBereich): EintragSymbol => {
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
 * Das Postfach: ein Ort fuer alles, was die App jemandem mitteilen will.
 *
 * Simon (25.09.2026): "Postfach bauen!" — erreichbar ueber die Glocke in der
 * Kopfzeile (PostfachGlocke), fuer alle drei Rollen.
 *
 * ZWEI QUELLEN, EIN ORT:
 *
 * 1. Empfangene Mitteilungen (Tabelle notifications). Gemessen in Produktion
 *    am 25.09.2026: 1.324 Zeilen, 570 in den letzten 30 Tagen — Abzeichen,
 *    eingegangene Antraege, eingereichte Antraege, Entscheidungen. Geschrieben
 *    wurde sie an sechs Stellen, GELESEN NIRGENDS: Es gab keine Leseroute und
 *    keinen Aufruf in der App. Wer den Push verpasst hatte, hatte die
 *    Nachricht verpasst. Seit dem 25.09.2026 liefert GET /notifications/postfach
 *    die eigenen Mitteilungen ueber ALLE Gemeinden des Kontos (Begruendung
 *    dort: das Postfach ist persoenlich wie das Mitteilungszentrum des
 *    Handys), jede mit dem Namen ihrer Gemeinde.
 *
 * 2. Die Offline-Warteschlange (services/writeQueue): was noch gesendet wird
 *    und was endgueltig gescheitert ist. Vorher hing dafuer ein runder Knopf
 *    links unten ueber der App (WartendeVorgaengeLeiste) — Simon: "sitzt an
 *    einer komischen Stelle", "falsch im Layout". Er geht in der Glocke auf.
 *    Die Karte auf den Terminseiten (WartendeVorgaengeKarte) BLEIBT dort:
 *    Die Glocke sagt "da ist noch was", die Karte sagt "und zwar das".
 *
 * DIE FORM DER LISTE (Simon, 25.09.2026, am Geraet): "Dann sollte es die
 * Listen so aussehen wie alle unsere Listen. Ionen-Card im Hintergrund /
 * Listen obendrauf / Aktivitaeten mit der klassischen Aktivitaetenfarbe /
 * Events mit der klassischen Eventsfarbe / Chat mit der klassischen
 * Chatfarbe und so weiter." Die erste Fassung war eine schlichte IonList mit
 * IonItems und einem Punkt davor -- anders als jede andere Liste der App.
 * Jetzt derselbe Bauplan wie ChatOverview, TeamerProfilePage und die
 * Warteschlange direkt darueber: IonList inset mit IonListHeader, darin eine
 * IonCard, darin je Mitteilung ein .app-list-item mit farbigem linken Rand
 * (.app-list-item--<bereich>) und Farbkreis (.app-icon-circle--<bereich>).
 * Welche Farbe: utils/postfach.postfachBereich -- Abzeichen in der
 * Abzeichenfarbe, Antraege in der Aktivitaetenfarbe. Die Warteschlange
 * traegt ihre Farben schon (orange fuer "wird gesendet", rot fuer
 * "nicht gesendet", WartendeVorgaengeKarte), das bleibt unveraendert.
 *
 * Antippen einer Mitteilung markiert sie als gelesen und fuehrt zum Ziel —
 * ueber denselben Weg wie ein angetippter Push (utils/pushNavigation):
 * bei Bedarf erst in die Gemeinde des Inhalts wechseln, dann navigieren.
 * Nichts davon ist hier neu erfunden.
 *
 * Haengt EINMAL auf App-Ebene (wie GlobalToasts) und hoert auf das Ereignis
 * aus utils/postfach. Die Glocke steht auf jeder Seite, das Modal nicht —
 * sonst laegen so viele Modale im Speicher, wie Seiten gemountet sind.
 */
const PostfachModal: React.FC = () => {
  const { user, activeOrgId, organizations, switchOrg } = useApp();
  const { refreshAllCounts } = useBadge();
  const { wartend, gescheitert, vergessen, alleVergessen } = useWartendeVorgaenge();

  const [offen, setOffen] = useState(false);
  // Das Element, das auf iOS hinter die Karte zuruecktritt (utils/postfach).
  const [praesentiertVon, setPraesentiertVon] = useState<HTMLElement | undefined>(undefined);
  const [eintraege, setEintraege] = useState<PostfachEintrag[]>([]);
  const [ungelesen, setUngelesen] = useState(0);
  const [weitere, setWeitere] = useState(false);
  const [laedt, setLaedt] = useState(false);
  const [ladefehler, setLadefehler] = useState(false);

  // Gemeindename nur zeigen, wenn es etwas zu unterscheiden gibt.
  const mehrereGemeinden = (organizations?.length ?? 0) > 1;

  useEffect(() => {
    const auf = () => {
      setPraesentiertVon(postfachPraesentationsElement());
      setOffen(true);
    };
    window.addEventListener(POSTFACH_OEFFNEN_EVENT, auf);
    return () => window.removeEventListener(POSTFACH_OEFFNEN_EVENT, auf);
  }, []);

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

  // Beim Oeffnen frisch laden — nicht beim Montieren: Das Modal haengt ab dem
  // Start im Baum, die Liste braucht aber erst jemand, der die Glocke tippt.
  useEffect(() => {
    if (offen) laden();
  }, [offen, laden]);

  const schliessen = () => setOffen(false);

  const alsGelesenMerken = (id: number) => {
    setEintraege(prev => prev.map(e => (e.id === id && !e.read_at ? { ...e, read_at: new Date().toISOString() } : e)));
  };

  const antippen = async (eintrag: PostfachEintrag) => {
    if (!eintrag.read_at) {
      // Optimistisch: sofort als gelesen zeigen, der Server zieht nach. Geht
      // der PUT schief (offline), steht die Mitteilung beim naechsten Laden
      // wieder als ungelesen da — das ist der richtige Stand.
      alsGelesenMerken(eintrag.id);
      setUngelesen(n => Math.max(0, n - 1));
      api.put(`/notifications/postfach/${eintrag.id}/gelesen`)
        .then(() => refreshAllCounts())
        .catch(() => { /* siehe oben */ });
    }

    // Ziel wie beim Push-Tap (AppContext, pushNotificationActionPerformed):
    // erst die Gemeinde des Inhalts, dann die Route mit der Rolle DORT.
    const aktuellerTyp = (user?.type || 'konfi') as PushUserType;
    const zielTyp = await resolveOrgForPush(
      { organization_id: eintrag.organization_id ?? undefined },
      aktuellerTyp,
      {
        getActiveOrgId: () => activeOrgId,
        getUserOrgId: () => user?.organization_id ?? null,
        switchOrg,
      }
    );
    const ziel = buildPushTargetUrl(eintrag.type, eintrag.data, zielTyp);

    schliessen();
    if (ziel) pushZielMelden(ziel);
  };

  const alleGelesen = async () => {
    setEintraege(prev => prev.map(e => (e.read_at ? e : { ...e, read_at: new Date().toISOString() })));
    setUngelesen(0);
    try {
      await api.put('/notifications/postfach/gelesen');
      await refreshAllCounts();
    } catch {
      // Offline: Der Server hat es nicht — beim naechsten Laden steht der
      // echte Stand wieder da.
    }
  };

  const hatWarteschlange = wartend.length > 0 || gescheitert.length > 0;
  const aeltesteId = eintraege.length > 0 ? eintraege[eintraege.length - 1].id : undefined;
  const listeLeer = eintraege.length === 0;

  return (
    // presentingElement: Auf iOS die Karte mit Abdunklung, wie jedes andere
    // Modal der App (Begruendung bei postfachPraesentationsElement).
    <IonModal isOpen={offen} onDidDismiss={schliessen} presentingElement={praesentiertVon}>
      <IonHeader>
        <IonToolbar>
          {/* Schliessen-Symbol links wie in InfoModal, PointsHistoryModal und
              allen anderen Modalen -- kein Text-Knopf "Fertig" (Simon,
              25.09.2026: "machen ein Symbol wie ueberall"). */}
          <IonButtons slot="start">
            <IonButton className="app-modal-close-btn" onClick={schliessen} aria-label="Schließen">
              <IonIcon icon={ICON_SCHLIESSEN} slot="icon-only" />
            </IonButton>
          </IonButtons>
          <IonTitle>Postfach</IonTitle>
        </IonToolbar>
      </IonHeader>
      {/* Der Verlauf-Hintergrund aller Seiten und Modale; die Inhalte stehen
          darauf in Karten (app-card), wie ueberall sonst. */}
      <IonContent className="app-gradient-background">
        {hatWarteschlange && (
          <section aria-label="Warteschlange" data-testid="postfach-warteschlange">
            <WartendeVorgaengeKarte
              wartend={wartend}
              gescheitert={gescheitert}
              onVergessen={vergessen}
            />
            {gescheitert.length > 1 && (
              <div style={{ padding: '0 var(--app-abstand-basis) var(--app-abstand-basis)' }}>
                <IonButton expand="block" fill="clear" onClick={alleVergessen}>
                  Alle Fehlschläge wegwischen
                </IonButton>
              </div>
            )}
          </section>
        )}

        <section aria-label="Mitteilungen" data-testid="postfach-mitteilungen">
          <IonList inset={true} className="app-segment-wrapper">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--info">
                <IonIcon icon={ICON_BENACHRICHTIGUNG} />
              </div>
              <IonLabel>Mitteilungen</IonLabel>
              {ungelesen > 0 && (
                <IonButton size="small" fill="clear" onClick={alleGelesen}>
                  Alle gelesen
                </IonButton>
              )}
            </IonListHeader>
            {/* --background ausdruecklich: Auf Simons iPhone (Build 225,
                25.09.2026) war diese Karte da -- die Zeilen standen 28 pt vom
                Rand, also Listenrand plus Kartenpolster -- aber nicht weiss:
                Die Luecken zwischen den Zeilen trugen das Grau des
                Hintergrunds. Das Theme (ionic-theme-ios27) loest die
                Kartenfarbe ueber --ion-card-background -> --ion-item-background
                -> --ion-background-color auf und schlaegt dabei die Regel
                ion-card.app-card (theme/variables.css) an Spezifitaet; im
                Modal ausserhalb des Routers ergab das kein Weiss, auf den
                Seiten schon. Welche Variable im Modal abweicht, liess sich
                im CSS nicht belegen -- deshalb hier fest, nicht geraten. */}
            <IonCard className="app-card" data-testid="postfach-karte" style={{ '--background': 'white' } as React.CSSProperties}>
              <IonCardContent style={{ padding: listeLeer ? 'var(--app-abstand-basis)' : 'var(--app-abstand-mittel)' }}>
                {laedt && listeLeer && (
                  <div className="app-postfach__laedt">
                    <IonSpinner name="crescent" />
                  </div>
                )}

                {ladefehler && listeLeer && (
                  <OfflinePlatzhalter was="Deine Mitteilungen" />
                )}

                {!laedt && !ladefehler && listeLeer && (
                  <EmptyState
                    icon={ICON_GLOCKE}
                    title="Nichts Neues"
                    message="Hier landen Abzeichen, Anträge und Entscheidungen — auch die, deren Push du verpasst hast."
                  />
                )}

                {eintraege.map(eintrag => {
                  const ungelesenerEintrag = !eintrag.read_at;
                  const bereich = postfachBereich(eintrag.type);
                  const symbol = eintragSymbol(eintrag, bereich);
                  const zeitpunkt = zeitpunktText(eintrag.created_at);
                  const gemeinde = mehrereGemeinden && eintrag.organization_name ? eintrag.organization_name : null;
                  const klassen = [
                    'app-list-item',
                    `app-list-item--${bereich}`,
                    'app-postfach-eintrag',
                    ungelesenerEintrag ? 'app-postfach-eintrag--ungelesen' : null,
                  ].filter(Boolean).join(' ');
                  return (
                    <div
                      key={eintrag.id}
                      role="button"
                      tabIndex={0}
                      className={klassen}
                      data-ungelesen={ungelesenerEintrag ? 'true' : 'false'}
                      data-bereich={bereich}
                      onClick={() => antippen(eintrag)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          antippen(eintrag);
                        }
                      }}
                    >
                      {/* Eselsohr wie der Status in der Antragsliste: "Neu"
                          in der Ecke statt eines Punkts vor der Zeile. */}
                      {ungelesenerEintrag && (
                        <div className="app-corner-badges">
                          <div
                            className="app-corner-badge"
                            style={{ background: 'var(--ion-color-primary)' }}
                            aria-label="ungelesen"
                          >
                            Neu
                          </div>
                        </div>
                      )}
                      <div className="app-list-item__row">
                        <div className="app-list-item__main">
                          <div className={`app-icon-circle app-icon-circle--${bereich}`}>
                            {symbol.emoji !== undefined
                              ? <span data-testid="postfach-emoji" style={{ fontSize: 'var(--app-text-untertitel)', lineHeight: 1 }}>{symbol.emoji}</span>
                              : <IonIcon icon={symbol.icon} />}
                          </div>
                          <div className="app-list-item__content">
                            <div
                              className="app-list-item__title"
                              style={ungelesenerEintrag ? { paddingRight: 'var(--app-freiraum-aktion-m)' } : undefined}
                            >
                              {mitteilungsTitel(eintrag)}
                            </div>
                            <div className="app-list-item__subtitle">{eintrag.message}</div>
                            {/* Datum und Gemeinde mit Symbol, wie Datum und Ort in
                                den Terminlisten (konfi/views/EventsView). */}
                            <div className="app-list-item__meta">
                              <span className="app-list-item__meta-item" data-testid="postfach-zeitpunkt">
                                <IonIcon icon={ICON_TERMIN_GEFUELLT} className="app-icon-color--events" />
                                {zeitpunkt}
                              </span>
                              {gemeinde && (
                                <span className="app-list-item__meta-item" data-testid="postfach-gemeinde">
                                  <IonIcon icon={ICON_ORGANISATION_GEFUELLT} className="app-icon-color--organizations" />
                                  {gemeinde}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </IonCardContent>
            </IonCard>
          </IonList>

          {weitere && !ladefehler && (
            <div style={{ padding: '0 var(--app-abstand-basis) var(--app-abstand-basis)' }}>
              <IonButton expand="block" fill="clear" disabled={laedt} onClick={() => laden(aeltesteId)}>
                Ältere Mitteilungen laden
              </IonButton>
            </div>
          )}
        </section>
      </IonContent>
    </IonModal>
  );
};

export default PostfachModal;
