// "Mehr" der Leitung in der Web-Fassung, /admin/settings (Browser ab 992 px;
// docs/planung/web-alle-bereiche.md, Entscheidung 6): ein Raster gruppierter
// Kacheln statt der Liste der App. Jede Kachel ist ein echter Link (Mittelklick
// oeffnet einen neuen Tab); ein kleines "i" daneben erklaert den Bereich -- mit
// denselben Texten wie die Info-Fenster der App.
//
// Welche Kacheln es gibt und fuer wen, steht in mehrKacheln.ts -- dieselben
// Bedingungen wie in der Liste der App. "Hilfe und Support" fuehrt nach draussen
// auf das Support-Formular der Homepage.

import React, { useState } from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_INFO, ICON_WEITER_GEFUELLT } from '../../../shared/icons';
import WebSeite from '../../../web/WebSeite';
import WebLink from '../../../web/WebLink';
import WebKnopf from '../../../web/WebKnopf';
import WebDialog from '../../../web/WebDialog';
import { WebExternLink } from './WebLeitungBausteine';
import { mehrGruppen, type MehrAktion, type MehrKachel, type MehrKonto } from './mehrKacheln';

export interface MehrInfo {
  title: string;
  icon: string;
  color: string;
  paragraphs: string[];
}

export interface WebMehrProps {
  konto: MehrKonto | null | undefined;
  /** Die Erklaerungen der Bereiche, wie sie die App im Info-Fenster zeigt. */
  infos: Record<string, MehrInfo>;
  /** Tour, Neuerungen und Erklaerung der Mitmachen-Seite oeffnen (Fenster der Seite). */
  onAktion: (aktion: MehrAktion) => void;
  pageRef?: React.Ref<HTMLElement>;
  /** Fenster der Seite (Tour, Neuerungen). */
  overlays?: React.ReactNode;
}

const WebMehr: React.FC<WebMehrProps> = ({ konto, infos, onAktion, pageRef, overlays }) => {
  const [info, setInfo] = useState<{ titel: string; absaetze: string[] } | null>(null);
  const gruppen = mehrGruppen(konto);

  const inhalt = (k: MehrKachel) => (
    <>
      <span className={`web-mehr-kachel__symbol web-mehr-farbe--${k.farbe}`} aria-hidden="true">
        <IonIcon icon={k.icon} />
      </span>
      <span className="web-mehr-kachel__text">
        <span className="web-mehr-kachel__titel">{k.titel}</span>
        <span className="web-mehr-kachel__beschreibung">{k.text}</span>
      </span>
    </>
  );

  const haupt = (k: MehrKachel): React.ReactNode => {
    if (k.href) {
      return <WebLink href={k.href} className="web-mehr-kachel__link">{inhalt(k)}</WebLink>;
    }
    if (k.extern) {
      return (
        <WebExternLink href={k.extern} className="web-mehr-kachel__link" aria-label={`${k.titel} (öffnet in einem neuen Tab)`}>
          {inhalt(k)}
        </WebExternLink>
      );
    }
    return (
      <button type="button" className="web-mehr-kachel__link web-mehr-kachel__link--knopf" onClick={() => k.aktion && onAktion(k.aktion)}>
        {inhalt(k)}
      </button>
    );
  };

  return (
    <WebSeite bereich="Verwaltung" titel="Mehr" untertitel="Einstellungen, Verwaltung und Hilfe" pageRef={pageRef} wartung>
      {gruppen.map((g) => (
        <section key={g.id} className="web-mehr-gruppe" aria-labelledby={`web-mehr-${g.id}`}>
          <header className="web-mehr-gruppe__kopf">
            <h2 id={`web-mehr-${g.id}`} className="web-mehr-gruppe__titel">{g.titel}</h2>
            <p className="web-mehr-gruppe__text">{g.beschreibung}</p>
          </header>
          <ul className="web-mehr-raster">
            {g.kacheln.map((k) => {
              const erklaerung = k.info ? infos[k.info] : undefined;
              return (
                <li key={k.id} className="web-mehr-kachel">
                  {haupt(k)}
                  {erklaerung && (
                    <span className="web-mehr-kachel__info">
                      <WebKnopf
                        art="text"
                        klein
                        symbol
                        vorn
                        aria-label={`Info zu ${k.titel}`}
                        title="Wofür ist das?"
                        onClick={() => setInfo({ titel: k.titel, absaetze: erklaerung.paragraphs })}
                      >
                        <IonIcon icon={ICON_INFO} className="web-mehr-kachel__info-symbol" aria-hidden="true" />
                      </WebKnopf>
                    </span>
                  )}
                  <IonIcon icon={ICON_WEITER_GEFUELLT} className="web-mehr-kachel__pfeil" aria-hidden="true" />
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {info && (
        <WebDialog
          titel={info.titel}
          onSchliessen={() => setInfo(null)}
          aktionen={<WebKnopf art="primaer" onClick={() => setInfo(null)}>Verstanden</WebKnopf>}
        >
          {info.absaetze.map((a, i) => <p key={i} className="web-mehr-absatz">{a}</p>)}
        </WebDialog>
      )}

      {overlays}
    </WebSeite>
  );
};

export default WebMehr;
