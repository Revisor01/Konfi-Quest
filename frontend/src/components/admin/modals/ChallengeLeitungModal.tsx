import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonPage,
  IonButtons,
  IonButton,
  IonIcon,
  IonSpinner,
  IonList,
  IonListHeader,
  IonLabel,
  IonCard,
  IonCardContent,
  IonSegment,
  IonSegmentButton,
  IonRefresher,
  IonRefresherContent,
  IonItem,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  useIonAlert,
  useIonActionSheet,
  useIonModal
} from '@ionic/react';
import {
  closeOutline,
  flag,
  shareOutline,
  addOutline,
  personOutline,
  checkmarkCircleOutline,
  eyeOffOutline,
  eyeOutline,
  documentTextOutline,
  linkOutline,
  imageOutline,
  micOutline,
  videocamOutline,
  albumsOutline,
  timeOutline,
  checkmarkOutline,
  lockClosedOutline,
  removeCircleOutline
} from 'ionicons/icons';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';
import { EmptyState, SectionHeader, AudioPlayer } from '../../shared';
import { triggerPullHaptic } from '../../../utils/haptics';
import { closeOpenSlidingItems } from '../../../utils/slidingItems';
import ChallengeSubmitModal from '../../konfi/modals/ChallengeSubmitModal';
import type {
  AdminChallenge,
  KonfiChallenge,
  ChallengeSubmission
} from '../../../types/challenges';

// VEREINTES Challenge-Detail fuer Leitung und Teamer:innen (11.08.): Verwalten
// UND Mitmachen in EINEM Modal, statt eines Segments, das die ganze Seite
// umschaltet. Enthaelt die Moderation aus ChallengeModerationModal und den
// Abschnitt "Dein Beitrag" aus der Konfi-Detailansicht.
//
// Die beiden Ursprungs-Modals bleiben unveraendert bestehen:
// ChallengeDetailModal wird weiterhin von Konfis genutzt.

// Medienvorschau fuer Challenge-Beitraege (Foto/Audio/Video). Bewusst eine
// eigene, schlanke Variante statt des Chat-LazyImage: der mediaCache-Service
// ist fest auf /chat/files/ verdrahtet, Challenges liegen unter
// /challenges/files/. Geladen wird per axios (Auth-Header) in eine
// Object-URL, freigegeben beim Unmount.
const ChallengeMedia: React.FC<{
  filePath: string;
  fileName?: string | null;
  mediaType: 'photo' | 'audio' | 'video';
}> = ({ filePath, fileName, mediaType }) => {
  const [src, setSrc] = useState<string>('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';
    (async () => {
      try {
        const res = await api.get(`/challenges/files/${filePath}`, { responseType: 'blob' });
        if (cancelled) return;
        objectUrl = URL.createObjectURL(res.data as Blob);
        setSrc(objectUrl);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [filePath]);

  if (failed) {
    return (
      <div style={{ padding: '12px', color: '#999', fontSize: '0.8rem' }}>
        Datei konnte nicht geladen werden
      </div>
    );
  }

  if (!src) {
    return (
      <div
        style={{
          marginTop: '8px',
          borderRadius: '10px',
          background: '#f0f0f0',
          minHeight: '80px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <span style={{ color: '#666', fontSize: '0.85rem' }}>Wird geladen...</span>
      </div>
    );
  }

  if (mediaType === 'photo') {
    return (
      <div style={{ marginTop: '8px', borderRadius: '10px', overflow: 'hidden' }}>
        <img
          src={src}
          alt={fileName || 'Beitrag'}
          style={{ width: '100%', maxHeight: '260px', objectFit: 'cover', display: 'block' }}
        />
      </div>
    );
  }

  if (mediaType === 'video') {
    return (
      <video
        src={src}
        controls
        playsInline
        style={{ width: '100%', maxHeight: '260px', marginTop: '8px', borderRadius: '10px', display: 'block' }}
      />
    );
  }

  // audio
  return <AudioPlayer src={src} />;
};

const MEDIA_ICON: Record<string, string> = {
  text: documentTextOutline,
  photo: imageOutline,
  audio: micOutline,
  video: videocamOutline,
  link: linkOutline
};

// Icon/Farb-Zuordnung fuer Corner-Badges — dieselbe Zuordnung wie in
// ChallengeModerationModal und getOwnStatus (Konfi-Seite), damit Status
// ueberall gleich aussieht.
const STATUS_BADGE: Record<string, { label: string; icon: string; color: string }> = {
  pending: { label: 'Wartet auf Freigabe', icon: timeOutline, color: 'var(--app-color-warning)' },
  approved: { label: 'Freigegeben', icon: checkmarkOutline, color: 'var(--app-color-success)' },
  hidden: { label: 'Ausgeblendet', icon: removeCircleOutline, color: 'var(--app-color-danger)' }
};

// Konsens NIE mit einem Haken darstellen: der Haken gehoert allein dem
// Freigabe-STATUS; der Konsens spricht in Augen-Metaphorik.
const CONSENT_BADGE: Record<string, { label: string; icon: string; color: string }> = {
  publish: { label: 'Mit Namen sichtbar', icon: eyeOutline, color: 'var(--app-color-success)' },
  private: { label: 'Nur Leitung', icon: lockClosedOutline, color: '#6b7280' },
  anonymous: { label: 'Anonym sichtbar', icon: eyeOffOutline, color: '#7c3aed' }
};

// Untertitel im Kopf: sagt in EINER Zeile, wer die Beiträge sieht und ob sie
// eine Freigabe brauchen.
const buildVisibilitySubtitle = (challenge: AdminChallenge): string => {
  const sichtbarkeit = challenge.visibility === 'public'
    ? 'Für die Gruppe sichtbar'
    : challenge.visibility === 'private'
      ? 'Nur für euch in der Leitung'
      : 'Konfi entscheidet je Beitrag';
  // Bei 'private' ist die Freigabe fuer die Gruppe bedeutungslos — dort gibt es
  // keine Galerie, in der etwas erscheinen koennte.
  if (challenge.visibility === 'private') return sichtbarkeit;
  return `${sichtbarkeit} · ${challenge.moderated ? 'nach Freigabe' : 'sofort'}`;
};

const formatDateTime = (value?: string) => {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ', ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
};

export interface ChallengeLeitungModalProps {
  // NULL-SICHER: Die Seite dahinter fuehrt die Challenge als State und rendert
  // dieses Modal ueber useIonModal auch waehrend der Dismiss-Animation weiter.
  // Wuerde der State dort auf null gesetzt (oder ein kaputter Cache ein
  // undefined liefern), darf das hier NICHT werfen — ein Render-Fehler landet
  // sonst in der ErrorBoundary, die Auth + Cache leert ("Rauswurf zur Anmeldung").
  challenge?: AdminChallenge | null;
  onClose: () => void;
  // Wird nach jeder Moderations-Aktion und nach eigenem Einreichen gerufen,
  // damit die Liste dahinter (Pending-Zaehler) aktuell bleibt.
  onChanged?: () => void;
  /**
   * Element fuer die Card-Optik des Einreichen-Modals. Ohne dieses schiebt die
   * Ansicht darunter nicht nach hinten, das Sheet legt sich hart darueber
   * (User-Hinweis 11.08.).
   */
  presentingElement?: HTMLElement | null;
}

// Drei Filter reichen: alles sehen, sehen was noch wartet, sehen was
// ausgeblendet wurde. Freigegebene Beitraege haben bewusst KEINEN eigenen
// Filter: sie sind der Normalfall und stehen ohnehin unter "Alle".
type StatusFilter = 'all' | 'pending' | 'hidden';

const ChallengeLeitungModal: React.FC<ChallengeLeitungModalProps> = ({
  challenge,
  onClose,
  onChanged,
  presentingElement
}) => {
  const { user, setError, setSuccess } = useApp();
  const [presentAlert] = useIonAlert();
  const [presentActionSheet] = useIonActionSheet();
  const [submissions, setSubmissions] = useState<ChallengeSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const challengeId = challenge?.id;

  const loadSubmissions = useCallback(async () => {
    if (!challengeId) return;
    try {
      const res = await api.get(`/challenges/admin/${challengeId}/submissions`);
      // Backend liefert { challenge, submissions } — die Liste daraus ziehen und
      // den Konfi-Namen aus display_name normalisieren.
      const raw = Array.isArray(res.data) ? res.data : (res.data?.submissions || []);
      setSubmissions(
        raw.map((row: any) => ({
          ...row,
          konfi_name: row.konfi_name ?? row.display_name ?? null
        }))
      );
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Laden der Beiträge');
    } finally {
      setLoading(false);
    }
  }, [challengeId, setError]);

  useEffect(() => {
    setLoading(true);
    loadSubmissions();
  }, [loadSubmissions]);

  // Einreich-Modal: erwartet eine KonfiChallenge. Die AdminChallenge erweitert
  // dieselbe Basis (ChallengeBase) und traegt alle vom Formular gelesenen
  // Felder (allowed_media, visibility, moderated) — deshalb genuegt die
  // Zuweisung ohne Nachbau.
  const submitChallenge: KonfiChallenge | null = challenge ?? null;

  const [presentSubmitModal, dismissSubmitModal] = useIonModal(ChallengeSubmitModal, {
    challenge: submitChallenge,
    onClose: () => { dismissSubmitModal(); },
    onSuccess: () => {
      dismissSubmitModal();
      loadSubmissions();
      onChanged?.();
    }
  });

  const counts = useMemo(() => ({
    total: submissions.length,
    pending: submissions.filter((s) => s.moderation_status === 'pending').length,
    approved: submissions.filter((s) => s.moderation_status === 'approved').length,
    hidden: submissions.filter((s) => s.moderation_status === 'hidden').length
  }), [submissions]);

  // GENAU DREI Kacheln — nie mehr (harte Gestaltungsregel).
  // "Freigegeben" steht immer. Die beiden anderen Plaetze gehen an das, was
  // gerade etwas aussagt:
  //   - "Wartet" nur bei Freigabe-Pflicht (sonst wartet nie etwas)
  //   - "Ausgeblendet" nur wenn es ausgeblendete Beitraege gibt
  // Sind beide relevant, weicht "Gesamt" — die Gesamtzahl steht ohnehin in der
  // Listenueberschrift ("Beiträge (8)") und ist die schwaechste der Angaben.
  const headerStats = useMemo(() => {
    // Labels muessen KURZ sein: die Kachel ist auf 100px gedeckelt und das
    // Label steht in Grossbuchstaben mit Sperrung und ohne Umbruch
    // (.app-stats-row__label) -> "Versteckt" / "Frei" statt der langen Woerter.
    const optional: Array<{ value: number; label: string }> = [];
    if (challenge?.moderated) optional.push({ value: counts.pending, label: 'Wartet' });
    if (counts.hidden > 0) optional.push({ value: counts.hidden, label: 'Versteckt' });

    const stats = optional.length >= 2
      ? [...optional.slice(0, 2), { value: counts.approved, label: 'Frei' }]
      : [{ value: counts.total, label: 'Gesamt' }, ...optional, { value: counts.approved, label: 'Frei' }];

    // Bleiben nur zwei (keine Freigabe-Pflicht, nichts ausgeblendet), fuellt
    // "Versteckt: 0" auf — drei Kacheln sind gesetzt, zwei saehen luecken-
    // haft aus.
    while (stats.length < 3) stats.push({ value: counts.hidden, label: 'Versteckt' });

    return stats.slice(0, 3);
  }, [challenge?.moderated, counts]);

  // Laeuft die Challenge gerade? Nur dann darf man selbst einreichen.
  const isActive = useMemo(() => {
    if (!challenge) return false;
    const start = new Date(challenge.starts_at).getTime();
    const end = new Date(challenge.ends_at).getTime();
    const now = Date.now();
    return !challenge.is_draft && now >= start && now <= end;
  }, [challenge]);

  // Eigene Beitraege aus derselben Liste ziehen — das Backend liefert user_id
  // in GET /challenges/admin/:id/submissions mit.
  const ownSubmissions = useMemo(() => {
    if (!user?.id) return [];
    return submissions
      .filter((s) => s.user_id === user.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [submissions, user?.id]);

  const canSubmitMore = isActive && (challenge?.allow_multiple || ownSubmissions.length === 0);

  // Beendete Challenge ohne eigene Beitraege: der Abschnitt faellt komplett weg.
  const showOwnSection = isActive || ownSubmissions.length > 0;

  // Ohne Freigabe-Pflicht gibt es das "Wartet"-Segment nicht — ein von einer
  // anderen Challenge uebernommener Filterstand wuerde sonst eine leere Liste
  // zeigen, ohne dass man den Grund sieht.
  const effectiveFilter: StatusFilter =
    statusFilter === 'pending' && !challenge?.moderated ? 'all' : statusFilter;

  const filtered = useMemo(() => {
    const active = effectiveFilter;
    const list = active === 'all'
      ? [...submissions]
      : submissions.filter((s) => s.moderation_status === active);
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [submissions, effectiveFilter]);

  const moderate = async (
    submission: ChallengeSubmission,
    action: 'approve' | 'hide' | 'unhide' | 'anonymize'
  ) => {
    setBusyId(submission.id);
    try {
      await api.put(`/challenges/admin/submissions/${submission.id}/moderate`, { action });
      await loadSubmissions();
      onChanged?.();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler bei der Moderation');
    } finally {
      setBusyId(null);
    }
  };

  // Anonymisieren ist endgueltig -> Rueckfrage, damit das niemand versehentlich
  // ausloest (das Backend lehnt jede Ruecknahme mit 409 ab).
  const confirmAnonymize = (submission: ChallengeSubmission) => {
    presentAlert({
      header: 'Beitrag anonym stellen',
      message: `Der Beitrag von ${submission.konfi_name || 'diesem Konfi'} erscheint für die Gruppe dann ohne Namen. Das lässt sich nicht rückgängig machen — ihr in der Leitung seht weiterhin, von wem er stammt.`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        { text: 'Anonym stellen', handler: () => { moderate(submission, 'anonymize'); } }
      ]
    });
  };

  const confirmHide = (submission: ChallengeSubmission) => {
    presentAlert({
      header: 'Beitrag ausblenden',
      message: `Der Beitrag von ${submission.konfi_name || 'diesem Konfi'} wird für die Gruppe nicht mehr sichtbar sein. Der Konfi sieht seinen Beitrag weiterhin.`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        { text: 'Ausblenden', role: 'destructive', handler: () => { moderate(submission, 'hide'); } }
      ]
    });
  };

  // Welche Aktionen ein Beitrag gerade zulaesst — EINE Quelle fuer Tippen
  // (ActionSheet) und Wischen (Swipe-Icons), damit beide Wege nie auseinander
  // laufen. Reihenfolge = Reihenfolge im ActionSheet.
  const availableActions = (submission: ChallengeSubmission) => {
    const actions: Array<{
      key: 'approve' | 'anonymize' | 'hide' | 'unhide';
      text: string;
      icon: string;
      color: string;
      role?: 'destructive';
      run: () => void;
    }> = [];

    if (submission.moderation_status === 'pending') {
      actions.push({
        key: 'approve', text: 'Freigeben', icon: checkmarkCircleOutline,
        color: 'var(--app-color-success)',
        run: () => moderate(submission, 'approve')
      });
    }
    // Anonym stellen ist eine EINBAHNSTRASSE: einmal anonym, immer anonym —
    // deshalb nur bei consent='publish' und mit Rueckfrage.
    if (challenge?.visibility === 'konfi_choice' && submission.konfi_consent === 'publish') {
      actions.push({
        key: 'anonymize', text: 'Anonym stellen', icon: eyeOffOutline,
        color: '#7c3aed',
        run: () => confirmAnonymize(submission)
      });
    }
    if (submission.moderation_status !== 'hidden') {
      actions.push({
        // NICHT eyeOffOutline: das gehoert dem Anonymisieren (durchgestrichenes
        // Auge = "ohne Namen"). Ausblenden nimmt dasselbe Symbol wie sein
        // Status-Badge, damit Aktion und Zustand zusammenpassen und die beiden
        // Aktionen im Menue unterscheidbar sind (User-Hinweis 11.08.).
        key: 'hide', text: 'Ausblenden', icon: removeCircleOutline,
        color: 'var(--app-color-danger)', role: 'destructive',
        run: () => confirmHide(submission)
      });
    } else {
      actions.push({
        key: 'unhide', text: 'Wieder einblenden', icon: eyeOutline,
        color: 'var(--app-color-challenges)',
        run: () => moderate(submission, 'unhide')
      });
    }
    return actions;
  };

  // Tippen auf einen Beitrag oeffnet die Aktionen — dasselbe Muster wie in den
  // uebrigen Listen (Events, Konfis).
  const openActions = (submission: ChallengeSubmission) => {
    const actions = availableActions(submission);
    presentActionSheet({
      header: submission.konfi_name || 'Beitrag',
      buttons: [
        ...actions.map((a) => ({
          text: a.text,
          role: a.role,
          handler: () => { a.run(); }
        })),
        { text: 'Abbrechen', role: 'cancel' }
      ]
    });
  };

  const handleExport = async () => {
    if (!challenge) return;
    try {
      const res = await api.get(`/challenges/admin/${challenge.id}/export`, { responseType: 'text' });
      const text = typeof res.data === 'string' ? res.data : String(res.data ?? '');
      if (!text.trim()) {
        setError('Es gibt noch keine Texte oder Links zum Exportieren.');
        return;
      }

      const fileName = `challenge-${challenge.id}-beitraege.txt`;

      if (Capacitor.isNativePlatform()) {
        await Filesystem.writeFile({
          path: fileName,
          data: text,
          directory: Directory.Cache,
          encoding: 'utf8' as any
        });
        const uri = await Filesystem.getUri({ path: fileName, directory: Directory.Cache });
        await Share.share({ title: challenge.title, files: [uri.uri] });
      } else {
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setSuccess('Export heruntergeladen');
      }
    } catch (err: any) {
      // Abgebrochenes Share-Sheet ist kein Fehler
      if (err?.message && /cancel/i.test(err.message)) return;
      setError(err.response?.data?.error || 'Export fehlgeschlagen');
    }
  };

  // Nach den Hooks (Hook-Reihenfolge!): ohne Challenge nichts rendern statt werfen.
  if (!challenge) {
    return null;
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Challenge</IonTitle>
          <IonButtons slot="start">
            <IonButton onClick={onClose} className="app-modal-close-btn" aria-label="Schließen">
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            {/* Selbst mitmachen — nur solange die Challenge laeuft */}
            {canSubmitMore && (
              <IonButton
                onClick={() => presentSubmitModal({ presentingElement: presentingElement || undefined })}
                title="Beitrag einreichen"
                aria-label="Beitrag einreichen"
              >
                <IonIcon icon={addOutline} slot="icon-only" />
              </IonButton>
            )}
            <IonButton onClick={handleExport} title="Beiträge exportieren" aria-label="Beiträge exportieren">
              <IonIcon icon={shareOutline} slot="icon-only" />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        <IonRefresher
          slot="fixed"
          onIonRefresh={async (e) => { await loadSubmissions(); e.detail.complete(); }}
          onIonPull={triggerPullHaptic}
        >
          <IonRefresherContent />
        </IonRefresher>

        {/* Kopf: Challenge-Info — IMMER GENAU DREI Kacheln (harte Regel). */}
        <SectionHeader
          title={challenge.title}
          subtitle={buildVisibilitySubtitle(challenge)}
          icon={flag}
          preset="challenges"
          stats={headerStats}
        />

        {/* Aufgabentext als CARD wie in der Konfi-Sicht (User-Entscheid
            11.08.): der rote Infokasten war fuer den Haupttext zu laut, die
            Karte mit Meta-Zeile liest sich ruhiger. Aufbau bewusst identisch
            zu ChallengeDetailModal. */}
        {challenge.description && (
          <IonList inset={true} className="app-segment-wrapper">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--challenges">
                <IonIcon icon={documentTextOutline} />
              </div>
              <IonLabel>{isActive ? 'Worum geht es?' : 'Worum ging es?'}</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent style={{ padding: '14px' }}>
                <div style={{ fontSize: '0.93rem', lineHeight: 1.5, color: '#3c3c43', whiteSpace: 'pre-wrap' }}>
                  {challenge.description}
                </div>
                <div
                  style={{
                    display: 'flex', flexWrap: 'wrap', gap: '8px 14px',
                    marginTop: '12px', fontSize: '0.8rem', color: '#8e8e93'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <IonIcon icon={timeOutline} className="app-icon-color--challenges" />
                    {isActive ? 'Läuft gerade' : 'Beendet'}
                  </span>
                  {(challenge.author_name || challenge.author_freetext) && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <IonIcon icon={personOutline} className="app-icon-color--challenges" />
                      Gestellt von {challenge.author_name || challenge.author_freetext}
                    </span>
                  )}
                </div>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* Dein Beitrag — eigene Teilnahme, direkt hier statt in einem
            getrennten "Mitmachen"-Bereich (Zusammenlegung 11.08.). */}
        {showOwnSection && (
          <IonList inset={true} style={{ margin: '16px 16px 0 16px' }}>
            <IonListHeader>
              <div className="app-section-icon app-section-icon--challenges">
                <IonIcon icon={personOutline} />
              </div>
              <IonLabel>Dein Beitrag</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent style={{ padding: ownSubmissions.length === 0 ? '16px' : '12px' }}>
                {loading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}>
                    <IonSpinner name="crescent" />
                  </div>
                ) : ownSubmissions.length === 0 ? (
                  <EmptyState
                    icon={documentTextOutline}
                    title="Noch kein Beitrag von dir"
                    message="Tippe oben auf das Plus, um selbst etwas einzureichen."
                    iconColor="var(--app-color-challenges)"
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {ownSubmissions.map((submission) => {
                      const status = STATUS_BADGE[submission.moderation_status] || STATUS_BADGE.pending;
                      return (
                        <div
                          key={submission.id}
                          className="app-list-item app-list-item--challenges"
                          style={{
                            width: '100%',
                            borderLeftColor: status.color,
                            marginBottom: '0',
                            display: 'block',
                            position: 'relative',
                            overflow: 'hidden'
                          }}
                        >
                          <div className="app-corner-badges">
                            <div
                              className="app-corner-badge"
                              style={{ backgroundColor: status.color, padding: '4px 6px' }}
                              title={status.label}
                            >
                              <IonIcon
                                icon={status.icon}
                                style={{ color: '#fff', fontSize: '0.85rem', display: 'block' }}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', paddingRight: '40px' }}>
                            <div className="app-icon-circle app-icon-circle--lg" style={{ backgroundColor: status.color }}>
                              <IonIcon icon={MEDIA_ICON[submission.media_type] || documentTextOutline} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="app-list-item__title">Dein Beitrag</div>
                              <div className="app-list-item__subtitle">
                                {formatDateTime(submission.created_at)}
                              </div>
                            </div>
                          </div>

                          {submission.text_content && (
                            <div style={{ fontSize: '0.9rem', color: '#333', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
                              {submission.text_content}
                            </div>
                          )}

                          {submission.media_type === 'link' && submission.link_url && /^https?:\/\//i.test(submission.link_url) && (
                            <a
                              href={submission.link_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                marginTop: '6px', fontSize: '0.85rem', color: 'var(--app-color-challenges)',
                                wordBreak: 'break-all'
                              }}
                            >
                              <IonIcon icon={linkOutline} />
                              {submission.link_url}
                            </a>
                          )}

                          {submission.file_path && (submission.media_type === 'photo' || submission.media_type === 'audio' || submission.media_type === 'video') && (
                            <ChallengeMedia
                              filePath={submission.file_path}
                              fileName={submission.file_name}
                              mediaType={submission.media_type}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* Moderation: Filter + alle Beitraege */}
        <div style={{ margin: '16px 16px 8px 16px' }}>
          <IonSegment value={effectiveFilter} onIonChange={(e) => setStatusFilter(e.detail.value as StatusFilter)}>
            <IonSegmentButton value="all"><IonLabel>Alle</IonLabel></IonSegmentButton>
            {/* "Wartet" nur bei Challenges MIT Freigabe-Pflicht — ohne
                Moderation ist jeder Beitrag sofort freigegeben, der Filter
                waere immer leer. */}
            {challenge.moderated && (
              <IonSegmentButton value="pending"><IonLabel>Wartet</IonLabel></IonSegmentButton>
            )}
            <IonSegmentButton value="hidden"><IonLabel>Ausgeblendet</IonLabel></IonSegmentButton>
          </IonSegment>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
            <IonSpinner name="crescent" />
          </div>
        ) : (
          <IonList inset={true} style={{ margin: '16px' }}>
            <IonListHeader>
              <div className="app-section-icon app-section-icon--challenges">
                <IonIcon icon={albumsOutline} />
              </div>
              <IonLabel>Beiträge ({filtered.length})</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent style={{ padding: filtered.length === 0 ? '16px' : '12px' }}>
                {filtered.length === 0 ? (
                  <EmptyState
                    icon={albumsOutline}
                    title="Keine Beiträge"
                    message="Sobald Konfis etwas einreichen, erscheint es hier."
                    iconColor="#be185d"
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {filtered.map((submission) => {
                      const status = STATUS_BADGE[submission.moderation_status] || STATUS_BADGE.pending;
                      const consent = submission.konfi_consent ? CONSENT_BADGE[submission.konfi_consent] : null;
                      const isBusy = busyId === submission.id;

                      const actions = availableActions(submission);

                      return (
                        <IonItemSliding key={submission.id} disabled={isBusy}>
                          <IonItem
                            button
                            onClick={() => !isBusy && openActions(submission)}
                            detail={false}
                            lines="none"
                            style={{
                              '--background': 'transparent',
                              '--padding-start': '0',
                              '--padding-end': '0',
                              '--inner-padding-end': '0',
                              '--inner-border-width': '0',
                              '--border-style': 'none',
                              '--min-height': 'auto'
                            }}
                          >
                            <div
                              className="app-list-item app-list-item--challenges"
                              style={{
                                width: '100%',
                                borderLeftColor: status.color,
                                marginBottom: '0',
                                display: 'block',
                                position: 'relative',
                                overflow: 'hidden',
                                opacity: submission.moderation_status === 'hidden' ? 0.75 : 1
                              }}
                            >
                              {/* Corner-Badges: Konsens + Status (max. 2) */}
                              <div className="app-corner-badges">
                                {consent && (
                                  <>
                                    <div
                                      className="app-corner-badge"
                                      style={{ backgroundColor: consent.color, padding: '4px 6px' }}
                                      title={consent.label}
                                    >
                                      <IonIcon icon={consent.icon} style={{ color: '#fff', fontSize: '0.85rem', display: 'block' }} />
                                    </div>
                                    <div className="app-corner-badges__separator" />
                                  </>
                                )}
                                <div
                                  className="app-corner-badge"
                                  style={{ backgroundColor: status.color, padding: '4px 6px' }}
                                  title={status.label}
                                >
                                  <IonIcon icon={status.icon} style={{ color: '#fff', fontSize: '0.85rem', display: 'block' }} />
                                </div>
                              </div>

                              {/* Kopfzeile: Konfi + Zeit */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', paddingRight: '60px' }}>
                                <div className="app-icon-circle app-icon-circle--lg" style={{ backgroundColor: status.color }}>
                                  <IonIcon icon={MEDIA_ICON[submission.media_type] || documentTextOutline} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div className="app-list-item__title">
                                    {submission.konfi_name || 'Unbekannt'}
                                  </div>
                                  <div className="app-list-item__subtitle">
                                    {submission.jahrgang_name ? `${submission.jahrgang_name} · ` : ''}
                                    {formatDateTime(submission.created_at)}
                                  </div>
                                </div>
                              </div>

                              {/* Inhalt */}
                              {submission.text_content && (
                                <div style={{ fontSize: '0.9rem', color: '#333', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
                                  {submission.text_content}
                                </div>
                              )}

                              {submission.media_type === 'link' && submission.link_url && /^https?:\/\//i.test(submission.link_url) && (
                                <a
                                  href={submission.link_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  // Der Link gehoert dem Link — sonst faengt das
                                  // umgebende IonItem den Tap ab und oeffnet statt
                                  // der Seite das Aktions-Menue.
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                                    marginTop: '6px', fontSize: '0.85rem', color: 'var(--app-color-challenges)',
                                    wordBreak: 'break-all'
                                  }}
                                >
                                  <IonIcon icon={linkOutline} />
                                  {submission.link_url}
                                </a>
                              )}

                              {submission.file_path && (submission.media_type === 'photo' || submission.media_type === 'audio' || submission.media_type === 'video') && (
                                // Audio-/Video-Steuerung braucht ihre eigenen Klicks
                                // (Play, Scrubben) — ohne diesen Stopper landet jeder
                                // Griff zum Player im Aktions-Menue des Items.
                                <div onClick={(e) => e.stopPropagation()}>
                                  <ChallengeMedia
                                    filePath={submission.file_path}
                                    fileName={submission.file_name}
                                    mediaType={submission.media_type}
                                  />
                                </div>
                              )}

                              {isBusy && (
                                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
                                  <IonSpinner name="crescent" />
                                </div>
                              )}
                            </div>
                          </IonItem>

                          <IonItemOptions side="end" className="app-swipe-actions">
                            {actions.map((action) => (
                              <IonItemOption
                                key={action.key}
                                // Zuerst das aufgewischte Element schliessen,
                                // sonst bleibt die Zeile offen stehen, waehrend
                                // die Aktion laeuft (User-Hinweis 11.08.).
                                onClick={() => { closeOpenSlidingItems(); action.run(); }}
                                className="app-swipe-action"
                                aria-label={action.text}
                              >
                                <div
                                  className="app-icon-circle app-icon-circle--lg"
                                  style={{ backgroundColor: action.color }}
                                  title={action.text}
                                >
                                  <IonIcon icon={action.icon} />
                                </div>
                              </IonItemOption>
                            ))}
                          </IonItemOptions>
                        </IonItemSliding>
                      );
                    })}
                  </div>
                )}
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        <div className="ion-padding-bottom" />
      </IonContent>
    </IonPage>
  );
};

export default ChallengeLeitungModal;
