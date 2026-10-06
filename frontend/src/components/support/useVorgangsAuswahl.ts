// Filter, Art, Gemeinde und Suche der Vorgangsliste -- und was die Adresse
// vorgeben kann (`/admin/support/vorgaenge?filter=neu&art=neue_gemeinde&gemeinde=7`).
//
// Die alten Adressen führen so auf die richtige Auswahl: `/admin/support/
// anfragen` auf die Vorgänge der Art „Neue Gemeinde", der Schriftwechsel einer
// Gemeinde auf die Liste ihrer Vorgänge. Ändert sich die Adresse, gilt die
// Auswahl aus der Adresse -- auch dann, wenn die Seite schon einmal offen war
// (Ionic hält besuchte Seiten im Speicher). Wählt jemand danach etwas, gilt die
// Wahl; die Adresse bleibt dabei stehen, ein Neuladen stellt sie wieder her.
// Nur auf der eigenen Seite: Ionic lässt eine verlassene Seite noch kurz stehen,
// ihr Standort zeigt dann schon auf die nächste.

import { useState } from 'react';
import { useAppLocation } from '../../navigation/useAppLocation';
import { SUPPORT_VORGAENGE } from '../../navigation/supportMenue';
import { auswahlAusAdresse, type VorgangArt, type VorgangAuswahl, type VorgangFilter } from '../../utils/supportVorgaenge';

const VORGABE: VorgangAuswahl = { filter: 'offen', art: 'alle', gemeinde: 'alle', suche: '' };

export function useVorgangsAuswahl() {
  const { pathname: rohPfad, search } = useAppLocation();
  const pathname = rohPfad.replace(/\/+$/, '');
  const ausAdresse = (s: string): VorgangAuswahl => {
    const a = auswahlAusAdresse(s);
    return { ...VORGABE, filter: a.filter ?? VORGABE.filter, art: a.art ?? 'alle', gemeinde: a.gemeinde ?? 'alle' };
  };
  const [auswahl, setAuswahl] = useState<VorgangAuswahl>(() => (pathname === SUPPORT_VORGAENGE ? ausAdresse(search) : VORGABE));
  const [gesehen, setGesehen] = useState(`${pathname}${search}`);

  // Zustand aus der Adresse nachziehen, solange gerendert wird (kein Effekt: sonst blitzt die alte Auswahl kurz auf).
  const schluessel = `${pathname}${search}`;
  if (schluessel !== gesehen) {
    setGesehen(schluessel);
    if (pathname === SUPPORT_VORGAENGE) {
      const neu = ausAdresse(search);
      // Die Suche gehoert nicht in die Adresse und bleibt, wie sie ist.
      setAuswahl((alt) => ({ ...neu, suche: alt.suche }));
    }
  }

  return {
    auswahl,
    setFilter: (filter: VorgangFilter) => setAuswahl((a) => ({ ...a, filter })),
    setArt: (art: VorgangArt | 'alle') => setAuswahl((a) => ({ ...a, art })),
    setGemeinde: (gemeinde: string) => setAuswahl((a) => ({ ...a, gemeinde })),
    setSuche: (suche: string) => setAuswahl((a) => ({ ...a, suche })),
    /** Alles zurueck auf die Vorgabe (Suche leeren, Art und Gemeinde auf „alle"). */
    zuruecksetzen: () => setAuswahl((a) => ({ ...VORGABE, filter: a.filter })),
  };
}
