import { useEffect, useSyncExternalStore } from 'react';
import api from '../services/api';
import { useApp } from '../contexts/AppContext';
import type { MailZaehler } from '../types/support';
import { istSuperAdmin } from '../utils/superAdmin';
import { zaehlerLesen } from '../utils/supportMail';

// Die roten Zahlen der Support-Mail (03.10.2026, docs/planung/support-mail.md,
// Entscheidung 5: „rote Zahl in der Support-Ansicht, kein Push").
//
// EIN Stand fuer alle Stellen, die sie zeigen -- die Leiste links der
// Web-Version (ueber navigation/reiterZaehler.ts), die Uebersicht und der
// Posteingang. Liest eine Seite Mails als gelesen, frischt sie diesen Stand
// auf, und alle Stellen zeigen dieselbe Zahl.
//
// Abgerufen wird GET /support/mail/zaehler nur, solange eine Stelle die Zahl
// wirklich zeigt (`useSupportMailZaehler(true)`) und das Konto
// Super-Admin-Recht hat. Die Reiterleiste der Apps fragt nie: Simons Konto
// (Gemeindeleitung mit Merkmal) traegt dort keinen Support-Eintrag, und ein
// Abruf alle zwei Minuten auf dem Handy waere Last ohne Anzeige.

/** Nachladen, solange die Zahl zu sehen ist: alle zwei Minuten, wie das Abholen der Postfaecher. */
export const ZAEHLER_TAKT_MS = 2 * 60 * 1000;

let stand: MailZaehler | null = null;
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

/** Nach „gelesen" oder Zuordnen: neu holen -- aber nur, wenn die Zahl gerade irgendwo steht. */
export function supportMailZaehlerAuffrischen(): void {
  if (lader > 0) void supportMailZaehlerLaden();
}

/**
 * Eingehende Mails als gelesen melden (POST /support/mail/gelesen) und die
 * Zahl auffrischen. Ohne Kennungen kein Aufruf. Scheitert die Meldung,
 * bleibt die Mail ungelesen und die Zahl steht weiter -- die Seite zeigt die
 * Mail trotzdem; beim naechsten Oeffnen wird es erneut versucht.
 */
export async function mailsAlsGelesen(ids: readonly number[]): Promise<boolean> {
  if (ids.length === 0) return false;
  try {
    await api.post('/support/mail/gelesen', { ids: [...ids] });
  } catch {
    return false;
  }
  supportMailZaehlerAuffrischen();
  return true;
}

/**
 * Die rote Zahl je Eintrag -- EINE Rechnung fuer Leiste und Uebersicht.
 * Anfragen: ungelesene Mails zu Anfragen. Posteingang: die nicht
 * zugeordneten UND die der Gemeinden; deren Schriftwechsel erreicht man ueber
 * den Posteingang, und dort stehen beide. Sonst stuende eine Mail einer
 * Gemeindeleitung, die der Server ihrer Gemeinde zuordnet, an keiner roten
 * Zahl.
 */
export function supportMailZahl(zaehler: MailZaehler | null, schluessel: 'supportAnfragen' | 'supportPost'): number {
  if (!zaehler) return 0;
  return schluessel === 'supportAnfragen' ? zaehler.anfragen : zaehler.eingang + zaehler.gemeinden;
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
export function useSupportMailZaehler(laden = false): MailZaehler | null {
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
    return () => {
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
