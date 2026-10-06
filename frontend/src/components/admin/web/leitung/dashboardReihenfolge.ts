// Die Reihenfolge der Bereiche auf dem Dashboard der Konfis bzw. des Teams: ein
// Eintrag rueckt um eine Stelle nach oben oder unten. In der App zieht man die
// Eintraege (IonReorderGroup), im Browser gibt es dafuer zwei Knoepfe je Zeile.

/**
 * Die Reihenfolge, nachdem der Eintrag an `index` um eine Stelle verschoben
 * wurde. Am Rand bleibt alles, wie es ist (dann ist der Knopf ohnehin gesperrt).
 */
export function verschiebeEintrag(reihenfolge: readonly string[], index: number, richtung: 'hoch' | 'runter'): string[] {
  const ziel = richtung === 'hoch' ? index - 1 : index + 1;
  if (index < 0 || index >= reihenfolge.length || ziel < 0 || ziel >= reihenfolge.length) return [...reihenfolge];
  const neu = [...reihenfolge];
  [neu[index], neu[ziel]] = [neu[ziel], neu[index]];
  return neu;
}
