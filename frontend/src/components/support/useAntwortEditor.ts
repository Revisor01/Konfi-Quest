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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIonAlert } from '@ionic/react';
import { useApp } from '../../contexts/AppContext';
import api from '../../services/api';
import type {
  MailAntwortDaten,
  MailBaustein,
  MailEinstellungen,
  MailEmpfaenger,
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
  sendeProblem,
  vorschauText,
  type AntwortEntwurf,
  type SendeProblem,
} from '../../utils/supportMail';
import { fehlerDaten, fehlerStatus, fehlerText } from '../../utils/fehler';
import { offlineBlockiert } from '../../utils/offlineAktion';

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

export function useAntwortEditor({
  postfach, platzhalterFuer = null, betreffVorschlag, an = null, empfaenger = null, empfaengerFehlt = false, senden, onGesendet,
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
  };
}

export type AntwortEditor = ReturnType<typeof useAntwortEditor>;
