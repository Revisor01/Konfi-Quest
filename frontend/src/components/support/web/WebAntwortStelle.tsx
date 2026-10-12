// Die Stelle unter der jüngsten Mail im Lesebereich (docs/planung/
// support-detailseiten.md, G) -- die Darstellung zu useAntwortStelle, für
// Vorgang und Mail dieselbe: zugeklappt die Antwortzeile („Antwort an …
// schreiben …", von welchem Postfach), offen der kompakte Editor mit
// „Verwerfen". Ohne Antwortweg (Vorgang, Stand Fall 2) steht die gesperrte
// Zeile da, die auf den Stand verweist.

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_ANTWORTEN } from '../../shared/icons';
import { POSTFACH_INFO } from '../../../utils/supportMail';
import type { AntwortFormularProps } from '../useAntwortEditor';
import WebKnopf from '../../web/WebKnopf';
import WebAntwortEditor from './WebAntwortEditor';
import { Antwortzeile } from './WebVorgangTeile';
import type { AntwortStelle } from './useAntwortStelle';

export interface WebAntwortStelleProps {
  stelle: AntwortStelle;
  /** Das fertige Antwortformular (useVorgangDetail bzw. usePostDetail); null: kein Antwortweg. */
  antwort: AntwortFormularProps | null;
  /** An wen die Antwortzeile schreibt; null: „Antwort schreiben …". */
  wer: string | null;
  /** Neu für einen anderen Vorgang bzw. eine andere Mail: der Editor beginnt dann leer. */
  schluessel: number;
  /** Ohne Netz: die Antwortzeile ist gesperrt. */
  disabled?: boolean;
}

const WebAntwortStelle: React.FC<WebAntwortStelleProps> = ({ stelle, antwort, wer, schluessel, disabled = false }) => {
  const { offen, editorRef, zeileRef, oeffnen, schliessen, entwurfRef } = stelle;
  if (offen && antwort) {
    return (
      <section ref={editorRef} className="web-lesen__antwort" aria-label="Antwort schreiben">
        <div className="web-lesen__antwortkopf">
          <h3 className="web-lesen__antworttitel">
            <IonIcon icon={ICON_ANTWORTEN} aria-hidden="true" />
            Antwort
          </h3>
          <WebKnopf klein onClick={schliessen}>Verwerfen</WebKnopf>
        </div>
        <WebAntwortEditor key={schluessel} {...antwort} onGesendet={schliessen} entwurfRef={entwurfRef} />
      </section>
    );
  }
  return (
    <Antwortzeile
      knopfRef={zeileRef}
      wer={wer}
      postfach={antwort ? POSTFACH_INFO[antwort.postfach].kurz : null}
      onOeffnen={oeffnen}
      gesperrt={!antwort}
      disabled={disabled}
    />
  );
};

export default WebAntwortStelle;
