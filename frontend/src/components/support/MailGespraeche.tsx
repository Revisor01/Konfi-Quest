// Mails als Gespräche -- ein Baustein für App und Web (Simon, 11.10.2026:
// „Ordentliche eingeklappte Ansichten. Keine Striche davor. In grün oder so.
// Konversationsbäume ordentlich. Mach es einmal richtig sauber.").
//
// Jedes Gespräch ist eine Karte; darin steht jede Mail als Zeile mit Kreis
// (Anfangsbuchstaben), Absender, Zeit und einer Zeile Vorschau. Antippen
// klappt sie auf: Empfänger, Text, eingeklappte Zitate und Signatur,
// Anhänge. Aufgeklappt sind beim Öffnen die jüngste Mail und alle, die
// ungelesen waren. Antworten stehen eingerückt unter der Mail, auf die sie
// antworten. Was der Support gesendet hat, trägt einen grünen Kreis und das
// Wort „Gesendet" -- Farbe nie allein.
//
// Die Regeln (Baum, Signatur, Vorschau) stehen rein in utils/mailGespraeche.ts.

import React, { useId, useMemo, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_ANHANG, ICON_AUFKLAPPEN, ICON_ZUKLAPPEN } from '../shared/icons';
import type { MailNachricht } from '../../types/support';
import { POSTFACH_INFO } from '../../utils/supportMail';
import { datumUhrzeit } from '../../utils/dateUtils';
import {
  anfangsOffen,
  betreffKern,
  gespraecheBilden,
  initialen,
  mailAbsender,
  mailTextZerlegen,
  mailVorschau,
  mailZeit,
} from '../../utils/mailGespraeche';
import './MailGespraeche.css';

/** Ein eingeklappter Abschnitt im Text: Zitat oder Signatur. */
const Einklappbar: React.FC<{ zu: string; auf: string; text: string; art: 'zitat' | 'signatur' }> = ({ zu, auf, text, art }) => {
  const [offen, setOffen] = useState(false);
  const id = useId();
  return (
    <div className="mail-einklappbar">
      <button type="button" className="mail-einklappbar__knopf" aria-expanded={offen} aria-controls={id} onClick={() => setOffen((o) => !o)}>
        <IonIcon icon={offen ? ICON_ZUKLAPPEN : ICON_AUFKLAPPEN} aria-hidden="true" />
        {offen ? auf : zu}
      </button>
      {offen && <div id={id} className={`mail-einklappbar__text mail-einklappbar__text--${art}`}>{text}</div>}
    </div>
  );
};

/** Der Text einer Mail: eigener Text, Zitate und Signatur eingeklappt. */
export const MailInhalt: React.FC<{ text: string | null }> = ({ text }) => {
  const { teile, signatur } = useMemo(() => mailTextZerlegen(text), [text]);
  if (teile.length === 0 && !signatur) return <p className="mail-text mail-text--leer">Ohne Text</p>;
  return (
    <>
      {teile.map((t, i) => (t.zitat
        ? <Einklappbar key={i} art="zitat" zu="Zitat einblenden" auf="Zitat ausblenden" text={t.text} />
        : <p key={i} className="mail-text">{t.text}</p>))}
      {signatur && <Einklappbar art="signatur" zu="Signatur einblenden" auf="Signatur ausblenden" text={signatur} />}
    </>
  );
};

const Kreis: React.FC<{ ausgehend: boolean; text: string }> = ({ ausgehend, text }) => (
  <span className={`mail-kreis${ausgehend ? ' mail-kreis--aus' : ''}`} aria-hidden="true">{text}</span>
);

interface MailZeileProps {
  mail: MailNachricht;
  tiefe: number;
  offen: boolean;
  neu: boolean;
  /** Betreff des Gesprächs: steht er schon darüber, wiederholt die Mail ihn nicht. */
  gespraechBetreff: string;
  onUmschalten: () => void;
}

const MailZeile: React.FC<MailZeileProps> = ({ mail, tiefe, offen, neu, gespraechBetreff, onUmschalten }) => {
  const inhaltId = useId();
  const aus = mail.richtung === 'aus';
  const absender = mailAbsender(mail);
  const an = (mail.an_adressen ?? []).join(', ');
  const postfach = POSTFACH_INFO[mail.postfach]?.kurz ?? mail.postfach;
  const anhaenge = (mail.anhaenge ?? []).filter((a) => a && typeof a.name === 'string' && a.name.trim());
  const eigenerBetreff = mail.betreff && betreffKern(mail.betreff) !== gespraechBetreff ? mail.betreff : null;
  const vorschau = mailVorschau(mail.text);

  return (
    <li className={`mail-zeile mail-zeile--tiefe-${tiefe}${offen ? ' mail-zeile--offen' : ''}`}>
      <button
        type="button"
        className="mail-zeile__kopf"
        aria-expanded={offen}
        aria-controls={inhaltId}
        onClick={onUmschalten}
      >
        <Kreis ausgehend={aus} text={initialen(aus ? mail.verfasst_von_name ?? mail.von_name : mail.von_name, mail.von_adresse)} />
        <span className="mail-zeile__mitte">
          <span className="mail-zeile__oben">
            <span className={`mail-zeile__absender${neu ? ' mail-zeile__absender--neu' : ''}`}>{absender}</span>
            {aus && <span className="mail-marke mail-marke--gesendet">Gesendet</span>}
            {neu && <span className="mail-marke mail-marke--neu">Neu</span>}
            <time className="mail-zeile__zeit" dateTime={mail.gesendet_am} title={datumUhrzeit(mail.gesendet_am)}>
              {mailZeit(mail.gesendet_am)}
            </time>
          </span>
          {offen ? (
            <span className="mail-zeile__unten">
              {an ? `An ${an}` : 'Ohne Empfänger'}{aus ? ` · von ${postfach}` : ''}
            </span>
          ) : (
            <span className="mail-zeile__unten mail-zeile__vorschau">
              {anhaenge.length > 0 && <IonIcon icon={ICON_ANHANG} aria-label="mit Anhang" />}
              {vorschau || 'Ohne Text'}
            </span>
          )}
        </span>
      </button>
      {offen && (
        <div id={inhaltId} className="mail-zeile__inhalt">
          {eigenerBetreff && <p className="mail-zeile__betreff">{eigenerBetreff}</p>}
          <MailInhalt text={mail.text} />
          {anhaenge.length > 0 && (
            <ul className="mail-anhaenge" aria-label="Anhänge">
              {anhaenge.map((a, i) => (
                <li key={`${a.name}-${i}`} className="mail-anhang">
                  <IonIcon icon={ICON_ANHANG} aria-hidden="true" />
                  {a.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
};

/** Text, der vor den Mails steht -- etwa die Nachricht aus einem Formular. */
export interface MailAnfang {
  /** Wo er herkommt: „Support-Formular", „Anfrage". */
  marke: string;
  name: string | null;
  adresse: string | null;
  datum: string;
  text: string;
}

export interface MailGespraecheProps {
  mails: readonly MailNachricht[];
  /** Beim Öffnen ungelesen: aufgeklappt und mit „Neu". */
  neu?: ReadonlySet<number>;
  anfang?: MailAnfang | null;
  leer?: string;
  /** Name für Vorleseprogramme. */
  beschriftung?: string;
}

const MailGespraeche: React.FC<MailGespraecheProps> = ({ mails, neu, anfang = null, leer = 'Noch keine Mails.', beschriftung = 'Verlauf' }) => {
  const gespraeche = useMemo(() => gespraecheBilden(mails), [mails]);
  const [offen, setOffen] = useState<Set<number>>(() => anfangsOffen(mails, neu));

  // Kommt eine Mail dazu (Antwort gesendet, neue Mail abgeholt), steht sie
  // offen da -- nachgezogen beim Rendern, nicht in einem Effekt.
  const kennungen = mails.map((m) => m.id).join(',');
  const [gesehen, setGesehen] = useState(kennungen);
  if (kennungen !== gesehen) {
    setGesehen(kennungen);
    const dazu = [...anfangsOffen(mails, neu)].filter((id) => !offen.has(id));
    if (dazu.length > 0) setOffen(new Set([...offen, ...dazu]));
  }

  const umschalten = (id: number) => setOffen((alt) => {
    const neuOffen = new Set(alt);
    if (neuOffen.has(id)) neuOffen.delete(id); else neuOffen.add(id);
    return neuOffen;
  });
  const alleOffen = mails.length > 0 && mails.every((m) => offen.has(m.id));

  if (mails.length === 0 && !anfang) return <p className="mail-leer">{leer}</p>;

  return (
    <div className="mail-gespraeche" role="region" aria-label={beschriftung}>
      {mails.length > 1 && (
        <div className="mail-gespraeche__leiste">
          <span>{mails.length} Mails{gespraeche.length > 1 ? ` in ${gespraeche.length} Gesprächen` : ''}</span>
          <button
            type="button"
            className="mail-einklappbar__knopf"
            onClick={() => setOffen(alleOffen ? anfangsOffen([]) : new Set(mails.map((m) => m.id)))}
          >
            <IonIcon icon={alleOffen ? ICON_ZUKLAPPEN : ICON_AUFKLAPPEN} aria-hidden="true" />
            {alleOffen ? 'Alle einklappen' : 'Alle aufklappen'}
          </button>
        </div>
      )}

      {anfang && (
        <section className="mail-gespraech" aria-label={anfang.marke}>
          <div className="mail-gespraech__kopf">
            <span className="mail-gespraech__betreff">{anfang.marke}</span>
          </div>
          <div className="mail-zeile mail-zeile--offen">
            <div className="mail-zeile__kopf mail-zeile__kopf--fest">
              <Kreis ausgehend={false} text={initialen(anfang.name, anfang.adresse)} />
              <span className="mail-zeile__mitte">
                <span className="mail-zeile__oben">
                  <span className="mail-zeile__absender">{anfang.name || anfang.adresse || 'Unbekannt'}</span>
                  <time className="mail-zeile__zeit" dateTime={anfang.datum} title={datumUhrzeit(anfang.datum)}>
                    {mailZeit(anfang.datum)}
                  </time>
                </span>
                {anfang.name && anfang.adresse && <span className="mail-zeile__unten">{anfang.adresse}</span>}
              </span>
            </div>
            <div className="mail-zeile__inhalt">
              <p className="mail-text">{anfang.text}</p>
            </div>
          </div>
        </section>
      )}

      {gespraeche.map((g) => (
        <section key={g.schluessel} className="mail-gespraech" aria-label={g.betreff || '(ohne Betreff)'}>
          <div className="mail-gespraech__kopf">
            <span className="mail-gespraech__betreff">{g.betreff || '(ohne Betreff)'}</span>
            {g.mails.length > 1 && <span className="mail-gespraech__zahl">{g.mails.length}</span>}
          </div>
          <ol className="mail-gespraech__liste">
            {g.mails.map(({ mail, tiefe }) => (
              <MailZeile
                key={mail.id}
                mail={mail}
                tiefe={tiefe}
                offen={offen.has(mail.id)}
                neu={neu?.has(mail.id) ?? false}
                gespraechBetreff={g.betreff}
                onUmschalten={() => umschalten(mail.id)}
              />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
};

export default MailGespraeche;
