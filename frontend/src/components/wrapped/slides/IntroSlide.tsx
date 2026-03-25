import React from 'react';
import { IonIcon } from '@ionic/react';
import { sparklesOutline } from 'ionicons/icons';
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
      <div className="wrapped-slide-decoration wrapped-slide-decoration--1" />
      <div className="wrapped-slide-decoration wrapped-slide-decoration--2" />
      <div className="wrapped-slide-decoration wrapped-slide-decoration--3" />

      <div className="wrapped-anim-fade">
        <IonIcon icon={sparklesOutline} style={{ fontSize: '3rem', opacity: 0.6, color: '#a78bfa' }} />
      </div>
      <div className="wrapped-anim-fade wrapped-anim-delay-1">
        <p className="wrapped-subtitle">Willkommen zu deinem Konfi-Jahr {year}</p>
      </div>
      <div className="wrapped-anim-bounce wrapped-anim-delay-2">
        <h1 className="wrapped-hero-text">{displayName}</h1>
      </div>
      <div className="wrapped-anim-fade wrapped-anim-delay-3">
        <p className="wrapped-subtitle" style={{ color: 'rgba(255,255,255,0.5)' }}>{jahrgangName}</p>
      </div>
    </SlideBase>
  );
};

export default IntroSlide;
