// In welcher Reihenfolge die Konfis eines Termins stehen (01.10.2026).
//
// Marisa (Heide), über Simon: "bei Pflichtevents, bei anderen könnte ja die
// Anmeldereihenfolge im Zweifel relevant sein - kann da die Konfiliste nach
// Vornamen sortiert sein? Wie in der Konfiansicht?" Sie gleicht die Liste mit
// einer händischen ab und sucht beim Nachtragen einer Abmeldung gezielt nach
// dem Vornamen.
//
// Regel, eine Stelle für Leitung (admin/views/EventDetailView samt
// Zeitfenstern) und Team ("Wer kommt", TeamerEventsPage):
//   - Pflicht-Termin: nach Name, wie die Konfi-Liste (KonfisView sortiert nach
//     dem Anzeigenamen, und der beginnt mit dem Vornamen). Deutsche
//     Sortierung: Ö steht bei O, nicht hinter Z.
//   - sonst: die Reihenfolge des Servers, also die der Anmeldung (Warteliste,
//     "wer war zuerst da").

const vergleich = new Intl.Collator('de', { sensitivity: 'base', numeric: true });

/** Die Konfis in der Reihenfolge, in der die Ansicht sie zeigt. */
export const konfisInReihenfolge = <T extends { participant_name?: string | null }>(
  konfis: T[],
  pflicht: boolean | null | undefined
): T[] => {
  if (!pflicht) return konfis;
  return [...konfis].sort((a, b) => vergleich.compare(a.participant_name || '', b.participant_name || ''));
};
