// Der Schriftwechsel der Web-Fassung, wie in einem Mailprogramm: jede Mail mit
// Kopf (wer, an wen, wann, welches Postfach, ein oder aus), Betreff, Text und
// Anhaengen. Eingehende stehen mit blauer Kante, ausgehende mit gruener -- und
// beide sagen es in Worten ("Eingegangen" / "Gesendet"), nicht nur in Farbe.
// Zitate (Zeilen mit ">", "Am ... schrieb ...") sind eingeklappt und lassen
// sich aufklappen. Anhaenge stehen nur als Namen da.
//
// `kopf="voll"` ist die einzelne Mail im Posteingang: die Kopfdaten als Liste
// (Von, An, Datum, Postfach); den Betreff traegt dort die Karte als Ueberschrift.
// `kopf="kurz"` (Vorgabe) ist die Mail im Verlauf. Die Regeln dahinter (Zitate trennen, Absender) stehen
// rein in utils/supportMail.ts.

import React, { useId, useMemo, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_ANHANG, ICON_AUFKLAPPEN, ICON_MAIL, ICON_SENDEN, ICON_ZUKLAPPEN } from '../../shared/icons';
import type { MailNachricht } from '../../../types/support';
import { POSTFACH_INFO, zitateTrennen } from '../../../utils/supportMail';
import { datumUhrzeit } from '../../../utils/dateUtils';
import WebPill from './WebPill';

/** Ein Zitat: eingeklappt, mit Knopf zum Aufklappen. */
const WebZitat: React.FC<{ text: string }> = ({ text }) => {
  const [offen, setOffen] = useState(false);
  const id = useId();
  return (
    <div className="web-mail__zitat">
      <button type="button" className="web-mail__zitat-knopf" aria-expanded={offen} aria-controls={id} onClick={() => setOffen((o) => !o)}>
        <IonIcon icon={offen ? ICON_ZUKLAPPEN : ICON_AUFKLAPPEN} aria-hidden="true" />
        {offen ? 'Zitat ausblenden' : 'Zitat einblenden'}
      </button>
      {offen && <div id={id} className="web-mail__zitat-text">{text}</div>}
    </div>
  );
};

/** Der Text einer Mail: eigener Text sichtbar, Zitate eingeklappt. */
export const WebMailText: React.FC<{ text: string | null }> = ({ text }) => {
  const teile = useMemo(() => zitateTrennen(text), [text]);
  if (teile.length === 0) return <p className="web-mail__absatz web-gedaempft"><em>Ohne Text</em></p>;
  return (
    <>
      {teile.map((t, i) => (t.zitat
        ? <WebZitat key={i} text={t.text} />
        : <p key={i} className="web-mail__absatz">{t.text}</p>))}
    </>
  );
};

const AbsenderAnzeige: React.FC<{ name: string | null; adresse: string }> = ({ name, adresse }) => {
  const n = name?.trim();
  return n
    ? <><strong>{n}</strong> <span className="web-gedaempft">&lt;{adresse}&gt;</span></>
    : <strong>{adresse}</strong>;
};

export interface WebMailEintragProps {
  mail: MailNachricht;
  /** Beim Oeffnen noch ungelesen: bekommt die Marke "Neu". */
  neu?: boolean;
  kopf?: 'kurz' | 'voll';
}

export const WebMailEintrag: React.FC<WebMailEintragProps> = ({ mail, neu = false, kopf = 'kurz' }) => {
  const ein = mail.richtung === 'ein';
  const an = (mail.an_adressen ?? []).join(', ');
  const anhaenge = (mail.anhaenge ?? []).filter((a) => a && typeof a.name === 'string' && a.name.trim());
  const postfach = POSTFACH_INFO[mail.postfach]?.kurz ?? mail.postfach;
  const datum = datumUhrzeit(mail.gesendet_am);
  const richtung = ein ? 'Eingegangen' : 'Gesendet';
  const klasse = `web-mail web-mail--${ein ? 'ein' : 'aus'}${kopf === 'voll' ? ' web-mail--voll' : ''}`;

  return (
    <article className={klasse} aria-label={`${richtung} am ${datum}`}>
      {kopf === 'voll' ? (
        <>
          <dl className="web-mail__kopfdaten">
            <div><dt>Von</dt><dd><AbsenderAnzeige name={mail.von_name} adresse={mail.von_adresse} /></dd></div>
            <div><dt>An</dt><dd>{an || <span className="web-gedaempft">–</span>}</dd></div>
            <div><dt>Datum</dt><dd><time dateTime={mail.gesendet_am}>{datum}</time></dd></div>
            <div>
              <dt>Postfach</dt>
              <dd>
                <WebPill postfach>{postfach}</WebPill>
                {' '}<span className="web-mail__richtung">{richtung}</span>
                {neu && <>{' '}<WebPill ton="fehler">Neu</WebPill></>}
              </dd>
            </div>
          </dl>
        </>
      ) : (
        <>
          <header className="web-mail__kopf">
            <span className="web-mail__richtung">
              <IonIcon icon={ein ? ICON_MAIL : ICON_SENDEN} aria-hidden="true" />
              {richtung}
            </span>
            <span className="web-mail__absender"><AbsenderAnzeige name={mail.von_name} adresse={mail.von_adresse} /></span>
            <span className="web-mail__meta">
              <WebPill postfach>{postfach}</WebPill>
              {neu && <WebPill ton="fehler">Neu</WebPill>}
              <time dateTime={mail.gesendet_am} className="web-zelle-leise">{datum}</time>
            </span>
          </header>
          {an && <p className="web-mail__an">An: {an}</p>}
          {mail.betreff && <h3 className="web-mail__betreff">{mail.betreff}</h3>}
        </>
      )}
      <div className="web-mail__text"><WebMailText text={mail.text} /></div>
      {anhaenge.length > 0 && (
        <ul className="web-mail__anhaenge" aria-label="Anhänge">
          {anhaenge.map((a, i) => (
            <li key={`${a.name}-${i}`} className="web-mail__anhang">
              <IonIcon icon={ICON_ANHANG} aria-hidden="true" />
              {a.name}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
};

export interface WebMailVerlaufProps {
  mails: ReadonlyArray<MailNachricht>;
  neu?: ReadonlySet<number>;
  leer?: string;
  /** Name der Liste fuer Vorleseprogramme. */
  beschriftung?: string;
}

/** Der Verlauf: alle Mails, aelteste zuerst (die Liste kommt schon sortiert). */
export const WebMailVerlauf: React.FC<WebMailVerlaufProps> = ({ mails, neu, leer = 'Noch keine Mails.', beschriftung = 'Schriftwechsel' }) => (
  mails.length === 0
    ? <p className="web-gedaempft">{leer}</p>
    : (
      <ol className="web-mails" aria-label={beschriftung}>
        {mails.map((m) => <li key={m.id}><WebMailEintrag mail={m} neu={neu?.has(m.id) ?? false} /></li>)}
      </ol>
    )
);

export default WebMailVerlauf;
