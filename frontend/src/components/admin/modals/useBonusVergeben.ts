// „Bonuspunkte vergeben" an eine Konfi -- als Logik ohne Darstellung. Die
// App (Modal BonusModal) und die Web-Fassung (Dialog
// web/leitung/WebBonusDialog) zeigen dieselbe Logik (wie im Support:
// useEinsortieren, useNeuerVorgang):
//
//   - Vorbelegt: Bezeichnung und Begründung leer, 1 Punkt, Datum heute, als
//     Typ Gemeinde -- oder die erste AKTIVE Punkteart des Jahrgangs
//     (utils/punktearten.ts).
//   - Prüfen: Bezeichnung, 1 bis 10 Punkte, eine aktive Punkteart.
//   - Speichern: POST /admin/konfis/:id/bonus-points
//       { points, type, description: "Bezeichnung: Begründung",
//         completed_date, client_id }
//     Ohne Netz in die Warteschlange (Handbuch: „Ohne Netz gehen nur das
//     Eintragen von Aktivitäten und Bonuspunkten"); danach lädt die Seite
//     neu (onSave) und das Fenster schließt.
//   - Fehler meldet die App als Meldung (setError); der Web-Dialog zeigt sie
//     im Fenster (fehlerImFenster), ebenso die Prüfung, die in der App der
//     gesperrte Haken ersetzt.

import { useRef, useState } from 'react';
import { useApp } from '../../../contexts/AppContext';
import { useActionGuard } from '../../../hooks/useActionGuard';
import api from '../../../services/api';
import { writeQueue } from '../../../services/writeQueue';
import { networkMonitor } from '../../../services/networkMonitor';
import { trackHandlung } from '../../../services/analytics';
import { fehlerText } from '../../../utils/fehler';
import { safeUUID } from '../../../utils/uuid';
import {
  aktivePunktearten,
  ersteAktivePunkteart,
  type Punkteart,
  type PunkteartFlags,
} from '../../../utils/punktearten';

export interface BonusVergebenOptionen {
  konfiId: number;
  /**
   * Punktearten-Schalter des Jahrgangs, zu dem die Konfi gehoert. Ohne diese
   * Angabe gelten beide Arten als aktiv -- die Auswahl bot dann auch eine
   * abgeschaltete Art an, und das Speichern scheiterte am Server (400).
   */
  punkteartFlags?: PunkteartFlags;
  /** Nach dem Speichern bzw. Einreihen: die Seite lädt neu. */
  onSave: () => Promise<void>;
  /** Schließt das Fenster. */
  schliessen: () => void;
  /** Prüfung und Fehler im Fenster zeigen (Web-Dialog) statt als Meldung der App. */
  fehlerImFenster?: boolean;
}

export const BONUS_MIN = 1;
export const BONUS_MAX = 10;
export const BEZEICHNUNG_FEHLT = 'Bitte eine Bezeichnung eingeben.';
export const PUNKTE_AUSSERHALB = `Bitte ${BONUS_MIN} bis ${BONUS_MAX} Punkte vergeben.`;
export const KEINE_PUNKTEART = 'Für diesen Jahrgang ist keine Punkteart aktiv.';
/** Nur im Browser erreichbar: Das Datumsfeld laesst sich leeren, der Kalender der App nicht. */
export const DATUM_FEHLT = 'Bitte ein Datum wählen.';

/** Heute als "2026-10-11", wie die App das Datum seit jeher vorbelegt. */
const heute = () => new Date().toISOString().split('T')[0];

export function useBonusVergeben({
  konfiId, punkteartFlags, onSave, schliessen, fehlerImFenster = false,
}: BonusVergebenOptionen) {
  const { setError, isOnline } = useApp();
  const [name, setNameRoh] = useState('');
  const [points, setPointsRoh] = useState<number>(BONUS_MIN);
  const [reason, setReason] = useState('');
  // Vorbelegung nur aus den AKTIVEN Arten. Vorher stand fest 'gemeinde' hier --
  // war ausgerechnet Gemeinde abgeschaltet, war die Voreinstellung die verbotene.
  const verfuegbareArten = aktivePunktearten(punkteartFlags);
  const [type, setType] = useState<Punkteart | null>(
    () => ersteAktivePunkteart(punkteartFlags, 'gemeinde')
  );
  const [selectedDate, setSelectedDate] = useState(heute);
  const { isSubmitting, guard } = useActionGuard();
  const [fehler, setFehler] = useState<string | null>(null);
  // Eine Kennung je Vorgang (so lange das Fenster offen ist): Erreicht die
  // Warteschlange den Server zweimal mit derselben, bucht er nur einmal
  // (Wiederholungsschutz, 08.10.2026). Ein zweites Speichern nach einem
  // Fehler ist derselbe Vorgang.
  const vorgangKennung = useRef(safeUUID());

  /** Was fehlt, als Satz; null, wenn alles passt. Die Punkteart prüft handleSave danach. */
  const pruefen = (): string | null => {
    if (!name.trim()) return BEZEICHNUNG_FEHLT;
    if (!Number.isInteger(points) || points < BONUS_MIN || points > BONUS_MAX) return PUNKTE_AUSSERHALB;
    if (!selectedDate) return DATUM_FEHLT;
    return null;
  };

  const meldeFehler = (text: string) => {
    if (fehlerImFenster) setFehler(text);
    else setError(text);
  };

  const handleSave = async () => {
    const meldung = pruefen();
    if (meldung) {
      if (fehlerImFenster) setFehler(meldung);
      return;
    }
    // Ohne aktive Punkteart gibt es nichts zu vergeben -- der Server wiese das
    // mit 400 zurueck. Hier abfangen, statt eine leere type-Angabe zu senden.
    if (!type) {
      // Ausgeschrieben statt ueber meldeFehler: Die Positivliste der
      // Fehlertexte (bekannteFehlertexte.test.ts) liest setError-Aufrufe.
      if (fehlerImFenster) setFehler(KEINE_PUNKTEART);
      else setError(KEINE_PUNKTEART);
      return;
    }
    setFehler(null);

    const body = {
      points: points,
      type: type,
      description: `${name.trim()}${reason.trim() ? ': ' + reason.trim() : ''}`,
      completed_date: selectedDate,
      client_id: vorgangKennung.current
    };

    await guard(async () => {
      if (networkMonitor.isOnline) {
        try {
          await api.post(`/admin/konfis/${konfiId}/bonus-points`, body);
          // Anonyme Messung NACH der erfolgreichen Antwort. Nur der Weg und
          // die Punkteart — nicht die Punktzahl, nicht der eingegebene Grund.
          trackHandlung('punkte-vergeben', { weg: 'bonus', punkteart: type });
          await onSave();
          schliessen();
        } catch (err) {
          console.error('Error saving bonus points:', err);
          meldeFehler(fehlerText(err, 'Bonus-Punkte konnten nicht gespeichert werden'));
        }
      } else {
        await writeQueue.enqueue({
          method: 'POST',
          url: `/admin/konfis/${konfiId}/bonus-points`,
          body,
          maxRetries: 5,
          hasFileUpload: false,
          metadata: {
            type: 'admin',
            clientId: vorgangKennung.current,
            label: 'Bonus-Punkte vergeben'
          }
        });
        await onSave();
        schliessen();
      }
    });
  };

  return {
    name,
    setName: (wert: string) => { setFehler(null); setNameRoh(wert); },
    points,
    setPoints: (wert: number) => { setFehler(null); setPointsRoh(wert); },
    reason,
    setReason,
    type,
    setType,
    /** Die Punktearten, die der Jahrgang anbietet (Gottesdienst, Gemeinde). */
    verfuegbareArten,
    selectedDate,
    setSelectedDate: (datum: string) => { setFehler(null); setSelectedDate(datum); },
    isSubmitting,
    /** Der Haken der App ist nur frei, wenn das stimmt. */
    isValid: pruefen() === null,
    /** Für den Hinweis im Web-Dialog: Ohne Netz geht die Vergabe in die Warteschlange. */
    ohneNetz: !isOnline,
    fehler,
    handleSave,
  };
}

export type BonusVergebenZustand = ReturnType<typeof useBonusVergeben>;
