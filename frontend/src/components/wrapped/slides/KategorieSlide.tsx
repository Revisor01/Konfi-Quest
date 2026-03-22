import React from 'react';
import type { SlideProps, KonfiKategorieSlide } from '../../../types/wrapped';
import SlideBase from './SlideBase';

interface KategorieSlideProps extends SlideProps {
  kategorie: KonfiKategorieSlide;
  titel?: string;
}

const KategorieSlide: React.FC<KategorieSlideProps> = ({ isActive, kategorie, titel }) => {
  const maxCount = kategorie.verteilung.length > 0
    ? Math.max(...kategorie.verteilung.map(k => k.count))
    : 1;

  // Maximal 5 Kategorien anzeigen
  const topKategorien = kategorie.verteilung.slice(0, 5);

  return (
    <SlideBase isActive={isActive} className="kategorie-slide">
      <div className="wrapped-anim-fade" style={{ opacity: 0 }}>
        <p className="wrapped-label">{titel || 'Dein Bereich'}</p>
      </div>
      {kategorie.top_kategorie ? (
        <>
          <div className="wrapped-anim-scale wrapped-anim-delay-1" style={{ opacity: 0 }}>
            <p className="wrapped-big-number" style={{ fontSize: 'clamp(1.8rem, 8vw, 3rem)' }}>
              {kategorie.top_kategorie}
            </p>
          </div>
          <div className="wrapped-anim-fade wrapped-anim-delay-2" style={{ opacity: 0 }}>
            <div className="kategorie-bars">
              {topKategorien.map((k) => (
                <div key={k.kategorie} className="kategorie-bar-row">
                  <span className="kategorie-bar-name">{k.kategorie}</span>
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
        <div className="wrapped-anim-fade wrapped-anim-delay-1" style={{ opacity: 0 }}>
          <p className="wrapped-subtitle">Noch keine Aktivit&#228;ten</p>
        </div>
      )}
    </SlideBase>
  );
};

export default KategorieSlide;
