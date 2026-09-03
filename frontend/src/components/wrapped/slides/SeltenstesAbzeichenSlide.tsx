import React from 'react';
import { IonIcon } from '@ionic/react';
import * as icons from 'ionicons/icons';
import SlideBase from './SlideBase';

/**
 * "Das haben nur x %" -- das seltenste Abzeichen dieser Person.
 *
 * SIMONS IDEE (02.09.2026), am 03.09. ausdruecklich eingefordert: "Den haben
 * nur du, du, du Prozent erreicht. Es muss wirklich so sein, dass die Lust
 * haben, das zu teilen, dass das was richtig Besonderes ist."
 *
 * WARUM DIESE SEITE ANDERS GEBAUT IST ALS DIE UEBRIGEN: Jede andere Zahl im
 * Rueckblick ist absolut -- "8 Termine", "17 Punkte". Die sagt nichts
 * darueber, ob das viel ist. Diese Seite setzt die Leistung ins Verhaeltnis,
 * und genau das macht sie teilenswert. Deshalb steht hier die PROZENTZAHL
 * gross, nicht der Name des Abzeichens.
 *
 * KEINE RANGLISTE UEBER MENSCHEN (Simons Regel, Migration 118): Die Aussage
 * gilt dem ABZEICHEN ("das ist selten"), nicht der Person ("du bist besser
 * als andere"). Deshalb steht nirgends, wer es sonst noch hat.
 */

interface SeltenstesAbzeichen {
  name: string;
  icon: string;
  color: string;
  haben_es: number;
  konfis: number;
  prozent: number;
}

interface Props {
  isActive: boolean;
  abzeichen: SeltenstesAbzeichen;
}

/**
 * Der Ton richtet sich nach der Seltenheit. Ein Abzeichen, das 40 % haben,
 * ist nicht "extrem selten" -- das waere gelogen und faellt sofort auf.
 */
function tonFuer(prozent: number): { auge: string; nachsatz: string } {
  if (prozent <= 10) {
    return {
      auge: 'Fast niemand hat das',
      nachsatz: 'Das ist die Sorte Abzeichen, von der die meisten nicht mal wissen, dass es sie gibt.'
    };
  }
  if (prozent <= 25) {
    return {
      auge: 'Selten',
      nachsatz: 'Die wenigsten kommen da hin. Du schon.'
    };
  }
  if (prozent <= 50) {
    return {
      auge: 'Nicht selbstverständlich',
      nachsatz: 'Mehr als die Hälfte deines Jahrgangs hat das nicht.'
    };
  }
  return {
    auge: 'Dein seltenstes',
    nachsatz: 'Von allen deinen Abzeichen ist das das ungewöhnlichste.'
  };
}

/** Ionicon-Namen aus der Datenbank in das echte Symbol aufloesen. */
function symbolFuer(name: string): string {
  const sauber = (name || '').trim();
  // Die Datenbank haelt Namen wie 'trophy' oder 'ribbon-outline'.
  const alsCamel = sauber.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  return (icons as Record<string, string>)[alsCamel] || icons.trophy;
}

const SeltenstesAbzeichenSlide: React.FC<Props> = ({ isActive, abzeichen }) => {
  const ton = tonFuer(abzeichen.prozent);

  return (
    <SlideBase isActive={isActive} className="seltenstes-slide" kachel="seltenstes">
      <div className="selt-auge">{ton.auge}</div>

      {/* Das Abzeichen selbst, gross und in seiner eigenen Farbe --
          es ist der Held der Seite, nicht eine Statistikzeile. */}
      <div className="selt-abzeichen" style={{ backgroundColor: abzeichen.color || '#f59e0b' }}>
        <IonIcon icon={symbolFuer(abzeichen.icon)} />
      </div>

      <div className="selt-name">{abzeichen.name}</div>

      {/* Die Prozentzahl traegt die Seite. */}
      <div className="selt-prozent">
        <span className="selt-prozent__zahl">{abzeichen.prozent}</span>
        <span className="selt-prozent__zeichen">%</span>
      </div>
      <div className="selt-satz">haben das auch</div>

      <div className="selt-nachsatz">{ton.nachsatz}</div>
    </SlideBase>
  );
};

export default SeltenstesAbzeichenSlide;
