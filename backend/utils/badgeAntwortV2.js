// backend/utils/badgeAntwortV2.js
// Die EINE Antwortform der Abzeichen-Generation v2 — fuer Konfi UND Teamer.
//
// WARUM ES DIESE DATEI GIBT (31.08.2026)
// Bis hierher hatten die beiden Rollen zwei verschiedene Vertraege fuer
// dieselbe Sache:
//   GET /konfi/badges   -> Objekt { available, earned, stats }, POST mark-seen
//   GET /teamer/badges  -> ARRAY  + Zaehler in den Kopfzeilen, PUT mark-seen
// Der Versuch, das am 28.08.2026 durch eine stille Aenderung an der
// Teamer-Route anzugleichen, hat am 29.08. die ausgelieferten Apps zerlegt
// (Array -> Objekt, `.filter()` warf einen TypeError). Deshalb jetzt der
// saubere Weg: eine NEUE, versionierte Route je Rolle mit identischer Huelle,
// waehrend die alten Routen unveraendert weiterlaufen, bis keine App im Store
// sie mehr ruft (siehe docs/api/ABRISS.md).
//
// WELCHE FELDER MITKOMMEN — und warum die anderen nicht
// custom_badges hat 14 Spalten. Die Ansichten lesen davon neun. Die
// restlichen fuenf sind reine Verwaltungsfelder, die nie auf einem Bildschirm
// landen und je Antwort rund 3,3 kB kosten (gemessen an Produktion:
// 27 Abzeichen = 13,4 kB):
//   created_at, created_by  — Verwaltungsspuren, nur in der Leitungs-Oberflaeche
//                             relevant, und die laedt ueber /admin/badges.
//   organization_id         — steht schon im Token des Aufrufers; die Route
//                             filtert ohnehin danach.
//   target_role             — die Route liefert je Rolle nur die eigene Sorte,
//                             der Wert ist also fuer alle Zeilen derselbe.
//
// NACHGEMESSEN UND BEWUSST DRIN GEBLIEBEN (nicht streichen!):
//   criteria_type, criteria_value — BadgesView.tsx gruppiert die Abzeichen in
//                             17 Kategorien danach und sortiert innerhalb der
//                             Kategorie nach criteria_value.
//   criteria_extra          — die Abzeichen-Karte zeigt die Bedingung im Detail.
//   is_active               — die Anzeige-Form fuehrt es mit.
//   sort_order              — DashboardView.tsx sortiert die Abzeichen-Kreise
//                             der Startseite danach. Stand faelschlich auf der
//                             Streichliste; ohne das Feld waere die Reihenfolge
//                             auf der Konfi-Startseite stillschweigend
//                             durcheinandergeraten.
//   is_hidden               — trennt geheime von sichtbaren Abzeichen.
//   id, name, description, icon, color — die sichtbare Karte selbst.
//   seen                    — NACHGEPRUEFT und bewusst drin: Die Konfi-Seite
//                             markiert nicht pauschal beim Oeffnen, sondern nur
//                             wenn wirklich ungesehene Abzeichen dabei sind
//                             (KonfiBadgesPage.tsx: `earned.filter(b => !b.seen)`).
//                             Ohne das Feld waere jedes Abzeichen "ungesehen"
//                             und bei JEDEM Laden ginge ein mark-seen raus —
//                             genau die Dopplung, die am 24.08.2026 gemessen und
//                             abgestellt wurde. Der Teamer-Pfad fuehrt das Feld
//                             nicht (dort markiert die Seite pauschal); in der
//                             Antwort fehlt es dann schlicht.

// Genau die Felder, die in der v2-Antwort landen. Alles andere aus
// custom_badges bleibt draussen (Begruendung siehe oben).
const V2_FELDER = [
  'id',
  'name',
  'description',
  'icon',
  'color',
  'criteria_type',
  'criteria_value',
  'criteria_extra',
  'is_hidden',
  'is_active',
  'sort_order',
  // Berechnet, nicht aus custom_badges:
  'earned',
  'earned_at',
  'seen',
  'unreachable',
  'progress'
];

// Ein Abzeichen auf die v2-Felder eindampfen.
function schlankesAbzeichen(badge) {
  const schlank = {};
  for (const feld of V2_FELDER) {
    if (badge[feld] !== undefined) schlank[feld] = badge[feld];
  }
  return schlank;
}

// Die gemeinsame v2-Huelle bauen.
//
// Erwartet das Ergebnis einer Rollen-Berechnung ({ available, earned, stats })
// — also genau das, was utils/konfiBadgeProgress.js und
// utils/teamerBadgeProgress.js liefern. Die Rollen rechnen unterschiedlich
// (Punktekonto vs. Teamer-Jahre), die HUELLE ist identisch.
function baueBadgeAntwortV2({ available, earned, stats }) {
  return {
    available: (available || []).map(schlankesAbzeichen),
    earned: (earned || []).map(schlankesAbzeichen),
    stats: {
      totalVisible: stats?.totalVisible ?? 0,
      totalSecret: stats?.totalSecret ?? 0
    }
  };
}

module.exports = { baueBadgeAntwortV2, schlankesAbzeichen, V2_FELDER };
