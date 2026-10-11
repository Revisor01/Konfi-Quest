// Material anlegen, bearbeiten und ansehen -- als Logik ohne Darstellung. Die
// App (Modal MaterialFormModal) und die Web-Fassung (Dialog
// web/leitung/WebMaterialDialog) zeigen dieselbe Logik (wie im Support:
// useEinsortieren, useNeuerVorgang; Simon, 11.10.2026: „Web braucht eigene
// kompaktere Modale überall"):
//
//   - Vorbelegt aus dem Material, das die Seite vorher geladen hat
//     (GET /material/:id); Events und Jahrgänge zur Auswahl laden hier.
//   - Prüfen: ein Titel, jede Adresse mit http:// oder https://.
//   - Speichern: PUT /material/:id bzw. POST /material, danach die neuen
//     Dateien an POST /material/:id/files (mit Fortschritt). Ohne Netz nur die
//     Angaben in die Warteschlange; Dateien gehen nur mit Netz.
//   - Dateien: vorhandene öffnen über den gemeinsamen Weg (useDateiOeffnen),
//     neue vor dem Hochladen im Betrachter ansehen; vorhandene löschen sofort.
//   - Fehler meldet die App als Meldung (setError); der Web-Dialog zeigt sie
//     im Fenster (fehlerImFenster). Eine Meldung der App läge dort unter dem
//     Dialog.
//   - Der Betrachter der App ist ein ion-modal. Der Web-Dialog liegt über
//     allen ion-modals und tritt zur Seite, solange er offen ist (betrachter).

import { useState, useEffect, useRef, useCallback } from 'react';
import { useIonAlert, useIonModal } from '@ionic/react';
import { useApp } from '../../../contexts/AppContext';
import { useActionGuard } from '../../../hooks/useActionGuard';
import { useDateiOeffnen, type BetrachterRueckrufe } from '../../../hooks/useDateiOeffnen';
import api, { DATEI_TIMEOUT_MS } from '../../../services/api';
import { writeQueue } from '../../../services/writeQueue';
import { networkMonitor } from '../../../services/networkMonitor';
import { medienVergessen } from '../../../services/mediaCache';
import { fuerUploadVorbereiten, DateiZuGrossFehler, UPLOAD_GRENZE } from '../../../services/mediaCompression';
import { dateiAuswaehlen, linkOeffnen } from '../../../services/systemDialoge';
import { materialInhalt, trackHandlung } from '../../../services/analytics';
import FileViewerModal from '../../shared/FileViewerModal';
import { fehlerText } from '../../../utils/fehler';
import { safeUUID } from '../../../utils/uuid';
import { istWebLink } from '../../../utils/linkDisplay';

/** Was die Leitung ins Material hochladen kann (Auswahl im System). */
export const MATERIAL_DATEIAUSWAHL = 'image/*,application/pdf,video/*,audio/*,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp';

export const TITEL_FEHLT = 'Bitte einen Titel eingeben';
export const LINK_UNGUELTIG = 'Der Link muss mit http:// oder https:// beginnen';
export const DATEI_LOESCHEN_FEHLER = 'Fehler beim Löschen der Datei';

export interface MaterialFile {
  id: number;
  original_name: string;
  stored_name: string;
  mime_type: string;
  file_size: number;
  created_at: string;
}

export interface EventOption {
  id: number;
  name: string;
  event_date?: string;
}

export interface JahrgangOption {
  id: number;
  name: string;
}

export interface Material {
  id: number;
  title: string;
  description?: string;
  event_id?: number;
  event_name?: string;
  events?: { id: number; name: string; event_date?: string }[];
  jahrgang_id?: number;
  jahrgang_name?: string;
  jahrgaenge?: { id: number; name: string }[];
  files?: MaterialFile[];
  link_url?: string | null;
  // Mehrere Links (seit 01.09.2026, Tabelle material_links). link_url bleibt
  // als Alt-Feld der Spiegel des ersten Links.
  links?: { id: number; url: string; created_at?: string }[];
  ist_global?: boolean;
  created_by?: number | null;
  created_by_name?: string | null;
  created_at: string;
}

export interface MaterialFormularOptionen {
  material?: Material | null;
  // Schreibschutz (Entscheidung Simon, 01.09.2026): Bearbeiten kann nur die
  // erstellende Person oder die Leitung. Wer es nicht darf, sieht das
  // Material trotzdem -- ohne Speichern, ohne Datei-Loeschen, ohne Upload.
  // Die verbindliche Pruefung macht der Server (403).
  nurLesen?: boolean;
  /** Nach dem Speichern bzw. Einreihen: Die Seite schließt und lädt neu. */
  onSuccess: () => void;
  /** Prüfung und Fehler im Fenster zeigen (Web-Dialog) statt als Meldung der App. */
  fehlerImFenster?: boolean;
  /**
   * Vor dem Betrachter der App und nach seinem Schließen (Web-Dialog: er
   * tritt zur Seite und kommt danach wieder). Ohne Angabe wie bisher.
   */
  betrachter?: BetrachterRueckrufe;
}

export function useMaterialFormular({
  material, nurLesen = false, onSuccess, fehlerImFenster = false, betrachter,
}: MaterialFormularOptionen) {
  const { setError, setSuccess, isOnline } = useApp();
  const [presentAlert] = useIonAlert();

  const [title, setTitleRoh] = useState(material?.title || '');
  const [description, setDescription] = useState(material?.description || '');
  const [eventIds, setEventIds] = useState<number[]>(
    material?.events?.map(e => e.id) || (material?.event_id ? [material.event_id] : [])
  );
  const [jahrgangIds, setJahrgangIds] = useState<number[]>(
    material?.jahrgaenge?.map(j => j.id) || (material?.jahrgang_id ? [material.jahrgang_id] : [])
  );
  const [existingFiles, setExistingFiles] = useState<MaterialFile[]>(material?.files || []);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  // Das beim Speichern NEU angelegte Material (30.09.2026). Das Formular legt
  // zuerst den Eintrag an und laedt danach die Dateien hoch. Scheitert der
  // Upload, steht das Material schon -- ohne diese Merkstelle legte jedes
  // weitere Speichern ein weiteres an, jeweils ohne Datei.
  const angelegtRef = useRef<number | null>(null);
  // MEHRERE LINKS UND DATEIEN PARALLEL (Entscheidung Simon, 01.09.2026):
  // Das Entweder-Oder vom 31.08. ist weg, beide Bereiche sind immer
  // sichtbar und beide optional. Ein gecachter Eintrag von vorher traegt
  // nur link_url (Spiegel des ersten Links) -- dann startet die Liste mit
  // diesem einen Link.
  //
  // Der Sichtbarkeits-Umschalter vom 31.08. ist ebenfalls weg (Simon,
  // 01.09.2026: "wenn kein Jahrgang dann global. Fertig. Sonst nur
  // Jahrgang."). ist_global wird nicht mehr mitgeschickt; der Server
  // leitet es aus der Jahrgangs-Zuordnung ab.
  const [linkUrls, setLinkUrlsRoh] = useState<string[]>(
    material?.links?.map(l => l.url)
    ?? (material?.link_url ? [material.link_url] : [])
  );
  const { isSubmitting, guard } = useActionGuard();
  const [sendeProzent, setSendeProzent] = useState(0);
  // Nur im Web-Dialog gesetzt (fehlerImFenster).
  const [fehler, setFehler] = useState<string | null>(null);

  const [events, setEvents] = useState<EventOption[]>([]);
  const [jahrgaenge, setJahrgaenge] = useState<JahrgangOption[]>([]);

  // Der Betrachter fuer neu angehaengte, noch nicht hochgeladene Dateien
  // (In-App Dateivorschau). Die Rueckrufe des Web-Dialogs ueber einen Verweis:
  // present liest sie erst beim Oeffnen.
  const betrachterRef = useRef(betrachter);
  useEffect(() => { betrachterRef.current = betrachter; }, [betrachter]);
  const viewerDataRef = useRef({ blobUrl: '', fileName: '', mimeType: '' });
  const [presentFileViewer, dismissFileViewer] = useIonModal(FileViewerModal, {
    get blobUrl() { return viewerDataRef.current.blobUrl; },
    get fileName() { return viewerDataRef.current.fileName; },
    get mimeType() { return viewerDataRef.current.mimeType; },
    onClose: () => {
      dismissFileViewer();
      if (viewerDataRef.current.blobUrl) {
        URL.revokeObjectURL(viewerDataRef.current.blobUrl);
        viewerDataRef.current = { blobUrl: '', fileName: '', mimeType: '' };
      }
    }
  });

  const openInAppViewer = useCallback((blob: Blob, fileName: string, mimeType: string) => {
    const url = URL.createObjectURL(new Blob([blob], { type: mimeType }));
    viewerDataRef.current = { blobUrl: url, fileName, mimeType };
    const rueckrufe = betrachterRef.current;
    if (rueckrufe) {
      // Im Browser in voller Groesse wie der Betrachter der vorhandenen
      // Dateien (cssClass, theme/web-modale.css); danach kommt der Dialog wieder.
      rueckrufe.vorher();
      presentFileViewer({ cssClass: 'file-viewer-modal', onDidDismiss: () => rueckrufe.nachher() });
      return;
    }
    presentFileViewer();
  }, [presentFileViewer]);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [eventsRes, jahrgaengeRes] = await Promise.all([
          api.get('/events'),
          api.get('/admin/jahrgaenge')
        ]);
        setEvents(eventsRes.data);
        setJahrgaenge(jahrgaengeRes.data);
      } catch {
        // Optionen laden fehlgeschlagen
      }
    };
    void loadOptions();
  }, []);

  // Zur Auswahl stehen anstehende Events -- und die schon zugeordneten, auch
  // wenn sie vorbei sind.
  const eventsZurAuswahl = events
    .filter(ev => new Date(ev.event_date || '') >= new Date(new Date().toDateString()) || eventIds.includes(ev.id));

  // Vorhandene Dateien über den gemeinsamen Weg von Chat, Challenges und dem
  // Material-Reiter (27.09.2026, Simon: „Fotos Anträge und Material ja
  // bitte."): Medien-Cache, Fortschritt in der Zeile, nativ mit Teilen und
  // Sichern, sonst der Betrachter. Vorher lud diese Stelle jede Datei bei
  // jedem Öffnen neu, mit eigenem Weg in die native Vorschau, und beim
  // Rückfall auf den Betrachter ein zweites Mal.
  const { dateiOeffnen, ladendeDatei } = useDateiOeffnen({
    quelle: 'material',
    kontext: () => existingFiles.map((f) => ({ pfad: f.stored_name, name: f.original_name, typ: f.mime_type })),
    fehlerOrt: 'material-admin-formular',
    betrachter: () => betrachterRef.current,
  });

  // LESE-ANSICHT DER VERWALTUNG (docs/messung/umami.md, S17): Material, das
  // diese Person nicht bearbeiten darf, ist ein Abruf wie im Material-Reiter
  // des Teams (U2) -- dieselben Ereignisse. Das eigene Material zum
  // Bearbeiten zu oeffnen, zaehlt nicht. Das Fenster oeffnet erst, nachdem
  // AdminMaterialPage GET /material/:id erfolgreich geladen hat; deshalb
  // genuegt hier das Einhaengen, einmal je Oeffnen.
  const angesehenGemeldet = useRef(false);
  useEffect(() => {
    if (!nurLesen || !material || angesehenGemeldet.current) return;
    angesehenGemeldet.current = true;
    trackHandlung('material-angesehen', {
      inhalt: materialInhalt(
        (material.files?.length ?? 0) > 0,
        (material.links?.length ?? 0) > 0 || !!material.link_url
      )
    });
  }, [nurLesen, material]);

  // Datei: erst gezaehlt, wenn sie wirklich geladen ist (nativ oder im
  // Betrachter -- beide Wege laufen durch dateiOeffnen und melden true).
  const openFile = async (file: MaterialFile) => {
    const geladen = await dateiOeffnen(file.stored_name, file.original_name, file.mime_type);
    if (geladen && nurLesen) trackHandlung('material-abgerufen', { inhalt: 'datei' });
  };

  // Ein Link der Lese-Ansicht im Web-Dialog (dort ein echter Link; in der App
  // steht er als schreibgeschuetztes Feld). Gezaehlt wie im Material-Reiter
  // des Teams (U2) -- nur in der Lese-Ansicht, ohne die Adresse.
  const linkAnsehen = (url: string) => {
    if (!istWebLink(url)) return;
    linkOeffnen(url);
    if (nurLesen) trackHandlung('material-abgerufen', { inhalt: 'link' });
  };

  // Eine gewählte Datei vorbereiten wie in Chat und Challenges: Fotos
  // verkleinern, dann gegen die Grenze des Servers prüfen (20 MB je Datei).
  // Was zu groß bleibt, kommt nicht in die Liste — mit demselben Satz wie
  // überall. Vorher ging jede Datei ungeprüft in die Liste und scheiterte
  // erst beim Speichern.
  const dateienVorbereiten = async (gewaehlt: File[]) => {
    const fertig: File[] = [];
    let zuGross: string | null = null;
    for (const datei of gewaehlt) {
      try {
        const { file, bildVorschau } = await fuerUploadVorbereiten(datei, UPLOAD_GRENZE.material);
        if (bildVorschau) URL.revokeObjectURL(bildVorschau);
        fertig.push(file);
      } catch (err) {
        if (err instanceof DateiZuGrossFehler) zuGross = err.message;
      }
    }
    if (zuGross) {
      if (fehlerImFenster) setFehler(zuGross);
      else setError(zuGross);
    }
    if (fertig.length > 0) setNewFiles(prev => [...prev, ...fertig]);
  };

  // Die Auswahl des Systems über die Hülle (services/systemDialoge): Sie
  // meldet den Ausflug der App-Sperre an — ohne ihn sperrte die Dateiauswahl
  // bei „Sofort" die App (Simons Befund 29.09.2026, Android). Sie liefert die
  // Liste schon ausgelesen und legt je Auswahl ein frisches Feld an; dieselbe
  // Datei ist damit gleich wieder wählbar.
  //
  // Die Liste geht als fertiges Array an dateienVorbereiten — nie aus einem
  // State-Updater heraus gelesen (Simons Befund 04.09.2026: "es passiert gar
  // nichts"; das Feld war geleert, bevor React den Updater aufrief).
  const dateienWaehlen = async () => {
    const gewaehlt = await dateiAuswaehlen({ accept: MATERIAL_DATEIAUSWAHL, multiple: true });
    if (gewaehlt && gewaehlt.length > 0) {
      void dateienVorbereiten(gewaehlt);
    }
  };

  const removeNewFile = (index: number) => {
    setNewFiles(prev => prev.filter((_, i) => i !== index));
  };

  /** Eine vorhandene Datei sofort am Server löschen (ohne Rückfrage); true, wenn es geklappt hat. */
  const dateiLoeschen = async (file: MaterialFile): Promise<boolean> => {
    try {
      await api.delete(`/material/files/${file.id}`);
      setExistingFiles(prev => prev.filter(f => f.id !== file.id));
      // Auch vom eigenen Gerät (27.09.2026): Sonst läge die Datei
      // weiter im Medien-Cache, obwohl es sie nicht mehr gibt.
      await medienVergessen(file.stored_name, 'material');
      return true;
    } catch {
      if (fehlerImFenster) setFehler(DATEI_LOESCHEN_FEHLER);
      else setError(DATEI_LOESCHEN_FEHLER);
      return false;
    }
  };

  // Die Rueckfrage der App. Der Web-Dialog fragt in der Zeile der Datei: Ein
  // Ionic-Alert laege unter ihm.
  const handleDeleteExistingFile = (file: MaterialFile) => {
    presentAlert({
      header: 'Datei löschen',
      message: `"${file.original_name}" wirklich löschen?`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: async () => {
            await dateiLoeschen(file);
          }
        }
      ]
    });
  };

  const handleSave = async () => {
    // Doppelter Boden zum ausgeblendeten Speichern-Knopf -- der Server
    // wuerde ohnehin mit 403 antworten (Ersteller-Regel, 01.09.2026).
    if (nurLesen) return;
    if (!title.trim()) {
      if (fehlerImFenster) setFehler(TITEL_FEHLT);
      else setError(TITEL_FEHLT);
      return;
    }

    // Vorab-Pruefung im Formular, damit der Fehler ohne Netz sichtbar wird.
    // Die verbindliche Pruefung macht der Server (routes/material.js).
    // Leere Eingabefelder fallen still heraus, sie sind kein Fehler.
    const bereinigt = linkUrls.map(l => l.trim()).filter(l => l !== '');
    if (bereinigt.some(l => !istWebLink(l))) {
      if (fehlerImFenster) setFehler(LINK_UNGUELTIG);
      else setError(LINK_UNGUELTIG);
      return;
    }
    setFehler(null);

    await guard(async () => {
      // Steht das Material, fehlen nur noch die Dateien: dann sagt die Meldung
      // genau das, statt "Fehler beim Speichern".
      let dateienStehenAus = false;
      try {
        const payload = {
          title: title.trim(),
          description: description.trim() || null,
          event_ids: eventIds,
          jahrgang_ids: jahrgangIds,
          // Mehrere Links (01.09.2026). Das Alt-Feld link_url pflegt der
          // Server als Spiegel des ersten Links selbst.
          //
          // ist_global wird bewusst NICHT mehr mitgeschickt: Der Server
          // leitet die Sichtbarkeit aus der Jahrgangs-Zuordnung ab (keine
          // Jahrgaenge -> fuer alle Teamer:innen).
          link_urls: bereinigt
        };

        if (networkMonitor.isOnline) {
          // Online-Pfad: direkt senden
          let materialId = material?.id ?? angelegtRef.current ?? undefined;

          if (materialId) {
            await api.put(`/material/${materialId}`, payload);
          } else {
            const res = await api.post('/material', payload);
            materialId = res.data.id;
            angelegtRef.current = res.data.id;
          }

          // Neue Dateien hochladen -- unabhaengig von den Links, beides
          // ist parallel erlaubt (01.09.2026).
          if (newFiles.length > 0 && materialId) {
            dateienStehenAus = true;
            const formData = new FormData();
            newFiles.forEach(file => {
              formData.append('files', file);
            });
            // Mit Sende-Anzeige wie beim Challenge-Einreichen und dem
            // Zeitlimit für Dateien: Zehn Dateien zu 20 MB brauchen länger
            // als die 20 s, die sonst gelten.
            await api.post(`/material/${materialId}/files`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
              timeout: DATEI_TIMEOUT_MS,
              onUploadProgress: (event) => {
                if (event.total) setSendeProzent(Math.round((event.loaded * 100) / event.total));
              }
            });
            dateienStehenAus = false;
          }

          // Anonyme Messung, erst wenn ALLE Aufrufe des Online-Zweigs durch
          // sind — also nach dem Anlegen UND dem Datei-Upload. Gemessen wird
          // nur neu eingestelltes Material, nicht das Nachbessern eines
          // vorhandenen: gezaehlt werden soll bereitgestellte Arbeit.
          //
          // Nur die Art des Inhalts — kein Titel, kein Dateiname, keine
          // Anzahl, keine Jahrgaenge.
          if (!material) {
            const hatDatei = newFiles.length > 0;
            const hatLink = bereinigt.length > 0;
            trackHandlung('material-bereitgestellt', {
              inhalt: materialInhalt(hatDatei, hatLink)
            });
          }

        } else {
          // Offline-Pfad: Nur Metadaten queuen (Dateien nur online)
          await writeQueue.enqueue({
            method: material ? 'PUT' : 'POST',
            url: material ? `/material/${material.id}` : '/material',
            body: payload,
            maxRetries: 5,
            hasFileUpload: false,
            metadata: { type: 'admin', clientId: safeUUID(), label: material ? 'Material bearbeiten' : 'Material erstellen' },
          });

          if (newFiles.length > 0) {
            setSuccess('Material-Metadaten werden offline gespeichert. Dateien kannst du hochladen sobald du wieder online bist');
          } else {
            setSuccess('Material wird gespeichert sobald du wieder online bist');
          }
        }

        onSuccess();
      } catch (err) {
        // Mit Ort und Fehlerobjekt: Die Messung sieht sonst nur den
        // Ersatztext, nicht WARUM der Upload scheiterte (Netz, Zeitgrenze,
        // Status) -- genau das fehlte beim Android-Befund 01.10.2026
        // (services/uploadDiagnose.ts). Der Web-Dialog zeigt den Satz im
        // Fenster, ohne Messung (wie die Dialoge des Supports).
        const meldung = fehlerText(err, dateienStehenAus
          ? 'Das Material ist gespeichert, die Dateien noch nicht. Tippe noch einmal auf Speichern.'
          : 'Fehler beim Speichern');
        if (fehlerImFenster) setFehler(meldung);
        else setError(meldung, { ort: dateienStehenAus ? 'material-dateien-hochladen' : 'material-speichern', fehler: err });
      } finally {
        setSendeProzent(0);
      }
    });
  };

  return {
    title,
    setTitle: (wert: string) => { setFehler(null); setTitleRoh(wert); },
    description,
    setDescription,
    eventIds,
    setEventIds,
    jahrgangIds,
    setJahrgangIds,
    events,
    /** Anstehende Events und die schon zugeordneten. */
    eventsZurAuswahl,
    jahrgaenge,
    linkUrls,
    setLinkUrls: (wert: string[] | ((vorher: string[]) => string[])) => { setFehler(null); setLinkUrlsRoh(wert); },
    existingFiles,
    newFiles,
    dateienWaehlen,
    removeNewFile,
    dateiLoeschen,
    handleDeleteExistingFile,
    openFile,
    openInAppViewer,
    ladendeDatei,
    linkAnsehen,
    isSubmitting,
    sendeProzent,
    /** Für den Hinweis im Web-Dialog: Ohne Netz gehen nur die Angaben in die Warteschlange. */
    ohneNetz: !isOnline,
    fehler,
    handleSave,
  };
}

export type MaterialFormularZustand = ReturnType<typeof useMaterialFormular>;
