import React from 'react';
import SlideBase from '../SlideBase';
import { useCountUp } from '../../../../hooks/useCountUp';
import type { SlideProps, TeamerModerationSlide as Moderation } from '../../../../types/wrapped';

interface TeamerModerationSlideProps extends SlideProps {
  moderation: Moderation;
}

/**
 * "Die Challenge-Begleiterin" -- wie viele Beitraege jemand freigegeben hat.
 *
 * WARUM DIESE SEITE: Moderation ist Arbeit, die im System unsichtbar
 * bleibt. Jemand sieht sich jeden Beitrag an und gibt ihn frei, oft abends,
 * oft viele hintereinander -- und niemand merkt es. Diese Seite macht sie
 * sichtbar.
 *
 * NUR DIE EIGENE LEISTUNG, NIE EINE ABLEHNUNGSQUOTE (Simons Regel im
 * Konzept): Hier steht, was jemand FREIGEGEBEN hat. Wie viel jemand
 * ausgeblendet hat, kommt nicht vor -- das waere eine Bewertung der
 * Moderation, keine Erinnerung.
 */
function spruchFuer(n: number): { slogan: string[]; nachsatz: string } {
  if (n >= 50) return {
    slogan: ['Du hast alles', 'gesehen.'],
    nachsatz: `${n} Beiträge hast du freigegeben.`,
  };
  if (n >= 20) return {
    slogan: ['Du hast', 'hingeschaut.'],
    nachsatz: `${n} Beiträge sind durch deine Hände gegangen.`,
  };
  return {
    slogan: ['Du hast', 'freigegeben.'],
    nachsatz: `${n} Beiträge hast du angesehen und durchgelassen.`,
  };
}

const TeamerModerationSlide: React.FC<TeamerModerationSlideProps> = ({ isActive, moderation }) => {
  const animiert = useCountUp(moderation.freigegeben, isActive);
  const t = spruchFuer(moderation.freigegeben);

  return (
    <SlideBase isActive={isActive} className="teamer-moderation-slide" kachel="teamer-moderation">
      <div className="kat-auge">Hinter den Kulissen</div>
      <div className="kat-zahl">{animiert}</div>
      <div className="kat-slogan">
        {t.slogan.map((z, i) => <span key={i} style={{ display: 'block' }}>{z}</span>)}
      </div>
      <div className="kat-nachsatz">{t.nachsatz}</div>
    </SlideBase>
  );
};

export default TeamerModerationSlide;
