import React, { useEffect, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_SCHLIESSEN, ICON_UPGRADE } from './icons';
import { tastaturKlick } from '../../utils/tastatur';
import {
  pruefeStoreUpdate,
  istHinweisWeggeklickt,
  merkeHinweisWeggeklickt,
  holeUpdateImHintergrund,
  installiereGeladenesUpdate,
  StoreUpdateInfo
} from '../../services/updateCheck';
import { linkOeffnen } from '../../services/systemDialoge';

/**
 * Hinweis "Neue Version im Store" fuer die drei Dashboards.
 * Selbsttragend wie TrialBanner: prueft selbst (services/updateCheck) und
 * rendert nichts, wenn es nichts zu sagen gibt — die Seiten setzen ihn
 * einfach neben den TrialBanner, ohne eigene Logik.
 *
 * FORM: dieselbe Karte wie "Was ist neu?" (.app-whatsnew), nur in Blau
 * (.app-whatsnew--store). Simons Wunsch vom 02.09.2026 — vorher war das ein
 * eigener, blasser Streifen, der neben den kraeftigen Neuerungs-Karten wie
 * ein Fremdkoerper wirkte. Eine Form fuer alle Hinweise, die Farbe
 * unterscheidet sie: rosa "Was ist neu", gruen Mitmachen, blau Store.
 *
 * BEWUSST NUR EIN HINWEIS, KEINE BLOCKADE: Tippen oeffnet die Store-Seite
 * der App (App Store bzw. Google Play), das X blendet den Hinweis dauerhaft
 * fuer DIESE Version aus. Erst die naechste Version bringt ihn wieder.
 * Offline oder bei Fehlern erscheint schlicht nichts (updateCheck.ts).
 *
 * ANDROID (09.10.2026): Dort holt die App das Update zuerst selbst ueber
 * Googles flexibles In-App-Update (holeUpdateImHintergrund). Waehrend des
 * Ladens steht hier nichts; ist es geladen, sagt dieselbe Karte "Neustarten
 * zum Aktualisieren", und Tippen installiert es. Verneint die Nutzerin
 * Googles Rueckfrage, gilt das wie das X. Kann Google nicht, bleibt es bei
 * der Karte mit Store-Link. Auf iOS aendert sich nichts: Die Store-Karte
 * unten ist dieselbe wie vorher.
 */
// Standardabstand wie bei NeuerungenBanner (Simon, 06.09.2026): Ohne ihn
// klebte das Banner in der Leitungsansicht (KonfisView) an beiden Raendern
// und fuellte die volle Breite -- dort wurde es ohne style eingebunden,
// waehrend Konfi- und Teamer-Startseite je einen mitgaben. Ein Standardwert
// verhindert, dass eine weitere Rolle ihn wieder vergisst.
const StoreUpdateBanner: React.FC<{ style?: React.CSSProperties }> = ({
  style = { margin: 'var(--app-abstand-eng) var(--app-abstand-basis) 0' },
}) => {
  const [info, setInfo] = useState<StoreUpdateInfo | null>(null);
  // Android: Merkname des geladenen Updates — dann sagt die Karte
  // "Neustarten zum Aktualisieren", und Tippen installiert.
  const [geladen, setGeladen] = useState<string | null>(null);

  useEffect(() => {
    let aktiv = true;
    // Ausserhalb von Android meldet holeUpdateImHintergrund sofort
    // 'nicht_moeglich', ohne das Plugin anzufassen.
    Promise.all([pruefeStoreUpdate(), holeUpdateImHintergrund()])
      .then(async ([ergebnis, hintergrund]) => {
        if (!aktiv) return;
        if (hintergrund.zustand === 'bereit' && hintergrund.schluessel) {
          setGeladen(hintergrund.schluessel);
          return;
        }
        // Verneint oder weggetippt: auch keine Karte mit Store-Link.
        if (hintergrund.zustand !== 'nicht_moeglich') return;
        if (!ergebnis) return;
        if (await istHinweisWeggeklickt(ergebnis.version)) return;
        if (aktiv) setInfo(ergebnis);
      })
      .catch(() => { /* updateCheck wirft nie — doppelt haelt besser */ });
    return () => { aktiv = false; };
  }, []);

  // Eine Karte fuer beide Faelle: Store-Link oder (Android) geladenes Update.
  const karte = geladen
    ? {
        titel: 'Das Update ist geladen',
        zeile: 'Hier tippen: Neustarten zum Aktualisieren.',
        name: 'Das Update ist geladen. Neustarten zum Aktualisieren',
        tippen: () => { void installiereGeladenesUpdate(); },
        merkname: geladen,
      }
    : info
      ? {
          titel: `Version ${info.version} ist da`,
          zeile: 'Hier tippen, um das Update im Store zu laden.',
          name: `Version ${info.version} ist verfügbar. Im Store ansehen`,
          tippen: () => linkOeffnen(info.url),
          merkname: info.version,
        }
      : null;

  if (!karte) return null;

  return (
    // Kein Knopf im Knopf: Karte role="presentation", Knopf ist der Text, das
    // X steht daneben -- Begründung in UpdateHinweisKarte.tsx.
    <div
      className="app-whatsnew app-whatsnew--store"
      role="presentation"
      style={style}
      onClick={karte.tippen}
    >
      <IonIcon
        icon={ICON_UPGRADE}
        className="app-whatsnew__icon"
        aria-hidden="true"
      />
      <div
        className="app-whatsnew__text"
        role="button"
        tabIndex={0}
        aria-label={karte.name}
        onKeyDown={tastaturKlick}
      >
        <span className="app-whatsnew__title">{karte.titel}</span>
        <span className="app-whatsnew__sub">{karte.zeile}</span>
      </div>
      <button
        type="button"
        className="app-whatsnew__close"
        aria-label="Hinweis ausblenden"
        onClick={(e) => {
          // Das X blendet nur aus — es darf NICHT gleichzeitig den Store oeffnen.
          e.stopPropagation();
          merkeHinweisWeggeklickt(karte.merkname);
          setGeladen(null);
          setInfo(null);
        }}
      >
        <IonIcon icon={ICON_SCHLIESSEN} aria-hidden="true" />
      </button>
    </div>
  );
};

export default StoreUpdateBanner;
