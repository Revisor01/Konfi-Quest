// „Neue Umfrage" im Chat -- als Logik ohne Darstellung (Simon, 15.10.2026,
// Seiten-Interview Seite 3: „poll modal ist noch app"). Die App zeigt sie im
// Modal (modals/PollModal.tsx), der Browser ab 992 px im Dialog
// (web/WebUmfrageDialog.tsx). Felder, wie die Schalter voneinander abhängen,
// die Prüfung, der Rumpf an den Server und die Texte stehen nur hier, damit
// beide nicht auseinanderlaufen.
//
// Anlegen: POST /chat/rooms/:id/polls
//   { question, options, multiple_choice, anonymous, exclusive_options,
//     einmalige_antwort, namen_spaeter, expires_in_hours }
//
// Fehler meldet der Hook über `meldeFehler`: in der App oben (setError), im
// Dialog des Browsers im Fenster selbst.

import { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useActionGuard } from '../../hooks/useActionGuard';
import api from '../../services/api';

// --- Grenzen und Texte: dieselben in App und Browser ---
export const FRAGE_MAX_ZEICHEN = 500;
export const OPTION_MAX_ZEICHEN = 200;
export const OPTIONEN_MIN = 2;
export const OPTIONEN_MAX = 10;

export const UMFRAGE_FRAGE_FEHLT = 'Bitte gib eine Frage ein';
export const UMFRAGE_ZU_WENIG_OPTIONEN = 'Bitte gib mindestens 2 Antwortmöglichkeiten ein';
export const UMFRAGE_FEHLER = 'Fehler beim Erstellen der Umfrage';

/** Die Erklärungen unter den Schaltern. */
export const UMFRAGE_HINWEISE = {
  mehrfachauswahl: (exklusiv: boolean): string => (exklusiv ? 'Bei exklusiven Optionen nicht möglich' : 'Mehrere Antworten erlauben'),
  namenAnzeigen: (anonym: boolean): string => (anonym
    ? 'Aus: anonym – niemand sieht, wer was gewählt hat'
    : 'An: alle sehen, wer welche Antwort gewählt hat'),
  namenSpaeter: 'Bis du sie aufdeckst, sieht niemand die Namen – auch du nicht. Endet die Umfrage, werden sie von selbst aufgedeckt.',
  einmalig: 'Wer abgestimmt hat, kann die Antwort danach nicht mehr ändern – gut für ein Quiz',
  exklusiv: 'Jede Option kann nur von einer Person gewählt werden',
  ablauf: 'Umfrage automatisch schließen',
} as const;

/** Wie lange eine Umfrage mit Ablaufdatum offen bleibt. */
export const ABLAUF_STUNDEN: ReadonlyArray<{ stunden: number; label: string }> = [
  { stunden: 1, label: '1 Stunde' },
  { stunden: 8, label: '8 Stunden' },
  { stunden: 24, label: '1 Tag' },
  { stunden: 168, label: '7 Tage' },
];

/** Der Rumpf an POST /chat/rooms/:id/polls. */
export interface UmfrageDaten {
  question: string;
  options: string[];
  multiple_choice: boolean;
  anonymous: boolean;
  exclusive_options: boolean;
  einmalige_antwort: boolean;
  namen_spaeter: boolean;
  expires_in_hours: number | null;
}

export interface UmfrageFormularOptionen {
  roomId: number;
  /** Wohin ein Fehler geht; ohne Angabe oben in der App (setError). */
  meldeFehler?: (text: string) => void;
}

export function useUmfrageFormular({ roomId, meldeFehler }: UmfrageFormularOptionen) {
  const { setError } = useApp();
  const melden = meldeFehler ?? setError;

  const [question, setQuestionRoh] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [multipleChoice, setMultipleChoice] = useState(false);
  const [anonymous, setAnonymous] = useState(true);
  const [exclusiveOptions, setExclusiveOptions] = useState(false);
  // Einmalige Antwort und "Namen später" (10.10.2026). "Namen später" gibt
  // es nur bei einer Umfrage mit Namen -- anonym und später schliessen sich
  // aus (das Backend lehnt die Kombination auch ab).
  const [einmaligeAntwort, setEinmaligeAntwort] = useState(false);
  const [namenSpaeter, setNamenSpaeter] = useState(false);
  const [hasExpiration, setHasExpiration] = useState(false);
  const [expirationHours, setExpirationHours] = useState(24);
  const { isSubmitting: creating, guard } = useActionGuard();

  const resetForm = () => {
    setQuestionRoh('');
    setOptions(['', '']);
    setMultipleChoice(false);
    setAnonymous(true);
    setExclusiveOptions(false);
    setEinmaligeAntwort(false);
    setNamenSpaeter(false);
    setHasExpiration(false);
    setExpirationHours(24);
  };

  // Die Felder der App begrenzen selbst (maxlength); der Browser kürzt hier.
  const setQuestion = (wert: string) => setQuestionRoh(wert.slice(0, FRAGE_MAX_ZEICHEN));

  const addOption = () => {
    if (options.length < OPTIONEN_MAX) {
      setOptions([...options, '']);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > OPTIONEN_MIN) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value.slice(0, OPTION_MAX_ZEICHEN);
    setOptions(newOptions);
  };

  /** „Namen anzeigen": aus heißt anonym; dann gibt es kein „Namen später". */
  const namenAnzeigenSetzen = (an: boolean) => {
    setAnonymous(!an);
    if (!an) setNamenSpaeter(false);
  };

  /** Exklusive Optionen erzwingen Einzelauswahl. */
  const exklusivSetzen = (an: boolean) => {
    setExclusiveOptions(an);
    if (an) setMultipleChoice(false);
  };

  /** Was fehlt, als Satz; null, wenn alles da ist. */
  const pruefen = (): string | null => {
    if (!question.trim()) return UMFRAGE_FRAGE_FEHLT;
    if (options.filter((opt) => opt.trim()).length < OPTIONEN_MIN) return UMFRAGE_ZU_WENIG_OPTIONEN;
    return null;
  };

  const daten = (): UmfrageDaten => ({
    question: question.trim(),
    options: options.filter((opt) => opt.trim()),
    // Exklusive Optionen erzwingen Einzelauswahl (Backend setzt das auch durch).
    multiple_choice: exclusiveOptions ? false : multipleChoice,
    anonymous,
    exclusive_options: exclusiveOptions,
    einmalige_antwort: einmaligeAntwort,
    namen_spaeter: !anonymous && namenSpaeter,
    expires_in_hours: hasExpiration ? expirationHours : null,
  });

  /**
   * Prüfen und anlegen. true, wenn die Umfrage steht (das Formular ist dann
   * zurückgesetzt); sonst ist der Fehler gemeldet.
   */
  const erstellen = async (): Promise<boolean> => {
    if (creating) return false;
    const fehlt = pruefen();
    if (fehlt) {
      melden(fehlt);
      return false;
    }
    return guard(async () => {
      try {
        await api.post(`/chat/rooms/${roomId}/polls`, daten());
        resetForm();
        return true;
      } catch (err) {
        melden(UMFRAGE_FEHLER);
        console.error('Error creating poll:', err);
        return false;
      }
    });
  };

  return {
    question,
    setQuestion,
    options,
    addOption,
    removeOption,
    updateOption,
    multipleChoice,
    setMultipleChoice,
    anonymous,
    namenAnzeigenSetzen,
    exclusiveOptions,
    exklusivSetzen,
    einmaligeAntwort,
    setEinmaligeAntwort,
    namenSpaeter,
    setNamenSpaeter,
    hasExpiration,
    setHasExpiration,
    expirationHours,
    setExpirationHours,
    creating,
    pruefen,
    /** Der Haken der App ist nur frei, wenn das stimmt. */
    kannErstellen: pruefen() === null,
    daten,
    erstellen,
  };
}

export type UmfrageFormularZustand = ReturnType<typeof useUmfrageFormular>;
