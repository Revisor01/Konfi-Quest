import React from 'react';
import { IonCard, IonCardContent } from '@ionic/react';

/**
 * Einheitlicher Branding-Footer fuer alle Apps ("Made with Spirit in Hennstedt").
 * Die Taube symbolisiert den Heiligen Geist, "Friede. Schalom. Salam." ist der
 * Friedensgruss in drei Sprachen. Nutzt dieselbe app-card wie die Listen darueber,
 * damit Rahmen/Schatten exakt konsistent sind. Vogel als PNG (wie die anderen Apps).
 */
const SpiritFooter: React.FC = () => {
  return (
    <IonCard className="app-card" style={{ margin: '16px' }}>
      <IonCardContent
        style={{
          textAlign: 'center',
          color: 'var(--ion-color-medium, #8e8e93)',
          fontSize: '0.8rem',
          lineHeight: 1.5,
          padding: '16px 12px'
        }}
      >
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
      </IonCardContent>
    </IonCard>
  );
};

export default SpiritFooter;
