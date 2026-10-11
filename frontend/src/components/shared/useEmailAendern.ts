// „E-Mail ändern" als Logik ohne Darstellung -- für alle drei Rollen
// (Konfi, Team, Leitung). Die App zeigt sie im Modal (ChangeEmailModal),
// die Web-Fassung im Browser ab 992 px im Dialog (web/konto/WebEmailAendern).
// Muster wie im Support (useNeuerVorgang).
//
// Beim Öffnen holt der Hook die aktuelle Adresse vom Server (GET /auth/me);
// fällt das aus, bleibt die mitgegebene. Die Adresse ist freiwillig, eine
// angegebene muss gültig sein; leer wird sie als null gespeichert
// (POST /auth/update-email). Fehler zeigt die App am Rand (setError), der
// Web-Dialog über seinem Feld (`fehler`).
//
// Danach lädt die Seite neu und schreibt die Adresse in den Kontext der
// Anmeldung und den TokenStore: useNeueEmailUebernehmen, einmal für App-Modal
// und Web-Dialog (bis 11.10.2026 dreifach in den Profilseiten kopiert).

import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useActionGuard } from '../../hooks/useActionGuard';
import api from '../../services/api';
import { setUser as setTokenStoreUser } from '../../services/tokenStore';
import { fehlerStatus, fehlerText } from '../../utils/fehler';
import { offlineBlockiert } from '../../utils/offlineAktion';

/** Der Hinweis der App unter der Adresse. */
export const EMAIL_HINWEIS = 'Diese E-Mail-Adresse wird für Passwort-Reset und Benachrichtigungen verwendet.';

const EMAIL_MUSTER = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface EmailAendernOptionen {
  /** Die bekannte Adresse; gilt, bis der Server antwortet, und wenn er nicht antwortet. */
  initialEmail?: string;
  /** Nach dem Speichern (die Erfolgsmeldung steht schon). */
  onErfolg: () => void;
  /**
   * true (Web-Dialog): Prüf- und Serverfehler stehen in `fehler` und damit im
   * Dialog. false (App, Vorgabe): als Meldung am Rand (setError).
   */
  fehlerImFormular?: boolean;
}

export function useEmailAendern({ initialEmail = '', onErfolg, fehlerImFormular = false }: EmailAendernOptionen) {
  const { setSuccess, setError: meldungAmRand, isOnline } = useApp();
  const { isSubmitting, guard } = useActionGuard();
  const [email, setEmailWert] = useState(initialEmail);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  // Hat jemand schon getippt, überschreibt die Antwort des Servers das nicht
  // mehr (der Web-Dialog zeigt das Feld sofort; die App erst nach dem Laden).
  const getippt = useRef(false);

  // Aktuelle E-Mail beim Oeffnen vom Server laden
  useEffect(() => {
    let aktiv = true;
    const loadCurrentEmail = async () => {
      try {
        const response = await api.get('/auth/me');
        if (aktiv && !getippt.current) setEmailWert(response.data.email || '');
      } catch (err) {
        console.error('Error loading email:', err);
        // Fallback auf die initialEmail-Prop
        if (aktiv && !getippt.current) setEmailWert(initialEmail);
      } finally {
        if (aktiv) setLaedt(false);
      }
    };
    void loadCurrentEmail();
    return () => { aktiv = false; };
    // Nur beim Oeffnen: eine spaeter geaenderte initialEmail ueberschreibt nichts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setEmail = (wert: string) => {
    getippt.current = true;
    setFehler(null);
    setEmailWert(wert);
  };

  // Wohin ein Fehler geht: in der App an den Rand, im Web-Dialog ins Formular.
  // Heisst setError wie ueberall, damit die Positivliste der Fehlertexte
  // (utils/bekannteFehlertexte.ts) die Aufrufstellen unten findet.
  const setError = (meldung: string) => (fehlerImFormular ? setFehler(meldung) : meldungAmRand(meldung));

  const speichern = async () => {
    if (offlineBlockiert(isOnline, setError)) return;

    // E-Mail ist optional, aber wenn angegeben muss sie gültig sein
    if (email.trim() && !EMAIL_MUSTER.test(email)) {
      setError('Ungültige E-Mail-Adresse');
      return;
    }

    await guard(async () => {
      try {
        await api.post('/auth/update-email', {
          email: email.trim() || null,
        });
        setSuccess('E-Mail-Adresse erfolgreich aktualisiert');
        onErfolg();
      } catch (err) {
        const errorMsg = fehlerText(err, '');
        if (errorMsg.includes('bereits verwendet') || fehlerStatus(err) === 409) {
          setError('Diese E-Mail-Adresse wird bereits von einem anderen Konto verwendet.');
        } else {
          setError(errorMsg || 'Fehler beim Aktualisieren der E-Mail-Adresse');
        }
      }
    });
  };

  return { isOnline, isSubmitting, laedt, email, setEmail, fehler, speichern };
}

export type EmailAendernZustand = ReturnType<typeof useEmailAendern>;

/**
 * Nach einer geänderten Adresse: erst die Seite neu laden, dann die Adresse
 * vom Server in den Kontext der Anmeldung und den TokenStore schreiben. Ohne
 * das blieb die alte Adresse dort stehen, bis man sich neu anmeldete
 * (Befund M9, 27.08.2026). Scheitert die Abfrage, bleibt der Kontext, wie er ist.
 */
export function useNeueEmailUebernehmen(neuLaden: () => unknown) {
  const { user, setUser } = useApp();
  return async () => {
    await neuLaden();
    try {
      const response = await api.get('/auth/me');
      if (user) {
        const updatedUser = { ...user, email: response.data.email };
        await setTokenStoreUser(updatedUser);
        setUser(updatedUser);
      }
    } catch (err) {
      console.error('Error refreshing user:', err);
    }
  };
}
