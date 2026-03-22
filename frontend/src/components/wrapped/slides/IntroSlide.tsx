import React from 'react';
import SlideBase from './SlideBase';
import type { SlideProps } from '../../../types/wrapped';

interface IntroSlideProps extends SlideProps {
  displayName: string;
  jahrgangName: string;
  year: number;
}

const IntroSlide: React.FC<IntroSlideProps> = ({ isActive, displayName, jahrgangName, year }) => {
  return (
    <SlideBase isActive={isActive} className="intro-slide">
      <div className="wrapped-anim-fade">
        <p className="wrapped-subtitle">Willkommen zu deinem</p>
      </div>
      <div className="wrapped-anim-fade wrapped-anim-delay-1">
        <h1 className="wrapped-big-number" style={{ fontSize: 'clamp(2rem, 8vw, 3.5rem)' }}>
          Konfi-Jahr {year}
        </h1>
      </div>
      <div className="wrapped-anim-fade wrapped-anim-delay-2">
        <p className="wrapped-subtitle">{displayName}</p>
        <p style={{ color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>{jahrgangName}</p>
      </div>
    </SlideBase>
  );
};

export default IntroSlide;
