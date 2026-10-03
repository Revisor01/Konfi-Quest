// Offene Einladungen der Gemeinde -- einsehen und zurueckziehen (Simon,
// 27.09.2026). Eine Stelle fuer die App (OffeneEinladungen.tsx) und die
// Web-Fassung (web/leitung/WebOffeneEinladungen.tsx).
//
// NUR FUER ORG-ADMINS: Einladen, die Liste sehen und zurueckziehen verlangt
// serverseitig requireOrgAdmin -- die Seite bindet den Abschnitt deshalb nur
// bei role_name 'org_admin' ein. Fuer alle anderen wird GET /einladungen gar
// nicht erst gerufen (es gaebe nur 403).
//
// Antwortform von GET /einladungen: ein Array, jede Zeile mit den Feldern von
// OffeneEinladungDerGemeinde (routes/einladungen.js, EINLADUNG_FELDER plus
// display_name und username der eingeladenen Person).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useIonAlert } from '@ionic/react';
import api from '../../services/api';
import { useApp } from '../../contexts/AppContext';
import { fehlerText } from '../../utils/fehler';
import { offlineBlockiert } from '../../utils/offlineAktion';

export interface OffeneEinladungDerGemeinde {
  id: number;
  user_id: number;
  display_name: string;
  username: string;
  role_name: string;
  role_display_name: string | null;
  created_at: string;
  expires_at: string;
  eingeladen_von_name?: string | null;
}

export interface OffeneEinladungen {
  einladungen: OffeneEinladungDerGemeinde[];
  /** Die Einladung, die gerade zurueckgezogen wird. */
  laeuft: number | null;
  /** Fragt nach und zieht die Einladung dann zurueck. */
  zurueckziehen: (einladung: OffeneEinladungDerGemeinde) => void;
}

/**
 * @param aktualisierung zaehlt hoch, wenn die Liste neu geladen werden soll:
 *   nach einer neuen Einladung, beim Live-Signal 'users' (etwa nach einer
 *   Zusage) und beim Ziehen zum Aktualisieren.
 */
export function useOffeneEinladungen(aktualisierung: number): OffeneEinladungen {
  const { setError, setSuccess, isOnline } = useApp();
  const [presentAlert] = useIonAlert();
  const [einladungen, setEinladungen] = useState<OffeneEinladungDerGemeinde[]>([]);
  const [laeuft, setLaeuft] = useState<number | null>(null);

  // Nur die Antwort des JUENGSTEN Abrufs zaehlt: Kommen Live-Signal und
  // eigenes Neuladen kurz nacheinander, darf der aeltere Stand den neueren
  // nicht ueberschreiben.
  const abrufNummer = useRef(0);

  const laden = useCallback(async () => {
    const nummer = ++abrufNummer.current;
    try {
      const res = await api.get('/einladungen');
      if (nummer !== abrufNummer.current) return;
      setEinladungen(Array.isArray(res.data) ? res.data : []);
    } catch {
      // Still: Eine fehlende Einladungsliste darf die Benutzerliste nicht
      // stoeren. Der zuletzt geladene Stand bleibt stehen.
    }
  }, []);

  useEffect(() => { void laden(); }, [laden, aktualisierung]);

  const zurueckziehen = (einladung: OffeneEinladungDerGemeinde) => {
    if (offlineBlockiert(isOnline, setError)) return;
    presentAlert({
      header: 'Einladung zurückziehen',
      message: `Die Einladung an "${einladung.display_name}" (@${einladung.username}) zurückziehen? Die Person kann sie danach nicht mehr annehmen. Einladen lässt sie sich jederzeit neu.`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Zurückziehen',
          role: 'destructive',
          handler: async () => {
            setLaeuft(einladung.id);
            try {
              await api.delete(`/einladungen/${einladung.id}`);
              setEinladungen((liste) => liste.filter((e) => e.id !== einladung.id));
              setSuccess(`Die Einladung an ${einladung.display_name} ist zurückgezogen.`);
            } catch (err) {
              // 404: inzwischen angenommen, abgelehnt oder von einer anderen
              // Leitung zurueckgezogen. Die Liste zeigt danach den echten
              // Stand.
              const status = (err as { response?: { status?: number } })?.response?.status;
              setError(status === 404
                ? 'Diese Einladung ist nicht mehr offen. Sie wurde inzwischen beantwortet oder zurückgezogen.'
                : fehlerText(err, 'Die Einladung konnte nicht zurückgezogen werden'));
              await laden();
            } finally {
              setLaeuft(null);
            }
          }
        }
      ]
    });
  };

  return { einladungen, laeuft, zurueckziehen };
}
