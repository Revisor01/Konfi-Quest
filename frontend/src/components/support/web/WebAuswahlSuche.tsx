// Auswahl mit Suche der Web-Fassung: ein Suchfeld und darunter die Liste der
// Eintraege als Gruppe von Optionsknoepfen (<input type="radio">). So gibt es
// einen Tabulator-Halt fuer die ganze Liste, die Pfeiltasten wechseln die Wahl,
// und Vorleseprogramme sagen "x von n" -- ohne eigene Tastaturlogik.
//
// Fuer lange Listen (alle Anfragen, alle Gemeinden): Wer "buesum" tippt, findet
// "Büsum" (Umlaute wie in der Suche der Seiten, utils/supportWeb.ts). Die Liste
// scrollt in sich; die Zahl der Treffer steht dabei.

import React, { useId, useMemo, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_SUCHE } from '../../shared/icons';
import { suchTreffer, suchbegriff } from '../../../utils/supportWeb';

export interface WebWahlEintrag {
  wert: string;
  titel: string;
  /** Zweite Zeile: Kontakt, Status, Kirchenkreis. */
  beschreibung?: string;
}

export interface WebAuswahlSucheProps {
  /** Name der Gruppe ("Anfrage", "Gemeinde"). */
  label: string;
  eintraege: ReadonlyArray<WebWahlEintrag>;
  /** Gewaehlter Wert; leer: nichts gewaehlt. */
  wert: string;
  onWert: (wert: string) => void;
  /** Text im Suchfeld, z. B. "Anfrage suchen". */
  suchePlatzhalter: string;
  /** Wenn die Liste gar keine Eintraege hat. */
  leerText: string;
  deaktiviert?: boolean;
}

const WebAuswahlSuche: React.FC<WebAuswahlSucheProps> = ({ label, eintraege, wert, onWert, suchePlatzhalter, leerText, deaktiviert = false }) => {
  const gruppe = useId();
  const [suche, setSuche] = useState('');
  const sucht = suchbegriff(suche) !== '';

  const sichtbar = useMemo(() => (sucht
    ? eintraege.filter((e) => suchTreffer(e.titel, suche).length > 0 || (e.beschreibung ? suchTreffer(e.beschreibung, suche).length > 0 : false))
    : eintraege), [eintraege, suche, sucht]);

  return (
    <fieldset className="web-wahl" disabled={deaktiviert}>
      <legend className="web-feld__label">{label}</legend>
      <div className="web-suche web-wahl__suche">
        <IonIcon icon={ICON_SUCHE} className="web-suche__symbol" aria-hidden="true" />
        <input
          type="search"
          className="web-suche__eingabe"
          aria-label={suchePlatzhalter}
          placeholder={suchePlatzhalter}
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
        />
      </div>
      {eintraege.length === 0 ? (
        <p className="web-wahl__leer" role="status">{leerText}</p>
      ) : sichtbar.length === 0 ? (
        <p className="web-wahl__leer" role="status">Keine Treffer für „{suche.trim()}“.</p>
      ) : (
        <div className="web-wahl__liste">
          {sichtbar.map((e) => {
            const gewaehlt = e.wert === wert;
            return (
              <label key={e.wert} className={gewaehlt ? 'web-wahl__zeile web-wahl__zeile--gewaehlt' : 'web-wahl__zeile'}>
                <input
                  type="radio"
                  className="web-wahl__radio"
                  name={gruppe}
                  value={e.wert}
                  checked={gewaehlt}
                  onChange={() => onWert(e.wert)}
                />
                <span className="web-wahl__text">
                  <span className="web-wahl__titel">{e.titel}</span>
                  {e.beschreibung && <span className="web-wahl__beschreibung">{e.beschreibung}</span>}
                </span>
              </label>
            );
          })}
        </div>
      )}
      {eintraege.length > 0 && sucht && (
        <p className="web-wahl__zahl" role="status">{sichtbar.length} von {eintraege.length}</p>
      )}
    </fieldset>
  );
};

export default WebAuswahlSuche;
