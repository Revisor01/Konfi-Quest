// Eine Mail aus dem Posteingang als Logik ohne Darstellung
// (/admin/support/post/:id, docs/planung/support-vorgaenge.md, Entscheidung 7):
// die Mail mit ihrem ganzen Faden laden (ungelesene eingehende als gelesen
// melden) und -- solange sie im Posteingang liegt -- einsortieren,
// archivieren, wiederherstellen, löschen und dem Absender antworten.
// Die App-Fassung (SupportPostDetailPage) und die Web-Fassung
// (web/WebPostDetail) zeigen dieselbe Logik.
//
// Seit 11.10.2026 (docs/planung/support-detailseiten.md, D und E) liefert der
// Hook auch den Stand der Mail (mailStand: Einsortieren als Hauptknopf, der
// Archiv-Satz, Archivieren und Löschen nur im Posteingang), die drei Zahlen,
// das fertige Antwort-Objekt (bis dahin baute jede Seite es selbst) und das
// Ziel der Weiterleitung, wenn die Mail schon in einem Vorgang liegt -- die
// Seite leitet dann mit replace dorthin (`?mail=`), der Server lehnt
// Archivieren und Löschen solcher Mails ohnehin ab (409).
//
// Seit 12.10.2026 (Paket 6, Frage 11) auch, was der Server über den Absender
// weiß (`absender_bekannt`, gelesen von mailMitVorgangLesen): die Zeile
// „Absender gehört zu …" und die Vorbelegung des Einsortierens (`absender`).
// Ein älterer Server liefert das Feld nicht -- dann null.
//
// Jede Änderung meldet „Support-Daten geändert" (utils/supportAktualisieren.ts):
// Mail, Posteingang und rote Zahlen laden danach von selbst neu.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useIonRouter } from '@ionic/react';
import api from '../../services/api';
import type { MailAntwortDaten, MailNachricht } from '../../types/support';
import {
  fadenAus,
  mailAbsenderAngabe,
  mailKennzahlen,
  mailMitVorgangLesen,
  mailStand,
  posteingangsAntwortAuf,
  standardBetreff,
  ungeleseneIds,
  type MailAbsenderAngabe,
  type MailMitVorgang,
  type MailStandAngabe,
} from '../../utils/supportMail';
import type { Kennzahl } from '../../utils/supportVorgaenge';
import { fehlerStatus } from '../../utils/fehler';
import { mailsAlsGelesen } from '../../navigation/supportMailZaehler';
import { useSupportGeaendert, useSupportQuelle } from '../../utils/supportAktualisieren';
import { SUPPORT_POSTEINGANG } from '../../navigation/supportMenue';
import type { AntwortFormularProps } from './useAntwortEditor';
import { useMailAktionen } from './useMailAktionen';

/** @param nachLoeschen Was nach dem Loeschen geschieht; ohne: zurueck in den Posteingang. */
export function usePostDetail(nachrichtId: number, nachLoeschen?: () => void) {
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
      const daten = mailMitVorgangLesen(antwort.data);
      if (!daten) {
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

  // Antwort an den Absender der jüngsten eingehenden Mail des Fadens, die im
  // Posteingang liegt (posteingangsAntwortAuf) -- nicht an eine Mail desselben
  // Fadens aus einem Vorgang: Die Antwort bekäme dessen Zuordnung.
  const letzteEingehende = useMemo(() => posteingangsAntwortAuf(faden, mail), [faden, mail]);
  const betreffVorschlag = standardBetreff(faden[faden.length - 1]?.betreff ?? mail?.betreff);

  // Abgeleitetes -- fuer beide Fassungen gleich.
  const vorgangId = mail?.vorgang_id ?? null;
  const archiviert = Boolean(mail?.archiviert_am);

  /** Was die Seite zeigt und anbietet (utils/supportMail.ts, mailStand). */
  const stand: MailStandAngabe | null = useMemo(() => (mail ? mailStand(mail) : null), [mail]);
  /** Im Posteingang: weder Vorgang noch Anfrage noch Gemeinde (dieselbe Regel wie der Server). */
  const imPosteingang = stand?.imPosteingang ?? false;
  /** Liegt die Mail woanders: das Ziel. Die Seite leitet mit replace weiter (router.push(ziel, 'none', 'replace')). */
  const weiterleitung = stand?.weiterleitung ?? null;
  const kennzahlen: Kennzahl[] = useMemo(() => (mail ? mailKennzahlen(faden, neu.size) : []), [mail, faden, neu]);
  /** „Absender gehört zu …" (nur im Posteingang, nur wenn der Server die Gemeinde kennt); sonst null. */
  const absender: MailAbsenderAngabe | null = useMemo(() => (mail ? mailAbsenderAngabe(mail) : null), [mail]);

  /**
   * Das Antwortformular für App und Web: an den Absender der jüngsten
   * eingehenden Mail im Posteingang, von ihrem Postfach. Nur, wenn der Stand
   * Antworten anbietet (Posteingang, nicht im Archiv); sonst null.
   *
   * Der Aufruf geht an die angezeigte, beantwortete Mail
   * (POST /support/mail/nachrichten/<ihre ID>/antworten): Der Server antwortet
   * an ihren Absender, von ihrem Postfach, mit ihr als Bezug (In-Reply-To,
   * „Re:"), und gibt der Antwort ihre Zuordnung. Bis 12.10.2026 ging er an
   * die Mail aus der Adresse -- öffnete man eine ältere Mail des Fadens,
   * nannte die Anzeige die jüngste eingehende, die Antwort ging aber an den
   * Absender der älteren, mit ihr als Bezug.
   */
  const antwort: AntwortFormularProps | null = useMemo(() => {
    if (!mail || !stand?.neben.includes('antworten') || !letzteEingehende || letzteEingehende.richtung !== 'ein') return null;
    const beantwortetId = letzteEingehende.id;
    return {
      postfach: letzteEingehende.postfach,
      betreffVorschlag,
      an: letzteEingehende.von_adresse,
      senden: async (koerper: MailAntwortDaten) => (await api.post(`/support/mail/nachrichten/${beantwortetId}/antworten`, koerper)).data,
      beantwortet: letzteEingehende,
    };
  }, [mail, stand, letzteEingehende, betreffVorschlag]);

  /** Aus dem Archiv holen: die Mail liegt wieder im Posteingang. */
  const wiederherstellen = () => aktionen.wiederherstellen(mail ? [mail.id] : []);
  const archivieren = () => aktionen.archivieren(mail ? [mail.id] : []);
  /** Loeschen mit Rueckfrage; danach zurueck in den Posteingang -- die Mail gibt es nicht mehr. */
  const loeschenFragen = () => {
    if (mail) aktionen.loeschenFragen([mail.id], () => (nachLoeschen ? nachLoeschen() : router.push(SUPPORT_POSTEINGANG, 'back', 'replace')));
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
    stand,
    kennzahlen,
    antwort,
    imPosteingang,
    weiterleitung,
    absender,
  };
}

export type PostDetailDaten = ReturnType<typeof usePostDetail>;
