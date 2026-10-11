// „Einordnen" eines Vorgangs als kompakter Dialog der Web-Fassung (Simon,
// 11.10.2026: „Zuordnen auch über ein Modal auf Web und App"): Status, Art,
// Bereich, Dringlichkeit und Gemeinde. Anders als in der App wird hier nicht
// jedes Feld sofort gespeichert, sondern alles mit einem Knopf -- ein Dialog
// mit „Speichern" verspricht genau das. Gespeichert wird nur, was sich
// geändert hat, in einem Schritt (PATCH /support/vorgaenge/:id).

import React, { useState } from 'react';
import { gemeindeName } from '../../../utils/supportMail';
import {
  ERLEDIGT_HINWEIS,
  STATUS_REIHE,
  VORGANG_STATUS,
  bereichIstPflicht,
  type Dringlichkeit,
  type VorgangArt,
  type VorgangBereich,
  type VorgangStatus,
} from '../../../utils/supportVorgaenge';
import type { VorgangDetailDaten } from '../useVorgangDetail';
import WebDialog from '../../web/WebDialog';
import WebAuswahl from '../../web/WebAuswahl';
import WebHinweis from '../../web/WebHinweis';
import WebKnopf from '../../web/WebKnopf';
import { VorgangAuswahlfelder } from './WebVorgangTeile';

interface Entwurf {
  status: VorgangStatus;
  art: VorgangArt | '';
  bereich: VorgangBereich | '';
  dringlichkeit: Dringlichkeit;
  gemeinde: string;
}

const WebEinordnen: React.FC<{ d: VorgangDetailDaten; onSchliessen: () => void }> = ({ d, onSchliessen }) => {
  const { vorgang, gemeinden, gemeindenFehlt, einordnen, isOnline, speichert } = d;
  const [entwurf, setEntwurf] = useState<Entwurf | null>(() => (vorgang ? {
    status: vorgang.status,
    art: vorgang.art,
    bereich: vorgang.bereich ?? '',
    dringlichkeit: vorgang.dringlichkeit,
    gemeinde: vorgang.organization_id === null ? '' : String(vorgang.organization_id),
  } : null));
  const [fehler, setFehler] = useState<string | null>(null);
  if (!vorgang || !entwurf) return null;

  const aendern = (teil: Partial<Entwurf>) => setEntwurf((e) => (e ? { ...e, ...teil } : e));

  const speichern = async () => {
    if (entwurf.art === '') {
      setFehler('Bitte eine Art wählen.');
      return;
    }
    if (bereichIstPflicht(entwurf.art) && entwurf.bereich === '') {
      setFehler('Bei Frage, Fehler und Wunsch gehört ein Bereich dazu.');
      return;
    }
    const teil: Parameters<typeof einordnen>[0] = {};
    if (entwurf.status !== vorgang.status) teil.status = entwurf.status;
    if (entwurf.art !== vorgang.art) teil.art = entwurf.art;
    if ((entwurf.bereich || null) !== vorgang.bereich) teil.bereich = entwurf.bereich || null;
    if (entwurf.dringlichkeit !== vorgang.dringlichkeit) teil.dringlichkeit = entwurf.dringlichkeit;
    const org = entwurf.gemeinde ? Number(entwurf.gemeinde) : null;
    if (org !== vorgang.organization_id) teil.organization_id = org;
    if (Object.keys(teil).length === 0) {
      onSchliessen();
      return;
    }
    if (await einordnen(teil)) onSchliessen();
  };

  const gemeindeOptionen = [
    { wert: '', label: 'Keine Gemeinde' },
    ...gemeinden.map((g) => ({ wert: String(g.id), label: gemeindeName(g) })),
    ...(vorgang.organization_id !== null && !gemeinden.some((g) => g.id === vorgang.organization_id)
      ? [{ wert: String(vorgang.organization_id), label: vorgang.gemeinde_name ?? `Gemeinde ${vorgang.organization_id}` }] : []),
  ];

  return (
    <WebDialog
      titel="Einordnen"
      beschreibung={`Vorgang ${vorgang.id}: ${vorgang.betreff || '(ohne Betreff)'}`}
      onSchliessen={onSchliessen}
      onAbsenden={() => { void speichern(); }}
      aktionen={(
        <>
          <WebKnopf onClick={onSchliessen}>Abbrechen</WebKnopf>
          <WebKnopf art="primaer" absenden disabled={speichert || !isOnline}>Speichern</WebKnopf>
        </>
      )}
    >
      <div className="web-formular">
        {fehler && <WebHinweis art="fehler" rolle="alert">{fehler}</WebHinweis>}
        <div className="web-feldpaar">
          <WebAuswahl
            label="Status"
            wert={entwurf.status}
            onWert={(w) => aendern({ status: w as VorgangStatus })}
            optionen={STATUS_REIHE.map((s) => ({ wert: s, label: VORGANG_STATUS[s].label }))}
            hinweis={entwurf.status === 'erledigt' ? ERLEDIGT_HINWEIS : undefined}
          />
          <WebAuswahl
            label="Gemeinde"
            wert={entwurf.gemeinde}
            onWert={(w) => aendern({ gemeinde: w })}
            optionen={gemeindeOptionen}
            hinweis={gemeindenFehlt ? 'Die Gemeinden konnten nicht vollständig geladen werden.' : undefined}
          />
        </div>
        <VorgangAuswahlfelder
          paar
          art={entwurf.art}
          bereich={entwurf.bereich}
          dringlichkeit={entwurf.dringlichkeit}
          onArt={(art) => aendern({ art })}
          onBereich={(bereich) => aendern({ bereich })}
          onDringlichkeit={(dringlichkeit) => aendern({ dringlichkeit })}
        />
      </div>
    </WebDialog>
  );
};

export default WebEinordnen;
