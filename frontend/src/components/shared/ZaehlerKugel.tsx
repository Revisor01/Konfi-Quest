import React from 'react';

/**
 * Rote Zaehler-Kugel oben rechts an einem Listen-Symbol -- fuer Eintraege,
 * die Neues tragen: ein Chat-Raum mit ungelesenen Nachrichten, eine
 * Challenge mit Neuigkeiten. Sie steht als Geschwister des Symbolkreises
 * in einem `.app-zaehler-anker` (position: relative, so breit wie der
 * Kreis); alles Weitere -- Lage, Groesse, Rand -- regelt das Stylesheet
 * (variables.css, Abschnitt "Rote Zaehler-Kugel am Listen-Symbol").
 *
 * Ab 10 steht "9+", genau wie an den Reitern in MainTabs. Bei 0 wird nichts
 * gerendert.
 *
 * EINE Stelle fuer beide Listen (24.09.2026, Simon: "Badge-Indikator genau
 * wie beim Chat"): Vorher lag die Kugel als Inline-Block nur in der
 * Chat-Uebersicht. Eine zweite Abschrift fuer die Challenges waere die
 * naechste Stelle, an der beide mit der Zeit auseinanderlaufen.
 *
 * WARUM KEINE INLINE-STYLES MEHR (25.09.2026, Simon: "in beiden Ansichten
 * gleich positioniert auf dem Icon"): Die Symbolkreise sind verschieden
 * gross (28px, im Chat 32px). Dieselbe Lage relativ zum KREISRAND braucht
 * je Groesse eigene Werte, und die kennt nur der Anker -- ueber
 * `:has(> .app-icon-circle--lg)` im Stylesheet. Ein Inline-Style hier
 * wuerde diese Regel ueberstimmen. Vertrag: zaehlerKugel.test.tsx.
 */
interface ZaehlerKugelProps {
  anzahl: number;
  /** Was gezaehlt wird, fuer Vorleseprogramme: "ungelesene Nachrichten". */
  label: string;
}

const ZaehlerKugel: React.FC<ZaehlerKugelProps> = ({ anzahl, label }) => {
  if (!(anzahl > 0)) return null;
  return (
    <span className="app-zaehler-kugel" aria-label={`${anzahl} ${label}`}>
      {anzahl > 9 ? '9+' : anzahl}
    </span>
  );
};

export default ZaehlerKugel;
