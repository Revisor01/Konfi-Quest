// Schluessel der Challenge-Listen im Offline-Speicher (useOfflineQuery).
//
// An EINER Stelle, weil seit 2.4.0 zwei Seiten sie lesen: die Liste selbst
// und, ohne Netz, die Seite einer einzelnen Challenge. Die nimmt dann den
// Stand aus der zuletzt geladenen Liste, so wie es der fruehere Dialog tat,
// der seine Challenge aus der Liste bekam. Laege der Schluessel zweimal im
// Code, fiele ein Umbenennen auf der einen Seite erst offline auf.

interface ListenNutzer {
  id?: number | null;
  type?: string | null;
  organization_id?: number | null;
}

/** Teilnahme-Liste der Konfis (GET /challenges/konfi). */
export const konfiChallengeListe = (user: ListenNutzer | null | undefined): string =>
  'konfi:challenges:' + user?.id;

/**
 * Leitungsliste (GET /challenges/admin). Die Teamer-Sicht haengt
 * zusaetzlich an der Person: Das Backend filtert nach zugewiesenen
 * Jahrgaengen, zwei Teamer:innen derselben Gemeinde sehen also NICHT
 * dasselbe -- ein gemeinsamer Schluessel schoebe ihnen gegenseitig die
 * Liste unter.
 */
export const leitungChallengeListe = (user: ListenNutzer | null | undefined): string =>
  user?.type === 'teamer'
    ? `teamer:challenges:${user?.organization_id}:${user?.id}`
    : 'admin:challenges:' + user?.organization_id;
