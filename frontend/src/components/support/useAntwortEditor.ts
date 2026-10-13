// Das Antworten der Support-Mail als Logik ohne Darstellung (03.10.2026,
// docs/planung/support-mail.md): Baustein waehlen und einfuegen (Platzhalter
// gefuellt), Betreff, Text, Vorschau mit Fusszeile, Senden mit Rueckfrage.
// Die App-Fassung (AntwortFormular in SupportMailTeile.tsx) und die
// Web-Fassung (web/WebAntwortEditor.tsx) zeigen dieselbe Logik -- sonst liefen
// zwei Abschriften auseinander. Die Regeln dahinter stehen rein in
// utils/supportMail.ts.
//
// Scheitert das Senden, bleibt der Entwurf stehen; 503 und 502 erklaeren sich
// im Formular. Bedient dieser Server das Postfach nicht (auf_diesem_server:
// false), ist Senden aus -- mit dem Grund daneben.
//
// Seit 11.10.2026 (docs/planung/support-detailseiten.md, G; Simon, Frage 3):
// „Danach" setzt nach dem Senden den Status des Vorgangs (Vorgabe „Wartet auf
// Rückmeldung"); scheitert das, kommt „Gesendet, Status nicht gesetzt." --
// nie Stille. Gibt es genau eine Adresse, steht sie als feste Zeile da
// (`feste`), sonst zur Wahl mit lesbarem Etikett (`empfaengerOptionen`).
//
// Seit 12.10.2026 (Paket 6, additiv): Der Status geht im Körper der Antwort
// mit (`status`), der Server setzt ihn in derselben Transaktion wie das
// Speichern -- ein Aufruf statt zwei. Bestätigt die Antwort des Servers ihn
// nicht (ein älterer Server übergeht das Feld), folgt wie bis dahin der PATCH.
// Im Vorgang trägt der Körper auch die angezeigte, beantwortete Mail
// (`antwort_auf`): Auf sie beziehen sich In-Reply-To und „Re:".

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIonAlert } from '@ionic/react';
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
  antwortFehler,
  antwortKoerper,
  aufDiesemServer,
  bausteinEinfuegen,
  bausteineFuer,
  empfaengerEtikett,
  empfaengerText,
  sendeProblem,
  vorschauText,
  type AntwortEntwurf,
  type SendeProblem,
} from '../../utils/supportMail';
import type { VorgangStatus } from '../../utils/supportVorgaenge';
import { DANACH_FEHLER } from '../../seiten/supportDetail';
import { fehlerDaten, fehlerStatus, fehlerText } from '../../utils/fehler';
import { offlineBlockiert } from '../../utils/offlineAktion';
import { meldeSupportGeaendert, useSupportGeaendert } from '../../utils/supportAktualisieren';

/**
 * „Danach": der Status des Vorgangs nach dem Senden. Er geht im Körper der
 * Antwort mit; `ausAntwort` liest aus der Antwort des Servers, ob er gesetzt
 * ist (und tut, was danach folgt -- Erledigt meldet den Abschluss). Sonst
 * schickt ihn `setzen` (PATCH, die Rückfallebene für ältere Server). Beide
 * melden nichts selbst -- Erfolg oder „Gesendet, Status nicht gesetzt." sagt
 * der Editor.
 */
export interface AntwortDanach {
  wahlen: readonly VorgangStatus[];
  vorgabe: VorgangStatus;
  setzen: (s: VorgangStatus) => Promise<boolean>;
  /** true: Die Antwort des Servers (Körper) bestätigt den Status `s` -- kein PATCH mehr. */
  ausAntwort?: (antwort: unknown, s: VorgangStatus) => boolean;
}

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
  /**
   * Vorgewaehlter Empfaenger, wenn er unter `empfaenger` steht: wer zuletzt
   * geschrieben hat. Ohne ihn stand bis 11.10.2026 „Bitte waehlen" da, obwohl
   * klar war, wem geantwortet wird.
   */
  empfaengerVorgabe?: string | null;
  /** Schickt die Antwort und gibt den Körper der Antwort des Servers zurück; wirft beim Scheitern (axios-Fehler). */
  senden: (koerper: MailAntwortDaten) => Promise<unknown>;
  /**
   * Nach dem Senden, falls die Seite noch etwas tun will. Verlauf, Listen und
   * rote Zahlen laden von selbst neu: Der Editor meldet "Support-Daten
   * geaendert" (utils/supportAktualisieren.ts).
   */
  onGesendet?: () => void;
  /** „Danach" (nur im Vorgang): der Status nach dem Senden. */
  danach?: AntwortDanach | null;
  /** Die Mail, auf die geantwortet wird (App-Modal: „Du antwortest auf"). */
  beantwortet?: MailNachricht | null;
  /**
   * Nur im Vorgang: die ID der beantworteten Mail für den Körper
   * (`antwort_auf`). Im Posteingang steht sie schon in der Adresse des Aufrufs.
   */
  antwortAuf?: number | null;
}

/** „Name <adresse>" bzw. nur die Adresse. */
const wer = (adresse: string, name: string | null | undefined): string => (name?.trim() ? `${name.trim()} <${adresse}>` : adresse);

/**
 * Wen der Editor vorwählt, solange niemand selbst gewählt hat: die einzige
 * Adresse, sonst die Vorgabe (wer zuletzt schrieb bzw. „Im Vorgang
 * antworten"), wenn sie zur Wahl steht -- sonst niemanden (''). Eine Regel
 * für den Editor und die Zeile, die ihn zugeklappt zeigt („Antwort an …
 * schreiben"; bis 11.10.2026 nannte sie bei mehreren Adressen die erste,
 * während der Editor „Bitte wählen" zeigte).
 */
export function vorgewaehlterEmpfaenger(empfaenger: readonly MailEmpfaenger[] | null | undefined, vorgabe: string | null | undefined): string {
  if (!empfaenger) return '';
  if (empfaenger.length === 1) return empfaenger[0].adresse;
  if (!vorgabe) return '';
  return empfaenger.find((e) => e.adresse.toLowerCase() === vorgabe.toLowerCase())?.adresse ?? '';
}

export function useAntwortEditor({
  postfach, platzhalterFuer = null, betreffVorschlag, an = null, empfaenger = null, empfaengerFehlt = false, empfaengerVorgabe = null, senden, onGesendet,
  danach = null, beantwortet = null, antwortAuf = null,
}: AntwortFormularProps) {
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
  const [gewaehltDanach, setDanachStatus] = useState<VorgangStatus | null>(null);
  const [betreffBearbeiten, setBetreffBearbeiten] = useState(false);

  // „Im Vorgang antworten" an einer Angabe setzt eine andere Vorgabe: Sie gilt,
  // auch wenn vorher jemand anderes gewählt war (nachgezogen beim Rendern).
  const [letzteVorgabe, setLetzteVorgabe] = useState(empfaengerVorgabe);
  if (empfaengerVorgabe !== letzteVorgabe) {
    setLetzteVorgabe(empfaengerVorgabe);
    setGewaehlterEmpfaenger('');
  }

  // Was „Danach" gerade sagt: die Wahl, solange sie angeboten wird, sonst die Vorgabe.
  const danachStatus: VorgangStatus | null = danach
    ? (gewaehltDanach !== null && danach.wahlen.includes(gewaehltDanach) ? gewaehltDanach : danach.vorgabe)
    : null;

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
  // fehlt, laesst das Formular trotzdem benutzbar. Aendert sich etwas an den
  // Bausteinen oder der Fusszeile (eine andere Seite), steht es hier sofort da.
  const aktiv = useRef(true);
  const rahmenHolen = useCallback(async () => {
    const [b, e, s] = await Promise.allSettled([
      api.get('/support/mail/bausteine'),
      api.get('/support/mail/einstellungen'),
      api.get('/support/mail/status'),
    ]);
    if (!aktiv.current) return;
    setBausteine(b.status === 'fulfilled' && Array.isArray(b.value.data) ? b.value.data : []);
    setEinstellungen(e.status === 'fulfilled' && e.value.data && typeof e.value.data === 'object' ? e.value.data : null);
    const liste = s.status === 'fulfilled' && Array.isArray(s.value.data?.postfaecher) ? s.value.data.postfaecher as MailPostfachStatus[] : [];
    setStatus(liste.find((p) => p.postfach === postfach) ?? null);
  }, [postfach]);
  useEffect(() => {
    aktiv.current = true;
    void rahmenHolen();
    return () => { aktiv.current = false; };
  }, [rahmenHolen]);
  useSupportGeaendert(rahmenHolen, { beimBetreten: false });

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
  // Genau ein moeglicher Empfaenger: vorgewaehlt; sonst, wer zuletzt schrieb,
  // wenn er zur Wahl steht. Sonst bewusst waehlen.
  const gewaehlt = gewaehlterEmpfaenger || vorgewaehlterEmpfaenger(empfaenger, empfaengerVorgabe);
  const empfaengerAnzeige = empfaengerNoetig ? gewaehlt : an ?? '';

  // Genau eine Adresse: eine feste Zeile „An … · von …" statt einer Wahl --
  // im Vorgang wie im Posteingang (eine Form statt zwei).
  const feste: { an: string; etikett: string | null } | null = useMemo(() => {
    if (empfaenger !== null) {
      return empfaenger.length === 1 ? { an: wer(empfaenger[0].adresse, empfaenger[0].name), etikett: empfaengerEtikett(empfaenger[0].herkunft) } : null;
    }
    if (!an) return null;
    const name = beantwortet && beantwortet.von_adresse.toLowerCase() === an.toLowerCase() ? beantwortet.von_name : null;
    return { an: wer(an, name), etikett: null };
  }, [empfaenger, an, beantwortet]);

  const empfaengerOptionen = useMemo(
    () => (empfaenger ?? []).map((e) => ({ wert: e.adresse, label: empfaengerText(e) })),
    [empfaenger],
  );

  const abschicken = () => {
    if (offlineBlockiert(isOnline, setError)) return;
    const meldung = antwortFehler(entwurf, empfaengerNoetig, gewaehlt);
    if (meldung) {
      setError(meldung);
      return;
    }
    const nachher = danach && danachStatus ? danachStatus : null;
    const koerper = antwortKoerper(entwurf, empfaengerNoetig ? gewaehlt : null, { status: nachher, antwortAuf });
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
              let antwort: unknown;
              try {
                antwort = await senden(koerper);
              } catch (err) {
                const art = sendeProblem(fehlerStatus(err), fehlerDaten(err)?.error);
                if (art) setProblem(art);
                else setError(fehlerText(err, 'Antwort konnte nicht gesendet werden'));
                setSendet(false);
                return;
              }
              // Gesendet ist gesendet: Der Entwurf geht, auch wenn „Danach" scheitert.
              setEntwurf({ betreff: betreffVorschlag, text: '' });
              setBetreffBearbeiten(false);
              setDanachStatus(null);
              let statusGesetzt = true;
              // Bestätigt der Server den Status (er ging im Körper mit), ist er gesetzt. Sonst --
              // ein älterer Server übergeht das Feld -- die Rückfallebene: PATCH wie bis 12.10.2026.
              let bestaetigt = false;
              if (danach && nachher) {
                try { bestaetigt = !!danach.ausAntwort?.(antwort, nachher); } catch { bestaetigt = false; }
              }
              if (danach && nachher && !bestaetigt) {
                try {
                  statusGesetzt = await danach.setzen(nachher);
                } catch {
                  statusGesetzt = false;
                }
              }
              if (statusGesetzt) setSuccess('Antwort gesendet');
              else setError(DANACH_FEHLER);
              setSendet(false);
              meldeSupportGeaendert();
              onGesendet?.();
            })();
          },
        },
      ],
    });
  };

  const vorschau = vorschauText(entwurf.text, einstellungen?.fusszeile);

  return {
    postfach,
    an,
    empfaenger,
    empfaengerFehlt,
    empfaengerNoetig,
    gewaehlt,
    setGewaehlterEmpfaenger,
    entwurf,
    setEntwurf,
    passend,
    gewaehlterBaustein,
    setGewaehlterBaustein,
    einfuegen,
    platzhalterFehlt,
    einstellungen,
    status,
    serverAus,
    vorschau,
    problem,
    sendet,
    abschicken,
    isOnline,
    /** „Danach": die Wahlen (leer ohne Vorgang), der gewählte Status und das Wählen. */
    danachWahlen: danach?.wahlen ?? [],
    danachStatus,
    setDanachStatus,
    /** Genau eine mögliche Adresse: „Name <adresse>" und das Etikett ihrer Herkunft. */
    feste,
    /** Die Wahl der Empfänger: Adresse und „Name <adresse> · Etikett" (ohne „Bitte wählen"). */
    empfaengerOptionen,
    beantwortet,
    /** Der Betreff steht als Text mit „Ändern"; erst beim Bearbeiten wird er ein Feld. */
    betreffBearbeiten,
    setBetreffBearbeiten,
  };
}

export type AntwortEditor = ReturnType<typeof useAntwortEditor>;
