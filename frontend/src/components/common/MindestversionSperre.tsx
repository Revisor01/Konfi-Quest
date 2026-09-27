import React, { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { IonButton, IonIcon } from '@ionic/react';
import { ICON_UPGRADE } from '../shared/icons';
import { useBetriebsstatus } from '../../hooks/useBetriebsstatus';

/**
 * "Bitte aktualisiere Konfi Quest" — legt sich ueber die ganze App, wenn die
 * installierte Version unter der Mindestversion liegt, die der Betrieb fuer
 * diese Plattform gesetzt hat (Feature-Empfehlung E-05, 27.09.2026).
 *
 * Ob und wann das so ist, entscheidet services/betriebsstatus.ts: nur nativ,
 * nur mit Antwort des Servers, nie im Browser, nie ohne Netz. Die Pruefung
 * haengt einmal in App.tsx; dieser Bildschirm liest nur den Stand und rendert
 * sonst nichts.
 *
 * KEIN WEGKLICKEN: Es gibt genau einen Knopf, und der fuehrt zur Store-Seite
 * der App. Nach dem Update startet die App neu und fragt erneut.
 *
 * BAUSTEINE DES SPERRBILDSCHIRMS (.app-sperrbildschirm, theme/variables.css):
 * deckende Flaeche mit Aurora-Verlauf und Logo-Wasserzeichen, ganz oben
 * ueber Modalen und Toasts, in hellem und dunklem Modus gleich — wie die
 * Anmeldeseite ein Torhueter vor der App. App.tsx haengt diesen Bildschirm
 * NACH dem biometrischen Sperrbildschirm und VOR der Abdeckung ein: Bei
 * gleichem z-index liegt er damit ueber dem Schloss, das Vorschaubild im
 * App-Umschalter bleibt trotzdem die neutrale Abdeckung.
 *
 * BARRIEREFREI: ein Dialog mit der Ueberschrift als Namen; der Fokus springt
 * beim Erscheinen auf die Ueberschrift, damit Vorlesehilfen dort beginnen
 * und nicht in der verdeckten App darunter.
 */
const MindestversionSperre: React.FC = () => {
  const { aktualisierenUrl } = useBetriebsstatus();
  const titelRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (aktualisierenUrl) titelRef.current?.focus();
  }, [aktualisierenUrl]);

  if (!aktualisierenUrl) return null;

  const knopfText = Capacitor.getPlatform() === 'android'
    ? 'Bei Google Play aktualisieren'
    : 'Im App Store aktualisieren';

  return (
    <div
      className="app-sperrbildschirm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mindestversion-titel"
    >
      <img
        src="/assets/icon/logo-mark.png"
        alt=""
        className="app-sperrbildschirm__wasserzeichen"
        aria-hidden="true"
      />

      <div className="app-sperrbildschirm__schloss-kreis">
        <IonIcon
          className="app-sperrbildschirm__schloss"
          icon={ICON_UPGRADE}
          aria-hidden="true"
        />
      </div>

      <h1
        id="mindestversion-titel"
        ref={titelRef}
        tabIndex={-1}
        className="app-sperrbildschirm__titel"
      >
        Bitte aktualisiere Konfi Quest
      </h1>

      <p className="app-sperrbildschirm__text">
        Diese Version wird nicht mehr unterstützt. Lade die aktuelle Version, um weiterzumachen.
      </p>

      {/* Wie der Store-Hinweis (StoreUpdateBanner): window.open fuehrt auf
          dem Geraet in die Store-App. */}
      <IonButton
        className="app-sperrbildschirm__knopf"
        expand="block"
        onClick={() => window.open(aktualisierenUrl, '_blank')}
      >
        <IonIcon slot="start" icon={ICON_UPGRADE} aria-hidden="true" />
        {knopfText}
      </IonButton>
    </div>
  );
};

export default MindestversionSperre;
