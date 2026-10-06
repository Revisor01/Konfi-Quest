// „Einsortieren" als Dialog der Web-Fassung: eine Mail aus dem Posteingang in
// einen bestehenden Vorgang (mit Suche) oder in einen neuen Vorgang mit Art,
// Bereich, Dringlichkeit, Betreff und Gemeinde legen (docs/planung/
// support-vorgaenge.md, Entscheidung 1 und 7). Der ganze Faden geht mit.
// Die Logik steht in components/support/useEinsortieren.ts, dieselbe wie in der App.

import React from 'react';
import { gemeindeName } from '../../../utils/supportMail';
import { VORGANG_STATUS, artKurz, type Vorgang } from '../../../utils/supportVorgaenge';
import { useEinsortieren, type EinsortierenModus } from '../useEinsortieren';
import WebDialog from '../../web/WebDialog';
import WebAuswahl from '../../web/WebAuswahl';
import WebAuswahlSuche from '../../web/WebAuswahlSuche';
import WebChips from '../../web/WebChips';
import WebFeld from '../../web/WebFeld';
import WebHinweis from '../../web/WebHinweis';
import WebKnopf from '../../web/WebKnopf';
import { VorgangAuswahlfelder } from './WebVorgangTeile';

export interface WebEinsortierenProps {
  mail: { id: number; betreff: string | null };
  onSchliessen: () => void;
  /** Die Mail ist einsortiert; `vorgangId`, wenn der Server sie nennt. */
  onFertig?: (vorgangId: number | null) => void;
}

const eintrag = (v: Vorgang) => ({
  wert: String(v.id),
  titel: `Nr. ${v.id} · ${v.betreff || '(ohne Betreff)'}`,
  beschreibung: `${v.gemeinde_name ?? 'Keine Gemeinde'} · ${artKurz(v.art)} · ${VORGANG_STATUS[v.status].kurz}`,
});

const WebEinsortieren: React.FC<WebEinsortierenProps> = ({ mail, onSchliessen, onFertig }) => {
  const z = useEinsortieren(mail, (id) => { onFertig?.(id); onSchliessen(); });

  return (
    <WebDialog
      titel="Mail einsortieren"
      beschreibung={`„${mail.betreff?.trim() || '(ohne Betreff)'}“ kommt in einen Vorgang. Spätere Antworten darauf ordnet der Server dann selbst zu.`}
      onSchliessen={onSchliessen}
      onAbsenden={() => { void z.absenden(); }}
      aktionen={(
        <>
          <WebKnopf onClick={onSchliessen}>Abbrechen</WebKnopf>
          <WebKnopf art="primaer" absenden disabled={z.sendet || !z.isOnline}>Einsortieren</WebKnopf>
        </>
      )}
    >
      <div className="web-formular">
        {z.fehler && <WebHinweis art="fehler" rolle="alert">{z.fehler}</WebHinweis>}
        <WebChips<EinsortierenModus>
          beschriftung="Einsortieren in"
          wert={z.modus}
          onWert={z.setModus}
          chips={[
            { wert: 'bestehend', label: 'Bestehender Vorgang' },
            { wert: 'neu', label: 'Neuer Vorgang' },
          ]}
        />
        {z.modus === 'bestehend' ? (
          <>
            {z.vorgaengeFehlen && <WebHinweis art="fehler" rolle="status">Die Vorgänge konnten nicht geladen werden.</WebHinweis>}
            <WebAuswahlSuche
              label="Vorgang"
              suchePlatzhalter="Vorgang suchen"
              leerText="Es gibt keinen offenen Vorgang. Lege einen neuen an."
              eintraege={(z.vorgaenge ?? []).map(eintrag)}
              wert={z.vorgangWahl}
              onWert={z.setVorgangWahl}
            />
          </>
        ) : (
          <>
            <VorgangAuswahlfelder
              artOffen
              paar
              art={z.neu.art}
              bereich={z.neu.bereich}
              dringlichkeit={z.neu.dringlichkeit}
              onArt={(art) => z.aendernNeu({ art })}
              onBereich={(bereich) => z.aendernNeu({ bereich })}
              onDringlichkeit={(dringlichkeit) => z.aendernNeu({ dringlichkeit })}
            />
            <WebFeld label="Betreff" pflicht wert={z.neu.betreff} onWert={(w) => z.aendernNeu({ betreff: w })} />
            <WebAuswahl
              label="Gemeinde"
              wert={z.neu.organizationId}
              onWert={(w) => z.aendernNeu({ organizationId: w })}
              optionen={[{ wert: '', label: 'Keine Gemeinde' }, ...z.gemeinden.map((g) => ({ wert: String(g.id), label: gemeindeName(g) }))]}
              hinweis={z.gemeindenFehlen ? 'Die Gemeinden konnten nicht geladen werden.' : undefined}
            />
          </>
        )}
      </div>
    </WebDialog>
  );
};

export default WebEinsortieren;
