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

  // SIMONS VORGABE (03.09.2026): "Da will jemand konfirmiert werden -- ist
  // es nicht. Bis 30 Tage vor der Konfi sagen wir nur, wie viele Tage noch.
  // Ab 30 Tage vorher: Bald ist es soweit."
  //
  // Der Grund: Ein Rueckblick kann zu jedem Zeitpunkt erzeugt werden -- als
  // Zwischenstand im ersten Jahr oder als Abschluss kurz vor der Feier.
  // "Bald ist es soweit" ueber 240 Tagen ist schlicht falsch, und der alte
  // Text stand in JEDEM Fall da.
  const slogan = vorbei
    ? ['Du bist', 'konfirmiert.']
    : tage === 0
      ? ['Heute', 'ist es', 'so weit.']
      : tage <= 30
        ? ['Bald', 'ist es', 'so weit.']
        // Weiter weg: nur die Zahl, ohne Versprechen.
        : ['Noch', `${tage}`, tage === 1 ? 'Tag.' : 'Tage.'];

  const nachsatz = vorbei
    ? `Am ${datum} war es so weit.`
    : tage === 0
      ? 'Heute. Genau heute.'
      : tage <= 30
        ? `Noch ${tage} ${tage === 1 ? 'Tag' : 'Tage'} bis zum ${datum}.`
        : `Deine Konfirmation ist am ${datum}.`;

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
