// Liste und Lesebereich nebeneinander -- die Web-Fassung von Posteingang und
// Vorgängen „wie in einem guten Mail Client" (Simon, 11.10.2026: „Auf Web wird
// sie ausgewählt Mail rechts in einem Feld angezeigt").
//
//   - WebPostfach: die zwei Spalten; jede rollt für sich, die Seite füllt die
//     Höhe des Fensters (WebSeite `voll`).
//   - WebPostfachZeilen: die Liste links. Eine Zeile wählt man per Klick oder
//     mit den Pfeiltasten; die gewählte trägt aria-current. Mit `auswahl`
//     steht vor jeder Zeile ein Kästchen für Sammelaktionen.
//   - WebLesebereich: rechts der Kopf (Titel, Angaben, Knöpfe), darunter der
//     Inhalt.
//
// Was gewählt ist, hält useLeseAuswahl (eigene Datei).

import React, { useRef } from 'react';
import { IonIcon } from '@ionic/react';

export interface WebPostfachProps {
  /** Name der Liste für Vorleseprogramme. */
  listeBeschriftung: string;
  /** Oben in der Liste, bleibt beim Rollen stehen: „Alle auswählen" und die Sammelaktionen. */
  listeKopf?: React.ReactNode;
  liste: React.ReactNode;
  lesen: React.ReactNode;
}

const WebPostfach: React.FC<WebPostfachProps> = ({ listeBeschriftung, listeKopf, liste, lesen }) => (
  <div className="web-postfach">
    <nav className="web-postfach__liste" aria-label={listeBeschriftung}>
      {listeKopf && <div className="web-postfach__listekopf">{listeKopf}</div>}
      {liste}
    </nav>
    <div className="web-postfach__lesen">{lesen}</div>
  </div>
);

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
  ungelesen?: (eintrag: T) => boolean;
  /** Kästchen vor jeder Zeile für Sammelaktionen. */
  auswahl?: { ausgewaehlt: ReadonlySet<number>; umschalten: (id: number) => void };
}

export function WebPostfachZeilen<T>({ eintraege, kennung, gewaehlt, onWaehlen, zeile, name, ungelesen, auswahl }: WebPostfachZeilenProps<T>): React.ReactElement {
  const liste = useRef<HTMLUListElement>(null);

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
        return (
          <li key={id} className={`web-postfachzeile${aktiv ? ' web-postfachzeile--gewaehlt' : ''}${neu ? ' web-postfachzeile--ungelesen' : ''}`}>
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
              className="web-postfachzeile__knopf"
              aria-current={aktiv ? 'true' : undefined}
              aria-label={`${name(e)}${neu ? ', ungelesen' : ''}`}
              onClick={() => onWaehlen(id)}
            >
              {neu && <span className="app-ungelesen-punkt web-postfachzeile__punkt" aria-hidden="true" />}
              {zeile(e)}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export interface WebLesebereichProps {
  titel: string;
  /** Unter dem Titel: Nummer, Status, Gemeinde, Absender. */
  angaben?: React.ReactNode;
  /** Knöpfe rechts im Kopf (Antworten, Einordnen, Archivieren, Löschen). */
  werkzeuge?: React.ReactNode;
  children: React.ReactNode;
}

export const WebLesebereich: React.FC<WebLesebereichProps> = ({ titel, angaben, werkzeuge, children }) => (
  <article className="web-lesen" aria-label={titel}>
    <header className="web-lesen__kopf">
      <div className="web-lesen__titelblock">
        <h2 className="web-lesen__titel">{titel}</h2>
        {angaben && <div className="web-lesen__angaben">{angaben}</div>}
      </div>
      {werkzeuge && <div className="web-lesen__werkzeuge">{werkzeuge}</div>}
    </header>
    <div className="web-lesen__inhalt">{children}</div>
  </article>
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
