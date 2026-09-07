import React from 'react';
import SlideBase from './SlideBase';
import { useCountUp } from '../../../hooks/useCountUp';
import type { SlideProps, KonfiLangerAtemSlide } from '../../../types/wrapped';

interface LangerAtemSlideProps extends SlideProps {
  langerAtem: KonfiLangerAtemSlide;
}

/**
 * "Der lange Atem" -- die Spanne zwischen erstem und letztem Termin.
 *
 * Die Aussage ist "du warst ueber das ganze Jahr hinweg dabei", nicht "du
 * hast viele Termine". Deshalb steht hier die SPANNE gross und nicht die
 * Menge -- die Menge hat ihre eigene Seite.
 *
 * Die Seite erscheint erst ab fuenf Terminen (Bedingung im Backend): Bei
 * zwei Terminen im September und im Mai waeren es rechnerisch auch 240
 * Tage, aber die Zahl erzaehlte dann das Gegenteil.
 */
const LangerAtemSlide: React.FC<LangerAtemSlideProps> = ({ isActive, langerAtem }) => {
  const animiert = useCountUp(langerAtem.tage, isActive);

  return (
    <SlideBase isActive={isActive} className="langer-atem-slide" kachel="langer-atem">
      <div className="kat-auge">Vom ersten bis zum letzten Mal</div>
      <div className="kat-zahl">{animiert}</div>
      <div className="kat-slogan">
        <span style={{ display: 'block' }}>Tage lang</span>
        <span style={{ display: 'block' }}>warst du</span>
        <span style={{ display: 'block' }}>dabei.</span>
      </div>
      <div className="kat-nachsatz">
        {langerAtem.termine} Termine über das ganze Jahr verteilt.
      </div>
    </SlideBase>
  );
};

export default LangerAtemSlide;
