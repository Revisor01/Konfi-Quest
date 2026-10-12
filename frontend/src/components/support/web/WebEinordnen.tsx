// „Einordnen" eines Vorgangs als kompakter Dialog der Web-Fassung (Simon,
// 11.10.2026: „Zuordnen auch über ein Modal auf Web und App";
// docs/planung/support-detailseiten.md, H): Betreff, Status, Dringlichkeit,
// Art, Bereich und die Gemeinde über die volle Breite. Alles mit einem Knopf:
// „Speichern" schickt EIN PATCH mit genau den geänderten Feldern
// (PATCH /support/vorgaenge/:id).
//
// Formular und Regeln stehen in components/support/useEinordnenFormular.ts
// (dieselben wie in der App, Frage 5): Pflicht-Bereich bei Frage, Fehler und
// Wunsch, Betreff nicht leer; bei „Erledigt" der Satz zum Archiv -- an einer
// Anfrage, die noch nicht angelegt ist: „Erledigt lehnt die Anfrage ab".

import React from 'react';
import { STATUS_REIHE, VORGANG_STATUS, type VorgangStatus } from '../../../utils/supportVorgaenge';
import type { VorgangDetailDaten } from '../useVorgangDetail';
import { useEinordnenFormular } from '../useEinordnenFormular';
import WebDialog from '../../web/WebDialog';
import WebAuswahl from '../../web/WebAuswahl';
import WebFeld from '../../web/WebFeld';
import WebHinweis from '../../web/WebHinweis';
import WebKnopf from '../../web/WebKnopf';
import { VorgangAuswahlfelder } from './WebVorgangTeile';

const WebEinordnen: React.FC<{ d: VorgangDetailDaten; onSchliessen: () => void }> = ({ d, onSchliessen }) => {
  const f = useEinordnenFormular(d);
  const { vorgang } = d;
  if (!vorgang || !f.entwurf) return null;
  const e = f.entwurf;

  const speichern = async () => {
    if (await f.speichern()) onSchliessen();
  };

  return (
    <WebDialog
      titel="Einordnen"
      beschreibung={`Vorgang ${vorgang.id}: ${vorgang.betreff || '(ohne Betreff)'}`}
      onSchliessen={onSchliessen}
      onAbsenden={() => { void speichern(); }}
      gesperrt={f.speichert}
      aktionen={(
        <>
          <WebKnopf onClick={onSchliessen}>Abbrechen</WebKnopf>
          <WebKnopf art="primaer" absenden disabled={f.speichert || !f.isOnline}>Speichern</WebKnopf>
        </>
      )}
    >
      <div className="web-formular">
        {f.fehler && <WebHinweis art="fehler" rolle="alert">{f.fehler}</WebHinweis>}
        <WebFeld label="Betreff" pflicht wert={e.betreff} onWert={(w) => f.aendern({ betreff: w })} />
        <VorgangAuswahlfelder
          paar
          art={e.art}
          bereich={e.bereich}
          dringlichkeit={e.dringlichkeit}
          onArt={(art) => { if (art) f.aendern({ art }); }}
          onBereich={(bereich) => f.aendern({ bereich })}
          onDringlichkeit={(dringlichkeit) => f.aendern({ dringlichkeit })}
          nebenDringlichkeit={(
            <WebAuswahl
              label="Status"
              wert={e.status}
              onWert={(w) => f.aendern({ status: w as VorgangStatus })}
              optionen={STATUS_REIHE.map((s) => ({ wert: s, label: VORGANG_STATUS[s].label }))}
              hinweis={f.hinweis ?? undefined}
            />
          )}
        />
        <WebAuswahl
          label="Gemeinde"
          wert={e.gemeinde}
          onWert={(w) => f.aendern({ gemeinde: w })}
          optionen={f.gemeindeOptionen}
          hinweis={f.gemeindenFehlt ? 'Die Gemeinden konnten nicht vollständig geladen werden.' : undefined}
        />
      </div>
    </WebDialog>
  );
};

export default WebEinordnen;
