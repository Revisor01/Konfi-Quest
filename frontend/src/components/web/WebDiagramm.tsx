// Zeitdiagramm der Web-Fassung in eigenem SVG (keine Bibliothek):
//   gestapelt  Saeulen je Monat/Woche, die Reihen uebereinander (Konfi/Team)
//   gruppiert  Saeulen nebeneinander (Gemeinden und Anfragen)
//   flaeche    Linie mit zarter Flaeche, Wert am Ende (Konten gesamt)
//
// Gezeichnet wird in echten Pixeln (viewBox = gemessene Breite x Hoehe), nicht
// skaliert: Schrift und Strich bleiben in jeder Kartenbreite gleich.
//
// Formen nach den Regeln der Auswertung: Saeulen hoechstens 24 px dick, oben
// 4 px gerundet, unten gerade; zwischen gestapelten Segmenten 2 px Flaechen-
// farbe statt eines Rands; Linien 2 px; Gitter und Achse als Haarlinien;
// wenige runde Teilstriche; Beschriftung in Textfarben, die Reihenfarbe nur an
// der Marke daneben.
//
// Lesbar auch ohne Maus und ohne Augen: die Werte stehen zusaetzlich als
// Tabelle fuer Vorleseprogramme da, der Bereich ist mit den Pfeiltasten
// bedienbar (Tooltip folgt dem Fokus), das SVG traegt role="img" und eine
// Zusammenfassung. Der Tooltip erweitert nur -- nichts ist allein dort zu lesen.

import React, { useState } from 'react';
import { balkenPfad, flaechenPfad, linienPfad, schoeneSkala, stapelSegmente, zahlText } from '../../utils/webDiagramm';
import { useElementBreite } from './useElementBreite';

export interface WebReihe {
  schluessel: string;
  name: string;
  /** Eine Farbe als Token: var(--web-reihe-konfi). */
  farbe: string;
  werte: readonly number[];
}

export interface WebDiagrammProps {
  art: 'gestapelt' | 'gruppiert' | 'flaeche';
  titel: string;
  /** Ein Satz fuer Vorleseprogramme: was zeigt das Bild, von wann bis wann, wohin geht es. */
  zusammenfassung: string;
  /** Schluessel der Monate/Wochen, aeltester zuerst ('2025-11'). */
  kategorien: readonly string[];
  /** Beschriftung unter der Achse ("Nov"). */
  kurz: (kategorie: string) => string;
  /** Ausfuehrlich fuer Tooltip und Tabelle ("November 2025"). */
  lang: (kategorie: string) => string;
  /** Kopf der ersten Tabellenspalte: "Monat", "Woche". */
  kategorieName: string;
  reihen: readonly WebReihe[];
  hoehe?: number;
  /** Bei gestapelt: Summe im Tooltip. */
  summe?: boolean;
  /** Ungefaehre Zahl der Abschnitte der Werteachse (Vorgabe 4; kleine Diagramme 2). */
  ziel?: number;
  /** Beschriftung der Zeitachse; in uebereinanderstehenden Diagrammen nur am untersten. */
  xAchse?: boolean;
}

const RAND = { links: 44, rechts: 12, oben: 12, unten: 28 };
const RAND_UNTEN_OHNE_ACHSE = 8;
const LUECKE = 2;
const SAEULE_MAX = 24;
const GRUPPE_SAEULE_MAX = 14;

const WebDiagramm: React.FC<WebDiagrammProps> = ({
  art, titel, zusammenfassung, kategorien, kurz, lang, kategorieName, reihen, hoehe = 220, summe = false, ziel = 4, xAchse = true,
}) => {
  const [huelle, breite] = useElementBreite<HTMLDivElement>(520);
  const [aktiv, setAktiv] = useState<number | null>(null);

  const n = kategorien.length;
  const plotB = Math.max(breite - RAND.links - RAND.rechts, 40);
  const unten = xAchse ? RAND.unten : RAND_UNTEN_OHNE_ACHSE;
  const plotH = hoehe - RAND.oben - unten;
  const band = n > 0 ? plotB / n : plotB;
  const boden = RAND.oben + plotH;
  const wert = (r: WebReihe, i: number) => (Number.isFinite(r.werte[i]) ? r.werte[i] : 0);

  const hoechster = Math.max(
    0,
    ...kategorien.map((_, i) => (art === 'gestapelt'
      ? reihen.reduce((s, r) => s + wert(r, i), 0)
      : Math.max(0, ...reihen.map((r) => wert(r, i))))),
  );
  const skala = schoeneSkala(hoechster, ziel);
  const proWert = plotH / skala.max;
  const xMitte = (i: number) => RAND.links + band * (i + 0.5);
  const yWert = (v: number) => boden - v * proWert;

  // Beschriftung der Achse: nicht jede, wenn sie sich beruehren wuerden; die letzte steht immer da.
  const labelBreite = Math.max(0, ...kategorien.map((k) => kurz(k).length)) * 6.6 + 14;
  const labelSchritt = Math.max(1, Math.ceil(labelBreite / band));

  const gewaehlt = aktiv !== null && aktiv >= 0 && aktiv < n ? aktiv : null;

  const taste = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (n === 0) return;
    const naechster = (von: number | null, schritt: number) => Math.min(n - 1, Math.max(0, (von ?? (schritt > 0 ? -1 : n)) + schritt));
    switch (e.key) {
      case 'ArrowRight': e.preventDefault(); setAktiv(naechster(gewaehlt, 1)); break;
      case 'ArrowLeft': e.preventDefault(); setAktiv(naechster(gewaehlt, -1)); break;
      case 'Home': e.preventDefault(); setAktiv(0); break;
      case 'End': e.preventDefault(); setAktiv(n - 1); break;
      case 'Escape': setAktiv(null); break;
      default: break;
    }
  };

  // --- Saeulen ---
  const saeulen = art === 'flaeche' ? null : kategorien.map((k, i) => {
    const werte = reihen.map((r) => wert(r, i));
    let teile: React.ReactNode;
    if (art === 'gestapelt') {
      const breiteS = Math.min(SAEULE_MAX, band * 0.62);
      const segmente = stapelSegmente(werte, proWert, boden, LUECKE);
      teile = segmente.map((s, j) => (
        <path
          key={reihen[s.reihe].schluessel}
          className="web-balken"
          d={balkenPfad(xMitte(i) - breiteS / 2, s.y, breiteS, s.hoehe, j === segmente.length - 1 ? 4 : 0)}
          style={{ fill: reihen[s.reihe].farbe }}
        />
      ));
    } else {
      const k2 = reihen.length;
      const breiteS = Math.min(k2 === 1 ? SAEULE_MAX : GRUPPE_SAEULE_MAX, (band * 0.72 - LUECKE * (k2 - 1)) / k2);
      const gesamt = breiteS * k2 + LUECKE * (k2 - 1);
      teile = reihen.map((r, j) => {
        const v = werte[j];
        if (!(v > 0)) return null;
        return (
          <path
            key={r.schluessel}
            className="web-balken"
            d={balkenPfad(xMitte(i) - gesamt / 2 + j * (breiteS + LUECKE), yWert(v), breiteS, v * proWert, 4)}
            style={{ fill: r.farbe }}
          />
        );
      });
    }
    return <g key={k} className="web-saeule" data-kategorie={k}>{teile}</g>;
  });

  // --- Linien ---
  const linien = art !== 'flaeche' ? null : reihen.map((r) => {
    const punkte = kategorien.map((_, i) => [xMitte(i), yWert(wert(r, i))] as const);
    const letzter = punkte[punkte.length - 1];
    return (
      <g key={r.schluessel} className="web-reihe">
        {reihen.length === 1 && <path className="web-diagramm__flaeche-fuellung" d={flaechenPfad(punkte, boden)} style={{ fill: r.farbe }} />}
        <path className="web-diagramm__linie" d={linienPfad(punkte)} style={{ stroke: r.farbe }} />
        {letzter && (
          <>
            <circle className="web-diagramm__punkt" cx={letzter[0]} cy={letzter[1]} r={5} style={{ fill: r.farbe }} />
            {/* Der Wert am Ende nur bei einer Reihe: Mehrere lagen sonst uebereinander (Legende und Tooltip tragen sie). */}
            {reihen.length === 1 && (
              <text
                className="web-diagramm__text web-diagramm__text--stark web-diagramm__text--rechts"
                x={letzter[0] + 4}
                y={Math.max(letzter[1] - 12, RAND.oben)}
              >
                {zahlText(wert(r, n - 1))}
              </text>
            )}
          </>
        )}
        {gewaehlt !== null && (
          <circle className="web-diagramm__punkt" cx={xMitte(gewaehlt)} cy={yWert(wert(r, gewaehlt))} r={5} style={{ fill: r.farbe }} />
        )}
      </g>
    );
  });

  const tooltipLinks = gewaehlt !== null && xMitte(gewaehlt) > breite * 0.55;
  const gesamtAn = (i: number) => reihen.reduce((s, r) => s + wert(r, i), 0);

  return (
    <figure className="web-diagramm">
      <div
        ref={huelle}
        className="web-diagramm__flaeche"
        tabIndex={0}
        role="group"
        aria-label={`${titel}. Mit den Pfeiltasten durch die Werte gehen.`}
        onKeyDown={taste}
        onBlur={() => setAktiv(null)}
      >
        <svg
          className="web-diagramm__svg"
          viewBox={`0 0 ${breite} ${hoehe}`}
          width={breite}
          height={hoehe}
          role="img"
          aria-label={`${titel}: ${zusammenfassung}`}
          onMouseLeave={() => setAktiv(null)}
        >
          {skala.ticks.map((t) => (
            <g key={t}>
              <line
                className={t === 0 ? 'web-diagramm__achse' : 'web-diagramm__gitter'}
                x1={RAND.links}
                x2={breite - RAND.rechts}
                y1={yWert(t)}
                y2={yWert(t)}
              />
              <text className="web-diagramm__text web-diagramm__text--rechts" x={RAND.links - 8} y={yWert(t) + 4}>
                {zahlText(t)}
              </text>
            </g>
          ))}
          {gewaehlt !== null && art !== 'flaeche' && (
            <rect className="web-diagramm__band" x={RAND.links + band * gewaehlt} y={RAND.oben} width={band} height={plotH} rx={4} />
          )}
          {gewaehlt !== null && art === 'flaeche' && (
            <line className="web-diagramm__fuehrung" x1={xMitte(gewaehlt)} x2={xMitte(gewaehlt)} y1={RAND.oben} y2={boden} />
          )}
          {saeulen}
          {linien}
          {xAchse && kategorien.map((k, i) => ((n - 1 - i) % labelSchritt === 0 ? (
            <text key={k} className="web-diagramm__text web-diagramm__text--mitte" x={xMitte(i)} y={boden + 18}>{kurz(k)}</text>
          ) : null))}
          {kategorien.map((k, i) => (
            <rect
              key={k}
              className="web-diagramm__treffer"
              x={RAND.links + band * i}
              y={RAND.oben}
              width={band}
              height={plotH + unten}
              onMouseEnter={() => setAktiv(i)}
              onClick={() => setAktiv(i)}
            />
          ))}
        </svg>
        {gewaehlt !== null && (
          <div
            className={tooltipLinks ? 'web-diagramm__tooltip web-diagramm__tooltip--links' : 'web-diagramm__tooltip'}
            style={{ left: xMitte(gewaehlt), top: RAND.oben }}
            aria-hidden="true"
          >
            <div className="web-diagramm__tooltip-kopf">{lang(kategorien[gewaehlt])}</div>
            {reihen.map((r) => (
              <div key={r.schluessel} className="web-diagramm__tooltip-zeile">
                <span className={art === 'flaeche' ? 'web-legende__marke web-legende__marke--linie' : 'web-legende__marke'} style={{ background: r.farbe }} />
                <span>{r.name}</span>
                <span className="web-diagramm__tooltip-wert">{zahlText(wert(r, gewaehlt))}</span>
              </div>
            ))}
            {summe && reihen.length > 1 && (
              <div className="web-diagramm__tooltip-zeile">
                <span>Gesamt</span>
                <span className="web-diagramm__tooltip-wert">{zahlText(gesamtAn(gewaehlt))}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {reihen.length > 1 && (
        <ul className="web-legende" aria-label="Legende">
          {reihen.map((r) => (
            <li key={r.schluessel} className="web-legende__eintrag">
              <span className={art === 'flaeche' ? 'web-legende__marke web-legende__marke--linie' : 'web-legende__marke'} style={{ background: r.farbe }} aria-hidden="true" />
              {r.name}
            </li>
          ))}
        </ul>
      )}

      <table className="web-nur-vorlesen">
        <caption>{titel}</caption>
        <thead>
          <tr>
            <th scope="col">{kategorieName}</th>
            {reihen.map((r) => <th key={r.schluessel} scope="col">{r.name}</th>)}
          </tr>
        </thead>
        <tbody>
          {kategorien.map((k, i) => (
            <tr key={k}>
              <th scope="row">{lang(k)}</th>
              {reihen.map((r) => <td key={r.schluessel}>{wert(r, i)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
};

export default WebDiagramm;
