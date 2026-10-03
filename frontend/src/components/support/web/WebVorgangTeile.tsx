// Kleine Bausteine, die Liste, Vorgang, Posteingang und die zwei Dialoge der
// Vorgänge in der Web-Fassung gemeinsam brauchen: die Marken für Status und
// Dringlichkeit und die drei Auswahlfelder Art, Bereich, Dringlichkeit --
// dieselben Felder, dieselben Namen, wo immer ein Vorgang sortiert wird
// (Neuer Vorgang, Einsortieren, Einordnen im Vorgang).

import React from 'react';
import WebAuswahl from '../../web/WebAuswahl';
import WebPill from '../../web/WebPill';
import {
  ARTEN,
  BEREICHE,
  DRINGLICHKEITEN,
  VORGANG_STATUS,
  bereichIstPflicht,
  type Dringlichkeit,
  type VorgangArt,
  type VorgangBereich,
  type VorgangStatus,
} from '../../../utils/supportVorgaenge';

/** Der Status als Marke, Kurzform („Wartet") mit dem ganzen Namen als Tooltip. */
export const StatusPill: React.FC<{ status: VorgangStatus }> = ({ status }) => {
  const info = VORGANG_STATUS[status] ?? VORGANG_STATUS.neu;
  return <WebPill ton={info.ton} title={info.label}>{info.kurz}</WebPill>;
};

/** „Dringend" als rote Marke -- bei „Normal" steht nichts da. */
export const DringlichPill: React.FC<{ dringlichkeit: Dringlichkeit }> = ({ dringlichkeit }) => (
  dringlichkeit === 'dringend' ? <WebPill ton="fehler">Dringend</WebPill> : null
);

export interface AuswahlfelderProps {
  art: VorgangArt | '';
  bereich: VorgangBereich | '';
  dringlichkeit: Dringlichkeit;
  onArt: (art: VorgangArt | '') => void;
  onBereich: (bereich: VorgangBereich | '') => void;
  onDringlichkeit: (dringlichkeit: Dringlichkeit) => void;
  /** Die Art ist noch nicht gewaehlt (neue Vorgaenge): „Bitte wählen" steht vorn. */
  artOffen?: boolean;
  deaktiviert?: boolean;
  /** Art und Bereich nebeneinander (Dialoge, wo die Höhe knapp ist); sonst untereinander. */
  paar?: boolean;
}

/**
 * Art, Bereich und Dringlichkeit als Auswahlfelder. Der Bereich ist bei Frage,
 * Fehler und Wunsch Pflicht (er traegt den Stern), sonst freiwillig.
 */
export const VorgangAuswahlfelder: React.FC<AuswahlfelderProps> = ({
  art, bereich, dringlichkeit, onArt, onBereich, onDringlichkeit, artOffen = false, deaktiviert = false, paar = false,
}) => {
  const pflicht = bereichIstPflicht(art);
  const artFeld = (
    <WebAuswahl
      label="Art"
      pflicht
      deaktiviert={deaktiviert}
      wert={art}
      onWert={(w) => onArt(w as VorgangArt | '')}
      optionen={[
        ...(artOffen || art === '' ? [{ wert: '', label: 'Bitte wählen' }] : []),
        ...ARTEN.map((a) => ({ wert: a.wert, label: a.label })),
      ]}
    />
  );
  const bereichFeld = (
    <WebAuswahl
      label="Bereich"
      pflicht={pflicht}
      deaktiviert={deaktiviert}
      wert={bereich}
      onWert={(w) => onBereich(w as VorgangBereich | '')}
      optionen={[
        { wert: '', label: pflicht ? 'Bitte wählen' : 'Kein Bereich' },
        ...BEREICHE.map((b) => ({ wert: b.wert, label: b.label })),
      ]}
      hinweis={pflicht && !bereich ? 'Bei Frage, Fehler und Wunsch gehört ein Bereich dazu.' : undefined}
    />
  );
  const dringlichkeitFeld = (
    <WebAuswahl
      label="Dringlichkeit"
      deaktiviert={deaktiviert}
      wert={dringlichkeit}
      onWert={(w) => onDringlichkeit(w as Dringlichkeit)}
      optionen={DRINGLICHKEITEN.map((d) => ({ wert: d.wert, label: d.hinweis ? `${d.label} – ${d.hinweis}` : d.label }))}
    />
  );
  return paar ? (
    <>
      <div className="web-feldpaar">{artFeld}{bereichFeld}</div>
      {dringlichkeitFeld}
    </>
  ) : (
    <>
      {artFeld}
      {bereichFeld}
      {dringlichkeitFeld}
    </>
  );
};
