import React from 'react';
import { IonIcon } from '@ionic/react';
import { sparklesOutline } from 'ionicons/icons';
import SlideBase from './SlideBase';
import type { SlideProps } from '../../../types/wrapped';

interface IntroSlideProps extends SlideProps {
  displayName: string;
  jahrgangName: string;
  year: number;
  /**
   * Name der Ausgabe ("Zwischenstand", "Dein Abschluss"). Ab 03.09.2026.
   *
   * Simon: "Die erste Seite des Slides muss natuerlich auch 'Willkommen zu
   * deinem Zwischenstand' heissen." Vorher stand hier fest "Konfi-Jahr
   * {year}" -- bei einer Zwischenstands-Ausgabe war das schlicht falsch.
   *
   * Ohne Titel (Alt-Snapshots) bleibt es bei der bisherigen Ueberschrift,
   * damit bereits erzeugte Rueckblicke unveraendert aussehen.
   */
  titel?: string | null;
}

/**
 * Die Ueberschrift in bis zu drei Zeilen brechen -- die Typo lebt vom
 * Umbruch. "Zwischenstand September" wird zu "Zwischenstand / September",
 * nicht zu einer Zeile, die aus dem Bild laeuft.
 */
function zeilen(titel: string): string[] {
  const worte = titel.trim().split(/\s+/);
  if (worte.length <= 1) return worte;
  if (worte.length === 2) return worte;
  // Bei mehr Worten: erste Zeile ein Wort, Rest zusammen.
  return [worte[0], worte.slice(1).join(' ')];
}

const IntroSlide: React.FC<IntroSlideProps> = ({ isActive, displayName, jahrgangName, year, titel }) => {
  const ueberschrift = titel && titel.trim()
    ? zeilen(titel)
    : ['Konfi-', 'Jahr', String(year)];

  return (
    <SlideBase isActive={isActive} className="intro-slide">
      <div className="wrapped-slide-decoration wrapped-slide-decoration--1" />
      <div className="wrapped-slide-decoration wrapped-slide-decoration--2" />
      <div className="wrapped-slide-decoration wrapped-slide-decoration--3" />

      <div className="wrapped-anim-fly-left">
        <p className="wrapped-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <IonIcon icon={sparklesOutline} style={{ fontSize: '1rem' }} />
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
        <p className="wrapped-subtitle" style={{ marginTop: '16px' }}>{displayName}</p>
      </div>
      <div className="wrapped-anim-fade wrapped-anim-delay-3">
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', marginTop: '4px' }}>{jahrgangName}</p>
      </div>
    </SlideBase>
  );
};

export default IntroSlide;
