import React from 'react';

/**
 * Einheitlicher Branding-Footer fuer alle Apps ("Made with Spirit in Hennstedt").
 * Die Taube symbolisiert den Heiligen Geist, "Friede. Schalom. Salam." ist der
 * Friedensgruss in drei Sprachen. Gehoert in den Footer der Profil-/Mehr-Seiten.
 */
const SpiritFooter: React.FC = () => {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '8px 16px 24px',
        color: 'var(--ion-color-medium, #8e8e93)',
        fontSize: '0.8rem',
        fontStyle: 'italic',
        lineHeight: 1.5
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
        <svg
          width="15"
          height="15"
          viewBox="0 0 512 512"
          fill="#ef4444"
          role="img"
          aria-label="Friedenstaube"
          style={{ verticalAlign: 'middle', transform: 'translateY(1px)' }}
        >
          <path d="M192 96c-53 0-96 43-96 96 0 8 1 16 3 24-30 8-67 30-83 78-3 9 6 17 14 12 28-17 56-22 76-22-21 36-58 60-58 60s44 6 88-18c-4 22-18 44-40 60 0 0 70 8 116-44 8 30 4 64-12 92 0 0 80-32 96-128 4-26-2-50-14-70 18-6 38-18 54-40 5-7-2-16-10-13-18 6-34 8-46 7 14-16 24-38 24-66 0-6-7-10-12-6-22 16-40 34-50 51-14-20-30-37-50-50z" />
          <circle cx="148" cy="180" r="11" fill="#0b1220" />
        </svg>
        <span>in Hennstedt</span>
      </div>
      <div style={{ marginTop: '2px', opacity: 0.85 }}>Friede. Schalom. Salam.</div>
    </div>
  );
};

export default SpiritFooter;
