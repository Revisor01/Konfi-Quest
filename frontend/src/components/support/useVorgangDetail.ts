// Ein Vorgang als Logik ohne Darstellung (/admin/support/vorgaenge/:id,
// docs/planung/support-vorgaenge.md, Entscheidung 7): laden (ungelesene
// eingehende Mails als gelesen melden), einordnen -- Art, Bereich,
// Dringlichkeit, Status, Gemeinde, sofort gespeichert --, die interne Notiz,
// archivieren, wiederherstellen, löschen, und die Wege der Antwort. Die
// App-Fassung (SupportVorgangDetailPage) und die Web-Fassung
// (web/WebVorgangDetail) zeigen dieselbe Logik; „Gemeinde anlegen" einer
// Anfrage steckt in useGemeindeAnlegen.
//
// Jede Änderung meldet „Support-Daten geändert" (utils/supportAktualisieren.ts):
// Der Vorgang selbst, die Liste, die Übersicht und die roten Zahlen der Leiste
// laden danach von selbst neu. Eine Eingabe, die noch nicht gespeichert ist
// (die Notiz), überschreibt das Neuladen nicht.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIonAlert, useIonRouter } from '@ionic/react';
import { useApp } from '../../contexts/AppContext';
import api from '../../services/api';
import type { GemeindeKurz, MailEmpfaenger } from '../../types/support';
import { fehlerStatus, fehlerText } from '../../utils/fehler';
import { offlineBlockiert } from '../../utils/offlineAktion';
import { empfaengerLesen, gemeindenSortiert, standardBetreff, ungeleseneIds, ANFRAGE_BETREFF } from '../../utils/supportMail';
import {
  ERLEDIGT_HINWEIS,
  antwortWegVon,
  vorgangDetailLesen,
  type AntwortWeg,
  type Dringlichkeit,
  type VorgangArt,
  type VorgangBereich,
  type VorgangDetail,
  type VorgangStatus,
} from '../../utils/supportVorgaenge';
import { mailsAlsGelesen } from '../../navigation/supportMailZaehler';
import { meldeSupportGeaendert, useSupportGeaendert, useSupportQuelle } from '../../utils/supportAktualisieren';
import { SUPPORT_VORGAENGE } from '../../navigation/supportMenue';
import { useGemeindeAnlegen } from './useGemeindeAnlegen';

/** Was sich im Einordnen aendern laesst -- jedes Feld einzeln, sofort gespeichert. */
export interface Einordnung {
  art?: VorgangArt;
  bereich?: VorgangBereich | null;
  dringlichkeit?: Dringlichkeit;
  status?: VorgangStatus;
  organization_id?: number | null;
}

export function useVorgangDetail(vorgangId: number) {
  const { setError, setSuccess, isOnline } = useApp();
  const [presentAlert] = useIonAlert();
  const router = useIonRouter();
  // Quelle des Gelesen-Meldens: Das Laden danach weckt diese Seite nicht noch einmal.
  const quelle = useSupportQuelle();

  const [vorgang, setVorgang] = useState<VorgangDetail | null>(null);
  const [neu, setNeu] = useState<ReadonlySet<number>>(new Set());
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState(false);
  const [nichtGefunden, setNichtGefunden] = useState(false);
  const [speichert, setSpeichert] = useState(false);

  const [notiz, setNotiz] = useState('');
  // Der Stand der Notiz vom Server beim letzten Laden: Ein erneutes Laden
  // ueberschreibt nur einen Entwurf, der noch unveraendert ist.
  const serverNotiz = useRef<string | null>(null);

  const [gemeinden, setGemeinden] = useState<GemeindeKurz[]>([]);
  const [gemeindenFehlt, setGemeindenFehlt] = useState(false);
  const [empfaengerListe, setEmpfaengerListe] = useState<MailEmpfaenger[]>([]);
  const [empfaengerFehlt, setEmpfaengerFehlt] = useState(false);

  // Erst warten, dann Zustand setzen (der erste Abruf laeuft im Effekt).
  const holen = useCallback(async (ersterAbruf: boolean) => {
    if (!Number.isInteger(vorgangId) || vorgangId <= 0) {
      setNichtGefunden(true);
      setLaedt(false);
      return;
    }
    try {
      const antwort = await api.get(`/support/vorgaenge/${vorgangId}`);
      const daten = vorgangDetailLesen(antwort.data);
      if (!daten) {
        setVorgang(null);
        setNichtGefunden(true);
        return;
      }
      const ungelesen = ungeleseneIds(daten.verlauf);
      setVorgang(daten);
      const vorher = serverNotiz.current;
      serverNotiz.current = daten.notiz ?? '';
      setNotiz((n) => (vorher === null || n === vorher ? daten.notiz ?? '' : n));
      // „Neu" bleibt fuer diesen Besuch an den Mails, die beim Oeffnen
      // ungelesen waren -- auch nachdem sie als gelesen gemeldet sind.
      if (ersterAbruf) setNeu(new Set(ungelesen));
      setNichtGefunden(false);
      setFehler(false);
      void mailsAlsGelesen(ungelesen, quelle);
    } catch (err) {
      if (fehlerStatus(err) === 404) {
        setVorgang(null);
        setNichtGefunden(true);
      } else {
        setFehler(true);
      }
    } finally {
      setLaedt(false);
    }
  }, [vorgangId, quelle]);

  useEffect(() => { void holen(true); }, [holen]);

  const gemeindenHolen = useCallback(async () => {
    try {
      const antwort = await api.get('/organizations');
      setGemeinden(Array.isArray(antwort.data) ? gemeindenSortiert(antwort.data) : []);
      setGemeindenFehlt(!Array.isArray(antwort.data));
    } catch {
      setGemeindenFehlt(true);
    }
  }, []);
  useEffect(() => { void gemeindenHolen(); }, [gemeindenHolen]);

  // Die Gemeinde des Vorgangs: ihre moeglichen Empfaenger fuer Antworten von support@.
  const organizationId = vorgang?.organization_id ?? null;
  useEffect(() => {
    if (organizationId === null) {
      setEmpfaengerListe([]);
      setEmpfaengerFehlt(false);
      return undefined;
    }
    let aktiv = true;
    void api.get(`/support/gemeinden/${organizationId}/empfaenger`).then(
      (antwort) => { if (aktiv) { setEmpfaengerListe(empfaengerLesen(antwort.data)); setEmpfaengerFehlt(false); } },
      () => { if (aktiv) { setEmpfaengerListe([]); setEmpfaengerFehlt(true); } },
    );
    return () => { aktiv = false; };
  }, [organizationId]);

  // Aenderungen an anderer Stelle (Liste, Posteingang, Antwort gesendet, Fenster wieder da).
  useSupportGeaendert(() => Promise.all([holen(false), gemeindenHolen()]), { quelle });

  const laden = () => {
    setLaedt(true);
    setFehler(false);
    return holen(true);
  };

  // --- Einordnen: jedes Feld sofort speichern -------------------------------------
  const einordnen = async (teil: Einordnung): Promise<boolean> => {
    if (!vorgang || offlineBlockiert(isOnline, setError)) return false;
    const vorher = vorgang;
    // Sofort anzeigen; scheitert das Speichern, holt das Neuladen den echten Stand zurueck.
    setVorgang({
      ...vorgang,
      ...(teil.art !== undefined ? { art: teil.art } : {}),
      ...(teil.bereich !== undefined ? { bereich: teil.bereich } : {}),
      ...(teil.dringlichkeit !== undefined ? { dringlichkeit: teil.dringlichkeit } : {}),
      ...(teil.status !== undefined ? { status: teil.status } : {}),
      ...(teil.organization_id !== undefined ? { organization_id: teil.organization_id } : {}),
    });
    setSpeichert(true);
    try {
      await api.patch(`/support/vorgaenge/${vorgang.id}`, teil);
      setSuccess(teil.status === 'erledigt' ? 'Vorgang erledigt und ins Archiv gelegt' : 'Gespeichert');
      meldeSupportGeaendert();
      return true;
    } catch (err) {
      setVorgang(vorher);
      setError(fehlerText(err, 'Änderung konnte nicht gespeichert werden'));
      void holen(false);
      return false;
    } finally {
      setSpeichert(false);
    }
  };

  const notizGeaendert = vorgang !== null && notiz.trim() !== (vorgang.notiz ?? '').trim();

  const notizSpeichern = async (): Promise<boolean> => {
    if (!vorgang || offlineBlockiert(isOnline, setError)) return false;
    setSpeichert(true);
    try {
      await api.patch(`/support/vorgaenge/${vorgang.id}`, { notiz: notiz.trim() || null });
      serverNotiz.current = notiz.trim();
      setVorgang({ ...vorgang, notiz: notiz.trim() || null });
      setSuccess('Notiz gespeichert');
      meldeSupportGeaendert();
      return true;
    } catch (err) {
      setError(fehlerText(err, 'Notiz konnte nicht gespeichert werden'));
      return false;
    } finally {
      setSpeichert(false);
    }
  };

  // --- Archivieren, Wiederherstellen, Loeschen ------------------------------------
  const archivieren = async () => {
    if (!vorgang || offlineBlockiert(isOnline, setError)) return;
    setSpeichert(true);
    try {
      await api.post(`/support/vorgaenge/${vorgang.id}/archivieren`);
      setSuccess('Vorgang archiviert');
      meldeSupportGeaendert();
    } catch (err) {
      setError(fehlerText(err, 'Vorgang konnte nicht archiviert werden'));
    } finally {
      setSpeichert(false);
    }
  };

  const wiederherstellen = async () => {
    if (!vorgang || offlineBlockiert(isOnline, setError)) return;
    setSpeichert(true);
    try {
      await api.post(`/support/vorgaenge/${vorgang.id}/wiederherstellen`);
      setSuccess('Vorgang wiederhergestellt – Status „In Arbeit“');
      meldeSupportGeaendert();
    } catch (err) {
      setError(fehlerText(err, 'Vorgang konnte nicht wiederhergestellt werden'));
    } finally {
      setSpeichert(false);
    }
  };

  const loeschenFragen = () => {
    if (!vorgang || offlineBlockiert(isOnline, setError)) return;
    const id = vorgang.id;
    presentAlert({
      header: 'Vorgang löschen',
      message: `„${vorgang.betreff}“ wird mit seinen Mails in Konfi Quest${vorgang.anfrage ? ' und der Anfrage' : ''} gelöscht. Im Postfach selbst bleibt alles stehen. Das lässt sich nicht rückgängig machen.`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: () => {
            void (async () => {
              try {
                await api.delete(`/support/vorgaenge/${id}`);
                setSuccess('Vorgang gelöscht');
                meldeSupportGeaendert();
                router.push(SUPPORT_VORGAENGE, 'back', 'replace');
              } catch (err) {
                setError(fehlerText(err, 'Vorgang konnte nicht gelöscht werden'));
              }
            })();
          },
        },
      ],
    });
  };

  // --- Antworten ----------------------------------------------------------------------
  const antwortWeg: AntwortWeg | null = useMemo(() => (vorgang ? antwortWegVon(vorgang) : null), [vorgang]);

  // Mit Gemeinde: die Adressen der Gemeinde; der Kontakt des Formulars steht
  // zusaetzlich zur Wahl, wenn er dort nicht schon vorkommt.
  const empfaenger: MailEmpfaenger[] | null = useMemo(() => {
    if (!antwortWeg || antwortWeg.art !== 'gemeinde') return null;
    const liste = [...empfaengerListe];
    if (antwortWeg.kontakt && !liste.some((e) => e.adresse.toLowerCase() === antwortWeg.kontakt!.toLowerCase())) {
      liste.unshift({ adresse: antwortWeg.kontakt, name: vorgang?.kontakt_name ?? null, herkunft: 'Kontakt aus dem Formular' });
    }
    return liste;
  }, [antwortWeg, empfaengerListe, vorgang?.kontakt_name]);

  const betreffVorschlag = useMemo(() => {
    if (!vorgang) return '';
    const letzte = vorgang.verlauf.length > 0 ? vorgang.verlauf[vorgang.verlauf.length - 1].betreff : null;
    return standardBetreff(letzte ?? (vorgang.anfrage ? ANFRAGE_BETREFF : vorgang.betreff));
  }, [vorgang]);

  const anlegen = useGemeindeAnlegen(vorgang?.anfrage ?? null);

  const archiviert = vorgang !== null && (vorgang.archiviert_am !== null || vorgang.status === 'erledigt');

  return {
    isOnline,
    vorgang,
    neu,
    laedt,
    fehler,
    nichtGefunden,
    speichert,
    laden,
    gemeinden,
    gemeindenFehlt,
    empfaenger,
    empfaengerFehlt,
    antwortWeg,
    betreffVorschlag,
    einordnen,
    notiz,
    setNotiz,
    notizGeaendert,
    notizSpeichern,
    archivieren,
    wiederherstellen,
    loeschenFragen,
    archiviert,
    anlegen,
    erledigtHinweis: ERLEDIGT_HINWEIS,
  };
}

export type VorgangDetailDaten = ReturnType<typeof useVorgangDetail>;
