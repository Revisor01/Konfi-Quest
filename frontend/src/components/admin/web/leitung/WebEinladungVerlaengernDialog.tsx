// „Einladung verlängern" als Fenster der Web-Fassung (/admin/settings/invite
// ab 992 px). Simon, 15.10.2026: jedes Formular, das im Browser noch ein
// Fenster der App öffnet, bekommt ein kompaktes Fenster der Web-Fassung. Die
// App fragt mit einer Rückfrage mit Auswahlknöpfen (useIonAlert); in den Apps,
// unter 992 px und im Fenster aus „Mehr" bleibt es dabei.
//
// Dieselben Stufen wie dort (utils/einladungsGueltigkeit.ts,
// verlaengerungsOptionen: nur die, die noch etwas bringen; die erste ist
// vorgewählt) und dieselbe Stelle zum Senden (extendInvite in
// AdminInvitePage, POST /auth/invite-codes/:id/extend mit `tage`). Gilt der
// Code schon so lange, wie es geht, steht das als Hinweis im Fenster -- wie
// die Rückfrage mit nur „OK" in der App.
//
// Ein Fehler steht im Fenster (role="alert"); während gesendet wird, schließt
// nichts das Fenster. Nach dem Verlängern schließt es; „Einladung gilt bis …"
// kommt oben wie in der App.

import React, { useState } from 'react';
import { HOECHSTENS_TAGE, istGueltigkeitTage, type GueltigkeitTage, type VerlaengerungsOption } from '../../../../utils/einladungsGueltigkeit';
import WebDialog from '../../../web/WebDialog';
import WebAuswahl from '../../../web/WebAuswahl';
import WebHinweis from '../../../web/WebHinweis';
import WebKnopf from '../../../web/WebKnopf';

export interface WebEinladungVerlaengernDialogProps {
  /** Der Einladungscode, um den es geht. */
  code: string;
  /** Die Stufen, gerechnet beim Öffnen (leer: länger geht es nicht). */
  optionen: readonly VerlaengerungsOption[];
  /** Verlängert; ein Fehler geht an `melden`. Liefert, ob es geklappt hat. */
  onVerlaengern: (tage: GueltigkeitTage, melden: (text: string) => void) => Promise<boolean>;
  onSchliessen: () => void;
}

const TITEL = 'Einladung verlängern';

const WebEinladungVerlaengernDialog: React.FC<WebEinladungVerlaengernDialogProps> = ({ code, optionen, onVerlaengern, onSchliessen }) => {
  const [tage, setTage] = useState<GueltigkeitTage | null>(optionen[0]?.tage ?? null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [sendet, setSendet] = useState(false);

  if (optionen.length === 0) {
    return (
      <WebDialog
        titel={TITEL}
        beschreibung={`Einladungscode ${code}`}
        onSchliessen={onSchliessen}
        aktionen={<WebKnopf art="primaer" onClick={onSchliessen}>OK</WebKnopf>}
      >
        <WebHinweis art="hinweis">{`Der Code gilt schon ${HOECHSTENS_TAGE} Tage im Voraus — länger geht es nicht.`}</WebHinweis>
      </WebDialog>
    );
  }

  const absenden = async () => {
    if (tage === null || sendet) return;
    setFehler(null);
    setSendet(true);
    const verlaengert = await onVerlaengern(tage, setFehler);
    setSendet(false);
    if (verlaengert) onSchliessen();
  };

  return (
    <WebDialog
      titel={TITEL}
      beschreibung={`Einladungscode ${code}`}
      onSchliessen={onSchliessen}
      onAbsenden={() => { void absenden(); }}
      gesperrt={sendet}
      aktionen={(
        <>
          <WebKnopf onClick={onSchliessen} disabled={sendet}>Abbrechen</WebKnopf>
          <WebKnopf art="primaer" absenden disabled={sendet}>Verlängern</WebKnopf>
        </>
      )}
    >
      <div className="web-formular">
        {fehler && <WebHinweis art="fehler" rolle="alert">{fehler}</WebHinweis>}
        <WebAuswahl
          label="Um wie viele Tage?"
          wert={tage === null ? '' : String(tage)}
          onWert={(w) => {
            const neu = Number(w);
            if (!istGueltigkeitTage(neu)) return;
            setFehler(null);
            setTage(neu);
          }}
          optionen={optionen.map((o) => ({ wert: String(o.tage), label: o.text }))}
          deaktiviert={sendet}
          hinweis={`Länger als ${HOECHSTENS_TAGE} Tage im Voraus gilt kein Code.`}
        />
      </div>
    </WebDialog>
  );
};

export default WebEinladungVerlaengernDialog;
