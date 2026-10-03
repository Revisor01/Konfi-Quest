// Kleine Linie fuer eine Kennzahl-Kachel: zwoelf Werte, die Linie in der
// leisen Farbe, der letzte Punkt (der laufende Monat) in der Reihenfarbe.
// Reine Zierde neben der Zahl -- die Werte stehen im grossen Diagramm, deshalb
// aria-hidden.

import React from 'react';
import { linienPfad } from '../../../utils/webDiagramm';

export interface WebSparkProps {
  werte: readonly number[];
  /** Farbe des letzten Punkts als Token. */
  farbe: string;
  breite?: number;
  hoehe?: number;
}

const WebSpark: React.FC<WebSparkProps> = ({ werte, farbe, breite = 80, hoehe = 28 }) => {
  if (werte.length < 2) return null;
  const rand = 4;
  const hoechster = Math.max(1, ...werte);
  const kleinster = Math.min(0, ...werte);
  const spanne = hoechster - kleinster || 1;
  const punkte = werte.map((w, i) => [
    rand + (i * (breite - 2 * rand)) / (werte.length - 1),
    hoehe - rand - ((w - kleinster) / spanne) * (hoehe - 2 * rand),
  ] as const);
  const letzter = punkte[punkte.length - 1];
  return (
    <svg className="web-spark" width={breite} height={hoehe} viewBox={`0 0 ${breite} ${hoehe}`} aria-hidden="true" focusable="false">
      <path className="web-diagramm__linie" d={linienPfad(punkte)} style={{ stroke: 'var(--app-text-system)', opacity: 0.55 }} />
      <circle className="web-diagramm__punkt" cx={letzter[0]} cy={letzter[1]} r={3.5} style={{ fill: farbe }} />
    </svg>
  );
};

export default WebSpark;
