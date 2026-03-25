import React from 'react';
import { IonIcon } from '@ionic/react';
import { compassOutline } from 'ionicons/icons';
import type { SlideProps, KonfiKategorieSlide } from '../../../types/wrapped';
import SlideBase from './SlideBase';

interface KategorieSlideProps extends SlideProps {
  kategorie: KonfiKategorieSlide;
  titel?: string;
}

/** Erster Buchstabe gross */
function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const KategorieSlide: React.FC<KategorieSlideProps> = ({ isActive, kategorie, titel }) => {
  const maxCount = kategorie.verteilung.length > 0
    ? Math.max(...kategorie.verteilung.map(k => k.count))
    : 1;

  // Maximal 5 Kategorien anzeigen
  const topKategorien = kategorie.verteilung.slice(0, 5);

  return (
    <SlideBase isActive={isActive} className="kategorie-slide">
      <div className="wrapped-anim-fade">
        <IonIcon icon={compassOutline} style={{ fontSize: '2.5rem', opacity: 0.7, color: '#a78bfa' }} />
      </div>
      <div className="wrapped-anim-fade wrapped-anim-delay-1">
        <p className="wrapped-label">{titel || 'Dein Schwerpunkt'}</p>
      </div>
      {kategorie.top_kategorie ? (
        <>
          <div className="wrapped-anim-bounce wrapped-anim-delay-1">
            <p className="wrapped-hero-text" style={{ fontSize: 'clamp(1.8rem, 8vw, 3rem)' }}>
              {capitalize(kategorie.top_kategorie)}
            </p>
          </div>
          <div className="wrapped-anim-fade wrapped-anim-delay-2">
            <div className="kategorie-bars">
              {topKategorien.map((k, i) => (
                <div key={k.kategorie} className="kategorie-bar-row wrapped-anim-fly-left" style={{ animationDelay: `${0.4 + i * 0.15}s` }}>
                  <span className="kategorie-bar-name">{capitalize(k.kategorie)}</span>
                  <div className="kategorie-bar-track">
                    <div
                      className="kategorie-bar-fill"
                      style={{ width: isActive ? `${(k.count / maxCount) * 100}%` : '0%' }}
                    />
                  </div>
                  <span className="kategorie-bar-count">{k.count}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="wrapped-anim-fade wrapped-anim-delay-1">
          <p className="wrapped-subtitle">Noch keine Aktivitaeten</p>
        </div>
      )}
    </SlideBase>
  );
};

export default KategorieSlide;
