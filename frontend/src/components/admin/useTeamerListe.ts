// Die Team-Liste der Leitung (GET /admin/konfis/teamer) -- eine Stelle fuer die
// App (KonfisView) und die Web-Fassung (web/leitung/WebKonfis.tsx).
//
// Geladen wird erst, wenn die Ansicht "Team" gewaehlt ist, und nach jedem
// Loeschen erneut (`laden`). Ein Fehler ist kein Leerzustand: Eine leere Liste
// saehe aus, als gaebe es niemanden im Team (Audit 10.08.2026); die Seite
// meldet ihn, `fehler` unterscheidet ihn von "noch niemand im Team".
//
// `laedt` ergibt sich daraus, dass die Ansicht offen ist und noch weder Liste
// noch Fehler da sind (wie in components/web/useWebDaten.ts) -- so steht nie
// kurz "Noch niemand im Team" da, bevor die Anfrage losgeht.

import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import { useApp } from '../../contexts/AppContext';
import type { TeamerListenEintrag } from '../../types/user';

export interface TeamerListe {
  teamers: TeamerListenEintrag[];
  /** Die Liste wird geladen (erstes Mal oder auf Wunsch neu). */
  laedt: boolean;
  /** Die Liste war schon einmal da (auch leer). */
  geladen: boolean;
  /** Der letzte Abruf ist gescheitert. */
  fehler: boolean;
  /** Neu laden; die alte Liste bleibt stehen, bis die neue da ist. */
  laden: () => Promise<void>;
}

export function useTeamerListe(aktiv: boolean): TeamerListe {
  const { setError } = useApp();
  const [liste, setListe] = useState<TeamerListenEintrag[] | null>(null);
  const [fehler, setFehler] = useState(false);
  const [nachladen, setNachladen] = useState(false);

  // Die Meldung soll `holen` nicht jedes Mal neu erzeugen: Der Effekt unten
  // laedt sonst bei jedem Zeichnen erneut.
  const meldeFehler = useRef(setError);
  useEffect(() => { meldeFehler.current = setError; }, [setError]);

  // Erst warten, dann Zustand setzen: Im Effekt unten soll kein Zustand
  // synchron wechseln (dasselbe Muster wie components/web/useWebDaten.ts).
  const holen = useCallback((): Promise<void> => Promise.resolve().then(() => api.get('/admin/konfis/teamer')).then(
    (response) => {
      setListe(response.data || []);
      setFehler(false);
    },
    (err) => {
      console.error('Error loading teamers:', err);
      setListe([]);
      setFehler(true);
      meldeFehler.current('Das Team konnte nicht geladen werden');
    },
  ), []);

  useEffect(() => {
    if (aktiv) void holen();
  }, [aktiv, holen]);

  const laden = useCallback((): Promise<void> => {
    setFehler(false);
    setNachladen(true);
    return holen().finally(() => setNachladen(false));
  }, [holen]);

  return {
    teamers: liste ?? [],
    laedt: nachladen || (aktiv && liste === null && !fehler),
    geladen: liste !== null,
    fehler,
    laden,
  };
}
