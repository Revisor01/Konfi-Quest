import React from 'react';
import SlideBase from '../SlideBase';
import { teamerUeberschrift } from '../../ueberschrift';
import type { SlideProps } from '../../../../types/wrapped';

interface TeamerIntroSlideProps extends SlideProps {
  displayName: string;
  year: number;
}

const TeamerIntroSlide: React.FC<TeamerIntroSlideProps> = ({ isActive, displayName, year }) => {
  // "Dein Teamerjahr 2026" -- der Team-Rueckblick ist seit dem 07.09.2026
  // immer ein volles Kalenderjahr, also sagt die Ueberschrift welches.
  // Freie Titel gibt es nicht mehr (Simon: "Dann braucht es auch keine
  // Titel.").
  const ueberschrift = teamerUeberschrift(year);

  return (
    <SlideBase isActive={isActive} className="teamer-intro-slide" kachel="teamer-intro">
      <div className="kat-auge">Willkommen zu deinem</div>
      <div className="kat-slogan">
        {ueberschrift.map((z, i) => <span key={i} style={{ display: 'block' }}>{z}</span>)}
      </div>
      <div className="kat-nachsatz" style={{ fontWeight: 'var(--app-schrift-fett)', fontSize: 'var(--app-text-untertitel)' }}>{displayName}</div>
    </SlideBase>
  );
};

export default TeamerIntroSlide;
