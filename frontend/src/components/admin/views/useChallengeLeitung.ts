import { useState, useEffect, useMemo, useCallback, type RefObject } from 'react';
import { useIonAlert, useIonModal } from '@ionic/react';
import {
  ICON_BILD,
  ICON_ENTFERNEN,
  ICON_HAKEN,
  ICON_LINK,
  ICON_LOESCHEN,
  ICON_MIKROFON,
  ICON_SICHTBAR,
  ICON_SPERRE,
  ICON_TEXTDOKUMENT,
  ICON_UHRZEIT,
  ICON_VERBORGEN,
  ICON_VIDEO,
  ICON_ZUSAGE,
} from '../../shared/icons';
import { Capacitor } from '@capacitor/core';
import { teilen } from '../../../services/systemDialoge';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';
import { useDateiOeffnen } from '../../../hooks/useDateiOeffnen';
import { medienVergessen } from '../../../services/mediaCache';
import { netzZuerstLaden } from '../../../services/netzZuerst';
import { CACHE_TTL } from '../../../services/offlineCache';
import ChallengeSubmitModal from '../../konfi/modals/ChallengeSubmitModal';
import { getChallengeStatus } from './ChallengesManageView';
import { trackHandlung } from '../../../services/analytics';
import { fehlerText } from '../../../utils/fehler';
import type {
  AdminChallenge,
  KonfiChallenge,
  ChallengeSubmission
} from '../../../types/challenges';

// Die Logik der Challenge-Seite fuer Team und Leitung -- Beitraege laden,
// moderieren, einreichen, exportieren -- an EINER Stelle fuer die Ansicht der
// App (ChallengeLeitungView) und die Web-Fassung
// (shared/web/challenges/WebChallengeLeitungDetail). Aus der Ansicht
// herausgezogen (03.10.2026, docs/planung/web-alle-bereiche.md,
// Entscheidung 2), ohne etwas an ihrer Darstellung zu aendern: Was jemand
// darf (availableActions), was ein Reiter zeigt (filtered) und wie gezaehlt
// wird (counts) soll in beiden Darstellungen nie auseinanderlaufen.

// Welcher Zustand nach einer Moderations-Aktion gilt -- fuer die sofortige
// Anzeige, bevor die Liste nachgeladen ist. Anonymisieren aendert ihn nicht.
// Dieselbe Zuordnung wie im Server (PUT /challenges/admin/submissions/:id/moderate).
const MODERATION_NEUER_STATUS: Record<'approve' | 'hide' | 'unhide' | 'anonymize', ChallengeSubmission['moderation_status'] | null> = {
  approve: 'approved',
  hide: 'hidden',
  unhide: 'approved',
  anonymize: null
};

// Die vier Moderations-Aktionen als grobe Messwerte. Fest verdrahtet, damit
// nie ein technischer Bezeichner aus dem Backend an die Messung durchrutscht.
const MODERATION_MESSWERT: Record<'approve' | 'hide' | 'unhide' | 'anonymize', string> = {
  approve: 'freigegeben',
  hide: 'ausgeblendet',
  unhide: 'wieder-sichtbar',
  anonymize: 'anonymisiert'
};

export const MEDIA_ICON: Record<string, string> = {
  text: ICON_TEXTDOKUMENT,
  photo: ICON_BILD,
  audio: ICON_MIKROFON,
  video: ICON_VIDEO,
  link: ICON_LINK
};

// Icon/Farb-Zuordnung für Corner-Badges — dieselbe Zuordnung wie in
// ChallengeModerationModal und getOwnStatus (Konfi-Seite), damit Status
// ueberall gleich aussieht.
export const STATUS_BADGE: Record<string, { label: string; icon: string; color: string }> = {
  pending: { label: 'Wartet auf Freigabe', icon: ICON_UHRZEIT, color: 'var(--app-color-warning)' },
  approved: { label: 'Freigegeben', icon: ICON_HAKEN, color: 'var(--app-color-success-strong)' },
  hidden: { label: 'Ausgeblendet', icon: ICON_ENTFERNEN, color: 'var(--app-color-danger)' }
};

// Konsens NIE mit einem Haken darstellen: der Haken gehört allein dem
// Freigabe-STATUS; der Konsens spricht in Augen-Metaphorik.
export const CONSENT_BADGE: Record<string, { label: string; icon: string; color: string }> = {
  publish: { label: 'Mit Namen sichtbar', icon: ICON_SICHTBAR, color: 'var(--app-color-success-strong)' },
  private: { label: 'Nur Leitung', icon: ICON_SPERRE, color: 'var(--app-color-neutral)' },
  anonymous: { label: 'Anonym sichtbar', icon: ICON_VERBORGEN, color: 'var(--app-color-wrapped)' }
};

/**
 * Status-Badge unter Berücksichtigung der Sichtbarkeit.
 *
 * "Freigegeben" mit gruenem Haken hiess bisher nur: die Leitung hat den Beitrag
 * durchgewinkt. Ob ihn danach überhaupt jemand außer der Leitung sieht, stand
 * allein im zweiten Badge — ein freigegebener Beitrag mit consent='private' trug
 * also einen gruenen Haken, obwohl er nirgends erscheint (User-Hinweis 11.08.).
 * Jetzt schlägt die Sichtbarkeit den Haken: bleibt der Beitrag bei der Leitung,
 * zeigt das Badge das Schloss.
 */
export const getStatusBadge = (
  submission: ChallengeSubmission,
  challenge: AdminChallenge
): { label: string; icon: string; color: string } => {
  const basis = STATUS_BADGE[submission.moderation_status] || STATUS_BADGE.pending;
  if (submission.moderation_status !== 'approved') return basis;
  // Freigegeben, aber nicht oeffentlich: Challenge ist 'private' ODER der Konfi
  // hat sich beim Einreichen gegen die Galerie entschieden.
  const bleibtBeiDerLeitung =
    challenge.visibility === 'private' || submission.konfi_consent === 'private';
  if (bleibtBeiDerLeitung) {
    return { label: 'Freigegeben, nur Leitung', icon: ICON_SPERRE, color: 'var(--app-color-neutral)' };
  }
  return basis;
};

// Drei Filter reichen — und sie sind DISJUNKT (jeder Beitrag steht in genau
// einem): "Feed" zeigt nur Freigegebenes, also das, was auch die Konfis sehen
// (sauberer Feed, User-Entscheid 24.08.2026); "Wartet" die offene Moderation;
// "Ausgeblendet" das Weggeraeumte. Ein "Alle"-Reiter, der wartende und
// ausgeblendete Beitraege in den normalen Feed mischt, existiert bewusst
// nicht mehr.
export type StatusFilter = 'feed' | 'pending' | 'hidden' | 'meins';


interface ChallengeLeitungOptionen {
  // NULL-SICHER: Ein kaputter Cache-Eintrag kann ein undefined liefern. Das
  // darf hier NICHT werfen -- ein Render-Fehler landet sonst in der
  // ErrorBoundary, die Auth + Cache leert ("Rauswurf zur Anmeldung").
  challenge?: AdminChallenge | null;
  /** Nach jeder Moderations-Aktion und nach eigenem Einreichen: die Liste dahinter aktuell halten. */
  onChanged?: () => void;
  /** Die IonPage der Seite -- fuer die Card-Optik des Einreich-Modals. */
  seitenRef?: RefObject<HTMLElement | null>;
}

export function useChallengeLeitung({ challenge, onChanged, seitenRef }: ChallengeLeitungOptionen) {
  const { user, setError, setSuccess } = useApp();
  const [presentAlert] = useIonAlert();
  const [submissions, setSubmissions] = useState<ChallengeSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('feed');

  const challengeId = challenge?.id;

  // Ohne Netz und ohne gespeicherten Stand: sagen, dass die Beiträge offline
  // fehlen, statt "keine Beiträge" zu behaupten.
  const [offlineOhneStand, setOfflineOhneStand] = useState(false);
  const benutzerId = user?.id;

  const loadSubmissions = useCallback(async () => {
    if (!challengeId) return;
    try {
      // Netz zuerst wie in der Konfi-Ansicht (27.09.2026): Bei Netz gilt der
      // Server, ohne Netz der zuletzt geladene Stand samt Fotos vom Gerät.
      const { daten } = await netzZuerstLaden<unknown>(
        `leitung:challenge-beitraege:${benutzerId}:${challengeId}`,
        () => api.get(`/challenges/admin/${challengeId}/submissions`).then((res) => res.data),
        CACHE_TTL.REQUESTS
      );
      setOfflineOhneStand(false);
      const antwort = daten as { submissions?: ChallengeSubmission[] } | ChallengeSubmission[] | null;
      // Backend liefert { challenge, submissions } — die Liste daraus ziehen und
      // den Konfi-Namen aus display_name normalisieren.
      const raw = Array.isArray(antwort) ? antwort : (antwort?.submissions || []);
      setSubmissions(
        // display_name ist die Altform des Namensfeldes — deshalb hier
        // zusaetzlich zum Typ des Beitrags aufgefuehrt.
        raw.map((row: ChallengeSubmission & { display_name?: string | null }) => ({
          ...row,
          konfi_name: row.konfi_name ?? row.display_name ?? null
        }))
      );
    } catch (err) {
      if ((err as { response?: unknown })?.response === undefined) {
        setOfflineOhneStand(true);
      } else {
        setError(fehlerText(err, 'Fehler beim Laden der Beiträge'));
      }
    } finally {
      setLoading(false);
    }
  }, [challengeId, benutzerId, setError]);

  useEffect(() => {
    setLoading(true);
    loadSubmissions();
  }, [loadSubmissions]);

  // Einreich-Modal: erwartet eine KonfiChallenge. Die AdminChallenge erweitert
  // dieselbe Basis (ChallengeBase) und trägt alle vom Formular gelesenen
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

  // Abgeleiteter Status — dieselbe Quelle wie die Liste. Vorher wurde hier nur
  // aktiv/inaktiv unterschieden, wodurch Entwürfe und Geplante fälschlich
  // als "Beendet" beschriftet waren; seit dem Bearbeiten-Knopf (24.08.2026)
  // ist diese Ansicht für Entwürfe ein normaler Arbeitsweg.
  const status = challenge ? getChallengeStatus(challenge) : 'draft';
  // Laeuft die Challenge gerade? Nur dann darf man selbst einreichen.
  const isActive = status === 'active';

  // Eigene Beitraege aus derselben Liste ziehen — das Backend liefert user_id
  // in GET /challenges/admin/:id/submissions mit.
  const ownSubmissions = useMemo(() => {
    if (!user?.id) return [];
    return submissions
      .filter((s) => s.user_id === user.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [submissions, user?.id]);

  const canSubmitMore = isActive && (challenge?.allow_multiple || ownSubmissions.length === 0);

  // Ohne Freigabe-Pflicht gibt es das "Wartet"-Segment nicht — ein von einer
  // anderen Challenge uebernommener Filterstand wuerde sonst eine leere Liste
  // zeigen, ohne dass man den Grund sieht.
  const effectiveFilter: StatusFilter =
    (statusFilter === 'pending' && !challenge?.moderated) ||
    (statusFilter === 'hidden' && challenge?.visibility === 'private')
      ? 'feed' : statusFilter;

  // Die Leiste steht immer: "Feed" und "Meins" gibt es in jeder Challenge.
  // "Wartet" kommt nur mit Freigabe-Pflicht dazu, "Abgelehnt" nur, wenn es
  // eine Gruppen-Galerie gibt, aus der etwas herausgenommen werden koennte.

  const filtered = useMemo(() => {
    // "Feed" = nur Freigegebenes — derselbe Blick, den auch die Konfis auf die
    // Galerie haben. Wartendes und Abgelehntes steht in eigenen Reitern; die
    // Moderation bleibt darueber vollständig erreichbar.
    // "Meins" = die eigenen Beitraege, unabhaengig vom Status. Sie standen
    // frueher zusaetzlich in einem Block oben — das war doppelt und machte die
    // Seite zu lang (User-Hinweis 26.08.2026).
    const active = effectiveFilter;
    const list = active === 'feed'
      ? submissions.filter((s) => s.moderation_status === 'approved')
      : active === 'meins'
        ? submissions.filter((s) => Boolean(user?.id) && s.user_id === user?.id)
        : submissions.filter((s) => s.moderation_status === active);
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [submissions, effectiveFilter, user?.id]);

  // Fotos öffnen wie im Chat und in der Konfi-Ansicht (gemeinsamer Weg,
  // 27.09.2026): nativ mit Teilen und Sichern, sonst im Betrachter mit den
  // Fotos des gewählten Reiters zum Wischen.
  const { dateiOeffnen } = useDateiOeffnen({
    quelle: 'challenges',
    fehlerOrt: 'challenge-leitung-datei',
    kontext: () => filtered
      .filter((b) => b.media_type === 'photo' && b.file_path)
      .map((b) => ({ pfad: b.file_path!, name: b.file_name })),
  });

  const moderate = async (
    submission: ChallengeSubmission,
    action: 'approve' | 'hide' | 'unhide' | 'anonymize',
    reason?: string
  ) => {
    setBusyId(submission.id);
    try {
      await api.put(`/challenges/admin/submissions/${submission.id}/moderate`, {
        action,
        // Begruendung nur beim Ausblenden und nur, wenn eine eingetragen wurde
        // — das Ausblenden scheitert NIE am fehlenden Grund.
        ...(reason ? { reason } : {})
      });
      // Anonyme Messung NACH der erfolgreichen Antwort: der Beitrag wurde
      // wirklich durchgesehen. Nur die Entscheidung — kein Beitrag, keine
      // Person, keine Begruendung.
      trackHandlung('beitrag-moderiert', { entscheidung: MODERATION_MESSWERT[action] });
      // Den neuen Zustand SOFORT uebernehmen, nicht erst mit dem Nachladen:
      // Die orange Zahl am Reiter "Wartet" und die Kachel gehen damit im
      // selben Augenblick mit (29.09.2026). Das Nachladen bestaetigt danach
      // den Stand des Servers.
      const neuerStatus = MODERATION_NEUER_STATUS[action];
      if (neuerStatus) {
        setSubmissions((prev) => prev.map((s) => (
          s.id === submission.id ? { ...s, moderation_status: neuerStatus } : s
        )));
      }
      await loadSubmissions();
      onChanged?.();
    } catch (err) {
      setError(fehlerText(err, 'Fehler bei der Moderation'));
    } finally {
      setBusyId(null);
    }
  };

  // Anonymisieren ist endgueltig -> Rueckfrage, damit das niemand versehentlich
  // ausloest (das Backend lehnt jede Ruecknahme mit 409 ab).
  const confirmAnonymize = (submission: ChallengeSubmission) => {
    presentAlert({
      header: 'Beitrag anonym stellen',
      message: `Der Beitrag von ${submission.konfi_name || 'dieser Person'} erscheint dann ohne Namen — in der Galerie wie im Export. Das lässt sich nicht rückgängig machen; ihr in der Leitung seht weiterhin, von wem er stammt.`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        { text: 'Anonym stellen', handler: () => { moderate(submission, 'anonymize'); } }
      ]
    });
  };

  // Löschen heißt wirklich löschen: Datenbank-Eintrag UND hochgeladene Datei
  // (Nutzerwunsch 26.08.2026). Deshalb mit deutlicher Rückfrage — zum
  // Aufheben im Zweifel gibt es weiterhin das Ausblenden.
  const deleteSubmission = async (submission: ChallengeSubmission) => {
    setBusyId(submission.id);
    try {
      await api.delete(`/challenges/admin/submissions/${submission.id}`);
      // Die Datei ist auf dem Server weg — dann auch auf diesem Gerät
      // (gemeinsamer Medien-Cache, 27.09.2026).
      if (submission.file_path) {
        await medienVergessen(submission.file_path, 'challenges');
      }
      await loadSubmissions();
      onChanged?.();
    } catch (err) {
      setError(fehlerText(err, 'Fehler beim Löschen des Beitrags'));
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = (submission: ChallengeSubmission) => {
    presentAlert({
      header: 'Beitrag wirklich löschen?',
      message: `Der Beitrag von ${submission.konfi_name || 'dieser Person'} wird endgültig gelöscht — eine hochgeladene Datei wird mit entfernt. Das lässt sich nicht rückgängig machen. Soll der Beitrag nur aus der Gruppe verschwinden, nutze stattdessen "Ausblenden".`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Endgültig löschen',
          role: 'destructive',
          handler: () => { deleteSubmission(submission); }
        }
      ]
    });
  };

  const confirmHide = (submission: ChallengeSubmission) => {
    presentAlert({
      header: 'Beitrag ausblenden',
      message: `Der Beitrag von ${submission.konfi_name || 'dieser Person'} wird für die Gruppe nicht mehr sichtbar sein. Die einreichende Person sieht ihren Beitrag weiterhin — und die Begründung, falls du eine einträgst.`,
      inputs: [
        {
          name: 'reason',
          type: 'textarea',
          placeholder: 'Begründung (optional)',
          attributes: { maxlength: 500 }
        }
      ],
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Ausblenden',
          role: 'destructive',
          handler: (data) => {
            const reason = typeof data?.reason === 'string' ? data.reason.trim() : '';
            moderate(submission, 'hide', reason || undefined);
          }
        }
      ]
    });
  };

  // Welche Aktionen ein Beitrag gerade zulaesst — EINE Quelle für Tippen
  // (ActionSheet) und Wischen (Swipe-Icons), damit beide Wege nie auseinander
  // laufen. Reihenfolge = Reihenfolge im ActionSheet.
  const availableActions = (submission: ChallengeSubmission) => {
    const actions: Array<{
      key: 'approve' | 'anonymize' | 'hide' | 'unhide' | 'delete';
      text: string;
      icon: string;
      color: string;
      role?: 'destructive';
      run: () => void;
    }> = [];

    if (submission.moderation_status === 'pending') {
      actions.push({
        key: 'approve', text: 'Freigeben', icon: ICON_ZUSAGE,
        color: 'var(--app-color-success-strong)',
        run: () => moderate(submission, 'approve')
      });
    }
    // Anonym stellen ist eine EINBAHNSTRASSE: einmal anonym, immer anonym —
    // deshalb mit Rueckfrage. Seit 24.08.2026 fuer ALLE Sichtbarkeiten
    // (User-Entscheid, vorher nur bei 'konfi_choice'): auch bei 'public'
    // (Name verschwindet aus der Galerie) und in Team-Runden. Nur die
    // staerkste Konfi-Zusage 'private' und bereits anonyme Beitraege bleiben
    // ausgenommen — das Backend lehnt beides ohnehin mit 409 ab.
    if (submission.konfi_consent !== 'anonymous' && submission.konfi_consent !== 'private') {
      actions.push({
        key: 'anonymize', text: 'Anonym stellen', icon: ICON_VERBORGEN,
        color: 'var(--app-color-wrapped)',
        run: () => confirmAnonymize(submission)
      });
    }
    // Eigene Beitraege bekommen KEIN "Ausblenden" (User-Entscheid 24.08.2026):
    // Wer in der Leitung den eigenen Beitrag nicht zeigen will, reicht ihn
    // nicht ein oder stellt ihn anonym. "Wieder einblenden" bleibt — falls
    // jemand anderes aus der Leitung ihn ausgeblendet hat.
    const isOwn = submission.user_id != null && submission.user_id === user?.id;
    // Bei "nur Leitung" gibt es nichts auszublenden — die Gruppe sieht die
    // Beitraege ohnehin nicht (User-Entscheid 25.08.2026). "Wieder einblenden"
    // bleibt erreichbar, falls ein Altbestand ausgeblendet ist.
    const kannAusblenden = challenge?.visibility !== 'private';
    if (submission.moderation_status !== 'hidden') {
      if (!isOwn && kannAusblenden) {
        actions.push({
          // NICHT eyeOffOutline: das gehört dem Anonymisieren (durchgestrichenes
          // Auge = "ohne Namen"). Ausblenden nimmt dasselbe Symbol wie sein
          // Status-Badge, damit Aktion und Zustand zusammenpassen und die beiden
          // Aktionen im Menue unterscheidbar sind (User-Hinweis 11.08.).
          key: 'hide', text: 'Ausblenden', icon: ICON_ENTFERNEN,
          color: 'var(--app-color-danger)', role: 'destructive',
          run: () => confirmHide(submission)
        });
      }
    } else {
      actions.push({
        key: 'unhide', text: 'Wieder einblenden', icon: ICON_SICHTBAR,
        color: 'var(--app-color-challenges)',
        run: () => moderate(submission, 'unhide')
      });
    }
    // Endgültig löschen: Datenbank-Eintrag UND Datei. Auch für den eigenen
    // Beitrag — anders als beim Ausblenden gibt es hier nichts zu
    // verheimlichen, es ist schlicht weg.
    //
    // NUR FÜR DIE LEITUNG (Nutzerentscheid 28.08.2026): Teamer:innen
    // moderieren voll mit — freigeben, ausblenden, anonymisieren — weil das
    // die Arbeit vor Ort produktiv hält. Nur das Endgültige nicht:
    // Ausgeblendetes bleibt für die Leitung einsehbar, Gelöschtes wäre für
    // alle weg. Das Backend weist es seit demselben Tag mit 403 ab; ohne
    // diese Zeile stünde der Knopf da und liefe ins Leere.
    if (user?.type === 'admin') {
      actions.push({
        key: 'delete', text: 'Endgültig löschen', icon: ICON_LOESCHEN,
        color: 'var(--app-color-danger)', role: 'destructive',
        run: () => confirmDelete(submission)
      });
    }
    return actions;
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
          encoding: Encoding.UTF8
        });
        const uri = await Filesystem.getUri({ path: fileName, directory: Directory.Cache });
        await teilen({ title: challenge.title, files: [uri.uri] });
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
    } catch (err) {
      // Abgebrochenes Share-Sheet ist kein Fehler
      if (err instanceof Error && err.message && /cancel/i.test(err.message)) return;
      setError(fehlerText(err, 'Export fehlgeschlagen'));
    }
  };


  /** Das Einreich-Modal fuer den eigenen Beitrag (nur sinnvoll, wenn canSubmitMore). */
  const oeffneEinreichen = () => presentSubmitModal({ presentingElement: seitenRef?.current || undefined });

  return {
    user,
    submissions,
    loading,
    offlineOhneStand,
    busyId,
    statusFilter,
    setStatusFilter,
    effectiveFilter,
    counts,
    status,
    ownSubmissions,
    canSubmitMore,
    filtered,
    dateiOeffnen,
    loadSubmissions,
    moderate,
    availableActions,
    handleExport,
    oeffneEinreichen,
  };
}
