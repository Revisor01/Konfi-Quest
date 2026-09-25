import React from 'react';
import { IonButton, IonIcon } from '@ionic/react';
import { ICON_GLOCKE } from './icons';
import { useBadge } from '../../contexts/BadgeContext';
import { useWartendeVorgaenge } from '../../hooks/useWartendeVorgaenge';
import { oeffnePostfach } from '../../utils/postfach';

/**
 * Wie dringend ist, was hinter der Glocke liegt?
 *
 *  - 'ruhe':    nichts — keine Zahl, nur die Glocke.
 *  - 'hinweis': ungelesene Mitteilungen (Abzeichen, Antraege). Eine Nachricht,
 *               keine Aufgabe — deshalb die ruhige Grundfarbe.
 *  - 'warning': etwas liegt noch in der Offline-Warteschlange. Information,
 *               kein Alarm (orange).
 *  - 'danger':  ein Vorgang ist endgueltig gescheitert und nichts wartet
 *               mehr. Das ist eine Aufgabe und darf auffallen (rot).
 *
 * Die Stufen fuer die Warteschlange sind wortgleich aus der frueheren
 * WartendeVorgaengeLeiste uebernommen (30.08.2026): "Wartend ist Information,
 * Fehlschlag ist eine Aufgabe." Solange noch etwas gesendet wird, bleibt es
 * bei orange — auch wenn daneben schon etwas gescheitert ist.
 */
export type GlockeVariante = 'ruhe' | 'hinweis' | 'warning' | 'danger';

export interface GlockeZustand {
  /** Was an der Glocke steht: ungelesen + wartend + gescheitert. */
  anzahl: number;
  variante: GlockeVariante;
  /** Der volle Satz fuer Vorleseprogramme. */
  text: string;
}

const einzahlMehrzahl = (n: number, einzahl: string, mehrzahl: string): string =>
  `${n} ${n === 1 ? einzahl : mehrzahl}`;

/** Reine Funktion, damit die Regel ohne Rendern pruefbar bleibt. */
export const glockeZustand = (ungelesen: number, wartend: number, gescheitert: number): GlockeZustand => {
  const anzahl = ungelesen + wartend + gescheitert;
  let variante: GlockeVariante = 'ruhe';
  if (gescheitert > 0 && wartend === 0) variante = 'danger';
  else if (wartend > 0) variante = 'warning';
  else if (ungelesen > 0) variante = 'hinweis';

  const teile: string[] = [];
  if (ungelesen > 0) teile.push(einzahlMehrzahl(ungelesen, 'ungelesene Mitteilung', 'ungelesene Mitteilungen'));
  if (wartend > 0) teile.push(einzahlMehrzahl(wartend, 'Vorgang wird gesendet', 'Vorgänge werden gesendet'));
  if (gescheitert > 0) teile.push(einzahlMehrzahl(gescheitert, 'Vorgang wurde nicht gesendet', 'Vorgänge wurden nicht gesendet'));
  const text = teile.length > 0 ? `Postfach: ${teile.join(', ')}` : 'Postfach: nichts Neues';

  return { anzahl, variante, text };
};

/**
 * Die Glocke in der Kopfzeile. Steht ueber AppKopfzeile auf jeder Seite und
 * oeffnet das eine Postfach (common/PostfachModal), das auf App-Ebene haengt.
 *
 * Simon (25.09.2026): "Könnten wir das nicht oben in einen Button in die
 * Leiste packen über alle Seiten und die Glocke drauf legen. Für Hinweise.
 * Auch Warteschlange?" — "Für alle."
 *
 * Zwei Quellen, eine Zahl: die ungelesenen Mitteilungen aus dem BadgeContext
 * (GET /notifications/badge-counts, Feld postfach) und die Offline-
 * Warteschlange aus useWartendeVorgaenge. Die Farbe traegt nur die Zahl —
 * die Glocke selbst bleibt in Toolbar-Farbe wie ihre Nachbarn.
 *
 * Gehoert als Kind in IonButtons slot="end"; AppKopfzeile stellt das.
 */
const PostfachGlocke: React.FC = () => {
  const { postfachUngelesen } = useBadge();
  const { wartend, gescheitert } = useWartendeVorgaenge();
  const { anzahl, variante, text } = glockeZustand(postfachUngelesen, wartend.length, gescheitert.length);

  return (
    <IonButton
      className="app-postfach-glocke"
      data-variante={variante}
      onClick={oeffnePostfach}
      aria-label={`${text} — antippen öffnet das Postfach`}
    >
      <IonIcon slot="icon-only" icon={ICON_GLOCKE} aria-hidden="true" />
      {anzahl > 0 && (
        <span className="app-postfach-glocke__zahl" aria-hidden="true">
          {anzahl > 99 ? '99+' : anzahl}
        </span>
      )}
    </IonButton>
  );
};

export default PostfachGlocke;
