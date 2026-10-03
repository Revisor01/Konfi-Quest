// Ein Filter, den die Adresse vorgeben kann (`/admin/support/anfragen?filter=offen`).
//
// Die Kacheln der Uebersicht fuehren so auf die Liste, die ihre Zahl meint:
// "Offene Anfragen" auf den Filter "Offen", "Ungelesene Mails" auf den
// Filter "Ungelesen" des Posteingangs. Aendert sich die Adresse, gilt der
// Filter aus der Adresse -- auch dann, wenn die Seite schon einmal offen war
// (Ionic haelt besuchte Seiten im Speicher). Waehlt jemand danach einen Chip,
// gilt der Chip; die Adresse bleibt dabei stehen, ein Neuladen stellt sie wieder her.
//
// Nur auf der eigenen Seite: Ionic laesst eine verlassene Seite noch kurz
// stehen, ihr Standort zeigt dann schon auf die naechste.

import { useState } from 'react';
import { useAppLocation } from '../../navigation/useAppLocation';
import { filterAusAdresse } from '../../utils/supportWeb';

export function useFilterAusAdresse<W extends string>(
  pfad: string,
  erlaubt: readonly W[],
  standard: W,
): [W, (wert: W) => void] {
  const { pathname: rohPfad, search } = useAppLocation();
  const pathname = rohPfad.replace(/\/+$/, '');
  const [filter, setFilter] = useState<W>(() => (
    pathname === pfad ? filterAusAdresse(search, erlaubt) ?? standard : standard
  ));
  const [gesehen, setGesehen] = useState(`${pathname}${search}`);

  // Zustand aus der Adresse nachziehen, solange gerendert wird (kein Effekt: sonst blitzt der alte Filter kurz auf).
  const schluessel = `${pathname}${search}`;
  if (schluessel !== gesehen) {
    setGesehen(schluessel);
    const ausAdresse = pathname === pfad ? filterAusAdresse(search, erlaubt) : null;
    if (ausAdresse !== null) setFilter(ausAdresse);
  }

  return [filter, setFilter];
}
