// Die Liste der Vorgänge als Logik ohne Darstellung (/admin/support/vorgaenge,
// docs/planung/support-vorgaenge.md, Entscheidung 7): laden, filtern, Sammel-
// aktionen. Die Web-Fassung (web/WebVorgaenge) und die App-Fassung
// (SupportVorgaengePage) zeigen dieselbe Logik.
//
// Geladen werden die OFFENEN Vorgänge (GET /support/vorgaenge?filter=offen) --
// aus ihnen ergeben sich Offen, Neu, In Arbeit und Wartet samt Zahlen, ohne
// dass ein Filterwechsel neu abruft -- und, nur solange der Filter „Archiv"
// gewählt ist, die archivierten (?filter=archiv, darin auch die erledigten).
// Art, Gemeinde und Suche wirken im Browser auf die geladene Liste.
//
// Wie jede Ansicht der Support-Ansicht lädt die Liste neu, wenn irgendwo
// Support-Daten geändert werden (utils/supportAktualisieren.ts).

import { useCallback, useMemo } from 'react';
import { useIonAlert } from '@ionic/react';
import { useApp } from '../../contexts/AppContext';
import api from '../../services/api';
import { fehlerText } from '../../utils/fehler';
import { offlineBlockiert } from '../../utils/offlineAktion';
import { gemeindeName, gemeindenSortiert } from '../../utils/supportMail';
import {
  VORGANG_STATUS,
  gemeindenAusVorgaengen,
  istArchivFilter,
  vorgaengeFiltern,
  vorgaengeLesen,
  vorgaengeSortieren,
  vorgaengeText,
  vorgaengeZaehlen,
  vorgangSammelKoerper,
  type Vorgang,
  type VorgangAuswahl,
  type VorgangSammelAktion,
  type VorgangStatus,
} from '../../utils/supportVorgaenge';
import { meldeSupportGeaendert } from '../../utils/supportAktualisieren';
import { useSupportDaten } from './useSupportDaten';

/** Eine der beiden Listen vom Server holen; eine Antwort in unbekannter Form ist ein Fehler. */
export async function vorgaengeLaden(filter: 'offen' | 'archiv'): Promise<Vorgang[]> {
  const antwort = await api.get('/support/vorgaenge', { params: { filter } });
  const liste = vorgaengeLesen(antwort.data);
  if (!liste) throw new Error('Die Vorgänge kamen in einer unbekannten Form');
  return liste;
}

const ladeOffene = () => vorgaengeLaden('offen');

/** Alle Gemeinden fuer die Auswahl „Gemeinde" -- auch eine ohne Vorgang, der man schreiben will. */
async function gemeindenLaden(): Promise<Array<{ id: number; name: string }>> {
  const antwort = await api.get('/organizations');
  if (!Array.isArray(antwort.data)) throw new Error('Die Gemeinden kamen in einer unbekannten Form');
  return gemeindenSortiert(antwort.data).map((g) => ({ id: g.id, name: gemeindeName(g) }));
}

export function useVorgangsliste(auswahl: VorgangAuswahl) {
  const { setError, setSuccess, isOnline } = useApp();
  const [presentAlert] = useIonAlert();

  const archivAktiv = istArchivFilter(auswahl.filter);
  const offene = useSupportDaten(ladeOffene);
  // Das Archiv wird erst gebraucht, wenn der Filter es zeigt -- vorher kein Abruf.
  const ladeArchiv = useCallback(async (): Promise<Vorgang[] | null> => (archivAktiv ? vorgaengeLaden('archiv') : null), [archivAktiv]);
  const archiv = useSupportDaten(ladeArchiv);

  const quelle = archivAktiv ? archiv.daten : offene.daten;
  const laedt = archivAktiv ? (archiv.daten === null && !archiv.fehler) : offene.laedt;
  const fehler = archivAktiv ? (archiv.daten === null && archiv.fehler) : offene.fehler && offene.daten === null;

  const zaehlen = useMemo(() => (offene.daten ? vorgaengeZaehlen(offene.daten) : null), [offene.daten]);
  const sichtbar = useMemo(() => vorgaengeSortieren(vorgaengeFiltern(quelle ?? [], auswahl)), [quelle, auswahl]);
  // Die Auswahl „Gemeinde" bietet alle Gemeinden; fehlt die Liste (Abruf gescheitert),
  // bleiben die Gemeinden, die in der geladenen Liste vorkommen.
  const organisationen = useSupportDaten(gemeindenLaden);
  const gemeinden = useMemo(() => organisationen.daten ?? gemeindenAusVorgaengen(quelle ?? []), [organisationen.daten, quelle]);

  const neuLaden = useCallback(async () => {
    await Promise.all([offene.neuLaden(), archivAktiv ? archiv.neuLaden() : Promise.resolve()]);
  }, [offene, archiv, archivAktiv]);

  /** Eine Sammelaktion ausfuehren; true, wenn sie geklappt hat. */
  const sammeln = useCallback(async (ids: readonly number[], aktion: VorgangSammelAktion, status?: VorgangStatus): Promise<boolean> => {
    if (ids.length === 0 || offlineBlockiert(isOnline, setError)) return false;
    const erfolg: Record<VorgangSammelAktion, string> = {
      archivieren: `${vorgaengeText(ids.length)} archiviert`,
      wiederherstellen: `${vorgaengeText(ids.length)} wiederhergestellt`,
      loeschen: `${vorgaengeText(ids.length)} gelöscht`,
      status: status === 'erledigt'
        ? `${vorgaengeText(ids.length)} erledigt und ins Archiv gelegt`
        : `${vorgaengeText(ids.length)} auf „${status ? VORGANG_STATUS[status].label : ''}“ gesetzt`,
    };
    try {
      await api.post('/support/vorgaenge/sammel', vorgangSammelKoerper(ids, aktion, status));
      setSuccess(erfolg[aktion]);
      meldeSupportGeaendert();
      return true;
    } catch (err) {
      setError(fehlerText(err, 'Die Aktion konnte nicht ausgeführt werden'));
      return false;
    }
  }, [isOnline, setError, setSuccess]);

  /** Loeschen mit Rueckfrage; ruft `danach` auf, wenn es geklappt hat. */
  const loeschenFragen = useCallback((ids: readonly number[], danach?: () => void) => {
    if (ids.length === 0) return;
    presentAlert({
      header: ids.length === 1 ? 'Vorgang löschen' : `${vorgaengeText(ids.length)} löschen`,
      message: ids.length === 1
        ? 'Der Vorgang, seine Mails in Konfi Quest und eine daran hängende Anfrage werden gelöscht. Im Postfach selbst bleibt alles stehen. Das lässt sich nicht rückgängig machen.'
        : 'Die Vorgänge, ihre Mails in Konfi Quest und daran hängende Anfragen werden gelöscht. Im Postfach selbst bleibt alles stehen. Das lässt sich nicht rückgängig machen.',
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: () => { void sammeln(ids, 'loeschen').then((ok) => { if (ok) danach?.(); }); },
        },
      ],
    });
  }, [presentAlert, sammeln]);

  return { isOnline, offene: offene.daten, quelle, laedt, fehler, zaehlen, sichtbar, gemeinden, neuLaden, sammeln, loeschenFragen, archivGeladen: archiv.daten !== null, archivAnzahl: archiv.daten?.length ?? null };
}

export type VorgangslisteDaten = ReturnType<typeof useVorgangsliste>;
