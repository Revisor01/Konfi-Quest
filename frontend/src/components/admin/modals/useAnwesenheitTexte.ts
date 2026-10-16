// Abmeldung nachtragen und Notiz zur Anwesenheit -- als Logik ohne
// Darstellung (Simon, 15.10.2026, Seiten-Inventar: im Browser ab 992 px jedes
// Formular als kompaktes Fenster der Web-Fassung, in den Apps und darunter
// das Modal wie bisher). Die App zeigt sie in ihren Modalen
// (AbmeldungNachtragenModal, AnwesenheitNotizModal), der Browser in Dialogen
// (web/termine/WebAbmeldungDialog, WebNotizDialog). Felder, Prüfung und was
// beim Speichern an die Seite zurückgeht, stehen nur hier.
//
// Die Route kennt nur die Seite (EventDetailView: onSave ->
// PUT /events/:id/participants/:id/attendance). Zwei Hooks, nicht einer mit
// Umschalter -- aus demselben Grund wie die zwei Modale (siehe
// AbmeldungNachtragenModal): Die Notiz lässt sich löschen und rührt den
// Status nicht an; die Abmeldung SETZT ihn und kennt kein Löschen.
//
// Meldungen: Lehnt die Seite das Speichern ab (onSave wirft), steht die
// Meldung in der App oben (setError), im Dialog des Browsers
// (`fehlerImDialog`) im Dialog selbst (`fehler`), und das Fenster bleibt
// offen. Die App-Seite meldet ihre Fehler bisher selbst und wirft nicht --
// dort schließt das Modal wie bisher in jedem Fall.

import { useState } from 'react';
import { useApp } from '../../../contexts/AppContext';
import { useActionGuard } from '../../../hooks/useActionGuard';

/** Wohin eine Meldung geht: oben (App) oder in das Fenster (Browser). */
const useMeldung = (fehlerImDialog: boolean) => {
  const { setError: meldungOben, isOnline } = useApp();
  const [fehler, setFehler] = useState<string | null>(null);
  // Bewusst unter dem Namen setError: Die Positivliste der Fehlertexte
  // (utils/bekannteFehlertexte.ts) liest die Texte an den Aufrufstellen von setError.
  const setError = (meldung: string) => {
    if (fehlerImDialog) setFehler(meldung || null);
    else meldungOben(meldung);
  };
  return { isOnline, fehler, setFehler, setError };
};

export interface AbmeldungFormularOptionen {
  /** Der vorhandene Grund, falls die Abmeldung schon eingetragen ist. */
  grund?: string | null;
  /** Die vorhandene Notiz, falls es eine gibt. */
  notiz?: string | null;
  /** Trägt die Abmeldung ein: Status 'excused' mit Grund und Notiz. */
  onSave: (grund: string, notiz: string) => Promise<void> | void;
  /** Gespeichert: das Fenster schließen. */
  onFertig: () => void;
  fehlerImDialog?: boolean;
}

export function useAbmeldungFormular({ grund, notiz, onSave, onFertig, fehlerImDialog = false }: AbmeldungFormularOptionen) {
  const { isOnline, fehler, setFehler, setError } = useMeldung(fehlerImDialog);
  const [grundText, setGrundTextRoh] = useState(grund || '');
  const [notizText, setNotizTextRoh] = useState(notiz || '');
  const { isSubmitting, guard } = useActionGuard();

  const handleSave = async () => {
    await guard(async () => {
      setFehler(null);
      try {
        await onSave(grundText.trim(), notizText.trim());
        onFertig();
      } catch {
        // Derselbe Satz wie in der App (EventDetailView, handleAttendanceUpdate).
        setError('Fehler beim Aktualisieren der Anwesenheit');
      }
    });
  };

  return {
    isOnline,
    grundText,
    setGrundText: (wert: string) => { setFehler(null); setGrundTextRoh(wert); },
    notizText,
    setNotizText: (wert: string) => { setFehler(null); setNotizTextRoh(wert); },
    isSubmitting,
    handleSave,
    fehler,
  };
}

export interface NotizFormularOptionen {
  /** Die vorhandene Notiz, falls es eine gibt. */
  notiz?: string | null;
  /**
   * Speichert den neuen Text. Ein leerer String bedeutet LOESCHEN — die
   * Route unterscheidet "Feld fehlt" (Notiz bleibt) von "Feld ist leer"
   * (Notiz weg).
   */
  onSave: (notiz: string) => Promise<void> | void;
  /** Gespeichert oder gelöscht: das Fenster schließen. */
  onFertig: () => void;
  fehlerImDialog?: boolean;
}

export function useNotizFormular({ notiz, onSave, onFertig, fehlerImDialog = false }: NotizFormularOptionen) {
  const { isOnline, fehler, setFehler, setError } = useMeldung(fehlerImDialog);
  const [text, setTextRoh] = useState(notiz || '');
  const { isSubmitting, guard } = useActionGuard();

  const hatBestehendeNotiz = !!(notiz && notiz.trim().length > 0);
  const getrimmt = text.trim();

  // Speichern ist gesperrt, solange sich nichts geaendert hat, und bei einem
  // leeren Feld ohne bestehende Notiz: Da gaebe es nichts zu schreiben und
  // nichts zu loeschen. Ist eine Notiz vorhanden, ist das leere Feld dagegen
  // ein gueltiger Wunsch — es loescht.
  const hatAenderung = getrimmt !== (notiz || '').trim();
  const darfSpeichern = hatAenderung && (getrimmt.length > 0 || hatBestehendeNotiz);

  const speichernMit = async (wert: string) => {
    await guard(async () => {
      setFehler(null);
      try {
        await onSave(wert);
        onFertig();
      } catch {
        // Derselbe Satz wie in der App (EventDetailView, handleAttendanceUpdate).
        setError('Fehler beim Aktualisieren der Anwesenheit');
      }
    });
  };

  const handleSave = async () => {
    if (!darfSpeichern) return;
    await speichernMit(getrimmt);
  };

  // Leerer String heisst loeschen — derselbe Weg wie ein geleertes Feld,
  // damit es nur eine Art gibt, eine Notiz zu entfernen.
  const handleLoeschen = async () => {
    await speichernMit('');
  };

  return {
    isOnline,
    text,
    setText: (wert: string) => { setFehler(null); setTextRoh(wert); },
    hatBestehendeNotiz,
    darfSpeichern,
    isSubmitting,
    handleSave,
    handleLoeschen,
    fehler,
  };
}
