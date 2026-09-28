import React from 'react';
import { IonButton, IonIcon } from '@ionic/react';
import { ICON_GLOCKE, ICON_MAIL_GEFUELLT } from './icons';
import { useBadge } from '../../contexts/BadgeContext';
import { useWartendeVorgaenge } from '../../hooks/useWartendeVorgaenge';
import { oeffnePostfach } from '../../utils/postfach';

/**
 * Wie dringend ist, was hinter der Glocke liegt?
 *
 *  - 'ruhe':    nichts — kein Badge, nur die Glocke.
 *  - 'hinweis': ungelesene Mitteilungen (Abzeichen, Antraege). Eine Nachricht,
 *               keine Aufgabe — deshalb die ruhige Grundfarbe, und seit dem
 *               28.09.2026 ein Briefumschlag statt einer Zahl.
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
  /**
   * Die Zahl an der Glocke: nur die Warteschlange (wartend + gescheitert).
   * Ungelesene Mitteilungen zaehlen hier nicht -- sie zeigen den Umschlag.
   */
  anzahl: number;
  /** Mindestens eine ungelesene Mitteilung: Briefumschlag statt Zahl. */
  umschlag: boolean;
  variante: GlockeVariante;
  /** Der volle Satz fuer Vorleseprogramme. */
  text: string;
}

const einzahlMehrzahl = (n: number, einzahl: string, mehrzahl: string): string =>
  `${n} ${n === 1 ? einzahl : mehrzahl}`;

/**
 * Reine Funktion, damit die Regel ohne Rendern pruefbar bleibt.
 *
 * KEINE ZAHL FUER MITTEILUNGEN (28.09.2026, Simon): Das Postfach bekommt
 * keine Zahl mehr, sondern einen blauen Badge mit Briefumschlag, sobald
 * mindestens eine Mitteilung ungelesen ist -- fuer alle drei Rollen. Bis
 * dahin stand hier die Summe aus Mitteilungen und Warteschlange.
 *
 * Die Warteschlange behaelt ihre Zahl: Das sind Vorgaenge dieses Geraets
 * (gesendet oder gescheitert), keine Mitteilungen, und die Zahl sagt, wie
 * viel noch offen ist. Liegt etwas in der Warteschlange, steht ihre Zahl
 * (orange/rot) im Kreis -- die dringlichere Nachricht; der Briefumschlag
 * kommt zurueck, sobald sie leer ist. Der Satz fuer Vorleseprogramme nennt
 * beides.
 */
export const glockeZustand = (ungelesen: number, wartend: number, gescheitert: number): GlockeZustand => {
  const anzahl = wartend + gescheitert;
  const umschlag = ungelesen > 0;
  let variante: GlockeVariante = 'ruhe';
  if (gescheitert > 0 && wartend === 0) variante = 'danger';
  else if (wartend > 0) variante = 'warning';
  else if (ungelesen > 0) variante = 'hinweis';

  const warteschlange: string[] = [];
  if (wartend > 0) warteschlange.push(einzahlMehrzahl(wartend, 'Vorgang wird gesendet', 'Vorgänge werden gesendet'));
  if (gescheitert > 0) warteschlange.push(einzahlMehrzahl(gescheitert, 'Vorgang wurde nicht gesendet', 'Vorgänge wurden nicht gesendet'));
  let text: string;
  if (umschlag) text = ['Ungelesene Mitteilungen im Postfach', ...warteschlange].join(', ');
  else if (warteschlange.length > 0) text = `Postfach: ${warteschlange.join(', ')}`;
  else text = 'Postfach: nichts Neues';

  return { anzahl, umschlag, variante, text };
};

/**
 * Die Glocke in der Kopfzeile. Steht ueber AppKopfzeile auf jeder Seite und
 * oeffnet das eine Postfach (common/PostfachModal), das auf App-Ebene haengt.
 *
 * Simon (25.09.2026): "Könnten wir das nicht oben in einen Button in die
 * Leiste packen über alle Seiten und die Glocke drauf legen. Für Hinweise.
 * Auch Warteschlange?" — "Für alle."
 *
 * Zwei Quellen: die ungelesenen Mitteilungen aus dem BadgeContext
 * (GET /notifications/badge-counts, Feld postfach) -- sie zeigen den
 * Briefumschlag -- und die Offline-Warteschlange aus useWartendeVorgaenge,
 * die ihre Zahl behaelt. Beides sitzt im selben Kreis an derselben Stelle
 * (Geometrie in variables.css). Die Farbe traegt nur der Kreis — die Glocke
 * selbst bleibt in Toolbar-Farbe wie ihre Nachbarn.
 *
 * Gehoert als Kind in IonButtons slot="end"; AppKopfzeile stellt das.
 */
const PostfachGlocke: React.FC = () => {
  const { postfachUngelesen } = useBadge();
  const { wartend, gescheitert } = useWartendeVorgaenge();
  const { anzahl, umschlag, variante, text } = glockeZustand(postfachUngelesen, wartend.length, gescheitert.length);

  return (
    <IonButton
      className="app-postfach-glocke"
      data-variante={variante}
      onClick={oeffnePostfach}
      aria-label={`${text} — antippen öffnet das Postfach`}
    >
      <IonIcon slot="icon-only" icon={ICON_GLOCKE} aria-hidden="true" />
      {anzahl > 0 ? (
        <span className="app-postfach-glocke__zahl" aria-hidden="true">
          {anzahl > 99 ? '99+' : anzahl}
        </span>
      ) : umschlag && (
        <span className="app-postfach-glocke__zahl app-postfach-glocke__zahl--umschlag" aria-hidden="true">
          <IonIcon icon={ICON_MAIL_GEFUELLT} aria-hidden="true" />
        </span>
      )}
    </IonButton>
  );
};

export default PostfachGlocke;
