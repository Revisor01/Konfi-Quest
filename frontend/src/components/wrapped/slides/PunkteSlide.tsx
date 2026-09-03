import React from 'react';
import SlideBase from './SlideBase';
import { useCountUp } from '../../../hooks/useCountUp';
import type { SlideProps, KonfiPunkteSlide } from '../../../types/wrapped';

interface PunkteSlideProps extends SlideProps {
  punkte: KonfiPunkteSlide;
}

/**
 * Die Punkte-Seite -- auf die Slogan-Gestaltung umgezogen (03.09.2026).
 *
 * Simons Kritik galt allen Seiten: "nur Zahlen sind ultra uninteressant".
 * Vorher stand hier eine grosse Zahl mit dem Untertitel "Punkte gesammelt".
 * Jetzt traegt ein Spruch die Seite, die Zahl laeuft klein daneben hoch.
 *
 * GESTAFFELT NACH ZAHL: Bei 3 Punkten waere "PUNKTE BIST DU LOSGEWORDEN"
 * hohl. Wer wenig hat, bekommt einen Text, der traegt statt zu vergleichen --
 * Simons Regel: keine Negativ-Aussagen, kein Vergleich nach unten.
 */

function spruchFuer(total: number): { auge: string; slogan: string[]; nachsatz: string } {
  if (total >= 40) {
    return {
      auge: 'Deine Punkte',
      slogan: ['Du hast', 'gesammelt', 'wie andere', 'Sticker.'],
      nachsatz: 'Das ist eine Menge Konfi-Zeit.'
    };
  }
  if (total >= 20) {
    return {
      auge: 'Deine Punkte',
      slogan: ['Da kommt', 'was', 'zusammen.'],
      nachsatz: 'Jeder Punkt steht für einen Termin, an dem du da warst.'
    };
  }
  if (total >= 1) {
    return {
      auge: 'Deine Punkte',
      slogan: ['Jeder Punkt', 'ist ein Mal', 'dabei.'],
      nachsatz: 'Und dabei sein ist der ganze Punkt.'
    };
  }
  // Null Punkte: keine Zahl gross zeigen, keinen Vergleich, kein Vorwurf.
  return {
    auge: 'Deine Punkte',
    slogan: ['Dein Jahr', 'fängt', 'gerade erst', 'an.'],
    nachsatz: 'Die Punkte kommen, sobald du dabei bist.'
  };
}

const PunkteSlide: React.FC<PunkteSlideProps> = ({ isActive, punkte }) => {
  const animatedTotal = useCountUp(punkte.total, isActive, 1600);
  const text = spruchFuer(punkte.total);

  return (
    <SlideBase isActive={isActive} className="punkte-slide" kachel="punkte">
      <div className="kat-auge">{text.auge}</div>

      {punkte.total > 0 && (
        <div className="kat-zahl">
          {animatedTotal}<span className="kat-zahl__mal">P</span>
        </div>
      )}

      <div className="kat-slogan">
        {text.slogan.map((zeile, i) => (
          <span key={i} style={{ display: 'block' }}>{zeile}</span>
        ))}
      </div>

      <div className="kat-nachsatz">{text.nachsatz}</div>

      {/* Die Aufteilung bleibt -- sie sagt etwas, das der Spruch nicht sagt. */}
      {punkte.total > 0 && (
        <div className="w-aufteilung">
          <span><b>{punkte.gottesdienst}</b> Gottesdienst</span>
          <span><b>{punkte.gemeinde}</b> Gemeinde</span>
          {punkte.bonus > 0 && <span><b>{punkte.bonus}</b> Bonus</span>}
        </div>
      )}
    </SlideBase>
  );
};

export default PunkteSlide;
