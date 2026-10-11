// Ein Zertifikat (Art eines Zertifikats fuers Team) anlegen oder bearbeiten --
// die Logik des Formulars ohne Darstellung: Vorbelegung, Pruefen, Speichern
// (mit Warteschlange) und die Meldungen. Die App zeigt sie im Modal
// CertificateModal (admin/pages/AdminCertificatesPage.tsx), der Browser ab
// 992 px im Dialog web/leitung/WebZertifikatDialog.tsx (Simon, 11.10.2026:
// „Web braucht eigene kompaktere Modale überall").
//
// Aus CertificateModal herausgezogen (11.10.2026): Verhalten und Texte der
// App unveraendert; Fehler zeigt der Dialog im Browser in sich selbst
// (`fehlerImDialog`, wie useKategorieFormular).

import { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import api from '../../services/api';
import { networkMonitor } from '../../services/networkMonitor';
import { writeQueue } from '../../services/writeQueue';
import { fehlerText } from '../../utils/fehler';
import { safeUUID } from '../../utils/uuid';
import { sendenOderEinreihen } from '../../utils/sendenOderEinreihen';
import type { FormularOptionen } from './stammdatenFormular';

/** Was das Formular von einem Zertifikat liest. */
export interface ZertifikatVorlage {
  id: number;
  name: string;
  icon: string;
}

/** Das Symbol eines neuen Zertifikats (und eines ohne Symbol). */
export const ZERTIFIKAT_ICON_VORGABE = 'ribbon';

export function useZertifikatFormular(certificateType: ZertifikatVorlage | null | undefined, { onFertig, fehlerImDialog = false }: FormularOptionen) {
  const { setSuccess, setError, isOnline } = useApp();
  const [loading, setLoading] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const [name, setNameRoh] = useState(certificateType?.name || '');
  const [icon, setIconRoh] = useState(certificateType?.icon || ZERTIFIKAT_ICON_VORGABE);
  // Ein anderes Zertifikat (das Modal der App bekommt es ueber neue Props):
  // neu vorbelegen -- gleich beim Zeichnen, nicht erst in einem Effekt danach.
  const [vorlage, setVorlage] = useState(certificateType);
  if (vorlage !== certificateType) {
    setVorlage(certificateType);
    setNameRoh(certificateType?.name || '');
    setIconRoh(certificateType?.icon || ZERTIFIKAT_ICON_VORGABE);
  }

  const setName = (wert: string) => { setFehler(null); setNameRoh(wert); };
  const setIcon = (wert: string) => { setFehler(null); setIconRoh(wert); };

  const melden = (text: string) => (fehlerImDialog ? setFehler(text) : setError(text));

  const speichern = async () => {
    if (!name.trim()) {
      melden('Name ist erforderlich');
      return;
    }

    const payload = { name: name.trim(), icon };

    setFehler(null);
    setLoading(true);
    try {
      // Bearbeiten (PUT) faellt auch bei einem Netzabbruch im Online-Zweig in
      // die Warteschlange; Anlegen (POST ohne Idempotenzschluessel) nur
      // offline -- nach einem Abbruch bleibt es dort beim Fehler, sonst
      // entstuende der Eintrag womoeglich doppelt (utils/sendenOderEinreihen.ts,
      // Audit Grundgeruest BF-01).
      const { weg } = await sendenOderEinreihen({
        online: networkMonitor.isOnline,
        methode: certificateType ? 'PUT' : 'POST',
        senden: () => (certificateType ? api.put(`/teamer/certificate-types/${certificateType.id}`, payload) : api.post('/teamer/certificate-types', payload)),
        einreihen: () => writeQueue.enqueue({
          method: certificateType ? 'PUT' : 'POST',
          url: certificateType ? `/teamer/certificate-types/${certificateType.id}` : '/teamer/certificate-types',
          body: payload,
          maxRetries: 5,
          hasFileUpload: false,
          metadata: {
            type: 'admin',
            clientId: safeUUID(),
            label: certificateType ? 'Zertifikat bearbeiten' : 'Zertifikat erstellen'
          }
        }),
      });
      if (weg === 'eingereiht') setSuccess('Wird gespeichert sobald du wieder online bist');
      onFertig();
    } catch (error) {
      melden(fehlerText(error, 'Fehler beim Speichern'));
    } finally {
      setLoading(false);
    }
  };

  return { name, setName, icon, setIcon, loading, fehler, isOnline, speichern };
}
