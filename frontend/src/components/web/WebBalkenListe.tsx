// Waagerechte Balken der Web-Fassung in eigenem SVG: Name links, Balken, Wert
// am Ende des Balkens (bei einer Rangliste mit wenigen Eintraegen steht der
// Wert an jedem Balken). Ein Balken ist hoechstens 24 px dick, oben/rechts
// 4 px gerundet; alle in einer Farbe, denn die Laenge traegt den Wert.
//
// Die Werte stehen zusaetzlich als Tabelle fuer Vorleseprogramme da.

import React from 'react';
import { zahlText } from '../../utils/webDiagramm';
import { useElementBreite } from './useElementBreite';

export interface WebBalkenEintrag {
  schluessel: string;
  name: string;
  wert: number;
}

export interface WebBalkenListeProps {
  titel: string;
  zusammenfassung: string;
  eintraege: readonly WebBalkenEintrag[];
  /** Eine Farbe als Token. */
  farbe: string;
  /** Kopf der Wertspalte in der Tabelle: "Gemeinden". */
  einheit: string;
}

const ZEILE = 34;
const BALKEN = 14;

/** Rechts gerundeter Balken, links gerade. */
const balkenRechts = (x: number, y: number, b: number, h: number, r = 4): string => {
  if (b <= 0) return '';
  const rr = Math.min(r, b, h / 2);
  return `M${x},${y}H${x + b - rr}Q${x + b},${y} ${x + b},${y + rr}V${y + h - rr}Q${x + b},${y + h} ${x + b - rr},${y + h}H${x}Z`;
};

const WebBalkenListe: React.FC<WebBalkenListeProps> = ({ titel, zusammenfassung, eintraege, farbe, einheit }) => {
  const [huelle, breite] = useElementBreite<HTMLDivElement>(520);
  const nameBreite = Math.min(190, Math.round(breite * 0.4));
  const maxZeichen = Math.max(8, Math.floor(nameBreite / 6.4));
  const wertPlatz = 44;
  const plotB = Math.max(breite - nameBreite - wertPlatz - 8, 20);
  const hoechster = Math.max(1, ...eintraege.map((e) => e.wert));
  const hoehe = Math.max(eintraege.length, 1) * ZEILE;

  return (
    <figure className="web-diagramm">
      <div ref={huelle}>
        <svg
          className="web-diagramm__svg"
          viewBox={`0 0 ${breite} ${hoehe}`}
          width={breite}
          height={hoehe}
          role="img"
          aria-label={`${titel}: ${zusammenfassung}`}
        >
          {eintraege.map((e, i) => {
            const y = i * ZEILE + (ZEILE - BALKEN) / 2;
            const laenge = Math.max(e.wert > 0 ? 3 : 0, (e.wert / hoechster) * plotB);
            const gekuerzt = e.name.length > maxZeichen ? `${e.name.slice(0, maxZeichen - 1).trimEnd()}…` : e.name;
            return (
              <g key={e.schluessel} className="web-balkenzeile">
                <text className="web-diagramm__text web-balkenliste__name" x={0} y={y + BALKEN / 2 + 4}>
                  {gekuerzt}
                  {gekuerzt !== e.name && <title>{e.name}</title>}
                </text>
                <path className="web-balken" d={balkenRechts(nameBreite, y, laenge, BALKEN)} style={{ fill: farbe }} />
                <text className="web-diagramm__text web-diagramm__text--stark" x={nameBreite + laenge + 8} y={y + BALKEN / 2 + 4}>
                  {zahlText(e.wert)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <table className="web-nur-vorlesen">
        <caption>{titel}</caption>
        <thead>
          <tr><th scope="col">Name</th><th scope="col">{einheit}</th></tr>
        </thead>
        <tbody>
          {eintraege.map((e) => (
            <tr key={e.schluessel}><th scope="row">{e.name}</th><td>{e.wert}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
};

export default WebBalkenListe;
