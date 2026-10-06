// Der Posteingang als Logik ohne Darstellung (/admin/support/post,
// docs/planung/support-vorgaenge.md, Entscheidung 7): nur die Mails, die in
// keinem Vorgang liegen und nicht archiviert sind (GET /support/mail/eingang);
// nur solange der Filter „Archiv" gewählt ist, auch die archivierten
// (?archiv=1). Dazu der Zustand beider Postfächer. Die Web-Fassung
// (web/WebPosteingang) und die App-Fassung (SupportPosteingangPage) zeigen
// dieselbe Logik. Wie jede Ansicht lädt auch der Posteingang bei jeder Meldung
// „Support-Daten geändert" neu (utils/supportAktualisieren.ts).

import { useCallback, useMemo } from 'react';
import api from '../../services/api';
import type { MailPostfachStatus } from '../../types/support';
import {
  eingangFiltern,
  eingangLesen,
  eingangSortieren,
  eingangZaehlen,
  type EingangFilter,
  type MailEingangWeb,
} from '../../utils/supportWeb';
import { useSupportDaten } from './useSupportDaten';

export interface PosteingangDaten {
  mails: MailEingangWeb[];
  /** Zustand der Postfaecher; null, wenn er nicht kam (die Seite sagt das). */
  status: MailPostfachStatus[] | null;
}

async function ladePosteingang(): Promise<PosteingangDaten> {
  // Ohne Parameter: die Mails ohne Vorgang, nicht archiviert (Vorgabe des Servers).
  const [mails, status] = await Promise.allSettled([
    api.get('/support/mail/eingang'),
    api.get('/support/mail/status'),
  ]);
  if (mails.status !== 'fulfilled') throw mails.reason;
  const liste = eingangLesen(mails.value.data);
  if (!liste) throw new Error('Der Posteingang kam in einer unbekannten Form');
  return {
    mails: liste,
    status: status.status === 'fulfilled' && Array.isArray(status.value.data?.postfaecher) ? status.value.data.postfaecher : null,
  };
}

async function ladeArchivierte(): Promise<MailEingangWeb[]> {
  const antwort = await api.get('/support/mail/eingang', { params: { archiv: 1 } });
  const liste = eingangLesen(antwort.data);
  if (!liste) throw new Error('Das Archiv kam in einer unbekannten Form');
  return liste;
}

export function usePosteingang(filter: EingangFilter) {
  const archivAktiv = filter === 'archiv';
  const eingang = useSupportDaten(ladePosteingang);
  // Das Archiv wird erst gebraucht, wenn der Filter es zeigt -- vorher kein Abruf.
  const ladeArchiv = useCallback(async (): Promise<MailEingangWeb[] | null> => (archivAktiv ? ladeArchivierte() : null), [archivAktiv]);
  const archiv = useSupportDaten(ladeArchiv);

  const posteingang = useMemo(() => eingang.daten?.mails ?? [], [eingang.daten]);
  const zaehlen = useMemo(() => eingangZaehlen(posteingang), [posteingang]);
  const quelle = archivAktiv ? archiv.daten : (eingang.daten ? posteingang : null);
  // Neueste zuerst, unabhaengig von der Reihenfolge des Servers.
  const sichtbar = useMemo(() => eingangSortieren(eingangFiltern(quelle ?? [], filter)), [quelle, filter]);

  const laedt = archivAktiv ? (archiv.daten === null && !archiv.fehler) : eingang.laedt;
  const fehler = archivAktiv ? (archiv.daten === null && archiv.fehler) : (eingang.daten === null && eingang.fehler);

  const neuLaden = useCallback(async () => {
    await Promise.all([eingang.neuLaden(), archivAktiv ? archiv.neuLaden() : Promise.resolve()]);
  }, [eingang, archiv, archivAktiv]);

  return {
    daten: eingang.daten,
    status: eingang.daten?.status ?? null,
    zaehlen,
    sichtbar,
    laedt,
    fehler,
    neuLaden,
    archivAnzahl: archiv.daten ? archiv.daten.length : null,
  };
}
