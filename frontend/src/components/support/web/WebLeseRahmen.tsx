// Der Rahmen um den Lesebereich der Web-Fassung (Vorgänge und Posteingang,
// web/WebPostfach) -- docs/planung/support-detailseiten.md, F und „Rahmen";
// Simon, 11.10.2026: Frage 6 (nach Erledigt, Archivieren oder Löschen der
// nächste Eintrag) und Frage 9 („Breit lesen" als Schalter, je Gerät
// gemerkt, Direktlinks weiter mit Liste).
//
//   - LeseRahmen: was die Liste dem Lesebereich mitgibt -- breit oder nicht,
//     voriger und nächster Eintrag, wählen, „abgeschlossen" (öffnet den
//     nächsten Eintrag) und die hervorzuhebende Mail (?mail=). Über einen
//     Kontext, damit WebVorgangDetail und WebPostDetail ihre Props behalten;
//     ohne Liste (Provider) gilt LESE_RAHMEN_NEUTRAL.
//   - leseRahmenVon: baut den Rahmen aus der Liste (rein, prüfbar).
//   - useBreitLesen: die Wahl „Breit lesen", je Gerät im localStorage gemerkt
//     -- nur Bequemlichkeit, jeder Zugriff in try/catch, ohne Speicher gilt
//     sie bis zum Neuladen. Ein Direktlink öffnet mit Liste.
//   - WebLeseNavigation: „‹ Alle Vorgänge" und (‹)(›), nur wenn breit; die
//     Pfeiltasten hoch und runter blättern dort wie in der Liste. Sie steht
//     über dem Lesebereich (WebPostfach, `leiste`), nicht im Kopf des
//     Eintrags: So bleibt sie beim Blättern stehen, auch solange der nächste
//     Eintrag lädt oder fehlt, und der Fokus auf ihr (bis 12.10.2026 stand
//     sie im Kopf und fehlte, solange kein Eintrag geladen war).
//   - WebLesen: der Lesebereich selbst (Kopf klebt oben: Kreis, Titel,
//     Kennzeichen, Aktionen; darunter der Inhalt) -- für Vorgang und Mail
//     derselbe Kopf. Er setzt den Fokus nach einem Wechsel des Eintrags
//     (LeseRahmen.fokusAbholen).
// Was keine Darstellung ist -- useLeseRahmen, useBreitLesen, leseRahmenVon --,
// steht in leseRahmen.ts und wird von dort importiert: Fast Refresh verlangt
// Dateien, die nur Bausteine ausführen (react-refresh/only-export-components).
// Konstanten und Typen reicht diese Datei weiter.

import React, { useEffect, useRef } from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_WEITER_GEFUELLT, ICON_ZURUECK } from '../../shared/icons';
import WebKnopf from '../../web/WebKnopf';
import { BREIT_LESEN } from '../../../seiten/supportDetail';
import { RahmenKontext, useLeseRahmen, type LeseFokus, type LeseRahmen } from './leseRahmen';

export {
  LESE_RAHMEN_NEUTRAL,
  SCHLUESSEL_BREIT_LESEN,
  type LeseFokus,
  type LeseRahmen,
  type LeseRahmenTeile,
} from './leseRahmen';

export const LeseRahmenProvider: React.FC<{ wert: LeseRahmen; children: React.ReactNode }> = ({ wert, children }) => (
  <RahmenKontext.Provider value={wert}>{children}</RahmenKontext.Provider>
);

/** Die Namen der drei Knöpfe der Leiste -- an ihnen findet der Fokus nach einem Wechsel seinen Knopf wieder. */
const leistenNamen = (listeLabel: string): Record<Exclude<LeseFokus, 'titel'>, string> => ({
  zurueck: BREIT_LESEN.zurueck(listeLabel),
  vorher: BREIT_LESEN.vorher,
  weiter: BREIT_LESEN.weiter,
});

/** Ist der Knopf eben verschwunden, auf dem der Fokus stand, steht er auf <body>. */
const fokusVerloren = (): boolean => {
  const aktiv = document.activeElement;
  return aktiv === null || aktiv === document.body;
};

/**
 * Wohin der Fokus nach einem Wechsel kommt: der gewünschte Knopf der Leiste,
 * sonst der der anderen Richtung (am Ende der Liste ist einer gesperrt), sonst
 * „‹ Alle …"; nach einem Abschluss der Titel. `bereich` enthält die Leiste.
 */
function fokusZiel(bereich: HTMLElement, titel: HTMLElement | null, ziel: LeseFokus, listeLabel: string): HTMLElement | null {
  if (ziel === 'titel') return titel;
  const namen = leistenNamen(listeLabel);
  const reihe: Array<keyof typeof namen> = ziel === 'zurueck' ? ['zurueck'] : ziel === 'vorher' ? ['vorher', 'weiter', 'zurueck'] : ['weiter', 'vorher', 'zurueck'];
  const knoepfe = [...bereich.querySelectorAll<HTMLButtonElement>('.web-lesen__navigation button')];
  for (const k of reihe) {
    const knopf = knoepfe.find((b) => b.getAttribute('aria-label') === namen[k] && !b.disabled);
    if (knopf) return knopf;
  }
  return titel;
}

/**
 * Über dem breiten Lesebereich: zurück zur Liste und voriger/nächster
 * Eintrag. Schmal: nichts. Die Pfeiltasten hoch und runter wirken hier wie in
 * der Liste (Plan F: „die Pfeiltasten wirken weiter"); der Fokus bleibt
 * danach auf dem Knopf, auf dem er stand -- die Leiste steht über dem
 * Lesebereich und bleibt beim Wechsel des Eintrags stehen. Nur am Ende der
 * Liste wird der Knopf gesperrt, mit dem man eben geblättert hat; dann geht
 * der Fokus auf den der anderen Richtung.
 */
export const WebLeseNavigation: React.FC = () => {
  const r = useLeseRahmen();
  const leiste = useRef<HTMLElement>(null);
  // In welche Richtung eben über die Leiste geblättert wurde.
  const geblaettert = useRef<'vorher' | 'weiter' | null>(null);
  const { vorheriger, naechster, listeLabel } = r;
  useEffect(() => {
    const richtung = geblaettert.current;
    geblaettert.current = null;
    const nav = leiste.current;
    if (richtung === null || nav === null) return;
    // Gesperrt behält ein Knopf den Fokus (oder der Browser setzt ihn auf <body>); wer woanders steht, bleibt dort.
    const aktiv = document.activeElement;
    const gesperrt = aktiv instanceof HTMLButtonElement && nav.contains(aktiv) && aktiv.disabled;
    if (!gesperrt && !fokusVerloren()) return;
    fokusZiel(nav, null, richtung, listeLabel)?.focus();
  }, [vorheriger, naechster, listeLabel]);

  if (!r.breit) return null;
  const namen = leistenNamen(r.listeLabel);
  const blaettern = (...args: Parameters<LeseRahmen['blaettern']>) => {
    const [richtung] = args;
    if ((richtung === 'vorher' ? r.vorheriger : r.naechster) !== null) geblaettert.current = richtung;
    r.blaettern(...args);
  };
  const taste = (ereignis: React.KeyboardEvent<HTMLElement>) => {
    if (ereignis.key !== 'ArrowDown' && ereignis.key !== 'ArrowUp') return;
    ereignis.preventDefault();
    const name = (ereignis.target as HTMLElement).getAttribute('aria-label');
    const auf = (Object.keys(namen) as Array<keyof typeof namen>).find((k) => namen[k] === name);
    blaettern(ereignis.key === 'ArrowDown' ? 'weiter' : 'vorher', auf);
  };
  return (
    // Die Pfeiltasten gehören zur Leiste; die Knöpfe darin sind das Bedienbare.
    <nav ref={leiste} className="web-lesen__navigation" aria-label={BREIT_LESEN.navigation} onKeyDown={taste}>
      <WebKnopf art="text" klein onClick={r.breitUmschalten} aria-label={namen.zurueck} title={namen.zurueck}>
        <IonIcon icon={ICON_ZURUECK} aria-hidden="true" />
        {r.listeLabel}
      </WebKnopf>
      <span className="web-lesen__blaettern">
        <WebKnopf symbol klein disabled={r.vorheriger === null} onClick={() => blaettern('vorher')} aria-label={namen.vorher} title={namen.vorher}>
          <IonIcon icon={ICON_ZURUECK} aria-hidden="true" />
        </WebKnopf>
        <WebKnopf symbol klein disabled={r.naechster === null} onClick={() => blaettern('weiter')} aria-label={namen.weiter} title={namen.weiter}>
          <IonIcon icon={ICON_WEITER_GEFUELLT} aria-hidden="true" />
        </WebKnopf>
      </span>
    </nav>
  );
};

export interface WebLesenProps {
  titel: string;
  /** Der Kreis vor dem Titel (Symbol der Art bzw. Initialen) -- derselbe wie in der Zeile der Liste. */
  kreis?: React.ReactNode;
  /** Unter dem Titel: Nummer, Status, Marken, Gemeinde bzw. Absender. */
  kennzeichen?: React.ReactNode;
  /** Alle Aktionen rechts, die wichtigste rechts außen. */
  aktionen?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Der Lesebereich: ein Artikel mit klebendem Kopf -- Kreis, Titel (voller
 * Betreff im Tooltip), Kennzeichen und Aktionen; darunter der Inhalt. Die
 * Leiste zum Blättern steht breit darüber, außerhalb des Artikels
 * (WebLeseNavigation).
 *
 * Steht er für einen neuen Eintrag (‹ ›, Pfeiltasten, nach Erledigt,
 * Archivieren oder Löschen), holt er beim Rahmen ab, wohin der Fokus gehört
 * -- nur, wenn er mit dem alten Knopf verloren ging; wer inzwischen
 * woanders ist, bleibt dort.
 */
export const WebLesen: React.FC<WebLesenProps> = ({ titel, kreis, kennzeichen, aktionen, children }) => {
  const { fokusAbholen, listeLabel } = useLeseRahmen();
  const kopf = useRef<HTMLElement>(null);
  const titelZeile = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const ziel = fokusAbholen();
    if (ziel === null || !kopf.current || !fokusVerloren()) return;
    // Die Leiste steht über dem Artikel, im Lesebereich der Liste.
    const bereich = kopf.current.closest<HTMLElement>('.web-postfach__lesen') ?? kopf.current;
    fokusZiel(bereich, titelZeile.current, ziel, listeLabel)?.focus();
  }, [fokusAbholen, listeLabel]);
  return (
    <article className="web-lesen" aria-label={titel}>
      <header ref={kopf} className="web-lesen__kopf">
        {kreis && <div className="web-lesen__kreis">{kreis}</div>}
        <div className="web-lesen__titelblock">
          {/* tabIndex -1: Ziel des Fokus nach einem Abschluss, nicht in der Tab-Reihe. */}
          <h2 ref={titelZeile} className="web-lesen__titel" title={titel} tabIndex={-1}>{titel}</h2>
          {kennzeichen && <div className="web-lesen__angaben">{kennzeichen}</div>}
        </div>
        {aktionen && <div className="web-lesen__werkzeuge">{aktionen}</div>}
      </header>
      <div className="web-lesen__inhalt">{children}</div>
    </article>
  );
};
