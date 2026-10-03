// Wer unten liest, bleibt unten, wenn der Verlauf nachwaechst.
//
// Bilder und Videos laden erst, wenn sie in die Naehe des sichtbaren Bereichs
// kommen (LazyImage), und wachsen dabei von der Platzhalterhoehe auf die des
// Bildes. Springt jemand mit dem Knopf "Zu den neuesten Nachrichten" ans Ende
// (sanftes Scrollen, Ziel zu Beginn berechnet), laden die Bilder auf dem Weg
// nach -- das Ziel liegt dann Hunderte Pixel zu weit oben und die letzte
// Nachricht steht halb unter der Eingabe (im Browser gemessen: 214 px, der
// Knopf war dabei schon wieder weg). Dasselbe passiert beim Oeffnen eines Chats
// mit Bild ganz unten.
//
// Regel: Waechst der Verlauf, und stand die Leserin vorher (hoechstens
// UNTEN_SCHWELLE px) am Ende -- oder ist sie gerade mit dem Knopf unterwegs
// dorthin --, wird wieder ans Ende gescrollt. Wer weiter oben liest, bleibt
// stehen; beim Blaettern nach oben (aeltere Nachrichten kommen davor) ebenfalls.
// Eigene Eingaben (Rad, Beruehrung, Tastatur, Klick) beenden die Reise zum Knopf.
// Die Aufrufe von useChatScroll bleiben unveraendert; die Fassung der App kennt
// das nicht.

import { useEffect, useRef } from 'react';

/** So nah am Ende (px) gilt die Leserin als "unten". */
export const UNTEN_SCHWELLE = 80;
/**
 * So lange (ms) gilt ein Sprung mit dem Knopf als unterwegs: das sanfte Scrollen
 * (300 ms) plus der Nachgriff. Wer danach unten steht, bleibt ohnehin unten.
 */
const SPRUNG_DAUER = 1000;
/** So lange (ms) laeuft das sanfte Scrollen des Knopfs (useChatScroll: 300) noch nach. */
const NACH_SPRUNG = 350;

export interface UntenBleiben {
  /** An die Liste der Nachrichten haengen (das Element, das waechst). */
  listeRef: React.RefObject<HTMLDivElement | null>;
  /** Vor dem Scrollen mit dem Knopf "Nach unten" aufrufen. */
  sprungBeginnt: () => void;
}

export function useUntenBleiben(contentRef: React.RefObject<HTMLIonContentElement | null>): UntenBleiben {
  const listeRef = useRef<HTMLDivElement>(null);
  const hoeheRef = useRef<number | null>(null);
  const sprungBisRef = useRef(0);

  const sprungBeginnt = () => {
    sprungBisRef.current = Date.now() + SPRUNG_DAUER;
  };

  useEffect(() => {
    const inhalt = contentRef.current;
    const liste = listeRef.current;
    if (!inhalt || !liste || typeof ResizeObserver === 'undefined') return;

    let nachTimer: ReturnType<typeof setTimeout> | null = null;
    const nachziehen = async () => {
      const el = await inhalt.getScrollElement();
      const vorher = hoeheRef.current;
      hoeheRef.current = el.scrollHeight;
      if (vorher === null || el.scrollHeight <= vorher) return;
      const unterwegs = Date.now() < sprungBisRef.current;
      // "Unten" gibt es nur, wenn der Verlauf vorher den Platz schon fuellte:
      // Der erste Block (leer -> Nachrichten) gehoert useChatScroll, der dann zum
      // neuen-Trenner oder ans Ende scrollt -- hier dazwischenzufahren liesse den
      // Verlauf kurz unten aufblitzen.
      const abstandVorher = vorher - el.scrollTop - el.clientHeight;
      const warUnten = vorher > el.clientHeight && abstandVorher < UNTEN_SCHWELLE;
      if (unterwegs || warUnten) inhalt.scrollToBottom(0);
      // Das sanfte Scrollen des Knopfs laeuft zum alten Ziel weiter und
      // ueberschreibt den Sprung: nach seinem Ende (300 ms) noch einmal.
      if (unterwegs) {
        if (nachTimer !== null) clearTimeout(nachTimer);
        nachTimer = setTimeout(() => {
          nachTimer = null;
          if (Date.now() < sprungBisRef.current) inhalt.scrollToBottom(0);
        }, NACH_SPRUNG);
      }
    };
    const beobachter = new ResizeObserver(() => { void nachziehen(); });
    beobachter.observe(liste);

    const eigeneEingabe = () => { sprungBisRef.current = 0; };
    const ereignisse = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
    ereignisse.forEach((name) => inhalt.addEventListener(name, eigeneEingabe, { passive: true }));

    return () => {
      beobachter.disconnect();
      if (nachTimer !== null) clearTimeout(nachTimer);
      ereignisse.forEach((name) => inhalt.removeEventListener(name, eigeneEingabe));
    };
  }, [contentRef]);

  return { listeRef, sprungBeginnt };
}
