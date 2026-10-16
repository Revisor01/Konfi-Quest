// „Benachrichtigungen" als Logik ohne Darstellung -- für alle drei Rollen. Die
// App zeigt sie im Modal (PushAuswahl.tsx, PushAuswahlModal), der Browser ab
// 992 px im Dialog (web/konto/WebPushAuswahlDialog; Simon, 15.10.2026: im
// Browser bekommt jedes Formular, das noch ein App-Modal öffnet, ein kompaktes
// Web-Fenster). Laden, Speichern und die Texte stehen nur hier.
//
// Welche Gruppen es gibt, entscheidet der Server je Rolle
// (GET /notifications/preferences); jeder Wechsel geht sofort als
// PUT /notifications/preferences mit { push_enabled } oder der vollständigen
// Abwahl-Liste { stumm }. Fehler zeigt die App am Rand (setError), der
// Web-Dialog in sich selbst (`fehler`).

import { useEffect, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import api from '../../services/api';
import { trackHandlung, serverSchluesselMesswert } from '../../services/analytics';
import { fehlerText } from '../../utils/fehler';

export interface PushGruppe {
  id: string;
  name: string;
  beschreibung: string;
  aktiv: boolean;
}

export interface PushEinstellungen {
  push_enabled: boolean;
  stumm: string[];
  gruppen: PushGruppe[];
}

/** Der Hinweis unter der Auswahl: Das Postfach bleibt voll. */
export const PUSH_POSTFACH_HINWEIS = 'Abgeschaltet wird nur der Weg aufs Handy – im Postfach unter der Glocke steht jede Mitteilung trotzdem.';
/** Solange das Gerät keine Mitteilungen erlaubt. */
export const PUSH_NICHT_ERLAUBT = 'Das Handy erlaubt Konfi Quest noch keine Mitteilungen. Solange das so ist, kommt nichts an – die Auswahl unten gilt, sobald du es erlaubst.';

export const ladePushEinstellungen = async (): Promise<PushEinstellungen> => {
  const res = await api.get('/notifications/preferences');
  const d = res.data || {};
  return {
    push_enabled: d.push_enabled !== false,
    stumm: Array.isArray(d.stumm) ? d.stumm : [],
    gruppen: Array.isArray(d.gruppen) ? d.gruppen : []
  };
};

/**
 * Kurzfassung fuer die Meta-Zeile des Eintrags -- eine Zeile, die sagt, was
 * gerade gilt, ohne das Modal zu oeffnen.
 */
export const pushZusammenfassung = (e: PushEinstellungen | null, berechtigung: string): string => {
  if (berechtigung !== 'granted') return 'Noch nicht erlaubt – antippen zum Erlauben';
  if (!e) return 'Welche Mitteilungen aufs Handy kommen';
  if (!e.push_enabled) return 'Aus – nur im Postfach';
  const an = e.gruppen.filter((g) => g.aktiv).length;
  if (e.gruppen.length === 0 || an === e.gruppen.length) return 'Alle Mitteilungen aufs Handy';
  if (an === 0) return 'Keine Gruppe ausgewählt – nur im Postfach';
  return `${an} von ${e.gruppen.length} Gruppen aufs Handy`;
};

export interface PushAuswahlOptionen {
  /** Nach jeder gespeicherten Aenderung, damit der Eintrag darunter mitzieht. */
  onGeaendert?: (e: PushEinstellungen) => void;
  /** Meldungen im Fenster zeigen (`fehler`; der Dialog des Browsers) statt am Rand (App). */
  fehlerImDialog?: boolean;
}

export function usePushAuswahl({ onGeaendert, fehlerImDialog = false }: PushAuswahlOptionen = {}) {
  const { setError: meldungAmRand, pushNotificationsPermission, requestPushPermissions } = useApp();
  const [einstellungen, setEinstellungen] = useState<PushEinstellungen | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [speichert, setSpeichert] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  // Wohin eine Meldung geht. Heisst setError wie ueberall, damit die
  // Positivliste der Fehlertexte (utils/bekannteFehlertexte.ts) die
  // Aufrufstellen findet.
  const setError = (meldung: string) => (fehlerImDialog ? setFehler(meldung) : meldungAmRand(meldung));

  // Einmal beim Oeffnen laden -- bewusst OHNE setError in den Abhaengigkeiten.
  // Haengt der Effekt an setError und liefert der Kontext je Render eine neue
  // Funktion, laeuft er nach jedem Speichern erneut und ueberschreibt die
  // gerade gesetzte Auswahl mit dem alten Stand vom Server.
  useEffect(() => {
    let abgemeldet = false;
    ladePushEinstellungen()
      .then((e) => { if (!abgemeldet) setEinstellungen(e); })
      .catch((err) => { if (!abgemeldet) setError(fehlerText(err, 'Einstellungen konnten nicht geladen werden')); })
      .finally(() => { if (!abgemeldet) setLaedt(false); });
    return () => { abgemeldet = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // `messung`: welche Gruppe umgeschaltet wurde, fuer die anonyme Messung
  // (docs/messung/umami.md, S9) -- gemeldet erst nach der Antwort des Servers.
  const speichern = async (
    aenderung: { push_enabled?: boolean; stumm?: string[] },
    messung?: { gruppe: string; an: boolean }
  ) => {
    if (!einstellungen) return;
    setFehler(null);
    setSpeichert(true);
    try {
      const res = await api.put('/notifications/preferences', aenderung);
      const stumm: string[] = Array.isArray(res.data?.stumm) ? res.data.stumm : (aenderung.stumm ?? einstellungen.stumm);
      const neu: PushEinstellungen = {
        push_enabled: typeof res.data?.push_enabled === 'boolean' ? res.data.push_enabled : einstellungen.push_enabled,
        stumm,
        gruppen: einstellungen.gruppen.map((g) => ({ ...g, aktiv: !stumm.includes(g.id) }))
      };
      setEinstellungen(neu);
      onGeaendert?.(neu);
      if (messung) {
        trackHandlung('push-gruppe-umgeschaltet', {
          gruppe: serverSchluesselMesswert(messung.gruppe),
          an: messung.an ? 'true' : 'false'
        });
      }
    } catch (err) {
      setError(fehlerText(err, 'Einstellung konnte nicht gespeichert werden'));
    } finally {
      setSpeichert(false);
    }
  };

  /** Der Hauptschalter: alle Mitteilungen aufs Handy an oder aus. */
  const hauptSchalten = (an: boolean) => { void speichern({ push_enabled: an }, { gruppe: 'alle', an }); };

  /** Eine Gruppe an oder aus: die vollständige Abwahl-Liste geht an den Server. */
  const gruppeSchalten = (id: string, an: boolean) => {
    if (!einstellungen) return;
    const stumm = an
      ? einstellungen.stumm.filter((g) => g !== id)
      : [...einstellungen.stumm.filter((g) => g !== id), id];
    void speichern({ stumm }, { gruppe: id, an });
  };

  return {
    einstellungen,
    laedt,
    speichert,
    hauptSchalten,
    gruppeSchalten,
    erlaubt: pushNotificationsPermission === 'granted',
    erlauben: () => { void requestPushPermissions(); },
    fehler,
  };
}

export type PushAuswahlZustand = ReturnType<typeof usePushAuswahl>;
