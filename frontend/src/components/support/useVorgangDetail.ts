// Ein Vorgang als Logik ohne Darstellung (/admin/support/vorgaenge/:id,
// docs/planung/support-vorgaenge.md, Entscheidung 7): laden (ungelesene
// eingehende Mails als gelesen melden), einordnen (ein PATCH mit den
// geänderten Feldern, auch der Betreff), die interne Notiz, Status setzen,
// ablehnen, archivieren, wiederherstellen, löschen, und die Wege der Antwort.
// Die App-Fassung (SupportVorgangDetailPage) und die Web-Fassung
// (web/WebVorgangDetail) zeigen dieselbe Logik; „Gemeinde anlegen" einer
// Anfrage steckt in useGemeindeAnlegen.
//
// Seit 11.10.2026 (docs/planung/support-detailseiten.md, Stufe verlauf) liefert
// der Hook auch, was die Detailseiten aus der Regel-Stelle zeigen: Stand
// (vorgangStand), Kennzahlen, Angaben; die Empfänger einer Antwort kommen aus
// dem Feld `empfaenger` der Detail-Antwort (mit den Absendern eingehender
// Mails) statt aus einem eigenen Abruf; „Danach" setzt nach dem Senden den
// Status; Ablehnen fragt zurück und schickt dann PATCH { status: 'erledigt' }
// (der Server lehnt die Anfrage dabei ab). Nach Erledigt, Archivieren und
// Löschen meldet `nachAbschluss` den Abschluss -- die Web-Fassung öffnet
// dann den nächsten Eintrag (Frage 6).
//
// Jede Änderung meldet „Support-Daten geändert" (utils/supportAktualisieren.ts):
// Der Vorgang selbst, die Liste, die Übersicht und die roten Zahlen der Leiste
// laden danach von selbst neu. Eine Eingabe, die noch nicht gespeichert ist
// (die Notiz), überschreibt das Neuladen nicht.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIonAlert, useIonRouter } from '@ionic/react';
import { useApp } from '../../contexts/AppContext';
import api from '../../services/api';
import type { GemeindeKurz, MailAntwortDaten, MailEmpfaenger, MailNachricht } from '../../types/support';
import type { AntwortDanach, AntwortFormularProps } from './useAntwortEditor';
import { fehlerStatus, fehlerText } from '../../utils/fehler';
import { offlineBlockiert } from '../../utils/offlineAktion';
import { gemeindenSortiert, standardBetreff, ungeleseneIds, ANFRAGE_BETREFF } from '../../utils/supportMail';
import {
  DANACH_VORGABE,
  ERLEDIGT_HINWEIS,
  antwortWegVon,
  danachWahlen,
  istArchiviert,
  istZugeordnet,
  vorgangAngaben,
  vorgangDetailLesen,
  vorgangKennzahlen,
  vorgangStand,
  type AngabenKarte,
  type AntwortWeg,
  type Einordnung,
  type Kennzahl,
  type StandAngabe,
  type VorgangDetail,
  type VorgangStatus,
} from '../../utils/supportVorgaenge';
import { ABLEHNEN_RUECKFRAGE, LOESCHEN_RUECKFRAGE } from '../../seiten/supportDetail';
import { mailsAlsGelesen } from '../../navigation/supportMailZaehler';
import { meldeSupportGeaendert, useSupportGeaendert, useSupportQuelle } from '../../utils/supportAktualisieren';
import { SUPPORT_VORGAENGE } from '../../navigation/supportMenue';
import { useGemeindeAnlegen } from './useGemeindeAnlegen';

// Was sich im Einordnen ändern lässt, steht seit 11.10.2026 an der Regel-Stelle
// (utils/supportVorgaenge.ts, mit Betreff); hier nur weitergereicht.
export type { Einordnung };

/** Ein Abschluss, nach dem der Vorgang aus „Offen" fällt. */
export type VorgangAbschluss = 'erledigt' | 'archiviert' | 'geloescht';

export interface VorgangDetailOptionen {
  /** Was nach dem Löschen geschieht; ohne: zurück zur Liste. */
  nachLoeschen?: () => void;
  /**
   * Nach Erledigt (auch über „Danach" und Ablehnen), Archivieren und Löschen.
   * Die Web-Fassung öffnet damit den nächsten Eintrag der Liste.
   */
  nachAbschluss?: (art: VorgangAbschluss, id: number) => void;
}

/**
 * @param optionen Was nach Löschen bzw. einem Abschluss geschieht. Eine
 *   Funktion allein ist `nachLoeschen` (so riefen es die Seiten bis 11.10.2026):
 *   Die Web-Fassung leert damit nur ihren Lesebereich -- sie steht schon in
 *   der Liste.
 */
export function useVorgangDetail(vorgangId: number, optionen?: (() => void) | VorgangDetailOptionen) {
  const { setError, setSuccess, isOnline } = useApp();
  const [presentAlert] = useIonAlert();
  const router = useIonRouter();
  // Quelle des Gelesen-Meldens: Das Laden danach weckt diese Seite nicht noch einmal.
  const quelle = useSupportQuelle();
  const { nachLoeschen, nachAbschluss } = typeof optionen === 'function' ? { nachLoeschen: optionen, nachAbschluss: undefined } : optionen ?? {};
  // Die Rückrufe ändern sich mit jedem Rendern der Seite; gerufen wird der jüngste
  // (nachgezogen nach jedem Rendern -- gerufen werden sie erst nach einem Aufruf).
  const rueckrufe = useRef({ nachLoeschen, nachAbschluss });
  useEffect(() => { rueckrufe.current = { nachLoeschen, nachAbschluss }; });

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
  // „Im Vorgang antworten" an einer Angabe: diese Adresse ist im Editor vorgewählt.
  const [antwortVorgabe, setAntwortVorgabe] = useState<string | null>(null);

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

  // Aenderungen an anderer Stelle (Liste, Posteingang, Antwort gesendet, Fenster wieder da).
  useSupportGeaendert(() => Promise.all([holen(false), gemeindenHolen()]), { quelle });

  const laden = () => {
    setLaedt(true);
    setFehler(false);
    return holen(true);
  };

  /** Ein Abschluss ist gemeldet: der Vorgang fällt aus „Offen". */
  const abgeschlossen = (art: VorgangAbschluss, id: number) => rueckrufe.current.nachAbschluss?.(art, id);

  // --- Einordnen: ein PATCH mit den geänderten Feldern -----------------------------
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
      ...(teil.betreff !== undefined ? { betreff: teil.betreff } : {}),
    });
    setSpeichert(true);
    try {
      await api.patch(`/support/vorgaenge/${vorgang.id}`, teil);
      setSuccess(teil.status === 'erledigt' ? 'Vorgang erledigt und ins Archiv gelegt' : 'Gespeichert');
      meldeSupportGeaendert();
      if (teil.status === 'erledigt') abgeschlossen('erledigt', vorgang.id);
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

  // --- Status setzen (Hauptknopf „Erledigt", „Danach") ------------------------------
  /**
   * PATCH { status }. `leise`: keine eigene Meldung und kein Neuladen -- für
   * „Danach", dort meldet der Editor. Erledigt meldet den Abschluss.
   */
  const statusPatchen = async (status: VorgangStatus, leise: boolean): Promise<boolean> => {
    if (!vorgang) return false;
    const id = vorgang.id;
    if (!leise) setSpeichert(true);
    try {
      await api.patch(`/support/vorgaenge/${id}`, { status });
      if (!leise) {
        setSuccess(status === 'erledigt' ? 'Vorgang erledigt und ins Archiv gelegt' : 'Gespeichert');
        meldeSupportGeaendert();
      }
      if (status === 'erledigt') abgeschlossen('erledigt', id);
      return true;
    } catch (err) {
      if (!leise) setError(fehlerText(err, 'Status konnte nicht gesetzt werden'));
      return false;
    } finally {
      if (!leise) setSpeichert(false);
    }
  };

  const statusSetzen = (status: VorgangStatus): Promise<boolean> => {
    if (!vorgang || offlineBlockiert(isOnline, setError)) return Promise.resolve(false);
    return statusPatchen(status, false);
  };

  // --- Ablehnen (Anfrage, noch nicht angelegt) ---------------------------------------
  const anlegen = useGemeindeAnlegen(vorgang?.anfrage ?? null);
  const ablehnbar = vorgang !== null && vorgang.anfrage !== null && anlegen.anlegbar && !istArchiviert(vorgang);

  /** Rückfrage mit der Folge; erst danach PATCH { status: 'erledigt' } -- der Server lehnt die Anfrage dabei ab. */
  const ablehnenFragen = () => {
    if (!vorgang || !ablehnbar || offlineBlockiert(isOnline, setError)) return;
    const id = vorgang.id;
    presentAlert({
      header: ABLEHNEN_RUECKFRAGE.header,
      message: ABLEHNEN_RUECKFRAGE.message,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: ABLEHNEN_RUECKFRAGE.knopf,
          role: 'destructive',
          handler: () => {
            void (async () => {
              setSpeichert(true);
              try {
                await api.patch(`/support/vorgaenge/${id}`, { status: 'erledigt' });
                setSuccess('Anfrage abgelehnt');
                meldeSupportGeaendert();
                abgeschlossen('erledigt', id);
              } catch (err) {
                setError(fehlerText(err, 'Anfrage konnte nicht abgelehnt werden'));
              } finally {
                setSpeichert(false);
              }
            })();
          },
        },
      ],
    });
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
  const archivieren = async (): Promise<boolean> => {
    if (!vorgang || offlineBlockiert(isOnline, setError)) return false;
    const id = vorgang.id;
    setSpeichert(true);
    try {
      await api.post(`/support/vorgaenge/${id}/archivieren`);
      setSuccess('Vorgang archiviert');
      meldeSupportGeaendert();
      abgeschlossen('archiviert', id);
      return true;
    } catch (err) {
      setError(fehlerText(err, 'Vorgang konnte nicht archiviert werden'));
      return false;
    } finally {
      setSpeichert(false);
    }
  };

  const wiederherstellen = async (): Promise<boolean> => {
    if (!vorgang || offlineBlockiert(isOnline, setError)) return false;
    setSpeichert(true);
    try {
      await api.post(`/support/vorgaenge/${vorgang.id}/wiederherstellen`);
      setSuccess('Vorgang wiederhergestellt – Status „In Arbeit“');
      meldeSupportGeaendert();
      return true;
    } catch (err) {
      setError(fehlerText(err, 'Vorgang konnte nicht wiederhergestellt werden'));
      return false;
    } finally {
      setSpeichert(false);
    }
  };

  const loeschenFragen = () => {
    if (!vorgang || offlineBlockiert(isOnline, setError)) return;
    const id = vorgang.id;
    const frage = LOESCHEN_RUECKFRAGE(vorgang.betreff, vorgang.anfrage !== null);
    presentAlert({
      header: frage.header,
      message: frage.message,
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
                abgeschlossen('geloescht', id);
                const { nachLoeschen: danachLoeschen } = rueckrufe.current;
                if (danachLoeschen) danachLoeschen();
                else router.push(SUPPORT_VORGAENGE, 'back', 'replace');
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

  /**
   * Die möglichen Empfänger, wie der Server sie liefert (Feld `empfaenger`
   * der Detail-Antwort): Absender eingehender Mails, Kontakt aus dem
   * Formular, Adresse der Anfrage, Gemeindeleitung, frühere Mails -- in
   * dieser Reihenfolge, mit dem Schlüssel des Servers als Herkunft. Bis
   * 11.10.2026 kamen sie getrennt über /support/gemeinden/:id/empfaenger,
   * ohne die Absender, und nur mit Gemeinde.
   */
  const empfaenger: MailEmpfaenger[] = useMemo(() => vorgang?.empfaenger ?? [], [vorgang]);

  /** Die jüngste eingehende Mail -- auf sie wird geantwortet. */
  const beantwortet: MailNachricht | null = useMemo(
    () => (vorgang ? [...vorgang.verlauf].reverse().find((m) => m.richtung === 'ein') ?? null : null),
    [vorgang],
  );

  const betreffVorschlag = useMemo(() => {
    if (!vorgang) return '';
    const letzte = vorgang.verlauf.length > 0 ? vorgang.verlauf[vorgang.verlauf.length - 1].betreff : null;
    return standardBetreff(letzte ?? (vorgang.anfrage ? ANFRAGE_BETREFF : vorgang.betreff));
  }, [vorgang]);

  /** „Im Vorgang antworten": diese Adresse vorwählen (die Seite öffnet den Editor). */
  const antwortAn = useCallback((adresse: string | null) => setAntwortVorgabe(adresse), []);

  const archiviert = vorgang !== null && istArchiviert(vorgang);

  // Nach dem Senden setzt „Danach" den Status (leise: Erfolg und Fehler meldet der Editor).
  // Gerufen wird statusPatchen aus dem jüngsten Rendern.
  const statusPatchenAktuell = useRef(statusPatchen);
  useEffect(() => { statusPatchenAktuell.current = statusPatchen; });
  // Ohne Wahl (erledigt oder im Archiv) kein „Danach": Die Antwort lässt den Status, wie er ist.
  const danach: AntwortDanach | null = useMemo(() => {
    const wahlen = vorgang ? danachWahlen(vorgang) : [];
    return wahlen.length > 0 ? {
      wahlen,
      vorgabe: DANACH_VORGABE,
      setzen: (s: VorgangStatus) => statusPatchenAktuell.current(s, true),
    } : null;
  }, [vorgang]);

  // Was das Antwortformular braucht -- fuer App (Modal) und Web (unter dem
  // Verlauf) dasselbe. null: Es gibt niemanden, dem sich antworten liesse (Fall 2).
  const antwort: AntwortFormularProps | null = useMemo(() => {
    if (!vorgang || !antwortWeg || antwortWeg.art === 'keiner') return null;
    const inListe = (a: string | null | undefined) => !!a && empfaenger.some((e) => e.adresse.toLowerCase() === a.toLowerCase());
    // Mit Gemeinde -- oder sobald mehr als eine Adresse in Frage kommt -- die Wahl
    // aus der Liste des Servers; sonst die eine Adresse fest (der Server nimmt sie).
    const mitWahl = antwortWeg.art === 'gemeinde' || empfaenger.length > 1;
    const festeAdresse = antwortWeg.art === 'gemeinde' ? null : antwortWeg.an;
    const vorgabe = inListe(antwortVorgabe) ? antwortVorgabe
      : beantwortet?.von_adresse || vorgang.kontakt_email || null;
    return {
      postfach: antwortWeg.postfach,
      platzhalterFuer: vorgang.anfrage ? { anfrage_id: vorgang.anfrage.id }
        : vorgang.organization_id !== null ? { organization_id: vorgang.organization_id } : null,
      betreffVorschlag,
      an: mitWahl ? null : empfaenger[0]?.adresse ?? festeAdresse,
      empfaenger: mitWahl ? empfaenger : null,
      empfaengerFehlt: false,
      empfaengerVorgabe: vorgabe,
      senden: (koerper: MailAntwortDaten) => api.post(`/support/vorgaenge/${vorgang.id}/antworten`, koerper),
      danach,
      beantwortet,
    };
  }, [vorgang, antwortWeg, betreffVorschlag, empfaenger, antwortVorgabe, beantwortet, danach]);

  // --- Regel-Stelle: Stand, Kennzahlen, Angaben -------------------------------------
  const stand: StandAngabe | null = useMemo(
    () => (vorgang ? vorgangStand(vorgang, { anlegbar: anlegen.anlegbar, angelegtUsername: anlegen.angelegt?.username ?? null }) : null),
    [vorgang, anlegen.anlegbar, anlegen.angelegt],
  );
  const kennzahlen: Kennzahl[] = useMemo(() => (vorgang ? vorgangKennzahlen(vorgang, neu.size) : []), [vorgang, neu]);
  // Steht der Kirchenkreis der Anfrage in der Struktur? Erst, wenn sie geladen ist (sonst unbekannt) --
  // geladen ist sie, sobald das Formular vorbelegt ist, auch wenn sie noch leer ist.
  // kirchenkreisFinden sagt null, wenn er fehlt (bis 11.10.2026 hieß hier jeder „steht in der Struktur",
  // und bei leerer Struktur stand gar nichts).
  const kirchenkreisInStruktur = vorgang?.anfrage && !anlegen.strukturFehlt && anlegen.formular !== null
    ? anlegen.kkGefunden !== null && anlegen.kkGefunden !== undefined : null;
  const angaben: AngabenKarte[] = useMemo(
    () => (vorgang ? vorgangAngaben(vorgang, { kirchenkreisInStruktur }) : []),
    [vorgang, kirchenkreisInStruktur],
  );

  /** „Lizenz ändern" geht nur im Vorgang „Lizenz und Abrechnung" mit zugeordneter Gemeinde. */
  const lizenzAenderbar = vorgang !== null && vorgang.art === 'lizenz' && istZugeordnet(vorgang) && vorgang.gemeinde !== null;

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
    antwortWeg,
    antwort,
    betreffVorschlag,
    beantwortet,
    antwortVorgabe,
    antwortAn,
    einordnen,
    statusSetzen,
    ablehnbar,
    ablehnenFragen,
    notiz,
    setNotiz,
    notizGeaendert,
    notizSpeichern,
    archivieren,
    wiederherstellen,
    loeschenFragen,
    archiviert,
    anlegen,
    stand,
    kennzahlen,
    angaben,
    lizenzAenderbar,
    erledigtHinweis: ERLEDIGT_HINWEIS,
  };
}

export type VorgangDetailDaten = ReturnType<typeof useVorgangDetail>;
