// Ein Level anlegen oder bearbeiten -- die Logik des Formulars ohne
// Darstellung: Vorbelegung, Pruefen, Speichern (mit Warteschlange) und die
// Meldungen. Die App zeigt sie im Modal admin/modals/LevelManagementModal.tsx,
// der Browser ab 992 px im Dialog web/leitung/WebLevelDialog.tsx (Simon,
// 11.10.2026: „Web braucht eigene kompaktere Modale überall").
//
// Aus LevelManagementModal herausgezogen (11.10.2026): Verhalten und Texte der
// App unveraendert -- dort ist „Speichern" gesperrt, solange Titel oder Punkte
// fehlen, und ein ungueltiges Formular geht still nicht hinaus. Der Dialog im
// Browser schickt mit Enter ab und sagt dann, was fehlt (`fehlerImDialog`).

import { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useActionGuard } from '../../hooks/useActionGuard';
import api from '../../services/api';
import { networkMonitor } from '../../services/networkMonitor';
import { writeQueue } from '../../services/writeQueue';
import { fehlerText } from '../../utils/fehler';
import { safeUUID } from '../../utils/uuid';
import { sendenOderEinreihen } from '../../utils/sendenOderEinreihen';
import { FARBEN } from '../../theme/colors';
import type { FormularOptionen } from './stammdatenFormular';

export interface LevelFormularDaten {
  id?: number;
  name: string;
  title: string;
  description?: string;
  points_required: number;
  icon?: string;
  color?: string;
  reward_type?: string;
  reward_value?: number;
  is_active?: boolean;
}

/** Ein neues Level: ohne Titel, 0 Punkte, Pokal in der Farbe der Level. */
export const NEUES_LEVEL: LevelFormularDaten = {
  name: '',
  title: '',
  description: '',
  points_required: 0,
  icon: 'trophy',
  color: 'var(--app-color-level)',
  is_active: true
};

const HEX_FARBE = /^#[0-9a-f]{6}$/i;

/**
 * Die Farbe eines Levels so, wie der Server sie speichern kann: #rrggbb.
 * Er haelt sie in levels.color (varchar(7)) -- das Token
 * var(--app-color-level), mit dem ein neues Level beginnt, bricht dort mit
 * 500 ab („Fehler beim Erstellen des Levels"; Gegenpruefung 11.10.2026, in
 * der App noch offen). Alles, was kein #rrggbb ist, wird zur Farbe der Level
 * (FARBEN.level, der Spiegel von --app-color-level, hell wie dunkel derselbe
 * Wert). Das Farbfeld des Browsers kennt ohnehin nur #rrggbb und zeigte
 * sonst Schwarz. Der Dialog der Web-Fassung belegt damit vor, damit
 * gespeichert wird, was das Farbfeld zeigt.
 */
export function levelFarbeAlsHex(farbe: string | null | undefined): string {
  return farbe && HEX_FARBE.test(farbe) ? farbe : FARBEN.level;
}

/**
 * Der interne Name eines Levels aus seinem Titel, wenn keiner gesetzt ist:
 * klein, Umlaute ausgeschrieben, alles andere als Unterstrich.
 */
export function levelNameAusTitel(titel: string): string {
  return titel.toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/** Was am Formular fehlt -- oder null, wenn es so hinausgehen kann. */
export function levelFehler(formData: Pick<LevelFormularDaten, 'title' | 'points_required'>): string | null {
  if (formData.title.trim().length === 0) return 'Titel ist erforderlich';
  if (!Number.isInteger(formData.points_required) || formData.points_required < 0) return 'Benötigte Punkte müssen eine ganze Zahl ab 0 sein';
  return null;
}

export function useLevelFormular(level: LevelFormularDaten | null | undefined, { onFertig, fehlerImDialog = false }: FormularOptionen) {
  const { setSuccess, setError, isOnline } = useApp();
  const [formData, setFormData] = useState<LevelFormularDaten>(() => level ?? NEUES_LEVEL);
  const { isSubmitting, guard } = useActionGuard();
  const [loading, setLoading] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  // Ein anderes Level (das Modal der App bekommt es ueber neue Props): neu
  // vorbelegen -- gleich beim Zeichnen, nicht erst in einem Effekt danach.
  // Ohne Level bleibt das Formular, wie es ist (so schon im Modal der App).
  const [vorlage, setVorlage] = useState(level);
  if (vorlage !== level) {
    setVorlage(level);
    if (level) setFormData(level);
  }

  const isFormValid = levelFehler(formData) === null;

  const melden = (text: string) => (fehlerImDialog ? setFehler(text) : setError(text));

  const aendern = (teil: Partial<LevelFormularDaten>) => {
    setFehler(null);
    setFormData((f) => ({ ...f, ...teil }));
  };

  const speichern = async () => {
    if (!isFormValid) {
      // Die App sperrt „Speichern" bis dahin und meldet nichts; der Dialog sagt, was fehlt.
      if (fehlerImDialog) setFehler(levelFehler(formData));
      return;
    }

    await guard(async () => {
    setFehler(null);
    setLoading(true);
    try {
      // Auto-generate name from title if empty
      const generatedName = formData.name.trim() || levelNameAusTitel(formData.title);

      const payload = {
        name: generatedName,
        title: formData.title.trim(),
        description: formData.description?.trim() || '',
        points_required: formData.points_required,
        icon: formData.icon || 'trophy',
        color: formData.color || 'var(--app-color-level)',
        reward_type: formData.reward_type || null,
        reward_value: formData.reward_value || null,
        is_active: formData.is_active !== false
      };

      // Bearbeiten (PUT) faellt auch bei einem Netzabbruch im Online-Zweig in
      // die Warteschlange; Anlegen (POST ohne Idempotenzschluessel) nur
      // offline -- nach einem Abbruch bleibt es dort beim Fehler, sonst
      // entstuende der Eintrag womoeglich doppelt (utils/sendenOderEinreihen.ts,
      // Audit Grundgeruest BF-01).
      const { weg } = await sendenOderEinreihen({
        online: networkMonitor.isOnline,
        methode: level?.id ? 'PUT' : 'POST',
        senden: () => (level?.id
          ? api.put(`/levels/${level.id}`, payload)
          : api.post('/levels', payload)),
        einreihen: () => (level?.id
          ? writeQueue.enqueue({
            method: 'PUT',
            url: `/levels/${level.id}`,
            body: payload,
            maxRetries: 5,
            hasFileUpload: false,
            metadata: { type: 'admin', clientId: safeUUID(), label: 'Level bearbeiten' },
          })
          : writeQueue.enqueue({
            method: 'POST',
            url: '/levels',
            body: payload,
            maxRetries: 5,
            hasFileUpload: false,
            metadata: { type: 'admin', clientId: safeUUID(), label: 'Level erstellen' },
          })),
      });
      if (weg === 'eingereiht') {
        setSuccess(level?.id
          ? 'Level wird aktualisiert sobald du wieder online bist'
          : 'Level wird erstellt sobald du wieder online bist');
      }
      onFertig();
    } catch (error) {
      melden(fehlerText(error, 'Fehler beim Speichern'));
    } finally {
      setLoading(false);
    }
    });
  };

  return { formData, aendern, loading, isSubmitting, isFormValid, fehler, isOnline, speichern };
}
