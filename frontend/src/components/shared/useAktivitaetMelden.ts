// „Aktivität melden" von Konfis und Team -- als Logik ohne Darstellung. Die
// App (Modale konfi/modals/ActivityRequestModal und
// teamer/modals/TeamerActivityRequestModal) und die Web-Fassung (Dialog
// shared/web/termine/WebAktivitaetMeldenDialog) zeigen dieselbe Logik (wie im
// Support: useEinsortieren, useNeuerVorgang). Konfi und Team unterscheiden
// sich nur in den Routen und im Satz, wenn das Foto fehlt (ROLLEN).
//
//   - Laden: die Aktivitäten zur Wahl aus dem Cache (useOfflineQuery,
//     Stammdaten) -- offline bleibt die Liste gefüllt (Offline-Audit
//     25.08.2026).
//   - Vorbelegt: Datum heute, keine Aktivität, Anmerkungen leer, kein Foto.
//   - Foto: dieselbe Dateiauswahl wie überall (dateiAuswaehlen, die einzige
//     Datei-Eingabe der App), verkleinert wie in Chat und Challenges
//     (fuerUploadVorbereiten, Grenze nachweisfoto), hochgeladen über
//     POST /konfi/upload-photo -- auch beim Team.
//   - Melden: POST /konfi/requests bzw. /teamer/requests
//       { activity_id, description, requested_date, photo_filename, client_id }
//     Ohne Netz -- oder wenn es beim Senden abreißt -- in die Warteschlange,
//     das Foto lokal gesichert (sendenOderEinreihen). Danach die
//     Erfolgsmeldung und onSuccess (die Seite lädt neu, das Fenster schließt).
//   - Fehler meldet die App als Meldung (setError); der Web-Dialog zeigt sie
//     im Fenster (fehlerImFenster). Ohne Foto fragt die App mit einer
//     Rückfrage nach, der Web-Dialog im Fenster (fragOhneFoto).

import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useActionGuard } from '../../hooks/useActionGuard';
import { useOfflineQuery } from '../../hooks/useOfflineQuery';
import api from '../../services/api';
import { writeQueue, type QueueBody } from '../../services/writeQueue';
import { warteschlangenDateiSichern } from '../../services/warteschlangenDatei';
import { networkMonitor } from '../../services/networkMonitor';
import { CACHE_TTL } from '../../services/offlineCache';
import { fuerUploadVorbereiten, DateiZuGrossFehler, UPLOAD_GRENZE } from '../../services/mediaCompression';
import { dateiAuswaehlen } from '../../services/systemDialoge';
import { track } from '../../services/analytics';
import type { AktivitaetMelden } from '../../types/request';
import { fehlerText, fehlerTextOderMessage } from '../../utils/fehler';
import { safeUUID } from '../../utils/uuid';
import { sendenOderEinreihen, istVerbindungsabbruch } from '../../utils/sendenOderEinreihen';

export type MeldeRolle = 'konfi' | 'team';

/** Eine Aktivität zur Wahl, wie GET /konfi/activities bzw. /teamer/activities sie liefern. */
export interface MeldeAktivitaet {
  id: number;
  name: string;
  description?: string;
  // Teamer-Aktivitäten haben KEINE Punkte und KEINEN Typ: points ist 0,
  // type ist in der Datenbank NULL. Die Deklaration als non-nullable war
  // schlicht falsch — genau dieses Muster (null dort annehmen, wo ein Wert
  // versprochen wird) hat schon zweimal zum Absturz geführt.
  points?: number | null;
  type?: 'gottesdienst' | 'gemeinde' | null;
  category_names?: string;
}

/** Was Konfis und Team unterscheidet. */
export const MELDE_ROLLEN: Record<MeldeRolle, { cache: string; liste: string; antrag: string; ohneFoto: string }> = {
  konfi: {
    cache: 'konfi:activities:',
    liste: '/konfi/activities',
    antrag: '/konfi/requests',
    ohneFoto: 'Normalerweise gehört ein Foto dazu, damit dein Team sieht, dass du dabei warst. Trotzdem abschicken?',
  },
  team: {
    cache: 'teamer:activities:',
    liste: '/teamer/activities',
    antrag: '/teamer/requests',
    ohneFoto: 'Aktivitäten benötigen normalerweise ein Foto als Nachweis. Möchtest du trotzdem fortfahren?',
  },
};

export const AKTIVITAET_FEHLT = 'Bitte wähle eine Aktivität aus';
/** Nur im Browser erreichbar: Das Datumsfeld lässt sich leeren, der Kalender der App nicht. */
export const DATUM_FEHLT = 'Bitte wähle ein Datum aus';

/** Heute als "2026-10-11", wie die App das Datum seit jeher vorbelegt. */
export const heuteAlsDatum = () => new Date().toISOString().split('T')[0];

export interface AktivitaetMeldenOptionen {
  rolle: MeldeRolle;
  /** Nach dem Melden (gesendet oder eingereiht): die Seite lädt neu und schließt das Fenster. */
  onSuccess: () => void;
  /**
   * Ohne Foto: nachfragen. `weiter` meldet trotzdem. Die App zeigt eine
   * Rückfrage, der Web-Dialog einen Hinweis im Fenster.
   */
  fragOhneFoto: (weiter: () => Promise<void>) => void;
  /** Prüfung und Fehler im Fenster zeigen (Web-Dialog) statt als Meldung der App. */
  fehlerImFenster?: boolean;
}

export function useAktivitaetMelden({ rolle, onSuccess, fragOhneFoto, fehlerImFenster = false }: AktivitaetMeldenOptionen) {
  const { setSuccess, setError: meldungDerApp, user, isOnline } = useApp();
  const routen = MELDE_ROLLEN[rolle];

  const { isSubmitting, guard } = useActionGuard();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fehler, setFehler] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    activity_id: '',
    description: '',
    requested_date: heuteAlsDatum(),
    photo_file: null as File | null
  });
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Aktivitaeten aus dem Cache statt per Direkt-Abruf: Der VERSAND einer
  // Meldung ist laengst queue-faehig, aber die Auswahlliste lud per
  // api.get — offline blieb sie leer und das Formular damit nutzlos
  // (Offline-Audit 25.08.2026). Aktivitaeten sind Stammdaten und aendern
  // sich selten, daher STAMMDATEN-TTL.
  const { data: activitiesData, loading } = useOfflineQuery<MeldeAktivitaet[]>(
    routen.cache + user?.organization_id,
    () => api.get(routen.liste).then(r => r.data),
    { ttl: CACHE_TTL.STAMMDATEN }
  );
  const activities = activitiesData || [];

  // Prüfung und Fehler: in der App als Meldung (setError aus AppContext,
  // mit der anonymen Fehlermessung), im Web-Dialog im Fenster. Heißt
  // bewusst setError: Die Positivliste der Fehlertexte
  // (bekannteFehlertexte.test.ts) liest die Texte an den Aufrufstellen von
  // setError -- in der App gehen sie genau dorthin.
  // Ist der Dialog schon fort (er ist während des Sendens gesperrt, aber die
  // Seite kann verlassen werden), käme ein Fehler im Fenster nirgends an: Er
  // geht dann als Meldung der App.
  const dialogDa = useRef(true);
  useEffect(() => {
    dialogDa.current = true;
    return () => { dialogDa.current = false; };
  }, []);
  const setError = (text: string) => (fehlerImFenster && dialogDa.current ? setFehler(text) : meldungDerApp(text));

  const aendern = (teil: Partial<Omit<typeof formData, 'photo_file'>>) => {
    setFehler(null);
    setFormData(prev => ({ ...prev, ...teil }));
  };

  const fotoUebernehmen = async (file: File) => {
    try {
      // Derselbe Weg wie in Chat und Challenges (27.09.2026): erst
      // verkleinern (1920 px, JPEG), DANN gegen die Grenze des Servers prüfen
      // — Live-Kamerafotos haben 8-16 MB und passen erst danach. Zu groß
      // meldet derselbe Satz wie überall: "Datei ist zu groß (max. 5 MB)."
      const { file: prepared, bildVorschau } = await fuerUploadVorbereiten(file, UPLOAD_GRENZE.nachweisfoto);
      // Die Vorschau entsteht unten als data-URL (bleibt gültig, auch wenn
      // das Formular schließt); die Blob-URL der Verkleinerung wird frei.
      if (bildVorschau) URL.revokeObjectURL(bildVorschau);
      setFehler(null);
      setFormData(prev => ({ ...prev, photo_file: prepared }));

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(prepared);
    } catch (err) {
      setError(err instanceof DateiZuGrossFehler ? err.message : 'Foto konnte nicht verarbeitet werden');
    }
  };

  // Über die Hülle (services/systemDialoge): Sie meldet den Ausflug der
  // App-Sperre an — ohne ihn sperrte die Fotoauswahl bei „Sofort" die App
  // (Simons Befund 29.09.2026, Android). Im Browser dieselbe Auswahl
  // (<input type="file" accept="image/*">, angelegt in der Hülle).
  const handlePhotoSelect = async () => {
    const auswahl = await dateiAuswaehlen({ accept: 'image/*' });
    if (auswahl) await fotoUebernehmen(auswahl[0]);
  };

  const uploadPhoto = async (): Promise<string | null> => {
    if (!formData.photo_file) return null;

    const uploadFormData = new FormData();
    uploadFormData.append('photo', formData.photo_file);

    try {
      const response = await api.post('/konfi/upload-photo', uploadFormData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        // Foto-Upload auf Mobilfunk kann laenger dauern als die globalen 20s
        timeout: 60000,
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
          }
        }
      });

      return response.data.filename;
    } catch (error) {
      // Netz abgerissen: unverpackt weiterreichen, damit der Vorgang in die
      // Warteschlange faellt (sendenOderEinreihen erkennt nur den Netzfehler).
      if (istVerbindungsabbruch(error)) throw error;
      throw new Error(fehlerText(error, 'Fehler beim Hochladen des Fotos'), { cause: error });
    }
  };

  const submitRequest = async () => {
    await guard(async () => {
      setUploadProgress(0);
      setFehler(null);

      const clientId = safeUUID();

      // In die Warteschlange: derselbe Vorgang mit derselben client_id, das
      // Foto lokal gesichert (die Warteschlange laedt es beim Senden hoch).
      let fotoNichtGesichert = false;
      const einreihen = async () => {
        let hasFileUpload = false;
        const queueBody: QueueBody & AktivitaetMelden = {
          activity_id: parseInt(formData.activity_id),
          description: formData.description.trim(),
          requested_date: formData.requested_date,
          client_id: clientId,
        };

        if (formData.photo_file) {
          // Foto lokal speichern
          hasFileUpload = true;
          try {
            const reader = new FileReader();
            const base64 = await new Promise<string>((resolve, reject) => {
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(formData.photo_file!);
            });
            const fileName = `queue_${clientId}_photo.jpg`;
            queueBody._localPhotoPath = await warteschlangenDateiSichern(fileName, base64);
            queueBody._photoFileName = formData.photo_file.name;
          } catch (fehlerBeimSichern) {
            fotoNichtGesichert = true;
            throw fehlerBeimSichern;
          }
        }

        await writeQueue.enqueue({
          method: 'POST',
          url: routen.antrag,
          body: queueBody,
          maxRetries: 5,
          hasFileUpload,
          metadata: {
            type: 'request',
            clientId,
            label: 'Aktivität melden',
          },
        });
      };

      try {
        // Offline -- oder online, aber das Netz reisst ab: in die
        // Warteschlange statt in eine Fehlermeldung (Audit Grundgeruest
        // BF-01, utils/sendenOderEinreihen.ts). Ein zweiter Eingang ist
        // harmlos: Der Server erkennt ihn an der client_id.
        const { weg } = await sendenOderEinreihen({
          online: networkMonitor.isOnline,
          methode: 'POST',
          idempotent: true,
          senden: async () => {
            let photoFilename: string | null = null;

            if (formData.photo_file) {
              photoFilename = await uploadPhoto();
            }

            const requestData: AktivitaetMelden = {
              activity_id: parseInt(formData.activity_id),
              description: formData.description.trim(),
              requested_date: formData.requested_date,
              photo_filename: photoFilename,
              client_id: clientId,
            };

            await api.post(routen.antrag, requestData);
            // Anonyme Messung (Simon, 27.09.2026): Wie oft werden Aktivitäten
            // eingereicht, und mit Nachweisfoto? Erst nach der erfolgreichen
            // Antwort; kein Name, keine Aktivität, keine Kennung.
            track('aktivitaet-eingereicht', { mit_foto: !!photoFilename });
          },
          einreihen,
        });

        setSuccess(weg === 'eingereiht'
          ? 'Aktivität wird gesendet sobald du wieder online bist'
          : 'Aktivität erfolgreich eingereicht!');
        onSuccess();
      } catch (error) {
        setError(fotoNichtGesichert
          ? 'Foto konnte nicht lokal gespeichert werden'
          : fehlerTextOderMessage(error, 'Fehler beim Einreichen der Aktivität'));
      } finally {
        setUploadProgress(0);
      }
    });
  };

  /**
   * Prüft und meldet. Ohne Foto fragt erst `fragOhneFoto` nach; wer die
   * Frage schon beantwortet hat (Web-Dialog: „Ohne Foto fortfahren"), gibt
   * `ohneFotoBestaetigt` mit.
   */
  const handleSubmit = async (ohneFotoBestaetigt = false) => {
    if (!formData.activity_id) {
      setError(AKTIVITAET_FEHLT);
      return;
    }
    if (!formData.requested_date) {
      setError(DATUM_FEHLT);
      return;
    }

    if (!formData.photo_file && ohneFotoBestaetigt !== true) {
      fragOhneFoto(submitRequest);
      return;
    }

    await submitRequest();
  };

  const removePhoto = () => {
    setFormData(prev => ({ ...prev, photo_file: null }));
    setPhotoPreview(null);
  };

  const selectedActivity = activities.find(a => a.id.toString() === formData.activity_id);

  return {
    activities,
    loading,
    formData,
    aendern,
    selectedActivity,
    photoPreview,
    handlePhotoSelect,
    removePhoto,
    handleSubmit,
    isSubmitting,
    uploadProgress,
    /** Nur im Web-Dialog: Prüfung oder Fehler. */
    fehler,
    /** Für den Hinweis im Web-Dialog: Ohne Netz geht die Meldung in die Warteschlange. */
    ohneNetz: !isOnline,
    /** Der Satz der Rückfrage ohne Foto, je Rolle. */
    ohneFotoFrage: routen.ohneFoto,
  };
}

export type AktivitaetMeldenZustand = ReturnType<typeof useAktivitaetMelden>;
