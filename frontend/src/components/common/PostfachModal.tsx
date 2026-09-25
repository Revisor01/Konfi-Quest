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
  IonItem,
  IonLabel,
  IonSpinner,
} from '@ionic/react';
import api from '../../services/api';
import { useApp } from '../../contexts/AppContext';
import { useBadge } from '../../contexts/BadgeContext';
import { useWartendeVorgaenge } from '../../hooks/useWartendeVorgaenge';
import WartendeVorgaengeKarte from '../shared/WartendeVorgaengeKarte';
import EmptyState from '../shared/EmptyState';
import OfflinePlatzhalter from '../shared/OfflinePlatzhalter';
import { ICON_GLOCKE } from '../shared/icons';
import {
  POSTFACH_OEFFNEN_EVENT,
  PostfachAntwort,
  PostfachEintrag,
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
  const [eintraege, setEintraege] = useState<PostfachEintrag[]>([]);
  const [ungelesen, setUngelesen] = useState(0);
  const [weitere, setWeitere] = useState(false);
  const [laedt, setLaedt] = useState(false);
  const [ladefehler, setLadefehler] = useState(false);

  // Gemeindename nur zeigen, wenn es etwas zu unterscheiden gibt.
  const mehrereGemeinden = (organizations?.length ?? 0) > 1;

  useEffect(() => {
    const auf = () => setOffen(true);
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

  return (
    <IonModal isOpen={offen} onDidDismiss={schliessen}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Postfach</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={schliessen}>Fertig</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="app-postfach">
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
              <IonLabel>Mitteilungen</IonLabel>
              {ungelesen > 0 && (
                <IonButton size="small" fill="clear" onClick={alleGelesen}>
                  Alle gelesen
                </IonButton>
              )}
            </IonListHeader>

            {laedt && eintraege.length === 0 && (
              <div className="app-postfach__laedt">
                <IonSpinner name="crescent" />
              </div>
            )}

            {ladefehler && eintraege.length === 0 && (
              <OfflinePlatzhalter was="Deine Mitteilungen" />
            )}

            {!laedt && !ladefehler && eintraege.length === 0 && (
              <EmptyState
                icon={ICON_GLOCKE}
                title="Nichts Neues"
                message="Hier landen Abzeichen, Anträge und Entscheidungen — auch die, deren Push du verpasst hast."
              />
            )}

            {eintraege.map(eintrag => {
              const ungelesenerEintrag = !eintrag.read_at;
              const meta = [
                zeitpunktText(eintrag.created_at),
                mehrereGemeinden && eintrag.organization_name ? eintrag.organization_name : null,
              ].filter(Boolean).join(' · ');
              return (
                <IonItem
                  key={eintrag.id}
                  button
                  detail={false}
                  onClick={() => antippen(eintrag)}
                  className={ungelesenerEintrag ? 'app-postfach-eintrag app-postfach-eintrag--ungelesen' : 'app-postfach-eintrag'}
                  data-ungelesen={ungelesenerEintrag ? 'true' : 'false'}
                >
                  <span
                    slot="start"
                    className="app-postfach-punkt"
                    aria-label={ungelesenerEintrag ? 'ungelesen' : undefined}
                    aria-hidden={ungelesenerEintrag ? undefined : true}
                  />
                  <IonLabel className="ion-text-wrap">
                    <h3>{eintrag.title}</h3>
                    <p>{eintrag.message}</p>
                    {meta && <p className="app-postfach-eintrag__meta">{meta}</p>}
                  </IonLabel>
                </IonItem>
              );
            })}
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
