import React, { useState, useEffect, useCallback } from 'react';
import { IonIcon, useIonAlert } from '@ionic/react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { PushNotifications } from '@capacitor/push-notifications';
import { ICON_BENACHRICHTIGUNG } from './icons';

/**
 * Zeigt, ob Mitteilungen eingerichtet sind — zum Vorlesen.
 *
 * WARUM ES DAS GIBT (23.09.2026):
 *
 * Eine Fehlersuche zu fehlenden Push-Nachrichten auf Android hat einen ganzen
 * Abend gekostet, weil niemand sehen konnte, was auf dem Geraet los ist. Ein
 * Tester meldete sich dreimal an, in den Server-Logs stand kein einziger
 * Registrierungsversuch — und es war nicht zu unterscheiden, ob
 *
 *   - die App noch die alte Fassung war,
 *   - die Berechtigung fehlte,
 *   - oder der Weg zum Token gar nicht lief.
 *
 * Alle drei sahen gleich aus: wie Stille. Diese Anzeige macht den Unterschied
 * sichtbar, ohne dass jemand ein Geraet an den Rechner haengt: Die Person
 * tippt darauf und liest vor, was dasteht.
 *
 * BEWUSST OHNE DEN TOKEN: Der ist ein Schluessel zum Zustellen von Nachrichten
 * und hat auf einem Bildschirm nichts zu suchen, den jemand abfotografiert.
 * Fuer die Frage "hat sich das Geraet registriert" genuegt das Server-Protokoll
 * (routes/notifications.js) — hier steht nur, was die Person selbst pruefen
 * und vorlesen kann.
 */

type Zustand = {
  version: string;
  build: string;
  plattform: string;
  berechtigung: string;
};

const PushDiagnose: React.FC<{ variante?: string }> = ({ variante = 'purple' }) => {
  const [zustand, setZustand] = useState<Zustand | null>(null);
  const [presentAlert] = useIonAlert();

  useEffect(() => {
    let abgebrochen = false;
    const laden = async () => {
      let version = '—', build = '—', berechtigung = 'unbekannt';
      try {
        const info = await App.getInfo();
        version = info.version || '—';
        build = info.build || '—';
      } catch { /* im Browser nicht verfuegbar */ }
      try {
        berechtigung = (await PushNotifications.checkPermissions()).receive;
      } catch { /* im Browser nicht verfuegbar */ }
      if (!abgebrochen) {
        setZustand({ version, build, plattform: Capacitor.getPlatform(), berechtigung });
      }
    };
    laden();
    return () => { abgebrochen = true; };
  }, []);

  // Die Berechtigung in Worten, die man am Telefon vorlesen kann.
  const berechtigungKlartext = (w: string) => {
    if (w === 'granted') return 'erlaubt';
    if (w === 'denied') return 'NICHT erlaubt';
    if (w === 'prompt' || w === 'prompt-with-rationale') return 'noch nicht gefragt';
    return w;
  };

  const zeigen = useCallback(() => {
    if (!zustand) return;
    const erlaubt = zustand.berechtigung === 'granted';
    presentAlert({
      header: 'Mitteilungen',
      message:
        `<div style="text-align:left;line-height:1.7">` +
        `<b>App:</b> ${zustand.version} (${zustand.build})<br>` +
        `<b>Gerät:</b> ${zustand.plattform}<br>` +
        `<b>Mitteilungen:</b> ${berechtigungKlartext(zustand.berechtigung)}<br><br>` +
        (erlaubt
          ? `Alles eingerichtet. Kommt trotzdem nichts an, bitte diese Angaben durchgeben — dann ist im Protokoll nachvollziehbar, woran es liegt.`
          : `<b>Hier klemmt es.</b> Mitteilungen sind für Konfi Quest nicht erlaubt. ` +
            `In den Einstellungen des Geräts bei „Apps → Konfi Quest → Benachrichtigungen“ einschalten, ` +
            `danach die App einmal schließen und neu öffnen.`) +
        `</div>`,
      buttons: ['Schließen'],
    });
  }, [zustand, presentAlert]);

  if (!zustand) return null;

  const stimmt = zustand.berechtigung === 'granted';

  return (
    <div
      className={`app-list-item app-list-item--${variante}`}
      style={{ width: '100%', cursor: 'pointer' }}
      onClick={zeigen}
    >
      <div className="app-list-item__row">
        <div className="app-list-item__main">
          <div className={`app-icon-circle app-icon-circle--${stimmt ? variante : 'danger'}`}>
            <IonIcon icon={ICON_BENACHRICHTIGUNG} />
          </div>
          <div className="app-list-item__content">
            <div className="app-list-item__title">Mitteilungen prüfen</div>
            <div className="app-list-item__meta">
              <span className="app-list-item__meta-item">
                {stimmt
                  ? `${zustand.version} (${zustand.build}) · erlaubt`
                  : `${zustand.version} (${zustand.build}) · ${berechtigungKlartext(zustand.berechtigung)}`}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PushDiagnose;
