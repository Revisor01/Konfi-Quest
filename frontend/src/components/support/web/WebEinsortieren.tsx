// „Einsortieren" als Dialog der Web-Fassung: eine Mail in einen bestehenden
// Vorgang (mit Suche) oder in einen neuen Vorgang mit Art, Bereich,
// Dringlichkeit, Betreff und Gemeinde legen (docs/planung/
// support-vorgaenge.md, Entscheidung 1 und 7). Aus dem Posteingang gehen die
// Mails desselben Gesprächs mit, soweit sie noch dort liegen.
//
// Seit 11.10.2026 auch aus dem Menü einer Mail im Vorgang
// (docs/planung/support-detailseiten.md, A und H): „In anderen Vorgang
// verschieben" (`ausVorgang`, Modus bestehend -- der eigene Vorgang steht
// nicht zur Wahl) und „In neuen Vorgang herauslösen" (Modus neu). Dann geht
// nur diese eine Mail; der Titel nennt die Handlung, in App und Web gleich.
// Die Logik steht in components/support/useEinsortieren.ts, dieselbe wie in der App.

import React from 'react';
import { betreffKern, gemeindeName } from '../../../utils/supportMail';
import { useEinsortieren, type EinsortierenModus } from '../useEinsortieren';
import WebDialog from '../../web/WebDialog';
import WebAuswahl from '../../web/WebAuswahl';
import WebAuswahlSuche from '../../web/WebAuswahlSuche';
import WebChips from '../../web/WebChips';
import WebFeld from '../../web/WebFeld';
import WebHinweis from '../../web/WebHinweis';
import WebKnopf from '../../web/WebKnopf';
import { VorgangAuswahlfelder } from './WebVorgangTeile';
import { inFassung } from '../../../seiten/beschreibung';
import { EINSORTIEREN_IN, EINSORTIEREN_IN_BESCHRIFTUNG, vorgangEintrag } from '../../../seiten/supportEinsortieren';
import { MAIL_MENUE } from '../../../seiten/supportDetail';

export interface WebEinsortierenProps {
  mail: { id: number; betreff: string | null };
  onSchliessen: () => void;
  /** Die Mail ist einsortiert; `vorgangId`, wenn der Server sie nennt. */
  onFertig?: (vorgangId: number | null) => void;
  /**
   * Die Mail liegt schon in diesem Vorgang (Menü der Mail): Er steht nicht zur
   * Wahl, und nur diese Mail geht. Ohne: aus dem Posteingang.
   */
  ausVorgang?: number | null;
  /** Womit der Dialog beginnt -- „In neuen Vorgang herauslösen" beginnt mit 'neu'. */
  modus?: EinsortierenModus;
}

const WebEinsortieren: React.FC<WebEinsortierenProps> = ({ mail, onSchliessen, onFertig, ausVorgang = null, modus }) => {
  const z = useEinsortieren(mail, (id) => { onFertig?.(id); onSchliessen(); }, { ausVorgang, modus });
  const ausEinemVorgang = ausVorgang !== null;
  // Aus dem Menü einer Mail ist die Handlung schon gewählt: Titel und Knopf nennen sie, keine Wahl dazwischen.
  const titel = !ausEinemVorgang ? 'Mail einsortieren' : z.modus === 'neu' ? MAIL_MENUE.herausloesen : MAIL_MENUE.verschieben;
  const knopf = !ausEinemVorgang ? 'Einsortieren' : z.modus === 'neu' ? 'Herauslösen' : 'Verschieben';
  // Der Betreff als Kern, wie im Kopf der Mail und in der Liste (ohne Re:, AW: und Kennung).
  const betreff = betreffKern(mail.betreff) || '(ohne Betreff)';
  const beschreibung = ausEinemVorgang
    ? `„${betreff}“ – ${z.hinweis}`
    : `„${betreff}“ kommt in einen Vorgang. Spätere Antworten darauf ordnet der Server dann selbst zu.`;

  return (
    <WebDialog
      titel={titel}
      beschreibung={beschreibung}
      onSchliessen={onSchliessen}
      onAbsenden={() => { void z.absenden(); }}
      gesperrt={z.sendet}
      aktionen={(
        <>
          <WebKnopf onClick={onSchliessen}>Abbrechen</WebKnopf>
          <WebKnopf art="primaer" absenden disabled={z.sendet || !z.isOnline}>{knopf}</WebKnopf>
        </>
      )}
    >
      <div className="web-formular">
        {z.fehler && <WebHinweis art="fehler" rolle="alert">{z.fehler}</WebHinweis>}
        {!ausEinemVorgang && (
          <WebChips<EinsortierenModus>
            beschriftung={EINSORTIEREN_IN_BESCHRIFTUNG}
            wert={z.modus}
            onWert={z.setModus}
            chips={inFassung(EINSORTIEREN_IN, 'web').map((m) => ({ wert: m.schluessel, label: m.label }))}
          />
        )}
        {z.modus === 'bestehend' ? (
          <>
            {z.vorgaengeFehlen && <WebHinweis art="fehler" rolle="status">Die Vorgänge konnten nicht geladen werden.</WebHinweis>}
            <WebAuswahlSuche
              label="Vorgang"
              suchePlatzhalter="Vorgang suchen"
              leerText="Es gibt keinen offenen Vorgang. Lege einen neuen an."
              eintraege={(z.vorgaenge ?? []).map(vorgangEintrag)}
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
