# Drei-Ansichten-Lücken: systematischer Durchgang

Auftrag: Funktionen finden, die nur in einem oder zwei der drei
Rollen-Komponentenbäume (admin/, teamer/, konfi/) existieren, obwohl sie in
mehrere gehören — plus Divergenzen, bei denen dieselbe Funktion je Baum
unterschiedlich prüft oder rechnet. Backend eingeschlossen
(konfi.js vs. teamer.js vs. events.js/challenges.js).

Stand: 26.08.2026, Code-Stand `2a89dcb` (main).

**Urteil in einem Satz:** Die Fehlerklasse ist real und lebt fast
ausschließlich zulasten der Teamer-Ansicht — Challenges sind nach dem Umbau
vom 22.08. inzwischen sauber über geteilte Komponenten gelöst, aber bei
Terminen (Kapazität/Status), der Abzeichen-„gesehen"-Mechanik, dem
Teamer-Dashboard und der Tageslosung bestehen mindestens sechs Lücken und
Divergenzen mit direkter Nutzerwirkung.

Prüftiefe: Befunde mit **[V]** habe ich selbst am Code nachvollzogen
(Datei geöffnet, Stelle gelesen). Befunde mit **[A]** stammen aus den vier
thematischen Detailanalysen dieses Auftrags (Events, Challenges/Abzeichen,
Dashboard/Profil in Stichproben, Backend) mit genannter Fundstelle, die ich
nicht einzeln nachgeprüft habe. Unsicheres ist als unsicher markiert.

Alle Frontend-Pfade relativ zu `frontend/src/components/`, Backend relativ
zu `backend/`.

---

## Teil 1: Gegenüberstellung der drei Bäume nach Themen

Routing-Quelle: `layout/MainTabs.tsx` (Admin: Zeilen 207-253, Teamer:
302-325, Konfi: 361-379). Teamer haben KEIN eigenes views/-Verzeichnis —
ihre Seiten importieren Views und Modale aus admin/ und konfi/ quer
(z.B. `teamer/pages/TeamerChallengesPage.tsx:28-30` aus admin/,
`teamer/pages/TeamerBadgesPage.tsx:21` aus konfi/). Das ist Fluch und
Segen zugleich: geteilte Views verhindern Lücken (Challenges), kopierte
Seiten erzeugen sie (siehe Befund N7).

| Thema | admin (Leitung) | teamer | konfi | Einschätzung |
|---|---|---|---|---|
| Start/Dashboard | keines — landet auf `/admin/konfis` | `TeamerDashboardPage.tsx` | `KonfiDashboardPage.tsx` + `views/DashboardView.tsx` | legitim (Design), aber Teamer-Daten lückenhaft (H2) |
| Termine Liste | `EventsView.tsx` + `AdminEventsPage.tsx` | `TeamerEventsPage.tsx` (Monolith, ~1500 Z.) | `views/EventsView.tsx` + `KonfiEventsPage.tsx` | Teamer-Status/Warteliste lückenhaft (H3) |
| Termin-Detail | `views/EventDetailView.tsx` + `EventDetailSections.tsx` | inline in `TeamerEventsPage.tsx` | `views/EventDetailView.tsx` + `KonfiEventDetailPage.tsx` | Divergenzen (M-Reihe) |
| Termine verwalten | `EventModal`, `ParticipantManagementModal`, Absagen, Serien, Timeslots | — | — | legitim |
| Challenges Liste | `AdminChallengesPage.tsx` + `views/ChallengesManageView.tsx` | `TeamerChallengesPage.tsx` (nutzt admin-View) | `KonfiChallengesPage.tsx` + `views/ChallengesView.tsx` | in Ordnung, eine Divergenz (M3) |
| Challenge-Detail | `ChallengeLeitungModal.tsx` (Feed/Wartet/Abgelehnt/Meins) | dieselbe Datei | `ChallengeDetailModal.tsx` (Feed/Meins) | in Ordnung — Reiter-Umbau + Ablehnungsgrund ÜBERALL da |
| Abzeichen (eigene) | keine eigene Ansicht | `TeamerBadgesPage.tsx` (nutzt konfi-View) | `KonfiBadgesPage.tsx` + `views/BadgesView.tsx` | Teamer-„neu"-Mechanik tot (H1), org_admin-Lücke (N4) |
| Abzeichen verwalten | `BadgesView.tsx` + `BadgeManagementModal` | — | — | legitim |
| Punkte | vergibt (Aktivitäten/Bonus) | sieht eigene eingefrorene Konfi-Zeit (`TeamerKonfiStatsPage.tsx`) | `PointsHistoryModal`, Dashboard | legitim — Teamer haben keine Punkte |
| Anträge | moderiert (`ActivityRequestsView.tsx`) | stellt eigene für target_role=teamer (`TeamerActivityRequestModal`) | stellt eigene (`ActivityRequestModal`) | Notification-Divergenz (M6) |
| Profil | `AdminProfilePage.tsx` | `TeamerProfilePage.tsx` | `KonfiProfilePage.tsx` + `views/ProfileView.tsx` | Divergenzen (M4, M5, N6) |
| Material | `AdminMaterialPage.tsx` (CRUD) | `TeamerMaterialPage.tsx` + Detail (lesen) | — | legitim — `routes/material.js` ist durchgehend requireTeamer |
| Zertifikate | verwaltet (`AdminCertificatesPage.tsx`) | sieht eigene (Dashboard-Karte) | — | legitim — Zertifikate sind ein Teamer-Feature |
| Wrapped | gibt frei (`AdminJahrgaengeePage.tsx`) | sieht eigenes + eigenes Konfi-Wrapped | sieht eigenes | Freigabe-Gate-Lücke (M7), Admin-Ansicht fehlt (N5) |
| Chat | `chat/` rollenübergreifend | dito | dito | Ausnahme laut Auftrag, nicht untersucht |
| Statistiken | `AdminMetricsPage.tsx` (super_admin) | — | — | legitim |
| Tab-Zähler | Chat + Anträge + Verbuchen + Challenges | Chat + Challenges (mit Lücke H4) | Chat + neue Abzeichen | Teamer-Seite doppelt lückenhaft (H1, H4) |

Zum Vergleich der Vorfall vom 22.08. (Tageslosung): **inzwischen behoben** —
beide Bäume prüfen den Schalter (`konfi/views/DashboardView.tsx:306`,
`teamer/pages/TeamerDashboardPage.tsx:303`), beide cachen mit Tages-TTL. [V]

Das Punkteart-Thema (gottesdienst_enabled/gemeinde_enabled im Admin-Baum
nicht geprüft) ist der dritte bekannte Fall dieser Klasse und wird parallel
bearbeitet — hier bewusst nicht erneut analysiert.

---

## Teil 2: Befunde — echte Lücken und Divergenzen

### Schwere HOCH (direkte, wiederkehrende Nutzerwirkung)

**H1 — Teamer sehen neue Abzeichen nie als „neu"; die halbe Funktion ist tot.** [V]
Das Backend hat die komplette Infrastruktur für beide Rollen:
`GET /teamer/badges/unseen` (routes/teamer.js:526) und
`PUT /teamer/badges/mark-seen` (routes/teamer.js:544). Im Frontend ruft
NIEMAND eines von beiden auf (Grep über frontend/src: nur die
Konfi-Treffer). Der Konfi-Baum hat alles: Zähler am Badges-Tab
(`layout/MainTabs.tsx:405-412`), mark-seen beim Öffnen
(`konfi/pages/KonfiBadgesPage.tsx:99,105`). Der Zähler-Loader bricht für
alle anderen Rollen explizit ab (`layout/MainTabs.tsx:176`:
`if (user?.type !== 'konfi') return`), der Teamer-Badges-Tab hat kein
IonBadge (`layout/MainTabs.tsx:349-352`). Folge: `seen` bleibt für Teamer
dauerhaft false. Das ist Befund 10 aus dem Bericht
`2026-08-25-abzeichen-bedingungen.md` — weiterhin offen, hier als
Drei-Ansichten-Lücke eingeordnet: Backend für beide gebaut, Frontend nur
für eine Rolle.

**H2 — Teamer-Dashboard zeigt nur Termine, für die man schon gebucht ist — „Teamer gesucht" kommt nie an.** [V]
routes/teamer.js:869 kommentiert „Naechste 3 anstehende Events
(Teamer-Events + Teamer-gesucht)", die Query darunter erzwingt aber
`AND eb.id IS NOT NULL` (routes/teamer.js:880) — der LEFT JOIN auf die
eigene Buchung wird damit zum INNER JOIN. Ein Termin mit `teamer_needed`,
auf den die Teamerin noch reagieren soll, erscheint auf ihrer Startseite
nicht. Es gibt auch keinen Filter auf teamer_only/teamer_needed, den der
Kommentar behauptet. (Nebenbei: LIMIT 5, nicht 3.)

**H3 — Termin-Status für Teamer ignoriert das Teamer-Kontingent auf allen Ebenen.** [V, Teilaspekte A]
Drei Stellen, ein Bild:
- Backend: `registration_status` in der gemeinsamen Liste wird
  ausschließlich aus Konfi-Zahlen und `waitlist_enabled`/`max_waitlist_size`
  berechnet (routes/events.js:119-134); `teamer_max_participants`/
  `teamer_waitlist_*` (Migration 120) fließen nicht ein. [V]
- Frontend-Status: `getEventStatusInfo` im Teamer-Baum
  (`teamer/pages/TeamerEventsPage.tsx:482-538`) kennt keinen Zweig für
  „voll"/„Ausgebucht"/„Warteliste offen" — ein Team-Termin mit vollem
  Kontingent steht in der Liste als „Offen". Konfi
  (`konfi/views/EventsView.tsx:197-219`) und Admin
  (`admin/EventsView.tsx:320-334`) unterscheiden genau diese Fälle. [V]
- Listen-Anzeige: Die Teamer-Karte zeigt keinerlei Wartelisten-Zahl
  (`teamer/pages/TeamerEventsPage.tsx:1407-1436`), obwohl
  `teamer_waitlist_count` geliefert (routes/events.js:161,285) und im
  Detail genutzt wird (`TeamerEventsPage.tsx:833`). Admin- und Konfi-Karten
  zeigen sie (`admin/EventsView.tsx:431-436`,
  `konfi/views/EventsView.tsx:415-420`). [A]
Nutzerwirkung: Der Teamer erfährt erst beim Absenden (400) oder erst im
Detail, dass kein Platz mehr ist.

**H4 — Challenge-Freigabe-Zähler übersieht bei Teamern die „nur Team"-Challenges.** [V]
Der Teamer-Zweig des Tab-Zählers zählt offene Freigaben ausschließlich
über `challenge_jahrgang_assignments`
(routes/notifications.js:82-93) und liefert bei
`teamerJahrgangIds.length === 0` konstant 0 (Zeile 82). Challenges mit
`audience='nur_team'` haben per Definition keine Jahrgangszuordnung und
sind für jeden Teamer der Org sicht- und moderierbar
(routes/challenges.js:188-195, dort ausdrücklich so kommentiert; gleiche
Ausnahme in der Listen-Query). Folge: Ein Teamer kann eine Team-Runde
moderieren, wird aber nie per Tab-Zähler darauf gestoßen. Der Admin-Zweig
zählt org-weit und ist korrekt (routes/notifications.js:74-80).

**H5 — „Alle bestätigen" gibt es nur für Konfis, obwohl das Backend Teamer ausdrücklich unterstützt.** [V]
`PUT /events/:id/participants/attendance-all` nimmt `rolle: 'teamer'`
entgegen und verbucht dann gezielt Teamer ohne Punktevergabe
(routes/events.js:2782-2783 mit dokumentiertem Nutzerentscheid vom
25.08.2026). Das Frontend ruft die Route ohne Body auf und rendert den
Button nur über der Konfi-Sektion — bei `teamer_only`-Terminen gar nicht
(`admin/views/EventDetailView.tsx:830-847`, Guard `!isTeamerOnlyEvent`);
die Teamer-Sektion hat keinen. Die Leitung muss Teamer einzeln verbuchen,
und der Termin bleibt bis dahin im „Verbuchen"-Reiter, weil
`pending_bookings_count` beide Rollen zählt (routes/events.js:270-274 [A]).
Halb gebautes Feature: Backend fertig, Frontend fehlt.

**H6 — Abgesagter Termin: Konfi-Liste sagt „Abgesagt", der Status-Endpunkt sagt 404.** [V]
`GET /konfi/events/:id/status` filtert abgesagte Termine komplett aus der
WHERE-Klausel (routes/konfi.js:1316:
`(e.cancelled = FALSE OR e.cancelled IS NULL)`) und antwortet dann 404
(routes/konfi.js:1320-1322), während die Konfi-Liste dasselbe Event mit
`registration_status='cancelled'` weiterhin liefert (routes/konfi.js:1224
[A]). Zwei Antworten für denselben Termin in derselben Rolle.

### Schwere MITTEL

**M1 — `POST /teamer/events/:id/zusage` umgeht Kapazität und Warteliste vollständig.** [V]
Der Zusage-Endpunkt setzt bei `dabei=true` hart `status='confirmed'`
(routes/teamer.js:1329-1350) — ohne Prüfung von
`teamer_max_participants`, `teamer_waitlist_enabled` oder
`teamer_max_waitlist_size`. Der reguläre Buchungsweg prüft all das
(routes/events.js:1667-1677 über utils/bookingUtils.js). Die UI ruft
`dabei=true` derzeit nicht auf (nur die Absage,
`teamer/pages/TeamerEventsPage.tsx:1069`; „Ich bin dabei" geht über
`/events/:id/book`, Zeile 545/1054), aber der Aufruf ist parametrisiert
(Zeile 450) und die Route offen — ein künftiger Frontend-Griff zur
„naheliegenden" Zusage-Route überbucht das Kontingent. Unsicher, ob als
bewusste Ausnahme gedacht; kommentiert ist nur der Absage-Fall.

**M2 — Tageslosung: Konfi bekommt statischen Fallback, Teamer einen 500er — der Kommentar behauptet Gleichheit.** [V]
Bei Ausfall der Losungs-API UND leerem Cache liefert der Konfi-Endpunkt
Psalm 23 als statischen Fallback mit HTTP 200 (routes/konfi.js:1467-1478).
Der Teamer-Endpunkt hat nur den Cache-Fallback und endet sonst mit
HTTP 500 (routes/teamer.js:1200), obwohl der Kommentar dort sagt
„Fallback wie in der Konfi-Route" (routes/teamer.js:1181). Klassischer
Ein-Datei-Fix: zur Hälfte übernommen.

**M3 — Corner-Badge „Du hast bereits eingereicht" bedeutet je Baum etwas anderes.** [V]
Konfi-Liste prüft `has_submission` — eingereicht ist eingereicht, auch
unmoderiert (`konfi/views/ChallengesView.tsx:265,356`;
routes/challenges.js:310-315 mit genau dieser Begründung). Die geteilte
Leitungs-/Teamer-Liste prüft `has_badge`
(`admin/views/ChallengesManageView.tsx:259`), das seit 24.08. nur
FREIGEGEBENE Beiträge zählt (routes/challenges.js:305-309) — mit
demselben Tooltip „Du hast bereits eingereicht" (Zeile 264). Bei einer
moderierten Challenge sieht ein Teamer nach dem eigenen Einreichen kein
Häkchen, ein Konfi in derselben Lage schon. Der Fix liegt ungenutzt
bereit: `GET /challenges/admin` liefert `own_submission_count`
(routes/challenges.js:1100-1101, 1125), das im Frontend nirgends
verwendet wird.

**M4 — Bibelübersetzung: zwei Auswahllisten, RVR60 nur in der privaten Konfi-Profil-Kopie.** [V]
`konfi/views/ProfileView.tsx:128-141` definiert ein EIGENES lokales
BibleTranslationModal mit sieben Übersetzungen inklusive RVR60
(Reina-Valera 1960). Das geteilte `shared/BibleTranslationModal.tsx:9-14`
— genutzt vom Konfi-Dashboard, Teamer-Dashboard und Teamer-Profil — kennt
nur sechs, ohne RVR60. Beide Backends akzeptieren RVR60
(routes/konfi.js:2017, routes/teamer.js:1208). Ein Konfi kann Spanisch
also nur im Profil wählen, nicht auf der Startseite; ein Teamer gar nicht.
Duplizierte Komponente, auseinandergedriftet.

**M5 — Teamer-Profil verwirft die Übersetzungswahl offline stillschweigend, Konfi-Profil reiht sie ein.** [V]
`teamer/pages/TeamerProfilePage.tsx:115-117` setzt die Auswahl optimistisch
und returned dann bei `!networkMonitor.isOnline` kommentarlos — nach dem
nächsten Laden ist die Wahl weg. `konfi/views/ProfileView.tsx:276-289`
legt denselben Fall in die writeQueue (fire-and-forget, wird nachgeholt).
Gleiche Funktion, gegensätzliches Offline-Verhalten.

**M6 — Antrag stellen: Konfi-Weg erzeugt Admin-In-App-Notifications, Teamer-Weg nur Push.** [A]
`POST /konfi/requests` schreibt notifications-Zeilen für Admins UND sendet
Push (routes/konfi.js:760-810); `POST /teamer/requests` sendet nur Push
(routes/teamer.js:1431-1441). Teamer-Anträge fehlen damit im
Admin-Mitteilungscenter. Zusatzbefund derselben Stelle: Der Konfi-Weg
adressiert In-App nur `r.name='admin'` — org_admin geht leer aus
(routes/konfi.js:766). Nicht einzeln nachgeprüft.

**M7 — Wrapped: Freigabe-Gate nur im Dashboard, nicht am Datenendpunkt.** [A]
Das Konfi-Dashboard prüft `wrapped_released_at` (routes/konfi.js:167-173),
`GET /wrapped/me` (routes/wrapped.js:439-466) prüft nur user_id +
wrapped_type — der Snapshot ist vor der Freigabe abrufbar. Für den
Teamer-Typ gibt es keine Freigabe, das ist dort konsistent. Nicht einzeln
nachgeprüft.

**M8 — Teamer-Dashboard-Challenges kommen vom Leitungs-Endpunkt ohne Audience-Filter.** [V für den Aufruf, A für die Filterlogik]
`teamer/pages/TeamerDashboardPage.tsx:337` lädt `GET /challenges/admin`;
das Konfi-Dashboard lädt `GET /challenges/konfi`
(`konfi/views/DashboardView.tsx:258`). Der Admin-Endpunkt filtert nicht
nach audience (routes/challenges.js:1109-1113), der Konfi-Endpunkt schon
(routes/challenges.js:452-473). Auf der Teamer-Startkarte erscheinen
damit auch reine `audience='konfis'`-Challenges, an denen Teamer nicht
teilnehmen dürfen.

**M9 — E-Mail-Änderung: Teamer/Admin aktualisieren den User-Context, Konfi nicht.** [V für Teamer/Konfi]
`teamer/pages/TeamerProfilePage.tsx:138-146` holt nach erfolgreicher
Änderung `/auth/me` und schreibt die neue Adresse in User-Context und
tokenStore. `konfi/views/ProfileView.tsx:336-339` ruft nur `onReload()` —
der Context behält die alte Adresse bis zum Neu-Login. AdminProfilePage
nutzt eine eigene Modal-Kopie (`admin/modals/ChangeEmailModal.tsx`);
den Zeilenvergleich der Modal-Paare admin/ vs. konfi/ habe ich NICHT
durchgeführt (siehe „Nicht geprüft").

### Schwere NIEDRIG / strukturell (latente Fallen, Kleinkram)

**N1 — Zwei Buchungspfade mit unterschiedlichen Guards.** [A]
`POST /konfi/events/:id/register` (routes/konfi.js:1529) vs.
`POST /events/:id/book` (routes/events.js:1603): Der Konfi-Pfad hat keinen
`teamer_only`-Guard (events.js:1716-1720 hat ihn) und keinen
`cancelled`-Guard (den hat nur die Teamer-Zusage, teamer.js:1314 [V]);
die Timeslot-Zählung im Konfi-Pfad zählt ohne Rollenfilter
(konfi.js:1634-1641), events.js filtert Teamer heraus (1792-1800).
Praktisch vermutlich folgenlos (Teamer-Buchungen erhalten keine
timeslot_id), als Divergenz aber real. Unsicher, ob das Frontend die
cancelled-Fälle abfängt.

**N2 — Badge-Fortschritt: eine Single-Source für Konfis, eine 250-Zeilen-Inline-Kopie für Teamer.** [A]
Konfi nutzt utils/konfiBadgeProgress.js (routes/konfi.js:1033), Teamer
rechnet inline (routes/teamer.js:269-523) mit eigener Antwortform
(flaches Array + Zählwerte in HTTP-Headern statt {available, earned,
stats}) und ohne die „unerreichbar"-Ausblendung des Konfi-Pfads
(konfiBadgeProgress.js:154-183). Dazu: `GET /konfi/badges/stats` zählt
`earned_badges` ohne target_role-Filter, `total_badges` mit
(routes/konfi.js:1054-1057) — derselbe Fehler, der in
konfiBadgeProgress.js:117-126 am 24.08. behoben wurde, in der
Nachbar-Query nicht.

**N3 — Anträge lesen: target_role-Filter nur beim Teamer.** [A]
`GET /teamer/requests` filtert `a.target_role='teamer'`
(routes/teamer.js:1264), `GET /konfi/requests` filtert gar nicht nach
target_role (routes/konfi.js:669-675). Dazu LEFT JOIN (konfi) vs. JOIN
(teamer) auf activities: bei gelöschter Aktivität liefert der eine Pfad
eine Zeile mit null-Namen, der andere keine.

**N4 — org_admin kann an Challenges teilnehmen, hat aber keine eigene Abzeichen-Ansicht.** [A]
`GET /teamer/badges` wirft 403 für alles außer role_name='teamer'
(routes/teamer.js:271-273), das Challenge-System erlaubt Admins das
Einreichen (routes/challenges.js:49-58), `/admin/badges` ist die
Verwaltungsseite. Unsicher, ob bewusst — nirgends als Entscheid
kommentiert.

**N5 — Leitung kann das Konfi-Wrapped nicht ansehen, obwohl das Backend es ihr erlaubt.** [V]
`GET /wrapped/history/:userId` gestattet admin/org_admin den Zugriff auf
fremde Snapshots (routes/wrapped.js:660-673), aber im Admin-Baum gibt es
keinerlei Wrapped-Anzeige (Grep über admin/: nur Freigabe-Verwaltung in
`admin/pages/AdminJahrgaengeePage.tsx:99-104`). Teamer sehen über
`teamer/pages/TeamerKonfiStatsPage.tsx:238` nur ihr EIGENES eingefrorenes
Konfi-Wrapped — das ist korrekt so. Halb genutzter Endpunkt.

**N6 — Termin-Detail-Divergenzen quer durch die Bäume.** [A]
- Anmeldezeitraum fehlt nur im Teamer-Detail
  (`admin/views/EventDetailSections.tsx:171-192`,
  `konfi/views/EventDetailView.tsx:636-657`, Teamer: nicht vorhanden).
- Serien-Kennzeichnung (`is_series`) sieht nur die Leitung
  (`admin/EventsView.tsx:402-404`, `EventDetailSections.tsx:426-479`).
- Einstieg in den Event-Chat hat nur die Leitung
  (`admin/views/EventDetailView.tsx:486-516`), obwohl Konfis und Teamer
  beim Buchen automatisch Chat-Mitglieder werden (routes/events.js:1683,
  addToEventChat) — sie finden den Raum nur über die Chat-Übersicht.
- „Vergangen"-Berechnung: Listen nutzen teils `event_end_time`
  (`konfi/views/EventsView.tsx:152`, `admin/pages/AdminEventsPage.tsx:219`),
  Details und Teamer durchgehend nur `event_date`
  (`konfi/views/EventDetailView.tsx:418,442`,
  `teamer/pages/TeamerEventsPage.tsx:483`) — bei mehrtägigen Terminen
  widersprechen sich Liste und Detail.
- Admin-Detail berechnet `registration_status` lokal und weicht dabei von
  Backend und eigener Liste ab (`admin/views/EventDetailView.tsx:244-256`
  vs. `admin/EventsView.tsx:128-131`).
- Punktezeile: drei verschiedene Bedingungen — nur Admin-Detail zeigt
  „Punkte 0" (`EventDetailSections.tsx:290-311` ohne points>0-Guard,
  konfi/teamer mit).
- Abmeldefrist (2 Tage) hartcodiert und nur im Konfi-Zweig
  (`konfi/views/EventDetailView.tsx:276`, routes/konfi.js:1755) — keine
  Einstellung, für die Leitung unsichtbar.
- `checkin_window` wird nur im Formular gesetzt
  (`admin/modals/EventFormSections.tsx:206-223`), in keiner der drei
  Detailansichten angezeigt.

**N7 — Strukturbefund: `TeamerChallengesPage.tsx` ist eine Zeilenkopie von `AdminChallengesPage.tsx`.** [A]
Identisch bis auf Cache-Key, Modal-ID und einen Kommentar. Die geteilten
Views verhindern aktuell Lücken, aber jede künftige Seiten-Änderung muss
manuell gespiegelt werden — der Nährboden dieser Fehlerklasse. Gleiches
Muster kleiner: `PushNotificationSettings` wird in
`layout/MainTabs.tsx:55` importiert und nirgends gerendert [V]; org-weite
Settings `waitlist_enabled`/`max_waitlist_size` werden geschrieben und
gelesen (routes/settings.js:87-93, 170-183), aber von keiner Route
konsumiert — die Wartelisten-Logik hängt ausschließlich an den
Event-Spalten [A].

**N8 — bible_translation liegt je Rolle in einer anderen Tabelle.** [A]
Konfi: `konfi_profiles.bible_translation` (routes/konfi.js:2027), Teamer:
`users.bible_translation` (routes/teamer.js:1212). Bei Beförderung
Konfi -> Teamer startet die Übersetzung still wieder bei LUT. Zwei
gleichnamige Spalten für dieselbe Präferenz sind zudem eine Falle für
künftige Fixes.

---

## Teil 3: Legitime Unterschiede (geprüft, KEIN Handlungsbedarf)

- **Punkte, Level, Ranking, Punkteart nur für Konfis.** Teamer haben keine
  Punkte (routes/events.js:485-487 vergibt nur an type='konfi'); ihr
  Ersatz ist die eingefrorene Konfi-Zeit (`GET /teamer/konfi-history`,
  routes/teamer.js:173, `TeamerKonfiStatsPage.tsx` mit bewusst beiden
  Punktarten sichtbar, Zeile 215).
- **Zertifikate nur Teamer** (routes/teamer.js:609-824; Juleica u.ä.) —
  deshalb `teamer_dashboard_show_zertifikate` ohne Konfi-Pendant.
- **Material erst ab Teamer**: alle Lese-Routen requireTeamer
  (routes/material.js:73,166,285,316,681). Dass der Konfi-Termin-Detail
  kein Material zeigt, ist damit konsistent, kein Versäumnis.
- **Timeslots, opt-in/opt-out, Pflichttermine, Konfirmations-Sperre nur
  Konfis**; die Teamer-Zusage ist bewusst ohne Begründungszwang
  (routes/teamer.js:1286-1290, dokumentierter Entscheid 25.08.2026).
- **Konfis sehen keine teamer_only-Termine** — serverseitig doppelt
  gefiltert (routes/konfi.js:1223, routes/events.js:225-227).
- **Kein „Geplant"-Reiter bei Konfi-Challenges**: der Konfi-Endpunkt
  liefert Entwürfe/Geplantes gar nicht (routes/challenges.js:488-490).
- **Kein is_active-Filter in den Teilnehmer-Abzeichenansichten**: beide
  Backends filtern serverseitig und lassen verdiente Abzeichen bewusst
  stehen (utils/konfiBadgeProgress.js:40, routes/teamer.js:284 — als
  Harmonisierung vom 24.08. kommentiert). Nur die tote Durchreichung des
  Felds im Frontend ist ein Schönheitsfehler.
- **Konfispruch-Sichtbarkeit**: Konfi zusätzlich an
  `jahrgaenge.konfspruch_enabled` gebunden (routes/konfi.js:314-316),
  Teamer nur an den Dashboard-Schalter — Teamer haben keinen Jahrgang.
- **Admin ohne Start-Dashboard** (landet auf /admin/konfis,
  `layout/MainTabs.tsx:219`) und ohne eigene Wrapped-/Losung-Karten —
  Designentscheidung, kein Versäumnis (die Leitung verwaltet, sie spielt
  nicht mit; Ausnahme siehe N4).
- **QR-Rollenverteilung**: Konfis scannen, Teamer/Leitung zeigen an —
  passend zu den Backend-Rechten (routes/events.js:564,598 requireTeamer).
- **Foto-Upload für Anträge nur unter /konfi/**: bewusst EIN Endpunkt für
  beide Rollen mit Teamer-Zweigen (routes/konfi.js:835,896) — irritierender
  Pfadname, aber keine Lücke.

---

## Teil 4: Nicht geprüft (ehrliche Lücken dieses Durchgangs)

- **Dashboard/Profil als systematischer Volldurchgang.** Die dafür
  angesetzte Detailanalyse hat kein Ergebnis geliefert; die Befunde M4, M5,
  M9 und die Tageslosungs-Entwarnung stammen aus eigenen Stichproben.
  NICHT verglichen: Onboarding-/Update-Walkthrough-Modale je Rolle,
  Wrapped-Inhalte/Historie im Profil, Abschnittsreihenfolge
  (dashboard_section_order vs. teamer_dashboard_section_order),
  Neuerungen-Banner-Logik, Verhalten von Konto-Löschen und
  Medien-Cache-Steuerung (Vorhandensein je Baum ist geprüft: alle drei
  Profile importieren DeleteAccountModal und useMediaCacheControl [V]).
- **Zeilenvergleich der Modal-Paare** `admin/modals/ChangeEmailModal.tsx`
  vs. `konfi/modals/ChangeEmailModal.tsx` (dito ChangePasswordModal) —
  zwei Kopien derselben Funktion, Driftrisiko wie bei M4, Inhalt nicht
  verglichen.
- **Chat-Baum** (`chat/`) — laut Auftrag rollenübergreifende Ausnahme,
  nicht auf rollenspezifische Weichen untersucht.
- **Punkteart-Ausblendung** — parallel in Bearbeitung, hier nur als
  Beispiel der Klasse genannt.

---

## Anhang: Empfehlung gegen die Fehlerklasse selbst

Die belastbarste Erkenntnis dieses Durchgangs: Überall, wo eine Komponente
GETEILT wird (ChallengesManageView, ChallengeLeitungModal,
ChallengeSubmitModal, konfi/views/BadgesView für Teamer), gibt es KEINE
Lücken — überall, wo kopiert wurde (TeamerChallengesPage,
ProfileView-eigenes BibleTranslationModal, Badge-Fortschritt inline in
teamer.js, ChangeEmail/ChangePassword doppelt), driftet es. Wer eine der
Kopien anfasst, sollte die Zwillingsdatei im selben Commit anfassen oder
die Kopie durch die geteilte Komponente ersetzen.
