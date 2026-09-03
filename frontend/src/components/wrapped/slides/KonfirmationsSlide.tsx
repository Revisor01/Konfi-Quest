import React from 'react';
import SlideBase from './SlideBase';
import type { SlideProps } from '../../../types/wrapped';
import { tageBis } from '../../shared/eventFormatting';

interface KonfirmationsSlideProps extends SlideProps {
  zeitraumEnde: string;
}

/**
 * Die Konfirmations-Seite -- auf die Slogan-Gestaltung umgezogen (03.09.2026).
 *
 * Der Ton haengt daran, ob der Termin noch bevorsteht oder schon war. Vorher
 * stand hier in beiden Faellen "Es ist bald soweit!" -- nach der
 * Konfirmation war das schlicht falsch.
 */
const KonfirmationsSlide: React.FC<KonfirmationsSlideProps> = ({ isActive, zeitraumEnde }) => {
  const endeDate = new Date(zeitraumEnde);
  // Kalendertage, nicht 24-Stunden-Bloecke: Sonst zaehlte ein Termin heute
  // Abend als "1 Tag" und ueber eine Zeitumstellung hinweg verschob sich
  // alles um einen Tag (siehe eventFormatting.ts).
  const tage = tageBis(endeDate);
  const vorbei = tage < 0;

  const datum = endeDate.toLocaleDateString('de-DE', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const slogan = vorbei
    ? ['Du bist', 'konfirmiert.']
    : tage === 0
      ? ['Heute', 'ist es', 'so weit.']
      : tage <= 30
        ? ['Es wird', 'ernst.']
        : ['Da will', 'jemand', 'konfirmiert', 'werden.'];

  const nachsatz = vorbei
    ? `Am ${datum} war es so weit.`
    : tage === 0
      ? 'Heute. Genau heute.'
      : `Noch ${tage} ${tage === 1 ? 'Tag' : 'Tage'} bis zum ${datum}.`;

  return (
    <SlideBase isActive={isActive} className="konfirmation-slide" kachel="konfirmation">
      <div className="kat-auge">Deine Konfirmation</div>

      {!vorbei && tage > 0 && (
        <div className="kat-zahl">
          {tage}<span className="kat-zahl__mal">{tage === 1 ? ' Tag' : ' Tage'}</span>
        </div>
      )}

      <div className="kat-slogan">
        {slogan.map((zeile, i) => (
          <span key={i} style={{ display: 'block' }}>{zeile}</span>
        ))}
      </div>

      <div className="kat-nachsatz">{nachsatz}</div>
    </SlideBase>
  );
};

export default KonfirmationsSlide;
