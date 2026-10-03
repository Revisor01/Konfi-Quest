import { fehlerStatus, fehlerText } from '../../../utils/fehler';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  IonPage,
  IonContent,
  IonButton,
  IonIcon,
  IonCard,
  IonCardContent,
  IonList,
  IonListHeader,
  IonLabel,
  IonSegmentButton,
  IonSegment,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  useIonModal
} from '@ionic/react';
import {
  ICON_GRUPPE,
  ICON_HAKEN,
  ICON_HINZUFUEGEN,
  ICON_PERSON,
  ICON_SICHTBAR,
  ICON_VERBORGEN,
  ICON_TEXTDOKUMENT,
  ICON_UHRZEIT,
} from '../../shared/icons';
import { useApp } from '../../../contexts/AppContext';
import { useBadge } from '../../../contexts/BadgeContext';
import { useLiveRefresh, useLiveUpdate } from '../../../contexts/LiveUpdateContext';
import api from '../../../services/api';
import { netzZuerstLaden } from '../../../services/netzZuerst';
import { CACHE_TTL, offlineCache } from '../../../services/offlineCache';
import OfflinePlatzhalter from '../../shared/OfflinePlatzhalter';
import { EmptyState } from '../../shared';
import AppKopfzeile from '../../shared/AppKopfzeile';
import ChallengeHinweis, { type ChallengeHinweisArt } from '../../shared/ChallengeHinweis';
import ChallengeSubmitModal from '../modals/ChallengeSubmitModal';
import { konfiChallengeListe } from '../../../utils/challengeListen';
import { useBreitesLayout } from '../../../navigation/breitesLayout';
import WebKonfiChallengeDetail from '../web/challenges/WebKonfiChallengeDetail';
import ChallengeMedium from '../../shared/ChallengeMedium';
import { triggerPullHaptic } from '../../../utils/haptics';
import { istWebLink } from '../../../utils/linkDisplay';
import MusikLink from '../../shared/MusikLink';
import { getChallengeBadgeIcon, formatRemaining } from '../views/ChallengesView';
import {
  MEDIA_ICON,
  buildGalleryAuthorLabel,
  formatDateTime,
  getOwnStatus,
  useKonfiChallengeAnsicht,
  type KonfiReiter
} from './useKonfiChallengeAnsicht';
import type {
  KonfiChallenge,
  KonfiChallengesResponse,
  KonfiChallengeDetail,
  ChallengeSubmission,
  ChallengeGalerieZeile
} from '../../../types/challenges';

// Eine Challenge für Konfis als eigene Seite (/konfi/challenges/:id):
// Beschreibung, oeffentliche Galerie (anonyme Beitraege OHNE Namen — das
// Backend liefert dort gar keinen Namen mit) und die eigenen Beitraege mit
// Status; Mitmachen ueber das Einreich-Modal auf dieser Seite.
//
// Bis 2.3 ein Dialog ueber der Liste. Simon, 02.10.2026, woertlich: "der
// umbau von challenges, so dass es analog zu events funktioniert. also
// challenge nicht in modal öffnen, sondern in unterseite, damit man direkt
// auf die challenge linken kann aus einem push." Die Seite holt die
// Challenge deshalb selbst ueber ihre Kennung -- ein Push kann hierher
// fuehren, ohne dass die Liste je geladen war, auch zu einer Challenge, die
// es nicht mehr gibt (ChallengeHinweis statt leerer Seite).

/** Eine Beitragskarte — in der Galerie ohne, bei eigenen Beitraegen mit Status. */
const SubmissionCard: React.FC<{
  submission: ChallengeSubmission;
  authorLabel: string;
  statusBadge?: { label: string; icon: string; color: string };
  /** Foto antippen: öffnen wie eine Chat-Datei (nativ oder im Betrachter). */
  onOeffnen?: (filePath: string, fileName: string) => void;
}> = ({ submission, authorLabel, statusBadge, onOeffnen }) => (
  <div
    className="app-list-item app-list-item--challenges"
    style={{ position: 'relative', overflow: 'hidden', width: '100%' }}
  >
    {statusBadge && (
      <div className="app-corner-badges">
        <div
          className="app-corner-badge"
          style={{ backgroundColor: statusBadge.color, padding: 'var(--app-abstand-mini) var(--app-abstand-kompakt)' }}
          title={statusBadge.label}
          role="img"
          aria-label={statusBadge.label}
        >
          <IonIcon icon={statusBadge.icon} style={{ color: 'white', fontSize: 'var(--app-text-sekundaer)', display: 'block' }} />
        </div>
      </div>
    )}
    <div className="app-list-item__row">
      <div className="app-list-item__main" style={{ alignItems: 'flex-start', width: '100%' }}>
        <div className="app-icon-circle app-icon-circle--challenges" style={{ flexShrink: 0 }}>
          <IonIcon icon={MEDIA_ICON[submission.media_type] || ICON_TEXTDOKUMENT} />
        </div>
        <div className="app-list-item__content" style={{ minWidth: 0, flex: 1, paddingRight: statusBadge ? 'var(--app-freiraum-aktion-xxs)' : 0 }}>
          <span className="app-list-item__title" style={{ margin: 0, display: 'block' }}>{authorLabel}</span>
          <div className="app-list-item__subtitle" style={{ marginBottom: 'var(--app-abstand-mini)' }}>
            {formatDateTime(submission.created_at)}
          </div>

          {submission.text_content && (
            <div
              style={{
                fontSize: 'var(--app-text-basis)', color: 'var(--app-text-ios)', lineHeight: 1.45,
                whiteSpace: 'pre-wrap', marginTop: 'var(--app-abstand-mini)'
              }}
            >
              {submission.text_content}
            </div>
          )}

          {/* Nur http/https rendern (istWebLink): die URL stammt aus einer fremden
              Einreichung, ein praepariertes javascript:-Schema wuerde sonst bei
              Mitkonfis landen. Beschriftet wird mit der Domain statt der vollen
              Adresse — die lief sonst ueber mehrere Zeilen. */}
          {submission.media_type === 'link' && istWebLink(submission.link_url) && (
            <MusikLink submission={submission} />
          )}

          {/* Wurde der eigene Beitrag ausgeblendet, steht die optionale
              Begruendung der Leitung UNTER dem Beitrag — gleiche Form wie der
              Ablehnungsgrund bei Aktivitaeten (app-reason-box, User-Hinweis
              26.08.2026). moderation_note kommt nur bei eigenen Beitraegen mit;
              Galerie-Beitraege sind nie 'hidden'. */}
          {submission.moderation_status === 'hidden' && submission.moderation_note && (
            <div className="app-reason-box app-reason-box--danger">
              <span className="app-reason-box__label" style={{ fontSize: 'var(--app-text-meta)' }}>
                Grund der Ablehnung
              </span>
              <p style={{ margin: 'var(--app-abstand-winzig) 0 0 0', fontSize: 'var(--app-text-hinweis)', lineHeight: 1.4 }}>
                {submission.moderation_note}
              </p>
            </div>
          )}

          {/* Über den gemeinsamen Medien-Cache wie im Chat (27.09.2026):
              einmal geladen, danach vom Gerät; Fortschritt, Erneut
              versuchen, offline die graue Zeile. */}
          {submission.file_path && submission.media_type !== 'link' && submission.media_type !== 'text' && (
            <ChallengeMedium
              filePath={submission.file_path}
              fileName={submission.file_name}
              mediaType={submission.media_type}
              onOeffnen={onOeffnen}
            />
          )}
        </div>
      </div>
    </div>
  </div>
);

interface KonfiChallengeDetailPageProps {
  /** Aus der Adresse, als Zahl (MainTabs, ParamSeite). */
  challengeId: number;
  /** Zurueck: mit Verlauf zurueck, ohne (nach einem Push) auf die Liste. */
  onBack: () => void;
}

/** Die Detail-Antwort in die Form der Ansicht bringen. */
const ausDetailAntwort = (data: {
  challenge?: KonfiChallenge;
  gallery?: ChallengeGalerieZeile[];
  own_submissions?: ChallengeSubmission[];
} | null | undefined): KonfiChallengeDetail | null => {
  if (!data?.challenge) return null;
  // Backend liefert { challenge, gallery, own_submissions } — Challenge-Felder
  // müssen auf die oberste Ebene, sonst ist starts_at/ends_at undefined und
  // die Challenge erscheint faelschlich als beendet.
  // Die Galerie-Query liefert den Namen als display_name (bei anonymen
  // Beitraegen NULL), das UI liest konfi_name -> hier normalisieren, sonst
  // erscheint JEDER Galerie-Beitrag als "Anonym".
  // Galerie-Zeilen tragen keinen Freigabe-Stand (es steht nur Freigegebenes
  // darin); die Ansicht liest sie wie Beitraege -- wie vor 2.4.0, als die
  // Antwort ungetypt durchlief.
  const gallery = (data.gallery ?? []).map((row) => ({
    ...row,
    konfi_name: row.konfi_name ?? row.display_name ?? null
  })) as ChallengeSubmission[];
  return { ...data.challenge, gallery, own_submissions: data.own_submissions || [] };
};

interface KonfiChallengeDetailInhaltProps extends KonfiChallengeDetailPageProps {
  /** Die IonPage der Seite -- fuer die Card-Optik des Einreich-Modals. */
  pageRef: React.RefObject<HTMLElement | null>;
}

const KonfiChallengeDetailInhalt: React.FC<KonfiChallengeDetailInhaltProps> = ({
  challengeId,
  onBack,
  pageRef
}) => {
  const { user, setError } = useApp();
  // Zwei Gesichter, eine Seite (docs/planung/web-alle-bereiche.md): im breiten
  // Browserfenster die Web-Fassung, sonst die Ansicht der App. Laden, Hinweise
  // und das Gelesen-Melden hier gelten fuer beide.
  const breit = useBreitesLayout();
  const { markChallengeAsRead } = useBadge();
  const { triggerRefresh } = useLiveUpdate();
  const [detail, setDetail] = useState<KonfiChallengeDetail | null>(null);
  // Ohne Netz und ohne gespeicherten Stand dieser Challenge: ihr Eintrag aus
  // der zuletzt geladenen Liste -- so wie der fruehere Dialog ihn bekam.
  const [ausListe, setAusListe] = useState<KonfiChallenge | null>(null);
  const [hinweis, setHinweis] = useState<ChallengeHinweisArt | null>('laedt');
  const [loading, setLoading] = useState(true);
  // Ohne Netz und ohne gespeicherten Stand: sagen, dass die Beiträge offline
  // fehlen, statt eine leere Galerie zu zeigen ("Noch keine geteilten
  // Beiträge" wäre dann schlicht falsch).
  const [offlineOhneStand, setOfflineOhneStand] = useState(false);
  const benutzerId = user?.id;
  const listenSchluessel = konfiChallengeListe(user);

  const loadDetail = useCallback(async () => {
    try {
      // Netz zuerst (27.09.2026): Bei Netz entscheidet immer der Server, was
      // in der Galerie steht — ein ausgeblendeter oder gelöschter Beitrag
      // erscheint nicht, auch nicht kurz aus dem Speicher. Ohne Netz zeigt
      // die Ansicht den zuletzt geladenen Stand, die Fotos kommen dann aus
      // dem Medien-Cache. Antwortet der Server (404, 403), gibt es bewusst
      // keinen Rueckgriff auf den Speicher (services/netzZuerst.ts).
      const { daten: data } = await netzZuerstLaden(
        `konfi:challenge:${benutzerId}:${challengeId}`,
        () => api.get(`/challenges/konfi/${challengeId}`).then((res) => res.data),
        CACHE_TTL.REQUESTS
      );
      setOfflineOhneStand(false);
      const neu = ausDetailAntwort(data);
      setDetail(neu);
      setHinweis(neu ? null : 'weg');
    } catch (err) {
      const status = fehlerStatus(err);
      if (status === undefined) {
        // Ohne Netz: Die Beitraege fehlen; der Kopf kommt, wenn es ihn
        // nicht schon gibt, aus der Liste.
        setOfflineOhneStand(true);
        const liste = await offlineCache.get<KonfiChallengesResponse>(listenSchluessel).catch(() => null);
        const daten = liste?.data;
        const eintrag = daten && typeof daten === 'object'
          ? [...(Array.isArray(daten.active) ? daten.active : []), ...(Array.isArray(daten.archive) ? daten.archive : [])]
            .find((c) => c.id === challengeId)
          : undefined;
        if (eintrag) setAusListe(eintrag);
        setHinweis((vorher) => (vorher !== 'laedt' ? vorher : eintrag ? null : 'offline'));
      } else if (status === 404) {
        // Geloescht -- oder fuer Konfis gar nicht da (Entwurf, noch nicht
        // gestartet, nur fuers Team). Kein roter Kasten, ein Hinweis.
        setDetail(null);
        setAusListe(null);
        setHinweis('weg');
      } else if (status === 403) {
        // Die Challenge gehoert zu einem anderen Jahrgang.
        setDetail(null);
        setAusListe(null);
        setHinweis('nichtFuerDich');
      } else {
        setError(fehlerText(err, 'Fehler beim Laden der Challenge'));
        setHinweis((vorher) => (vorher === 'laedt' ? 'fehler' : vorher));
      }
    } finally {
      setLoading(false);
    }
  }, [challengeId, benutzerId, listenSchluessel, setError]);

  useEffect(() => {
    setLoading(true);
    loadDetail();
  }, [loadDetail]);

  // Aenderungen kommen als Live-Ereignis 'challenges' (neue Beitraege in der
  // Galerie, Freigabe des eigenen, Loeschen) -- wie bei der Liste. Wird die
  // Challenge geloescht, waehrend sie offen ist, steht danach der Hinweis.
  useLiveRefresh('challenges', loadDetail);

  // Basis für Kopf/Status: das Detail (frisch) hat Vorrang vor dem Eintrag
  // aus der Liste.
  const current: KonfiChallenge | null = detail || ausListe;

  // Beim Oeffnen als gelesen melden -- wie ChatRoom beim Betreten eines
  // Raums. Ab jetzt zaehlt der Neuigkeiten-Zaehler neu; ohne den Aufruf
  // bliebe die rote Zahl am Eintrag, am Reiter und am App-Symbol stehen,
  // egal wie oft man hineinsieht. Gemeldet wird, sobald die Challenge da
  // ist (auch aus dem Speicher) -- eine geloeschte oder fremde gibt es
  // nicht zu lesen. Die Seite montiert je Challenge neu (key), deshalb genau
  // einmal je geoeffneter Challenge.
  const gemeldetRef = useRef(false);
  useEffect(() => {
    if (!current || gemeldetRef.current) return;
    gemeldetRef.current = true;
    markChallengeAsRead(current.id);
  }, [current, markChallengeAsRead]);

  // Mitmachen: das Einreich-Modal auf dieser Seite (vorher aus dem Dialog
  // heraus auf der Liste). Danach Galerie und Liste neu laden -- das
  // Live-Ereignis erreicht beide.
  const [presentSubmitModal, dismissSubmitModal] = useIonModal(ChallengeSubmitModal, {
    challenge: current,
    onClose: () => dismissSubmitModal(),
    onSuccess: () => {
      dismissSubmitModal();
      triggerRefresh('challenges');
    }
  });

  const einreichen = () => presentSubmitModal({ presentingElement: pageRef.current || undefined });

  if (breit) {
    // Eine Komponente fuer alle Zustaende, mit einem Rahmen: laedt, Hinweis,
    // Challenge (WebKonfiChallengeDetail).
    return (
      <WebKonfiChallengeDetail
        current={current}
        hinweisArt={hinweis ?? 'laedt'}
        onBack={onBack}
        onNochmal={() => { setHinweis('laedt'); void loadDetail(); }}
        detail={detail}
        loading={loading}
        offlineOhneStand={offlineOhneStand}
        onSubmit={einreichen}
      />
    );
  }

  if (!current) {
    return (
      <ChallengeHinweis
        art={hinweis ?? 'laedt'}
        onBack={onBack}
        onNochmal={() => { setHinweis('laedt'); void loadDetail(); }}
      />
    );
  }

  return (
    <KonfiChallengeDetailAnsicht
      current={current}
      detail={detail}
      loading={loading}
      offlineOhneStand={offlineOhneStand}
      onBack={onBack}
      onRefresh={loadDetail}
      onSubmit={einreichen}
    />
  );
};

interface KonfiChallengeDetailAnsichtProps {
  current: KonfiChallenge;
  detail: KonfiChallengeDetail | null;
  loading: boolean;
  offlineOhneStand: boolean;
  onBack: () => void;
  onRefresh: () => Promise<void>;
  onSubmit: () => void;
}

/** Die eigentliche Seite -- erst, wenn es eine Challenge zu zeigen gibt. */
const KonfiChallengeDetailAnsicht: React.FC<KonfiChallengeDetailAnsichtProps> = ({
  current,
  detail,
  loading,
  offlineOhneStand,
  onBack,
  onRefresh,
  onSubmit
}) => {
  const {
    author,
    isActive,
    reiter,
    setReiter,
    ownSubmissions,
    canSubmitMore,
    effektiverReiter,
    sichtbareBeitraege,
    dateiOeffnen,
    visibilityShort,
    moderationShort,
  } = useKonfiChallengeAnsicht(current, detail);

  // KEINE EIGENE IonPage: Kopfzeile und Inhalt stehen in der IonPage der
  // Seite (KonfiChallengeDetailPage unten), die je Route genau einmal
  // montiert wird -- auch waehrend sie noch laedt.
  return (
    <>
      {/* Die gemeinsame Kopfzeile wie auf jeder Seite, mit Zurueck statt des
          frueheren Schliessen-Kreuzes; die Glocke bleibt (wie am Termin). */}
      <AppKopfzeile
        titel="Challenge"
        onZurueck={onBack}
        gemeindeUmschalter={false}
        rechts={canSubmitMore ? (
          <IonButton onClick={onSubmit} title="Beitrag einreichen" aria-label="Beitrag einreichen">
            <IonIcon icon={ICON_HINZUFUEGEN} slot="icon-only" />
          </IonButton>
        ) : undefined}
      />

      <IonContent className="app-gradient-background" fullscreen>
        <IonRefresher
          slot="fixed"
          onIonRefresh={async (e) => { await onRefresh(); e.detail.complete(); }}
          onIonPull={triggerPullHaptic}
        >
          <IonRefresherContent />
        </IonRefresher>

        {/* Kopf */}
        <div className="app-header-banner app-header-banner--challenges">
          <div className="app-header-banner__circle-top" />
          <div className="app-header-banner__circle-bottom" />
          <div className="app-header-banner__header">
            <div className="app-header-banner__icon">
              <IonIcon icon={getChallengeBadgeIcon(current.badge_icon)} />
            </div>
            <div>
              <h2 className="app-header-banner__title">{current.title}</h2>
              {/* Laufzeit UND Sichtbarkeit in einer Zeile: "noch 3 Tage · Nur
                  für euch in der Leitung". Bei beendeten Challenges faellt die
                  Laufzeit weg (sie steht dezent in der Meta-Zeile unten), die
                  Sichtbarkeit bleibt — wer die Beitraege sieht, gilt weiter. */}
              <p className="app-header-banner__subtitle">
                {isActive ? `${formatRemaining(current.ends_at)} · ${visibilityShort}` : visibilityShort}
              </p>
            </div>
          </div>
        </div>

        {/* Beschreibung */}
        <IonList inset={true} className="app-segment-wrapper">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--challenges">
              <IonIcon icon={ICON_TEXTDOKUMENT} />
            </div>
            {/* Bei beendeten Challenges in der Vergangenheit formulieren. */}
            <IonLabel>{isActive ? 'Worum geht es?' : 'Worum ging es?'}</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: 'var(--app-abstand-mittelweit)' }}>
              <div style={{ fontSize: 'var(--app-text-basis)', lineHeight: 1.5, color: 'var(--app-text-ios)', whiteSpace: 'pre-wrap' }}>
                {current.description}
              </div>
              <div
                style={{
                  display: 'flex', flexWrap: 'wrap', gap: 'var(--app-abstand-eng) var(--app-abstand-mittelweit)',
                  marginTop: 'var(--app-abstand-mittel)', fontSize: 'var(--app-text-hinweis)', color: 'var(--app-text-system)'
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--app-abstand-mini)' }}>
                  <IonIcon icon={ICON_UHRZEIT} className="app-icon-color--challenges" />
                  {isActive ? formatRemaining(current.ends_at) : 'Beendet'}
                </span>
                {/* Urheber deutlich sichtbar in derselben unauffaelligen Meta-Zeile. */}
                {author && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--app-abstand-mini)' }}>
                    <IonIcon icon={ICON_PERSON} className="app-icon-color--challenges" />
                    Gestellt von {author}
                  </span>
                )}
                {/* Der Modus der Challenge, direkt bei der Aufgabe: wer die
                    Beiträge sieht und ob sie sofort oder erst nach Freigabe
                    erscheinen (Nutzerentscheid 24.08.2026). */}
                <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--app-abstand-mini)' }}>
                  <IonIcon
                    // Durchgestrichenes Auge wie in der Leitungsansicht (05.09.2026): Es geht
                    // um Sichtbarkeit, nicht um eine Sperre -- und ICON_SICHTBAR
                    // daneben ist ja auch ein Auge.
                    icon={current.visibility === 'private' ? ICON_VERBORGEN : ICON_SICHTBAR}
                    className="app-icon-color--challenges"
                  />
                  {visibilityShort}
                </span>
                {moderationShort && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--app-abstand-mini)' }}>
                    <IonIcon icon={ICON_HAKEN} className="app-icon-color--challenges" />
                    {moderationShort}
                  </span>
                )}
              </div>
            </IonCardContent>
          </IonCard>
        </IonList>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--app-abstand-extraweit)' }}>
            <IonSpinner name="crescent" />
          </div>
        ) : offlineOhneStand ? (
          <OfflinePlatzhalter was="Die Liste der Beiträge" />
        ) : (
          <>
            {/* Reiter statt zweier gestapelter Bloecke: Der eigene Beitrag
                stand frueher zusaetzlich in einem eigenen Abschnitt ueber der
                Galerie — zusammen mit dem Feed wurde die Seite zu lang
                (User-Hinweis 26.08.2026). Jetzt eine Leiste, ein Bereich.
                Bei "nur Leitung" gibt es keine Gruppen-Galerie; dann entfaellt
                die Leiste, weil nur "Meins" bleibt. */}
            {current.visibility !== 'private' && (
              <div style={{ margin: 'var(--app-abstand-basis) var(--app-abstand-basis) var(--app-abstand-eng) var(--app-abstand-basis)' }}>
                <IonSegment value={reiter} onIonChange={(e) => setReiter(e.detail.value as KonfiReiter)}>
                  <IonSegmentButton value="feed"><IonLabel>Feed</IonLabel></IonSegmentButton>
                  <IonSegmentButton value="meins"><IonLabel>Meins</IonLabel></IonSegmentButton>
                </IonSegment>
              </div>
            )}

            <IonList inset={true} className="app-segment-wrapper">
              <IonListHeader>
                <div className="app-section-icon app-section-icon--challenges">
                  <IonIcon icon={effektiverReiter === 'meins' ? ICON_PERSON : ICON_GRUPPE} />
                </div>
                <IonLabel>
                  {effektiverReiter === 'meins'
                    ? (ownSubmissions.length === 1 ? 'Dein Beitrag' : 'Deine Beiträge')
                    : 'Aus deiner Gruppe'}
                </IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent style={{ padding: sichtbareBeitraege.length === 0 ? 'var(--app-abstand-basis)' : 'var(--app-abstand-mittel)' }}>
                  {sichtbareBeitraege.length === 0 ? (
                    effektiverReiter === 'meins' ? (
                      <EmptyState
                        icon={ICON_TEXTDOKUMENT}
                        title="Noch kein Beitrag von dir"
                        // Bei beendeter Challenge gibt es das Plus nicht mehr
                        // (canSubmitMore verlangt isActive) — der Hinweis
                        // zeigte auf einen Knopf, der nicht existiert
                        // (Befund 30.08.2026).
                        message={isActive
                          ? 'Tippe oben auf das Plus, um etwas einzureichen.'
                          : 'Diese Challenge ist beendet — du hattest nichts eingereicht.'}
                        iconColor="var(--app-color-challenges)"
                      />
                    ) : (
                      <EmptyState
                        icon={ICON_GRUPPE}
                        title="Noch keine geteilten Beiträge"
                        message={isActive
                          ? 'Sobald jemand aus deiner Gruppe etwas veröffentlicht, findest du es hier. Vielleicht machst du ja den Anfang.'
                          : 'Aus dieser Challenge hat niemand aus deiner Gruppe etwas veröffentlicht.'}
                        iconColor="var(--app-color-challenges)"
                      />
                    )
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {sichtbareBeitraege.map((submission) => (
                        <SubmissionCard
                          key={submission.id}
                          submission={submission}
                          // Im eigenen Reiter immer "Dein Beitrag"; in der
                          // Galerie Name + Herkunft, anonyme ohne Namen.
                          authorLabel={effektiverReiter === 'meins'
                            ? 'Dein Beitrag'
                            : buildGalleryAuthorLabel(submission)}
                          statusBadge={effektiverReiter === 'meins'
                            ? getOwnStatus(submission, current)
                            : undefined}
                          onOeffnen={(pfad, name) => { void dateiOeffnen(pfad, name); }}
                        />
                      ))}
                    </div>
                  )}
                </IonCardContent>
              </IonCard>
            </IonList>
          </>
        )}

      </IonContent>
    </>
  );
};

// EINE IonPage fuer alle Zustaende -- laedt, Hinweis, Challenge. Der
// IonRouterOutlet registriert die IonPage beim Einhaengen; tauschte die Seite
// sie spaeter gegen eine andere, bliebe die neue weiss (MainTabs.tsx,
// SeiteMitChunk; Test keinTauschImOutlet). Getauscht wird deshalb nur der
// Inhalt darin.
//
// Der Inhalt beginnt je Challenge frisch (key): Fuehrt ein Link von einer
// Challenge zur naechsten, steht wieder "laedt" da, und die neue wird als
// gelesen gemeldet -- wie die Huelle des frueheren Dialogs.
const KonfiChallengeDetailPage: React.FC<KonfiChallengeDetailPageProps> = ({ challengeId, onBack }) => {
  const pageRef = useRef<HTMLElement | null>(null);
  return (
    <IonPage ref={pageRef}>
      <KonfiChallengeDetailInhalt key={challengeId} challengeId={challengeId} onBack={onBack} pageRef={pageRef} />
    </IonPage>
  );
};

export default KonfiChallengeDetailPage;
