// Die erreichten Badges einer Person in der Detailansicht der Leitung -- eine
// Stelle fuer die App (KonfiBadgesSection) und die Web-Fassung
// (web/leitung/WebKonfiBadges.tsx).
//
// Teamer:innen haben ein EIGENES Badge-System (target_role='teamer', eigene
// Kriterien ohne Punkte) und einen eigenen Endpunkt -- der Konfi-Endpunkt
// antwortet fuer sie mit 404. Darstellung und Popover sind identisch
// (User-Wunsch 11.08.).

import { useEffect, useState } from 'react';
import api from '../../../services/api';

export interface KonfiBadge {
  id: number;
  name: string;
  description?: string;
  icon: string;
  criteria_type: string;
  criteria_value: number;
  criteria_extra?: string;
  is_hidden: boolean;
  color?: string;
  earned?: boolean;
  earned_at?: string;
}

export interface KonfiBadges {
  /** Die erreichten Badges; waehrend des Ladens und bei einem Fehler leer. */
  erreicht: KonfiBadge[];
  laedt: boolean;
}

export function useKonfiBadges(konfiId: number, role: 'konfi' | 'teamer' = 'konfi'): KonfiBadges {
  // Die Antwort merkt sich, fuer welche Person sie gilt: "laedt" ergibt sich
  // daraus, ohne im Effekt synchron Zustand zu setzen.
  const schluessel = `${role}:${konfiId}`;
  const [antwort, setAntwort] = useState<{ fuer: string; erreicht: KonfiBadge[] } | null>(null);

  useEffect(() => {
    let abgebrochen = false;
    const url = role === 'teamer'
      ? `/teamer/${konfiId}/badges`
      : `/admin/konfis/${konfiId}/badges`;
    api.get(url)
      .then((res) => (res.data?.earned || []) as KonfiBadge[])
      .catch(() => [] as KonfiBadge[])
      .then((liste) => {
        if (!abgebrochen) setAntwort({ fuer: schluessel, erreicht: liste });
      });
    return () => { abgebrochen = true; };
  }, [konfiId, role, schluessel]);

  const aktuell = antwort !== null && antwort.fuer === schluessel;
  return { erreicht: aktuell ? antwort.erreicht : [], laedt: !aktuell };
}
