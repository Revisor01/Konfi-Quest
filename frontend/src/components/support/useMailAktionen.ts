// Archivieren, Wiederherstellen und Löschen von Mails im Posteingang -- eine
// Mail oder mehrere auf einmal (docs/planung/support-vorgaenge.md,
// Entscheidung 5). Gebraucht von der Liste des Posteingangs (App und Web) und
// von der Seite einer einzelnen Mail.
//
// Gelöscht wird nur in Konfi Quest: Im Postfach selbst bleibt alles stehen,
// Konfi Quest liest die Postfächer weiter nur lesend -- die Rückfrage sagt das.
// Jede Aktion meldet „Support-Daten geändert", damit Liste, Zahlen der Leiste
// und Übersicht sofort den neuen Stand zeigen.

import { useCallback } from 'react';
import { useIonAlert } from '@ionic/react';
import { useApp } from '../../contexts/AppContext';
import api from '../../services/api';
import { fehlerText } from '../../utils/fehler';
import { offlineBlockiert } from '../../utils/offlineAktion';
import { mailSammelKoerper, mailsText, type MailSammelAktion } from '../../utils/supportVorgaenge';
import { meldeSupportGeaendert } from '../../utils/supportAktualisieren';

const ERFOLG: Record<MailSammelAktion, (n: number) => string> = {
  archivieren: (n) => `${mailsText(n)} archiviert`,
  wiederherstellen: (n) => `${mailsText(n)} wiederhergestellt – wieder im Posteingang`,
  loeschen: (n) => `${mailsText(n)} gelöscht`,
};

const FEHLER: Record<MailSammelAktion, string> = {
  archivieren: 'Archivieren hat nicht geklappt',
  wiederherstellen: 'Wiederherstellen hat nicht geklappt',
  loeschen: 'Löschen hat nicht geklappt',
};

export function useMailAktionen() {
  const { setError, setSuccess, isOnline } = useApp();
  const [presentAlert] = useIonAlert();

  /** Eine Aktion auf eine oder mehrere Mails; true, wenn sie geklappt hat. */
  const ausfuehren = useCallback(async (ids: readonly number[], aktion: MailSammelAktion): Promise<boolean> => {
    if (ids.length === 0 || offlineBlockiert(isOnline, setError)) return false;
    try {
      if (ids.length === 1) {
        const id = ids[0];
        if (aktion === 'loeschen') await api.delete(`/support/mail/nachrichten/${id}`);
        else await api.post(`/support/mail/nachrichten/${id}/${aktion}`);
      } else {
        await api.post('/support/mail/sammel', mailSammelKoerper(ids, aktion));
      }
      setSuccess(ERFOLG[aktion](ids.length));
      meldeSupportGeaendert();
      return true;
    } catch (err) {
      setError(fehlerText(err, FEHLER[aktion]));
      return false;
    }
  }, [isOnline, setError, setSuccess]);

  /** Loeschen mit Rueckfrage; ruft `danach` auf, wenn es geklappt hat. */
  const loeschenFragen = useCallback((ids: readonly number[], danach?: () => void) => {
    if (ids.length === 0) return;
    presentAlert({
      header: ids.length === 1 ? 'Mail löschen' : `${mailsText(ids.length)} löschen`,
      message: `${ids.length === 1 ? 'Die Mail wird' : 'Die Mails werden'} in Konfi Quest gelöscht. Im Postfach selbst bleibt alles stehen. Das lässt sich nicht rückgängig machen.`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: () => { void ausfuehren(ids, 'loeschen').then((ok) => { if (ok) danach?.(); }); },
        },
      ],
    });
  }, [presentAlert, ausfuehren]);

  return {
    isOnline,
    archivieren: (ids: readonly number[]) => ausfuehren(ids, 'archivieren'),
    wiederherstellen: (ids: readonly number[]) => ausfuehren(ids, 'wiederherstellen'),
    loeschenFragen,
  };
}
