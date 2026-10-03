// „Neuer Vorgang" als Logik ohne Darstellung (docs/planung/support-vorgaenge.md,
// Entscheidung 1: „durch den Support selbst, z. B. um eine Gemeinde
// anzuschreiben"; Schriftwechsel einer Gemeinde = die Liste ihrer Vorgänge,
// „Schreiben" legt einen Vorgang an). Art, Bereich, Dringlichkeit, Betreff,
// Gemeinde und -- optional -- die erste Mail an eine Adresse der Gemeinde. Die
// Web-Fassung (Dialog, web/WebNeuerVorgang) und die App-Fassung (Abschnitt auf
// der Seite der Vorgänge) zeigen dieselbe Logik.
//
// POST /support/vorgaenge antwortet mit dem neuen Vorgang; die Seite wird
// danach geöffnet. Eine Antwort ohne Kennung (älterer oder anderer Stand des
// Servers) schließt nur: Die Liste lädt über „Support-Daten geändert" neu.

import { useEffect, useState } from 'react';
import { useIonRouter } from '@ionic/react';
import { useApp } from '../../contexts/AppContext';
import api from '../../services/api';
import type { GemeindeKurz, MailEmpfaenger } from '../../types/support';
import { fehlerText } from '../../utils/fehler';
import { offlineBlockiert } from '../../utils/offlineAktion';
import { empfaengerLesen, gemeindenSortiert } from '../../utils/supportMail';
import {
  LEERER_VORGANG,
  neuerVorgangFehler,
  neuerVorgangKoerper,
  type NeuerVorgangFormular,
} from '../../utils/supportVorgaenge';
import { meldeSupportGeaendert } from '../../utils/supportAktualisieren';

export function useNeuerVorgang(vorbelegt: Partial<NeuerVorgangFormular> = {}, onFertig?: () => void) {
  const { setError, setSuccess, isOnline } = useApp();
  const router = useIonRouter();

  const [formular, setFormular] = useState<NeuerVorgangFormular>({ ...LEERER_VORGANG, ...vorbelegt });
  const [gemeinden, setGemeinden] = useState<GemeindeKurz[]>([]);
  const [gemeindenFehlt, setGemeindenFehlt] = useState(false);
  const [empfaenger, setEmpfaenger] = useState<MailEmpfaenger[]>([]);
  const [empfaengerFehlt, setEmpfaengerFehlt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [sendet, setSendet] = useState(false);

  useEffect(() => {
    let aktiv = true;
    void api.get('/organizations').then(
      (antwort) => {
        if (!aktiv) return;
        setGemeinden(Array.isArray(antwort.data) ? gemeindenSortiert(antwort.data) : []);
        setGemeindenFehlt(!Array.isArray(antwort.data));
      },
      () => { if (aktiv) setGemeindenFehlt(true); },
    );
    return () => { aktiv = false; };
  }, []);

  // Die Gemeinde gewaehlt: ihre Adressen fuer die erste Mail. Genau eine
  // Adresse ist vorgewaehlt, bei mehreren wird bewusst gewaehlt.
  const organizationId = formular.organizationId;
  useEffect(() => {
    if (!organizationId) {
      setEmpfaenger([]);
      setEmpfaengerFehlt(false);
      return undefined;
    }
    let aktiv = true;
    void api.get(`/support/gemeinden/${organizationId}/empfaenger`).then(
      (antwort) => {
        if (!aktiv) return;
        const liste = empfaengerLesen(antwort.data);
        setEmpfaenger(liste);
        setEmpfaengerFehlt(false);
        setFormular((f) => (f.organizationId === organizationId && liste.length === 1 && !f.an ? { ...f, an: liste[0].adresse } : f));
      },
      () => { if (aktiv) { setEmpfaenger([]); setEmpfaengerFehlt(true); } },
    );
    return () => { aktiv = false; };
  }, [organizationId]);

  const aendern = (teil: Partial<NeuerVorgangFormular>) => {
    setFehler(null);
    setFormular((f) => {
      const neu = { ...f, ...teil };
      // Eine andere Gemeinde: die Adresse der alten gilt nicht mehr.
      if (teil.organizationId !== undefined && teil.organizationId !== f.organizationId && teil.an === undefined) neu.an = '';
      return neu;
    });
  };

  const absenden = async () => {
    if (offlineBlockiert(isOnline, setError)) return;
    const meldung = neuerVorgangFehler(formular);
    if (meldung) {
      setFehler(meldung);
      return;
    }
    setSendet(true);
    try {
      const antwort = await api.post('/support/vorgaenge', neuerVorgangKoerper(formular));
      const id = typeof antwort.data?.id === 'number' ? antwort.data.id : null;
      setSuccess(id ? `Vorgang ${id} angelegt` : 'Vorgang angelegt');
      meldeSupportGeaendert();
      onFertig?.();
      if (id) router.push(`/admin/support/vorgaenge/${id}`);
    } catch (err) {
      setFehler(fehlerText(err, 'Vorgang konnte nicht angelegt werden'));
    } finally {
      setSendet(false);
    }
  };

  return { isOnline, formular, aendern, gemeinden, gemeindenFehlt, empfaenger, empfaengerFehlt, fehler, sendet, absenden };
}

export type NeuerVorgangZustand = ReturnType<typeof useNeuerVorgang>;
