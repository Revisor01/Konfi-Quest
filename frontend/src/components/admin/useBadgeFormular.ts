// Badge anlegen und bearbeiten -- als Logik ohne Darstellung (11.10.2026,
// Simon: „Web braucht eigene kompaktere Modale überall"). Das App-Modal
// (modals/BadgeManagementModal) und der Dialog der Web-Fassung
// (web/start/WebBadgeFormular) zeigen dieselbe Logik: Laden, Vorbelegung,
// Kriterien je Zielgruppe, Speichern mit Warteschlange, „Badge neu prüfen".
//
// Unterschied nur in der Rueckmeldung: Die App meldet Fehler oben (setError)
// und Erfolge als Toast (setSuccess), der Web-Dialog beides im Formular
// (`fehlerImFormular`): Fehler mit dem Satz des Servers zur Pruefung („Bitte
// einen Zeitraum angeben") statt nur „Validierungsfehler", das Ergebnis von
// „Badge neu prüfen" als `meldung` -- dort, wo die Eingabe ist, und gerade
// dabei bleibt der Dialog offen (bis 12.10.2026 lag ein Toast zudem unter
// dem Dialog). Was erst nach dem Schliessen kommt (die Warteschlange), geht
// weiter als Toast.

import { useEffect, useRef, useState } from 'react';
import { useActionGuard } from '../../hooks/useActionGuard';
import { useZeitgeber } from '../../hooks/useZeitgeber';
import { useApp } from '../../contexts/AppContext';
import api from '../../services/api';
import { writeQueue } from '../../services/writeQueue';
import { networkMonitor } from '../../services/networkMonitor';
import { trackHandlung } from '../../services/analytics';
import { safeUUID } from '../../utils/uuid';
import { sendenOderEinreihen } from '../../utils/sendenOderEinreihen';
import { fehlerText } from '../../utils/fehler';
import { getCriteriaColor as getCategoryColor, CRITERIA_FALLBACK_COLOR } from '../../utils/badgeCriteria';
import type { BadgeKriteriumExtra } from '../../utils/badgeCriteria';

export interface BadgeAktivitaet {
  id: number;
  name: string;
  type: 'gottesdienst' | 'gemeinde';
  categories?: BadgeKategorie[];
}

export interface BadgeKategorie {
  id: number;
  name: string;
}

/**
 * Ein waehlbarer Kriterientyp aus GET /admin/badges/criteria-types
 * (CRITERIA_TYPES in backend/routes/badges.js): kurze Bezeichnung, ein Satz
 * dazu und der ausfuehrliche Hilfetext mit Beispiel.
 */
export interface KriteriumTyp {
  label: string;
  description: string;
  help: string;
}

/**
 * Die Zusatzangaben, WIE SIE IM FORMULAR stehen.
 *
 * Bewusst nicht BadgeKriteriumExtra: Das Formular arbeitet mit `weeks`,
 * gespeichert wird daraus `days` (weeks * 7, siehe handleSave).
 */
export interface ExtraKriteriumFormular {
  activity_id?: number;
  activity_ids?: number[];
  required_category?: string;
  /** category_combination: mehrere Kategorienamen (die Auswahl arbeitet hier
   *  direkt mit Namen — die Wertung im Backend liest ebenfalls Namen). */
  required_categories?: string[];
  weeks?: number;
}

export type BadgeZielgruppe = 'konfi' | 'teamer';

export interface BadgeFormularDaten {
  name: string;
  icon: string;
  description: string;
  criteria_type: string;
  criteria_value: number;
  criteria_extra: string;
  is_active: boolean;
  is_hidden: boolean;
  color: string;
  target_role: BadgeZielgruppe;
}

// Punkte-basierte Kriterien - bei Teamer ausblenden
export const POINTS_CRITERIA_TYPES = ['total_points', 'gottesdienst_points', 'gemeinde_points', 'both_categories', 'bonus_points'];
export const TEAMER_HIDDEN_TYPES = [...POINTS_CRITERIA_TYPES, 'time_based', 'streak', 'event_count', 'mandatory_event_count'];

/** Der Zeitraum, den das Formular zeigt, solange niemand einen gewaehlt hat. */
export const STANDARD_WOCHEN = 4;
export const WOCHEN_MAX = 26;

/**
 * Hoechstwert des Wert-Reglers. Normalfall 20, waechst aber mit, wenn ein
 * bestehendes Abzeichen darueber liegt: In Produktion gibt es Abzeichen mit
 * 25, 26 und 30 (nachgemessen 25.08.2026, vier Organisationen betroffen) —
 * das Backend kennt keine Obergrenze, nur der Regler. Ohne das Mitwachsen
 * klemmt Ionic den Wert beim ersten Anfassen auf 20 herunter (ionChange ->
 * ensureValueInBounds), und das Abzeichen ginge schlagartig an alle mit
 * 20 Punkten — nicht rueckholbar, da es keinen Entzug gibt.
 */
export const reglerMaximum = (criteriaValue: number | undefined | null): number => Math.max(20, criteriaValue || 0);

/** Die Bezeichnung eines Kriterientyps ohne Emoji (der Server liefert teils welche). */
export const ohneEmoji = (label: string): string =>
  label.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();

/** Die Beschriftung des Wertes je Kriterientyp. */
export const wertBeschriftung = (criteriaType: string): string => {
  switch (criteriaType) {
    case 'total_points':
    case 'gottesdienst_points':
    case 'gemeinde_points':
    case 'both_categories':
    case 'bonus_points':
      return 'Punkte';
    case 'specific_activity':
      return 'Anzahl (Spezifische Aktivität)';
    case 'activity_count':
      return 'Anzahl (Aktivitäten & Events)';
    case 'event_count':
      return 'Anzahl (Events)';
    case 'mandatory_event_count':
      return 'Anzahl (Pflicht-Events)';
    case 'category_activities':
      return 'Anzahl (Kategorie-Aktivitäten & Events)';
    case 'category_combination':
      return 'Aus wie vielen der angekreuzten Kategorien?';
    case 'unique_activities':
      return 'Anzahl (Verschiedene Aktivitäten)';
    case 'streak':
      return 'Anzahl (Aufeinanderfolgende Wochen)';
    case 'time_based':
      return 'Anzahl (Aktivitäten & Events im Zeitraum)';
    case 'teamer_year':
      return 'Anzahl (Aktive Jahre als Teamer:in)';
    default:
      return 'Wert';
  }
};

/** Die Vorgabe des Wertes, wenn ein Kriterientyp gewaehlt wird. */
export const standardWert = (criteriaType: string): number => {
  if (criteriaType === 'activity_count' || criteriaType === 'unique_activities' ||
      criteriaType === 'specific_activity' || criteriaType === 'category_activities' ||
      criteriaType === 'event_count') {
    return 5;
  }
  if (criteriaType === 'activity_combination' || criteriaType === 'category_combination') return 3;
  if (criteriaType === 'streak') return 4;
  return 10;
};

/** Steht der Kriterientyp der Zielgruppe zur Wahl? (Teamer: keine Punkte; teamer_year nur Teamer.) */
export const kriteriumWaehlbar = (criteriaType: string, zielgruppe: BadgeZielgruppe): boolean => {
  if (zielgruppe === 'teamer' && TEAMER_HIDDEN_TYPES.includes(criteriaType)) return false;
  if (criteriaType === 'teamer_year' && zielgruppe !== 'teamer') return false;
  return true;
};

/**
 * Gottesdienst/Gemeinde gibt es NUR bei Konfis — bei Teamer-Aktivitäten ist
 * `type` bedeutungslos und wuerde als Untertitel nur in die Irre fuehren
 * (User-Hinweis 11.08.). Deshalb dort keiner.
 */
export const aktivitaetArt = (activity: BadgeAktivitaet, zielgruppe: BadgeZielgruppe): string | null =>
  zielgruppe === 'teamer' ? null : activity.type === 'gottesdienst' ? 'Gottesdienst' : 'Gemeinde';

/**
 * Prueft eine getippte ganze Zahl von 1 bis `max` (Web-Dialog: der Wert und
 * der Zeitraum sind dort Zahlenfelder statt Regler). Liefert die Meldung oder
 * null.
 */
export const zahlFehler = (eingabe: string, max: number, was: string): string | null => {
  const text = eingabe.trim();
  const zahl = Number(text);
  if (text === '' || !Number.isInteger(zahl) || zahl < 1 || zahl > max) {
    return `Bitte bei „${was}“ eine ganze Zahl von 1 bis ${max} eintragen.`;
  }
  return null;
};

/** Der Satz des Servers zur Pruefung (details[0].message), sonst dessen `error`, sonst der Ersatz. */
const serverSatz = (err: unknown, ersatz: string): string => {
  const daten = (typeof err === 'object' && err !== null ? (err as { response?: { data?: { details?: unknown } } }).response?.data : undefined);
  const details = daten?.details;
  if (Array.isArray(details)) {
    const erster = details.find((d): d is { message: string } => typeof d === 'object' && d !== null && typeof (d as { message?: unknown }).message === 'string' && (d as { message: string }).message.trim() !== '');
    if (erster) return erster.message;
  }
  return fehlerText(err, ersatz);
};

export interface BadgeFormularOptionen {
  badgeId?: number | null;
  targetRole?: BadgeZielgruppe;
  onSuccess: () => void;
  // Meldet den "ungespeicherte Änderungen"-Stand nach aussen, damit die
  // praesentierende Seite über canDismiss auch Swipe/Backdrop-Schliessen abfangen kann.
  onDirtyChange?: (dirty: boolean) => void;
  // Laedt nur die Badge-Liste neu, OHNE das Formular zu schliessen (anders als
  // onSuccess). Gebraucht nach "Abzeichen neu pruefen", damit earned_count
  // stimmt, waehrend der Admin im Formular bleibt.
  onRefreshList?: () => void;
  /**
   * Web-Dialog: Fehler (`fehler`) und das Ergebnis von „Badge neu prüfen"
   * (`meldung`) im Formular zeigen statt oben (setError) bzw. als Toast
   * (setSuccess).
   */
  fehlerImFormular?: boolean;
}

export function useBadgeFormular({
  badgeId,
  targetRole = 'konfi',
  onSuccess,
  onDirtyChange,
  onRefreshList,
  fehlerImFormular = false,
}: BadgeFormularOptionen) {
  const { user, setSuccess, setError: setMeldungOben } = useApp();
  const { isSubmitting, guard } = useActionGuard();
  const [loading, setLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  // Nur admin/org_admin duerfen den Knopf "Abzeichen neu pruefen" sehen bzw.
  // druecken (Route POST /admin/badges/:id/pruefen: requireAdmin).
  const darfPruefen = user?.role_name === 'admin' || user?.role_name === 'org_admin';
  const [pruefLoading, setPruefLoading] = useState(false);
  const initializedRef = useRef(false);
  const zeitgeber = useZeitgeber();
  const [fehler, setFehler] = useState<string | null>(null);
  // Web-Dialog: das Ergebnis von „Badge neu prüfen", solange der Dialog offen
  // bleibt (die App zeigt es als Toast).
  const [meldung, setMeldung] = useState<string | null>(null);

  /**
   * Eine Meldung dort, wo die Fassung sie zeigt: App oben, Web im Formular.
   * Heisst bewusst setError: Die Positivliste der Fehlertexte
   * (bekannteFehlertexte.test.ts) liest die festen Texte an setError-Aufrufen.
   */
  const setError = (text: string) => {
    if (fehlerImFormular) setFehler(text);
    else setMeldungOben(text);
  };

  // isDirty-Stand nach aussen melden (für canDismiss der praesentierenden Seite).
  useEffect(() => { onDirtyChange?.(isDirty); }, [isDirty, onDirtyChange]);

  // Form data
  const defaultCriteriaType = targetRole === 'teamer' ? 'activity_count' : 'total_points';
  const [formData, setFormDataRoh] = useState<BadgeFormularDaten>({
    name: '',
    icon: 'trophy',
    description: '',
    criteria_type: defaultCriteriaType,
    criteria_value: targetRole === 'teamer' ? 5 : 10,
    criteria_extra: '{}',
    is_active: true,
    is_hidden: false,
    color: getCategoryColor(defaultCriteriaType),
    target_role: targetRole
  });
  // Der Wert beim Oeffnen (neu: die Vorgabe, bearbeiten: der gespeicherte).
  // Der Web-Dialog nimmt daraus seine Obergrenze wie die App ihren Regler.
  const [startWert, setStartWert] = useState(formData.criteria_value);

  // Geaendert seit dem Laden -- sofort beim Aendern gesetzt, nicht erst im
  // Effekt nach dem naechsten Zeichnen (isDirty). Der Web-Dialog fragt beim
  // Schliessen danach: Wer tippt und gleich Escape drueckt, kaeme sonst ohne
  // Rueckfrage heraus. Anders als isDirty zaehlt hier auch die Auswahl
  // (Aktivitaet, Kategorien, Zeitraum).
  const geaendertRef = useRef(false);

  /** Jede Aenderung am Formular nimmt eine alte Meldung im Formular weg. */
  const setFormData = (daten: BadgeFormularDaten) => {
    if (initializedRef.current) geaendertRef.current = true;
    setFehler(null);
    setMeldung(null);
    setFormDataRoh(daten);
  };

  // isDirty nach Initialisierung bei jeder formData-Änderung setzen
  useEffect(() => {
    if (initializedRef.current) {
      setIsDirty(true);
    }
  }, [formData]);

  // Available data for dropdowns
  const [activities, setActivities] = useState<BadgeAktivitaet[]>([]);
  const [categories, setCategories] = useState<BadgeKategorie[]>([]);
  const [criteriaTypes, setCriteriaTypes] = useState<Record<string, KriteriumTyp>>({});

  // Additional form fields for complex criteria
  const [extraCriteria, setExtraCriteriaRoh] = useState<ExtraKriteriumFormular>({});
  const setExtraCriteria = (extra: ExtraKriteriumFormular) => {
    if (initializedRef.current) geaendertRef.current = true;
    setFehler(null);
    setMeldung(null);
    setExtraCriteriaRoh(extra);
  };

  const isEditMode = !!badgeId;

  const [initialDataLoading, setInitialDataLoading] = useState(true);
  // Bearbeiten: Das Badge selbst ist da (der Web-Dialog zeigt das Formular
  // erst dann, sonst stuende kurz die Vorbelegung eines neuen Badges da).
  const [badgeStand, setBadgeStand] = useState<'offen' | 'da' | 'fehlt'>('offen');

  const loadInitialData = async (): Promise<BadgeAktivitaet[]> => {
    let geladen: BadgeAktivitaet[] = [];
    try {
      setInitialDataLoading(true);

      // Aktivitäten NUR aus der Zielgruppe des Badges: ein Teamer-Badge darf
      // nicht auf Konfi-Aktivitäten verweisen (und umgekehrt) — die Wertung in
      // badges.js zählt ohnehin nur die passende target_role.
      const activitiesResponse = await api.get(`/admin/activities?target_role=${targetRole}`);
      geladen = Array.isArray(activitiesResponse.data) ? activitiesResponse.data : [];
      setActivities(geladen);

      // Load categories
      const categoriesResponse = await api.get('/admin/categories');
      setCategories(Array.isArray(categoriesResponse.data) ? categoriesResponse.data : []);

      // Load criteria types
      const criteriaResponse = await api.get('/admin/badges/criteria-types');
      setCriteriaTypes(criteriaResponse.data || {});
    } catch (err) {
      console.error('Error loading initial data:', err);
      setError('Fehler beim Laden der Badge-Daten');
    } finally {
      setInitialDataLoading(false);
    }
    return geladen;
  };

  const loadBadge = async (geladeneAktivitaeten: BadgeAktivitaet[]) => {
    if (!badgeId) return;

    setLoading(true);
    try {
      const response = await api.get(`/admin/badges/${badgeId}`);
      const badge = response.data;

      if (badge) {
        // Parse extra criteria FIRST (kann doppelt escaped sein: "{\"days\":30}")
        let extra: BadgeKriteriumExtra = {};
        try {
          let parsed = badge.criteria_extra;
          if (typeof parsed === 'string') {
            parsed = JSON.parse(parsed || '{}');
          }
          // Falls nach dem ersten Parse immer noch ein String (doppelt escaped)
          if (typeof parsed === 'string') {
            parsed = JSON.parse(parsed);
          }
          extra = parsed || {};
        } catch (e) {
          console.error('Error parsing criteria_extra:', e);
          extra = {};
        }

        // time_based: DB speichert "days", Modal nutzt "weeks" - umrechnen
        if (badge.criteria_type === 'time_based' && extra.days && !extra.weeks) {
          extra.weeks = Math.round(extra.days / 7) || 1;
        }

        // Aktivitäten: DB speichert NAMEN, die Auswahl arbeitet mit IDs.
        // Ohne diese Rueckuebersetzung stünde die Auswahl beim Bearbeiten
        // leer da und ein Speichern wuerde die Angabe löschen.
        // activity_id/activity_ids werden weiter gelesen: Badges aus der Zeit
        // vor dem Fix (23.08.2026) tragen noch die alten Schlüssel.
        if (badge.criteria_type === 'specific_activity' && !extra.activity_id) {
          const treffer = geladeneAktivitaeten.find(a => a.name === extra.required_activity_name);
          if (treffer) extra.activity_id = treffer.id;
        }
        if (badge.criteria_type === 'activity_combination' && !extra.activity_ids) {
          const ids = (extra.required_activities || [])
            .map((name: string) => geladeneAktivitaeten.find(a => a.name === name)?.id)
            .filter((id: number | undefined): id is number => id !== undefined);
          if (ids.length > 0) extra.activity_ids = ids;
        }

        const newFormData: BadgeFormularDaten = {
          name: badge.name || '',
          icon: badge.icon || 'trophy-outline',
          description: badge.description || '',
          criteria_type: badge.criteria_type || 'total_points',
          criteria_value: badge.criteria_value || 10,
          criteria_extra: badge.criteria_extra || '{}',
          is_active: badge.is_active !== undefined ? badge.is_active : true,
          is_hidden: badge.is_hidden !== undefined ? badge.is_hidden : false,
          // MUSS ein Hex-Wert bleiben: der Wert landet in <input type="color">
          // und wird so in der Datenbank gespeichert. Eine CSS-Variable ist
          // dort ungueltig (Regression vom 11.08., wieder zurückgenommen).
          color: badge.color || CRITERIA_FALLBACK_COLOR,
          target_role: badge.target_role || targetRole
        };

        setFormDataRoh(newFormData);
        setStartWert(newFormData.criteria_value);
        setExtraCriteriaRoh(extra);
        setBadgeStand('da');
      } else {
        setBadgeStand('fehlt');
      }
    } catch (err) {
      setBadgeStand('fehlt');
      setError('Fehler beim Laden des Badges');
      console.error('Error loading badge:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      // Die Liste geht als Wert weiter, nicht ueber den Zustand: Dieser Effekt
      // sieht den Stand seines Renders, und dort waere sie noch leer.
      const geladen = await loadInitialData();
      if (isEditMode) {
        await loadBadge(geladen);
      }
      zeitgeber.nach(100, () => { initializedRef.current = true; });
    };
    init();
  }, [badgeId]);

  const handleSave = async () => {
    setMeldung(null);
    if (!formData.name.trim()) {
      setError('Name ist erforderlich');
      return;
    }

    // guard() wirft, wenn bereits ein Speichern läuft ("Aktion läuft
    // bereits"). Ohne dieses catch flog der Fehler ungefangen nach oben —
    // und weil setLoading(true) INNERHALB des Guards steht, blieb loading
    // dann auf true hängen. Der X-Button ist mit disabled={loading}
    // verknuepft und liess sich danach nicht mehr druecken, während der
    // Swipe weiter ging (User-Hinweis 12.08.).
    try {
      await guard(async () => {
        setLoading(true);
        try {
          // Prepare criteria_extra based on criteria_type
          let criteriaExtra = {};

          // Die Auswahl arbeitet intern mit IDs, gespeichert werden aber NAMEN:
          // Das Backend wertet `required_activity_name` bzw. `required_activities`
          // über activities.name aus (badges.js:216,227). Vorher schrieb das
          // Formular activity_id/activity_ids — diese Badges wurden nie vergeben,
          // weil der Schlüssel serverseitig gar nicht gelesen wird
          // (Befund 23.08.2026, in Produktion nachgewiesen).
          switch (formData.criteria_type) {
            case 'specific_activity': {
              const gewaehlt = activities.find(a => a.id === extraCriteria.activity_id);
              if (gewaehlt) {
                criteriaExtra = { required_activity_name: gewaehlt.name };
              }
              break;
            }
            case 'category_activities':
              if (extraCriteria.required_category) {
                criteriaExtra = { required_category: extraCriteria.required_category };
              }
              break;
            case 'category_combination': {
              // Anders als bei den Aktivitaeten wird hier KEIN ID-Umweg gegangen:
              // Die Wertung liest Kategorienamen (categories.name), und die
              // Auswahl haelt sie schon als Namen.
              const kategorien = [...new Set(extraCriteria.required_categories || [])];
              if (kategorien.length > 0) {
                criteriaExtra = { required_categories: kategorien };
              }
              break;
            }
            case 'time_based':
              // Was das Formular zeigt, geht mit: ohne eigene Wahl die
              // angezeigten STANDARD_WOCHEN (vorher fehlte der Zeitraum dann,
              // und der Server lehnte ab).
              criteriaExtra = { days: (extraCriteria.weeks || STANDARD_WOCHEN) * 7 };
              break;
            case 'activity_combination': {
              const namen = (extraCriteria.activity_ids || [])
                .map((id: number) => activities.find(a => a.id === id)?.name)
                .filter(Boolean);
              if (namen.length > 0) {
                criteriaExtra = { required_activities: namen };
              }
              break;
            }
          }

          const badgeData = {
            ...formData,
            criteria_extra: criteriaExtra
          };

          // Bearbeiten (PUT) faellt auch bei einem Netzabbruch im Online-Zweig in
          // die Warteschlange; Anlegen (POST ohne Idempotenzschluessel) nur
          // offline -- nach einem Abbruch bleibt es dort beim Fehler, sonst
          // entstuende der Eintrag womoeglich doppelt (utils/sendenOderEinreihen.ts,
          // Audit Grundgeruest BF-01).
          const { weg } = await sendenOderEinreihen({
            online: networkMonitor.isOnline,
            methode: isEditMode ? 'PUT' : 'POST',
            senden: () => (isEditMode
              ? api.put(`/admin/badges/${badgeId}`, badgeData)
              : api.post('/admin/badges', badgeData)),
            einreihen: () => (isEditMode
              ? writeQueue.enqueue({
                method: 'PUT',
                url: `/admin/badges/${badgeId}`,
                body: badgeData,
                maxRetries: 5,
                hasFileUpload: false,
                metadata: { type: 'admin', clientId: safeUUID(), label: 'Badge bearbeiten' },
              })
              : writeQueue.enqueue({
                method: 'POST',
                url: '/admin/badges',
                body: badgeData,
                maxRetries: 5,
                hasFileUpload: false,
                metadata: { type: 'admin', clientId: safeUUID(), label: 'Badge erstellen' },
              })),
          });
          if (weg === 'eingereiht') {
            setSuccess(isEditMode
              ? 'Badge wird aktualisiert sobald du wieder online bist'
              : 'Badge wird erstellt sobald du wieder online bist');
          } else if (!isEditMode) {
            // Anonyme Messung NACH der erfolgreichen Antwort (docs/messung/umami.md,
            // S5): Pflegen Gemeinden eigene Badges? Kein Name, keine Bedingung.
            // Bearbeiten zaehlt nicht, offline Angelegtes erst beim Nachsenden.
            trackHandlung('badge-angelegt', { zielgruppe: formData.target_role });
          }

          setIsDirty(false);
          geaendertRef.current = false;
          // WICHTIG: Dirty-Stand SYNCHRON nach aussen melden, bevor onSuccess() das Modal
          // über dismiss()/canDismiss schließt. Sonst sieht canDismiss noch isDirty=true,
          // blockiert das programmatische Schliessen -> Modal bleibt offen, erneutes
          // Speichern legt das Badge mehrfach an.
          onDirtyChange?.(false);
          onSuccess();
        } catch (err) {
          if (fehlerImFormular) setFehler(serverSatz(err, 'Fehler beim Speichern des Badges'));
          else setError(fehlerText(err, 'Fehler beim Speichern des Badges'));
        } finally {
          setLoading(false);
        }
      });
    } catch {
      // Doppelklick auf Speichern — der zweite Aufruf wird verworfen.
      // Nichts anzeigen, aber den Ladezustand sicher zuruecknehmen.
      setLoading(false);
    }
  };

  // "Abzeichen neu pruefen": holt die Vergabe fuer alle Personen der
  // Zielrolle in der eigenen Organisation nach (POST /admin/badges/:id/pruefen).
  // Fuer Sonderfaelle gedacht (Datenlage hat sich geaendert) — Speichern loest
  // die Pruefung inzwischen ohnehin automatisch aus.
  const handlePruefen = async () => {
    if (!badgeId) return;
    setPruefLoading(true);
    setMeldung(null);
    // App: als Toast. Web-Dialog: im Formular -- er bleibt offen, und der
    // Toast laege unter ihm.
    const ergebnis = (text: string) => {
      if (fehlerImFormular) setMeldung(text);
      else setSuccess(text);
    };
    try {
      const res = await api.post(`/admin/badges/${badgeId}/pruefen`);
      const neuVergeben = res.data?.neu_vergeben ?? 0;
      if (neuVergeben > 0) {
        ergebnis(neuVergeben === 1 ? '1 Badge neu vergeben' : `${neuVergeben} Badges neu vergeben`);
        onRefreshList?.();
      } else {
        ergebnis('Alle Badges sind aktuell');
      }
    } catch (err) {
      setError(fehlerText(err, 'Fehler bei der Prüfung des Badges'));
    } finally {
      setPruefLoading(false);
    }
  };

  /** Zielgruppe eines neuen Badges: setzt Kriterium, Wert und Farbe auf die Vorgabe der Gruppe. */
  const waehleZielgruppe = (rolle: BadgeZielgruppe) => {
    if (loading) return;
    if (rolle === 'konfi') {
      setFormData({ ...formData, target_role: 'konfi', criteria_type: 'total_points', criteria_value: 10, color: getCategoryColor('total_points') });
    } else {
      setFormData({ ...formData, target_role: 'teamer', criteria_type: 'activity_count', criteria_value: 5, color: getCategoryColor('activity_count') });
    }
  };

  /**
   * Ein Kriterientyp: Wert auf seine Vorgabe, Zusatzangaben leer. Die Farbe
   * zieht mit, solange sie die Standardfarbe des alten Typs (oder der
   * Rueckfall) war -- eine selbst gewaehlte bleibt.
   */
  const waehleKriterium = (value: string) => {
    if (loading) return;
    const currentCategoryColor = getCategoryColor(formData.criteria_type);
    const newColor = (formData.color === currentCategoryColor || formData.color === CRITERIA_FALLBACK_COLOR)
      ? getCategoryColor(value)
      : formData.color;
    setFormData({ ...formData, criteria_type: value, criteria_value: standardWert(value), color: newColor });
    setExtraCriteria({});
  };

  const waehleAktivitaet = (id: number) => {
    if (loading) return;
    setExtraCriteria({ ...extraCriteria, activity_id: id });
  };

  const waehleKategorie = (name: string) => {
    if (loading) return;
    setExtraCriteria({ ...extraCriteria, required_category: name });
  };

  /**
   * Die angekreuzten Kategorien (category_combination). "4 aus 3" kann
   * niemand erreichen — das Backend lehnt es ab. Statt die Speichern-Meldung
   * abzuwarten, zieht der Wert mit, sobald er groesser waere.
   */
  const setzeKategorienKombi = (neueAuswahl: string[]) => {
    setExtraCriteria({ ...extraCriteria, required_categories: neueAuswahl });
    if (neueAuswahl.length > 0 && formData.criteria_value > neueAuswahl.length) {
      setFormData({ ...formData, criteria_value: neueAuswahl.length });
    }
  };

  const kategorieKombiUmschalten = (name: string) => {
    if (loading) return;
    const gewaehlteKategorien = extraCriteria.required_categories || [];
    const neueAuswahl = gewaehlteKategorien.includes(name)
      ? gewaehlteKategorien.filter((n: string) => n !== name)
      : [...gewaehlteKategorien, name];
    setzeKategorienKombi(neueAuswahl);
  };

  const setzeAktivitaetenKombi = (ids: number[]) => {
    setExtraCriteria({ ...extraCriteria, activity_ids: ids });
  };

  const aktivitaetKombiUmschalten = (id: number) => {
    const currentIds = extraCriteria.activity_ids || [];
    setzeAktivitaetenKombi(currentIds.includes(id)
      ? currentIds.filter((x: number) => x !== id)
      : [...currentIds, id]);
  };

  const setzeWochen = (wochen: number) => {
    setExtraCriteria({ ...extraCriteria, weeks: wochen });
  };

  /** Die Kriterientypen zur Wahl, in der Reihenfolge des Servers. */
  const kriterienZurWahl = Object.entries(criteriaTypes)
    .filter(([value]) => kriteriumWaehlbar(value, formData.target_role));

  return {
    isEditMode,
    darfPruefen,
    loading,
    /** Alles geladen, was das Formular braucht (neu: Listen; bearbeiten: dazu das Badge). */
    bereit: !initialDataLoading && (!isEditMode || badgeStand === 'da'),
    /** Bearbeiten: Das Badge liess sich nicht laden. */
    ladeFehler: isEditMode && badgeStand === 'fehlt',
    initialDataLoading,
    isSubmitting,
    pruefLoading,
    isDirty,
    /** Seit dem Laden etwas geaendert? Liest den Stand im Moment des Aufrufs (Web-Dialog: Rueckfrage beim Schliessen). */
    hatAenderungen: () => geaendertRef.current,
    formData,
    setFormData,
    extraCriteria,
    activities,
    categories,
    criteriaTypes,
    kriterienZurWahl,
    reglerMax: reglerMaximum(formData.criteria_value),
    startWert,
    valueLabel: wertBeschriftung(formData.criteria_type),
    standardFarbe: getCategoryColor(formData.criteria_type),
    fehler,
    /** Web-Dialog: das Ergebnis von „Badge neu prüfen" (die App zeigt es als Toast). */
    meldung,
    melden: setError,
    handleSave,
    handlePruefen,
    waehleZielgruppe,
    waehleKriterium,
    waehleAktivitaet,
    waehleKategorie,
    setzeKategorienKombi,
    kategorieKombiUmschalten,
    setzeAktivitaetenKombi,
    aktivitaetKombiUmschalten,
    setzeWochen,
  };
}

export type BadgeFormularZustand = ReturnType<typeof useBadgeFormular>;
