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

import { useCallback, useEffect, useState } from 'react';
import { useIonAlert } from '@ionic/react';
import { useApp } from '../../contexts/AppContext';
import api from '../../services/api';
import type { AnfrageAngelegt, GemeindeAnfrage, Kirchenkreis, Landeskirche } from '../../types/support';
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

export function useGemeindeAnlegen(anfrage: GemeindeAnfrage | null) {
  const { setError, setSuccess, isOnline } = useApp();
  const [presentAlert] = useIonAlert();

  const [kirchenkreise, setKirchenkreise] = useState<Kirchenkreis[]>([]);
  const [landeskirchen, setLandeskirchen] = useState<Landeskirche[]>([]);
  const [strukturFehlt, setStrukturFehlt] = useState(false);
  const [formular, setFormular] = useState<AnlegenFormular | null>(null);
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
      if (aktiv) setFormular((vorher) => vorher ?? anlegenVorbelegen(anfrage, kreise));
    });
    return () => { aktiv = false; };
    // Nur bei einer anderen Anfrage neu vorbelegen, nicht bei jeder neuen Antwort des Servers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anfrageId, anlegbar, strukturLaden]);

  const aendern = (teil: Partial<AnlegenFormular>) => setFormular((f) => (f ? { ...f, ...teil } : f));

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
      meldeSupportGeaendert();
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
                setSuccess('Gemeinde angelegt');
                meldeSupportGeaendert();
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
  const wunsch = lizenzFinden(anfrage?.wunsch_lizenz ?? null);
  const gemeindeId = angelegt?.organization_id ?? anfrage?.organization_id ?? null;
  const kkGefunden = anfrage ? kirchenkreisFinden(anfrage.kirchenkreis, anfrage.landeskirche, kirchenkreise) : undefined;
  const gewaehlterKreis = formular ? kirchenkreise.find((k) => k.id === formular.kirchenkreisId) : undefined;

  return {
    isOnline,
    anlegbar,
    kirchenkreise,
    strukturFehlt,
    formular,
    setFormular,
    aendern,
    eigenesLimit,
    setEigenesLimit,
    passwortZeigen,
    setPasswortZeigen,
    legtAn,
    angelegt,
    kirchenkreisAnlegen,
    anlegen,
    wunsch,
    gemeindeId,
    kkGefunden,
    gewaehlterKreis,
  };
}

export type GemeindeAnlegenDaten = ReturnType<typeof useGemeindeAnlegen>;
