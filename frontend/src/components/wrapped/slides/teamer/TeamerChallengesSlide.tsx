import React from 'react';
import SlideBase from '../SlideBase';
import type { SlideProps } from '../../../../types/wrapped';

interface Props extends SlideProps {
  gestellt: number;
}

/**
 * Was du dem Jahrgang aufgegeben hast.
 *
 * SIMON, 09.09.2026: "Challenges und Zertifikate koennten sich bei Teamern
 * eine wrapped Seite erzeugen. Das waere ja richtig wichtig. [...] Wir sind
 * ja auch froh wenn die das machen."
 *
 * NICHT ZU VERWECHSELN mit 'teamer-moderation': Die zaehlt FREIGABEN, also
 * die Arbeit an fremden Beitraegen. Hier geht es um die Challenge selbst --
 * den Einfall, den jemand aufgeschrieben und weitergegeben hat.
 */
const TeamerChallengesSlide: React.FC<Props> = ({ isActive, gestellt }) => {
  const slogan = gestellt >= 5
    ? ['Du gibst', 'den Ton an.']
    : gestellt >= 2
      ? ['Deine Ideen', 'machen Runde.']
      : ['Du hast dir', 'was ausgedacht.'];

  const nachsatz = gestellt === 1
    ? 'Eine Challenge, die es ohne dich nicht gegeben hätte.'
    : `${gestellt} Challenges, die es ohne dich nicht gegeben hätte.`;

  return (
    <SlideBase isActive={isActive} className="teamer-challenges-slide" kachel="teamer-challenges">
      <div className="kat-auge">Deine Challenges</div>
      <div className="kat-zahl">{gestellt}</div>
      <div className="kat-slogan">
        {slogan.map((z, i) => <span key={i} style={{ display: 'block' }}>{z}</span>)}
      </div>
      <div className="kat-nachsatz">{nachsatz}</div>
    </SlideBase>
  );
};

export default TeamerChallengesSlide;
