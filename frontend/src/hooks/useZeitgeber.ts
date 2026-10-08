import { useEffect, useMemo, useRef } from 'react';

/**
 * Zeitgeber, die mit der Komponente enden.
 *
 * Ein `setTimeout`, das nach dem Schliessen einer Seite noch Zustand setzt,
 * den Scanner neu startet oder nachlaedt, wirkt an einer Seite, die es nicht
 * mehr gibt -- in der CI am schon abgebauten Testfenster („window is not
 * defined", 06.10.2026), in der App als Meldung oder Abruf aus dem Nichts.
 * Dieser Hook haelt jede ID fest und loescht beim Abbau alle offenen.
 * Nach dem Abbau plant er nichts mehr ein: Eine async-Kette, die erst nach dem
 * Schliessen zurueckkommt, bleibt damit still.
 *
 * Fuer Zeitgeber, die innerhalb eines useEffect entstehen und mit ihm enden,
 * genuegt das Loeschen in dessen Aufraeumfunktion; der Hook ist fuer
 * Klick-Handler, Bestaetigungen und async-Ketten da.
 */
export interface Zeitgeber {
  /**
   * `fn` nach `ms` Millisekunden -- nie nach dem Abbau. Liefert den Abbruch.
   * Mit `beimAbbauAusfuehren` laeuft ein noch offenes `fn` beim Abbau sofort
   * statt gar nicht: fuer Zeitgeber, die etwas zuruecknehmen (eine
   * Hervorhebung an einem anderen Element), das sonst stehen bliebe.
   */
  nach: (ms: number, fn: () => void, beimAbbauAusfuehren?: boolean) => () => void;
  /** `fn` im naechsten Bildaufbau -- nie nach dem Abbau. Liefert den Abbruch. */
  imNaechstenBild: (fn: () => void) => () => void;
  /** Steht die Komponente noch? Fuer async-Ketten nach einem `await`. */
  aktiv: () => boolean;
  /** Alle offenen Zeitgeber dieser Komponente abbrechen. */
  alleAbbrechen: () => void;
}

export function useZeitgeber(): Zeitgeber {
  const zeiten = useRef(new Set<ReturnType<typeof setTimeout>>());
  const abschluesse = useRef(new Map<ReturnType<typeof setTimeout>, () => void>());
  const bilder = useRef(new Set<number>());
  const steht = useRef(true);

  const zeitgeber = useMemo<Zeitgeber>(() => {
    const alleAbbrechen = () => {
      zeiten.current.forEach((id) => clearTimeout(id));
      zeiten.current.clear();
      abschluesse.current.clear();
      bilder.current.forEach((id) => cancelAnimationFrame(id));
      bilder.current.clear();
    };
    const nach = (ms: number, fn: () => void, beimAbbauAusfuehren = false) => {
      if (!steht.current) return () => undefined;
      const id = setTimeout(() => {
        zeiten.current.delete(id);
        abschluesse.current.delete(id);
        fn();
      }, ms);
      zeiten.current.add(id);
      if (beimAbbauAusfuehren) abschluesse.current.set(id, fn);
      return () => {
        clearTimeout(id);
        zeiten.current.delete(id);
        abschluesse.current.delete(id);
      };
    };
    const imNaechstenBild = (fn: () => void) => {
      if (typeof requestAnimationFrame !== 'function') return nach(16, fn);
      if (!steht.current) return () => undefined;
      const id = requestAnimationFrame(() => {
        bilder.current.delete(id);
        fn();
      });
      bilder.current.add(id);
      return () => {
        cancelAnimationFrame(id);
        bilder.current.delete(id);
      };
    };
    return { nach, imNaechstenBild, aktiv: () => steht.current, alleAbbrechen };
  }, []);

  useEffect(() => {
    // Wieder einhaengen (React StrictMode baut einmal ab und auf).
    steht.current = true;
    const offeneAbschluesse = abschluesse.current;
    return () => {
      steht.current = false;
      const abschliessen = [...offeneAbschluesse.values()];
      zeitgeber.alleAbbrechen();
      abschliessen.forEach((fn) => fn());
    };
  }, [zeitgeber]);

  return zeitgeber;
}

/**
 * Entprellen ausserhalb von React-Zustand: Mehrere Anstoesse binnen `ms`
 * ergeben genau einen Aufruf, mit dem Stand des letzten Anstosses
 * („letzte Anforderung gewinnt"). `abbrechen` verwirft einen wartenden
 * Aufruf -- in die Aufraeumfunktion des useEffect, der ihn anlegt.
 */
export function entprellen(fn: () => void, ms: number): { ausloesen: () => void; abbrechen: () => void } {
  let wartet: ReturnType<typeof setTimeout> | null = null;
  const abbrechen = () => {
    if (wartet !== null) clearTimeout(wartet);
    wartet = null;
  };
  return {
    ausloesen: () => {
      abbrechen();
      wartet = setTimeout(() => {
        wartet = null;
        fn();
      }, ms);
    },
    abbrechen,
  };
}
