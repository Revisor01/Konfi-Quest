// Eine Mail aus dem Posteingang als Logik ohne Darstellung
// (/admin/support/post/:id, docs/planung/support-vorgaenge.md, Entscheidung 7):
// die Mail mit ihrem ganzen Faden laden (ungelesene eingehende als gelesen
// melden) und -- solange sie in keinem Vorgang liegt -- einsortieren,
// archivieren, wiederherstellen, löschen und dem Absender antworten. Liegt sie
// schon in einem Vorgang, führt ein Link dorthin; geantwortet wird im Vorgang.
// Die App-Fassung (SupportPostDetailPage) und die Web-Fassung
// (web/WebPostDetail) zeigen dieselbe Logik.
//
// Jede Änderung meldet „Support-Daten geändert" (utils/supportAktualisieren.ts):
// Mail, Posteingang und rote Zahlen laden danach von selbst neu.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useIonRouter } from '@ionic/react';
import api from '../../services/api';
import type { MailNachricht, MailVerlauf } from '../../types/support';
import { fadenAus, standardBetreff, ungeleseneIds } from '../../utils/supportMail';
import { fehlerStatus } from '../../utils/fehler';
import { mailsAlsGelesen } from '../../navigation/supportMailZaehler';
import { useSupportGeaendert, useSupportQuelle } from '../../utils/supportAktualisieren';
import { SUPPORT_POSTEINGANG } from '../../navigation/supportMenue';
import { useMailAktionen } from './useMailAktionen';

/** Die zusaetzlichen Felder einer Mail seit den Vorgaengen; aeltere Server liefern sie nicht. */
type MailMitVorgang = MailVerlauf & { vorgang_id?: number | null; archiviert_am?: string | null };

export function usePostDetail(nachrichtId: number) {
  const router = useIonRouter();
  const aktionen = useMailAktionen();
  // Quelle des Gelesen-Meldens: Das Laden danach weckt diese Seite nicht noch einmal.
  const quelle = useSupportQuelle();

  const [mail, setMail] = useState<MailMitVorgang | null>(null);
  const [faden, setFaden] = useState<MailNachricht[]>([]);
  const [neu, setNeu] = useState<ReadonlySet<number>>(new Set());
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState(false);
  const [nichtGefunden, setNichtGefunden] = useState(false);

  // Erst warten, dann Zustand setzen (der erste Abruf laeuft im Effekt).
  const holen = useCallback(async (ersterAbruf: boolean) => {
    if (!Number.isInteger(nachrichtId) || nachrichtId <= 0) {
      setNichtGefunden(true);
      setLaedt(false);
      return;
    }
    try {
      const antwort = await api.get(`/support/mail/nachrichten/${nachrichtId}`);
      const daten = antwort.data && typeof antwort.data === 'object' ? antwort.data as MailMitVorgang : null;
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
      void mailsAlsGelesen(ungelesen, quelle);
    } catch (err) {
      setMail(null);
      if (fehlerStatus(err) === 404) setNichtGefunden(true);
      else setFehler(true);
    } finally {
      setLaedt(false);
    }
  }, [nachrichtId, quelle]);

  useEffect(() => { void holen(true); }, [holen]);

  // Aenderungen an anderer Stelle (einsortiert, archiviert, geantwortet, Fenster wieder da).
  useSupportGeaendert(() => holen(false), { quelle });

  const laden = () => {
    setLaedt(true);
    setFehler(false);
    return holen(true);
  };

  // Antwort an den Absender der letzten eingehenden Mail des Fadens.
  const letzteEingehende = useMemo(
    () => [...faden].reverse().find((m) => m.richtung === 'ein') ?? mail,
    [faden, mail]
  );
  const betreffVorschlag = standardBetreff(faden[faden.length - 1]?.betreff ?? mail?.betreff);

  // Abgeleitetes -- fuer beide Fassungen gleich.
  const vorgangId = mail?.vorgang_id ?? null;
  const archiviert = Boolean(mail?.archiviert_am);

  /** Aus dem Archiv holen: die Mail liegt wieder im Posteingang. */
  const wiederherstellen = () => aktionen.wiederherstellen(mail ? [mail.id] : []);
  const archivieren = () => aktionen.archivieren(mail ? [mail.id] : []);
  /** Loeschen mit Rueckfrage; danach zurueck in den Posteingang -- die Mail gibt es nicht mehr. */
  const loeschenFragen = () => {
    if (mail) aktionen.loeschenFragen([mail.id], () => router.push(SUPPORT_POSTEINGANG, 'back', 'replace'));
  };

  return {
    isOnline: aktionen.isOnline,
    mail,
    faden,
    neu,
    laedt,
    fehler,
    nichtGefunden,
    holen,
    laden,
    letzteEingehende,
    betreffVorschlag,
    vorgangId,
    archiviert,
    archivieren,
    wiederherstellen,
    loeschenFragen,
  };
}

export type PostDetailDaten = ReturnType<typeof usePostDetail>;
