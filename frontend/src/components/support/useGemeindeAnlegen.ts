// „Gemeinde anlegen" aus einer Anfrage als Logik ohne Darstellung -- im Vorgang
// einer Anfrage (Art „Neue Gemeinde"). Vorher Teil der Seite einer Anfrage
// (useAnfrageDetail, Entscheidung 4 und 5, 02.10.2026); die Anfrage hat seit
// den Vorgängen (docs/planung/support-vorgaenge.md) keine eigene Seite mehr,
// das Anlegen gehört in ihren Vorgang.
//
// Das Formular ist aus der Anfrage vorbelegt (Name, Kirchenkreis -- gesucht in
// der Struktur --, Kontakt, Testphase mit 5 Konfis, erste Gemeindeleitung).
// Angelegt wird mit POST /support/anfragen/:id/anlegen: Gemeinde und
// Gemeindeleitung in EINER Transaktion, mit derselben Logik wie
// POST /organizations. Steht der Kirchenkreis der Anfrage noch nicht in der
// Struktur, legt ihn ein Schritt an. Die App-Fassung (SupportVorgangDetailPage)
// und die Web-Fassung (web/WebVorgangDetail) zeigen dieselbe Logik.
//
// Die Rückfrage vor dem Anlegen: Die App fragt mit `anlegen` per ion-alert.
// Die Web-Fassung prüft mit `anlegenPruefen`, fragt in einem zweiten Fenster
// über ihrem Dialog, wie beim Event, und legt mit `anlegenAusfuehren` an.

import { useCallback, useEffect, useState } from 'react';
import { useIonAlert } from '@ionic/react';
import { useApp } from '../../contexts/AppContext';
import api from '../../services/api';
import type { AnfrageAngelegt, AnfrageAnlegenDaten, GemeindeAnfrage, Kirchenkreis, Landeskirche } from '../../types/support';
import {
  anlegenFehler,
  anlegenKoerper,
  anlegenVorbelegen,
  kirchenkreisFinden,
  landeskircheFinden,
  type AnlegenFormular,
} from '../../utils/supportAnfragen';
import { fehlerText } from '../../utils/fehler';
import { offlineBlockiert } from '../../utils/offlineAktion';
import { lizenzFinden } from '../../utils/lizenzen';
import { meldeSupportGeaendert } from '../../utils/supportAktualisieren';

/** Die Rückfrage vor dem Anlegen -- in der App als ion-alert, im Browser als zweites Fenster. */
export const ANLEGEN_RUECKFRAGE = {
  header: 'Gemeinde anlegen',
  /** Titel des Fensters im Browser: als Frage, damit es sich vom Dialog darunter unterscheidet. */
  titel: 'Gemeinde anlegen?',
  frage: (k: AnfrageAnlegenDaten) => `„${k.display_name}“ mit der Gemeindeleitung „${k.admin_display_name}“ (${k.admin_username}) anlegen?`,
  abbrechen: 'Abbrechen',
  anlegen: 'Anlegen',
} as const;

export function useGemeindeAnlegen(anfrage: GemeindeAnfrage | null) {
  const { setError, setSuccess, isOnline } = useApp();
  const [presentAlert] = useIonAlert();

  const [kirchenkreise, setKirchenkreise] = useState<Kirchenkreis[]>([]);
  const [landeskirchen, setLandeskirchen] = useState<Landeskirche[]>([]);
  const [strukturFehlt, setStrukturFehlt] = useState(false);
  const [formular, setFormular] = useState<AnlegenFormular | null>(null);
  // Die Vorbelegung aus der Anfrage: Weicht das Formular davon ab, fragt das
  // Schließen zurück (sonst ginge etwa ein erzeugtes Passwort verloren).
  const [vorbelegt, setVorbelegt] = useState<AnlegenFormular | null>(null);
  // "Eigenes Limit …" gewaehlt: Zahlenfeld statt Tarif (wie unter Gemeinden).
  const [eigenesLimit, setEigenesLimit] = useState(false);
  const [passwortZeigen, setPasswortZeigen] = useState(false);
  const [legtAn, setLegtAn] = useState(false);
  const [angelegt, setAngelegt] = useState<(AnfrageAngelegt & { username: string }) | null>(null);

  const strukturLaden = useCallback(async (): Promise<Kirchenkreis[]> => {
    const [kk, lk] = await Promise.allSettled([
      api.get('/support/kirchenkreise'),
      api.get('/support/landeskirchen'),
    ]);
    const kreise = kk.status === 'fulfilled' && Array.isArray(kk.value.data) ? kk.value.data : [];
    setKirchenkreise(kreise);
    setLandeskirchen(lk.status === 'fulfilled' && Array.isArray(lk.value.data) ? lk.value.data : []);
    setStrukturFehlt(kk.status !== 'fulfilled');
    return kreise;
  }, []);

  // Die Struktur holen und das Formular EINMAL vorbelegen -- spaetere Ladevorgaenge
  // des Vorgangs (Meldung, Fenster wieder da) lassen eine begonnene Eingabe in Ruhe.
  const anfrageId = anfrage?.id ?? null;
  const anlegbar = anfrage !== null && anfrage.status !== 'angelegt';
  useEffect(() => {
    if (!anfrage || !anlegbar) return undefined;
    let aktiv = true;
    void strukturLaden().then((kreise) => {
      if (!aktiv) return;
      const start = anlegenVorbelegen(anfrage, kreise);
      setFormular((vorher) => vorher ?? start);
      setVorbelegt((vorher) => vorher ?? start);
    });
    return () => { aktiv = false; };
    // Nur bei einer anderen Anfrage neu vorbelegen, nicht bei jeder neuen Antwort des Servers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anfrageId, anlegbar, strukturLaden]);

  const aendern = (teil: Partial<AnlegenFormular>) => setFormular((f) => (f ? { ...f, ...teil } : f));

  /**
   * Zurück auf die Vorbelegung aus der Anfrage, gerechnet mit der Struktur,
   * wie sie jetzt ist: Formular UND Vorbelegung zusammen, dazu Tarif-Wahl
   * und Passwort-Anzeige. Danach ist nichts geändert (Verwerfen beim
   * Schließen). Bis 11.10.2026 setzte der Dialog nur das Formular neu; die
   * Vorbelegung blieb auf dem alten Stand, und jedes weitere Schließen fragte
   * „Eingaben verwerfen?".
   */
  const zuruecksetzen = () => {
    const start = anfrage && anlegbar ? anlegenVorbelegen(anfrage, kirchenkreise) : null;
    setFormular(start);
    setVorbelegt(start);
    setEigenesLimit(false);
    setPasswortZeigen(false);
  };

  // Steht der Kirchenkreis der Anfrage noch nicht in der Struktur, legt ihn
  // ein Schritt an (mit der Landeskirche, wenn es sie schon gibt) und waehlt
  // ihn aus. Er gehoert dann zur Vorbelegung -- so haette das Formular von
  // Anfang an ausgesehen; Schliessen fragt deshalb nicht zurueck, nur weil er
  // angelegt wurde (bis 11.10.2026 galt das als Eingabe).
  const kirchenkreisAnlegen = async () => {
    if (!anfrage?.kirchenkreis || offlineBlockiert(isOnline, setError)) return;
    try {
      const lk = landeskircheFinden(anfrage.landeskirche, landeskirchen);
      await api.post('/support/kirchenkreise', { name: anfrage.kirchenkreis.trim(), landeskirche_id: lk ? lk.id : null });
      const kreise = await strukturLaden();
      const neu = kirchenkreisFinden(anfrage.kirchenkreis, anfrage.landeskirche, kreise);
      if (neu) {
        aendern({ kirchenkreisId: neu.id });
        setVorbelegt((v) => (v ? { ...v, kirchenkreisId: neu.id } : v));
      }
      setSuccess('Kirchenkreis angelegt');
      meldeSupportGeaendert();
    } catch (err) {
      setError(fehlerText(err, 'Kirchenkreis konnte nicht angelegt werden'));
    }
  };

  /** Prüft das Formular: der Körper zum Anlegen, oder `null` mit Meldung (offline, Felder fehlen). */
  const anlegenPruefen = (): AnfrageAnlegenDaten | null => {
    if (!anfrage || !formular || offlineBlockiert(isOnline, setError)) return null;
    const meldung = anlegenFehler(formular);
    if (meldung) {
      setError(meldung);
      return null;
    }
    return anlegenKoerper(formular);
  };

  /** Legt an, ohne zu fragen -- die Rückfrage stellt vorher `anlegen` (App) bzw. der Dialog (Browser). */
  const anlegenAusfuehren = async (koerper: AnfrageAnlegenDaten) => {
    if (!anfrage) return;
    setLegtAn(true);
    try {
      const antwort = await api.post(`/support/anfragen/${anfrage.id}/anlegen`, koerper);
      setAngelegt({ ...antwort.data, username: koerper.admin_username });
      setSuccess('Gemeinde angelegt');
      meldeSupportGeaendert();
    } catch (err) {
      setError(fehlerText(err, 'Gemeinde konnte nicht angelegt werden'));
    } finally {
      setLegtAn(false);
    }
  };

  /** Die App-Fassung: prüfen, per ion-alert fragen, anlegen. */
  const anlegen = async () => {
    const koerper = anlegenPruefen();
    if (!koerper) return;
    presentAlert({
      header: ANLEGEN_RUECKFRAGE.header,
      message: ANLEGEN_RUECKFRAGE.frage(koerper),
      buttons: [
        { text: ANLEGEN_RUECKFRAGE.abbrechen, role: 'cancel' },
        { text: ANLEGEN_RUECKFRAGE.anlegen, handler: () => { void anlegenAusfuehren(koerper); } },
      ],
    });
  };

  // Abgeleitetes -- fuer beide Fassungen gleich.
  const wunsch = lizenzFinden(anfrage?.wunsch_lizenz ?? null);
  const gemeindeId = angelegt?.organization_id ?? anfrage?.organization_id ?? null;
  const kkGefunden = anfrage ? kirchenkreisFinden(anfrage.kirchenkreis, anfrage.landeskirche, kirchenkreise) : undefined;
  const gewaehlterKreis = formular ? kirchenkreise.find((k) => k.id === formular.kirchenkreisId) : undefined;
  /** Etwas am Formular ist anders als vorbelegt -- dann fragt das Schließen des Dialogs bzw. Modals zurück. */
  const geaendert = formular !== null && vorbelegt !== null
    && (Object.keys(vorbelegt) as Array<keyof AnlegenFormular>).some((feld) => formular[feld] !== vorbelegt[feld]);

  return {
    geaendert,
    isOnline,
    anlegbar,
    kirchenkreise,
    strukturFehlt,
    formular,
    setFormular,
    aendern,
    zuruecksetzen,
    eigenesLimit,
    setEigenesLimit,
    passwortZeigen,
    setPasswortZeigen,
    legtAn,
    angelegt,
    kirchenkreisAnlegen,
    anlegen,
    anlegenPruefen,
    anlegenAusfuehren,
    wunsch,
    gemeindeId,
    kkGefunden,
    gewaehlterKreis,
  };
}

export type GemeindeAnlegenDaten = ReturnType<typeof useGemeindeAnlegen>;
