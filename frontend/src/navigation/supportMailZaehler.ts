import { useEffect, useSyncExternalStore } from 'react';
import api from '../services/api';
import { useApp } from '../contexts/AppContext';
import { istSuperAdmin } from '../utils/superAdmin';
import { zaehlerLesen, type SupportZaehler } from '../utils/supportMail';
import { abonniereSupportGeaendert, meldeSupportGeaendert } from '../utils/supportAktualisieren';

// Die roten Zahlen der Support-Ansicht (03.10.2026, docs/planung/support-mail.md,
// Entscheidung 5: „rote Zahl in der Support-Ansicht, kein Push"; seit den
// Vorgaengen docs/planung/support-vorgaenge.md, Entscheidung 7 und 8).
//
// EIN Stand fuer alle Stellen, die sie zeigen -- die Leiste links der
// Web-Version (ueber navigation/reiterZaehler.ts), die Uebersicht und der
// Posteingang. Aendert irgendeine Ansicht Support-Daten (Status gesetzt, Mail
// gelesen, einsortiert, archiviert, geloescht ...), meldet sie das ueber
// utils/supportAktualisieren.ts, und dieser Stand laedt sofort neu -- ohne auf
// den Takt zu warten. Dasselbe beim Wiederaufnehmen des Fensters.
//
// Abgerufen wird GET /support/mail/zaehler nur, solange eine Stelle die Zahl
// wirklich zeigt (`useSupportMailZaehler(true)`) und das Konto
// Super-Admin-Recht hat. Die Reiterleiste der Apps fragt nie: Dort steht kein
// Support-Eintrag, auch nicht in Simons Konto (Gemeindeleitung mit Merkmal),
// und ein Abruf alle zwei Minuten auf dem Handy waere Last ohne Anzeige. In der
// Leiste der Web-Version fragt Simons Konto dagegen mit: Sie haengt ihm die
// Gruppen der Support-Ansicht an (03.10.2026).

/** Nachladen, solange die Zahl zu sehen ist: alle zwei Minuten, wie das Abholen der Postfaecher. */
export const ZAEHLER_TAKT_MS = 2 * 60 * 1000;

let stand: SupportZaehler | null = null;
let laufend: Promise<void> | null = null;
let lader = 0;
let takt: ReturnType<typeof setInterval> | null = null;
const horcher = new Set<() => void>();

const melden = () => horcher.forEach((h) => h());

/** Den Stand neu holen; gleichzeitige Aufrufe teilen sich einen Abruf. Ein Fehler laesst den letzten Stand stehen. */
export function supportMailZaehlerLaden(): Promise<void> {
  if (laufend) return laufend;
  laufend = (async () => {
    try {
      const antwort = await api.get('/support/mail/zaehler');
      const neu = zaehlerLesen(antwort.data);
      if (neu) {
        stand = neu;
        melden();
      }
    } catch {
      // Die Zahl ist ein Hinweis, keine Aufgabe: Ohne Netz bleibt der letzte Stand.
    } finally {
      laufend = null;
    }
  })();
  return laufend;
}

/** Neu holen -- aber nur, wenn die Zahl gerade irgendwo steht. */
export function supportMailZaehlerAuffrischen(): void {
  if (lader > 0) void supportMailZaehlerLaden();
}

// Jede gemeldete Aenderung frischt die Zahl auf (utils/supportAktualisieren.ts).
// Einmal beim Laden des Moduls angemeldet: Der Stand gehoert allen Stellen, nicht
// einer Seite.
abonniereSupportGeaendert(supportMailZaehlerAuffrischen);

/**
 * Eingehende Mails als gelesen melden (POST /support/mail/gelesen) und das
 * allen Ansichten sagen: die Zahl der Leiste sinkt, Listen zeigen die Mail
 * nicht mehr fett. Ohne Kennungen kein Aufruf. Scheitert die Meldung, bleibt
 * die Mail ungelesen und die Zahl steht weiter -- die Seite zeigt die Mail
 * trotzdem; beim naechsten Oeffnen wird es erneut versucht.
 * `quelle`: die Stelle, die danach selbst laedt (utils/supportAktualisieren.ts).
 */
export async function mailsAlsGelesen(ids: readonly number[], quelle?: unknown): Promise<boolean> {
  if (ids.length === 0) return false;
  try {
    await api.post('/support/mail/gelesen', { ids: [...ids] });
  } catch {
    return false;
  }
  meldeSupportGeaendert(quelle);
  return true;
}

/**
 * Die rote Zahl je Eintrag -- EINE Rechnung fuer Leiste und Uebersicht, die der
 * Server schon fertig liefert (GET /support/mail/zaehler):
 *   Vorgaenge: nicht archivierte Vorgaenge mit Status „Neu" oder mit
 *   ungelesener Mail. Posteingang: ungelesene, nicht einsortierte, nicht
 *   archivierte Mails -- genau das, was dort in der Liste steht (Mitteilung =
 *   Sichtbarkeit, CLAUDE.md).
 */
export function supportMailZahl(zaehler: SupportZaehler | null, schluessel: 'supportVorgaenge' | 'supportPosteingang'): number {
  if (!zaehler) return 0;
  return schluessel === 'supportVorgaenge' ? zaehler.vorgaenge : zaehler.posteingang;
}

/** Nur fuer Tests: Stand, Abruf und Takt zuruecksetzen. */
export function supportMailZaehlerZuruecksetzen(): void {
  stand = null;
  laufend = null;
  lader = 0;
  if (takt) clearInterval(takt);
  takt = null;
  melden();
}

const abonnieren = (h: () => void) => {
  horcher.add(h);
  return () => { horcher.delete(h); };
};
const lesen = () => stand;

/**
 * Die Zahlen der Support-Mail, oder null (noch nicht geladen, kein
 * Super-Admin). Mit `laden` zeigt die Stelle die Zahl und haelt sie frisch:
 * Abruf beim Einhaengen, dann im Takt, solange mindestens eine solche Stelle
 * eingehaengt ist.
 */
export function useSupportMailZaehler(laden = false): SupportZaehler | null {
  const { user } = useApp();
  const darf = istSuperAdmin(user);
  const aktiv = laden && darf;

  useEffect(() => {
    if (!aktiv) return undefined;
    lader += 1;
    void supportMailZaehlerLaden();
    // Ionic haelt besuchte Seiten eingehaengt -- im verborgenen Tab (oder
    // der App im Hintergrund) faellt der Takt deshalb aus.
    if (!takt) {
      takt = setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
        void supportMailZaehlerLaden();
      }, ZAEHLER_TAKT_MS);
    }
    // Das Fenster ist wieder da (anderer Tab, App aus dem Hintergrund): sofort
    // neu holen statt bis zum naechsten Takt mit einer alten Zahl zu stehen.
    const sichtbar = () => {
      if (document.visibilityState === 'visible') void supportMailZaehlerLaden();
    };
    document.addEventListener('visibilitychange', sichtbar);
    return () => {
      document.removeEventListener('visibilitychange', sichtbar);
      lader -= 1;
      if (lader <= 0 && takt) {
        clearInterval(takt);
        takt = null;
      }
    };
  }, [aktiv]);

  const wert = useSyncExternalStore(abonnieren, lesen, lesen);
  return darf ? wert : null;
}
