// „Support-Daten geändert" -- EINE Stelle für alle Ansichten der Support-Ansicht
// (03.10.2026, docs/planung/support-vorgaenge.md, Entscheidung 8).
//
// Simon: „Die Postfächer im Support und die Listen aktualisieren sich nicht gut,
// wenn ich den Status ändere oder sonst was."
//
// Der Fehler: Ionic hält besuchte Seiten im Speicher. Liste, Detail, Übersicht
// und die roten Zahlen der Leiste stehen gleichzeitig eingehängt; jede lud nur
// beim ersten Einhängen, beim Zurückkehren oder im Takt der Zahl -- eine
// Änderung im Detail (Status, Einordnen, Antworten, Gelesen) sah keine andere
// Stelle. Jede Ansicht hatte ihren eigenen Weg, und jeder Weg hatte Lücken.
//
// Jetzt gibt es einen Weg:
//   - Wer etwas ändert, ruft danach `meldeSupportGeaendert()`.
//   - Wer Daten zeigt, ruft `useSupportGeaendert(laden)`; `laden` läuft dann
//     bei jeder Meldung, beim Betreten der Seite (Ionic) und wenn das Fenster
//     wieder sichtbar wird (Wechsel des Browser-Tabs, App aus dem Hintergrund).
//   - Die roten Zahlen der Leiste (navigation/supportMailZaehler.ts) hören
//     auf dieselbe Meldung.
//
// Mehrere Meldungen im selben Augenblick (Status setzen UND Mails als gelesen
// melden) ergeben EINE Benachrichtigung. Wer selbst meldet, kann sich als
// `quelle` eintragen und wird nicht von der eigenen Meldung geweckt -- er
// lädt nach seiner Änderung ohnehin selbst, und so kann „als gelesen melden
// nach dem Laden" keine Schleife bilden.

import { useEffect, useRef, useState } from 'react';
import { useIonViewWillEnter } from '@ionic/react';

type Horcher = (quelle: unknown) => void;

const horcher = new Set<Horcher>();
/** Quellen der Meldungen, die gerade gesammelt werden (`undefined` = ohne Angabe). */
let gesammelt: Set<unknown> | null = null;

/**
 * Die Support-Daten haben sich geändert: Status, Einordnen, Antworten, Gelesen,
 * Einsortieren, Archivieren, Löschen, Bausteine, Struktur, Konten.
 * `quelle`: der Aufrufer, der selbst neu lädt (wird nicht erneut geweckt).
 */
export function meldeSupportGeaendert(quelle?: unknown): void {
  if (gesammelt) {
    gesammelt.add(quelle);
    return;
  }
  gesammelt = new Set([quelle]);
  queueMicrotask(() => {
    const quellen = gesammelt ?? new Set<unknown>();
    gesammelt = null;
    for (const h of [...horcher]) {
      // Ein Horcher ist geweckt, es sei denn, ALLE gesammelten Meldungen
      // stammen von ihm selbst.
      h([...quellen]);
    }
  });
}

/** Auf Meldungen hören; gibt die Abmeldung zurück. Für Stellen außerhalb von React (die roten Zahlen). */
export function abonniereSupportGeaendert(horche: () => void, eigeneQuelle?: unknown): () => void {
  const huelle: Horcher = (quellen) => {
    const fremde = (quellen as unknown[]).some((q) => q === undefined || q !== eigeneQuelle);
    if (fremde) horche();
  };
  horcher.add(huelle);
  return () => { horcher.delete(huelle); };
}

/** Eine stabile Kennung für `quelle`: dieselbe über alle Renderings einer Stelle. */
export function useSupportQuelle(): object {
  const [quelle] = useState<object>(() => ({}));
  return quelle;
}

export interface SupportGeaendertOptionen {
  /** Der Aufrufer meldet selbst und lädt danach von sich aus: seine eigenen Meldungen wecken ihn nicht. */
  quelle?: unknown;
  /**
   * Auch beim Betreten der Seite laden (Ionic hält Seiten im Speicher und
   * zeigt sie beim Zurückkehren wieder). Vorgabe: ja. Wer das schon anders
   * tut (`useWebDaten` lädt beim Zurückkehren selbst), schaltet es aus.
   */
  beimBetreten?: boolean;
}

/**
 * Holt `laden` auf, sobald sich Support-Daten ändern, die Seite betreten wird
 * oder das Fenster wieder sichtbar wird. `laden` darf bei jedem Rendern ein
 * anderes sein; es läuft immer die neueste Fassung. Der erste Eintritt in die
 * Seite lädt nicht noch einmal -- das hat der erste Abruf der Seite schon getan.
 */
export function useSupportGeaendert(laden: () => unknown, { quelle, beimBetreten = true }: SupportGeaendertOptionen = {}): void {
  const neueste = useRef(laden);
  useEffect(() => { neueste.current = laden; });

  useEffect(() => {
    const aufrufen = () => { void neueste.current(); };
    const abmelden = abonniereSupportGeaendert(aufrufen, quelle);
    const sichtbar = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') aufrufen();
    };
    document.addEventListener('visibilitychange', sichtbar);
    return () => {
      abmelden();
      document.removeEventListener('visibilitychange', sichtbar);
    };
  }, [quelle]);

  const ersterEintritt = useRef(true);
  useIonViewWillEnter(() => {
    if (ersterEintritt.current) {
      ersterEintritt.current = false;
      return;
    }
    if (beimBetreten) void neueste.current();
  });
}
