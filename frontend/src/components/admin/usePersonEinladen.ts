// Eine Person, die schon ein Konto hat, in diese Gemeinde einladen -- die
// Logik ohne Darstellung: Rollen laden, Kennung und Rolle, Senden an
// POST /einladungen, Meldungen. Die App zeigt sie im Modal
// modals/EinladungModal, der Browser ab 992 px im Dialog
// web/leitung/WebPersonEinladenDialog (Simon, 15.10.2026: jedes Formular, das
// im Browser noch ein Modal der App öffnet, bekommt ein kompaktes Fenster der
// Web-Fassung; in den Apps und unter 992 px bleibt das Modal, wie es ist).
//
// Aus EinladungModal herausgezogen (15.10.2026): Route, Rumpf und Texte
// unverändert. Unterschied je Fassung nur bei Fehlern: Die App meldet sie
// oben (setError), der Dialog des Browsers in sich selbst (`fehlerImDialog`).
// Die Erfolgsmeldung kommt in beiden oben -- dann ist das Fenster schon zu.
//
// KEINE SUCHLISTE: Gesucht wird exakt nach Benutzername oder E-Mail. Ein
// Suchfeld über den ganzen Bestand hätte jeder Gemeindeleitung erlaubt, die
// Nutzenden aller anderen Gemeinden zu durchblättern.
//
// KONFI STEHT NICHT ZUR WAHL (Simon: "Konfi ist nie möglich. Ist logisch.")
// -- Konfis gehören zu einem Jahrgang und kommen über einen Einladungscode.
// Der Server weist die Rolle zusätzlich ab.

import { useEffect, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useActionGuard } from '../../hooks/useActionGuard';
import api from '../../services/api';
import { trackHandlung, serverSchluesselMesswert } from '../../services/analytics';
import { fehlerText } from '../../utils/fehler';

export interface EinladungsRolle {
  id: number;
  name: string;
  display_name: string;
}

export interface PersonEinladenOptionen {
  /** Gesendet: das Fenster schließen, die Listen neu laden. */
  onSuccess: () => void;
  /** Fehler im Fenster zeigen (`fehler`; Dialog des Browsers) statt oben (App). */
  fehlerImDialog?: boolean;
}

export function usePersonEinladen({ onSuccess, fehlerImDialog = false }: PersonEinladenOptionen) {
  const { setError: setMeldungOben, setSuccess, isOnline } = useApp();
  const { isSubmitting, guard } = useActionGuard();
  const [kennung, setKennungRoh] = useState('');
  const [rolleId, setRolleIdRoh] = useState<number | null>(null);
  const [rollen, setRollen] = useState<EinladungsRolle[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    let abgemeldet = false;
    api.get('/roles')
      .then((res) => {
        if (abgemeldet) return;
        const alle: EinladungsRolle[] = Array.isArray(res.data) ? res.data : [];
        // Konfi faellt raus -- siehe Kopfkommentar.
        setRollen(alle.filter((r) => r.name !== 'konfi' && r.name !== 'super_admin'));
      })
      .catch(() => { if (!abgemeldet) setRollen([]); });
    return () => { abgemeldet = true; };
  }, []);

  /** Jede Eingabe nimmt eine alte Meldung im Fenster weg. */
  const setKennung = (wert: string) => {
    setFehler(null);
    setKennungRoh(wert);
  };
  const setRolleId = (id: number | null) => {
    setFehler(null);
    setRolleIdRoh(id);
  };

  /**
   * Eine Meldung dort, wo die Fassung sie zeigt. Heißt bewusst setError: Die
   * Positivliste der Fehlertexte (bekannteFehlertexte.test.ts) liest die
   * festen Texte an setError-Aufrufen.
   */
  const setError = (text: string) => {
    if (fehlerImDialog) setFehler(text);
    else setMeldungOben(text);
  };

  const istGueltig = kennung.trim().length > 0 && rolleId !== null;

  const einladen = () => guard(async () => {
    if (!istGueltig) return;
    setFehler(null);
    try {
      const res = await api.post('/einladungen', { kennung: kennung.trim(), role_id: rolleId });
      // Anonyme Messung NACH der erfolgreichen Antwort (docs/messung/umami.md,
      // S10): nur die feste Zielrolle -- nie die eingegebene Kennung.
      trackHandlung('einladung-gesendet', {
        rolle_ziel: serverSchluesselMesswert(rollen.find((r) => r.id === rolleId)?.name)
      });
      setSuccess(`${res.data.display_name} wurde eingeladen und entscheidet jetzt selbst.`);
      onSuccess();
    } catch (err) {
      setError(fehlerText(err, 'Die Einladung konnte nicht gesendet werden'));
    }
  }).catch(() => undefined); // Ein zweiter Klick während des Sendens wird verworfen.

  return { kennung, setKennung, rolleId, setRolleId, rollen, istGueltig, isSubmitting, isOnline, fehler, einladen };
}
