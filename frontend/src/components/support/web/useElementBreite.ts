// Breite eines Elements in Pixeln -- die Diagramme zeichnen in echten Pixeln
// (viewBox = Breite x Hoehe), damit Schrift und Strichstaerken in jeder
// Kartenbreite gleich gross bleiben und nicht mit dem SVG wachsen.
//
// Ohne ResizeObserver (Tests, sehr alte Browser) gilt die Vorgabe. Gemessen
// wird nur im Rueckruf des Beobachters, der beim Anmelden sofort feuert --
// kein Zustand wechselt synchron im Effekt.

import { useEffect, useRef, useState } from 'react';

export function useElementBreite<E extends HTMLElement>(vorgabe: number, mindestens = 260): [React.RefObject<E | null>, number] {
  const ref = useRef<E | null>(null);
  const [breite, setBreite] = useState(vorgabe);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    const beobachter = new ResizeObserver((eintraege) => {
      const gemessen = Math.round(eintraege[0]?.contentRect.width ?? 0);
      if (gemessen > 0) setBreite(Math.max(gemessen, mindestens));
    });
    beobachter.observe(element);
    return () => beobachter.disconnect();
  }, [mindestens]);

  return [ref, breite];
}
