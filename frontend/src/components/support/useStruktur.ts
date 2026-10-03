// Struktur der Support-Ansicht als Logik ohne Darstellung
// (/admin/support/struktur, Entscheidung 3, 02.10.2026): Landeskirchen und
// Kirchenkreise laden, anlegen, umbenennen, loeschen (mit Rueckfrage) und
// einen Kirchenkreis einer Landeskirche zuordnen. Die App-Fassung
// (SupportStrukturPage) und die Web-Fassung (web/WebStruktur) zeigen
// dieselbe Logik.
//
// Eine Landeskirche mit Kirchenkreisen laesst sich nicht loeschen (der Server
// antwortet 409); das sagt die Seite vorher. Ein geloeschter Kirchenkreis
// nimmt seinen Gemeinden nur die Zuordnung.

import { useCallback, useEffect, useState } from 'react';
import { useIonAlert } from '@ionic/react';
import { useApp } from '../../contexts/AppContext';
import api from '../../services/api';
import type { Kirchenkreis, Landeskirche } from '../../types/support';
import { fehlerText } from '../../utils/fehler';
import { offlineBlockiert } from '../../utils/offlineAktion';

export function useStruktur() {
  const { setError, setSuccess, isOnline } = useApp();
  const [presentAlert] = useIonAlert();

  const [landeskirchen, setLandeskirchen] = useState<Landeskirche[] | null>(null);
  const [kirchenkreise, setKirchenkreise] = useState<Kirchenkreis[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState(false);
  const [beschaeftigt, setBeschaeftigt] = useState(false);

  const [neueLk, setNeueLk] = useState('');
  const [neuerKk, setNeuerKk] = useState('');
  const [neuerKkLk, setNeuerKkLk] = useState<number | null>(null);
  const [lkBearbeiten, setLkBearbeiten] = useState<{ id: number; name: string } | null>(null);
  const [kkBearbeiten, setKkBearbeiten] = useState<{ id: number; name: string; landeskircheId: number | null } | null>(null);

  // Erst warten, dann Zustand setzen (der erste Abruf laeuft im Effekt).
  const holen = useCallback(async () => {
    try {
      const [lk, kk] = await Promise.all([
        api.get('/support/landeskirchen'),
        api.get('/support/kirchenkreise'),
      ]);
      setLandeskirchen(Array.isArray(lk.data) ? lk.data : []);
      setKirchenkreise(Array.isArray(kk.data) ? kk.data : []);
      setFehler(false);
    } catch {
      setLandeskirchen(null);
      setFehler(true);
    } finally {
      setLaedt(false);
    }
  }, []);

  useEffect(() => { void holen(); }, [holen]);

  const laden = useCallback(() => {
    setLaedt(true);
    setFehler(false);
    return holen();
  }, [holen]);

  /** Eine Aenderung ausfuehren, danach neu laden; Fehler als Meldung. */
  const ausfuehren = async (aktion: () => Promise<unknown>, erfolg: string, ersatz: string): Promise<boolean> => {
    if (offlineBlockiert(isOnline, setError)) return false;
    setBeschaeftigt(true);
    try {
      await aktion();
      setSuccess(erfolg);
      await holen();
      return true;
    } catch (err) {
      setError(fehlerText(err, ersatz));
      return false;
    } finally {
      setBeschaeftigt(false);
    }
  };

  // Die vier Speichern-Funktionen sagen, ob es geklappt hat: Die Web-Fassung
  // schliesst danach ihren Dialog (die App ignoriert den Rueckgabewert).
  const landeskircheAnlegen = async (): Promise<boolean> => {
    const name = neueLk.trim();
    if (!name) { setError('Bitte einen Namen eingeben'); return false; }
    if (await ausfuehren(() => api.post('/support/landeskirchen', { name }), 'Landeskirche angelegt', 'Landeskirche konnte nicht angelegt werden')) {
      setNeueLk('');
      return true;
    }
    return false;
  };

  const kirchenkreisAnlegen = async (): Promise<boolean> => {
    const name = neuerKk.trim();
    if (!name) { setError('Bitte einen Namen eingeben'); return false; }
    if (await ausfuehren(() => api.post('/support/kirchenkreise', { name, landeskirche_id: neuerKkLk }), 'Kirchenkreis angelegt', 'Kirchenkreis konnte nicht angelegt werden')) {
      setNeuerKk('');
      return true;
    }
    return false;
  };

  const landeskircheSpeichern = async (): Promise<boolean> => {
    if (!lkBearbeiten) return false;
    const name = lkBearbeiten.name.trim();
    if (!name) { setError('Bitte einen Namen eingeben'); return false; }
    if (await ausfuehren(() => api.put(`/support/landeskirchen/${lkBearbeiten.id}`, { name }), 'Landeskirche gespeichert', 'Landeskirche konnte nicht gespeichert werden')) {
      setLkBearbeiten(null);
      return true;
    }
    return false;
  };

  const kirchenkreisSpeichern = async (): Promise<boolean> => {
    if (!kkBearbeiten) return false;
    const name = kkBearbeiten.name.trim();
    if (!name) { setError('Bitte einen Namen eingeben'); return false; }
    if (await ausfuehren(
      () => api.put(`/support/kirchenkreise/${kkBearbeiten.id}`, { name, landeskirche_id: kkBearbeiten.landeskircheId }),
      'Kirchenkreis gespeichert',
      'Kirchenkreis konnte nicht gespeichert werden'
    )) {
      setKkBearbeiten(null);
      return true;
    }
    return false;
  };

  const landeskircheLoeschen = (lk: Landeskirche, anzahlKreise: number) => {
    if (anzahlKreise > 0) {
      presentAlert({
        header: 'Landeskirche nicht löschbar',
        message: anzahlKreise === 1
          ? `An „${lk.name}“ hängt noch ein Kirchenkreis. Ordne ihn zuerst einer anderen Landeskirche zu oder lösche ihn.`
          : `An „${lk.name}“ hängen noch ${anzahlKreise} Kirchenkreise. Ordne sie zuerst einer anderen Landeskirche zu oder lösche sie.`,
        buttons: [{ text: 'Verstanden', role: 'cancel' }],
      });
      return;
    }
    presentAlert({
      header: 'Landeskirche löschen',
      message: `„${lk.name}“ wirklich löschen?`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Löschen', role: 'destructive',
          handler: () => { void ausfuehren(() => api.delete(`/support/landeskirchen/${lk.id}`), 'Landeskirche gelöscht', 'Landeskirche konnte nicht gelöscht werden'); },
        },
      ],
    });
  };

  const kirchenkreisLoeschen = (kk: Kirchenkreis) => {
    presentAlert({
      header: 'Kirchenkreis löschen',
      message: `„${kk.name}“ wirklich löschen? Gemeinden in diesem Kirchenkreis verlieren nur die Zuordnung; sie selbst bleiben unverändert.`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Löschen', role: 'destructive',
          handler: () => { void ausfuehren(() => api.delete(`/support/kirchenkreise/${kk.id}`), 'Kirchenkreis gelöscht', 'Kirchenkreis konnte nicht gelöscht werden'); },
        },
      ],
    });
  };

  return {
    isOnline,
    landeskirchen,
    kirchenkreise,
    laedt,
    fehler,
    beschaeftigt,
    neueLk,
    setNeueLk,
    neuerKk,
    setNeuerKk,
    neuerKkLk,
    setNeuerKkLk,
    lkBearbeiten,
    setLkBearbeiten,
    kkBearbeiten,
    setKkBearbeiten,
    laden,
    landeskircheAnlegen,
    kirchenkreisAnlegen,
    landeskircheSpeichern,
    kirchenkreisSpeichern,
    landeskircheLoeschen,
    kirchenkreisLoeschen,
  };
}

export type StrukturDaten = ReturnType<typeof useStruktur>;
