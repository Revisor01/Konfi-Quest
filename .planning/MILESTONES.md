# Milestones

## v1.0 Security + Stabilisierung (Shipped: 2026-03-01)

**Phases completed:** 2 phases, 5 plans
**Timeline:** 2026-02-28 bis 2026-03-01 (2 Tage)
**Stats:** 37 files changed, 2294 insertions, 340 deletions

**Key accomplishments:**
- helmet Security Headers und express-validator Input-Validierung auf allen 15 Backend-Routes
- Multi-Tenant-Isolation lueckenlos: notifications.js und settings.js mit organization_id-Filterung
- SQL-Injection-Fix: getPointField Whitelist ersetzt unsichere Template-Literals in 8 Stellen
- TabBar-Rendering stabilisiert: registerTabBarEffect entfernt, CSS-only fuer 6+ Tabs
- Theme-Isolation: iOS26 und MD3 koexistieren ohne Kollisionen (Platform-scoped Overrides)
- Badge Double-Count-Risiko eliminiert: Fallback-Berechnungspfad entfernt, nur konfi_profiles Werte

**Known Gaps (Phasen 3-7 nicht ausgefuehrt):**
- DES-01 bis DES-04: Design-System Grundlagen (Phase 3)
- ADM-01 bis ADM-12: Admin-Views Design-Konsistenz (Phasen 4+5)
- MOD-01 bis MOD-04: Modal-Konsistenz (Phase 6)
- ONB-01, ONB-02: Onboarding-Validierung (Phase 7)

**Tech Debt:**
- SEC-05 Wiring-Gap: error.rateLimitMessage in api.ts ungenutzt (Login funktioniert ueber alternativen Pfad)
- iOS Glass-Effekt und Android Theme-Isolation visuell ausstehend

---

