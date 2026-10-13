// Die Team-Liste der Leitung (GET /admin/konfis/teamer) -- eine Stelle fuer die
// App (KonfisView) und die Web-Fassung (web/leitung/WebKonfis.tsx).
//
// Geladen wird EINMAL beim Oeffnen der Seite, nicht erst beim Wechsel auf
// "Team": Der Reiter "Team" zeigt seine Anzahl sofort, wie "Konfis" (Simon,
// 13.10.2026: "ich sehe die anzahl der konfis in den reiter aber nicht die
// anzahl des teams. das erscheint erst wenn ich es anklicke."). Ein Wechsel
// zwischen den Reitern fragt nicht erneut. Neu geladen wird auf Wunsch
// (`laden`, nach dem Loeschen), wenn `stand` hochzaehlt (nach "Teamer:in
// anlegen", beim Herunterziehen und wenn der Server eine Aenderung an Konten
// meldet; AdminKonfisPage) und nach einer Unterbrechung der Verbindung
// ('sync:reconnect') -- ein Signal 'users' kann waehrenddessen verloren sein.
//
// Ein Fehler ist kein Leerzustand: Eine leere Liste saehe aus, als gaebe es
// niemanden im Team (Audit 10.08.2026); `fehler` unterscheidet ihn von "noch
// niemand im Team". Gemeldet (Toast) wird er nur, wenn die Ansicht "Team"
// offen ist: Die Seite ist die Startseite der Leitung, und im Funkloch kam
// sonst ein roter Toast fuer etwas, das niemand geoeffnet hatte (Befund
// 13.10.2026). Im Hintergrund fehlt dann nur die Zahl am Reiter; der Wechsel
// auf "Team" versucht es neu.
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

export interface TeamerListeOptionen {
  /**
   * Ist die Ansicht "Team" offen? Nur dann meldet ein gescheiterter Abruf
   * sich als Toast. Wird sie nach einem gescheiterten Abruf geoeffnet, laedt
   * die Liste neu.
   */
  offen: boolean;
  /**
   * Zaehlt hoch, wenn die Liste neu geladen werden soll (`teamStand` der
   * Seite). Der Wert beim Einhaengen loest keinen zweiten Abruf aus: Wechselt
   * das Fenster ueber 992 px die Fassung, haengt sich die neue mit einem
   * Stand > 0 ein, und der erste Abruf genuegt.
   */
  stand?: number;
}

export function useTeamerListe({ offen, stand = 0 }: TeamerListeOptionen): TeamerListe {
  const { setError } = useApp();
  const [liste, setListe] = useState<TeamerListenEintrag[] | null>(null);
  const [fehler, setFehler] = useState(false);
  const [nachladen, setNachladen] = useState(false);

  // Die Meldung soll `holen` nicht jedes Mal neu erzeugen: Der Effekt unten
  // laedt sonst bei jedem Zeichnen erneut.
  const meldeFehler = useRef(() => setError('Das Team konnte nicht geladen werden'));
  useEffect(() => { meldeFehler.current = () => setError('Das Team konnte nicht geladen werden'); }, [setError]);

  // Fuer die Rueckrufe: Ist "Team" offen, und scheiterte der letzte Abruf?
  // Gesetzt im Effekt bzw. in den Rueckrufen, nie beim Zeichnen.
  const offenRef = useRef(offen);
  const fehlerRef = useRef(false);

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
        fehlerRef.current = false;
        setListe(response.data || []);
        setFehler(false);
      },
      (err) => {
        if (nummer !== letzterAbruf.current) return;
        console.error('Error loading teamers:', err);
        fehlerRef.current = true;
        setListe([]);
        setFehler(true);
        if (offenRef.current) meldeFehler.current();
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

  // "Team" wird geoeffnet, und der letzte Abruf ist gescheitert (im
  // Hintergrund, ohne Meldung): neuer Versuch -- scheitert er, meldet er
  // sich jetzt. Nur beim Oeffnen selbst, nicht bei jedem neuen Fehler; sonst
  // liefe bei offenem Team ein Versuch nach dem anderen.
  useEffect(() => {
    const geradeGeoeffnet = offen && !offenRef.current;
    offenRef.current = offen;
    if (geradeGeoeffnet && fehlerRef.current) void laden();
  }, [offen, laden]);

  // Neu laden, wenn der Stand der Seite hochzaehlt -- nicht beim Einhaengen.
  const letzterStand = useRef(stand);
  useEffect(() => {
    if (stand === letzterStand.current) return;
    letzterStand.current = stand;
    void laden();
  }, [stand, laden]);

  // Nach einer Unterbrechung der Verbindung (Funkloch, App im Hintergrund,
  // Deploy) still neu laden -- ohne Ladezustand, die alte Liste bleibt
  // stehen. websocket.ts und AppContext feuern das Ereignis, wenn der Socket
  // wieder steht bzw. die App in den Vordergrund kommt.
  useEffect(() => {
    const nachUnterbrechung = () => { void holen(); };
    window.addEventListener('sync:reconnect', nachUnterbrechung);
    return () => window.removeEventListener('sync:reconnect', nachUnterbrechung);
  }, [holen]);

  return {
    teamers: liste ?? [],
    laedt: nachladen || (liste === null && !fehler),
    geladen: liste !== null,
    fehler,
    laden,
  };
}
