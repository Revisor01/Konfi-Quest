import React, { useEffect, useState } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

/**
 * Einheitlicher Branding-Footer fuer alle Apps ("Made with Spirit in Hennstedt").
 * Die Taube symbolisiert den Heiligen Geist, "Friede. Schalom. Salam." ist der
 * Friedensgruss in drei Sprachen. Abgesetzt in einer dezenten Card, am Ende der
 * Profil-Seiten. Vogel als PNG (wie bei den anderen Apps), nicht als Inline-SVG.
 */
const SpiritFooter: React.FC = () => {
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      App.getInfo()
        .then((info) => setVersion(info.version))
        .catch(() => setVersion(''));
    }
  }, []);

  return (
    <div style={{ padding: '8px 16px 0' }}>
      <div
        style={{
          background: '#ffffff',
          borderRadius: '14px',
          padding: '16px 12px',
          textAlign: 'center',
          color: 'var(--ion-color-medium, #8e8e93)',
          fontSize: '0.8rem',
          lineHeight: 1.5,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)'
        }}
      >
        {version && (
          <div style={{ marginBottom: '4px' }}>Konfi Quest v{version}</div>
        )}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            flexWrap: 'wrap',
            justifyContent: 'center'
          }}
        >
          <span>Made with</span>
          <img
            src="/assets/branding/bird.png"
            alt="Friedenstaube"
            style={{ width: '14px', height: '14px', verticalAlign: 'middle' }}
          />
          <span>in Hennstedt</span>
        </div>
        <div style={{ marginTop: '3px', fontStyle: 'italic', opacity: 0.8 }}>
          Friede. Schalom. Salam.
        </div>
      </div>
    </div>
  );
};

export default SpiritFooter;
