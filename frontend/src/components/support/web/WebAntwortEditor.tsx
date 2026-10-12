// Antworten in der Web-Fassung -- EIN Editor für Vorgang und Mail
// (docs/planung/support-detailseiten.md, G; seit 11.10.2026 kompakt, ≈ 300
// statt 837 px): An mit lesbarem Etikett und dem Postfach daneben, der
// Betreff als Zeile mit „Ändern", der Text, Baustein einfügen, die Vorschau
// mit Fußzeile zugeklappt, „Danach" (Status nach dem Senden, nur im Vorgang)
// und „Antwort senden". Gibt es nur eine Adresse, steht eine feste Zeile
// „An: … · von …" da -- im Vorgang wie im Posteingang (eine Form statt zwei).
//
// Die Logik steht in components/support/useAntwortEditor.ts und ist dieselbe
// wie in der App (AntwortFormular in SupportMailTeile.tsx): Der Entwurf
// bleibt bei einem Fehler stehen, 503 und 502 erklären sich im Formular,
// bedient dieser Server das Postfach nicht, ist Senden aus; „Danach" setzt
// den Status erst nach dem Senden, scheitert das, kommt „Gesendet, Status
// nicht gesetzt.". Die Props sind die des Hooks (AntwortFormularProps) -- so
// nutzt WebPostDetail denselben Editor.

import React, { useEffect, useId, useState, type MutableRefObject } from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_AUFKLAPPEN, ICON_SENDEN_GEFUELLT, ICON_ZUKLAPPEN } from '../../shared/icons';
import { POSTFACH_INFO, SERVER_AUS_HINWEIS, sendeHinweisText } from '../../../utils/supportMail';
import { useAntwortEditor, type AntwortFormularProps } from '../useAntwortEditor';
import { DANACH_BESCHRIFTUNG, DANACH_WAHLEN } from '../../../seiten/supportDetail';
import WebAuswahl from '../../web/WebAuswahl';
import WebHinweis from '../../web/WebHinweis';
import WebKnopf from '../../web/WebKnopf';
import WebPill from '../../web/WebPill';
import WebTextfeld from '../../web/WebTextfeld';

/** Die Texte des Editors, die nur der Browser zeigt. */
const TEXT = {
  an: 'An',
  betreff: 'Betreff',
  aendern: 'Ändern',
  betreffHinweis: 'Leer: Der Server setzt den Betreff. Die Kennung in eckigen Klammern ergänzt er selbst.',
  vorschau: 'Vorschau mit Fußzeile',
  vorschauRegion: 'Vorschau der Antwort',
  vorschauLeer: 'Noch kein Text.',
  ohneFusszeile: 'Noch keine Fußzeile — sie lässt sich unter Textbausteine festlegen.',
  keineAdresse: 'Für diese Gemeinde ist keine Adresse bekannt.',
  empfaengerFehlt: 'Die möglichen Empfänger konnten nicht geladen werden.',
  postfachFehlt: (kurz: string): string => `Postfach ${kurz} noch nicht eingerichtet – gesendet wird erst mit Zugangsdaten.`,
  text: 'Text der Antwort',
  bitteWaehlen: 'Bitte wählen',
} as const;

export interface WebAntwortEditorProps extends AntwortFormularProps {
  /**
   * Hier meldet der Editor, ob im Text etwas steht, das noch nicht gesendet
   * ist (web/useAntwortStelle.ts): Ein Abschluss, nach dem der nächste
   * Eintrag aufgeht, fragt dann vorher. Beim Schließen wieder false.
   */
  entwurfRef?: MutableRefObject<boolean>;
}

const WebAntwortEditor: React.FC<WebAntwortEditorProps> = ({ entwurfRef, ...props }) => {
  const {
    postfach, empfaenger, empfaengerFehlt, gewaehlt, setGewaehlterEmpfaenger, entwurf, setEntwurf, passend,
    gewaehlterBaustein, setGewaehlterBaustein, einfuegen, platzhalterFehlt, einstellungen, status, serverAus, vorschau,
    problem, sendet, abschicken, isOnline, danachWahlen, danachStatus, setDanachStatus, feste, empfaengerOptionen,
    betreffBearbeiten, setBetreffBearbeiten,
  } = useAntwortEditor(props);
  const [vorschauOffen, setVorschauOffen] = useState(false);
  // Der Entwurf für den Schutz vor dem Abschluss: ein Text, der noch nicht gesendet ist.
  const hatText = entwurf.text.trim() !== '';
  useEffect(() => {
    if (!entwurfRef) return undefined;
    entwurfRef.current = hatText;
    return () => { entwurfRef.current = false; };
  }, [entwurfRef, hatText]);
  const betreffId = useId();
  const vorschauId = useId();
  const kurz = POSTFACH_INFO[postfach].kurz;
  const sendeHinweis = problem ? sendeHinweisText(problem, postfach) : null;
  const von = <span className="web-antwort__von">von <WebPill postfach>{kurz}</WebPill></span>;

  return (
    <div className="web-antwort web-antwort--kompakt">
      {serverAus && (
        <WebHinweis art="warnung" titel={SERVER_AUS_HINWEIS}>Antworten lassen sich hier nicht senden.</WebHinweis>
      )}
      {!serverAus && status && !status.eingerichtet && (
        <p className="web-antwort__warnung" role="status">{TEXT.postfachFehlt(kurz)}</p>
      )}

      {feste ? (
        <p className="web-antwort__an">
          An: <strong>{feste.an}</strong>{feste.etikett ? ` · ${feste.etikett}` : ''} · {von}
        </p>
      ) : empfaenger !== null ? (
        <div className="web-antwort__zeile web-antwort__zeile--an">
          <WebAuswahl
            label={TEXT.an}
            pflicht
            wert={gewaehlt}
            onWert={setGewaehlterEmpfaenger}
            optionen={[{ wert: '', label: TEXT.bitteWaehlen }, ...empfaengerOptionen]}
          />
          {von}
        </div>
      ) : null}
      {empfaenger !== null && empfaengerFehlt && (
        <WebHinweis art="fehler" rolle="status">{TEXT.empfaengerFehlt}</WebHinweis>
      )}
      {empfaenger !== null && !empfaengerFehlt && empfaenger.length === 0 && (
        <WebHinweis art="hinweis">{TEXT.keineAdresse}</WebHinweis>
      )}

      <div className="web-antwort__zeile web-antwort__zeile--betreff">
        <label htmlFor={betreffId} className="web-feld__label">{TEXT.betreff}</label>
        <input
          id={betreffId}
          className={`web-eingabe web-antwort__betreff${betreffBearbeiten ? '' : ' web-antwort__betreff--fest'}`}
          value={entwurf.betreff}
          readOnly={!betreffBearbeiten}
          aria-describedby={betreffBearbeiten ? `${betreffId}-hinweis` : undefined}
          onChange={(e) => setEntwurf((v) => ({ ...v, betreff: e.target.value }))}
        />
        {!betreffBearbeiten && (
          <WebKnopf art="text" klein onClick={() => setBetreffBearbeiten(true)} aria-label={`${TEXT.betreff} ${TEXT.aendern.toLowerCase()}`}>{TEXT.aendern}</WebKnopf>
        )}
      </div>
      {betreffBearbeiten && <p id={`${betreffId}-hinweis`} className="web-feld__hinweis">{TEXT.betreffHinweis}</p>}

      {/* Die Beschriftung bleibt für Vorleseprogramme; sichtbar steht sie im leeren Feld. */}
      <WebTextfeld
        label={TEXT.text}
        pflicht
        zeilen={4}
        platzhalter={`${TEXT.text} …`}
        wert={entwurf.text}
        onWert={(w) => setEntwurf((v) => ({ ...v, text: w }))}
      />

      <div className="web-antwort__mitte">
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
          <WebKnopf klein disabled={!gewaehlterBaustein} onClick={() => { void einfuegen(); }}>Baustein einfügen</WebKnopf>
        </div>
        <button
          type="button"
          className="web-antwort__vorschauknopf"
          aria-expanded={vorschauOffen}
          aria-controls={vorschauOffen ? vorschauId : undefined}
          onClick={() => setVorschauOffen((o) => !o)}
        >
          <IonIcon icon={vorschauOffen ? ICON_ZUKLAPPEN : ICON_AUFKLAPPEN} aria-hidden="true" />
          {TEXT.vorschau}
        </button>
      </div>
      {platzhalterFehlt && (
        <WebHinweis art="fehler" rolle="status">Platzhalter konnten nicht gefüllt werden; sie stehen noch im Text.</WebHinweis>
      )}
      {vorschauOffen && (
        <div id={vorschauId} className="web-antwort__vorschau">
          <div className={vorschau.trim() ? 'web-vorschau' : 'web-vorschau web-vorschau--leer'} role="region" aria-label={TEXT.vorschauRegion}>
            {vorschau.trim() ? vorschau : TEXT.vorschauLeer}
          </div>
          {!einstellungen?.fusszeile?.trim() && <p className="web-feld__hinweis">{TEXT.ohneFusszeile}</p>}
        </div>
      )}

      {sendeHinweis && <WebHinweis art="fehler" rolle="alert" titel={sendeHinweis.titel}>{sendeHinweis.text}</WebHinweis>}

      <div className="web-antwort__fuss">
        {danachWahlen.length > 0 && danachStatus && (
          <div className="web-antwort__danach">
            <WebAuswahl
              label={DANACH_BESCHRIFTUNG}
              wert={danachStatus}
              onWert={(w) => setDanachStatus(w as typeof danachStatus)}
              optionen={DANACH_WAHLEN.filter((w) => danachWahlen.includes(w.schluessel)).map((w) => ({ wert: w.schluessel, label: w.label }))}
            />
          </div>
        )}
        <div className="web-antwort__senden">
          {serverAus && <span className="web-gedaempft" role="status">Senden ist aus: {SERVER_AUS_HINWEIS}.</span>}
          <WebKnopf art="primaer" onClick={abschicken} disabled={sendet || serverAus || !isOnline}>
            <IonIcon icon={ICON_SENDEN_GEFUELLT} aria-hidden="true" />
            Antwort senden
          </WebKnopf>
        </div>
      </div>
    </div>
  );
};

export default WebAntwortEditor;
