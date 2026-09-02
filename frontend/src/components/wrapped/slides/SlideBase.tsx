import React from 'react';
import WrappedHintergrund from '../WrappedHintergrund';
import { hintergrundFuer } from '../hintergrundbilder';

interface SlideBaseProps {
  isActive: boolean;
  children: React.ReactNode;
  className?: string;
  /**
   * Schlüssel der Kachel ('intro', 'highlight', ...). Steuert, welches Foto
   * hinter der Seite liegt. Ohne Angabe bleibt es beim reinen Farbverlauf --
   * so bleiben Seiten, die den Schlüssel (noch) nicht durchreichen,
   * unverändert statt plötzlich falsch bebildert.
   */
  kachel?: string;
}

/**
 * Grundgerüst jeder Rückblick-Seite.
 *
 * Seit 02.09.2026 traegt sie den bebilderten Hintergrund (Simons Entwurf):
 * zwei weich maskierte, unscharfe Bildformen in gegenüberliegenden Ecken,
 * darüber der Farbschleier der Seite. Der Verlauf selbst kommt weiterhin aus
 * dem CSS der jeweiligen Seite (.punkte-slide, .monat-slide, ...) -- der
 * Hintergrund liest ihn aus und legt ihn als Schleier über die Bilder.
 */
const SlideBase: React.FC<SlideBaseProps> = ({ isActive, children, className, kachel }) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const [verlauf, setVerlauf] = React.useState<string | null>(null);

  // Der Kachel-Schlüssel steckt schon in der className jeder Seite
  // ("intro-slide", "highlight-slide", "monat-slide"). Ihn dort abzulesen
  // spart es, den Schlüssel durch zwölf Seiten durchzureichen -- und die
  // beiden Angaben können nicht auseinanderlaufen.
  const abgeleitet = kachel
    || (className ? className.replace(/-slide$/, '') : undefined);
  const hatBild = abgeleitet ? Boolean(hintergrundFuer(abgeleitet)) : false;

  // Den Verlauf der Seite aus dem CSS lesen, statt ihn hier zu doppeln.
  // Sonst müsste jede Farbe an zwei Stellen gepflegt werden und liefe
  // irgendwann auseinander.
  React.useEffect(() => {
    if (!hatBild || !isActive || !ref.current) return;
    const gelesen = window.getComputedStyle(ref.current).backgroundImage;
    if (gelesen && gelesen !== 'none') setVerlauf(gelesen);
  }, [hatBild, isActive]);

  return (
    <div
      ref={ref}
      className={`wrapped-slide${isActive ? ' wrapped-slide--active' : ''}${className ? ` ${className}` : ''}`}
    >
      {isActive && hatBild && verlauf && (
        <WrappedHintergrund kachel={abgeleitet as string} verlauf={verlauf} />
      )}
      {isActive && children}
    </div>
  );
};

export default SlideBase;
