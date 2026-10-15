// Eine Aktivität des Katalogs anlegen oder bearbeiten (/admin/activities) --
// die Logik des Formulars ohne Darstellung: Laden der Kategorien und der
// Aktivität, Vorbelegung, Zielgruppe, Speichern (mit Warteschlange) und die
// Meldungen. Die App zeigt sie im Modal modals/ActivityManagementModal, der
// Browser ab 992 px im Dialog web/leitung/WebAktivitaetKatalogDialog (Simon,
// 15.10.2026: jedes Formular, das im Browser noch ein Modal der App öffnet,
// bekommt ein kompaktes Fenster der Web-Fassung; in den Apps und unter 992 px
// bleibt das Modal, wie es ist).
//
// Aus ActivityManagementModal herausgezogen (15.10.2026): Felder, Routen,
// Rümpfe und Texte unverändert. Unterschied je Fassung nur in der
// Rückmeldung: Die App meldet Fehler oben (setError), der Dialog des Browsers
// in sich selbst (`fehlerImDialog`). Was erst nach dem Schließen kommt (die
// Warteschlange ohne Netz), geht in beiden als Meldung oben.
//
// Ungespeicherte Änderungen: `isDirty` steht, sobald jemand etwas ändert --
// gesetzt beim Ändern selbst. Bis 15.10.2026 setzte es ein Effekt auf
// formData, scharf erst 100 ms nach dem Laden; was in der Zeit geändert
// wurde, zählte nicht.

import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useActionGuard } from '../../hooks/useActionGuard';
import api from '../../services/api';
import { writeQueue } from '../../services/writeQueue';
import { networkMonitor } from '../../services/networkMonitor';
import { safeUUID } from '../../utils/uuid';
import { sendenOderEinreihen } from '../../utils/sendenOderEinreihen';
import { fehlerText } from '../../utils/fehler';

export type KatalogZielgruppe = 'konfi' | 'teamer';

export interface KatalogKategorie {
  id: number;
  name: string;
  description?: string;
  type?: 'activity' | 'event' | 'both' | null;
}

export interface KatalogAktivitaet {
  id: number;
  name: string;
  points: number;
  // null ist moeglich und kommt vor: in Produktion tragen zwei Aktivitaeten
  // keinen Punkttyp (nachgemessen 30.08.2026).
  type: 'gottesdienst' | 'gemeinde' | null;
  categories?: KatalogKategorie[];
  target_role?: KatalogZielgruppe;
}

export interface KatalogFormularDaten {
  name: string;
  points: number;
  /** '' heißt „kein Typ" (Team-Aktivitäten, zwei Altbestände). */
  type: string;
  category_ids: number[];
  target_role: KatalogZielgruppe;
}

/** Die Punkte, die der Regler der App anbietet; der Browser zeigt dieselben Stufen. */
export const KATALOG_PUNKTE_MIN = 1;
export const KATALOG_PUNKTE_MAX = 5;

/** Der Hinweis, wenn die Aktivität dem Team gilt -- in App und Browser derselbe Satz. */
export const TEAM_OHNE_PUNKTE = 'Aktivitäten fürs Team haben keine Punkte und keinen Typ.';

const neu = (rolle: KatalogZielgruppe): KatalogFormularDaten => ({
  name: '',
  points: rolle === 'teamer' ? 0 : 1,
  type: rolle === 'teamer' ? '' : 'gottesdienst',
  category_ids: [],
  target_role: rolle,
});

// Das Formular kennt "kein Typ" als leeren String, die Daten als null (zwei
// Aktivitaeten in Produktion, nachgemessen 30.08.2026). Umgesetzt wird an der
// Grenze, damit die Auswahl nicht auf null laeuft.
const vorbelegen = (aktivitaet: KatalogAktivitaet, rolle: KatalogZielgruppe): KatalogFormularDaten => ({
  name: aktivitaet.name,
  points: aktivitaet.points,
  type: aktivitaet.type ?? '',
  category_ids: aktivitaet.categories?.map((k) => k.id) || [],
  target_role: aktivitaet.target_role || rolle,
});

export interface AktivitaetKatalogOptionen {
  /** Die Aktivität aus der Liste (Vorbelegung, falls keine Kennung kommt). */
  activity?: KatalogAktivitaet | null;
  /** Bearbeiten: die Aktivität wird frisch geladen (GET /admin/activities). */
  activityId?: number | null;
  /** Die Gruppe der Liste: Vorgabe der Zielgruppe einer neuen Aktivität. */
  targetRole?: KatalogZielgruppe;
  /** Gespeichert (auch eingereiht). */
  onSuccess: () => void;
  /** Meldungen im Fenster zeigen (`fehler`; Dialog des Browsers) statt oben (App). */
  fehlerImDialog?: boolean;
}

export function useAktivitaetKatalogFormular({
  activity,
  activityId,
  targetRole = 'konfi',
  onSuccess,
  fehlerImDialog = false,
}: AktivitaetKatalogOptionen) {
  const { setSuccess, setError: setMeldungOben, isOnline } = useApp();
  const { isSubmitting, guard } = useActionGuard();
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [categories, setCategories] = useState<KatalogKategorie[]>([]);
  const [currentActivity, setCurrentActivity] = useState<KatalogAktivitaet | null>(activity || null);
  const [formData, setFormData] = useState<KatalogFormularDaten>(() => neu(targetRole));
  const [isDirty, setIsDirty] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  /**
   * Eine Meldung dort, wo die Fassung sie zeigt: App oben, Browser im Dialog.
   * Heißt bewusst setError: Die Positivliste der Fehlertexte
   * (bekannteFehlertexte.test.ts) liest die festen Texte an setError-Aufrufen.
   */
  const setError = (text: string) => {
    if (fehlerImDialog) setFehler(text);
    else setMeldungOben(text);
  };
  // Das Laden unten läuft in einem Effekt; es meldet über den jeweils
  // neuesten Rückruf, ohne von ihm abzuhängen.
  const meldenRef = useRef(setError);
  useEffect(() => { meldenRef.current = setError; });

  useEffect(() => {
    let vorbei = false;
    // Heißt wie oben setError (Positivliste der Fehlertexte); meldet über den
    // neuesten Rückruf, solange das Formular noch offen ist.
    const setError = (text: string) => { if (!vorbei) meldenRef.current(text); };

    const loadActivity = async (id: number) => {
      try {
        const response = await api.get('/admin/activities');
        const activities: KatalogAktivitaet[] = Array.isArray(response.data) ? response.data : [];
        const activityData = activities.find((act) => act.id === id);
        if (vorbei) return;
        if (activityData) {
          setCurrentActivity(activityData);
          setFormData(vorbelegen(activityData, targetRole));
        } else {
          console.error('Activity not found with ID:', id);
          setError('Aktivität nicht gefunden');
        }
      } catch (error) {
        console.error('Error loading activity:', error);
        setError('Fehler beim Laden der Aktivität');
      }
    };

    const initialisieren = async () => {
      try {
        // Alle Kategorien, ungefiltert: auch die mit type=null gelten für Aktivitäten.
        const response = await api.get('/admin/categories');
        if (vorbei) return;
        setCategories(Array.isArray(response.data) ? response.data : []);

        if (activityId) {
          await loadActivity(activityId);
        } else if (activity) {
          setCurrentActivity(activity);
          setFormData(vorbelegen(activity, targetRole));
        } else {
          setCurrentActivity(null);
          setFormData(neu(targetRole));
        }
      } catch (error) {
        console.error('Error during initialization:', error);
        setError('Fehler beim Initialisieren des Modals');
      } finally {
        if (!vorbei) setInitializing(false);
      }
    };

    void initialisieren();
    return () => { vorbei = true; };
  }, [activityId, activity, targetRole]);

  /** Jede Eingabe: ändert das Formular, nimmt eine alte Meldung weg und zählt als ungespeichert. */
  const aendern = (teil: Partial<KatalogFormularDaten>) => {
    setFehler(null);
    setIsDirty(true);
    setFormData((f) => ({ ...f, ...teil }));
  };

  /**
   * Zielgruppe einer neuen Aktivität: Team hat keine Punkte und keinen Typ;
   * zurück zu den Konfis gelten wieder 1 Punkt und Gottesdienst.
   */
  const waehleZielgruppe = (rolle: KatalogZielgruppe) => {
    if (loading) return;
    if (rolle === 'teamer') {
      aendern({ target_role: 'teamer', points: 0, type: '' });
    } else {
      aendern({
        target_role: 'konfi',
        points: formData.target_role === 'teamer' ? 1 : formData.points,
        type: formData.target_role === 'teamer' ? 'gottesdienst' : formData.type,
      });
    }
  };

  const kategorieUmschalten = (id: number) => {
    if (loading) return;
    aendern({
      category_ids: formData.category_ids.includes(id)
        ? formData.category_ids.filter((k) => k !== id)
        : [...formData.category_ids, id],
    });
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) return;

    // guard() wirft, wenn schon gespeichert wird (Doppelklick, Enter im Feld
    // während des Sendens): Der zweite Aufruf wird still verworfen.
    await guard(async () => {
      setFehler(null);
      setLoading(true);
      try {
        const payload = {
          name: formData.name.trim(),
          points: formData.target_role === 'teamer' ? 0 : formData.points,
          type: formData.target_role === 'teamer' ? null : formData.type,
          category_ids: formData.category_ids,
          target_role: formData.target_role
        };

        // Bearbeiten (PUT) faellt auch bei einem Netzabbruch im Online-Zweig in
        // die Warteschlange; Anlegen (POST ohne Idempotenzschluessel) nur
        // offline -- nach einem Abbruch bleibt es dort beim Fehler, sonst
        // entstuende der Eintrag womoeglich doppelt (utils/sendenOderEinreihen.ts,
        // Audit Grundgeruest BF-01).
        const { weg } = await sendenOderEinreihen({
          online: networkMonitor.isOnline,
          methode: currentActivity ? 'PUT' : 'POST',
          senden: () => (currentActivity
            ? api.put(`/admin/activities/${currentActivity.id}`, payload)
            : api.post('/admin/activities', payload)),
          einreihen: () => (currentActivity
            ? writeQueue.enqueue({
              method: 'PUT',
              url: `/admin/activities/${currentActivity.id}`,
              body: payload,
              maxRetries: 5,
              hasFileUpload: false,
              metadata: { type: 'admin', clientId: safeUUID(), label: 'Aktivität bearbeiten' },
            })
            : writeQueue.enqueue({
              method: 'POST',
              url: '/admin/activities',
              body: payload,
              maxRetries: 5,
              hasFileUpload: false,
              metadata: { type: 'admin', clientId: safeUUID(), label: 'Aktivität erstellen' },
            })),
        });
        if (weg === 'eingereiht') {
          setSuccess(currentActivity
            ? 'Aktivität wird aktualisiert sobald du wieder online bist'
            : 'Aktivität wird erstellt sobald du wieder online bist');
        }

        setIsDirty(false);
        onSuccess();
      } catch (error) {
        setError(fehlerText(error, 'Fehler beim Speichern der Aktivität'));
      } finally {
        setLoading(false);
      }
    }).catch(() => undefined);
  };

  return {
    formData,
    aendern,
    waehleZielgruppe,
    kategorieUmschalten,
    categories,
    currentActivity,
    initializing,
    loading,
    isSubmitting,
    isOnline,
    isDirty,
    isFormValid: formData.name.trim().length > 0,
    /** Browser: die Meldung im Dialog. */
    fehler,
    handleSubmit,
  };
}
