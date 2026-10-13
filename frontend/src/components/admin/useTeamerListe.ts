// Die Team-Liste der Leitung (GET /admin/konfis/teamer) -- eine Stelle fuer die
// App (KonfisView) und die Web-Fassung (web/leitung/WebKonfis.tsx).
//
// Geladen wird EINMAL beim Oeffnen der Seite, nicht erst beim Wechsel auf
// "Team": Der Reiter "Team" zeigt seine Anzahl sofort, wie "Konfis" (Simon,
// 13.10.2026: "ich sehe die anzahl der konfis in den reiter aber nicht die
// anzahl des teams. das erscheint erst wenn ich es anklicke."). Ein Wechsel
// zwischen den Reitern fragt nicht erneut. Neu geladen wird auf Wunsch
// (`laden`): nach dem Loeschen, nach "Teamer:in anlegen", beim Herunterziehen
// und wenn der Server eine Aenderung an Konten meldet (AdminKonfisPage).
//
// Ein Fehler ist kein Leerzustand: Eine leere Liste saehe aus, als gaebe es
// niemanden im Team (Audit 10.08.2026); die Seite meldet ihn, `fehler`
// unterscheidet ihn von "noch niemand im Team".
//
// `laedt` gilt, solange noch weder Liste noch Fehler da sind (wie in
// components/web/useWebDaten.ts) -- so steht nie kurz "Noch niemand im Team"
// da, bevor die Anfrage losgeht.

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

export function useTeamerListe(): TeamerListe {
  const { setError } = useApp();
  const [liste, setListe] = useState<TeamerListenEintrag[] | null>(null);
  const [fehler, setFehler] = useState(false);
  const [nachladen, setNachladen] = useState(false);

  // Die Meldung soll `holen` nicht jedes Mal neu erzeugen: Der Effekt unten
  // laedt sonst bei jedem Zeichnen erneut.
  const meldeFehler = useRef(() => setError('Das Team konnte nicht geladen werden'));
  useEffect(() => { meldeFehler.current = () => setError('Das Team konnte nicht geladen werden'); }, [setError]);

  // Nur die Antwort des JUENGSTEN Abrufs zaehlt: Kommen zwei kurz
  // hintereinander (Anlegen und Meldung des Servers), darf die aeltere
  // Antwort die neuere nicht ueberschreiben.
  const letzterAbruf = useRef(0);

  // Erst warten, dann Zustand setzen: Im Effekt unten soll kein Zustand
  // synchron wechseln (dasselbe Muster wie components/web/useWebDaten.ts).
  const holen = useCallback((): Promise<void> => {
    const nummer = ++letzterAbruf.current;
    return Promise.resolve().then(() => api.get('/admin/konfis/teamer')).then(
      (response) => {
        if (nummer !== letzterAbruf.current) return;
        setListe(response.data || []);
        setFehler(false);
      },
      (err) => {
        if (nummer !== letzterAbruf.current) return;
        console.error('Error loading teamers:', err);
        setListe([]);
        setFehler(true);
        meldeFehler.current();
      },
    );
  }, []);

  useEffect(() => {
    void holen();
  }, [holen]);

  const laden = useCallback((): Promise<void> => {
    setFehler(false);
    setNachladen(true);
    return holen().finally(() => setNachladen(false));
  }, [holen]);

  return {
    teamers: liste ?? [],
    laedt: nachladen || (liste === null && !fehler),
    geladen: liste !== null,
    fehler,
    laden,
  };
}
