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
        right: '0px',
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
