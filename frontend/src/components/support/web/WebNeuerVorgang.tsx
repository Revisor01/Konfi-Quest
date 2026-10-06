// „Neuer Vorgang" als Dialog der Web-Fassung (docs/planung/support-vorgaenge.md,
// Entscheidung 1 und 7): Art, Bereich und Dringlichkeit als Auswahlfelder,
// Betreff, Gemeinde und -- freiwillig -- die erste Mail an eine Adresse der
// Gemeinde. So schreibt der Support eine Gemeinde an, und die Antwort landet im
// Vorgang. Die Logik steht in components/support/useNeuerVorgang.ts, dieselbe
// wie in der App.

import React from 'react';
import { empfaengerText, gemeindeName, POSTFACH_INFO } from '../../../utils/supportMail';
import type { NeuerVorgangFormular } from '../../../utils/supportVorgaenge';
import { useNeuerVorgang } from '../useNeuerVorgang';
import WebDialog from '../../web/WebDialog';
import WebAuswahl from '../../web/WebAuswahl';
import WebFeld from '../../web/WebFeld';
import WebHinweis from '../../web/WebHinweis';
import WebKnopf from '../../web/WebKnopf';
import WebTextfeld from '../../web/WebTextfeld';
import { VorgangAuswahlfelder } from './WebVorgangTeile';

export interface WebNeuerVorgangProps {
  onSchliessen: () => void;
  /** Vorbelegung, z. B. die Gemeinde, deren Liste gerade offen ist („Schreiben"). */
  vorbelegt?: Partial<NeuerVorgangFormular>;
  /** „Schreiben": Titel und Knopf sagen, dass eine Gemeinde angeschrieben wird. */
  schreiben?: boolean;
}

const WebNeuerVorgang: React.FC<WebNeuerVorgangProps> = ({ onSchliessen, vorbelegt, schreiben = false }) => {
  const { isOnline, formular, aendern, gemeinden, gemeindenFehlt, empfaenger, empfaengerFehlt, fehler, sendet, absenden } = useNeuerVorgang(vorbelegt, onSchliessen);

  return (
    <WebDialog
      titel={schreiben ? 'Gemeinde anschreiben' : 'Neuer Vorgang'}
      beschreibung="Sortiere den Vorgang gleich richtig ein. Eine erste Mail ist freiwillig; die Antwort darauf landet in diesem Vorgang."
      onSchliessen={onSchliessen}
      onAbsenden={() => { void absenden(); }}
      aktionen={(
        <>
          <WebKnopf onClick={onSchliessen}>Abbrechen</WebKnopf>
          <WebKnopf art="primaer" absenden disabled={sendet || !isOnline}>
            {schreiben ? 'Vorgang anlegen und senden' : 'Vorgang anlegen'}
          </WebKnopf>
        </>
      )}
    >
      <div className="web-formular">
        {fehler && <WebHinweis art="fehler" rolle="alert">{fehler}</WebHinweis>}
        <VorgangAuswahlfelder
          artOffen
          paar
          art={formular.art}
          bereich={formular.bereich}
          dringlichkeit={formular.dringlichkeit}
          onArt={(art) => aendern({ art })}
          onBereich={(bereich) => aendern({ bereich })}
          onDringlichkeit={(dringlichkeit) => aendern({ dringlichkeit })}
        />
        <WebFeld label="Betreff" pflicht wert={formular.betreff} onWert={(w) => aendern({ betreff: w })} />
        <WebAuswahl
          label="Gemeinde"
          wert={formular.organizationId}
          onWert={(w) => aendern({ organizationId: w })}
          optionen={[
            { wert: '', label: 'Keine Gemeinde' },
            ...gemeinden.map((g) => ({ wert: String(g.id), label: gemeindeName(g) })),
          ]}
          hinweis={gemeindenFehlt ? 'Die Gemeinden konnten nicht geladen werden.' : undefined}
        />

        <h3 className="web-gruppe">Erste Mail (freiwillig)</h3>
        {formular.organizationId ? (
          <>
            <WebAuswahl
              label="An"
              wert={formular.an}
              onWert={(w) => aendern({ an: w })}
              optionen={[
                { wert: '', label: empfaenger.length === 0 ? 'Keine Adresse bekannt' : 'Bitte wählen' },
                ...empfaenger.map((e) => ({ wert: e.adresse, label: empfaengerText(e) })),
              ]}
              deaktiviert={empfaenger.length === 0}
              hinweis={empfaengerFehlt ? 'Die Adressen der Gemeinde konnten nicht geladen werden.' : undefined}
            />
          </>
        ) : (
          <WebFeld label="An (E-Mail-Adresse)" typ="email" wert={formular.an} onWert={(w) => aendern({ an: w })} autocomplete="email" />
        )}
        <WebTextfeld
          label="Text der Mail"
          zeilen={4}
          wert={formular.text}
          onWert={(w) => aendern({ text: w })}
          hinweis={`Leer: Es wird nur der Vorgang angelegt. Gesendet wird von ${POSTFACH_INFO.support.kurz}, mit der Nummer des Vorgangs im Betreff.`}
        />
      </div>
    </WebDialog>
  );
};

export default WebNeuerVorgang;
