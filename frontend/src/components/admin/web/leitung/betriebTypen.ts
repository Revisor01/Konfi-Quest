// Die Kennzahlen des Servers (GET /metrics), soweit die Web-Fassung der Seite
// "Betrieb" sie liest. Die Form ist die der Seite (admin/pages/AdminMetricsPage.tsx):
// Sie laedt und rechnet die Urteile, die Web-Fassung stellt sie dar.

import type { BetriebsSnapshot } from '../../../../utils/betriebsKennzahlen';

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
}

export type BetriebsReiter = 'ueberblick' | 'fehler' | 'routen' | 'verlauf';
