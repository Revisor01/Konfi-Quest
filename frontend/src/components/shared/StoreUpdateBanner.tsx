import React, { useEffect, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { arrowUpCircleOutline, closeOutline } from 'ionicons/icons';
import {
  pruefeStoreUpdate,
  istHinweisWeggeklickt,
  merkeHinweisWeggeklickt,
  StoreUpdateInfo
} from '../../services/updateCheck';

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
 */
const StoreUpdateBanner: React.FC<{ style?: React.CSSProperties }> = ({ style }) => {
  const [info, setInfo] = useState<StoreUpdateInfo | null>(null);

  useEffect(() => {
    let aktiv = true;
    pruefeStoreUpdate()
      .then(async (ergebnis) => {
        if (!ergebnis || !aktiv) return;
        if (await istHinweisWeggeklickt(ergebnis.version)) return;
        if (aktiv) setInfo(ergebnis);
      })
      .catch(() => { /* updateCheck wirft nie — doppelt haelt besser */ });
    return () => { aktiv = false; };
  }, []);

  if (!info) return null;

  const oeffneStore = () => window.open(info.url, '_blank');

  return (
    <div
      className="app-whatsnew app-whatsnew--store"
      role="button"
      tabIndex={0}
      style={style}
      aria-label={`Version ${info.version} ist verfügbar. Im Store ansehen`}
      onClick={oeffneStore}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          oeffneStore();
        }
      }}
    >
      <IonIcon
        icon={arrowUpCircleOutline}
        className="app-whatsnew__icon"
        aria-hidden="true"
      />
      <div className="app-whatsnew__text">
        <span className="app-whatsnew__title">Version {info.version} ist da</span>
        <span className="app-whatsnew__sub">
          Hier tippen, um das Update im Store zu laden.
        </span>
      </div>
      <button
        type="button"
        className="app-whatsnew__close"
        aria-label="Hinweis ausblenden"
        onClick={(e) => {
          // Das X blendet nur aus — es darf NICHT gleichzeitig den Store oeffnen.
          e.stopPropagation();
          merkeHinweisWeggeklickt(info.version);
          setInfo(null);
        }}
      >
        <IonIcon icon={closeOutline} aria-hidden="true" />
      </button>
    </div>
  );
};

export default StoreUpdateBanner;
