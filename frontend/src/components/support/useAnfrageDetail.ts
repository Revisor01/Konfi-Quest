// Eine Anfrage der Support-Ansicht als Logik ohne Darstellung
// (/admin/support/anfragen/:id, Entscheidung 4 und 5, 02.10.2026; Verlauf
// 03.10.2026): laden (es gibt keine Route fuer eine einzelne Anfrage -- die
// Seite holt die Liste und nimmt sich ihren Eintrag), Status und Notiz
// speichern, den Kirchenkreis der Anfrage in der Struktur anlegen, die
// Gemeinde mit erster Gemeindeleitung anlegen (POST
// /support/anfragen/:id/anlegen, eine Transaktion) und den Verlauf der Mails.
// Die App-Fassung (SupportAnfrageDetailPage) und die Web-Fassung
// (web/WebAnfrageDetail) zeigen dieselbe Logik.

import { useCallback, useEffect, useState } from 'react';
import { useIonAlert } from '@ionic/react';
import { useApp } from '../../contexts/AppContext';
import api from '../../services/api';
import type {
  AnfrageAngelegt,
  AnfrageStatus,
  GemeindeAnfrage,
  Kirchenkreis,
  Landeskirche,
  MailNachricht,
} from '../../types/support';
import {
  ANFRAGE_STATUS,
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
import { chronologisch, ungeleseneIds } from '../../utils/supportMail';
import { mailsAlsGelesen } from '../../navigation/supportMailZaehler';

export function useAnfrageDetail(anfrageId: number) {
  const { setError, setSuccess, isOnline } = useApp();
  const [presentAlert] = useIonAlert();

  const [anfrage, setAnfrage] = useState<GemeindeAnfrage | null>(null);
  const [kirchenkreise, setKirchenkreise] = useState<Kirchenkreis[]>([]);
  const [landeskirchen, setLandeskirchen] = useState<Landeskirche[]>([]);
  const [strukturFehlt, setStrukturFehlt] = useState(false);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState(false);

  // Bearbeitung
  const [status, setStatus] = useState<AnfrageStatus>('neu');
  const [notiz, setNotiz] = useState('');
  const [speichert, setSpeichert] = useState(false);

  // Gemeinde anlegen
  const [formular, setFormular] = useState<AnlegenFormular | null>(null);
  // "Eigenes Limit …" gewaehlt: Zahlenfeld statt Tarif (wie unter Gemeinden).
  const [eigenesLimit, setEigenesLimit] = useState(false);
  const [passwortZeigen, setPasswortZeigen] = useState(false);
  const [legtAn, setLegtAn] = useState(false);
  const [angelegt, setAngelegt] = useState<(AnfrageAngelegt & { username: string }) | null>(null);

  // Verlauf der Mails (Support-Mail)
  const [verlauf, setVerlauf] = useState<MailNachricht[] | null>(null);
  const [verlaufFehler, setVerlaufFehler] = useState(false);
  const [neueMails, setNeueMails] = useState<ReadonlySet<number>>(new Set());

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

  // Erst warten, dann Zustand setzen (der erste Abruf laeuft im Effekt).
  const holen = useCallback(async () => {
    try {
      const [antwort, kreise] = await Promise.all([
        api.get('/support/anfragen'),
        strukturLaden(),
      ]);
      const gefunden = (Array.isArray(antwort.data) ? antwort.data : []).find((a) => a.id === anfrageId) ?? null;
      setAnfrage(gefunden);
      if (gefunden) {
        setStatus(gefunden.status);
        setNotiz(gefunden.notiz ?? '');
        setFormular((vorher) => vorher ?? anlegenVorbelegen(gefunden, kreise));
      }
      setFehler(false);
    } catch {
      setAnfrage(null);
      setFehler(true);
    } finally {
      setLaedt(false);
    }
  }, [anfrageId, strukturLaden]);

  useEffect(() => { void holen(); }, [holen]);

  // Erst warten, dann Zustand setzen. „Neu" behalten die Mails, die beim
  // ersten Anzeigen ungelesen waren -- auch nachdem sie gemeldet sind.
  const verlaufHolen = useCallback(async (ersterAbruf: boolean) => {
    try {
      const antwort = await api.get(`/support/anfragen/${anfrageId}/verlauf`);
      const liste = chronologisch(Array.isArray(antwort.data) ? antwort.data as MailNachricht[] : []);
      const ungelesen = ungeleseneIds(liste);
      setVerlauf(liste);
      setVerlaufFehler(false);
      if (ersterAbruf) setNeueMails(new Set(ungelesen));
      void mailsAlsGelesen(ungelesen);
    } catch {
      setVerlaufFehler(true);
    }
  }, [anfrageId]);

  useEffect(() => { void verlaufHolen(true); }, [verlaufHolen]);

  // Nach dem Senden: Verlauf neu; eine neue Anfrage steht danach „in
  // Arbeit" (das setzt der Server, Vertrag „Antworten"). Die Auswahl im
  // Formular folgt nur, solange dort nichts anderes gewaehlt ist.
  const nachDemSenden = () => {
    void verlaufHolen(false);
    if (anfrage?.status === 'neu') {
      setAnfrage({ ...anfrage, status: 'in_arbeit' });
      setStatus((s) => (s === 'neu' ? 'in_arbeit' : s));
    }
  };

  const laden = () => {
    setLaedt(true);
    setFehler(false);
    return holen();
  };

  const aendern = (teil: Partial<AnlegenFormular>) => setFormular((f) => (f ? { ...f, ...teil } : f));

  const bearbeitungSpeichern = async () => {
    if (!anfrage || offlineBlockiert(isOnline, setError)) return;
    setSpeichert(true);
    try {
      const koerper: { status?: AnfrageStatus; notiz: string | null } = { notiz: notiz.trim() || null };
      if (status !== anfrage.status) koerper.status = status;
      const antwort = await api.patch(`/support/anfragen/${anfrage.id}`, koerper);
      const neu = antwort.data && typeof antwort.data === 'object' ? { ...anfrage, ...antwort.data } : { ...anfrage, ...koerper };
      setAnfrage(neu);
      setStatus(neu.status);
      setNotiz(neu.notiz ?? '');
      setSuccess('Anfrage gespeichert');
    } catch (err) {
      setError(fehlerText(err, 'Anfrage konnte nicht gespeichert werden'));
    } finally {
      setSpeichert(false);
    }
  };

  // Steht der Kirchenkreis der Anfrage noch nicht in der Struktur, legt ihn
  // ein Schritt an (mit der Landeskirche, wenn es sie schon gibt) und waehlt
  // ihn aus.
  const kirchenkreisAnlegen = async () => {
    if (!anfrage?.kirchenkreis || offlineBlockiert(isOnline, setError)) return;
    try {
      const lk = landeskircheFinden(anfrage.landeskirche, landeskirchen);
      await api.post('/support/kirchenkreise', { name: anfrage.kirchenkreis.trim(), landeskirche_id: lk ? lk.id : null });
      const kreise = await strukturLaden();
      const neu = kirchenkreisFinden(anfrage.kirchenkreis, anfrage.landeskirche, kreise);
      if (neu) aendern({ kirchenkreisId: neu.id });
      setSuccess('Kirchenkreis angelegt');
    } catch (err) {
      setError(fehlerText(err, 'Kirchenkreis konnte nicht angelegt werden'));
    }
  };

  const anlegen = async () => {
    if (!anfrage || !formular || offlineBlockiert(isOnline, setError)) return;
    const meldung = anlegenFehler(formular);
    if (meldung) {
      setError(meldung);
      return;
    }
    const koerper = anlegenKoerper(formular);
    presentAlert({
      header: 'Gemeinde anlegen',
      message: `„${koerper.display_name}“ mit der Gemeindeleitung „${koerper.admin_display_name}“ (${koerper.admin_username}) anlegen?`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Anlegen',
          handler: () => {
            void (async () => {
              setLegtAn(true);
              try {
                const antwort = await api.post(`/support/anfragen/${anfrage.id}/anlegen`, koerper);
                setAngelegt({ ...antwort.data, username: koerper.admin_username });
                setAnfrage({ ...anfrage, status: 'angelegt', organization_id: antwort.data?.organization_id ?? null });
                setStatus('angelegt');
                setSuccess('Gemeinde angelegt');
              } catch (err) {
                setError(fehlerText(err, 'Gemeinde konnte nicht angelegt werden'));
              } finally {
                setLegtAn(false);
              }
            })();
          },
        },
      ],
    });
  };

  // Abgeleitetes -- fuer beide Fassungen gleich.
  const statusInfo = ANFRAGE_STATUS[anfrage?.status ?? 'neu'] ?? ANFRAGE_STATUS.neu;
  const wunsch = lizenzFinden(anfrage?.wunsch_lizenz ?? null);
  const gemeindeId = angelegt?.organization_id ?? anfrage?.organization_id ?? null;
  const kkGefunden = anfrage ? kirchenkreisFinden(anfrage.kirchenkreis, anfrage.landeskirche, kirchenkreise) : undefined;
  const geaendert = anfrage ? status !== anfrage.status || (notiz.trim() || null) !== (anfrage.notiz?.trim() || null) : false;
  const gewaehlterKreis = formular ? kirchenkreise.find((k) => k.id === formular.kirchenkreisId) : undefined;

  return {
    isOnline,
    anfrage,
    kirchenkreise,
    strukturFehlt,
    laedt,
    fehler,
    status,
    setStatus,
    notiz,
    setNotiz,
    speichert,
    formular,
    setFormular,
    aendern,
    eigenesLimit,
    setEigenesLimit,
    passwortZeigen,
    setPasswortZeigen,
    legtAn,
    angelegt,
    verlauf,
    verlaufFehler,
    neueMails,
    verlaufHolen,
    nachDemSenden,
    laden,
    bearbeitungSpeichern,
    kirchenkreisAnlegen,
    anlegen,
    statusInfo,
    wunsch,
    gemeindeId,
    kkGefunden,
    geaendert,
    gewaehlterKreis,
  };
}

export type AnfrageDetailDaten = ReturnType<typeof useAnfrageDetail>;
