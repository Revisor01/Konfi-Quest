import { useState, useEffect } from 'react';
import { bewegungReduziert } from '../utils/bewegung';

/**
 * Animierter Count-up Hook mit requestAnimationFrame.
 * Startet nur wenn isActive true ist (Swiper onSlideChange).
 * Ease-out cubic für natuerliches Gefuehl, ~1.5s Dauer.
 * Bei „Bewegung reduzieren" steht sofort der Endstand da, ohne Hochzählen.
 */
export function useCountUp(target: number, isActive: boolean, duration = 1500): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!isActive || target <= 0) {
      setValue(0);
      return;
    }

    if (bewegungReduziert()) {
      setValue(target);
      return;
    }

    const start = performance.now();
    let raf: number;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      // ease-out cubic: schnell starten, langsam enden
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(eased * target));
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, isActive, duration]);

  return value;
}
