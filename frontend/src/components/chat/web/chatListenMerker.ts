// Was die Raumliste der Web-Fassung ueber einen Seitenwechsel hinweg behaelt.
//
// Die Liste (/…/chat) und der Raum (/…/chat/room/:id) sind zwei Seiten des
// Routers; beide zeigen dieselbe zweigeteilte Ansicht. Wer links einen Raum
// waehlt, wechselt von einer Seite zur anderen, und die Liste wird neu
// gezeichnet. Suchbegriff, Reiter und Scrollposition sollen dabei stehen
// bleiben -- sonst sprang die Liste nach jedem Klick nach oben. Auch die
// zuletzt geladenen Raeume bleiben: Das Lesen eines Raums leert den
// Zwischenspeicher der Liste (BadgeContext), und ohne diesen Stand liefe sie
// bei jedem Klick kurz durch den Ladezustand.
//
// Modul-Zustand statt Kontext: Er soll auch das Abhaengen der Seite
// ueberleben, und mehr als diese Werte gibt es nicht zu merken. Er gilt fuer
// die Sitzung im Browser und fuer ein Konto; ein Neuladen beginnt von vorn.

import type { ChatRoomOverview } from '../../../types/chat';
import { entwuerfeZuruecksetzen } from './chatEntwuerfe';

export interface ListenMerker {
  suche: string;
  filter: string;
  scroll: number;
  /** Die zuletzt geladenen Raeume: Die Liste steht damit sofort da. */
  raeume: ChatRoomOverview[] | null;
  /**
   * Wohin der Fokus nach dem naechsten Seitenwechsel soll: auf die Zeile des
   * gewaehlten Raums (Wahl per Tastatur -- sonst ginge die Stelle in der Liste
   * verloren, weil die alte Seite mitsamt dem Fokus abgebaut wird) oder in die
   * Eingabe des Raums (Wahl per Maus). null: nichts tun.
   */
  fokus: { ziel: 'zeile' | 'eingabe'; raumId: number } | null;
  /** Wem das alles gehoert: Wer sich anders anmeldet, beginnt von vorn. */
  nutzerId: number | null;
}

const merker: ListenMerker = { suche: '', filter: 'alle', scroll: 0, raeume: null, fokus: null, nutzerId: null };

/** Der aktuelle Stand (dasselbe Objekt, kein Abbild). */
export const listenMerker = (): ListenMerker => merker;

/** Alles vergessen -- Raeume, Suche, Reiter, Scrollposition und die Entwuerfe. */
export const listenMerkerZuruecksetzen = (): void => {
  merker.suche = '';
  merker.filter = 'alle';
  merker.scroll = 0;
  merker.raeume = null;
  merker.fokus = null;
  merker.nutzerId = null;
  entwuerfeZuruecksetzen();
};

/**
 * Der Stand fuer dieses Konto. Meldet sich in demselben Browserfenster jemand
 * anderes an (ohne dass die Seite neu geladen wird), sind die Raeume und
 * Entwuerfe der Vorgaengerin nicht seine -- dann beginnt alles von vorn.
 */
export const listenMerkerFuer = (nutzerId: number | undefined): ListenMerker => {
  if (nutzerId !== undefined && merker.nutzerId !== nutzerId) {
    listenMerkerZuruecksetzen();
    merker.nutzerId = nutzerId;
  }
  return merker;
};
