// „Einordnen" eines Vorgangs als Formular ohne Darstellung -- EINE Bedienweise
// für App und Browser (docs/planung/support-detailseiten.md, H und F; Simon,
// 11.10.2026, Frage 5: Einordnen am Handy wie im Browser erst mit
// „Speichern"). Bis dahin speicherte die App jedes Feld sofort und prüfte den
// Pflicht-Bereich nicht; der Browser hatte seine eigene Prüfung.
//
// Status, Art, Bereich, Dringlichkeit, Gemeinde und Betreff stehen in einem
// Entwurf; „Speichern" schickt EIN PATCH mit genau den geänderten Feldern
// (useVorgangDetail.einordnen). Die Regeln stehen rein in
// utils/supportVorgaenge.ts: einordnenVorbelegen, einordnenFehler
// (Pflicht-Bereich bei Frage, Fehler und Wunsch; leerer oder zu langer
// Betreff), einordnenAenderung, einordnenHinweis (nur bei „Erledigt"; bei einer
// Anfrage, die noch nicht angelegt ist: „Erledigt lehnt die Anfrage ab").
//
// Solange der Entwurf unverändert ist, folgt er dem Vorgang (eine Änderung an
// anderer Stelle, das Neuladen); eine begonnene Eingabe bleibt stehen.

import { useCallback, useMemo, useState } from 'react';
import { gemeindeName } from '../../utils/supportMail';
import {
  einordnenAenderung,
  einordnenFehler,
  einordnenHinweis,
  einordnenVorbelegen,
  type EinordnenEntwurf,
} from '../../utils/supportVorgaenge';
import { MARKEN_TEXT } from '../../seiten/supportDetail';
import type { VorgangDetailDaten } from './useVorgangDetail';

type Daten = Pick<VorgangDetailDaten, 'vorgang' | 'einordnen' | 'gemeinden' | 'gemeindenFehlt' | 'speichert' | 'isOnline'>;

const FELDER: ReadonlyArray<keyof EinordnenEntwurf> = ['status', 'art', 'bereich', 'dringlichkeit', 'gemeinde', 'betreff'];
const gleich = (a: EinordnenEntwurf | null, b: EinordnenEntwurf | null): boolean =>
  a === b || (a !== null && b !== null && FELDER.every((f) => a[f] === b[f]));

export function useEinordnenFormular(d: Daten) {
  const { vorgang, einordnen, gemeinden, gemeindenFehlt, speichert, isOnline } = d;

  // Die Vorbelegung aus dem Vorgang, wie er zuletzt kam, und für welchen.
  const neueBasis = vorgang ? einordnenVorbelegen(vorgang) : null;
  const [basis, setBasis] = useState<{ id: number | null; werte: EinordnenEntwurf | null }>(() => ({ id: vorgang?.id ?? null, werte: neueBasis }));
  const [entwurf, setEntwurf] = useState<EinordnenEntwurf | null>(neueBasis);
  // Hat die Person etwas eingegeben? Dann bleibt der Entwurf stehen -- auch,
  // wenn das Speichern scheitert und der Vorgang auf den alten Stand zurückfällt.
  const [beruehrt, setBeruehrt] = useState(false);
  // Erst nach dem ersten „Speichern" steht ein Fehler da -- nicht schon beim Öffnen.
  const [versucht, setVersucht] = useState(false);

  // Kam der Vorgang neu oder hat er sich geändert: Ein unberührter Entwurf
  // folgt, ein anderer Vorgang beginnt neu (nachgezogen beim Rendern).
  const id = vorgang?.id ?? null;
  if (id !== basis.id || !gleich(neueBasis, basis.werte)) {
    const andererVorgang = id !== basis.id;
    setBasis({ id, werte: neueBasis });
    if (andererVorgang || !beruehrt) {
      setEntwurf(neueBasis);
      setBeruehrt(false);
      setVersucht(false);
    }
  }

  const aendern = useCallback((teil: Partial<EinordnenEntwurf>) => {
    setBeruehrt(true);
    setEntwurf((e) => (e ? { ...e, ...teil } : e));
  }, []);

  /** Den Entwurf verwerfen (Abbrechen, erneutes Öffnen): wieder der Stand des Vorgangs. */
  const zuruecksetzen = useCallback(() => {
    setEntwurf(vorgang ? einordnenVorbelegen(vorgang) : null);
    setBeruehrt(false);
    setVersucht(false);
  }, [vorgang]);

  const fehler = versucht && entwurf ? einordnenFehler(entwurf) : null;
  const hinweis = vorgang && entwurf ? einordnenHinweis(vorgang, entwurf) : null;
  const geaendert = !!vorgang && !!entwurf && Object.keys(einordnenAenderung(vorgang, entwurf)).length > 0;

  // Keine Gemeinde, dann alle nach Namen; die zugeordnete auch dann, wenn die Liste sie nicht hat.
  const gemeindeOptionen = useMemo(() => {
    const optionen = [{ wert: '', label: MARKEN_TEXT.keineGemeinde }, ...gemeinden.map((g) => ({ wert: String(g.id), label: gemeindeName(g) }))];
    const eigene = vorgang?.organization_id ?? null;
    if (eigene !== null && !gemeinden.some((g) => g.id === eigene)) {
      optionen.push({ wert: String(eigene), label: vorgang?.gemeinde?.display_name ?? vorgang?.gemeinde_name ?? `Gemeinde ${eigene}` });
    }
    return optionen;
  }, [gemeinden, vorgang]);

  /**
   * Speichern: prüft (Pflicht-Bereich, Betreff), schickt EIN PATCH mit den
   * geänderten Feldern. true: der Dialog darf schließen -- auch, wenn sich
   * nichts geändert hat.
   */
  const speichern = async (): Promise<boolean> => {
    if (!vorgang || !entwurf) return false;
    setVersucht(true);
    if (einordnenFehler(entwurf)) return false;
    const teil = einordnenAenderung(vorgang, entwurf);
    if (Object.keys(teil).length === 0) return true;
    return einordnen(teil);
  };

  return {
    entwurf,
    aendern,
    zuruecksetzen,
    fehler,
    hinweis,
    geaendert,
    gemeindeOptionen,
    /** Die Gemeinden ließen sich nicht (vollständig) laden. */
    gemeindenFehlt,
    speichern,
    speichert,
    isOnline,
  };
}

export type EinordnenFormular = ReturnType<typeof useEinordnenFormular>;
