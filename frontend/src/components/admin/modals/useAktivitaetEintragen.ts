// „Aktivität eintragen" für eine Konfi oder Teamer:in -- als Logik ohne
// Darstellung. Die App (Modal ActivityModal) und die Web-Fassung (Dialog
// web/leitung/WebAktivitaetDialog) zeigen dieselbe Logik (wie im Support:
// useEinsortieren, useNeuerVorgang):
//
//   - Laden: GET /admin/activities (bei einer Teamer:in ?target_role=teamer),
//     nur Aktivitäten, deren Punkteart im Jahrgang aktiv ist; Teamer-
//     Aktivitäten ohne Art bleiben immer (utils/punktearten.ts).
//   - Vorbelegt: Datum heute, Kommentar leer, keine Aktivität gewählt.
//   - Speichern: POST /admin/konfis/:id/activities
//       { activity_id, completed_date, comment }
//     Ohne Netz in die Warteschlange (Handbuch: „Ohne Netz gehen nur das
//     Eintragen von Aktivitäten und Bonuspunkten"); danach lädt die Seite
//     neu (onSave) und das Fenster schließt.
//   - Fehler des Servers meldet die App als Meldung (setError); der
//     Web-Dialog zeigt sie im Fenster (fehlerImFenster), ebenso die Prüfung
//     „keine Aktivität gewählt", die in der App der gesperrte Haken ersetzt.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../../contexts/AppContext';
import { useActionGuard } from '../../../hooks/useActionGuard';
import { useZeitgeber } from '../../../hooks/useZeitgeber';
import api from '../../../services/api';
import { writeQueue } from '../../../services/writeQueue';
import { networkMonitor } from '../../../services/networkMonitor';
import { trackHandlung } from '../../../services/analytics';
import { fehlerText } from '../../../utils/fehler';
import { safeUUID } from '../../../utils/uuid';
import { istPunkteartAktiv, type PunkteartFlags } from '../../../utils/punktearten';

export interface AktivitaetZurWahl {
  id: number;
  name: string;
  points: number;
  type: string;
  categories?: { id: number; name: string }[];
}

export interface AktivitaetEintragenOptionen {
  konfiId: number;
  /** 'teamer' für eine Teamer:in: dann nur Teamer-Aktivitäten. */
  targetRole?: string;
  /**
   * Punktearten-Schalter des Jahrgangs. Ohne die Angabe gelten beide Arten als
   * aktiv -- die Liste bot dann auch Aktivitaeten einer abgeschalteten Art an,
   * und das Zuweisen scheiterte erst beim Speichern am Server (Befund 24.08.2026:
   * damals wurde nur die Fehlermeldung ergaenzt, nicht die Ursache behoben).
   */
  punkteartFlags?: PunkteartFlags;
  /** Nach dem Speichern bzw. Einreihen: die Seite lädt neu. */
  onSave: () => Promise<void>;
  /** Schließt das Fenster. */
  schliessen: () => void;
  /** Prüfung und Fehler im Fenster zeigen (Web-Dialog) statt als Meldung der App. */
  fehlerImFenster?: boolean;
}

export const AKTIVITAET_WAEHLEN = 'Bitte eine Aktivität wählen.';
/** Nur im Browser erreichbar: Das Datumsfeld laesst sich leeren, der Kalender der App nicht. */
export const DATUM_FEHLT = 'Bitte ein Datum wählen.';

/** Heute als "2026-10-11", wie die App das Datum seit jeher vorbelegt. */
const heute = () => new Date().toISOString().split('T')[0];

/**
 * Nach Art, dann nach Name. NULL-SICHER: Teamer-Aktivitäten dürfen type = NULL
 * haben ("Konfi-Wochenende", "Konfi-Freizeit begleitet"). Ein direktes
 * a.type.localeCompare() warf dort sofort, der Render brach ab und die
 * ErrorBoundary loggte aus -- das war der Rauswurf beim Öffnen (User-Hinweis
 * 11.08.). Außerdem NICHT in-place sortieren: .sort() mutiert sonst das
 * activities-State-Array bei jedem Render.
 */
const nachArtUndName = (a: AktivitaetZurWahl, b: AktivitaetZurWahl) => {
  const typeA = a.type || '';
  const typeB = b.type || '';
  if (typeA !== typeB) {
    return typeA.localeCompare(typeB);
  }
  return (a.name || '').localeCompare(b.name || '');
};

export function useAktivitaetEintragen({
  konfiId, targetRole, punkteartFlags, onSave, schliessen, fehlerImFenster = false,
}: AktivitaetEintragenOptionen) {
  const { setError, isOnline } = useApp();
  const [activities, setActivities] = useState<AktivitaetZurWahl[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [ladeFehler, setLadeFehler] = useState(false);
  const [selectedActivity, setSelectedActivityRoh] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [selectedDate, setSelectedDate] = useState(heute);
  const { isSubmitting, guard } = useActionGuard();
  const [isDirty, setIsDirty] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const initializedRef = useRef(false);
  const zeitgeber = useZeitgeber();

  // isDirty nach Initialisierung tracken
  useEffect(() => {
    if (initializedRef.current) {
      setIsDirty(true);
    }
  }, [selectedActivity, comment, selectedDate]);

  useEffect(() => {
    zeitgeber.nach(100, () => { initializedRef.current = true; });
  }, [zeitgeber]);

  // Einmal beim Öffnen laden, wie bisher: Die Seite reicht die Punktearten bei
  // jedem Zeichnen als neues Objekt herein -- als Abhängigkeit lüde die Liste
  // jedes Mal neu.
  useEffect(() => {
    let aktiv = true;
    const loadActivities = async () => {
      try {
        const url = targetRole ? `/admin/activities?target_role=${targetRole}` : '/admin/activities';
        const response = await api.get(url);
        if (!aktiv) return;
        // Nur Aktivitaeten anbieten, deren Punkteart im Jahrgang aktiv ist.
        // Teamer-Aktivitaeten haben type = NULL und keine Punkteart -- die
        // bleiben unabhaengig davon in der Liste.
        setActivities(
          (response.data || []).filter((activity: AktivitaetZurWahl) =>
            !activity.type || istPunkteartAktiv(punkteartFlags, activity.type as 'gottesdienst' | 'gemeinde')
          )
        );
      } catch (err) {
        console.error('Error loading activities:', err);
        if (aktiv) setLadeFehler(true);
      } finally {
        if (aktiv) setLaedt(false);
      }
    };
    void loadActivities();
    return () => { aktiv = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aktivitaetenSortiert = useMemo(() => [...activities].sort(nachArtUndName), [activities]);

  const meldeFehler = (text: string) => {
    if (fehlerImFenster) setFehler(text);
    else setError(text);
  };

  const setSelectedActivity = (id: number | null) => {
    setFehler(null);
    setSelectedActivityRoh(id);
  };

  const handleSave = async () => {
    if (!selectedActivity || !selectedDate) {
      if (fehlerImFenster) setFehler(!selectedActivity ? AKTIVITAET_WAEHLEN : DATUM_FEHLT);
      return;
    }
    setFehler(null);

    const body = {
      activity_id: selectedActivity,
      completed_date: selectedDate,
      comment: comment
    };

    await guard(async () => {
      if (networkMonitor.isOnline) {
        try {
          await api.post(`/admin/konfis/${konfiId}/activities`, body);
          // Anonyme Messung NACH der erfolgreichen Antwort: eine Aktivitaet
          // wurde wirklich verbucht. Nur der Weg und die Punkteart — kein
          // Name der Aktivitaet, keine Konfi, keine Punktzahl.
          trackHandlung('punkte-vergeben', {
            weg: 'aktivitaet',
            punkteart: activities.find((a) => a.id === selectedActivity)?.type || 'ohne'
          });
          setIsDirty(false);
          await onSave();
          schliessen();
        } catch (err) {
          // Ohne diese Meldung blieb das Modal bei einer Ablehnung des Servers
          // einfach offen stehen — etwa wenn die Punktart im Jahrgang
          // abgeschaltet ist. Für die Leitung sah das so aus, als passiere
          // nichts (Befund 24.08.2026).
          console.error('Error saving activity:', err);
          meldeFehler(fehlerText(err, 'Aktivität konnte nicht gespeichert werden'));
        }
      } else {
        await writeQueue.enqueue({
          method: 'POST',
          url: `/admin/konfis/${konfiId}/activities`,
          body,
          maxRetries: 5,
          hasFileUpload: false,
          metadata: {
            type: 'admin',
            clientId: safeUUID(),
            label: 'Aktivität zuweisen'
          }
        });
        setIsDirty(false);
        await onSave();
        schliessen();
      }
    });
  };

  return {
    /** Die angebotenen Aktivitäten (nur aktive Punktearten), wie geladen. */
    activities,
    /** Dieselben nach Art und Name, wie die Liste sie zeigt. */
    aktivitaetenSortiert,
    laedt,
    ladeFehler,
    selectedActivity,
    setSelectedActivity,
    comment,
    setComment,
    selectedDate,
    setSelectedDate: (datum: string) => { setFehler(null); setSelectedDate(datum); },
    isSubmitting,
    isDirty,
    /** Für den Hinweis im Web-Dialog: Ohne Netz geht der Eintrag in die Warteschlange. */
    ohneNetz: !isOnline,
    fehler,
    handleSave,
  };
}

export type AktivitaetEintragenZustand = ReturnType<typeof useAktivitaetEintragen>;
