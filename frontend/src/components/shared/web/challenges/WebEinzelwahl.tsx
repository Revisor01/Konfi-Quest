// Eine Wahl aus wenigen Möglichkeiten mit Erklärung je Möglichkeit, in den
// Fenstern der Challenges im Browser (15.10.2026): Zielgruppe und
// Sichtbarkeit beim Anlegen, Medienart und „Wer sieht deinen Beitrag?" beim
// Einreichen. Die App zeigt dafür antippbare Zeilen; hier eine Gruppe von
// Optionsknöpfen (<input type="radio">) im Aussehen der Auswahl mit Suche
// (WebAuswahlSuche, .web-wahl) -- ein Tabulator-Halt für die Gruppe, die
// Pfeiltasten wechseln die Wahl, Vorleseprogramme sagen „x von n".

import React, { useId } from 'react';

export interface WebEinzelwahlOption<W extends string> {
  wert: W;
  titel: string;
  beschreibung?: string;
}

export interface WebEinzelwahlProps<W extends string> {
  /** Name der Gruppe ("Wer macht mit?"). */
  label: string;
  optionen: ReadonlyArray<WebEinzelwahlOption<W>>;
  wert: W;
  onWert: (wert: W) => void;
  /** Die ganze Gruppe gesperrt (beim Senden, nach dem Start der Challenge). */
  deaktiviert?: boolean;
}

function WebEinzelwahl<W extends string>({ label, optionen, wert, onWert, deaktiviert = false }: WebEinzelwahlProps<W>): React.ReactElement {
  const gruppe = useId();
  return (
    <fieldset className="web-wahl" disabled={deaktiviert}>
      <legend className="web-feld__label web-wahl__legende">{label}</legend>
      <div className="web-wahl__liste">
        {optionen.map((o) => {
          const gewaehlt = o.wert === wert;
          return (
            <label key={o.wert} className={gewaehlt ? 'web-wahl__zeile web-wahl__zeile--gewaehlt' : 'web-wahl__zeile'}>
              <input
                type="radio"
                className="web-wahl__radio"
                name={gruppe}
                value={o.wert}
                checked={gewaehlt}
                // Auch am Feld selbst, nicht nur an der Gruppe: So bleibt es
                // gesperrt, wo ein Browser die Sperre der Gruppe nicht vererbt.
                disabled={deaktiviert}
                onChange={() => { if (!deaktiviert) onWert(o.wert); }}
              />
              <span className="web-wahl__text">
                <span className="web-wahl__titel">{o.titel}</span>
                {o.beschreibung && <span className="web-wahl__beschreibung">{o.beschreibung}</span>}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export default WebEinzelwahl;
