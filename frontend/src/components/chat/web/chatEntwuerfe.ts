// Entwuerfe der Web-Fassung: Was in einem Raum getippt, aber nicht gesendet
// ist, bleibt beim Wechsel in einen anderen Raum stehen -- wie in einem
// Messenger. Ohne das ginge ein halber Satz verloren, sobald man links einen
// anderen Chat anklickt (der Raum rechts wird dabei neu aufgebaut).
//
// Nur der Text, nur fuer diese Sitzung im Browser (Modul-Zustand); ein Entwurf
// wird nie auf der Platte oder beim Server abgelegt.

const entwuerfe = new Map<number, string>();

/** Der Entwurf eines Raums, oder ein leerer Text. */
export const entwurfLesen = (raumId: number): string => entwuerfe.get(raumId) ?? '';

/** Einen Entwurf merken; ein leerer Text loescht ihn (nach dem Senden). */
export const entwurfMerken = (raumId: number, text: string): void => {
  if (text.trim() === '') entwuerfe.delete(raumId);
  else entwuerfe.set(raumId, text);
};

/** Alle Entwuerfe vergessen -- fuer Tests und nach dem Abmelden. */
export const entwuerfeZuruecksetzen = (): void => entwuerfe.clear();
