// Die Ansicht "Kacheln" der Web-Fassung (10.10.2026): EIN Raster und EINE
// Karte (WebBildKarte) fuer alle Kachelansichten. Bis dahin baute jede Seite
// ihr Raster (`web-bildkarten`) und die Knoepfe im Fuss selbst.
//
// Die Seite sagt je Eintrag, was auf der Karte steht (`karte`: Farbe, Kopf,
// Titel, Angaben ...), und welche Aktionen es gibt: Bearbeiten und Loeschen
// stehen fest im Fuss, in dieser Reihenfolge, mit Symbol und Wort -- fehlt
// die Aktion, fehlt der Knopf. Weitere Knoepfe davor bringt `fuss` mit.
// Die Reihenfolge der Karten ist die der Eintraege.

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_BEARBEITEN, ICON_LOESCHEN } from '../shared/icons';
import WebBildKarte, { type WebBildKarteProps } from './WebBildKarte';
import WebKnopf from './WebKnopf';
import type { WebAktion } from './WebListe';

export interface WebKachelnProps<T> {
  /** Name der Liste fuer Vorleseprogramme ("Konfis", "Aktivitäten"). */
  beschriftung: string;
  eintraege: readonly T[];
  schluessel: (eintrag: T) => string | number;
  /** Was auf der Karte steht -- alles ausser dem Fuss. */
  karte: (eintrag: T) => Omit<WebBildKarteProps, 'fuss'>;
  bearbeiten?: WebAktion<T>;
  loeschen?: WebAktion<T>;
  /** Weitere Knoepfe im Fuss, vor Bearbeiten und Loeschen. */
  fuss?: (eintrag: T) => React.ReactNode;
}

function WebKacheln<T>({ beschriftung, eintraege, schluessel, karte, bearbeiten, loeschen, fuss }: WebKachelnProps<T>): React.ReactElement {
  return (
    <ul className="web-bildkarten" aria-label={beschriftung}>
      {eintraege.map((e) => {
        const extra = fuss?.(e);
        const mitFuss = Boolean(extra) || Boolean(bearbeiten) || Boolean(loeschen);
        return (
          <li key={schluessel(e)} className="web-bildkarten__eintrag">
            <WebBildKarte
              {...karte(e)}
              fuss={mitFuss ? (
                <>
                  {extra}
                  {bearbeiten && (
                    <WebKnopf klein vorn onClick={() => bearbeiten.onKlick(e)} aria-label={bearbeiten.beschriftung(e)}>
                      <IonIcon icon={ICON_BEARBEITEN} aria-hidden="true" />
                      Bearbeiten
                    </WebKnopf>
                  )}
                  {loeschen && (
                    <WebKnopf klein vorn art="gefahr" onClick={() => loeschen.onKlick(e)} aria-label={loeschen.beschriftung(e)}>
                      <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
                      Löschen
                    </WebKnopf>
                  )}
                </>
              ) : undefined}
            />
          </li>
        );
      })}
    </ul>
  );
}

export default WebKacheln;
