// Antworten in der Web-Fassung: Baustein waehlen und einfuegen (Platzhalter
// gefuellt), Betreff, Text, Vorschau mit Fusszeile, Senden mit Rueckfrage.
// Die Logik steht in components/support/useAntwortEditor.ts und ist dieselbe
// wie in der App (AntwortFormular in SupportMailTeile.tsx): Der Entwurf bleibt
// bei einem Fehler stehen, 503 und 502 erklaeren sich im Formular, bedient
// dieser Server das Postfach nicht, ist Senden aus.

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_SENDEN_GEFUELLT } from '../../shared/icons';
import { POSTFACH_INFO, SERVER_AUS_HINWEIS, empfaengerText, sendeHinweisText } from '../../../utils/supportMail';
import { useAntwortEditor, type AntwortFormularProps } from '../useAntwortEditor';
import WebAuswahl from '../../web/WebAuswahl';
import WebFeld from '../../web/WebFeld';
import WebHinweis from '../../web/WebHinweis';
import WebKnopf from '../../web/WebKnopf';
import WebPill from '../../web/WebPill';
import WebTextfeld from '../../web/WebTextfeld';

const WebAntwortEditor: React.FC<AntwortFormularProps> = (props) => {
  const {
    postfach, an, empfaenger, empfaengerFehlt, gewaehlt, setGewaehlterEmpfaenger, entwurf, setEntwurf, passend,
    gewaehlterBaustein, setGewaehlterBaustein, einfuegen, platzhalterFehlt, einstellungen, status, serverAus, vorschau,
    problem, sendet, abschicken, isOnline,
  } = useAntwortEditor(props);
  const kurz = POSTFACH_INFO[postfach].kurz;
  const sendeHinweis = problem ? sendeHinweisText(problem, postfach) : null;

  return (
    <div className="web-antwort">
      {serverAus && (
        <WebHinweis art="warnung" titel={SERVER_AUS_HINWEIS}>Antworten lassen sich hier nicht senden.</WebHinweis>
      )}
      {!serverAus && status && !status.eingerichtet && (
        <WebHinweis art="warnung" titel="Postfach noch nicht eingerichtet">
          Für {kurz} fehlen auf dem Server noch die Zugangsdaten; eine Antwort wird erst gesendet, wenn sie dort stehen.
        </WebHinweis>
      )}

      {empfaenger !== null ? (
        <WebAuswahl
          label="Empfänger"
          pflicht
          wert={gewaehlt}
          onWert={setGewaehlterEmpfaenger}
          optionen={[{ wert: '', label: 'Bitte wählen' }, ...empfaenger.map((e) => ({ wert: e.adresse, label: empfaengerText(e) }))]}
        />
      ) : an ? (
        <p className="web-antwort__an">An: <strong>{an}</strong> · von <WebPill postfach>{kurz}</WebPill></p>
      ) : null}
      {empfaenger !== null && empfaengerFehlt && (
        <WebHinweis art="fehler" rolle="status">Die möglichen Empfänger konnten nicht geladen werden.</WebHinweis>
      )}
      {empfaenger !== null && !empfaengerFehlt && empfaenger.length === 0 && (
        <WebHinweis art="hinweis">Für diese Gemeinde ist keine Adresse bekannt.</WebHinweis>
      )}

      <div className="web-antwort__baustein">
        <WebAuswahl
          label="Textbaustein"
          wert={gewaehlterBaustein}
          onWert={setGewaehlterBaustein}
          deaktiviert={passend.length === 0}
          optionen={[
            { wert: '', label: passend.length === 0 ? 'Keine Bausteine' : 'Baustein wählen' },
            ...passend.map((b) => ({ wert: String(b.id), label: b.titel })),
          ]}
        />
        <WebKnopf disabled={!gewaehlterBaustein} onClick={() => { void einfuegen(); }}>Baustein einfügen</WebKnopf>
      </div>
      {platzhalterFehlt && (
        <WebHinweis art="fehler" rolle="status">Platzhalter konnten nicht gefüllt werden; sie stehen noch im Text.</WebHinweis>
      )}

      <WebFeld
        label="Betreff"
        wert={entwurf.betreff}
        onWert={(w) => setEntwurf((e) => ({ ...e, betreff: w }))}
        hinweis="Leer: Der Server setzt den Betreff. Die Kennung in eckigen Klammern ergänzt er selbst."
      />
      <WebTextfeld
        label="Text der Antwort"
        pflicht
        zeilen={8}
        wert={entwurf.text}
        onWert={(w) => setEntwurf((v) => ({ ...v, text: w }))}
      />

      <div className="web-feld">
        <span className="web-feld__label">Vorschau mit Fußzeile</span>
        <div
          className={vorschau.trim() ? 'web-vorschau' : 'web-vorschau web-vorschau--leer'}
          role="region"
          aria-label="Vorschau der Antwort"
        >
          {vorschau.trim() ? vorschau : 'Noch kein Text.'}
        </div>
        {!einstellungen?.fusszeile?.trim() && (
          <p className="web-feld__hinweis">Noch keine Fußzeile — sie lässt sich unter Textbausteine festlegen.</p>
        )}
      </div>

      {sendeHinweis && <WebHinweis art="fehler" rolle="alert" titel={sendeHinweis.titel}>{sendeHinweis.text}</WebHinweis>}

      <div className="web-antwort__aktionen">
        <WebKnopf art="primaer" onClick={abschicken} disabled={sendet || serverAus || !isOnline}>
          <IonIcon icon={ICON_SENDEN_GEFUELLT} aria-hidden="true" />
          Antwort senden
        </WebKnopf>
        {serverAus && <span className="web-gedaempft" role="status">Senden ist aus: {SERVER_AUS_HINWEIS}.</span>}
      </div>
    </div>
  );
};

export default WebAntwortEditor;
