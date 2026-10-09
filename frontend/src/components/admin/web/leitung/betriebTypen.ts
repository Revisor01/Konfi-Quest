// Die Kennzahlen des Servers (GET /metrics), soweit die Web-Fassung der Seite
// "Betrieb" sie liest. Die Form ist die der Seite (admin/pages/AdminMetricsPage.tsx):
// Sie laedt und rechnet die Urteile, die Web-Fassung stellt sie dar.

import type { BetriebsSnapshot } from '../../../../utils/betriebsKennzahlen';
import type { BetriebsReiterSchluessel } from '../../../../seiten/betrieb';

export interface BetriebsFehlerGruppe {
  route: string;
  status: number;
  anzahl: number;
  seit: string;
  zuletzt: string;
  beispielUrl: string;
}

export interface BetriebsEinzelfehler {
  route: string;
  url: string;
  status: number;
  durationMs: number;
  at: string;
}

/** Vom Browser gemeldete Verstoesse gegen die CSP der Web-App (POST /api/csp-meldung). */
export interface BetriebsCspGruppe {
  direktive: string;
  blockiert: string;
  seite: string;
  anzahl: number;
  seit: string;
  zuletzt: string;
}

export interface BetriebsCspMeldungen {
  gesamt: number;
  verworfen: number;
  gruppenAnzahl: number;
  grenze: number;
  gruppen: BetriebsCspGruppe[];
}

/** Ein Hintergrund-Job des Servers (utils/hintergrundLaeufe.js). */
export interface BetriebsHintergrundJob {
  name: string;
  bezeichnung: string;
  takt: string | null;
  letzterStart: string | null;
  letztesEnde: string | null;
  /** Dauer des letzten abgeschlossenen Laufs. */
  dauerMs: number | null;
  ergebnis: 'ok' | 'fehler' | 'laeuft' | null;
  fehler: string | null;
  anzahl: number;
  fehlerAnzahl: number;
  maxDauerMs: number;
  mittelDauerMs: number | null;
}

export interface BetriebsPushWeg {
  anzahl: number;
  fehler: number;
  empfaenger: number;
  maxDauerMs: number;
  mittelDauerMs: number | null;
  letzteDauerMs: number | null;
  zuletzt: string | null;
}

export interface BetriebsHintergrund {
  jobs: BetriebsHintergrundJob[];
  pushVersand: {
    jeWeg: { einzeln: BetriebsPushWeg; viele: BetriebsPushWeg; chat: BetriebsPushWeg };
    langsamster: { weg: string; art: string | null; empfaenger: number; dauerMs: number; zeit: string } | null;
  };
}

export interface BetriebsAnsicht extends BetriebsSnapshot {
  uptimeSeconds: number;
  totalRequests: number;
  inFlight: number;
  maxInFlight: number;
  rps: number;
  recentErrors: BetriebsEinzelfehler[];
  replicas?: { replica: string; requests: number; inFlight: number; share: number }[];
  apdex?: { wert: number | null; zufrieden: number; toleriert: number; frustriert: number; schwelleMs: number; toleriertBisMs: number };
  ueber1s?: { anzahl: number; quote: number; schwelleMs: number };
  statusKlassen?: { erfolg: number; ausDemCache: number; umleitung: number; nichtGefunden: number; abgelehnt: number; serverfehler: number };
  nutzer?: { fensterMinuten: number; aktiv: number; betroffen: number };
  fehlerGruppen?: BetriebsFehlerGruppe[];
  /** Fehlt bei einem Server vor dem 09.10.2026. */
  cspMeldungen?: BetriebsCspMeldungen;
  /** Hintergrund-Jobs und Push-Versand; fehlt bei einem Server vor dem 09.10.2026. */
  hintergrund?: BetriebsHintergrund;
}

export type BetriebsReiter = BetriebsReiterSchluessel;
