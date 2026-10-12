// Der Lese-Rahmen einer Liste mit Lesebereich (Vorgänge und Posteingang im
// Browser; docs/planung/support-detailseiten.md, F und „Rahmen"; Simon,
// 11.10.2026: Fragen 6 und 9). Baut aus der Liste, was der Lesebereich über
// useLeseRahmen bekommt (web/leseRahmen.ts):
//
//   - „Breit lesen", je Gerät gemerkt (useBreitLesen); ein Direktlink öffnet
//     mit Liste. Breit gilt nur mit einem gewählten Eintrag -- ohne stünde
//     rechts nichts, und die Liste wäre fort.
//   - Voriger und nächster Eintrag zum Blättern (‹ ›). Fällt der offene
//     Eintrag ohne Abschluss aus der Liste (Filter „Neu" und „Danach:
//     Wartet", Wiederherstellen im Archiv, Gemeinde angelegt), gilt die
//     Reihenfolge, in der er zuletzt stand (bis 12.10.2026 waren ‹ › dann tot).
//   - Nach Erledigt, Archivieren oder Löschen der nächste Eintrag, sonst der
//     vorige (naechsterEintrag). Lädt die Liste schneller neu, als der
//     Abschluss gemeldet wird, fehlt der Eintrag schon: Dann gilt die
//     Reihenfolge, in der er zuletzt stand. Ebenso nach einer Sammelaktion
//     der Liste, die den offenen Eintrag einschließt -- übersprungen werden
//     die mit abgeschlossenen; hat der Lesebereich einen Entwurf
//     (entwurfMelden), bleibt er offen, außer er ist gelöscht.
//   - `?mail=` aus der Adresse: die Mail, die im Vorgang offen und
//     hervorgehoben steht. Wählen nimmt sie weg -- sie gilt nur dem Eintrag,
//     mit dem die Seite geöffnet wurde. Ionic hält die Seite im Speicher:
//     Wer sie wieder betritt, auch mit derselben Adresse, bekommt die Mail
//     wieder offen, in den Blick gerollt und markiert (bis 12.10.2026 nur beim
//     ersten Mal). Beim Verlassen erlischt sie, denn MailGespraeche markiert
//     nur einen Wechsel.
//   - Der Fokus nach einem Wechsel: Die Knöpfe, auf denen er stand
//     (Archivieren, Löschen …), entstehen mit dem nächsten Eintrag neu. Der
//     Rahmen merkt sich, wohin er dann gehört -- auf denselben Knopf bzw.
//     nach einem Abschluss auf den Titel --, und WebLesen holt es ab
//     (fokusAbholen), sobald der Eintrag steht; nur, wenn der Fokus verloren
//     ist. ‹ › stehen seit 12.10.2026 über dem Lesebereich und bleiben, der
//     Fokus auf ihnen also auch (WebLeseNavigation).

import { useCallback, useMemo, useRef, useState } from 'react';
import { useIonViewWillLeave } from '@ionic/react';
import { mailAusAdresse, naechsterEintrag } from '../../../utils/supportVorgaenge';
import { useAppLocation } from '../../../navigation/useAppLocation';
import { leseRahmenVon, useBreitLesen, type LeseFokus, type LeseRahmen } from './leseRahmen';
import { useWiedereintritt } from './useWiedereintritt';

export interface ListenRahmenTeile {
  /** Die Kennungen der Liste, wie sie dasteht. */
  ids: readonly number[];
  gewaehlt: number | null;
  /** Wählen der Liste (useLeseAuswahl). */
  waehlen: (id: number | null) => void;
  /** „Alle Vorgänge" bzw. „Posteingang" -- für „‹ …" über dem breiten Lesebereich. */
  listeLabel: string;
  /** Die Seite wurde mit einem Eintrag in der Adresse geöffnet (…/vorgaenge/5). */
  direktlink: boolean;
}

export interface ListenRahmen {
  rahmen: LeseRahmen;
  /** Die Liste ist aus, der Lesebereich breit. */
  breit: boolean;
  /** Der Schalter „Breit lesen" im Kopf der Liste; ohne gewählten Eintrag gesperrt. */
  breitLesen: { onKlick: () => void; gesperrt: boolean };
}

const gleicheReihe = (a: readonly number[], b: readonly number[]): boolean => a.length === b.length && a.every((id, i) => id === b[i]);

export function useListenRahmen(t: ListenRahmenTeile): ListenRahmen {
  const { ids, gewaehlt, waehlen: listeWaehlen, listeLabel, direktlink } = t;
  const [breitGemerkt, setBreit] = useBreitLesen({ direktlink });
  const breit = breitGemerkt && gewaehlt !== null;

  // ?mail= -- neu, wenn die Seite mit einer anderen Adresse wiederkommt
  // (Ionic hält sie im Speicher; nachgezogen beim Rendern).
  const { search } = useAppLocation();
  const [hervorheben, setHervorheben] = useState(() => mailAusAdresse(search));
  const [letzteAbfrage, setLetzteAbfrage] = useState(search);
  if (search !== letzteAbfrage) {
    setLetzteAbfrage(search);
    setHervorheben(mailAusAdresse(search));
  }
  // Wieder betreten: ?mail= gilt neu, auch wenn die Adresse dieselbe ist.
  useIonViewWillLeave(() => { setHervorheben(null); });
  const eintritt = useWiedereintritt();
  const [eintrittGesehen, setEintrittGesehen] = useState(eintritt);
  if (eintritt !== eintrittGesehen) {
    setEintrittGesehen(eintritt);
    setHervorheben(mailAusAdresse(search));
  }

  // Wohin der Fokus soll, sobald der Lesebereich des Eintrags `id` steht.
  const fokus = useRef<{ id: number; ziel: LeseFokus } | null>(null);

  const waehlen = useCallback((id: number | null) => {
    if (id !== gewaehlt) setHervorheben(null);
    listeWaehlen(id);
  }, [gewaehlt, listeWaehlen]);

  // Die Reihenfolge, in der der gewählte Eintrag zuletzt stand (nachgezogen beim Rendern):
  // für ‹ ›, wenn er ohne Abschluss aus der Liste fällt, und für den Eintrag nach einem Abschluss.
  const [letzteReihe, setLetzteReihe] = useState<readonly number[]>(ids);
  const gilt = gewaehlt === null || ids.includes(gewaehlt);
  if (gilt && !gleicheReihe(letzteReihe, ids)) setLetzteReihe(ids);
  const reihe = gilt ? ids : letzteReihe;

  // Wie der Lesebereich prüft, ob er einen Entwurf hat (WebVorgangDetail, WebPostDetail).
  const entwurf = useRef<(() => boolean) | null>(null);
  const entwurfMelden = useCallback((pruefen: (() => boolean) | null) => { entwurf.current = pruefen; }, []);

  const rahmen = useMemo<LeseRahmen>(() => {
    const r = leseRahmenVon({ ids, gewaehlt, waehlen, listeLabel, breit, setBreit, hervorheben, reihe });
    const wechseln = (id: number | null, ziel: LeseFokus) => {
      r.waehlen(id);
      fokus.current = id === null ? null : { id, ziel };
    };
    const danach = (id: number, ohne: readonly number[] = []) => naechsterEintrag(reihe.includes(id) ? reihe : ids, id, ohne);
    return {
      ...r,
      blaettern: (richtung, ziel = richtung) => {
        const id = richtung === 'vorher' ? r.vorheriger : r.naechster;
        if (id !== null) wechseln(id, ziel);
      },
      abgeschlossen: (id: number) => wechseln(danach(id), 'titel'),
      // Ein Entwurf im Lesebereich hält ihn offen -- außer, er ist gelöscht und damit ohnehin fort.
      sammelAbgeschlossen: (betroffen, geloescht) => {
        if (gewaehlt === null || !betroffen.includes(gewaehlt)) return;
        if (!geloescht && entwurf.current?.()) return;
        wechseln(danach(gewaehlt, betroffen), 'titel');
      },
      entwurfMelden,
      // Nur der Lesebereich des Eintrags, für den es gemerkt ist, holt es ab. Der alte kann vor dem
      // Wechsel noch einmal fragen (ausstehende Effekte, etwa nach dem Neuladen der Liste) -- er
      // bekommt nichts, und das Ziel bleibt für den neuen stehen.
      fokusAbholen: () => {
        const wunsch = fokus.current;
        if (wunsch === null || wunsch.id !== gewaehlt) return null;
        fokus.current = null;
        return wunsch.ziel;
      },
    };
  }, [ids, gewaehlt, waehlen, listeLabel, breit, setBreit, hervorheben, reihe, entwurfMelden]);

  return {
    rahmen,
    breit,
    breitLesen: { onKlick: () => setBreit(true), gesperrt: gewaehlt === null },
  };
}
