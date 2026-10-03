// Die Punkte-Ringe der Startseite in der Web-Fassung: außen Gesamt, in der
// Mitte Gottesdienst, innen Gemeinde -- wie die Ringe der App, aber ruhig
// gezeichnet (eigenes SVG, ohne Zeichen-Animation) und auf hellem Kartengrund.
// Ist nur eine Punkteart eingeschaltet, zeigt ein einziger Ring sie allein;
// sind beide aus, steht ein Hinweis da.
//
// Die Farben stehen im Stylesheet (theme/web/start.css), nicht hier: Der
// Dunkelmodus kommt so von den Tokens. Die Zahlen sind Zierde und stehen in
// der Karte daneben noch einmal als Text -- das SVG trägt nur eine Zusammenfassung.

import React from 'react';
import { punkteText } from '../../../utils/punkteText';
import { zielProzent } from '../../../utils/webStart';
import '../../../theme/web/start.css';

export interface WebPunkteRingeProps {
  gesamt: number;
  gottesdienst: number;
  gemeinde: number;
  zielGottesdienst: number;
  zielGemeinde: number;
  gottesdienstAktiv: boolean;
  gemeindeAktiv: boolean;
  groesse?: number;
}

type Art = 'gesamt' | 'gottesdienst' | 'gemeinde';

const WebPunkteRinge: React.FC<WebPunkteRingeProps> = ({
  gesamt, gottesdienst, gemeinde, zielGottesdienst, zielGemeinde, gottesdienstAktiv, gemeindeAktiv, groesse = 200,
}) => {
  const ziel = (z: number) => (z > 0 ? z : 10);
  const beide = gottesdienstAktiv && gemeindeAktiv;
  const mitte = groesse / 2;
  const strich = groesse * 0.085;
  const abstand = strich * 0.45;
  const aussen = mitte - strich / 2 - 2;
  const radius = (n: number) => aussen - n * (strich + abstand);

  // Welche Ringe von außen nach innen gezeichnet werden.
  const ringe: Array<{ art: Art; prozent: number }> = [];
  if (beide) ringe.push({ art: 'gesamt', prozent: zielProzent(gesamt, ziel(zielGottesdienst) + ziel(zielGemeinde)) });
  if (gottesdienstAktiv) ringe.push({ art: 'gottesdienst', prozent: zielProzent(gottesdienst, ziel(zielGottesdienst)) });
  if (gemeindeAktiv) ringe.push({ art: 'gemeinde', prozent: zielProzent(gemeinde, ziel(zielGemeinde)) });

  const zahl = beide ? gesamt : gottesdienstAktiv ? gottesdienst : gemeinde;
  const beschreibung = ringe.length === 0
    ? 'Keine Punkteart eingeschaltet'
    : [
      beide ? `Gesamt ${punkteText(gesamt)} von ${ziel(zielGottesdienst) + ziel(zielGemeinde)}` : null,
      gottesdienstAktiv ? `Gottesdienst ${gottesdienst} von ${ziel(zielGottesdienst)}` : null,
      gemeindeAktiv ? `Gemeinde ${gemeinde} von ${ziel(zielGemeinde)}` : null,
    ].filter(Boolean).join(', ');

  return (
    <div className="web-ring" style={{ width: groesse, height: groesse }}>
      <svg
        className="web-ring__svg"
        width={groesse}
        height={groesse}
        viewBox={`0 0 ${groesse} ${groesse}`}
        role="img"
        aria-label={beschreibung}
      >
        {ringe.map((r, n) => {
          const rad = radius(n);
          const umfang = 2 * Math.PI * rad;
          const gefuellt = (Math.min(r.prozent, 100) / 100) * umfang;
          return (
            <g key={r.art}>
              <circle className="web-ring__spur" cx={mitte} cy={mitte} r={rad} fill="none" strokeWidth={strich} />
              {gefuellt > 0 && (
                <circle
                  className={`web-ring__bogen web-ring__bogen--${r.art}`}
                  cx={mitte}
                  cy={mitte}
                  r={rad}
                  fill="none"
                  strokeWidth={strich}
                  strokeLinecap="round"
                  strokeDasharray={`${gefuellt} ${umfang}`}
                  transform={`rotate(-90 ${mitte} ${mitte})`}
                />
              )}
            </g>
          );
        })}
      </svg>
      <div className="web-ring__mitte">
        {ringe.length === 0 ? (
          <span className="web-ring__einheit">Keine Punkte</span>
        ) : (
          <>
            <span className="web-ring__zahl">{zahl}</span>
            <span className="web-ring__einheit">{zahl === 1 ? 'Punkt' : 'Punkte'}</span>
          </>
        )}
      </div>
    </div>
  );
};

export default WebPunkteRinge;
