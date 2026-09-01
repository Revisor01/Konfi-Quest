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
 * Dezenter Hinweis "Neue Version im Store" fuer die drei Dashboards.
 * Selbsttragend wie TrialBanner: prueft selbst (services/updateCheck) und
 * rendert nichts, wenn es nichts zu sagen gibt — die Seiten setzen ihn
 * einfach neben den TrialBanner, ohne eigene Logik.
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

  const accent = '#667eea'; // wie der ruhige Zustand des TrialBanners

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Version ${info.version} ist verfügbar. Im Store ansehen`}
      onClick={() => window.open(info.url, '_blank')}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          window.open(info.url, '_blank');
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        margin: '0 16px 12px',
        padding: '12px 14px',
        background: 'rgba(102, 126, 234, 0.08)',
        border: `1px solid ${accent}33`,
        borderRadius: '12px',
        cursor: 'pointer',
        ...style
      }}
    >
      <IonIcon
        icon={arrowUpCircleOutline}
        aria-hidden="true"
        style={{ color: accent, fontSize: '1.3rem', flexShrink: 0 }}
      />
      <div style={{ fontSize: '0.88rem', color: '#333', lineHeight: 1.35, flex: 1 }}>
        <strong style={{ color: accent }}>
          Version {info.version} ist da
        </strong>
        <div style={{ color: '#666', fontSize: '0.82rem' }}>
          Tippen, um das Update im Store zu laden.
        </div>
      </div>
      <button
        type="button"
        aria-label="Hinweis ausblenden"
        onClick={(e) => {
          // Das X blendet nur aus — es darf NICHT gleichzeitig den Store oeffnen.
          e.stopPropagation();
          merkeHinweisWeggeklickt(info.version);
          setInfo(null);
        }}
        style={{
          background: 'none',
          border: 'none',
          padding: '4px',
          color: '#999',
          fontSize: '1.1rem',
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
          cursor: 'pointer'
        }}
      >
        <IonIcon icon={closeOutline} aria-hidden="true" />
      </button>
    </div>
  );
};

export default StoreUpdateBanner;
