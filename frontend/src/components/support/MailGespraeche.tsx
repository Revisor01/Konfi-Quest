// Der Verlauf eines Vorgangs bzw. der Faden einer Mail -- ein Baustein für App
// und Web (Simon, 11.10.2026, Frage 2 in docs/planung/support-detailseiten.md:
// „Verlauf überall flach, Ältestes oben, Gelesenes einzeilig, ab drei als
// ‚N frühere Mails', auch im Posteingang" -- ja).
//
// Flach, das Älteste oben, keine Treppe:
//   - der Anfang (Formular bzw. Anfrage) mit seiner Marke, offen, bis der
//     Support antwortet, danach zwei Zeilen mit „ganz lesen";
//   - jede Mail eine Zeile in voller Breite mit Kreis, Absender, Zeit und einer
//     Zeile Vorschau; offen sind die jüngste und jede neue;
//   - ab drei eingeklappten Mails in Folge ein Stapel „N frühere Mails";
//     Neues wird nie gestapelt, „Alle aufklappen" öffnet auch den Stapel;
//   - ausgehende Mails heißen „Support" mit dem grünen Kreis KQ und dem Konto
//     klein daneben, dazu das Wort „Gesendet" -- Farbe nie allein;
//   - kein Gesprächstitel: Weicht der Kern des Betreffs einer Mail vom Titel
//     ab, steht „Betreff: …" darin; antwortet sie nicht auf die direkt davor,
//     „Antwort auf {Name}, {Zeit}".
// An jeder offenen Mail ein Menü (···): die Aktionen der Seite (im Vorgang
// Verschieben und Herauslösen, im Posteingang keine) und „Kopfzeilen zeigen".
// `hervorheben` (?mail=) klappt eine Mail auf, rollt sie in den Blick und
// markiert sie zwei Sekunden. `nachJuengster` steht direkt unter der jüngsten
// Mail -- dort gehört die Antwort hin.
//
// Die Regeln (Reihe, Stapel, offen, Absender) stehen rein in
// utils/mailGespraeche.ts (verlaufReihe), die Texte in seiten/supportDetail.ts.

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_ANHANG, ICON_AUFKLAPPEN, ICON_MEHR, ICON_ZUKLAPPEN } from '../shared/icons';
import type { MailNachricht } from '../../types/support';
import { POSTFACH_INFO } from '../../utils/supportMail';
import { datumUhrzeit } from '../../utils/dateUtils';
import {
  initialen,
  mailTextZerlegen,
  mailVorschau,
  mailZeit,
  verlaufReihe,
  verlaufZaehler,
  type VerlaufAnfang,
  type VerlaufEintrag,
} from '../../utils/mailGespraeche';
import { MAIL_MENUE, VERLAUF_TEXT } from '../../seiten/supportDetail';
import './MailGespraeche.css';

/** Wie lange eine hervorgehobene Mail markiert bleibt. */
export const HERVORHEBEN_MS = 2000;

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
  if (teile.length === 0 && !signatur) return <p className="mail-text mail-text--leer">{VERLAUF_TEXT.ohneText}</p>;
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

/** Der Anfang eines Vorgangs: das Formular bzw. die Anfrage, vor der ersten Mail. */
export type MailAnfang = VerlaufAnfang;

/** Ein Punkt im Menü (···) einer Mail. */
export interface MailMenuePunkt {
  schluessel: string;
  label: string;
  onKlick: () => void;
}

/**
 * Das Menü (···) an einer offenen Mail: ein Knopf, darunter die Punkte. Escape
 * schließt es und gibt den Fokus an den Knopf zurück; die Pfeiltasten wandern
 * durch die Punkte; ein Klick daneben schließt es.
 */
const MailMenue: React.FC<{ beschriftung: string; punkte: readonly MailMenuePunkt[] }> = ({ beschriftung, punkte }) => {
  const [offen, setOffen] = useState(false);
  const rahmen = useRef<HTMLDivElement>(null);
  const knopf = useRef<HTMLButtonElement>(null);
  const liste = useRef<HTMLUListElement>(null);
  const id = useId();

  useEffect(() => {
    if (!offen) return undefined;
    liste.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const daneben = (e: MouseEvent) => {
      if (!rahmen.current?.contains(e.target as Node)) setOffen(false);
    };
    document.addEventListener('mousedown', daneben);
    return () => document.removeEventListener('mousedown', daneben);
  }, [offen]);

  const taste = (e: React.KeyboardEvent<HTMLUListElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOffen(false);
      knopf.current?.focus();
      return;
    }
    if (e.key === 'Tab') {
      setOffen(false);
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const eintraege = [...(liste.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
    const jetzt = eintraege.indexOf(document.activeElement as HTMLButtonElement);
    const ziel = (jetzt + (e.key === 'ArrowDown' ? 1 : -1) + eintraege.length) % eintraege.length;
    eintraege[ziel]?.focus();
  };

  return (
    <div ref={rahmen} className="mail-menue">
      <button
        ref={knopf}
        type="button"
        className="mail-menue__knopf app-beruehrungsziel"
        aria-label={beschriftung}
        title={beschriftung}
        aria-haspopup="menu"
        aria-expanded={offen}
        aria-controls={offen ? id : undefined}
        onClick={() => setOffen((o) => !o)}
      >
        <IonIcon icon={ICON_MEHR} aria-hidden="true" />
      </button>
      {offen && (
        <ul id={id} ref={liste} role="menu" aria-label={beschriftung} className="mail-menue__liste" onKeyDown={taste}>
          {punkte.map((p) => (
            <li key={p.schluessel} role="none">
              {/* Der Fokus erst auf den Menüknopf: Der Punkt verschwindet mit dem Menü, und ein Dialog,
                  den er öffnet, kehrt beim Schließen dorthin zurück, wo der Fokus beim Öffnen stand
                  (WebDialog) -- sonst auf <body>. */}
              <button type="button" role="menuitem" className="mail-menue__punkt" onClick={() => { setOffen(false); knopf.current?.focus(); p.onKlick(); }}>
                {p.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/** Die rohen Kopfzeilen einer Mail (Menü „Kopfzeilen zeigen"). */
const Kopfzeilen: React.FC<{ mail: MailNachricht }> = ({ mail }) => {
  const k = VERLAUF_TEXT.kopf;
  const zeilen: Array<[string, string]> = [
    [k.von, mail.von_name?.trim() ? `${mail.von_name.trim()} <${mail.von_adresse}>` : mail.von_adresse],
    [k.an, (mail.an_adressen ?? []).join(', ')],
    [k.betreff, mail.betreff ?? ''],
    [k.datum, datumUhrzeit(mail.gesendet_am)],
    [k.messageId, mail.message_id ?? ''],
    [k.antwortAuf, mail.in_reply_to ?? ''],
    [k.referenzen, (mail.referenzen ?? []).join(' ')],
  ];
  return (
    <dl className="mail-kopfzeilen" aria-label={VERLAUF_TEXT.kopfzeilen}>
      {zeilen.filter(([, wert]) => wert.trim() !== '').map(([label, wert]) => (
        <div key={label} className="mail-kopfzeilen__zeile">
          <dt>{label}</dt>
          <dd>{wert}</dd>
        </div>
      ))}
    </dl>
  );
};

type MailEintrag = Extract<VerlaufEintrag, { art: 'mail' }>;

interface MailZeileProps {
  eintrag: MailEintrag;
  offen: boolean;
  hervorgehoben: boolean;
  kopfzeilen: boolean;
  menue: readonly MailMenuePunkt[];
  onUmschalten: () => void;
  onKopfzeilen: () => void;
}

const MailZeile: React.FC<MailZeileProps> = ({ eintrag, offen, hervorgehoben, kopfzeilen, menue, onUmschalten, onKopfzeilen }) => {
  const inhaltId = useId();
  const { mail, ausgehend, absender, konto, kreis, neu, antwortAuf, betreffAbweichend } = eintrag;
  const an = (mail.an_adressen ?? []).join(', ');
  const postfach = POSTFACH_INFO[mail.postfach]?.kurz ?? mail.postfach;
  const anhaenge = (mail.anhaenge ?? []).filter((a) => a && typeof a.name === 'string' && a.name.trim());
  const vorschau = mailVorschau(mail.text);
  const punkte: MailMenuePunkt[] = [
    ...menue,
    { schluessel: 'kopfzeilen', label: kopfzeilen ? VERLAUF_TEXT.kopfzeilenAus : MAIL_MENUE.kopfzeilen, onKlick: onKopfzeilen },
  ];
  const klassen = ['mail-zeile', offen ? 'mail-zeile--offen' : '', hervorgehoben ? 'mail-zeile--hervorgehoben' : ''].filter(Boolean).join(' ');

  return (
    <li className={klassen} data-mail-id={mail.id}>
      <div className="mail-zeile__leiste">
        <button type="button" className="mail-zeile__kopf" aria-expanded={offen} aria-controls={inhaltId} onClick={onUmschalten}>
          <Kreis ausgehend={ausgehend} text={kreis} />
          <span className="mail-zeile__mitte">
            <span className="mail-zeile__oben">
              <span className={`mail-zeile__absender${neu ? ' mail-zeile__absender--neu' : ''}`}>{absender}</span>
              {konto && <span className="mail-zeile__konto">· {konto}</span>}
              {ausgehend && <span className="mail-marke mail-marke--gesendet">{VERLAUF_TEXT.gesendet}</span>}
              {neu && <span className="mail-marke mail-marke--neu">{VERLAUF_TEXT.markeNeu}</span>}
              <time className="mail-zeile__zeit" dateTime={mail.gesendet_am} title={datumUhrzeit(mail.gesendet_am)}>
                {mailZeit(mail.gesendet_am)}
              </time>
            </span>
            {offen ? (
              <span className="mail-zeile__unten">
                {an ? VERLAUF_TEXT.an(an) : VERLAUF_TEXT.ohneEmpfaenger}{ausgehend ? ` · ${VERLAUF_TEXT.vonPostfach(postfach)}` : ''}
              </span>
            ) : (
              <span className="mail-zeile__unten mail-zeile__vorschau">
                {anhaenge.length > 0 && <IonIcon icon={ICON_ANHANG} aria-label={VERLAUF_TEXT.mitAnhang} />}
                {vorschau || VERLAUF_TEXT.ohneText}
              </span>
            )}
          </span>
        </button>
        {offen && <MailMenue beschriftung={VERLAUF_TEXT.menue(konto ? `${absender} · ${konto}` : absender)} punkte={punkte} />}
      </div>
      {offen && (
        <div id={inhaltId} className="mail-zeile__inhalt">
          {antwortAuf && <p className="mail-zeile__bezug">{VERLAUF_TEXT.antwortAuf(antwortAuf.name, antwortAuf.zeit)}</p>}
          {betreffAbweichend && <p className="mail-zeile__betreff">{VERLAUF_TEXT.betreff(betreffAbweichend)}</p>}
          {kopfzeilen && <Kopfzeilen mail={mail} />}
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

/** Der Anfang: Formular bzw. Anfrage mit Marke; kurz zwei Zeilen und „ganz lesen". */
const AnfangZeile: React.FC<{ anfang: VerlaufAnfang; kurz: boolean; ganz: boolean; onGanz: () => void }> = ({ anfang, kurz, ganz, onGanz }) => {
  const textId = useId();
  const gekuerzt = kurz && !ganz;
  return (
    <li className={`mail-anfang${anfang.name && anfang.adresse ? '' : ' mail-anfang--einzeilig'}`}>
      <section aria-label={VERLAUF_TEXT.anfangBeschriftung[anfang.marke]}>
        <div className="mail-zeile__kopf mail-zeile__kopf--fest">
          <Kreis ausgehend={false} text={initialen(anfang.name, anfang.adresse)} />
          <span className="mail-zeile__mitte">
            <span className="mail-zeile__oben">
              <span className="mail-zeile__absender">{anfang.name || anfang.adresse || VERLAUF_TEXT.unbekannt}</span>
              <span className="mail-marke mail-marke--anfang">{anfang.marke}</span>
              <time className="mail-zeile__zeit" dateTime={anfang.datum} title={datumUhrzeit(anfang.datum)}>
                {mailZeit(anfang.datum)}
              </time>
            </span>
            {anfang.name && anfang.adresse && <span className="mail-zeile__unten">{anfang.adresse}</span>}
          </span>
        </div>
        <div className="mail-zeile__inhalt">
          <p id={textId} className={`mail-text${gekuerzt ? ' mail-text--kurz' : ''}`}>{anfang.text}</p>
          {kurz && (
            <button type="button" className="mail-einklappbar__knopf" aria-expanded={!gekuerzt} aria-controls={textId} onClick={onGanz}>
              <IonIcon icon={gekuerzt ? ICON_AUFKLAPPEN : ICON_ZUKLAPPEN} aria-hidden="true" />
              {gekuerzt ? VERLAUF_TEXT.ganzLesen : VERLAUF_TEXT.kuerzer}
            </button>
          )}
        </div>
      </section>
    </li>
  );
};

export interface MailGespraecheProps {
  mails: readonly MailNachricht[];
  /** Beim Öffnen ungelesen: aufgeklappt und mit „Neu". */
  neu?: ReadonlySet<number>;
  /** Formular bzw. Anfrage vor der ersten Mail. */
  anfang?: MailAnfang | null;
  /** Der Titel der Seite (Vorgangsbetreff bzw. Betreff der Mail): Weicht der Kern einer Mail ab, steht „Betreff: …" darin. */
  titelKern?: string | null;
  leer?: string;
  /** Name für Vorleseprogramme. */
  beschriftung?: string;
  /** Diese Mail offen, in den Blick gerollt (Mitte) und zwei Sekunden markiert -- `?mail=` der Adresse. */
  hervorheben?: number | null;
  /** Die Aktionen der Seite im Menü (···) einer Mail; „Kopfzeilen zeigen" kommt immer dazu. */
  menue?: (m: MailNachricht) => readonly MailMenuePunkt[];
  /** Direkt unter der jüngsten Mail: die Antwortzeile bzw. der Editor. */
  nachJuengster?: React.ReactNode;
}

const KEINE = new Set<number>();
const zeitVon = (m: MailNachricht): number => {
  const t = Date.parse(m.gesendet_am);
  return Number.isNaN(t) ? 0 : t;
};
/** Die jüngste Mail (bei gleicher Zeit die höhere Kennung) -- wie verlaufReihe sie bestimmt. */
const juengsteVon = (mails: readonly MailNachricht[]): number | null =>
  [...mails].sort((a, b) => zeitVon(a) - zeitVon(b) || a.id - b.id).pop()?.id ?? null;
const hinzu = <T,>(menge: ReadonlySet<T>, ...werte: T[]): Set<T> => new Set([...menge, ...werte]);
const ohne = <T,>(menge: ReadonlySet<T>, ...werte: T[]): Set<T> => new Set([...menge].filter((w) => !werte.includes(w)));

const MailGespraeche: React.FC<MailGespraecheProps> = ({
  mails, neu = KEINE, anfang = null, titelKern = null, leer = 'Noch keine Mails.', beschriftung = 'Verlauf', hervorheben = null, menue,
  nachJuengster,
}) => {
  // Was die Person selbst auf- und zugeklappt hat; der Rest folgt den Regeln (verlaufReihe).
  const [offen, setOffen] = useState<ReadonlySet<number>>(KEINE);
  const [zu, setZu] = useState<ReadonlySet<number>>(KEINE);
  const [stapelOffen, setStapelOffen] = useState<ReadonlySet<string>>(new Set());
  const [alleOffen, setAlleOffen] = useState(false);
  const [anfangGanz, setAnfangGanz] = useState(false);
  const [kopfzeilen, setKopfzeilen] = useState<ReadonlySet<number>>(KEINE);
  const [markiert, setMarkiert] = useState<number | null>(null);
  const rahmen = useRef<HTMLDivElement>(null);

  // Kommt eine Mail dazu (Antwort gesendet, neue Mail abgeholt), steht sie
  // offen da; was eben noch als jüngste offen war, bleibt offen --
  // nachgezogen beim Rendern, nicht in einem Effekt.
  const kennungen = mails.map((m) => m.id).join(',');
  const [gesehen, setGesehen] = useState(() => ({ kennungen, juengste: juengsteVon(mails) }));
  if (kennungen !== gesehen.kennungen) {
    const vorher = gesehen.kennungen ? gesehen.kennungen.split(',').map(Number) : [];
    setGesehen({ kennungen, juengste: juengsteVon(mails) });
    // Kamen die Mails eben erst (vorher keine), gilt das Bild beim Öffnen.
    if (vorher.length > 0) {
      const dazu = mails.map((m) => m.id).filter((id) => !vorher.includes(id));
      setOffen((o) => hinzu(o, ...dazu, ...(gesehen.juengste !== null ? [gesehen.juengste] : [])));
    }
  }

  // ?mail=: aufklappen und markieren, sobald die Mail da ist. Fällt der
  // Wunsch weg (die Seite wird verlassen), greift derselbe beim nächsten Mal
  // wieder -- Ionic hält die Seite im Speicher.
  const [hervorGesetzt, setHervorGesetzt] = useState<number | null>(null);
  if (hervorheben === null && hervorGesetzt !== null) {
    setHervorGesetzt(null);
    setMarkiert(null);
  }
  if (hervorheben !== null && hervorheben !== hervorGesetzt && mails.some((m) => m.id === hervorheben)) {
    setHervorGesetzt(hervorheben);
    setOffen((o) => hinzu(o, hervorheben));
    setZu((z) => ohne(z, hervorheben));
    setMarkiert(hervorheben);
  }
  useEffect(() => {
    if (markiert === null) return undefined;
    rahmen.current?.querySelector(`[data-mail-id="${markiert}"]`)?.scrollIntoView?.({ block: 'center' });
    const uhr = setTimeout(() => setMarkiert(null), HERVORHEBEN_MS);
    return () => clearTimeout(uhr);
  }, [markiert]);

  const reihe = useMemo(
    () => verlaufReihe(mails, anfang, neu, { offen, stapelOffen, titelKern, alleOffen }),
    [mails, anfang, neu, offen, stapelOffen, titelKern, alleOffen],
  );
  const istOffen = (e: MailEintrag) => e.offen && !zu.has(e.mail.id);

  const umschalten = (e: MailEintrag) => {
    const id = e.mail.id;
    if (istOffen(e)) {
      setZu((z) => hinzu(z, id));
      setOffen((o) => ohne(o, id));
    } else {
      setZu((z) => ohne(z, id));
      setOffen((o) => hinzu(o, id));
    }
  };
  const alleUmschalten = () => {
    if (alleOffen) {
      // Zurück zum Bild beim Öffnen: die jüngste und die neuen offen.
      setAlleOffen(false);
      setOffen(KEINE);
      setStapelOffen(new Set());
      setAnfangGanz(false);
    } else {
      setAlleOffen(true);
    }
    setZu(KEINE);
  };

  if (mails.length === 0 && !anfang) {
    return (
      <>
        <p className="mail-leer">{leer}</p>
        {nachJuengster}
      </>
    );
  }

  const juengsterSchluessel = [...reihe].reverse().find((e) => e.art === 'mail' || e.art === 'anfang')?.schluessel ?? null;
  const zeilen = mails.length + (anfang ? 1 : 0);

  return (
    <div ref={rahmen} className="mail-gespraeche" role="region" aria-label={beschriftung}>
      {zeilen > 1 && (
        <div className="mail-gespraeche__leiste">
          <span>{verlaufZaehler(mails, neu, !!anfang)}</span>
          <button type="button" className="mail-einklappbar__knopf" onClick={alleUmschalten}>
            <IonIcon icon={alleOffen ? ICON_ZUKLAPPEN : ICON_AUFKLAPPEN} aria-hidden="true" />
            {alleOffen ? VERLAUF_TEXT.alleZu : VERLAUF_TEXT.alleAuf}
          </button>
        </div>
      )}
      <ol className="mail-verlauf">
        {reihe.map((e) => {
          let zeile: React.ReactNode;
          if (e.art === 'anfang') {
            zeile = <AnfangZeile key={e.schluessel} anfang={e.anfang} kurz={e.kurz} ganz={anfangGanz || alleOffen} onGanz={() => setAnfangGanz((g) => !g)} />;
          } else if (e.art === 'stapel') {
            zeile = (
              <li key={e.schluessel} className="mail-stapel">
                <button type="button" className="mail-stapel__knopf" aria-expanded={false} onClick={() => setStapelOffen((s) => hinzu(s, e.schluessel))}>
                  <span className="mail-stapel__punkte" aria-hidden="true">···</span>
                  <span className="mail-stapel__text">
                    {[VERLAUF_TEXT.stapel(e.anzahl), e.absender.join(', '), e.anhaenge > 0 ? VERLAUF_TEXT.anhaenge(e.anhaenge) : null].filter(Boolean).join(' · ')}
                  </span>
                </button>
              </li>
            );
          } else {
            zeile = (
              <MailZeile
                key={e.schluessel}
                eintrag={e}
                offen={istOffen(e)}
                hervorgehoben={markiert === e.mail.id}
                kopfzeilen={kopfzeilen.has(e.mail.id)}
                menue={menue?.(e.mail) ?? []}
                onUmschalten={() => umschalten(e)}
                onKopfzeilen={() => setKopfzeilen((k) => (k.has(e.mail.id) ? ohne(k, e.mail.id) : hinzu(k, e.mail.id)))}
              />
            );
          }
          if (nachJuengster && e.schluessel === juengsterSchluessel) {
            return (
              <React.Fragment key={e.schluessel}>
                {zeile}
                <li className="mail-verlauf__nachher">{nachJuengster}</li>
              </React.Fragment>
            );
          }
          return zeile;
        })}
      </ol>
    </div>
  );
};

export default MailGespraeche;
