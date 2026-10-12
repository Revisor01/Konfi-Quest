// Der Lese-Rahmen ohne Darstellung: Kontext, Bau aus der Liste und die Wahl
// „Breit lesen". Die Bausteine dazu (Provider, Leiste zum Blättern, Kopf des
// Lesebereichs) und die Begründung stehen in WebLeseRahmen.tsx; es reicht
// die Konstanten und Typen von hier weiter. Die Funktionen (useLeseRahmen,
// leseRahmenVon, useBreitLesen) werden von hier importiert.

import { createContext, useCallback, useContext, useState } from 'react';
import { naechsterEintrag } from '../../../utils/supportVorgaenge';
import { useWiedereintritt } from './useWiedereintritt';

/**
 * Wohin der Fokus gehört, wenn der Lesebereich für einen anderen Eintrag neu
 * entsteht (‹ ›, Pfeiltasten, nach einem Abschluss): auf denselben Knopf der
 * Leiste zum Blättern bzw. auf den Titel. Die Knöpfe im Eintrag, auf denen er
 * stand, gibt es danach nicht mehr -- ohne Ziel landete er auf <body>. Die
 * Leiste selbst steht über dem Lesebereich und bleibt (WebLeseNavigation).
 */
export type LeseFokus = 'zurueck' | 'vorher' | 'weiter' | 'titel';

/** Was die Liste dem Lesebereich mitgibt. */
export interface LeseRahmen {
  /** Die Liste ist ausgeblendet, der Lesebereich breit. */
  breit: boolean;
  breitUmschalten: () => void;
  /** Name der Liste für „‹ Alle Vorgänge" bzw. „‹ Posteingang". */
  listeLabel: string;
  vorheriger: number | null;
  naechster: number | null;
  /** Einen Eintrag wählen (null: keinen). */
  waehlen: (id: number | null) => void;
  /**
   * Zum vorigen bzw. nächsten Eintrag (‹ › und die Pfeiltasten); der Fokus
   * kommt danach auf `fokus` (Vorgabe: den Knopf derselben Richtung).
   */
  blaettern: (richtung: 'vorher' | 'weiter', fokus?: LeseFokus) => void;
  /** Der Eintrag ist abgeschlossen (erledigt, archiviert, gelöscht): den nächsten öffnen. */
  abgeschlossen: (id: number) => void;
  /**
   * Eine Sammelaktion der Liste hat diese Einträge abgeschlossen. Ist der
   * offene dabei, öffnet sich der nächste, der nicht dabei ist -- außer, er
   * hat einen Entwurf (entwurfMelden) und ist nicht gelöscht: Dann bleibt er
   * stehen, und nichts geht verloren.
   */
  sammelAbgeschlossen: (ids: readonly number[], geloescht: boolean) => void;
  /** Der Lesebereich meldet, wie er prüft, ob er einen Entwurf hat (Antwort, Notiz); null beim Verlassen. */
  entwurfMelden: (pruefen: (() => boolean) | null) => void;
  /** Die Mail, die offen und hervorgehoben steht (?mail=). */
  hervorheben: number | null;
  /**
   * Einmal abholen, wohin der Fokus soll, sobald der Lesebereich des
   * gewählten Eintrags steht (WebLesen); null: nirgends hin.
   */
  fokusAbholen: () => LeseFokus | null;
}

/** Ohne Liste: schmal, nichts zu blättern, nichts hervorzuheben. */
export const LESE_RAHMEN_NEUTRAL: LeseRahmen = {
  breit: false,
  breitUmschalten: () => {},
  listeLabel: '',
  vorheriger: null,
  naechster: null,
  waehlen: () => {},
  blaettern: () => {},
  abgeschlossen: () => {},
  sammelAbgeschlossen: () => {},
  entwurfMelden: () => {},
  hervorheben: null,
  fokusAbholen: () => null,
};

export const RahmenKontext = createContext<LeseRahmen>(LESE_RAHMEN_NEUTRAL);

/** Der Rahmen der Liste -- ohne Provider der neutrale. */
export function useLeseRahmen(): LeseRahmen {
  return useContext(RahmenKontext);
}

/**
 * `?mail=` aus der Adresse nehmen: Es gilt nur für den Eintrag, mit dem die
 * Seite geöffnet wurde. useLeseAuswahl hängt die bisherige Abfrage sonst an
 * jede neue Adresse (docs/planung/support-detailseiten.md, Abweichung 14).
 */
function mailAusAdresseNehmen(): void {
  if (typeof window === 'undefined') return;
  const abfrage = new URLSearchParams(window.location.search);
  if (!abfrage.has('mail')) return;
  abfrage.delete('mail');
  const rest = abfrage.toString();
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${rest ? `?${rest}` : ''}`);
}

export interface LeseRahmenTeile {
  /** Die Kennungen der Liste in ihrer Reihenfolge. */
  ids: readonly number[];
  gewaehlt: number | null;
  /** Wählen der Liste (useLeseAuswahl). */
  waehlen: (id: number | null) => void;
  listeLabel: string;
  breit: boolean;
  setBreit: (b: boolean) => void;
  hervorheben?: number | null;
  /**
   * Die Reihenfolge, in der der gewählte Eintrag zuletzt stand (useListenRahmen).
   * Fällt er ohne Abschluss aus der Liste (Filter, Wiederherstellen im Archiv,
   * „Danach"), blättern ‹ › darin weiter -- bis 12.10.2026 waren sie dann tot.
   */
  reihe?: readonly number[];
}

/**
 * Voriger und nächster Eintrag um `gewaehlt`. Fehlt er in `ids`, gilt
 * `reihe` (wie er zuletzt stand), und es zählen nur Nachbarn, die noch in der
 * Liste stehen.
 */
export function nachbarn(ids: readonly number[], reihe: readonly number[], gewaehlt: number | null): [number | null, number | null] {
  if (gewaehlt === null) return [null, null];
  const i = ids.indexOf(gewaehlt);
  if (i !== -1) return [i > 0 ? ids[i - 1] : null, i < ids.length - 1 ? ids[i + 1] : null];
  const j = reihe.indexOf(gewaehlt);
  if (j === -1) return [null, null];
  const steht = (id: number) => ids.includes(id);
  return [[...reihe.slice(0, j)].reverse().find(steht) ?? null, reihe.slice(j + 1).find(steht) ?? null];
}

/**
 * Der Rahmen aus der Liste: voriger und nächster Eintrag um den gewählten;
 * „abgeschlossen" öffnet den danach, sonst den davor, sonst keinen
 * (naechsterEintrag); Wählen nimmt `?mail=` aus der Adresse.
 */
export function leseRahmenVon(t: LeseRahmenTeile): LeseRahmen {
  const [vorheriger, naechster] = nachbarn(t.ids, t.reihe ?? t.ids, t.gewaehlt);
  const waehlen = (id: number | null) => {
    mailAusAdresseNehmen();
    t.waehlen(id);
  };
  return {
    breit: t.breit,
    breitUmschalten: () => t.setBreit(!t.breit),
    listeLabel: t.listeLabel,
    vorheriger,
    naechster,
    waehlen,
    blaettern: (richtung) => {
      const ziel = richtung === 'vorher' ? vorheriger : naechster;
      if (ziel !== null) waehlen(ziel);
    },
    abgeschlossen: (id) => waehlen(naechsterEintrag(t.ids, id)),
    sammelAbgeschlossen: (ids) => {
      if (t.gewaehlt !== null && ids.includes(t.gewaehlt)) waehlen(naechsterEintrag(t.ids, t.gewaehlt, ids));
    },
    // Ohne Gedächtnis: Den Entwurf des Lesebereichs merkt sich useListenRahmen.
    entwurfMelden: () => {},
    hervorheben: t.hervorheben ?? null,
    // Ohne Gedächtnis: Den Fokus nach einem Wechsel merkt sich useListenRahmen.
    fokusAbholen: () => null,
  };
}

/** Der Schlüssel im localStorage: '1' breit, '0' mit Liste. */
export const SCHLUESSEL_BREIT_LESEN = 'konfiquest.support.breitLesen';

// Speicher kann fehlen oder werfen (privates Fenster, gesperrte
// Website-Daten). Dann gilt „mit Liste", und der Schalter wirkt bis zum
// Neuladen -- wie bei der Ansicht Liste/Kacheln (web/useAnsicht.ts).
const breitGemerkt = (): boolean => {
  try {
    return window.localStorage.getItem(SCHLUESSEL_BREIT_LESEN) === '1';
  } catch {
    return false;
  }
};

const breitMerken = (breit: boolean): void => {
  try {
    window.localStorage.setItem(SCHLUESSEL_BREIT_LESEN, breit ? '1' : '0');
  } catch {
    // Nicht merkbar -- die Wahl gilt trotzdem bis zum Neuladen.
  }
};

/**
 * „Breit lesen": die gemerkte Wahl dieses Geräts und das Wählen. Ein
 * Direktlink (…/vorgaenge/5) öffnet wie bisher mit Liste; die gemerkte Wahl
 * bleibt dabei unberührt.
 *
 * Ionic hält Seiten im Speicher. Wer eine schon besuchte Liste wieder
 * betritt, bekommt dieselbe Regel wie beim ersten Öffnen -- auch die Wahl,
 * die er inzwischen in der anderen Liste getroffen hat (bis 12.10.2026 las
 * nur das erste Öffnen den Speicher).
 */
export function useBreitLesen(o: { direktlink: boolean }): [boolean, (b: boolean) => void] {
  const regel = (): boolean => (o.direktlink ? false : breitGemerkt());
  const [breit, setBreitZustand] = useState<boolean>(regel);
  const eintritt = useWiedereintritt();
  const [eintrittGesehen, setEintrittGesehen] = useState(eintritt);
  if (eintritt !== eintrittGesehen) {
    setEintrittGesehen(eintritt);
    setBreitZustand(regel());
  }
  const setBreit = useCallback((b: boolean) => {
    setBreitZustand(b);
    breitMerken(b);
  }, []);
  return [breit, setBreit];
}
