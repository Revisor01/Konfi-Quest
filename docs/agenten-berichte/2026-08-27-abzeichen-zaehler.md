# Abzeichen-Zähler: Bestandsaufnahme und Konsolidierungsentwurf

Auftrag: Alle Zähler/Badges der App kartieren (Tab-Leiste, BadgeContext,
LiveUpdate, App-Icon), weitere Stellen mit der in BAUSTELLEN.md
dokumentierten Zwei-Mechanismen-Falle finden, und einen konkreten Umbau
entwerfen, der den Abzeichen-Zähler in `GET /notifications/badge-counts`
konsolidiert — oder begründen, warum die Dokumentation der Falle reicht.

Stand: 27.08.2026, Code-Stand `fef2c02` (Branch `fix/h1-abzeichen-zaehler-teamer`).

**Urteil in einem Satz:** Die Falle ist nicht nur eine Falle, sie hat auf der
Konfi-Seite längst zugeschnappt (der Abzeichen-Zähler am Konfi-Reiter setzt
sich seit dem 03.07.2026 in laufender Sitzung nie zurück), und der in
BAUSTELLEN.md vermutete Kostenhaken der Konsolidierung existiert nicht —
der Zähler braucht keine Fortschrittsberechnung, sondern eine einzige
COUNT-Query, die für Konfis UND Teamer:innen identisch ist; der Umbau lohnt
sich und ist klein.

Alle Laufzeiten in diesem Bericht sind am 27.08.2026 gegen Produktion
gemessen (Demo-Gemeinde Org 4, je 3 Messungen per curl), nicht geschätzt.

---

## Teil 1: Bestandsaufnahme

### 1.1 Die fünf Zahlen an den Reitern (MainTabs.tsx)

| Zähler | Quelle | Aktualisiert durch | Anzeige |
|---|---|---|---|
| `chatUnreadTotal` | `useBadge()` ← `GET /notifications/badge-counts` | `refreshAllCounts()` | Chat-Tab aller drei Rollen (`MainTabs.tsx:293, 358, 424`) |
| `pendingRequestsCount` | `useBadge()` ← dito | `refreshAllCounts()` | nur Admin, Mitmachen-Tab, addiert mit pendingEvents (`MainTabs.tsx:302`) |
| `pendingEventsCount` | `useBadge()` ← dito | `refreshAllCounts()` | nur Admin, Mitmachen-Tab (`MainTabs.tsx:302`) |
| `pendingChallengesCount` | `useBadge()` ← dito | `refreshAllCounts()` | Admin (`:311`) und Teamer (`:371`), Challenges-Tab |
| `newBadgesCount` | eigener State in MainTabs (`:118`), lädt selbst (`:198-212`) | NUR `useLiveRefresh('badges')` (`:218`) | Teamer (`:380`) und Konfi (`:441`), Badges-Tab |

Der `newBadgesCount`-Loader (`MainTabs.tsx:198-212`) fragt je Rolle einen
anderen Endpunkt:

- Konfi: `GET /konfi/badges` (volle Liste, `konfi.js:1023` →
  `utils/konfiBadgeProgress.js`), zählt clientseitig `earned.filter(!seen)`.
- Teamer: `GET /teamer/badges/unseen` (`teamer.js:526`), liefert nur die Zahl.
- Admin (`org_admin`): keiner der beiden Zweige greift — korrekt, denn
  Admins können keine Abzeichen verdienen: `checkAndAwardBadges` verzweigt
  nur für `role_name === 'teamer'` in den Teamer-Pfad (`badges.js:111-119`),
  und der Konfi-Pfad bricht ohne `konfi_profiles`-Zeile ab (`badges.js:131`).

### 1.2 Der Server-Endpunkt GET /notifications/badge-counts

`backend/routes/notifications.js:33-146`. Vier parallele Queries
(`Promise.all`, Zeile 133): Chat-Unread je Raum (`:40-61`), pending
Aktivitäts-Anträge (nur Admin, `:104-111`), unverarbeitete vergangene
Events (nur Admin, `:113-126`), offene Challenge-Freigaben (Admin org-weit,
Teamer auf zugewiesene Jahrgänge gefiltert, `:76-99`). Ein Abzeichen-Feld
gibt es NICHT.

Gemessen: 101-112 ms Gesamtlaufzeit inkl. Netz. Zum Vergleich: ein 403 auf
einen fremden Endpunkt dauert von hier ebenfalls ~100 ms — die
Serverrechenzeit ist im niedrigen einstelligen Millisekundenbereich.

### 1.3 Aktualisierungswege des BadgeContext (contexts/BadgeContext.tsx)

`refreshAllCounts()` (`:76-117`) wird ausgelöst durch:

1. initialen Load (`:214-217`),
2. WebSocket `newMessage` (`:166-183`),
3. LiveUpdate-Typen `['requests', 'events', 'challenges']`
   (`BADGE_LIVE_TYPES`, `:14`, abonniert `:187`) — **'badges' fehlt bewusst**,
4. `sync:reconnect` und `push:received` (`:200-201`),
5. manuelle Aufrufe aus Komponenten.

Manuelle Aufrufer (vollständig, per grep): `ChatRoom.tsx:780`,
`ChatOverview.tsx` (Effekt-Kette), `SimpleCreateChatModal.tsx:285/325`
(als `refreshFromAPI`), `AdminChallengesPage.tsx:94`,
`TeamerChallengesPage.tsx:92`. Alle fünf betreffen Chat oder Challenges —
**kein einziger läuft ins Leere**. Die dokumentierte Falle (jemand ruft
`refreshAllCounts()` für den Abzeichen-Zähler) ist im Code aktuell nirgends
begangen.

### 1.4 Der zweite Mechanismus: useLiveRefresh('badges')

Das Server-Event `badges` senden: `badges.js:652` (Abzeichen vergeben, an
den Empfänger selbst), `badges.js:805-873` (Abzeichen-Verwaltung
anlegen/ändern/löschen, an Org), `teamer.js:802` (Leitung ändert
Teamer-Daten). **Nicht** gesendet wird es bei mark-seen — weder
`konfi.js:1071` (POST) noch `teamer.js:544` (PUT) feuern ein LiveUpdate.

Frontend-Abonnenten von `'badges'` (vollständig): `MainTabs.tsx:218`
(der Reiter-Zähler), `KonfiBadgesPage.tsx:77`, `KonfiDashboardPage.tsx:270`,
`KonfiProfilePage.tsx:90`, `TeamerBadgesPage.tsx:65`,
`TeamerDashboardPage.tsx:294`, `TeamerProfilePage.tsx:108`,
`TeamerKonfiStatsPage.tsx:230`, `AdminBadgesPage.tsx:109`,
`KonfiDetailView.tsx:221`. Bis auf MainTabs laden alle LISTEN neu, keine
Zähler — sie sind vom Umbau nicht betroffen.

### 1.5 Drei Ansichten: Wer sieht welchen Zähler, und fehlt einer?

| Zähler | Admin | Teamer | Konfi |
|---|---|---|---|
| Chat ungelesen | ja | ja | ja |
| Anträge + Events pending | ja (Mitmachen) | — | — |
| Challenge-Freigaben | ja | ja (jahrgangsgefiltert) | — |
| Neue Abzeichen | — (verdient keine) | ja (seit H1-Fix) | ja |

Bewusst fehlende Zähler, geprüft: Teamer-Mitmachen hat keinen Zähler, weil
`GET /teamer/requests` (`teamer.js:1258`) nur die EIGENEN Anträge der
Teamer:in liefert (kein Moderationsstapel) — Konfis haben für ihre eigenen
Anträge ebenfalls keinen Zähler, das ist konsistent. Admin ohne
Abzeichen-Zähler ist korrekt (1.1). **Nicht geprüft:** ob Teamer:innen mit
Bearbeitungsrechten Anwesenheiten verarbeiten können und dann der
`pendingEvents`-Zähler auch ihnen zustünde — das gehört zur offenen
Rechtefrage aus dem Bericht vom 26.08. (Rollen-Berechtigungen).

Ausserhalb der Tab-Leiste zeigen Zähler an: `ChatOverview` (unread je Raum,
aus `chatUnreadByRoom` — gleicher Mechanismus, unkritisch) und das
App-Icon (1.6). `IonBadge` kommt in `components/` nur in MainTabs vor.

### 1.6 Das App-Icon (natives Badge, @capawesome/capacitor-badge)

Das Icon hat VIER Schreiber mit DREI verschiedenen Semantiken:

1. **Client:** `Badge.set({ count: totalBadgeCount })`
   (`BadgeContext.tsx:155-163`). `totalBadgeCount` (`:61-69`) = Admin:
   chat+requests+events+challenges; Teamer: chat+challenges; Konfi: nur
   chat. **`newBadgesCount` ist NIE enthalten** — es lebt im anderen
   Mechanismus.
2. **Chat-Push:** `aps.badge` = exakte Chat-Unread-Zahl des Empfängers
   (`chat.js:1088-1105` und `:1900-1905`).
3. **Alle anderen Pushes** (auch "Neues Badge erhalten!"): `badge:
   notification.badge || 1` (`pushService.js:135`, `:265`) — das Icon
   springt hart auf 1, egal was anliegt.
4. **Hintergrund-Sync alle 5 Minuten** (`backgroundService.js:53-59`):
   Silent-Push mit **nur der Chat-Unread-Zahl** (`:162-184`,
   `firebase.js:88-109`) — überschreibt die reichere Client-Zahl aus (1).

Antwort auf die Auftragsfrage: **Nein, das App-Icon stimmt nicht mit der
Summe der Reiter-Zähler überein.** Für Konfi/Teamer fehlen die ungesehenen
Abzeichen immer; für Admins passt die Client-Zahl, wird aber vom
5-Minuten-Sync auf chat-only zurückgesetzt, sobald sich die Chat-Zahl
ändert. Beispiel: Admin mit 0 ungelesenen Chats und 3 offenen Freigaben —
die App setzt 3, der nächste abweichende Sync setzt 0.

---

## Teil 2: Befunde nach Schwere

### B1 (MITTEL): Der Konfi-Abzeichen-Zähler setzt sich in laufender Sitzung nie zurück — die Falle ist auf der Konfi-Seite bereits zugeschnappt

`KonfiBadgesPage.tsx:80-110` markiert die Abzeichen beim Öffnen als gesehen
(POST `/konfi/badges/mark-seen`), stößt danach aber **nichts** an —
`triggerRefresh` kommt in der Datei nicht vor (grep: 0 Treffer). Der
Reiter-Zähler in MainTabs lädt nur beim Mount und über
`useLiveRefresh('badges')` (`MainTabs.tsx:214-218`); mark-seen sendet
serverseitig kein `badges`-Event (1.4), und MainTabs hat keinen
Reconnect-/Push-Listener (grep: kein `addEventListener` in der Datei).
Folge: Konfi öffnet den Badges-Tab, der Server setzt `seen`, die rote Zahl
am Reiter bleibt stehen — bis zum App-Neustart oder bis das nächste
Abzeichen vergeben wird.

Kaputt seit Commit `33e3364` (03.07.2026, "Konfi-Badge-Zaehler per
LiveUpdate statt 60s-Polling"): das entfernte Polling hatte den Reset
bis dahin nebenbei erledigt. Der neue Teamer-Weg aus H1 macht es richtig
(`TeamerBadgesPage.tsx:98` ruft `triggerRefresh('badges')`) — die alte
Konfi-Seite wurde dabei nicht nachgezogen. Das ist exakt der Stolperstein
"drei Ansichten, ein Fix ist selten der ganze Fix".

Dass es kaum auffällt, liegt an iOS: Die App wird oft beendet, beim
Kaltstart lädt der Zähler frisch und korrekt.

### B2 (MITTEL): Das App-Icon hat vier Schreiber mit drei Semantiken

Siehe 1.6. Zwei getrennte Teilprobleme:

- **B2a:** `totalBadgeCount` enthält `newBadgesCount` nicht
  (`BadgeContext.tsx:61-69`) — strukturell dieselbe Ursache wie die
  Reiter-Falle und durch die Konsolidierung (Teil 3) miterledigt.
- **B2b:** Der 5-Minuten-Hintergrund-Sync sendet nur Chat-Unread
  (`backgroundService.js:162-184`) und Nicht-Chat-Pushes setzen hart 1
  (`pushService.js:135`). Das ist eine EIGENE Baustelle serverseitiger
  Zähler-Semantik und gehört NICHT in diesen Umbau — aber in BAUSTELLEN.md.

### B3 (KLEIN): Irreführender Kommentar in MainTabs

`MainTabs.tsx:186-188` behauptet: "Bei Verbindungsabriss/Push feuert
zusaetzlich der initiale Load beim Reconnect." Das stimmt nicht — die
Reconnect-/Push-Listener sitzen im BadgeContext (`:200-201`) und rufen
`refreshAllCounts()`, das den Abzeichen-Zähler gerade nicht erreicht. Der
Kommentar suggeriert eine Selbstheilung, die es nicht gibt, und verdeckt B1.

### B4 (KLEIN): Zeilennummern in Kommentaren driften bereits

`TeamerBadgesPage.tsx:78` verweist auf "MainTabs.tsx:204"; die Stelle liegt
auf diesem Stand bei Zeile 218. Kein Fehler im Verhalten, aber ein Zeichen,
dass die verteilte Dokumentation der Falle schon nach einem Tag altert —
ein Argument mehr für Konsolidierung statt Doku.

### Ausdrücklich geprüft und in Ordnung

- Keine ins Leere laufenden `refreshAllCounts()`-Aufrufe (1.3).
- Kein dritter Aktualisierungsweg für Reiter-Zähler neben BadgeContext und
  `useLiveRefresh('badges')`.
- Die vier BadgeContext-Zähler verhalten sich in allen drei Rollen gleich;
  das Backend filtert Teamer-Challenges korrekt auf zugewiesene Jahrgänge
  (`notifications.js:76-99`).

---

## Teil 3: Konsolidierungsentwurf

### Die Kern-Erkenntnis: Der vermutete Haken existiert nicht

BAUSTELLEN.md warnt, der Konfi-Weg brauche "die volle Abzeichenliste
(Fortschritt)". Das gilt für die BadgesPAGE — nicht für den ZÄHLER. Die
`seen`-Markierung liegt für beide Rollen in derselben Tabelle
(`user_badges.seen`), und der Zähler ist für beide dieselbe Abfrage:

```sql
SELECT COUNT(*)::int AS c
FROM user_badges ub
JOIN custom_badges cb ON ub.badge_id = cb.id
WHERE ub.user_id = $1 AND ub.organization_id = $2
  AND ub.seen = false
  AND cb.target_role = $3   -- 'konfi' bzw. 'teamer' je nach req.user
```

Der JOIN mit `target_role` repliziert exakt die Zählung, die der Konfi
heute clientseitig macht (`earned.filter(!seen)` über die
target_role-gefilterte Liste aus `konfiBadgeProgress.js:27-43`). Der
heutige Teamer-Endpunkt zählt ohne JOIN (`teamer.js:531-534`) — die neue
Query behebt diese kleine Divergenz gleich mit.

### Kosten, gemessen statt geglaubt

| Endpunkt | Queries | Laufzeit (Prod, Demo-Org, 3 Messungen) |
|---|---|---|
| `GET /notifications/badge-counts` | 4 parallel | 101-112 ms |
| `GET /konfi/badges` (volle Liste + Fortschritt) | 11 parallel (`konfiBadgeProgress.js:53-65`) | 121-143 ms |
| `GET /teamer/badges` (Liste + Fortschritt) | 10 (`teamer.js:287-360`) | 108-130 ms |
| `GET /teamer/badges/unseen` (1 COUNT) | 1 | 103-149 ms |

~100 ms davon sind Netz (ein 403 dauert genauso lang). Die "teure"
Fortschrittsberechnung kostet in der kleinen Demo-Org also real ~25-35 ms
Serverzeit — teuer ist sie relativ (11 Queries, skaliert mit Datenmenge),
und genau deshalb ist die richtige Antwort, sie für den Zähler GAR NICHT zu
brauchen. Die fünfte COUNT-Query läuft im bestehenden `Promise.all`
parallel mit und nutzt `idx_user_badges_user_org` (Migration 064) —
messbarer Aufpreis für badge-counts: praktisch null.

### Der Umbau, Schritt für Schritt

**Backend (1 Datei + Tests + Doku):**

1. `backend/routes/notifications.js`: fünfte Query (oben) für
   `userType === 'konfi' || userType === 'teamer'`, sonst `zero`;
   Response-Feld `newBadges` (additiv — alte Clients ignorieren es).
2. `GET /teamer/badges/unseen` (`teamer.js:526`) bleibt bestehen
   (ausgelieferte App-Versionen rufen ihn), wird in der OpenAPI-Doku
   (`docs/api/chat-challenges.yaml`, wo badge-counts dokumentiert ist,
   bzw. die Teamer-Datei für unseen) als deprecated mit Datum markiert.
3. Die mark-seen-Endpunkte (`konfi.js:1071`, `teamer.js:544`) bleiben
   unverändert.

**Frontend (4 Dateien + Tests):**

4. `contexts/BadgeContext.tsx`: State `newBadgesCount`, gesetzt aus
   `data.newBadges` in `refreshAllCounts()` (Fallback 0); `'badges'` in
   `BADGE_LIVE_TYPES` aufnehmen (`:14`); im Context-Value exportieren;
   Reset bei Logout (`:220-228`); **Entscheidung nötig:** `newBadgesCount`
   für Konfi/Teamer in `totalBadgeCount` aufnehmen (`:61-69`) — dann zeigt
   das App-Icon die Summe der Reiter (behebt B2a). Ich empfehle ja.
5. `components/layout/MainTabs.tsx`: eigener State (`:118`), Loader
   (`:198-212`), Mount-Effekt (`:214-216`), `useLiveRefresh('badges')`
   (`:218`) und der api-Import entfallen; `newBadgesCount` kommt aus
   `useBadge()`. Der Warnkommentar (`:101-114`) schrumpft auf einen Satz:
   ein Mechanismus, eine Quelle.
6. `components/konfi/pages/KonfiBadgesPage.tsx`: nach erfolgreichem
   mark-seen-POST `refreshAllCounts()` rufen (behebt B1). Offline-Zweig
   (writeQueue): unverändert lassen — der Zähler bleibt dann wie heute bis
   zum Flush stehen; wer mehr will, setzt zusätzlich optimistisch auf 0.
7. `components/teamer/pages/TeamerBadgesPage.tsx`:
   `triggerRefresh('badges')` (`:98`) durch `refreshAllCounts()` ersetzen
   und den Kommentar (`:77-81`) anpassen. (Es funktionierte nach Schritt 4
   auch weiter — `'badges'` erreicht dann den BadgeContext — aber der
   direkte Aufruf ist die Geste, die der Rest der App benutzt.)

**Nicht anfassen:** Alle anderen `useLiveRefresh('badges')`-Abonnenten
(1.4) — sie laden Listen. Der LiveUpdate-Kanal `'badges'` bleibt bestehen;
nur der Reiter-Zähler wechselt die Quelle. `triggerRefresh` bleibt als
API erhalten.

**Doku im selben Commit:** BAUSTELLEN.md-Abschnitt "Falle: Die
Reiter-Zähler" auf erledigt setzen (mit Verweis hierher), CHANGELOG
("Behoben: Der Zähler für neue Abzeichen verschwindet jetzt zuverlässig
nach dem Ansehen"), OpenAPI wie in Schritt 2.

### Weg dahin ohne Bruch

Ein einziger PR. Backend-Feld ist additiv (alte Apps ignorieren es), und
Web-Frontend und Backend deployen bei Merge auf main zusammen — es gibt
keinen Zwischenzustand, in dem der neue Client gegen den alten Server läuft
(der läse `undefined` → 0 und zeigte schlicht keinen Zähler, kein Crash).
Native Builds folgen ohnehin erst nach dem Server-Deploy
(TestFlight-Regel: nur auf Zuruf). Einzige Reihenfolge-Regel: keinen
Store-Build vor dem Server-Deploy dispatchen — die ergibt sich beim
normalen Ablauf von selbst.

### Tests (konkrete Werte, verbotener UND erlaubter Fall)

Backend (`tests/routes/notifications.test.js`, bestehende
badge-counts-Suite ab `:275` erweitern):

1. Konfi mit 2 ungesehenen + 1 gesehenem Abzeichen → `newBadges === 2`.
2. Nach `POST /konfi/badges/mark-seen` → `newBadges === 0`.
3. Teamer mit 1 ungesehenen Teamer-Abzeichen → `newBadges === 1`.
4. Rollengrenze (verbotener Fall): ein ungesehenes Abzeichen mit
   `target_role = 'teamer'` zählt beim Konfi NICHT mit → `newBadges === 0`;
   Admin-Token → `newBadges === 0`.
5. Org-Grenze: ungesehenes Abzeichen in Org B zählt für Nutzer in Org A
   nicht → `newBadges === 0`.

Frontend:

6. `BadgeContext.test.tsx`: Response mit `newBadges: 2` und
   `chat.total: 3` → `newBadgesCount === 2`; für Konfi
   `totalBadgeCount === 5` (falls Schritt-4-Entscheidung ja), für Admin
   unverändert ohne newBadges.
7. `BadgeContext.test.tsx`: ein `'badges'`-LiveUpdate löst genau einen
   weiteren `GET /notifications/badge-counts` aus (Aufrufzähler exakt
   prüfen, nicht `toHaveBeenCalled`).
8. `abzeichenZaehlerTeamer.test.ts` umschreiben: MainTabs enthält KEIN
   `api.get` mehr; `newBadgesCount` kommt aus `useBadge()`;
   TeamerBadgesPage ruft `refreshAllCounts` nach mark-seen. Die
   bestehenden Assertions auf `api.get('/teamer/badges/unseen')` in
   MainTabs (`:30`) und `triggerRefresh('badges')` (`:59`) werden dabei
   FALSCH und müssen mitgezogen werden — sie prüfen die alte Verdrahtung.
9. Regressionstest für B1: KonfiBadgesPage ruft nach erfolgreichem
   mark-seen `refreshAllCounts` (verhindert, dass der Konfi-Reset wieder
   vergessen wird).

### Lohnt sich der Umbau? Ja.

1. **Die Doku hat den Fehler nicht verhindert** — B1 besteht seit dem
   03.07.2026, die Falle wurde erst am 27.08. überhaupt bemerkt, und der
   H1-Fix hat sie für Teamer:innen richtig umschifft, für Konfis aber
   liegen lassen. Beschriebene Fallen altern (B4); gelöschte Fallen nicht.
2. **Der Kostengrund ist widerlegt** — eine COUNT-Query statt der
   Fortschrittsberechnung, gemessen im Rauschen des bestehenden Endpunkts.
3. **Der Umbau löscht netto Code** — MainTabs verliert State, Loader und
   Spezialwissen; der intuitive Aufruf (`refreshAllCounts`) wird zum
   richtigen; zwei Frontend-Endpunkt-Aufrufe und eine Semantik-Divergenz
   (unseen ohne target_role-JOIN) verschwinden.
4. Nebeneffekt: B2a (App-Icon ohne Abzeichen) wird miterledigt, B1 gleich
   mit.

Umfang: 1 Backend-Datei, 4 Frontend-Dateien, 3 Testdateien, Doku. Das
einzige echte Risiko ist die bewusste Verhaltensänderung am App-Icon
(Schritt 4) — wer die nicht will, lässt `totalBadgeCount` unverändert und
der Rest des Umbaus trägt sich trotzdem. B2b (Hintergrund-Sync sendet nur
Chat-Unread, Pushes setzen hart 1) bleibt als eigener Punkt für
BAUSTELLEN.md — er ist serverseitig und von diesem Umbau unabhängig.
