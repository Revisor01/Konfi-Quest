// „Konto löschen" (das eigene) als Logik ohne Darstellung -- für alle drei
// Rollen. Die App zeigt sie im Modal (DeleteAccountModal), der Browser ab
// 992 px im Dialog (web/konto/WebKontoLoeschenDialog; Simon, 15.10.2026: im
// Browser bekommt jedes Formular, das noch ein App-Modal öffnet, ein kompaktes
// Web-Fenster). Sicherung, Aufruf und Texte stehen nur hier.
//
// Sicherung: das eigene Passwort. Ohne Passwort geht nichts an den Server;
// POST /auth/delete-account { password } -- ein 400 heißt „Passwort ist
// falsch" und steht am Feld, andere Fehler zeigt die App am Rand (setError),
// der Web-Dialog in sich selbst. Danach schließt der Aufrufer und die
// Anmeldung endet (signOut räumt Token, Zwischenspeicher und Zustand).

import { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useActionGuard } from '../../hooks/useActionGuard';
import api from '../../services/api';
import { fehlerStatus, fehlerText } from '../../utils/fehler';
import { eigenesKontoLoeschHinweis } from '../../utils/kontoLoeschen';

export interface KontoLoeschenOptionen {
  /** Das Konto ist gelöscht: Der Aufrufer schließt; die Abmeldung folgt. */
  onGeloescht: () => void;
  /** true (Web-Dialog): auch Serverfehler stehen im Formular. false (App, Vorgabe): am Rand (setError). */
  fehlerImFormular?: boolean;
}

export function useKontoLoeschen({ onGeloescht, fehlerImFormular = false }: KontoLoeschenOptionen) {
  const { setError: meldungAmRand, isOnline, signOut, user } = useApp();
  const { isSubmitting, guard } = useActionGuard();

  const [password, setPasswordWert] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // Die Meldung am Feld (fehlendes oder falsches Passwort; im Web-Dialog jede).
  const [inlineError, setInlineError] = useState('');

  // Wohin ein Serverfehler geht. Heisst setError wie ueberall, damit die
  // Positivliste der Fehlertexte (utils/bekannteFehlertexte.ts) die
  // Aufrufstelle unten findet.
  const setError = (meldung: string) => (fehlerImFormular ? setInlineError(meldung) : meldungAmRand(meldung));

  /** Tippen räumt eine alte Meldung weg. */
  const setPassword = (wert: string) => {
    setPasswordWert(wert);
    setInlineError('');
  };

  const loeschen = async () => {
    if (!password) {
      setInlineError('Bitte gib dein Passwort zur Bestätigung ein');
      return;
    }

    await guard(async () => {
      try {
        await api.post('/auth/delete-account', { password });

        // Account gelöscht: sauber ausloggen (räumt Token/Cache + State -> Login).
        onGeloescht();
        await signOut();
      } catch (err) {
        if (fehlerStatus(err) === 400) {
          setInlineError('Passwort ist falsch');
        } else {
          setError(fehlerText(err, 'Fehler beim Löschen des Accounts'));
        }
      }
    });
  };

  return {
    password,
    setPassword,
    showPassword,
    setShowPassword,
    inlineError,
    isSubmitting,
    isOnline,
    isValid: password.length > 0,
    loeschen,
    /** Was mit dem Konto verschwindet -- derselbe Wortlaut wie in den Abfragen der Leitung. */
    hinweis: eigenesKontoLoeschHinweis(user?.role_name === 'konfi'),
  };
}

export type KontoLoeschenZustand = ReturnType<typeof useKontoLoeschen>;
