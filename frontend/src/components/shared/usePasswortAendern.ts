// „Passwort ändern" als Logik ohne Darstellung -- für alle drei Rollen
// (Konfi, Team, Leitung). Die App zeigt sie im Modal (ChangePasswordModal),
// die Web-Fassung im Browser ab 992 px im Dialog
// (web/konto/WebPasswortAendern). Muster wie im Support (useNeuerVorgang).
//
// Geprüft wird vor dem Senden: aktuelles Passwort da, neues erfüllt alle
// Anforderungen (dieselben wie im Backend, utils/passwordValidation.js),
// Bestätigung gleich. POST /auth/change-password beendet serverseitig alle
// Sitzungen und liefert ein frisches Token-Paar für diese -- es wird sofort
// übernommen, sonst scheitert der nächste Aufruf am ungültigen Token.
//
// Fehler zeigt die App am Rand (setError), der Web-Dialog über seinen
// Feldern (`fehler`); offline speichert keine der beiden Fassungen: Das
// Passwort braucht die Antwort des Servers.

import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { useApp } from '../../contexts/AppContext';
import { useActionGuard } from '../../hooks/useActionGuard';
import api from '../../services/api';
import { getDeviceId, setRefreshToken, setToken } from '../../services/tokenStore';
import { fehlerText } from '../../utils/fehler';
import { offlineBlockiert } from '../../utils/offlineAktion';

export interface PasswortPruefung {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}

/** Die Anforderungen in der Reihenfolge der Anzeige, mit den Texten der App. */
export const PASSWORT_ANFORDERUNGEN: ReadonlyArray<{ schluessel: keyof PasswortPruefung; label: string }> = [
  { schluessel: 'minLength', label: 'Mind. 8 Zeichen' },
  { schluessel: 'hasUppercase', label: 'Großbuchstabe' },
  { schluessel: 'hasLowercase', label: 'Kleinbuchstabe' },
  { schluessel: 'hasNumber', label: 'Zahl' },
  { schluessel: 'hasSpecial', label: 'Sonderzeichen' },
];

export function passwortPruefen(pw: string): PasswortPruefung {
  return {
    minLength: pw.length >= 8,
    hasUppercase: /[A-Z]/.test(pw),
    hasLowercase: /[a-z]/.test(pw),
    hasNumber: /[0-9]/.test(pw),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>_\-+=[\]\\/~`]/.test(pw),
  };
}

export interface PasswortWerte {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export type PasswortSichtbar = { current: boolean; new: boolean; confirm: boolean };

export interface PasswortAendernOptionen {
  /** Nach dem Speichern (die Erfolgsmeldung steht schon). */
  onErfolg: () => void;
  /**
   * true (Web-Dialog): Prüf- und Serverfehler stehen in `fehler` und damit im
   * Dialog. false (App, Vorgabe): als Meldung am Rand (setError).
   */
  fehlerImFormular?: boolean;
}

export function usePasswortAendern({ onErfolg, fehlerImFormular = false }: PasswortAendernOptionen) {
  const { setSuccess, setError: meldungAmRand, isOnline } = useApp();
  const { isSubmitting, guard } = useActionGuard();

  const [werte, setWerte] = useState<PasswortWerte>({ current_password: '', new_password: '', confirm_password: '' });
  const [sichtbar, setSichtbar] = useState<PasswortSichtbar>({ current: false, new: false, confirm: false });
  const [fehler, setFehler] = useState<string | null>(null);

  const pruefung = passwortPruefen(werte.new_password);
  const isPasswordValid = Object.values(pruefung).every(Boolean);
  const passwordsMatch = werte.new_password === werte.confirm_password && werte.confirm_password.length > 0;
  const isValid = Boolean(werte.current_password) && isPasswordValid && passwordsMatch;

  const setWert = (feld: keyof PasswortWerte, wert: string) => {
    setFehler(null);
    setWerte((vorher) => ({ ...vorher, [feld]: wert }));
  };
  const sichtbarUmschalten = (feld: keyof PasswortSichtbar) => setSichtbar((vorher) => ({ ...vorher, [feld]: !vorher[feld] }));
  const alleSichtbar = (an: boolean) => setSichtbar({ current: an, new: an, confirm: an });

  // Wohin ein Fehler geht: in der App an den Rand, im Web-Dialog ins Formular.
  // Heisst setError wie ueberall, damit die Positivliste der Fehlertexte
  // (utils/bekannteFehlertexte.ts) die Aufrufstellen unten findet.
  const setError = (meldung: string) => (fehlerImFormular ? setFehler(meldung) : meldungAmRand(meldung));

  const speichern = async () => {
    if (offlineBlockiert(isOnline, setError)) return;

    if (!werte.current_password) {
      setError('Bitte gib dein aktuelles Passwort ein');
      return;
    }

    if (!isPasswordValid) {
      setError('Das neue Passwort erfüllt nicht alle Anforderungen');
      return;
    }

    if (!passwordsMatch) {
      setError('Die neuen Passwörter stimmen nicht überein');
      return;
    }

    await guard(async () => {
      try {
        // Geraete-Angabe mitschicken: Der Passwortwechsel beendet alle
        // ANDEREN Sitzungen und loescht deren Push-Tokens. Nur mit device_id
        // + platform kann der Server das EIGENE Geraet verschonen — dieselbe
        // Quelle wie bei der Token-Registrierung (AppContext nutzt getDeviceId).
        const res = await api.post('/auth/change-password', {
          currentPassword: werte.current_password,
          newPassword: werte.new_password,
          device_id: getDeviceId() || undefined,
          platform: Capacitor.getPlatform(),
        });

        // Der Passwortwechsel beendet serverseitig ALLE Sitzungen. Die Antwort
        // liefert dafuer ein frisches Token-Paar für diese Sitzung — ohne
        // Uebernahme wuerde der nächste Request am invalidierten Token
        // scheitern und sich wie ein grundloser Rauswurf anfuehlen.
        if (res.data?.token) {
          await setToken(res.data.token);
          if (res.data.refresh_token) await setRefreshToken(res.data.refresh_token);
        }

        setSuccess('Passwort erfolgreich geändert');
        onErfolg();
      } catch (err) {
        setError(fehlerText(err, 'Fehler beim Ändern des Passworts'));
      }
    });
  };

  return {
    isOnline,
    isSubmitting,
    werte,
    setWert,
    sichtbar,
    sichtbarUmschalten,
    alleSichtbar,
    pruefung,
    isPasswordValid,
    passwordsMatch,
    isValid,
    fehler,
    speichern,
  };
}

export type PasswortAendernZustand = ReturnType<typeof usePasswortAendern>;
