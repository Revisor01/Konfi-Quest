// Ein Event absagen oder den Grund einer Absage ändern -- als Logik ohne
// Darstellung (Simon, 15.10.2026, Seiten-Inventar: im Browser ab 992 px jedes
// Formular als kompaktes Fenster der Web-Fassung, in den Apps und darunter
// das Modal wie bisher). Die App zeigt sie im Modal (TerminAbsagenModal), der
// Browser im Dialog (web/termine/WebTerminAbsagenDialog). Feld, Texte und die
// Fehlerbehandlung stehen nur hier; was beim Speichern an den Server geht,
// weiß die Seite (onSave): PUT /events/:id/cancel bzw. PUT /events/:id/absagegrund.
//
// Meldungen: in der App wie bisher oben (setError, mit dem Text des Servers,
// wenn er einen hat); im Dialog des Browsers (`fehlerImDialog`) im Dialog
// selbst (`fehler`). Geschlossen wird nur im Erfolgsfall -- wer den Fehler
// liest, soll seinen Text noch dastehen haben (siehe TerminAbsagenModal).

import { useState } from 'react';
import { useApp } from '../../../contexts/AppContext';
import { useActionGuard } from '../../../hooks/useActionGuard';
import { fehlerText } from '../../../utils/fehler';

export type AbsageModus = 'absagen' | 'grund';

export interface TerminAbsagenOptionen {
  /** 'absagen' sagt den Termin ab, 'grund' aendert nur den Grund eines bereits abgesagten Termins. */
  modus: AbsageModus;
  /** Beim Modus 'grund': der Grund, der heute dasteht. Leer = keiner. */
  grundVorgabe?: string;
  /** Speichert. Leerer Grund heisst: kein Grund. */
  onSave: (grund: string) => Promise<void> | void;
  /** Gespeichert: das Fenster schließen. */
  onFertig: () => void;
  fehlerImDialog?: boolean;
}

/** Was unter dem Feld steht: wer mitliest und ob eine Mitteilung rausgeht -- in App und Browser derselbe Satz. */
export const absageHinweis = (modus: AbsageModus): string => (modus === 'grund'
  ? 'Alle Angemeldeten sehen den Grund am Event. Es geht keine neue Mitteilung raus — die Absage ist schon gemeldet. Leerst du das Feld, fällt der Grund weg.'
  : 'Alle Angemeldeten sehen den Grund am Event und bekommen ihn in der Mitteilung. Ohne Grund wird nur die Absage gemeldet.');

/** Datum und Zahl der Angemeldeten -- die Eckdaten, die vorher im Kopf des Action Sheets standen. */
export const absageEckdaten = (terminDatum: string, konfiAnzahl: number, modus: AbsageModus): string =>
  `${terminDatum} · ${konfiAnzahl} ${konfiAnzahl === 1 ? 'Konfi angemeldet' : 'Konfis angemeldet'}${modus === 'grund' ? ' · abgesagt' : ''}`;

export function useTerminAbsagen({ modus, grundVorgabe = '', onSave, onFertig, fehlerImDialog = false }: TerminAbsagenOptionen) {
  const { isOnline, setError: meldungOben } = useApp();
  const [fehler, setFehler] = useState<string | null>(null);
  // Bewusst unter dem Namen setError: Die Positivliste der Fehlertexte
  // (utils/bekannteFehlertexte.ts) liest die Texte an den Aufrufstellen von setError.
  const setError = (meldung: string) => {
    if (fehlerImDialog) setFehler(meldung || null);
    else meldungOben(meldung);
  };
  const istGrundModus = modus === 'grund';
  // Vorgabe nur als Startwert: Wer tippt, soll nicht bei jedem Rendern
  // zurueckgesetzt werden. Das Fenster wird pro Oeffnen neu aufgebaut, deshalb
  // reicht der Initialwert.
  const [grundText, setGrundTextRoh] = useState(grundVorgabe);
  const { isSubmitting, guard } = useActionGuard();

  // FEHLER VOM SERVER ZEIGEN, STATT STILL STEHENZUBLEIBEN (16.09.2026) --
  // die Begruendung steht in TerminAbsagenModal. try/catch INNERHALB des
  // guard, geschlossen wird nur im Erfolgsfall.
  const handleSave = async () => {
    await guard(async () => {
      setFehler(null);
      try {
        await onSave(grundText.trim());
        onFertig();
      } catch (err) {
        setError(fehlerText(err, istGrundModus
          ? 'Fehler beim Speichern des Absagegrundes'
          : 'Fehler beim Absagen des Events'));
      }
    });
  };

  return {
    isOnline,
    istGrundModus,
    grundText,
    setGrundText: (wert: string) => { setFehler(null); setGrundTextRoh(wert); },
    isSubmitting,
    handleSave,
    fehler,
  };
}
