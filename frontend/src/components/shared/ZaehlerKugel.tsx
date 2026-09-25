import React from 'react';

/**
 * Rote Zaehler-Kugel oben rechts an einem Listen-Symbol -- fuer Eintraege,
 * die Neues tragen: ein Chat-Raum mit ungelesenen Nachrichten, eine
 * Challenge mit Neuigkeiten. Der Elternknoten braucht `position: relative`.
 *
 * Ab 10 steht "9+", genau wie an den Reitern in MainTabs. Bei 0 wird nichts
 * gerendert.
 *
 * EINE Stelle fuer beide Listen (24.09.2026, Simon: "Badge-Indikator genau
 * wie beim Chat"): Vorher lag die Kugel als Inline-Block nur in der
 * Chat-Uebersicht. Eine zweite Abschrift fuer die Challenges waere die
 * naechste Stelle, an der beide mit der Zeit auseinanderlaufen.
 *
 * WO SIE STEHT (25.09.2026, Simon am iPhone: "darf etwas hoeher und etwas
 * weiter nach rechts, dass es staerker am Rand des Icons liegt, aber noch
 * darueber"). Gemessen im Browser: Der Elternknoten ist so breit wie der
 * Symbolkreis (28px, im Chat 32px) und um dessen margin-top (4px) hoeher.
 * Mit right: 0 lag der Mittelpunkt der Kugel (16px) 11,7px bzw. 14,4px vom
 * Kreismittelpunkt entfernt -- INNERHALB des Kreisradius (14 bzw. 16), also
 * auf dem Symbol. Mit right: -4px liegt er bei 14,1 bzw. 17,0px: auf dem
 * Kreisrand, die Kugel zur Haelfte darueber. Hoeher geht nicht: top: 0 ist
 * die Oberkante von .app-list-item__main (overflow: hidden) -- ab -2px wird
 * die Kugel oben beschnitten (gemessen). Vertrag: zaehlerKugel.test.tsx.
 */
interface ZaehlerKugelProps {
  anzahl: number;
  /** Was gezaehlt wird, fuer Vorleseprogramme: "ungelesene Nachrichten". */
  label: string;
}

const ZaehlerKugel: React.FC<ZaehlerKugelProps> = ({ anzahl, label }) => {
  if (!(anzahl > 0)) return null;
  return (
    <span
      aria-label={`${anzahl} ${label}`}
      style={{
        position: 'absolute',
        top: '0px',
        right: '-4px',
        fontSize: 'var(--app-text-winzig)',
        color: 'white',
        fontWeight: 'var(--app-schrift-fett)',
        backgroundColor: 'var(--app-color-danger)',
        width: anzahl > 9 ? '18px' : '16px',
        height: '16px',
        borderRadius: 'var(--app-radius-kreis)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: 'var(--app-schatten-flach-stark)',
        border: '2px solid white',
        zIndex: 2
      }}
    >
      {anzahl > 9 ? '9+' : anzahl}
    </span>
  );
};

export default ZaehlerKugel;
