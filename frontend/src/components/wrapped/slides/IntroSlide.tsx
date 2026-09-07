import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_FUNKELN } from '../../shared/icons';
import SlideBase from './SlideBase';
import { konfiUeberschrift } from '../ueberschrift';
import type { SlideProps } from '../../../types/wrapped';

interface IntroSlideProps extends SlideProps {
  displayName: string;
  jahrgangName: string;
  year: number;
  /**
   * Konfirmationstermin und Stand des Rueckblicks -- daraus entsteht die
   * Ueberschrift. Der frueher hier uebergebene freie `titel` ist am
   * 07.09.2026 entfallen (Simon: "Dann braucht es auch keine Titel.").
   */
  konfirmation?: string | null;
  stand?: string | null;
}

const IntroSlide: React.FC<IntroSlideProps> = ({ isActive, displayName, jahrgangName, year: _year, konfirmation, stand }) => {
  // "Deine Konfi-Zeit", mit "(bis jetzt)" solange die Konfirmation noch
  // mehr als 30 Tage entfernt ist (Simons Regel, 07.09.2026). `year` bleibt
  // in der Schnittstelle stehen: Der Snapshot fuehrt das Feld weiter, und
  // ausgelieferte Apps lesen es.
  const ueberschrift = konfiUeberschrift(konfirmation, stand);

  return (
    <SlideBase isActive={isActive} className="intro-slide">
      <div className="wrapped-slide-decoration wrapped-slide-decoration--1" />
      <div className="wrapped-slide-decoration wrapped-slide-decoration--2" />
      <div className="wrapped-slide-decoration wrapped-slide-decoration--3" />

      <div className="wrapped-anim-fly-left">
        <p className="wrapped-label" style={{ display: 'flex', alignItems: 'center', gap: 'var(--app-abstand-kompakt)' }}>
          <IonIcon icon={ICON_FUNKELN} style={{ fontSize: 'var(--app-text-standard)' }} />
          Willkommen zu deinem
        </p>
      </div>
      <div className="wrapped-anim-fly-left wrapped-anim-delay-1">
        <h1 className="wrapped-hero-text">
          {ueberschrift.map((zeile, i) => (
            <React.Fragment key={i}>
              {zeile}{i < ueberschrift.length - 1 && <br />}
            </React.Fragment>
          ))}
        </h1>
      </div>
      <div className="wrapped-anim-fade wrapped-anim-delay-2">
        <p className="wrapped-subtitle" style={{ marginTop: 'var(--app-abstand-basis)' }}>{displayName}</p>
      </div>
      <div className="wrapped-anim-fade wrapped-anim-delay-3">
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 'var(--app-text-basis)', marginTop: 'var(--app-abstand-mini)' }}>{jahrgangName}</p>
      </div>
    </SlideBase>
  );
};

export default IntroSlide;
