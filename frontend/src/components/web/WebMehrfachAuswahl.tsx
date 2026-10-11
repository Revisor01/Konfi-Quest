// Mehrfachauswahl der Web-Fassung (11.10.2026): eine beschriftete Gruppe
// von Ankreuzfeldern -- Jahrgänge eines Events, Kategorien einer
// Aktivität. Ein <fieldset> mit <legend>, je Eintrag ein echtes
// Ankreuzfeld; gleiche Optik wie die Auswahl mit Suche (WebAuswahlSuche).
// Die App nimmt dafuer ein IonSelect mit multiple, das im Browser ein
// eigenes Fenster oeffnet.

import React, { useId } from 'react';

export interface WebMehrfachEintrag {
  wert: string;
  titel: string;
  beschreibung?: string;
}

export interface WebMehrfachAuswahlProps {
  label: string;
  eintraege: ReadonlyArray<WebMehrfachEintrag>;
  /** Die gewählten Werte; Reihenfolge wie in `eintraege`. */
  werte: ReadonlyArray<string>;
  onWerte: (werte: string[]) => void;
  pflicht?: boolean;
  /** Wenn die Liste gar keine Einträge hat. */
  leerText: string;
  hinweis?: string;
  deaktiviert?: boolean;
}

const WebMehrfachAuswahl: React.FC<WebMehrfachAuswahlProps> = ({
  label, eintraege, werte, onWerte, pflicht = false, leerText, hinweis, deaktiviert = false,
}) => {
  const hinweisId = `${useId()}-hinweis`;
  const gewaehlt = new Set(werte);
  const umschalten = (wert: string, an: boolean) => {
    const neu = new Set(gewaehlt);
    if (an) neu.add(wert); else neu.delete(wert);
    onWerte(eintraege.map((e) => e.wert).filter((w) => neu.has(w)));
  };
  return (
    <fieldset className="web-wahl" disabled={deaktiviert} aria-required={pflicht ? 'true' : undefined} aria-describedby={hinweis ? hinweisId : undefined}>
      <legend className={pflicht ? 'web-feld__label web-feld__label--pflicht web-wahl__legende' : 'web-feld__label web-wahl__legende'}>{label}</legend>
      {eintraege.length === 0 ? (
        <p className="web-wahl__leer" role="status">{leerText}</p>
      ) : (
        <div className="web-wahl__liste">
          {eintraege.map((e) => {
            const an = gewaehlt.has(e.wert);
            return (
              <label key={e.wert} className={an ? 'web-wahl__zeile web-wahl__zeile--gewaehlt' : 'web-wahl__zeile'}>
                <input
                  type="checkbox"
                  className="web-wahl__haken"
                  value={e.wert}
                  checked={an}
                  onChange={(ereignis) => umschalten(e.wert, ereignis.target.checked)}
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
      {hinweis && <p id={hinweisId} className="web-feld__hinweis">{hinweis}</p>}
    </fieldset>
  );
};

export default WebMehrfachAuswahl;
