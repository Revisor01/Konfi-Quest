// Die Stelle unter der jüngsten Mail im Lesebereich der Web-Fassung
// (docs/planung/support-detailseiten.md, G): zugeklappt die Antwortzeile,
// offen der kompakte Editor. Vorgang (WebVorgangDetail) und Mail im
// Posteingang (WebPostDetail) bedienen sie gleich -- bis 11.10.2026 stand
// diese Logik nur im Vorgang.
//
//   - Öffnen (Antwortzeile, „Antworten" im Kopf, „Im Vorgang antworten")
//     rollt den Editor nur so weit, dass sein Ende -- „Antwort senden" -- im
//     Bild ist (block 'end'; bis 11.10.2026 sprang der Lesebereich um
//     1280 px). Der Fokus geht in den Text der Antwort: Die Antwortzeile,
//     über die man kam, gibt es dann nicht mehr (bis 11.10.2026 stand er
//     danach auf <body>).
//   - Schließen (Verwerfen, Senden) gibt den Fokus an die Antwortzeile
//     zurück -- auch an die neue unter der eben gesendeten Mail, solange er
//     nirgends sonst steht. Wer woanders hinklickt oder hintabbt, behält
//     seinen Platz.
//   - Ein getippter Text, der noch nicht gesendet ist, geht nicht still
//     verloren: Der Editor meldet ihn (entwurfRef), und ein Abschluss, nach
//     dem der nächste Eintrag aufgeht, fragt vorher (useEntwurfSchutz; bis
//     12.10.2026 war er dann ohne Rückfrage fort).
// Die Darstellung dazu ist web/WebAntwortStelle.tsx.

import { useCallback, useEffect, useRef, useState, type MutableRefObject, type RefObject } from 'react';
import { useIonAlert } from '@ionic/react';
import { useZeitgeber } from '../../../hooks/useZeitgeber';
import { ENTWURF_RUECKFRAGE } from '../../../seiten/supportDetail';

/** So lange rollt der eben geöffnete Editor mit, wenn er noch wächst. */
const NACHROLLEN_MS = 1500;

/** Die Dialoge von Ionic (Rückfragen); ein Fokus darin verdrängt die Antwortzeile nicht. */
const IONIC_DIALOGE = 'ion-alert, ion-action-sheet, ion-loading, ion-modal, ion-popover';

export interface AntwortStelle {
  /** Der Editor ist offen (sonst steht die Antwortzeile da). */
  offen: boolean;
  /** Öffnen -- auch erneut: rollt den Editor wieder in den Blick. */
  oeffnen: () => void;
  /** Schließen (Verwerfen, nach dem Senden); der Fokus geht zurück an die Antwortzeile. */
  schliessen: () => void;
  /** An den Rahmen des offenen Editors. */
  editorRef: RefObject<HTMLElement | null>;
  /** An den Knopf der Antwortzeile -- dorthin geht der Fokus zurück. */
  zeileRef: (el: HTMLButtonElement | null) => void;
  /** Der offene Editor meldet hier, ob im Text etwas steht (WebAntwortEditor, `entwurfRef`). */
  entwurfRef: MutableRefObject<boolean>;
  /** Steht im offenen Editor ein Text, der noch nicht gesendet ist? */
  hatEntwurf: () => boolean;
}

export function useAntwortStelle(): AntwortStelle {
  const [offen, setOffen] = useState(false);
  // Jedes Öffnen (auch erneut, „Im Vorgang antworten") rollt den Editor in den Blick.
  const [oeffnungen, setOeffnungen] = useState(0);
  const editorRef = useRef<HTMLElement | null>(null);
  const entwurfRef = useRef(false);
  const hatEntwurf = useCallback(() => offen && entwurfRef.current, [offen]);

  useEffect(() => {
    const el = editorRef.current;
    if (oeffnungen === 0 || !el) return undefined;
    el.querySelector<HTMLTextAreaElement>('textarea')?.focus({ preventScroll: true });
    el.scrollIntoView?.({ block: 'end' });
    // Der Editor lädt Bausteine und den Zustand des Postfachs nach und wächst
    // dabei noch (gemessen 11.10.2026: „Antwort senden" lag danach 43 px unter
    // dem Rand). Solange er eben erst aufging, rollt er deshalb mit.
    if (typeof ResizeObserver === 'undefined') return undefined;
    const beobachter = new ResizeObserver(() => el.scrollIntoView?.({ block: 'end' }));
    beobachter.observe(el);
    const uhr = setTimeout(() => beobachter.disconnect(), NACHROLLEN_MS);
    return () => {
      clearTimeout(uhr);
      beobachter.disconnect();
    };
  }, [oeffnungen]);

  // Schließt der Editor, geht der Fokus zurück auf die Antwortzeile -- sonst
  // stünde er auf <body>, weil der Knopf mit dem Editor verschwindet. Entsteht
  // die Zeile neu (nach dem Senden steht sie unter der neuen Mail), folgt er
  // ihr, solange er nirgends sonst steht.
  const fokusZurZeile = useRef(false);
  const zeileEl = useRef<HTMLButtonElement | null>(null);
  const zeitgeber = useZeitgeber();
  const zeileFokussieren = useCallback(() => {
    const el = zeileEl.current;
    if (!el || !el.isConnected || !fokusZurZeile.current) return;
    const aktiv = document.activeElement;
    if (!aktiv || aktiv === document.body) el.focus();
  }, []);
  const zeileRef = useCallback((el: HTMLButtonElement | null) => {
    zeileEl.current = el;
    zeileFokussieren();
  }, [zeileFokussieren]);
  useEffect(() => {
    const woanders = (e: Event) => {
      // Die Rückfrage vor dem Senden (Ionic-Alert) fängt den Fokus, solange sie
      // sich schließt; das ist kein Platz, den jemand gewählt hat.
      if (e.target instanceof Element && e.target.closest(IONIC_DIALOGE)) return;
      if (!(e.target instanceof Element) || !e.target.closest('.web-antwortzeile')) fokusZurZeile.current = false;
    };
    // Antwortet der Server schneller, als die Rückfrage verschwindet, zieht ihr
    // Fokusfang den Fokus zurück, und mit ihr verschwindet er auf <body>
    // (gemessen 11.10.2026 mit sofortiger Antwort). Ist sie fort, kommt er
    // zurück an die Antwortzeile.
    const nachDialog = () => { zeitgeber.nach(0, zeileFokussieren); };
    document.addEventListener('focusin', woanders);
    document.addEventListener('pointerdown', woanders);
    document.addEventListener('ionAlertDidDismiss', nachDialog);
    return () => {
      document.removeEventListener('focusin', woanders);
      document.removeEventListener('pointerdown', woanders);
      document.removeEventListener('ionAlertDidDismiss', nachDialog);
    };
  }, [zeileFokussieren, zeitgeber]);

  const oeffnen = useCallback(() => {
    fokusZurZeile.current = false;
    setOffen(true);
    setOeffnungen((n) => n + 1);
  }, []);
  const schliessen = useCallback(() => {
    fokusZurZeile.current = true;
    setOffen(false);
  }, []);

  return { offen, oeffnen, schliessen, editorRef, zeileRef, entwurfRef, hatEntwurf };
}

/**
 * Vor einem Abschluss, nach dem der Lese-Rahmen den nächsten Eintrag öffnet
 * (Erledigt, Archivieren, Ablehnen): Steht im Editor oder in der Notiz etwas,
 * das noch nicht gesendet bzw. gespeichert ist, erst fragen -- der
 * Lesebereich entsteht für den nächsten Eintrag neu, und es ginge verloren.
 * „Abbrechen" lässt alles stehen, „Verwerfen" macht weiter. Ohne Entwurf geht
 * es gleich weiter. In der App fragen die Fenster selbst (SupportModale).
 */
export function useEntwurfSchutz(): (was: { antwort: boolean; notiz: boolean }, weiter: () => void) => void {
  const [presentAlert] = useIonAlert();
  return useCallback((was, weiter) => {
    if (!was.antwort && !was.notiz) {
      weiter();
      return;
    }
    presentAlert({
      header: ENTWURF_RUECKFRAGE.header,
      message: ENTWURF_RUECKFRAGE.message(was),
      buttons: [
        { text: ENTWURF_RUECKFRAGE.abbrechen, role: 'cancel' },
        { text: ENTWURF_RUECKFRAGE.verwerfen, role: 'destructive', handler: weiter },
      ],
    });
  }, [presentAlert]);
}
