import { useCallback, useEffect, useRef, useState } from 'react';
import type { PluginListenerHandle } from '@capacitor/core';
import { App } from '@capacitor/app';
import {
  SperrVerzoegerung,
  sperreLesen,
  sperreVerfuegbar,
  mussSperren,
  mussBeimStartSperren,
  laeuftAusflug
} from '../services/appSperre';

// ---------------------------------------------------------------------------
// Der Lebenszyklus der App-Sperre: Zeitstempel beim Wechsel in den Hintergrund,
// Vergleich beim Zurückkommen, Sperre beim Kaltstart.
//
// BEWUSST EIN EIGENER HOOK neben dem vorhandenen appStateChange-Listener in
// AppContext: Dieser hier muss SOFORT beim Start laufen und darf an nichts
// hängen, was noch lädt. Der Listener in AppContext hängt an [user] und wird
// bei jedem Nutzerwechsel ab- und neu angemeldet — die Sperre darf in genau
// diesem Fenster nicht blind sein. Zwei getrennte Listener auf dasselbe
// Ereignis sind in Capacitor unproblematisch.
// ---------------------------------------------------------------------------

export interface AppSperrZustand {
  /** true, solange der Sperrbildschirm die App verdecken muss. */
  gesperrt: boolean;
  /** Vom Sperrbildschirm nach erfolgreicher Biometrie aufzurufen. */
  entsperren: () => void;
}

export const useAppSperre = (): AppSperrZustand => {
  const [gesperrt, setGesperrt] = useState(false);

  // Refs statt State: der appStateChange-Listener wird EINMAL angemeldet und
  // liest hier immer den aktuellen Stand. Als State im Dependency-Array müsste
  // der Listener bei jeder Änderung neu angemeldet werden — und genau dabei
  // gingen in dieser App schon Ereignisse verloren.
  const verzoegerungRef = useRef<SperrVerzoegerung>('aus');
  const hintergrundSeitRef = useRef<number | null>(null);

  // Einstellung laden und beim Kaltstart entscheiden.
  useEffect(() => {
    let abgemeldet = false;
    (async () => {
      // Erst Verfügbarkeit: wer die Biometrie am Gerät nachträglich entfernt
      // hat, darf nicht vor einem Sperrbildschirm stehen, den er nicht mehr
      // öffnen kann. Der Abmelden-Knopf wäre dann der einzige Weg — er ist da,
      // aber niemanden ohne Not dorthin zwingen.
      const verfuegbar = await sperreVerfuegbar();
      if (abgemeldet) return;
      if (!verfuegbar) {
        verzoegerungRef.current = 'aus';
        return;
      }

      const gelesen = await sperreLesen();
      if (abgemeldet) return;
      verzoegerungRef.current = gelesen;

      // Kaltstart: eingeschaltet heißt gesperrt, unabhängig von der Wartezeit.
      // Eine App, die frisch startet, war beliebig lange aus.
      if (mussBeimStartSperren(gelesen)) setGesperrt(true);
    })();
    return () => { abgemeldet = true; };
  }, []);

  // Die Einstellung kann sich im Profil ändern, während die App läuft. Ohne
  // dieses Ereignis griffe eine gerade eingeschaltete Sperre erst beim nächsten
  // Start — und eine gerade ausgeschaltete sperrte noch einmal.
  useEffect(() => {
    const hoeren = () => {
      sperreLesen().then((wert) => { verzoegerungRef.current = wert; });
    };
    window.addEventListener('app-sperre:geaendert', hoeren);
    return () => window.removeEventListener('app-sperre:geaendert', hoeren);
  }, []);

  useEffect(() => {
    let listener: PluginListenerHandle | null = null;
    let abgemeldet = false;

    (async () => {
      const angemeldet = await App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) {
          // Läuft gerade ein Systemdialog (Foto, Teilen, Face ID), wird KEIN
          // Zeitstempel gesetzt — ohne Zeitstempel kann beim Zurückkommen
          // nichts sperren, egal wie lange der Dialog offen steht.
          if (laeuftAusflug()) return;
          hintergrundSeitRef.current = Date.now();
          return;
        }

        if (mussSperren(verzoegerungRef.current, hintergrundSeitRef.current, Date.now())) {
          setGesperrt(true);
        }
        // In jedem Fall zurücksetzen: ein verbrauchter Zeitstempel darf nicht
        // stehen bleiben und beim nächsten Wechsel ein zweites Mal zählen.
        hintergrundSeitRef.current = null;
      });
      if (abgemeldet) {
        angemeldet.remove();
        return;
      }
      listener = angemeldet;
    })();

    return () => {
      abgemeldet = true;
      listener?.remove();
    };
  }, []);

  const entsperren = useCallback(() => {
    hintergrundSeitRef.current = null;
    setGesperrt(false);
  }, []);

  return { gesperrt, entsperren };
};

export default useAppSperre;
