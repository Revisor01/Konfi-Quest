// „Neue Challenge" und „Challenge bearbeiten" -- als Logik ohne Darstellung
// (Simon, 15.10.2026: Im Browser bekommt jedes Formular, das noch ein Modal
// der App öffnet, ein kompaktes Fenster der Web-Fassung; in den Apps und
// unter 992 px bleibt das Modal, wie es ist). Die App zeigt das Formular im
// Modal (ChallengeManageModal), der Browser im Dialog
// (shared/web/challenges/WebChallengeDialog). Laden der Jahrgänge,
// Vorbelegung, die Sperren nach dem Start, Prüfung, Speichern, Messung und
// die Texte stehen nur hier, damit beide nicht auseinanderlaufen.
// Pflichtfelder, Zeitraum-Regel und Rumpf: utils/challengeForm.ts.
//
// Anlegen:    POST /challenges/admin       (baueChallengePayload)
// Bearbeiten: PUT  /challenges/admin/:id
//
// Fehler meldet der Hook über `meldeFehler`: in der App oben (setError), im
// Dialog des Browsers im Fenster selbst. Die Senke heißt bewusst setError --
// an ihr erkennt die Positivliste der Fehlertexte die Aufrufstellen
// (__tests__/utils/bekannteFehlertexte.test.ts).

import { useEffect, useRef, useState } from 'react';
import { fehlerText } from '../../../utils/fehler';
import { useApp } from '../../../contexts/AppContext';
import { useActionGuard } from '../../../hooks/useActionGuard';
import { useZeitgeber } from '../../../hooks/useZeitgeber';
import api from '../../../services/api';
import { trackHandlung, CHALLENGE_SICHTBARKEIT_MESSWERT } from '../../../services/analytics';
import type {
  AdminChallenge,
  ChallengeAudience,
  ChallengeVisibility,
  ChallengeMediaType
} from '../../../types/challenges';
import { getChallengeStatus } from '../views/ChallengesManageView';
import {
  baueChallengePayload,
  istChallengeFormularGueltig,
  audienceFuerFormular,
  istNurTeam,
  zeitraumFehler,
  type ChallengeFormData
} from '../../../utils/challengeForm';

// Teilnahme-Kreis (Migration 121). Drei Zielgruppen (Simon, 27.09.2026 --
// ersetzt den Entscheid vom 09.08.2026, der "nur Konfis" abgeschafft hatte):
// "Konfis, weil wir damit arbeiten und die Teamer das auch sehen muessen."
// Wer eine Challenge sieht, regelt die Zielgruppe mit dem Jahrgang:
// 'nur_team' das ganze Team, sonst Team und Leitung der gewaehlten
// Jahrgaenge (backend/utils/challengeLeitungSicht.js). Bleibt nach dem Start
// eingefroren (wie Sichtbarkeit/Freigabe).
export const AUDIENCE_OPTIONS: { value: ChallengeAudience; label: string; hint: string }[] = [
  {
    value: 'konfis_und_team',
    label: 'Jahrgang und Team',
    hint: 'Die Konfis der gewählten Jahrgänge und ihr im Team — alle reichen gleichberechtigt ein.'
  },
  {
    value: 'konfis',
    label: 'Nur die Konfis',
    hint: 'Die Konfis der gewählten Jahrgänge reichen ein. Ihr im Team seht die Beiträge und begleitet die Challenge, reicht aber selbst nichts ein.'
  },
  {
    value: 'nur_team',
    label: 'Nur das Team',
    hint: 'Eine Runde für euch im Team. Die Konfis sehen diese Challenge nicht, eine Jahrgangs-Auswahl entfällt.'
  }
];

export const VISIBILITY_OPTIONS: { value: ChallengeVisibility; label: string; hint: string }[] = [
  {
    value: 'public',
    label: 'Öffentlich',
    hint: 'Freigegebene Beiträge sind für alle Konfis der zugewiesenen Jahrgänge sichtbar.'
  },
  {
    // Neutral statt "Konfi entscheidet": auch das Team reicht ein und
    // entscheidet dann selbst (Nutzerentscheid 24.08.2026).
    value: 'konfi_choice',
    label: 'Selbst entscheiden',
    hint: 'Wer einreicht, wählt selbst: nur für die Leitung, mit Namen oder anonym.'
  },
  {
    value: 'private',
    label: 'Nur Leitung',
    hint: 'Beiträge sehen nur die Leitung und der Konfi selbst — es gibt keine Galerie.'
  }
];

export const MEDIA_OPTIONS: { value: ChallengeMediaType; label: string; hint: string }[] = [
  { value: 'text', label: 'Text', hint: 'Geschriebene Beiträge' },
  { value: 'photo', label: 'Foto', hint: 'Aufnahme oder Bild aus der Galerie' },
  { value: 'audio', label: 'Audio', hint: 'Sprachaufnahme, direkt aufgenommen' },
  { value: 'video', label: 'Video', hint: 'Videodatei (Upload)' },
  { value: 'link', label: 'Link', hint: 'Verweis auf eine Seite, ein Lied oder ein Video' }
];

/** Höchstlängen der Textfelder: die App begrenzt mit maxlength, der Browser kürzt beim Tippen. */
export const CHALLENGE_GRENZEN = {
  titel: 200,
  urheber: 200,
  stempelName: 100,
} as const;

/** Ein Jahrgang, wie GET /admin/jahrgaenge ihn liefert (der Server zeigt nur die eigenen). */
export interface ChallengeFormularJahrgang {
  id: number;
  name: string;
}

export interface ChallengeManageFormularOptionen {
  /** Die Challenge zum Bearbeiten; leer legt eine neue an. */
  challenge?: AdminChallenge | null;
  /** Nach dem Speichern (Fenster zu, Liste neu laden). */
  onSuccess: () => void;
  /** Meldet den Stand „ungespeicherte Änderungen" nach außen (canDismiss der Seite). */
  onDirtyChange?: (dirty: boolean) => void;
  /**
   * Wohin Prüf- und Speicherfehler gehen. Vorgabe: die Meldung oben
   * (setError). Der Dialog der Web-Fassung zeigt sie in sich selbst.
   */
  meldeFehler?: (meldung: string) => void;
}

// Lokale Zeit im Format, das IonDatetime erwartet (ohne Zeitzonen-Versatz).
// Dieselbe Form liest und liefert das Datumsfeld des Browsers (WebDatum).
const toIonDatetimeISO = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
};

export function useChallengeManageFormular({ challenge, onSuccess, onDirtyChange, meldeFehler }: ChallengeManageFormularOptionen) {
  const { setError: meldungOben } = useApp();
  // Prüf- und Speicherfehler: in der App oben als Meldung, im Dialog der
  // Web-Fassung in ihm selbst. Der Name bleibt setError (siehe Kopf).
  const setError = meldeFehler ?? meldungOben;
  const { isSubmitting, guard } = useActionGuard();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const initializedRef = useRef(false);
  const zeitgeber = useZeitgeber();

  const isEditMode = !!challenge;
  // Nach dem Start sind visibility/moderated/starts_at/allowed_media gesperrt —
  // das Backend antwortet dort mit 409. Entwuerfe und noch nicht gestartete
  // (geplante) Challenges bleiben vollstaendig editierbar.
  // Das Backend liefert `locked` bereits mit — dessen Urteil hat Vorrang, die
  // lokale Ableitung ist nur der Fallback (z.B. bei Offline-Cache ohne Feld).
  const challengeStatus = challenge ? getChallengeStatus(challenge) : null;
  const isStarted = typeof challenge?.locked === 'boolean'
    ? challenge.locked
    : (challengeStatus === 'active' || challengeStatus === 'ended');

  const [jahrgaenge, setJahrgaenge] = useState<ChallengeFormularJahrgang[]>([]);

  // Bewusst OHNE challenge_type: die Typen (Wahrnehmung/Beitrag/Praxis) hatten
  // nie einen funktionalen Effekt und sind aus dem Formular gestrichen
  // (User-Entscheid 07.08.). Die Spalte bleibt im Backend bestehen.
  const [formData, setFormData] = useState<ChallengeFormData>({
    title: '',
    description: '',
    // Standard: das Team ist immer dabei (User-Entscheid 09.08.).
    audience: 'konfis_und_team',
    visibility: 'konfi_choice',
    moderated: true,
    allowed_media: ['text', 'photo'],
    allow_multiple: true,
    badge_icon: 'flag',
    badge_name: '',
    // Urheber ist ein OPTIONALES Freitextfeld (User-Entscheid 06.08.) — die
    // fruehere User-Auswahl war zu lang/komplex fuers Modal. author_user_id
    // wird beim Speichern immer auf null gesetzt, der Name lebt im Freitext.
    author_freetext: '',
    jahrgang_ids: [],
    starts_at: '',
    ends_at: '',
    is_draft: false
  });

  useEffect(() => {
    if (initializedRef.current) setIsDirty(true);
  }, [formData]);

  useEffect(() => { onDirtyChange?.(isDirty); }, [isDirty, onDirtyChange]);

  const loadInitialData = async () => {
    try {
      const jahrgaengeRes = await api.get('/admin/jahrgaenge').catch(() => ({ data: [] }));
      setJahrgaenge(Array.isArray(jahrgaengeRes.data) ? jahrgaengeRes.data : []);
    } catch (err) {
      console.error('Fehler beim Laden der Challenge-Stammdaten:', err);
    }
  };

  useEffect(() => {
    const init = async () => {
      setInitialLoading(true);
      await loadInitialData();
      if (challenge) {
        setFormData({
          title: challenge.title || '',
          description: challenge.description || '',
          audience: audienceFuerFormular(challenge.audience),
          visibility: (challenge.visibility as ChallengeVisibility) || 'konfi_choice',
          moderated: challenge.moderated !== false,
          allowed_media: (challenge.allowed_media as ChallengeMediaType[]) || ['text', 'photo'],
          allow_multiple: challenge.allow_multiple !== false,
          badge_icon: challenge.badge_icon || 'flag',
          badge_name: challenge.badge_name || '',
          // Bestehende User-Urheber flieszen als aufgeloester Name (author_name)
          // in den Freitext ein — es geht beim Umstieg nichts verloren.
          author_freetext: challenge.author_freetext || challenge.author_name || '',
          jahrgang_ids: (challenge.jahrgaenge || []).map((j) => j.id),
          starts_at: challenge.starts_at ? toIonDatetimeISO(new Date(challenge.starts_at)) : '',
          ends_at: challenge.ends_at ? toIonDatetimeISO(new Date(challenge.ends_at)) : '',
          is_draft: challenge.is_draft === true
        });
      } else {
        // Neue Challenge: Start morgen, Ende in zwei Wochen — bewusst runde Zeiten.
        const start = new Date();
        start.setDate(start.getDate() + 1);
        start.setHours(9, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 14);
        end.setHours(20, 0, 0, 0);
        setFormData((prev) => ({
          ...prev,
          starts_at: toIonDatetimeISO(start),
          ends_at: toIonDatetimeISO(end)
        }));
      }
      setInitialLoading(false);
      zeitgeber.nach(100, () => { initializedRef.current = true; });
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge?.id]);

  /** Zielgruppe wählen -- nach dem Start und beim Senden gesperrt. */
  const waehleZielgruppe = (audience: ChallengeAudience) => {
    if (isStarted || loading) return;
    setFormData((prev) => ({ ...prev, audience }));
  };

  /** Sichtbarkeit der Beiträge wählen -- nach dem Start und beim Senden gesperrt. */
  const waehleSichtbarkeit = (visibility: ChallengeVisibility) => {
    if (isStarted || loading) return;
    setFormData((prev) => ({ ...prev, visibility }));
  };

  const toggleMedia = (value: ChallengeMediaType) => {
    if (isStarted || loading) return;
    setFormData((prev) => ({
      ...prev,
      allowed_media: prev.allowed_media.includes(value)
        ? prev.allowed_media.filter((m) => m !== value)
        : [...prev.allowed_media, value]
    }));
  };

  const toggleJahrgang = (id: number) => {
    if (loading) return;
    setFormData((prev) => ({
      ...prev,
      jahrgang_ids: prev.jahrgang_ids.includes(id)
        ? prev.jahrgang_ids.filter((j) => j !== id)
        : [...prev.jahrgang_ids, id]
    }));
  };

  // Pflichtfelder, Zeitraum-Regel und Payload liegen als pure Funktionen in
  // utils/challengeForm (testbar ohne Ionic). Wichtig seit 24.08.2026:
  // Bei Entwürfen ist der Zeitraum KEINE Pflicht mehr.
  const isTeamOnly = istNurTeam(formData);
  const isFormValid = istChallengeFormularGueltig(formData);

  const handleSave = async () => {
    if (!isFormValid) {
      // Der Zeitraum ist nur außerhalb des Entwurfs Pflicht.
      const felder = ['Titel', 'Beschreibung', 'Stempel-Name', 'Medienarten'];
      if (!isTeamOnly) felder.push('Jahrgänge');
      if (!formData.is_draft) felder.push('den Zeitraum');
      setError(`Bitte fülle ${felder.slice(0, -1).join(', ')} und ${felder[felder.length - 1]} aus.`);
      return;
    }
    const zeitFehler = zeitraumFehler(formData);
    if (zeitFehler) {
      setError(zeitFehler);
      return;
    }

    // guard() wirft bei Doppel-Tap ('Aktion läuft bereits'). Ungefangen
    // bliebe loading auf true hängen — dann liess sich das Modal nur
    // noch per Swipe schliessen (User-Hinweis 12.08.).
    try {
      await guard(async () => {
      setLoading(true);
      try {
        const payload = baueChallengePayload(formData, isStarted);
        if (isEditMode && challenge) {
          await api.put(`/challenges/admin/${challenge.id}`, payload);
        } else {
          await api.post('/challenges/admin', payload);
          // Anonyme Messung NACH der erfolgreichen Antwort (docs/messung/umami.md,
          // S6): welche Formen Gemeinden nutzen. Kein Titel, kein Jahrgang.
          trackHandlung('challenge-angelegt', {
            sichtbarkeit: CHALLENGE_SICHTBARKEIT_MESSWERT[formData.visibility],
            freigabe: formData.moderated ? 'true' : 'false'
          });
        }
        setIsDirty(false);
        // Dirty-Stand SYNCHRON melden, bevor onSuccess() über canDismiss schließt
        // (sonst blockiert canDismiss das Schliessen -> doppeltes Anlegen).
        onDirtyChange?.(false);
        onSuccess();
      } catch (err) {
        // 409 = nach Start gesperrtes Feld geändert (Backend erzwingt Konsens-Integritaet)
        setError(fehlerText(err, 'Fehler beim Speichern der Challenge'));
      } finally {
        setLoading(false);
      }
      });
    } catch {
      // Zweiter Aufruf verworfen — Ladezustand sicher zuruecknehmen.
      setLoading(false);
    }
  };

  return {
    formData,
    setFormData,
    jahrgaenge,
    /** Es wird gespeichert (Felder gesperrt). */
    loading,
    isSubmitting,
    /** Jahrgänge und Vorbelegung laden noch. */
    initialLoading,
    isDirty,
    isEditMode,
    /** Gestartet: Zielgruppe, Sichtbarkeit, Freigabe, Medienarten und Start sind gesperrt. */
    isStarted,
    isTeamOnly,
    /** Der Haken der App ist nur frei, wenn das stimmt. */
    isFormValid,
    waehleZielgruppe,
    waehleSichtbarkeit,
    toggleMedia,
    toggleJahrgang,
    handleSave,
  };
}

export type ChallengeManageFormularZustand = ReturnType<typeof useChallengeManageFormular>;
