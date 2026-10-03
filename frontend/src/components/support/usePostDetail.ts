// Eine Mail aus dem Posteingang als Logik ohne Darstellung
// (/admin/support/post/:id, Support-Mail, 03.10.2026): die Mail mit ihrem
// ganzen Faden laden (ungelesene eingehende als gelesen melden), Anfragen und
// Gemeinden zur Auswahl holen und die Mail zuordnen -- zu einer Anfrage, zu
// einer Gemeinde oder zurueck in den Posteingang. Die App-Fassung
// (SupportPostDetailPage) und die Web-Fassung (web/WebPostDetail) zeigen
// dieselbe Logik.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import api from '../../services/api';
import type { GemeindeAnfrage, GemeindeKurz, MailNachricht, MailVerlauf } from '../../types/support';
import { anfragenZumZuordnen, fadenAus, gemeindenSortiert, standardBetreff, ungeleseneIds } from '../../utils/supportMail';
import { fehlerStatus, fehlerText } from '../../utils/fehler';
import { offlineBlockiert } from '../../utils/offlineAktion';
import { mailsAlsGelesen, supportMailZaehlerAuffrischen } from '../../navigation/supportMailZaehler';

export type ZuordnenKoerper = { anfrage_id: number } | { organization_id: number } | Record<string, never>;

export function usePostDetail(nachrichtId: number) {
  const { setError, setSuccess, isOnline } = useApp();

  const [mail, setMail] = useState<MailVerlauf | null>(null);
  const [faden, setFaden] = useState<MailNachricht[]>([]);
  const [neu, setNeu] = useState<ReadonlySet<number>>(new Set());
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState(false);
  const [nichtGefunden, setNichtGefunden] = useState(false);

  const [anfragen, setAnfragen] = useState<GemeindeAnfrage[]>([]);
  const [gemeinden, setGemeinden] = useState<GemeindeKurz[]>([]);
  const [auswahlFehlt, setAuswahlFehlt] = useState(false);
  const [anfrageWahl, setAnfrageWahl] = useState('');
  const [gemeindeWahl, setGemeindeWahl] = useState('');
  const [ordnetZu, setOrdnetZu] = useState(false);

  // Erst warten, dann Zustand setzen (der erste Abruf laeuft im Effekt).
  const holen = useCallback(async (ersterAbruf: boolean) => {
    if (!Number.isInteger(nachrichtId) || nachrichtId <= 0) {
      setNichtGefunden(true);
      setLaedt(false);
      return;
    }
    try {
      const antwort = await api.get(`/support/mail/nachrichten/${nachrichtId}`);
      const daten = antwort.data && typeof antwort.data === 'object' ? antwort.data as MailVerlauf : null;
      if (!daten || typeof daten.id !== 'number') {
        setMail(null);
        setNichtGefunden(true);
        return;
      }
      const liste = fadenAus(daten);
      const ungelesen = ungeleseneIds(liste);
      setMail(daten);
      setFaden(liste);
      // „Neu" bleibt fuer diesen Besuch an den Mails, die beim Oeffnen
      // ungelesen waren -- auch nachdem sie als gelesen gemeldet sind.
      if (ersterAbruf) setNeu(new Set(ungelesen));
      setNichtGefunden(false);
      setFehler(false);
      void mailsAlsGelesen(ungelesen);
    } catch (err) {
      setMail(null);
      if (fehlerStatus(err) === 404) setNichtGefunden(true);
      else setFehler(true);
    } finally {
      setLaedt(false);
    }
  }, [nachrichtId]);

  const auswahlHolen = useCallback(async () => {
    const [a, g] = await Promise.allSettled([api.get('/support/anfragen'), api.get('/organizations')]);
    setAnfragen(a.status === 'fulfilled' && Array.isArray(a.value.data) ? anfragenZumZuordnen(a.value.data) : []);
    setGemeinden(g.status === 'fulfilled' && Array.isArray(g.value.data) ? gemeindenSortiert(g.value.data) : []);
    setAuswahlFehlt(a.status !== 'fulfilled' || g.status !== 'fulfilled');
  }, []);

  useEffect(() => {
    void holen(true);
    void auswahlHolen();
  }, [holen, auswahlHolen]);

  const laden = () => {
    setLaedt(true);
    setFehler(false);
    return holen(true);
  };

  const zuordnen = async (koerper: ZuordnenKoerper, meldung: string) => {
    if (!mail || offlineBlockiert(isOnline, setError)) return;
    setOrdnetZu(true);
    try {
      await api.post(`/support/mail/nachrichten/${mail.id}/zuordnen`, koerper);
      setSuccess(meldung);
      setAnfrageWahl('');
      setGemeindeWahl('');
      supportMailZaehlerAuffrischen();
      await holen(false);
    } catch (err) {
      setError(fehlerText(err, 'Mail konnte nicht zugeordnet werden'));
    } finally {
      setOrdnetZu(false);
    }
  };

  // Antwort an den Absender der letzten eingehenden Mail des Fadens.
  const letzteEingehende = useMemo(
    () => [...faden].reverse().find((m) => m.richtung === 'ein') ?? mail,
    [faden, mail]
  );
  const betreffVorschlag = standardBetreff(faden[faden.length - 1]?.betreff ?? mail?.betreff);

  // Abgeleitetes -- fuer beide Fassungen gleich.
  const anfrageDerMail = mail?.anfrage_id ? anfragen.find((a) => a.id === mail.anfrage_id) : undefined;
  const gemeindeDerMail = mail?.organization_id ? gemeinden.find((g) => g.id === mail.organization_id) : undefined;
  const zugeordnet = mail ? mail.anfrage_id !== null || mail.organization_id !== null : false;
  const gewaehlteAnfrage = anfragen.find((a) => String(a.id) === anfrageWahl);
  const gewaehlteGemeinde = gemeinden.find((g) => String(g.id) === gemeindeWahl);

  return {
    isOnline,
    mail,
    faden,
    neu,
    laedt,
    fehler,
    nichtGefunden,
    anfragen,
    gemeinden,
    auswahlFehlt,
    anfrageWahl,
    setAnfrageWahl,
    gemeindeWahl,
    setGemeindeWahl,
    ordnetZu,
    holen,
    laden,
    zuordnen,
    letzteEingehende,
    betreffVorschlag,
    anfrageDerMail,
    gemeindeDerMail,
    zugeordnet,
    gewaehlteAnfrage,
    gewaehlteGemeinde,
  };
}

export type PostDetailDaten = ReturnType<typeof usePostDetail>;
