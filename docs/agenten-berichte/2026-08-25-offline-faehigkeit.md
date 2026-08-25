# Offline-Fähigkeit: Was geht ohne Verbindung, was nicht

**Auftrag:** Bestandsaufnahme Lesen/Schreiben ohne Verbindung, Lücken benennen,
Ergänzungen vorschlagen (Analyse, kein Umbau).
**Datum:** 25.08.2026
**Geprüfter Commit:** `6b12e672` (main)
**Urteil in einem Satz:** Die Offline-Basis ist solide (alle Listen-Seiten
gecacht, Chat vollständig offline-fähig), aber genau die drei Dinge, die man
unterwegs wirklich tut — Aktivität melden, Anwesenheit erfassen, Tageslosung
lesen — scheitern an je einer kleinen, gut schließbaren Lücke.

---

## 1. Bestandsaufnahme LESEN

Mechanik: `useOfflineQuery` (frontend/src/hooks/useOfflineQuery.ts) liefert
SWR-Verhalten — Cache sofort anzeigen, im Hintergrund revalidieren, offline
den letzten Stand behalten. Speicher: Capacitor `Preferences`
(frontend/src/services/offlineCache.ts:1-46). Offline ohne Cache:
"Keine Daten verfügbar (offline)" (useOfflineQuery.ts:207).

TTL-Konstanten (offlineCache.ts:11-23):

| Konstante | TTL | genutzt für |
|---|---|---|
| DASHBOARD | 5 Min | Konfi-/Teamer-Dashboard |
| EVENTS | 10 Min | Event-Listen aller Rollen |
| CHAT_ROOMS | 2 Min | Raumliste, Raum-Detail |
| CHAT_MESSAGES | 1 Std | letzte 100 Nachrichten je Raum |
| STAMMDATEN | 1 Std | Aktivitäten, Kategorien, Jahrgänge, Levels, Orgs, Material |
| PROFILE | 15 Min | Profile, Konfi-Stats, Material-Detail |
| BADGES | 30 Min | Abzeichen |
| REQUESTS | 5 Min | Anträge, Challenges |
| SETTINGS | 30 Min | Einstellungen |
| TAGESLOSUNG | 24 Std | nur Teamer (siehe Lücke unten) |
| KONFIS | 5 Min | Konfi-Liste, Users |

Wichtig: TTL heißt hier nur "wann revalidieren" — abgelaufene Einträge werden
offline trotzdem angezeigt (isStale), nichts verfällt hart.

### Seiten-Tabelle

**Konfi (6 Seiten):**

| Seite | gecacht | TTL | offline sichtbar |
|---|---|---|---|
| Dashboard (KonfiDashboardPage.tsx:147-185) | ja (4 Queries) | 5m/15m/10m/30m | Punkte, Fortschritt, nächste Termine, Abzeichen |
| — Tageslosung (views/DashboardView.tsx:206, 308) | **nein** (api.get) | — | fehlt offline |
| — Challenge-Karte (views/DashboardView.tsx:256) | **nein** | — | fehlt offline |
| Events (KonfiEventsPage.tsx:91, 98) | ja | 10m/5m | Terminliste + eigene Anträge |
| Event-Detail (views/EventDetailView.tsx:92) | Grunddaten ja | 10m | Beschreibung/Status ja; **Zeitfenster, Teilnehmerliste fehlen** (api.get :231, :243) |
| Challenges (KonfiChallengesPage.tsx:31) | ja | 5m | Liste inkl. Einreich-Status |
| Badges (KonfiBadgesPage.tsx:57, 64) | ja | 30m/15m | vollständig |
| Profil (KonfiProfilePage.tsx:80) | Profil ja | 15m | Stammdaten ja; **Wrapped-Historie, Badges-Detail, Challenge-Zähler fehlen** (views/ProfileView.tsx:219, 249, 262) |

**Teamer (8 Seiten): vollständig gecacht** — die konsequenteste Rolle.
Dashboard inkl. Tageslosung (TeamerDashboardPage.tsx:270, 277, **307 mit
CACHE_TTL.TAGESLOSUNG**), Events+Anträge (TeamerEventsPage.tsx:136, 143),
Challenges (:39), Badges (:45), Konfi-Stats (TeamerKonfiStatsPage.tsx:223),
Material samt Detail (TeamerMaterialPage.tsx:101, 109;
TeamerMaterialDetailPage.tsx:79), Profil (TeamerProfilePage.tsx:100).

**Admin/Leitung (17 Seiten):** 15 Listen-Seiten gecacht (Konfis, Events inkl.
abgesagte, Aktivitäten, Anträge, Badges, Challenges, Kategorien, Jahrgänge,
Levels, Users, Material, Zertifikate, Organisationen, Invites, Profil —
AdminKonfisPage.tsx:90-104, AdminEventsPage.tsx:92-114 usw.). Nicht gecacht:
AdminMetricsPage (api.get /metrics, AdminMetricsPage.tsx:139 — online-only
vertretbar) und AdminSettingsPage (lädt nichts). **Aber die Detail-Ebene ist
offline leer:**

| Detail-View | Laden | offline |
|---|---|---|
| Konfi-Detail (admin/views/KonfiDetailView.tsx:213-269) | 5x api.get (Konfi, Anträge, Zertifikate, Event-Punkte, Anwesenheitsstatistik) | leer |
| Event-Detail inkl. Teilnehmerliste (admin/views/EventDetailView.tsx:222, 227) | api.get | leer |
| Antragsfoto (KonfiDetailView.tsx:424) | api.get blob | nicht sichtbar |

**Chat (alle Rollen):** Raumliste gecacht (ChatOverview.tsx:150, 2 Min),
je Raum die letzten 100 Nachrichten (ChatRoom.tsx:110-113, 1 Std), Raumdaten
(views/ChatRoomView.tsx:41). **Medien:** eigener Binär-Cache in
`Directory.Cache` (services/mediaCache.ts) — einmal betrachtete Bilder/Videos
sind offline da; nie geöffnete Anhänge nicht (kein Prefetch).

**App-Start offline:** funktioniert. Token+User liegen in Preferences
(services/tokenStore.ts:40-45), `refreshUser()` behält bei Fehler den
gecachten User (contexts/AppContext.tsx:246-249, "kein Hard-Fail").

**Wiederverbinden (`sync:reconnect`):** Socket-Reconnect fährt eine
koordinierte Sequenz: writeQueue.flush() -> offlineCache.invalidateAll() ->
Event `sync:reconnect` -> Chat-Callbacks (services/websocket.ts:54-72).
Sichtbare Views revalidieren über den window-Listener
(useOfflineQuery.ts:256-264); zusätzlich flusht die Queue bei jedem
Online-Wechsel (writeQueue.ts:559-563).

---

## 2. Bestandsaufnahme SCHREIBEN

Muster überall gleich: online -> direkter API-Call; offline -> `writeQueue.enqueue`
mit Toast "wird gesendet sobald du wieder online bist". Flush bei Online-Wechsel
und Reconnect; 4xx wirft raus, 5xx/Netzfehler bis maxRetries (writeQueue.ts:400-428).

**Landet in der Warteschlange (geht offline):**

| Aktion | Beleg |
|---|---|
| Chat: Nachricht inkl. Bild/Video (Datei lokal in Filesystem) | chatOutbox.ts:120-156 |
| Chat: Umfrage-Stimme, Reaktion (optimistic UI) | ChatRoom.tsx:917, 1003 |
| Chat: mark-read | contexts/BadgeContext.tsx:137 |
| Konfi: Aktivität melden inkl. Foto | konfi/modals/ActivityRequestModal.tsx:247 |
| Konfi: Event-Abmeldung (opt-out) | konfi/views/EventDetailView.tsx:128 |
| Konfi: Badges als gesehen markieren | KonfiBadgesPage.tsx:97 |
| Teamer: Aktivität melden; Event buchen/stornieren | TeamerActivityRequestModal.tsx:250; TeamerEventsPage.tsx:508, 538 |
| Admin: Antrag genehmigen/ablehnen | admin/modals/ActivityRequestModal.tsx:168 |
| Admin: Event/Serie anlegen+bearbeiten, Aktivität verbuchen, Bonuspunkte, Badge/Level/Kategorie/Jahrgang/Material/Zertifikat-CRUD, Dashboard-Settings, Rollentitel | EventModal.tsx:284-290, ActivityManagementModal.tsx:222/232, BonusModal.tsx:77, BadgeManagementModal.tsx:328/338, LevelManagementModal.tsx:130/140, AdminCategoriesPage.tsx:133, AdminJahrgaengeePage.tsx:175, MaterialFormModal.tsx:289, AdminCertificatesPage.tsx:232, AdminDashboardSettingsPage.tsx:114-195, ChangeRoleTitleModal.tsx:58 |

**Scheitert offline (kein Queue-Weg):**

| Aktion | Verhalten offline | Beleg |
|---|---|---|
| Konfi: Event-**Anmeldung** (register) | Fehlermeldung | konfi/views/EventDetailView.tsx:290 |
| Konfi: opt-in, unregister | Fehlermeldung | :148, :164 |
| QR-Check-in | Banner "Du bist offline" | QRScannerModal.tsx:68 |
| Challenge einreichen | "Einreichen nicht möglich — du bist offline" | ChallengeSubmitModal.tsx:358 |
| **Admin: Anwesenheit erfassen (einzeln + "Alle bestätigen")** | **stilles `if (!isOnline) return;` — keinerlei Rückmeldung** | admin/views/EventDetailView.tsx:314, 332, 373 |
| Antrag löschen (Konfi/Teamer) | Fehlermeldung | KonfiEventsPage.tsx:264, TeamerEventsPage.tsx (requests-delete) |
| Bibelübersetzung wechseln | Fehlermeldung | konfi/views/DashboardView.tsx:226 |
| Admin-Detail-Aktionen (Aktivität/Bonus löschen, Passwort neu, promote, Event absagen/löschen, Antrag reset) | Fehlermeldung | KonfiDetailView.tsx, AdminEventsPage.tsx |

**Prüfung gegen den Chat-Fix `5932c9a2` (vier Verlustwege):** Der Chat hat
heute (a) Rekonstruktion wartender Queue-Items als Bubbles
(chatOutbox.ts:70-80), (b) einen persistenten Fehl-Merker mit Retry-Knopf
(writeQueue.ts:74-122), (c) denselben Queue-Weg auch für Online-Fehlschläge,
(d) Live-Melder bei endgültigem Scheitern (writeQueue.ts:42-54).
**Alle anderen Queue-Typen haben diese Absicherungen NICHT:**
- Wartende Items sind unsichtbar: eine offline gemeldete Aktivität erscheint
  NICHT in der Antragsliste (kein Merge von Queue-Items, KonfiEventsPage lädt
  nur den Server-/Cache-Stand).
- Endgültiger Fehlschlag ist nur ein 4-Sekunden-Toast (writeQueue.ts:189-219);
  läuft der Flush bei geschlossener bzw. neu gestarteter App, ist z.B. eine
  gemeldete Aktivität oder eine Event-Abmeldung **spurlos weg** —
  `rememberFailedChat` greift ausdrücklich nur bei `type === 'chat'`
  (writeQueue.ts:106).
- Online-Fehlschlag landet nicht in der Queue (nur der Chat hat diesen Weg).

Positiv: Verlustwege der Queue selbst sind sauber — Offline-Flush verbrennt
kein Retry-Budget (writeQueue.ts:339-343), clear() bei Org-Wechsel/Logout
räumt auch lokale Dateien ab (writeQueue.ts:535-555), Generation-Zähler
verhindert Wiederauferstehung geleerter Items (:63-66).

---

## 3. Die Lücke aus Nutzersicht (nach Alltagsrelevanz)

1. **Leitung/Teamer bei Freizeit oder im Gemeindehaus-Keller: Anwesenheit
   erfassen geht nicht — und sagt es nicht einmal.** Teilnehmerliste im
   Event-Detail lädt offline gar nicht (admin/views/EventDetailView.tsx:222),
   und selbst mit geladener Seite verpufft der Tipp auf einen Namen stumm
   (:314). Das ist der stärkste "überraschend wenig"-Moment.
2. **Konfi will unterwegs eine Aktivität melden:** Der Versand wäre
   offline-fähig (Queue inkl. Foto!), aber die Aktivitätenliste im Modal lädt
   per api.get (konfi/modals/ActivityRequestModal.tsx:92) — offline ist die
   Auswahl leer, das Formular nutzlos. Die vorhandene Queue-Fähigkeit läuft
   ins Leere.
3. **Tageslosung fehlt dem Konfi offline** — obwohl es die TAGESLOSUNG-TTL
   (24 Std) gibt und der Teamer sie nutzt (TeamerDashboardPage.tsx:307). Der
   Konfi lädt sie ungecacht (DashboardView.tsx:206). Morgens im Bus ohne Netz:
   Teamer sieht die Losung, Konfi nicht.
4. **Termine ansehen: geht gut** (Liste, Datum, Ort, Status aus Cache) — aber
   Zeitfenster und "wer kommt noch" fehlen im Detail (EventDetailView.tsx:231, 243).
5. **Chat: geht durchweg gut.** Lesen (100 Nachrichten/Raum), Schreiben,
   Bilder senden, Abstimmen, Reagieren — alles offline. Nur nie geöffnete
   Anhänge fehlen.
6. **Challenge einreichen auf der Freizeit ohne Netz:** klare Absage
   (ChallengeSubmitModal.tsx:358) — verständlich gemeldet, aber inhaltlich
   genau das Szenario, in dem Konfis Beiträge produzieren.
7. **QR-Check-in:** offline blockiert mit Meldung — konzeptbedingt in Ordnung
   (Token-Prüfung ist serverseitig, Präsenznachweis in Echtzeit).
8. Kein globaler Offline-Hinweis: nur einzelne Views nutzen `isOffline`/`isStale`
   (z.B. ChatRoomView.tsx:70); meist sieht die Nutzerin alte Daten ohne
   Kennzeichnung und Aktionen, die kommentarlos nichts tun.

---

## 4. Vorschläge (priorisiert, mit Aufwand/Risiko)

### Vor Release 2.0.0 (klein, hoher Nutzen)

1. **Aktivitätenliste in beiden Melde-Modals auf useOfflineQuery umstellen**
   (STAMMDATEN, 1 Std) — konfi/modals/ActivityRequestModal.tsx:92 und
   TeamerActivityRequestModal. Aufwand: klein (Muster existiert 40-fach).
   Risiko: gering — Stammdaten ändern sich selten; der Server validiert die
   activity_id ohnehin beim Nachversand.
2. **Tageslosung für Konfi cachen** — DashboardView.tsx:206 auf das
   Teamer-Muster (TAGESLOSUNG, 24 Std) heben. Aufwand: klein. Risiko: keins.
   Achtung Doppelstelle laut CLAUDE.md: DashboardView UND KonfiDashboardPage
   prüfen (der Kommentar KonfiDashboardPage.tsx:160 erklärt die bewusste
   Arbeitsteilung — die Umstellung gehört in die View).
3. **Stilles Scheitern der Anwesenheit beheben:** aus `if (!isOnline) return;`
   (admin/views/EventDetailView.tsx:314, 332, 345, 373, 442) mindestens eine
   Meldung machen ("Anwesenheit braucht eine Verbindung"). Aufwand: minimal.
4. **Endgültige Queue-Fehlschläge persistent machen** — den Chat-Fehl-Merker
   auf `request` und `opt-out` ausweiten (Punkte und Teilnahme betroffen;
   heute spurlos verlierbar, writeQueue.ts:106, 189-219). Aufwand: mittel.
   Risiko: gering; das Muster ist erprobt.

### Nach 2.0.0

5. **Anwesenheit offline erfassen (Queue):** PUT attendance ist fachlich
   last-write-wins und damit queue-tauglich; Voraussetzung ist das Cachen des
   Event-Details samt Teilnehmerliste. Kehrseite ehrlich: eine veraltete
   Teilnehmerliste kann Nachrücker übersehen, und zwei Geräte können sich
   überschreiben — braucht sichtbare Stale-Kennzeichnung und die Entscheidung,
   dass der spätere Schreiber gewinnt. Aufwand: mittel.
6. **Admin-Detail-Views lesend cachen** (Konfi-Detail, Event-Detail) —
   isStale-Anzeige verpflichtend, sonst entsteht ein falsches Lagebild
   ("der ist doch angemeldet"). Aufwand: mittel.
7. **Challenge-Einreichung in die Queue** — das Datei-lokal-Muster existiert
   (Chat, Antragsfoto). Kehrseite: Einreichefrist kann beim Nachversand
   abgelaufen sein -> braucht die persistente Fehlschlag-Anzeige aus Punkt 4.
   Aufwand: mittel.
8. **Zeitfenster/Teilnehmer im Konfi-Event-Detail cachen** (nur Anzeige; die
   Anmeldung bleibt bewusst online-pflichtig, die Sperre bei ungeladenen
   Zeitfenstern EventDetailView.tsx:102-105 bleibt).
9. **Globaler Offline-/Stale-Hinweis** (Chip im Header oder Banner) — der Hook
   liefert `isOffline`/`isStale` bereits, kaum eine Seite zeigt es.

### Gar nicht

- **QR-Check-in offline:** Präsenznachweis in Echtzeit; ein nachlaufender
  Check-in wäre wertlos bis manipulierbar.
- **Konfi-Event-Anmeldung offline queuen:** Kapazität, Warteliste und
  Zeitfenster entscheiden sich am Server; ein Stunden später nachlaufendes
  "du bist angemeldet" wäre irreführend. Die heutige klare Fehlermeldung ist
  ehrlicher. Anmerkung: Die Teamer-Buchung IST gequeued
  (TeamerEventsPage.tsx:508) und hat dasselbe Konfliktpotenzial — eher dort
  überdenken als beim Konfi nachziehen.
- **Metrics offline:** Monitoring ohne Verbindung ist sinnfrei.

---

## 5. Messen statt schätzen

**Payload-Größen** (25.08.2026 gegen Produktion, Demo-Org 4, unkomprimiertes
JSON = so liegt es in Preferences):

| Endpoint (Konfi) | Bytes | | Endpoint (Admin) | Bytes |
|---|---|---|---|---|
| /konfi/dashboard | 3 245 | | /events | 20 843 |
| /konfi/profile | 735 | | /admin/konfis | 3 025 |
| /konfi/events | 7 914 | | /admin/activities/requests | 5 701 |
| /konfi/badges | 13 356 | | /users | 2 522 |
| /chat/rooms | 532 | | /admin/activities | 2 106 |
| /chat/.../messages?limit=100 | 13 795 | | /jahrgaenge + /badges | ~300 |
| /challenges/konfi | 1 254 | | | |
| /konfi/requests | 423 | | | |

Summe Konfi ~41 KB (inkl. eines Chat-Raums), Admin ~55 KB. Die Demo-Org ist
klein; eine echte Gemeinde mit 40 Konfis, 30 Events und 5 Chat-Räumen liegt
hochgerechnet bei grob 150-400 KB — weit unter jeder Grenze.

**Grenzen des Speichers:** Capacitor Preferences = UserDefaults (iOS) bzw.
SharedPreferences (Android): kein hartes Limit, aber der gesamte Bestand wird
ins RAM geladen — bei den gemessenen Größen unkritisch. Web-Fallback ist
localStorage mit ~5 MB Quota; erst dort könnte `Preferences.set` werfen.

**Was passiert beim Volllaufen:** Es gibt keine Eviction und kein Größenlimit
im Code — offlineCache kennt nur clearAll/invalidateAll (offlineCache.ts:57-79);
abgelaufene Einträge werden nie gelöscht, nur bei erneutem Abruf überschrieben.
Verwaiste Keys (z.B. verlassene Chat-Räume) bleiben bis Logout/Org-Wechsel
liegen (AppContext.tsx:290, 352, 441). Randfall mit Fehlerpotenzial (nur Web
relevant): `offlineCache.set` läuft INNERHALB des Fetch-try VOR `setData`
(useOfflineQuery.ts:104-107) — wirft der Schreibvorgang (Quota), wird ein
ERFOLGREICHER Fetch als Fehler behandelt und die frischen Daten erscheinen
nicht. Unsicher, ob je aufgetreten; auf nativ praktisch ausgeschlossen.

**Medien-Cache:** unbegrenzt in `Directory.Cache` (mediaCache.ts), das OS darf
dort selbst räumen; Größenanzeige + "Cache leeren" gibt es in allen drei
Profil-Seiten (ProfileView.tsx:214, TeamerProfilePage.tsx:96,
AdminProfilePage.tsx:48).
