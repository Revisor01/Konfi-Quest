// „Funktionsbeschreibung" als Logik ohne Darstellung -- für Team und Leitung.
// Die App zeigt sie im Modal (admin/modals/ChangeRoleTitleModal), der Browser
// ab 992 px im Dialog (web/konto/WebFunktionDialog; Simon, 15.10.2026: „im
// Browser bekommt jedes Formular, das noch ein App-Modal öffnet, ein kompaktes
// Web-Fenster"). Speichern, Warteschlange und Texte stehen nur hier, damit
// beide nicht auseinanderlaufen.
//
// Speichern: POST /auth/update-role-title { role_title } -- der Text ohne
// Leerzeichen am Rand; leer ist erlaubt (dann gilt wieder die Rolle). Ohne
// Netz geht derselbe Aufruf in die Warteschlange (fire-and-forget) und der
// Aufrufer schließt sofort, wie bisher in der App. Fehler zeigt die App am
// Rand (setError), der Web-Dialog in sich selbst (`fehler`).

import { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useActionGuard } from '../../hooks/useActionGuard';
import api from '../../services/api';
import { networkMonitor } from '../../services/networkMonitor';
import { writeQueue } from '../../services/writeQueue';
import { fehlerText } from '../../utils/fehler';
import { safeUUID } from '../../utils/uuid';

/** Beispiel im leeren Feld. */
export const FUNKTION_PLATZHALTER = 'z.B. Pastor, Diakonin, Jugendmitarbeiter';
/** Was die Funktionsbeschreibung ist -- der Hinweis unter dem Feld. */
export const FUNKTION_HINWEIS = 'Deine Funktionsbeschreibung wird anderen Nutzern im Chat und an anderen Stellen angezeigt. '
  + 'Sie ersetzt nicht deine Rolle (Leitung, Gemeindeleitung, Teamer:in), sondern ergänzt sie.';
export const FUNKTION_BEISPIELE = 'Beispiele: Pastor, Diakonin, Jugendmitarbeiter, Gemeindediakon, Pfarrerin';

export interface FunktionsbeschreibungOptionen {
  /** Die gespeicherte Beschreibung, mit der das Feld beginnt. */
  initialRoleTitle?: string;
  /** Gespeichert (oder offline eingereiht): Der Aufrufer schließt und lädt neu. */
  onErfolg: () => void;
  /** true (Web-Dialog): Fehler in `fehler`. false (App, Vorgabe): am Rand (setError). */
  fehlerImFormular?: boolean;
}

export function useFunktionsbeschreibung({ initialRoleTitle = '', onErfolg, fehlerImFormular = false }: FunktionsbeschreibungOptionen) {
  const { setSuccess, setError: meldungAmRand, isOnline } = useApp();
  const [roleTitle, setRoleTitleWert] = useState(initialRoleTitle);
  const [fehler, setFehler] = useState<string | null>(null);
  const { isSubmitting, guard } = useActionGuard();

  // Wohin ein Fehler geht. Heisst setError wie ueberall, damit die
  // Positivliste der Fehlertexte (utils/bekannteFehlertexte.ts) die
  // Aufrufstelle unten findet.
  const setError = (meldung: string) => (fehlerImFormular ? setFehler(meldung) : meldungAmRand(meldung));

  /** Jede Eingabe räumt eine alte Meldung weg. */
  const setRoleTitle = (wert: string) => {
    setFehler(null);
    setRoleTitleWert(wert);
  };

  const speichern = async () => {
    // Offline: Queue-Fallback (fire-and-forget)
    if (!networkMonitor.isOnline) {
      writeQueue.enqueue({
        method: 'POST',
        url: '/auth/update-role-title',
        body: { role_title: roleTitle.trim() },
        maxRetries: 3,
        hasFileUpload: false,
        metadata: { type: 'fire-and-forget', clientId: safeUUID(), label: 'Funktionsbeschreibung' },
      });
      setSuccess('Funktionsbeschreibung wird bei Verbindung aktualisiert');
      onErfolg();
      return;
    }

    await guard(async () => {
      try {
        await api.post('/auth/update-role-title', {
          role_title: roleTitle.trim(),
        });
        onErfolg();
      } catch (err) {
        setError(fehlerText(err, 'Fehler beim Aktualisieren der Funktionsbeschreibung'));
      }
    });
  };

  return { roleTitle, setRoleTitle, isSubmitting, isOnline, fehler, speichern };
}

export type FunktionsbeschreibungZustand = ReturnType<typeof useFunktionsbeschreibung>;
