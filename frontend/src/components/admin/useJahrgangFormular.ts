// Jahrgang anlegen und bearbeiten -- als Logik ohne Darstellung (Simon,
// 11.10.2026: „Web braucht eigene kompaktere Modale überall"). Die App zeigt
// sie im Modal (JahrgangModal in pages/AdminJahrgaengeePage.tsx), der Browser
// ab 992 px im Dialog (web/leitung/WebJahrgangDialog.tsx) -- Vorbelegung,
// Personen zur Direkt-Zuweisung, Prüfen und Speichern stehen nur hier.
//
// Speichern: PUT /admin/jahrgaenge/:id bzw. POST /admin/jahrgaenge, offline
// (und beim Bearbeiten nach einem Netzabbruch) in die Warteschlange.
//
// Meldungen: in der App oben (setError, mit der anonymen Fehlermessung), im
// Dialog des Browsers (`fehlerImDialog`) im Dialog selbst (`fehler`) -- die
// Meldung oben ist ein IonToast in <ion-app> und laege dort unter dem
// abgedunkelten Grund des Dialogs (Gegenprüfung 11.10.2026).

import { useEffect, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import api from '../../services/api';
import { networkMonitor } from '../../services/networkMonitor';
import { writeQueue } from '../../services/writeQueue';
import { fehlerText } from '../../utils/fehler';
import { sendenOderEinreihen } from '../../utils/sendenOderEinreihen';
import { safeUUID } from '../../utils/uuid';

/** Was das Formular von einem bestehenden Jahrgang liest. */
export interface JahrgangVorlage {
  id: number;
  name: string;
  gottesdienst_enabled?: boolean;
  gemeinde_enabled?: boolean;
  target_gottesdienst?: number;
  target_gemeinde?: number;
  konfspruch_enabled?: boolean;
  konfi_count?: number;
}

// Personen, die beim Anlegen direkt Zugriff auf den neuen Jahrgang bekommen
// koennen (Simons Entscheidung 01.09.2026: nur der Org-Admin legt Jahrgaenge
// an und weist dabei direkt zu). Angeboten werden Admins und Teamer:innen —
// Org-Admins sehen ohnehin alle Jahrgaenge, Konfis gehoeren zu einem Jahrgang
// statt ihm zugewiesen zu werden.
export interface ZuweisbarePerson {
  id: number;
  display_name: string;
  role_name: string;
}

export interface JahrgangFormularDaten {
  name: string;
  gottesdienst_enabled: boolean;
  gemeinde_enabled: boolean;
  target_gottesdienst: number;
  target_gemeinde: number;
  konfspruch_enabled: boolean;
}

/** Punkteziele: der Regler der App reicht von 1 bis 20. */
export const ZIEL_MIN = 1;
export const ZIEL_MAX = 20;

/** Vorbelegung: die Werte des Jahrgangs, sonst die Vorgaben eines neuen. */
export const jahrgangVorbelegen = (jahrgang?: JahrgangVorlage | null): JahrgangFormularDaten => (jahrgang
  ? {
      name: jahrgang.name,
      gottesdienst_enabled: jahrgang.gottesdienst_enabled ?? true,
      gemeinde_enabled: jahrgang.gemeinde_enabled ?? true,
      // `|| 10` wie ueberall: eine 0 aus frueheren Tagen heisst 10 (der
      // Regler beginnt bei 1; Audit Fachlogik Punkte/Termine BF-10).
      target_gottesdienst: jahrgang.target_gottesdienst || 10,
      target_gemeinde: jahrgang.target_gemeinde || 10,
      konfspruch_enabled: jahrgang.konfspruch_enabled ?? true
    }
  : {
      name: '',
      gottesdienst_enabled: true,
      gemeinde_enabled: true,
      target_gottesdienst: 10,
      target_gemeinde: 10,
      konfspruch_enabled: true
    });

export interface JahrgangFormularOptionen {
  /**
   * Meldungen im Formular zeigen (`fehler`; der Dialog des Browsers) statt
   * oben als Meldung (App) -- eine Meldung oben laege unter dem Dialog.
   */
  fehlerImDialog?: boolean;
}

/**
 * @param jahrgang  der bearbeitete Jahrgang; null/undefined: ein neuer.
 * @param onGespeichert  nach dem Speichern (auch eingereiht): Liste neu laden, Fenster schließen.
 */
export function useJahrgangFormular(
  jahrgang: JahrgangVorlage | null | undefined,
  onGespeichert: () => void,
  { fehlerImDialog = false }: JahrgangFormularOptionen = {},
) {
  const { user, setSuccess, setError: meldungOben } = useApp();
  const [loading, setLoading] = useState(false);
  // Die Meldung im Dialog; leer, sobald jemand etwas ändert oder neu speichert.
  const [fehler, setFehler] = useState<string | null>(null);
  // Wohin eine Meldung geht (siehe oben). Bewusst unter dem Namen setError:
  // Die Positivliste der Fehlertexte (utils/bekannteFehlertexte.ts) liest die
  // Texte an den Aufrufstellen von setError -- die App meldet sie weiter oben.
  const setError = (...meldung: Parameters<typeof meldungOben>) => {
    if (fehlerImDialog) setFehler(meldung[0] || null);
    else meldungOben(...meldung);
  };

  // Direkt-Zuweisung beim Anlegen: Auswahl der Personen, die Zugriff auf den
  // neuen Jahrgang bekommen. Optional — niemand MUSS zugewiesen werden.
  // Nur im Anlege-Modus relevant (beim Bearbeiten laeuft die Zuweisung wie
  // gehabt ueber Mehr > Benutzer:innen).
  const [zuweisbare, setZuweisbare] = useState<ZuweisbarePerson[]>([]);
  const [ausgewaehlt, setAusgewaehlt] = useState<{ [id: number]: boolean }>({});
  const [formData, setFormData] = useState<JahrgangFormularDaten>(() => jahrgangVorbelegen(jahrgang));

  useEffect(() => {
    setFormData(jahrgangVorbelegen(jahrgang));
    // Auswahl der Direkt-Zuweisung gehoert zum Anlege-Vorgang — beim Wechsel
    // des bearbeiteten Jahrgangs darf keine alte Auswahl haengen bleiben.
    setAusgewaehlt({});
  }, [jahrgang]);

  // Zuweisen darf nur, wer anlegt -- und das ist nur die Gemeindeleitung.
  const zuweisungMoeglich = !jahrgang && user?.role_name === 'org_admin';

  // Personenliste nur laden, wenn wirklich angelegt wird und der Aufrufer
  // org_admin ist — nur er darf anlegen und zuweisen. Fehler hier blockieren
  // das Anlegen nicht; die Zuweisung ist optional und geht auch spaeter.
  useEffect(() => {
    if (jahrgang || user?.role_name !== 'org_admin' || !networkMonitor.isOnline) return;
    let aktiv = true;
    (async () => {
      try {
        const res = await api.get('/users');
        if (!aktiv) return;
        const personen = (res.data as ZuweisbarePerson[]).filter(
          (p) => p.role_name === 'admin' || p.role_name === 'teamer'
        );
        setZuweisbare(personen);
      } catch {
        // still: Abschnitt bleibt leer, das Anlegen funktioniert trotzdem
      }
    })();
    return () => { aktiv = false; };
  }, [jahrgang, user?.role_name]);

  const handleSubmit = async () => {
    setFehler(null);
    if (!formData.name.trim()) {
      setError('Name ist erforderlich');
      return;
    }

    const payload: Record<string, unknown> = {
      name: formData.name.trim(),
      gottesdienst_enabled: formData.gottesdienst_enabled,
      gemeinde_enabled: formData.gemeinde_enabled,
      target_gottesdienst: formData.target_gottesdienst,
      target_gemeinde: formData.target_gemeinde,
      konfspruch_enabled: formData.konfspruch_enabled
    };

    // Direkt-Zuweisung nur beim Anlegen und nur, wenn jemand ausgewaehlt ist —
    // ohne Auswahl bleibt das Feld weg und der Server verhaelt sich wie bisher.
    // Nur Sehen, wie bei der Zuweisung ueber die Benutzerverwaltung: das
    // Zuordnungsrecht (can_edit) setzt der Server nach der Rolle.
    const zugewieseneIds = Object.entries(ausgewaehlt)
      .filter(([, gewaehlt]) => gewaehlt)
      .map(([id]) => parseInt(id, 10));
    if (!jahrgang && zugewieseneIds.length > 0) {
      payload.user_assignments = zugewieseneIds.map((id) => ({
        user_id: id,
        can_view: true
      }));
    }

    setLoading(true);
    try {
      // Bearbeiten (PUT) faellt auch bei einem Netzabbruch im Online-Zweig in
      // die Warteschlange; Anlegen (POST ohne Idempotenzschluessel) nur
      // offline -- nach einem Abbruch bleibt es dort beim Fehler, sonst
      // entstuende der Eintrag womoeglich doppelt (utils/sendenOderEinreihen.ts,
      // Audit Grundgeruest BF-01).
      const { weg } = await sendenOderEinreihen({
        online: networkMonitor.isOnline,
        methode: jahrgang ? 'PUT' : 'POST',
        senden: () => (jahrgang ? api.put(`/admin/jahrgaenge/${jahrgang.id}`, payload) : api.post('/admin/jahrgaenge', payload)),
        einreihen: () => writeQueue.enqueue({
          method: jahrgang ? 'PUT' : 'POST',
          url: jahrgang ? `/admin/jahrgaenge/${jahrgang.id}` : '/admin/jahrgaenge',
          body: payload,
          maxRetries: 5,
          hasFileUpload: false,
          metadata: {
            type: 'admin',
            clientId: safeUUID(),
            label: jahrgang ? 'Jahrgang bearbeiten' : 'Jahrgang erstellen'
          }
        }),
      });
      if (weg === 'eingereiht') setSuccess('Wird gespeichert sobald du wieder online bist');
      onGespeichert();
    } catch (error) {
      setError(fehlerText(error, 'Fehler beim Speichern des Jahrgangs'));
    } finally {
      setLoading(false);
    }
  };

  return {
    user,
    loading,
    formData,
    setFormData,
    /** Einzelne Felder ändern (Web-Dialog); räumt die Meldung im Dialog weg. */
    aendern: (teil: Partial<JahrgangFormularDaten>) => {
      setFehler(null);
      setFormData((f) => ({ ...f, ...teil }));
    },
    /** Die Meldung im Dialog (nur mit `fehlerImDialog`). */
    fehler,
    zuweisbare,
    ausgewaehlt,
    setAusgewaehlt,
    /** Die Personen mit Zugriff wählen (Web-Dialog); räumt die Meldung im Dialog weg. */
    personenWaehlen: (auswahl: { [id: number]: boolean }) => {
      setFehler(null);
      setAusgewaehlt(auswahl);
    },
    zuweisungMoeglich,
    handleSubmit,
  };
}

export type JahrgangFormular = ReturnType<typeof useJahrgangFormular>;
