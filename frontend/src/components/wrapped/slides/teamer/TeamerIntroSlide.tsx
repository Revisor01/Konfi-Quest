import React from 'react';
import SlideBase from '../SlideBase';
import type { SlideProps } from '../../../../types/wrapped';

interface TeamerIntroSlideProps extends SlideProps {
  displayName: string;
  year: number;
  /** Name der Ausgabe -- wie beim Konfi-Rueckblick. */
  titel?: string | null;
}

/** Ueberschrift in bis zu drei Zeilen brechen. */
function zeilen(titel: string): string[] {
  const w = titel.trim().split(/\s+/);
  if (w.length <= 2) return w;
  return [w[0], w.slice(1).join(' ')];
}

const TeamerIntroSlide: React.FC<TeamerIntroSlideProps> = ({ isActive, displayName, year, titel }) => {
  const ueberschrift = titel && titel.trim() ? zeilen(titel) : ['Teamer-', 'Jahr', String(year)];

  return (
    <SlideBase isActive={isActive} className="teamer-intro-slide" kachel="teamer-intro">
      <div className="kat-auge">Willkommen zu deinem</div>
      <div className="kat-slogan">
        {ueberschrift.map((z, i) => <span key={i} style={{ display: 'block' }}>{z}</span>)}
      </div>
      <div className="kat-nachsatz" style={{ fontWeight: 700, fontSize: 20 }}>{displayName}</div>
    </SlideBase>
  );
};

export default TeamerIntroSlide;
