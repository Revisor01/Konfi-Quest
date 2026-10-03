// Gemeinsame Teile der Support-Mail (03.10.2026, docs/planung/support-mail.md):
// eine Mail im Verlauf (ein- und ausgehend unterscheidbar, Zitate
// eingeklappt, Anhaenge nur als Namen), der Verlauf als Liste und das
// Antwortformular mit Textbausteinen, Platzhaltern, Vorschau samt Fusszeile
// und Rueckfrage vor dem Senden. Posteingang, Anfrage und Schriftwechsel
// einer Gemeinde nutzen dieselben Teile -- sonst liefen drei Abschriften
// auseinander. Die Regeln dahinter stehen rein in utils/supportMail.ts.

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  useIonAlert,
} from '@ionic/react';
import {
  ICON_ANHANG,
  ICON_AUFKLAPPEN,
  ICON_HINZUFUEGEN,
  ICON_INFO,
  ICON_MAIL,
  ICON_SENDEN,
  ICON_SENDEN_GEFUELLT,
  ICON_WARNHINWEIS,
  ICON_ZUKLAPPEN,
} from '../shared/icons';
import { useApp } from '../../contexts/AppContext';
import api from '../../services/api';
import type {
  MailAntwortDaten,
  MailBaustein,
  MailEinstellungen,
  MailEmpfaenger,
  MailNachricht,
  MailPostfachStatus,
  Platzhalter,
  Postfach,
} from '../../types/support';
import {
  POSTFACH_INFO,
  SERVER_AUS_HINWEIS,
  absenderText,
  antwortFehler,
  antwortKoerper,
  aufDiesemServer,
  bausteinEinfuegen,
  bausteineFuer,
  empfaengerText,
  sendeProblem,
  vorschauText,
  zitateTrennen,
  type AntwortEntwurf,
  type SendeProblem,
} from '../../utils/supportMail';
import { datumUhrzeit } from '../../utils/dateUtils';
import { fehlerDaten, fehlerStatus, fehlerText } from '../../utils/fehler';
import { offlineBlockiert } from '../../utils/offlineAktion';
import { Feld, Marke } from './SupportBausteine';

// --- Eine Mail ------------------------------------------------------------------

/** Zitat als eingeklappter Block mit Knopf zum Aufklappen. */
const Zitat: React.FC<{ text: string }> = ({ text }) => {
  const [offen, setOffen] = useState(false);
  const id = useId();
  return (
    <div style={{ margin: 'var(--app-abstand-eng) 0' }}>
      <button
        type="button"
        aria-expanded={offen}
        aria-controls={id}
        onClick={() => setOffen((o) => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 'var(--app-abstand-mini)',
          background: 'transparent', border: 'none', padding: 'var(--app-abstand-winzig) 0',
          color: 'var(--app-text-system)', fontSize: 'var(--app-text-meta)', cursor: 'pointer',
        }}
      >
        <IonIcon icon={offen ? ICON_ZUKLAPPEN : ICON_AUFKLAPPEN} aria-hidden="true" />
        {offen ? 'Zitat ausblenden' : 'Zitat einblenden'}
      </button>
      {offen && (
        <div
          id={id}
          style={{
            whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: 'var(--app-text-system)',
            borderLeft: '2px solid var(--app-border-strong)', paddingLeft: 'var(--app-abstand-kompakt)',
            fontSize: 'var(--app-text-sekundaer)',
          }}
        >
          {text}
        </div>
      )}
    </div>
  );
};

/** Der Text einer Mail: eigener Text sichtbar, Zitate eingeklappt. */
export const MailText: React.FC<{ text: string | null }> = ({ text }) => {
  const teile = useMemo(() => zitateTrennen(text), [text]);
  if (teile.length === 0) {
    return <p style={{ margin: 0, color: 'var(--app-text-system)', fontStyle: 'italic' }}>Ohne Text</p>;
  }
  return (
    <>
      {teile.map((t, i) => (t.zitat
        ? <Zitat key={i} text={t.text} />
        : (
          <p key={i} style={{ margin: 'var(--app-abstand-eng) 0', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: 'var(--app-text-body)' }}>
            {t.text}
          </p>
        )))}
    </>
  );
};

/**
 * Eine Mail im Verlauf. Eingehende stehen links mit blauer Kante,
 * ausgehende eingerueckt mit gruener -- und beide sagen es in Worten
 * („Eingegangen" / „Gesendet"), nicht nur in Farbe.
 */
export const MailEintrag: React.FC<{ mail: MailNachricht; neu?: boolean }> = ({ mail, neu = false }) => {
  const ein = mail.richtung === 'ein';
  const an = (mail.an_adressen ?? []).join(', ');
  const anhaenge = (mail.anhaenge ?? []).filter((a) => a && typeof a.name === 'string' && a.name.trim());
  return (
    <article
      className={`app-list-item app-list-item--${ein ? 'info' : 'success'}`}
      aria-label={`${ein ? 'Eingegangen' : 'Gesendet'} am ${datumUhrzeit(mail.gesendet_am)}`}
      style={{ marginLeft: ein ? 0 : 'var(--app-abstand-weit)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--app-abstand-eng)', flexWrap: 'wrap' }}>
        <IonIcon icon={ein ? ICON_MAIL : ICON_SENDEN} aria-hidden="true"
          style={{ color: ein ? 'var(--app-color-info)' : 'var(--app-color-success)', fontSize: 'var(--app-text-standard)' }} />
        <span style={{ fontWeight: 'var(--app-schrift-halbfett)', color: 'var(--app-text-emphasis)' }}>
          {ein ? 'Eingegangen' : 'Gesendet'}
        </span>
        <span style={{ color: 'var(--app-text-system)', fontSize: 'var(--app-text-meta)' }}>{datumUhrzeit(mail.gesendet_am)}</span>
        <Marke text={POSTFACH_INFO[mail.postfach]?.kurz ?? mail.postfach} farbe="var(--app-color-neutral)" />
        {neu && <Marke text="Neu" farbe="var(--app-color-danger)" />}
      </div>
      <div style={{ fontSize: 'var(--app-text-meta)', color: 'var(--app-text-system)', marginTop: 'var(--app-abstand-mini)', overflowWrap: 'anywhere' }}>
        Von: {absenderText(mail)}{an ? ` · An: ${an}` : ''}
      </div>
      {mail.betreff && (
        <div style={{ fontWeight: 'var(--app-schrift-halbfett)', color: 'var(--app-text-emphasis)', marginTop: 'var(--app-abstand-eng)', overflowWrap: 'anywhere' }}>
          {mail.betreff}
        </div>
      )}
      <MailText text={mail.text} />
      {anhaenge.length > 0 && (
        <ul aria-label="Anhänge" style={{ listStyle: 'none', margin: 'var(--app-abstand-eng) 0 0', padding: 0 }}>
          {anhaenge.map((a, i) => (
            <li key={`${a.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 'var(--app-abstand-mini)', fontSize: 'var(--app-text-meta)', color: 'var(--app-text-system)' }}>
              <IonIcon icon={ICON_ANHANG} aria-hidden="true" />
              {a.name}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
};

/** Der Verlauf: alle Mails, aelteste zuerst (die Liste kommt schon sortiert). */
export const MailListe: React.FC<{ mails: MailNachricht[]; neu?: ReadonlySet<number>; leer?: string }> = ({
  mails, neu, leer = 'Noch keine Mails.',
}) => (
  mails.length === 0
    ? <p style={{ margin: 0, color: 'var(--app-text-system)' }}>{leer}</p>
    : <div>{mails.map((m) => <MailEintrag key={m.id} mail={m} neu={neu?.has(m.id) ?? false} />)}</div>
);

/** Ein Hinweis in einer Karte: Symbol, Titel, Text. Farbe nach Art. */
export const Hinweis: React.FC<{ art: 'warnung' | 'fehler' | 'hinweis'; titel: string; children?: React.ReactNode; rolle?: 'alert' | 'status' }> = ({
  art, titel, children, rolle = 'status',
}) => (
  <div
    role={rolle}
    style={{
      display: 'flex', alignItems: 'flex-start', gap: 'var(--app-abstand-eng)',
      padding: 'var(--app-abstand-schmal) var(--app-abstand-mittel)', borderRadius: 'var(--app-radius-karte)',
      background: `var(--app-flaeche-${art})`, border: `1px solid var(--app-rand-${art})`,
      color: art === 'fehler' ? 'var(--app-text-fehler)' : art === 'warnung' ? 'var(--app-text-warnung)' : 'var(--app-text-hinweis-dunkel)',
      fontSize: 'var(--app-text-sekundaer)', margin: 'var(--app-abstand-eng) 0',
    }}
  >
    <IonIcon icon={art === 'hinweis' ? ICON_INFO : ICON_WARNHINWEIS} aria-hidden="true" style={{ flexShrink: 0, marginTop: 'var(--app-abstand-haar)' }} />
    <div>
      <strong>{titel}</strong>
      {children && <div style={{ marginTop: 'var(--app-abstand-winzig)' }}>{children}</div>}
    </div>
  </div>
);

// --- Antworten ------------------------------------------------------------------

/** Texte der drei bekannten Probleme beim Senden (Vertrag und Nachtrag 03.10.2026). */
const SendeHinweis: React.FC<{ problem: SendeProblem; postfach: Postfach }> = ({ problem, postfach }) => {
  if (problem.art === 'nicht_eingerichtet') {
    return (
      <Hinweis art="fehler" rolle="alert" titel="Postfach noch nicht eingerichtet">
        Für {POSTFACH_INFO[postfach].kurz} fehlen auf dem Server noch die Zugangsdaten. Die Antwort wurde nicht
        gesendet; dein Text bleibt hier stehen.
      </Hinweis>
    );
  }
  if (problem.art === 'server_aus') {
    return (
      <Hinweis art="fehler" rolle="alert" titel="Nicht gesendet">
        {problem.text} Dein Text bleibt hier stehen.
      </Hinweis>
    );
  }
  return (
    <Hinweis art="fehler" rolle="alert" titel="Versand gescheitert">
      Der Mailserver hat die Antwort nicht angenommen; gespeichert wurde nichts. Dein Text bleibt hier
      stehen — bitte später noch einmal senden.
    </Hinweis>
  );
};

export interface AntwortFormularProps {
  /** Von welchem Postfach die Antwort geht: Bausteine dieses Postfachs, sein Zustand. */
  postfach: Postfach;
  /** Fuer GET /support/mail/platzhalter; ohne: nur {{absender}} aus den Einstellungen. */
  platzhalterFuer?: { anfrage_id: number } | { organization_id: number } | null;
  /** Vorschlag fuer den Betreff (z. B. „Re: …" der letzten Mail). */
  betreffVorschlag: string;
  /** Feste Empfaengerin, nur zur Anzeige (Anfrage, Posteingang). */
  an?: string | null;
  /** Empfaenger zur Auswahl (Gemeinde); dann ist die Wahl Pflicht. */
  empfaenger?: MailEmpfaenger[] | null;
  /** Die Empfaenger konnten nicht geladen werden. */
  empfaengerFehlt?: boolean;
  /** Schickt die Antwort; wirft beim Scheitern (axios-Fehler). */
  senden: (koerper: MailAntwortDaten) => Promise<unknown>;
  /** Nach dem Senden (Verlauf neu laden). */
  onGesendet: () => void;
}

/**
 * Antworten: Baustein waehlen und einfuegen (Platzhalter gefuellt), Betreff,
 * Text, Vorschau mit Fusszeile, Senden mit Rueckfrage. Scheitert das
 * Senden, bleibt der Entwurf stehen; 503 und 502 erklaeren sich im Formular.
 * Bedient dieser Server das Postfach nicht (auf_diesem_server: false), ist
 * Senden aus -- mit dem Grund daneben.
 */
export const AntwortFormular: React.FC<AntwortFormularProps> = ({
  postfach, platzhalterFuer = null, betreffVorschlag, an = null, empfaenger = null, empfaengerFehlt = false, senden, onGesendet,
}) => {
  const { setError, setSuccess, isOnline } = useApp();
  const [presentAlert] = useIonAlert();
  const [entwurf, setEntwurf] = useState<AntwortEntwurf>({ betreff: betreffVorschlag, text: '' });
  const [bausteine, setBausteine] = useState<MailBaustein[]>([]);
  const [einstellungen, setEinstellungen] = useState<MailEinstellungen | null>(null);
  const [status, setStatus] = useState<MailPostfachStatus | null>(null);
  const [gewaehlterBaustein, setGewaehlterBaustein] = useState('');
  const [platzhalter, setPlatzhalter] = useState<Platzhalter | null>(null);
  const [platzhalterFehlt, setPlatzhalterFehlt] = useState(false);
  const [gewaehlterEmpfaenger, setGewaehlterEmpfaenger] = useState('');
  const [sendet, setSendet] = useState(false);
  const [problem, setProblem] = useState<SendeProblem | null>(null);

  // Der Vorschlag kommt oft erst mit dem Verlauf und aendert sich nach dem
  // Senden (die Kennung im Betreff setzt der Server). Solange das Feld leer
  // ist oder noch auf dem alten Vorschlag steht, folgt es ihm -- ein
  // getippter Betreff bleibt.
  const letzterVorschlag = useRef(betreffVorschlag);
  useEffect(() => {
    const alt = letzterVorschlag.current;
    letzterVorschlag.current = betreffVorschlag;
    setEntwurf((e) => (!e.betreff.trim() || e.betreff === alt ? { ...e, betreff: betreffVorschlag } : e));
  }, [betreffVorschlag]);

  // Bausteine, Fusszeile und Zustand des Postfachs -- jedes fuer sich; was
  // fehlt, laesst das Formular trotzdem benutzbar.
  useEffect(() => {
    let aktiv = true;
    void (async () => {
      const [b, e, s] = await Promise.allSettled([
        api.get('/support/mail/bausteine'),
        api.get('/support/mail/einstellungen'),
        api.get('/support/mail/status'),
      ]);
      if (!aktiv) return;
      setBausteine(b.status === 'fulfilled' && Array.isArray(b.value.data) ? b.value.data : []);
      setEinstellungen(e.status === 'fulfilled' && e.value.data && typeof e.value.data === 'object' ? e.value.data : null);
      const liste = s.status === 'fulfilled' && Array.isArray(s.value.data?.postfaecher) ? s.value.data.postfaecher as MailPostfachStatus[] : [];
      setStatus(liste.find((p) => p.postfach === postfach) ?? null);
    })();
    return () => { aktiv = false; };
  }, [postfach]);

  const passend = useMemo(() => bausteineFuer(bausteine, postfach), [bausteine, postfach]);
  const serverAus = !aufDiesemServer(status);
  const platzhalterParams = platzhalterFuer ? JSON.stringify(platzhalterFuer) : '';

  const platzhalterHolen = useCallback(async (): Promise<Platzhalter | null> => {
    if (platzhalter) return platzhalter;
    if (!platzhalterParams) return null;
    try {
      const antwort = await api.get('/support/mail/platzhalter', { params: JSON.parse(platzhalterParams) });
      const werte = antwort.data && typeof antwort.data === 'object' ? antwort.data as Platzhalter : null;
      setPlatzhalter(werte);
      setPlatzhalterFehlt(false);
      return werte;
    } catch {
      setPlatzhalterFehlt(true);
      return null;
    }
  }, [platzhalter, platzhalterParams]);

  const einfuegen = async () => {
    const baustein = passend.find((b) => String(b.id) === gewaehlterBaustein);
    if (!baustein) return;
    const werte = await platzhalterHolen();
    const absender = werte?.absender || einstellungen?.absendername || null;
    setEntwurf((e) => bausteinEinfuegen(e, baustein, { ...(werte ?? {}), absender }, betreffVorschlag));
    setGewaehlterBaustein('');
  };

  const empfaengerNoetig = empfaenger !== null;
  // Genau ein moeglicher Empfaenger: vorgewaehlt. Mehrere: bewusst waehlen.
  const gewaehlt = gewaehlterEmpfaenger || (empfaenger && empfaenger.length === 1 ? empfaenger[0].adresse : '');
  const empfaengerAnzeige = empfaengerNoetig ? gewaehlt : an ?? '';

  const abschicken = () => {
    if (offlineBlockiert(isOnline, setError)) return;
    const meldung = antwortFehler(entwurf, empfaengerNoetig, gewaehlt);
    if (meldung) {
      setError(meldung);
      return;
    }
    const koerper = antwortKoerper(entwurf, empfaengerNoetig ? gewaehlt : null);
    presentAlert({
      header: 'Antwort senden',
      message: `${empfaengerAnzeige ? `An ${empfaengerAnzeige}` : 'An den Absender'}${koerper.betreff ? `: „${koerper.betreff}“` : ''} von ${POSTFACH_INFO[postfach].kurz} senden?`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Senden',
          handler: () => {
            void (async () => {
              setSendet(true);
              setProblem(null);
              try {
                await senden(koerper);
                setEntwurf({ betreff: betreffVorschlag, text: '' });
                setSuccess('Antwort gesendet');
                onGesendet();
              } catch (err) {
                const art = sendeProblem(fehlerStatus(err), fehlerDaten(err)?.error);
                if (art) setProblem(art);
                else setError(fehlerText(err, 'Antwort konnte nicht gesendet werden'));
              } finally {
                setSendet(false);
              }
            })();
          },
        },
      ],
    });
  };

  const vorschau = vorschauText(entwurf.text, einstellungen?.fusszeile);

  return (
    <div>
      {serverAus && (
        <Hinweis art="warnung" titel={SERVER_AUS_HINWEIS}>
          Antworten lassen sich hier nicht senden.
        </Hinweis>
      )}
      {!serverAus && status && !status.eingerichtet && (
        <Hinweis art="warnung" titel="Postfach noch nicht eingerichtet">
          Für {POSTFACH_INFO[postfach].kurz} fehlen auf dem Server noch die Zugangsdaten; eine Antwort wird erst
          gesendet, wenn sie dort stehen.
        </Hinweis>
      )}
      <IonList style={{ background: 'transparent' }}>
        {empfaengerNoetig ? (
          <IonItem lines="full" style={{ '--background': 'transparent' }}>
            <IonLabel position="stacked">Empfänger *</IonLabel>
            <IonSelect
              aria-label="Empfänger"
              aria-required="true"
              interface="popover"
              value={gewaehlt}
              placeholder="Bitte wählen"
              onIonChange={(e) => setGewaehlterEmpfaenger(String(e.detail.value ?? ''))}
            >
              <IonSelectOption value="">Bitte wählen</IonSelectOption>
              {empfaenger.map((e) => (
                <IonSelectOption key={e.adresse} value={e.adresse}>{empfaengerText(e)}</IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
        ) : an ? (
          <p style={{ margin: 'var(--app-abstand-eng) 0', color: 'var(--app-text-body)', overflowWrap: 'anywhere' }}>
            An: <strong>{an}</strong> · von {POSTFACH_INFO[postfach].kurz}
          </p>
        ) : null}
        {empfaengerNoetig && empfaengerFehlt && (
          <p role="status" style={{ margin: 'var(--app-abstand-eng) var(--app-abstand-basis)', fontSize: 'var(--app-text-meta)', color: 'var(--app-text-fehler)' }}>
            Die möglichen Empfänger konnten nicht geladen werden.
          </p>
        )}
        {empfaengerNoetig && !empfaengerFehlt && empfaenger.length === 0 && (
          <p role="status" style={{ margin: 'var(--app-abstand-eng) var(--app-abstand-basis)', fontSize: 'var(--app-text-meta)', color: 'var(--app-text-system)' }}>
            Für diese Gemeinde ist keine Adresse bekannt.
          </p>
        )}

        <IonItem lines="full" style={{ '--background': 'transparent' }}>
          <IonLabel position="stacked">Textbaustein</IonLabel>
          <IonSelect
            aria-label="Textbaustein"
            interface="popover"
            value={gewaehlterBaustein}
            disabled={passend.length === 0}
            placeholder={passend.length === 0 ? 'Keine Bausteine' : 'Baustein wählen'}
            onIonChange={(e) => setGewaehlterBaustein(String(e.detail.value ?? ''))}
          >
            <IonSelectOption value="">{passend.length === 0 ? 'Keine Bausteine' : 'Baustein wählen'}</IonSelectOption>
            {passend.map((b) => (
              <IonSelectOption key={b.id} value={String(b.id)}>{b.titel}</IonSelectOption>
            ))}
          </IonSelect>
        </IonItem>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--app-abstand-eng)' }}>
          <IonButton size="small" fill="outline" disabled={!gewaehlterBaustein} onClick={() => { void einfuegen(); }}>
            <IonIcon icon={ICON_HINZUFUEGEN} slot="start" />
            Baustein einfügen
          </IonButton>
          {platzhalterFehlt && (
            <span role="status" style={{ fontSize: 'var(--app-text-meta)', color: 'var(--app-text-fehler)' }}>
              Platzhalter konnten nicht gefüllt werden; sie stehen noch im Text.
            </span>
          )}
        </div>

        <Feld label="Betreff" wert={entwurf.betreff} onWert={(w) => setEntwurf((e) => ({ ...e, betreff: w }))}
          hinweis="Leer: Der Server setzt den Betreff. Die Kennung in eckigen Klammern ergänzt er selbst." />
        <IonItem lines="full" style={{ '--background': 'transparent' }}>
          <IonLabel position="stacked">Text der Antwort *</IonLabel>
          <IonTextarea
            aria-label="Text der Antwort"
            aria-required="true"
            value={entwurf.text}
            autoGrow={true}
            rows={6}
            onIonInput={(e) => setEntwurf((v) => ({ ...v, text: String(e.detail.value ?? '') }))}
          />
        </IonItem>
      </IonList>

      <h3 style={{ margin: 'var(--app-abstand-mittel) 0 var(--app-abstand-eng)', fontSize: 'var(--app-text-standard)', fontWeight: 'var(--app-schrift-halbfett)', color: 'var(--app-text-emphasis)' }}>
        Vorschau
      </h3>
      <div
        aria-label="Vorschau der Antwort"
        role="region"
        style={{
          whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', padding: 'var(--app-abstand-kompakt)',
          borderRadius: 'var(--app-radius-knopf)', background: 'var(--app-surface-soft)', border: '1px solid var(--app-border-soft)',
          color: vorschau.trim() ? 'var(--app-text-body)' : 'var(--app-text-system)', fontSize: 'var(--app-text-sekundaer)',
        }}
      >
        {vorschau.trim() ? vorschau : 'Noch kein Text.'}
      </div>
      {!einstellungen?.fusszeile?.trim() && (
        <p style={{ margin: 'var(--app-abstand-eng) 0 0', fontSize: 'var(--app-text-meta)', color: 'var(--app-text-system)' }}>
          Noch keine Fußzeile — sie lässt sich unter Textbausteine festlegen.
        </p>
      )}

      {problem && <SendeHinweis problem={problem} postfach={postfach} />}

      <IonButton
        expand="block"
        style={{ marginTop: 'var(--app-abstand-mittel)' }}
        onClick={abschicken}
        disabled={sendet || serverAus || !isOnline}
      >
        <IonIcon icon={ICON_SENDEN_GEFUELLT} slot="start" />
        Antwort senden
      </IonButton>
      {serverAus && (
        <p role="status" style={{ margin: 'var(--app-abstand-eng) 0 0', fontSize: 'var(--app-text-meta)', color: 'var(--app-text-system)' }}>
          Senden ist aus: {SERVER_AUS_HINWEIS}.
        </p>
      )}
    </div>
  );
};
