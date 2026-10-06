// Rechnen und Ordnen der Konfi-Liste der Leitung -- eine Stelle fuer die App
// (components/admin/KonfisView.tsx) und die Web-Fassung
// (components/admin/web/leitung/WebKonfis.tsx).
//
// Die Regeln, die hier stehen, waren bis 03.10.2026 in KonfisView ausgeschrieben:
//   - Eine Punkteart, die der Jahrgang abgeschaltet hat, zaehlt nicht zur
//     Summe und nicht zum Ziel (fehlt das Feld, gilt sie als aktiv).
//   - Das Ziel je Art kommt aus dem Jahrgang; fehlt es oder steht dort 0,
//     gelten 10 (der Regler beginnt bei 1).
//   - "Erreicht" heisst: die Summe der aktiven Arten hat das Gesamtziel erreicht.

export interface KonfiListenEintrag {
  id: number;
  name: string;
  username?: string;
  jahrgang?: string;
  jahrgang_name?: string;
  gottesdienst_points?: number;
  gemeinde_points?: number;
  gottesdienst_enabled?: boolean;
  gemeinde_enabled?: boolean;
  target_gottesdienst?: number;
  target_gemeinde?: number;
  /** Altform der Antwort, vor gottesdienst_points und gemeinde_points. */
  points?: { gottesdienst: number; gemeinde: number };
  badgeCount?: number;
  activities_count?: number;
  /** Optional: der Zeitpunkt der letzten Aktivitaet, sobald die Liste ihn liefert. */
  letzte_aktivitaet?: string | null;
}

export interface KonfiPunkte {
  gottesdienst: number;
  gemeinde: number;
  /** Summe der AKTIVEN Arten. */
  gesamt: number;
  gottesdienstAn: boolean;
  gemeindeAn: boolean;
  zielGottesdienst: number;
  zielGemeinde: number;
  /** Ziel der aktiven Arten zusammen. */
  zielGesamt: number;
  prozentGottesdienst: number;
  prozentGemeinde: number;
  prozentGesamt: number;
  /** Das Gesamtziel ist erreicht (mindestens eine Art aktiv). */
  erreicht: boolean;
}

export const konfiPunkte = (k: KonfiListenEintrag): KonfiPunkte => {
  const gottesdienstAn = k.gottesdienst_enabled !== false;
  const gemeindeAn = k.gemeinde_enabled !== false;
  const gottesdienst = k.gottesdienst_points ?? k.points?.gottesdienst ?? 0;
  const gemeinde = k.gemeinde_points ?? k.points?.gemeinde ?? 0;
  const zielGottesdienst = k.target_gottesdienst || 10;
  const zielGemeinde = k.target_gemeinde || 10;
  const gesamt = (gottesdienstAn ? gottesdienst : 0) + (gemeindeAn ? gemeinde : 0);
  const zielGesamt = (gottesdienstAn ? zielGottesdienst : 0) + (gemeindeAn ? zielGemeinde : 0);
  const prozent = (wert: number, ziel: number) => (ziel > 0 ? Math.round((wert / ziel) * 100) : 0);
  return {
    gottesdienst,
    gemeinde,
    gesamt,
    gottesdienstAn,
    gemeindeAn,
    zielGottesdienst,
    zielGemeinde,
    zielGesamt,
    prozentGottesdienst: prozent(gottesdienst, zielGottesdienst),
    prozentGemeinde: prozent(gemeinde, zielGemeinde),
    prozentGesamt: prozent(gesamt, zielGesamt),
    erreicht: zielGesamt > 0 && gesamt >= zielGesamt,
  };
};

/** Zwei Buchstaben fuer den Kreis: erster und letzter Name, bei einem Namen dessen Anfang; ohne Namen leer. */
export const initialen = (name: string | undefined | null): string => {
  const woerter = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (woerter.length === 0) return '';
  if (woerter.length === 1) return woerter[0].substring(0, 2).toUpperCase();
  return (woerter[0][0] + woerter[woerter.length - 1][0]).toUpperCase();
};

/** Der Jahrgang einer Zeile: Name aus der Antwort, sonst die Altform. */
export const jahrgangVon = (k: Pick<KonfiListenEintrag, 'jahrgang_name' | 'jahrgang'>): string =>
  k.jahrgang_name || k.jahrgang || '';

export type KonfiSortierSchluessel = 'name' | 'jahrgang' | 'punkte' | 'badges';
export type Richtung = 'auf' | 'ab';

/** Die Richtung, mit der eine Spalte beim ersten Klick beginnt: Zahlen groesste zuerst, Namen A-Z. */
export const ERSTE_RICHTUNG: Record<KonfiSortierSchluessel, Richtung> = {
  name: 'auf',
  jahrgang: 'auf',
  punkte: 'ab',
  badges: 'ab',
};

const text = (a: string, b: string): number => a.localeCompare(b, 'de');

/**
 * Konfis ordnen. Bei gleichem Wert entscheidet der Name (A-Z), damit die
 * Reihenfolge nicht vom Zufall der Antwort abhaengt. Die Liste selbst bleibt
 * unveraendert.
 */
export function sortiereKonfis<T extends KonfiListenEintrag>(konfis: readonly T[], nach: KonfiSortierSchluessel, richtung: Richtung): T[] {
  const vorzeichen = richtung === 'auf' ? 1 : -1;
  const wert = (k: T): number | string => {
    switch (nach) {
      case 'punkte': return konfiPunkte(k).gesamt;
      case 'badges': return k.badgeCount || 0;
      case 'jahrgang': return jahrgangVon(k);
      default: return k.name || '';
    }
  };
  return [...konfis].sort((a, b) => {
    const x = wert(a);
    const y = wert(b);
    const vergleich = typeof x === 'number' && typeof y === 'number' ? x - y : text(String(x), String(y));
    return vergleich !== 0 ? vergleich * vorzeichen : text(a.name || '', b.name || '');
  });
}

/** Was die Jahrgangs-Regel vom angemeldeten Konto braucht (AppContext: user). */
export interface JahrgangsKonto {
  role_name?: string;
  is_super_admin?: boolean;
  assigned_jahrgaenge?: Array<{ id: number; can_view?: boolean }>;
}

/**
 * Die Jahrgaenge, die dieses Konto in der Leitung sieht (CLAUDE.md, "Wer sieht
 * und bekommt was"): die Gemeindeleitung alle ihrer Gemeinde, eine Leitung nur
 * die ihr zugewiesenen (mit Sicht). GET /admin/jahrgaenge liefert alle
 * Jahrgaenge der Gemeinde, ohne Rolle zu beruecksichtigen -- die Auswahl und
 * die Zahlen der Seite richten sich deshalb nach dieser Regel.
 */
export function sichtbareJahrgaenge<J extends { id: number }>(jahrgaenge: readonly J[], konto: JahrgangsKonto | null | undefined): J[] {
  if (!konto) return [];
  if (konto.role_name === 'org_admin' || konto.is_super_admin === true) return [...jahrgaenge];
  const erlaubt = new Set((konto.assigned_jahrgaenge ?? []).filter((j) => j.can_view !== false).map((j) => j.id));
  return jahrgaenge.filter((j) => erlaubt.has(j.id));
}

/** Der Name einer Teamer:in in der Liste: Anzeigename, sonst der Name aus der Abfrage (dort als `name` aliast). */
export const teamerName = (t: { display_name?: string; name: string }): string => t.display_name || t.name;
