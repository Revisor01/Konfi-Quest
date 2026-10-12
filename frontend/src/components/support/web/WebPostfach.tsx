// Liste und Lesebereich nebeneinander -- die Web-Fassung von Posteingang und
// Vorgängen „wie in einem guten Mail Client" (Simon, 11.10.2026: „Auf Web wird
// sie ausgewählt Mail rechts in einem Feld angezeigt").
//
//   - WebPostfach: die zwei Spalten; jede rollt für sich, die Seite füllt die
//     Höhe des Fensters (WebSeite `voll`). Mit `breit` ist die Liste aus und
//     der Lesebereich nimmt die ganze Breite („Breit lesen",
//     docs/planung/support-detailseiten.md, F) -- die Liste bleibt dabei
//     stehen, wie sie war (Filter, Auswahl, Rollstand). Der Schalter
//     verschwindet mit der Liste, „‹ Alle Vorgänge" mit dem breiten Modus:
//     Der Fokus geht deshalb mit, auf „‹ Alle …" bzw. zurück auf die
//     gewählte Zeile (bis 12.10.2026 fiel er auf <body>).
//     Über dem Lesebereich steht `leiste` (breit: „‹ Alle …" und ‹ ›),
//     außerhalb dessen, was je Eintrag neu entsteht: Sie bleibt beim Blättern
//     stehen, auch solange der nächste Eintrag lädt oder fehlt, und rollt
//     nicht mit -- gerollt wird das Feld darunter (bis 12.10.2026 stand sie im
//     Kopf des geladenen Eintrags und fehlte sonst).
//   - WebPostfachZeilen: die Liste links. Eine Zeile wählt man per Klick oder
//     mit den Pfeiltasten; die gewählte trägt aria-current. Mit `auswahl`
//     steht vor jeder Zeile ein Kästchen für Sammelaktionen, mit `kreis` der
//     Kreis, der auch vor dem Titel im Lesebereich steht. Der Name einer
//     Zeile ist kurz („Vorgang 2: Betreff"); was sonst in ihr steht (Art,
//     Gemeinde, Status …), hören Vorleseprogramme als Beschreibung.
//   - MailKreis: die Initialen des Absenders einer Mail -- in ihrer Zeile und
//     im Kopf ihres Lesebereichs.
//   - WebLeseHinweis: rechts, solange nichts gewählt ist, beim Laden, bei Fehlern.
// Den Kopf des Lesebereichs (WebLesen) und die Leiste zum Blättern stellt
// web/WebLeseRahmen.tsx; was gewählt ist, hält useLeseAuswahl.

import React, { useEffect, useId, useRef } from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_BREIT_LESEN } from '../../shared/icons';
import { initialen } from '../../../utils/mailGespraeche';
import { BREIT_LESEN } from '../../../seiten/supportDetail';
import WebKnopf from '../../web/WebKnopf';

export interface WebPostfachProps {
  /** Name der Liste für Vorleseprogramme. */
  listeBeschriftung: string;
  /** Oben in der Liste, bleibt beim Rollen stehen: „Alle auswählen" und die Sammelaktionen. */
  listeKopf?: React.ReactNode;
  liste: React.ReactNode;
  lesen: React.ReactNode;
  /** Über dem Lesebereich, bleibt beim Wechsel des Eintrags stehen: die Leiste zum Blättern (WebLeseNavigation). */
  leiste?: React.ReactNode;
  /** „Breit lesen": die Liste ist aus, der Lesebereich nimmt die ganze Breite. */
  breit?: boolean;
  /** Der Schalter „Breit lesen" rechts im Kopf der Liste; ohne: kein Schalter. */
  breitLesen?: { onKlick: () => void; gesperrt?: boolean };
}

const WebPostfach: React.FC<WebPostfachProps> = ({ listeBeschriftung, listeKopf, liste, lesen, leiste, breit = false, breitLesen }) => {
  const listeRef = useRef<HTMLElement>(null);
  const lesenRef = useRef<HTMLDivElement>(null);
  const warBreit = useRef(breit);

  // Der Knopf, auf dem der Fokus stand, ist mit dem Wechsel verschwunden
  // (die Liste ist aus bzw. „‹ Alle …" fort): Er geht auf das Gegenstück.
  // Wer woanders steht, bleibt dort.
  useEffect(() => {
    if (warBreit.current === breit) return;
    warBreit.current = breit;
    const aktiv = document.activeElement;
    const listeNode = listeRef.current;
    const verloren = aktiv === null || aktiv === document.body || (breit && !!listeNode?.contains(aktiv));
    if (!verloren) return;
    const ziel = breit
      ? lesenRef.current?.querySelector<HTMLElement>('.web-lesen__navigation button')
      : listeNode?.querySelector<HTMLElement>('.web-postfachzeile__knopf[aria-current="true"]')
        ?? listeNode?.querySelector<HTMLElement>('.web-postfach__breit button');
    ziel?.focus();
  }, [breit]);

  return (
    <div className={`web-postfach${breit ? ' web-postfach--breit' : ''}`}>
      <nav ref={listeRef} className="web-postfach__liste" aria-label={listeBeschriftung} hidden={breit}>
        {listeKopf && (
          <div className="web-postfach__listekopf">
            {listeKopf}
            {breitLesen && (
              <span className="web-postfach__breit">
                <WebKnopf symbol klein disabled={breitLesen.gesperrt} onClick={breitLesen.onKlick} aria-label={BREIT_LESEN.an} title={BREIT_LESEN.titel}>
                  <IonIcon icon={ICON_BREIT_LESEN} aria-hidden="true" />
                </WebKnopf>
              </span>
            )}
          </div>
        )}
        {liste}
      </nav>
      <div ref={lesenRef} className="web-postfach__lesen">
        {leiste}
        {/* Immer derselbe Rahmen: Wechselt „breit“, entsteht der Eintrag darin nicht neu. */}
        <div className="web-postfach__lesefeld">{lesen}</div>
      </div>
    </div>
  );
};

export default WebPostfach;

export interface WebPostfachZeilenProps<T> {
  eintraege: readonly T[];
  kennung: (eintrag: T) => number;
  gewaehlt: number | null;
  onWaehlen: (id: number) => void;
  /** Der Inhalt einer Zeile (ohne Knopf drumherum). */
  zeile: (eintrag: T) => React.ReactNode;
  /** Name einer Zeile für Vorleseprogramme. */
  name: (eintrag: T) => string;
  /**
   * Was die Zeile außer dem Namen zeigt, als Beschreibung für
   * Vorleseprogramme (der Name ersetzt den Inhalt des Knopfes).
   */
  beschreibung?: (eintrag: T) => string;
  ungelesen?: (eintrag: T) => boolean;
  /** Kästchen vor jeder Zeile für Sammelaktionen. */
  auswahl?: { ausgewaehlt: ReadonlySet<number>; umschalten: (id: number) => void };
  /** Der Kreis vor dem Inhalt (Art eines Vorgangs, Initialen einer Mail) -- Zierde, der Name sagt alles. */
  kreis?: (eintrag: T) => React.ReactNode;
}

export function WebPostfachZeilen<T>({ eintraege, kennung, gewaehlt, onWaehlen, zeile, name, beschreibung, ungelesen, auswahl, kreis }: WebPostfachZeilenProps<T>): React.ReactElement {
  const liste = useRef<HTMLUListElement>(null);
  const basis = useId();

  // Pfeiltasten wie in einem Mailprogramm: die nächste Zeile wählen und den Fokus mitnehmen.
  const taste = (ereignis: React.KeyboardEvent<HTMLUListElement>) => {
    if (ereignis.key !== 'ArrowDown' && ereignis.key !== 'ArrowUp') return;
    const knoepfe = [...(liste.current?.querySelectorAll<HTMLButtonElement>('.web-postfachzeile__knopf') ?? [])];
    if (knoepfe.length === 0) return;
    ereignis.preventDefault();
    const jetzt = knoepfe.indexOf(document.activeElement as HTMLButtonElement);
    const von = jetzt === -1 ? eintraege.findIndex((e) => kennung(e) === gewaehlt) : jetzt;
    const ziel = Math.min(knoepfe.length - 1, Math.max(0, von + (ereignis.key === 'ArrowDown' ? 1 : -1)));
    knoepfe[ziel].focus();
    onWaehlen(kennung(eintraege[ziel]));
  };

  return (
    // Die Pfeiltasten gehören zur Liste; die Knöpfe darin sind das Bedienbare.
    <ul ref={liste} className="web-postfachzeilen" onKeyDown={taste}>
      {eintraege.map((e) => {
        const id = kennung(e);
        const aktiv = id === gewaehlt;
        const neu = ungelesen?.(e) ?? false;
        const beschreibungId = beschreibung ? `${basis}-${id}` : undefined;
        return (
          <li key={id} className={`web-postfachzeile${aktiv ? ' web-postfachzeile--gewaehlt' : ''}${neu ? ' web-postfachzeile--ungelesen' : ''}`}>
            {/* Verborgen, aber als Beschreibung lesbar: aria-describedby nimmt auch verborgene Elemente. */}
            {beschreibung && <span id={beschreibungId} hidden>{beschreibung(e)}</span>}
            {auswahl && (
              <input
                type="checkbox"
                className="web-kontrollkasten web-postfachzeile__kasten"
                aria-label={`Auswählen: ${name(e)}`}
                checked={auswahl.ausgewaehlt.has(id)}
                onChange={() => auswahl.umschalten(id)}
              />
            )}
            <button
              type="button"
              className={`web-postfachzeile__knopf${kreis ? ' web-postfachzeile__knopf--kreis' : ''}`}
              aria-current={aktiv ? 'true' : undefined}
              aria-label={`${name(e)}${neu ? ', ungelesen' : ''}`}
              aria-describedby={beschreibungId}
              onClick={() => onWaehlen(id)}
            >
              {neu && <span className="app-ungelesen-punkt web-postfachzeile__punkt" aria-hidden="true" />}
              {kreis ? (
                <>
                  {kreis(e)}
                  <span className="web-postfachzeile__inhalt">{zeile(e)}</span>
                </>
              ) : zeile(e)}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Der Kreis einer Mail: die Initialen des Absenders, wie im Verlauf -- in der
 * Zeile der Liste und, `gross`, vor dem Titel im Lesebereich. Zierde
 * (aria-hidden); der Absender steht immer als Wort daneben.
 */
export const MailKreis: React.FC<{ name: string | null | undefined; adresse: string; gross?: boolean }> = ({ name, adresse, gross = false }) => (
  <span className={`web-vorgang-kreis web-mail-kreis${gross ? ' web-vorgang-kreis--gross' : ''}`} aria-hidden="true">
    {initialen(name, adresse)}
  </span>
);

/** Rechts, solange nichts gewählt ist -- oder beim Laden, bei Fehlern. */
export const WebLeseHinweis: React.FC<{ icon: string; titel: string; text?: string; children?: React.ReactNode }> = ({ icon, titel, text, children }) => (
  <div className="web-lesen-leer" role="status">
    <IonIcon icon={icon} aria-hidden="true" className="web-lesen-leer__symbol" />
    <p className="web-lesen-leer__titel">{titel}</p>
    {text && <p className="web-lesen-leer__text">{text}</p>}
    {children}
  </div>
);
