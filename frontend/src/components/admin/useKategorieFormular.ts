// Eine Kategorie anlegen oder bearbeiten -- die Logik des Formulars ohne
// Darstellung: Vorbelegung, Pruefen, Speichern (mit Warteschlange) und die
// Meldungen. Die App zeigt sie im Modal CategoryModal
// (admin/pages/AdminCategoriesPage.tsx), der Browser ab 992 px im Dialog
// web/leitung/WebKategorieDialog.tsx (Simon, 11.10.2026: „Web braucht eigene
// kompaktere Modale überall").
//
// Aus CategoryModal herausgezogen (11.10.2026): Verhalten und Texte der App
// unveraendert. Einziger Unterschied je Fassung: Die App meldet Fehler oben
// als Meldung (setError), der Dialog im Browser zeigt sie in sich selbst
// (`fehlerImDialog`, stammdatenFormular.ts).

import { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import api from '../../services/api';
import { networkMonitor } from '../../services/networkMonitor';
import { writeQueue } from '../../services/writeQueue';
import { fehlerText } from '../../utils/fehler';
import { safeUUID } from '../../utils/uuid';
import { sendenOderEinreihen } from '../../utils/sendenOderEinreihen';
import type { FormularOptionen } from './stammdatenFormular';

/** Was das Formular von einer Kategorie liest. */
export interface KategorieVorlage {
  id: number;
  name: string;
  description?: string | null;
}

export interface KategorieFormularDaten {
  name: string;
  description: string;
}

const vorbelegen = (category?: KategorieVorlage | null): KategorieFormularDaten => (category
  ? { name: category.name, description: category.description || '' }
  : { name: '', description: '' });

export function useKategorieFormular(category: KategorieVorlage | null | undefined, { onFertig, fehlerImDialog = false }: FormularOptionen) {
  const { setSuccess, setError, isOnline } = useApp();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<KategorieFormularDaten>(() => vorbelegen(category));
  const [fehler, setFehler] = useState<string | null>(null);

  // Eine andere Kategorie (das Modal der App bekommt sie ueber neue Props):
  // neu vorbelegen -- gleich beim Zeichnen, nicht erst in einem Effekt danach.
  const [vorlage, setVorlage] = useState(category);
  if (vorlage !== category) {
    setVorlage(category);
    setFormData(vorbelegen(category));
  }

  const melden = (text: string) => (fehlerImDialog ? setFehler(text) : setError(text));

  const aendern = (teil: Partial<KategorieFormularDaten>) => {
    setFehler(null);
    setFormData((f) => ({ ...f, ...teil }));
  };

  const speichern = async () => {
    if (!formData.name.trim()) {
      melden('Name ist erforderlich');
      return;
    }

    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim() || null
    };

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
        methode: category ? 'PUT' : 'POST',
        senden: () => (category ? api.put(`/admin/categories/${category.id}`, payload) : api.post('/admin/categories', payload)),
        einreihen: () => writeQueue.enqueue({
          method: category ? 'PUT' : 'POST',
          url: category ? `/admin/categories/${category.id}` : '/admin/categories',
          body: payload,
          maxRetries: 5,
          hasFileUpload: false,
          metadata: {
            type: 'admin',
            clientId: safeUUID(),
            label: category ? 'Kategorie bearbeiten' : 'Kategorie erstellen'
          }
        }),
      });
      if (weg === 'eingereiht') setSuccess('Wird gespeichert sobald du wieder online bist');
      onFertig();
    } catch (error) {
      melden(fehlerText(error, 'Fehler beim Speichern der Kategorie'));
    } finally {
      setLoading(false);
    }
  };

  return { formData, aendern, loading, fehler, isOnline, speichern };
}
