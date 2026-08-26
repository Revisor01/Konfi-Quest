# Rollen-Berechtigungen: Abgleich Absicht — Backend — drei Ansichten — Handbuch

**Auftrag:** Systematischer Abgleich der Rollen-Berechtigungen zwischen
deklarierter Absicht, Backend-Guards, den drei Frontend-Ansichten
(Leitung/Teamer/Konfi) und dem Handbuch. Anlass: Die Entscheidung
"Teamer:innen dürfen Termine anlegen, bearbeiten und löschen" ist im Code
nicht umgesetzt — diese Klasse von Auseinanderlaufen wurde systematisch
gesucht.
**Datum:** 26.08.2026
**Geprüfter Commit:** `2a89dcb` (main)
**Urteil in einem Satz:** Das Backend setzt die deklarierte Rollen-Absicht
weitgehend korrekt um — die großen Abweichungen liegen in der Teamer-Ansicht,
die einen ganzen Block zugesicherter Rechte (Events verwalten, Konfis
ansehen, Punkte vergeben) schlicht nicht anbietet, in zwei Stellen, an denen
die Admin-Ansicht der Rolle `admin` Aktionen anbietet, die das Backend mit
403 ablehnt (Teamer anlegen, Zertifikate), und in einer Backend-Lücke, durch
die jede:r Raum-Teilnehmer:in fremde Chat-Nachrichten per API löschen kann.

---

## Teil 1: Das Berechtigungsmodell

**Es gibt kein tabellenbasiertes Permission-System im aktiven Code.** Die
Tabellen `permissions` und `role_permissions` existieren zwar in der
Datenbank (`backend/init-scripts/007_levels.sql:36` legt z.B.
`manage_levels` an; `backend/routes/organizations.js:777` räumt sie beim
Org-Löschen ab), aber **kein einziger Guard liest sie**. Wirksam sind drei
Mechanismen:

1. **Statische Rollen-Kaskade** in `backend/middleware/rbac.js`:
   - `verifyTokenRBAC` lädt Rolle und Org aus `users`/`roles` und setzt
     `req.user.role_name` sowie das Kompatibilitätsfeld `req.user.type`
     (`konfi`/`teamer`/`admin` — org_admin und super_admin werden zu
     `admin`).
   - Guards: `requireOrgAdmin` = org_admin (rbac.js:272), `requireAdmin` =
     org_admin+admin (rbac.js:273), `requireTeamer` =
     org_admin+admin+teamer (rbac.js:274), `requireSuperAdmin`
     (rbac.js:263, Rolle ODER `is_super_admin`-Flag).
   - Die Absicht steht als Kommentar direkt daneben: "admin (3) — Konfis,
     Events, Badges, Aktivitäten, Requests" (rbac.js:59), **"teamer (2) —
     Events, Konfis ansehen, Punkte vergeben"** (rbac.js:60).
2. **Jahrgangs-Zuweisungen** (`user_jahrgang_assignments` mit
   `can_view`/`can_edit`) als Feinberechtigung für Teamer:
   `checkJahrgangAccess`/`filterByJahrgangAccess` (rbac.js:321-352, Regel:
   org_admin und admin sehen org-weit, Teamer nur zugewiesene Jahrgänge).
3. **Innere Prüfungen pro Route**, vor allem im Chat
   (`req.user.type`-Checks, `darfRaumOeffnen` chat.js:273-287), bei
   Challenges (`TEAM_ROLES`, `leadershipMayAccess` challenges.js:50,
   184-205) und Levels (levels.js:53-55).

Die einzige maschinenlesbare **Absichts-Deklaration** ist die statische
Liste `getRolePermissions()` in `backend/routes/roles.js:144-181`. Sie gibt
der Rolle teamer ausdrücklich: `konfis.view` ("Konfis ansehen",
roles.js:171), `konfis.points` ("Punkte vergeben", roles.js:172) und
**`events.full` ("Events verwalten", roles.js:173)**. Diese Liste wird nur
zur Anzeige ausgeliefert — sie steuert nichts, dokumentiert aber die
Absicht, an der dieser Bericht misst.

Im Frontend gibt es kein zentrales Berechtigungssystem mehr
(`frontend/src/contexts/AppContext.tsx:792`: "hasPermission entfernt");
jede Seite prüft `user.role_name` bzw. `user.type` selbst. Das Routing
verzweigt allein nach `user.type`
(`frontend/src/components/layout/MainTabs.tsx:214` admin, :297 teamer,
:357 konfi) — welche Seiten eine Rolle überhaupt erreichen kann, entscheidet
also der jeweilige Routen-Zweig.

---

## Teil 2: Matrix Rolle mal Aktion

Legende: **B** = Backend erlaubt (Guard), **UI** = die Ansicht der Rolle
bietet es an, **H** = Handbuch-Aussage. "Leitung" meint org_admin+admin,
Unterschiede sind vermerkt. Alle Backend-Angaben aus den Routen-Guards
(selbst geprüft), UI-Angaben aus den drei Komponentenbäumen.

### Termine/Events

| Aktion | B (wer) | Admin-UI | Teamer-UI | Konfi-UI | Handbuch |
|---|---|---|---|---|---|
| ansehen | alle (events.js:86; Konfi: konfi.js:1090) | ja (EventsView.tsx:344) | ja (TeamerEventsPage.tsx:139) | ja (KonfiEventsPage.tsx:91) | konsistent |
| anlegen | **teamer**+admin+org_admin (events.js:823) | ja (AdminEventsPage.tsx:666; Gate :625 nennt sogar teamer) | **nein** (kein Button/Call, einziger FAB ist der QR-Scanner TeamerEventsPage.tsx:1488) | nein | 20-teamer.md:58-60: Teamer können es NICHT, "Termine legt die Leitung an" |
| bearbeiten | **teamer**+admin+org_admin (events.js:1014) | ja (EventDetailView.tsx:636, EventModal.tsx:272) | **nein** | nein | wie oben |
| löschen | **teamer**+admin+org_admin (events.js:1428) | ja (EventsView.tsx:505, AdminEventsPage.tsx:348) | **nein** | nein | wie oben |
| absagen | **teamer**+admin+org_admin (events.js:3094) | ja (EventsView.tsx:494, AdminEventsPage.tsx:523) | **nein** | nein | 30-leitung.md:98 (Leitung) |
| Serie anlegen | **teamer**+admin+org_admin (events.js:2402) | ja (EventModal.tsx:275) | nein | nein | 30-leitung.md:91 |
| Teilnehmer verwalten / Anwesenheit | **teamer**+admin+org_admin (events.js:2052, 2223, 2690, 2781, 2895) | ja (EventDetailView.tsx:331-342, 782-790) | **nein** (ParticipantManagementModal nicht importiert) | nein | 30-leitung.md:93-95 (Leitung); 70-termine.md nennt Teamer nicht |
| QR-Code anzeigen | teamer+ (events.js:564) | ja (EventDetailView.tsx:633) | ja (TeamerEventsPage.tsx:693-700) | nein | 70-termine.md:578-579: "Leitung und Teamer:innen gleichermaßen" — stimmt |
| selbst an-/abmelden | alle (events.js:1603, 1869; teamer.js:1291) | (Leitung bucht andere) | ja (TeamerEventsPage.tsx:545, 454, 581) | ja (EventDetailView.tsx:304, 173, konfi-Baum) | konsistent |
| QR-Selbst-Check-in | alle (events.js:380) | kein Scanner in Admin-UI | ja (TeamerEventsPage.tsx:1488) | ja (QRScannerModal.tsx:79) | 70-termine.md:552 |

### Aktivitäten

| Aktion | B (wer) | Admin-UI | Teamer-UI | Konfi-UI | Handbuch |
|---|---|---|---|---|---|
| Katalog ansehen | teamer+ (activities.js:71); eigene Kataloge konfi.js:982, teamer.js:1233 | ja | ja (nur zum eigenen Melden, TeamerActivityRequestModal.tsx:95) | ja | konsistent |
| Katalog-CRUD | admin+org_admin (activities.js:126, 170, 220) | ja (ActivityManagementModal.tsx:215-217, AdminActivitiesPage.tsx:87; Gate :119) | nein | nein | 30-leitung.md:135 |
| Antrag stellen | konfi (konfi.js:685), teamer (teamer.js:1380) | — | ja (TeamerActivityRequestModal.tsx:202) | ja (ActivityRequestModal.tsx:199) | 10-konfis.md:94-101, 20-teamer.md:62-67 |
| eigenen offenen Antrag löschen | konfi (konfi.js:936, nur pending), teamer (teamer.js:1454, nur pending) | — | ja (TeamerEventsPage.tsx:272) | ja (KonfiEventsPage.tsx:264, dreifach auf pending gegatet) | konsistent |
| fremde Anträge entscheiden/zurücksetzen/löschen | admin+org_admin (activities.js:473, 392, 357; löschen nur rejected) | ja (ActivityRequestModal.tsx:160, Reset AdminEventsPage.tsx:601; kein Lösch-Swipe, Kommentar ActivityRequestsView.tsx:274-275) | nein | nein | 40-punkte.md:80 ("Nur die Leitung sieht Anträge") und :120-128 — konsistent |
| Aktivität direkt zuweisen (Konfi-Verwaltung) | admin+org_admin (konfi-management.js:899) | ja (ActivityModal.tsx:135) | nein | — | 40-punkte.md:138-140 Spalte "Konfi-Verwaltung: nur Leitung" — konsistent |
| Aktivität direkt zuweisen (assign-activity) | **teamer**+admin+org_admin (activities.js:642, mit Jahrgangs-Check) | **nein — kein Aufrufer im ganzen Frontend** | **nein** | — | 40-punkte.md:138-146 beschreibt den Weg "über die Aktivitäten-Seite" als existent, inkl. Verhaltenstabelle |

### Bonuspunkte

| Aktion | B (wer) | Admin-UI | Teamer-UI | Konfi-UI | Handbuch |
|---|---|---|---|---|---|
| vergeben | **teamer**+admin+org_admin (konfi-management.js:770; nur Org-Scope, KEIN Jahrgangs-Check) | ja (BonusModal.tsx:93, KonfiDetailSections.tsx:400-412) | **nein** (0 Treffer "bonus" als Aktion im teamer-Baum) | nein | 40-punkte.md:65: "dürfen auch Teamer:innen vergeben"; 45-jahrgaenge.md:180: ohne Zuweisung "abgewiesen" — beides trifft die UI/API-Realität nicht |
| löschen | admin+org_admin (konfi-management.js:850) | ja (KonfiDetailView.tsx:400) | nein | nein | 40-punkte.md:163 |

### Challenges

| Aktion | B (wer) | Admin-UI | Teamer-UI | Konfi-UI | Handbuch |
|---|---|---|---|---|---|
| Leitungs-Liste | teamer+ (challenges.js:1061; Teamer nur zugewiesene Jahrgänge + nur_team, :184-205) | ja | ja (TeamerChallengesPage.tsx:41) | — | 80-challenges.md:100-101, 123 |
| anlegen | teamer+ (challenges.js:1136) | ja (AdminChallengesPage.tsx:160) | ja (TeamerChallengesPage.tsx:158-160) | nein | 20-teamer.md:76 |
| bearbeiten | teamer+ (challenges.js:1250, `leadershipMayAccess`) | ja (ChallengesManageView.tsx:382) | ja (TeamerChallengesPage.tsx:136) | nein | 20-teamer.md:76 |
| löschen | teamer+ (challenges.js:1408, `leadershipMayAccess`, force bei gestartet) | ja (ChallengesManageView.tsx:391, useChallengeDelete.ts:26) | ja (TeamerChallengesPage.tsx:150) | nein | 20-teamer.md:76-78 nennt Löschen NICHT |
| moderieren | teamer+ (challenges.js:1527) | ja (ChallengeLeitungModal.tsx:445) | ja (gleiches Modal) | nein | 20-teamer.md:77 |
| einreichen | konfi+Team je audience (challenges.js:615, 622-624) | ja (ChallengeLeitungModal.tsx:649-656) | ja | ja (ChallengeSubmitModal.tsx:381/395) | 20-teamer.md:78, 80-challenges.md:120 |
| eigenen Beitrag zurückziehen | **niemand** — Route antwortet immer 403 (challenges.js:831-840) | nein | nein | nein (kein Button, Konfi-Baum) | 80-challenges.md:357 — konsistent |

### Abzeichen (Badges)

| Aktion | B (wer) | Admin-UI | Teamer-UI | Konfi-UI | Handbuch |
|---|---|---|---|---|---|
| ansehen (Verwaltungssicht) | teamer+ (badges.js:723) | ja | nein (nur eigene via /teamer/badges, TeamerBadgesPage.tsx:48) | nein (nur eigene, KonfiBadgesPage.tsx:59) | 60-badges.md, 20-teamer.md:86-92 |
| CRUD | admin+org_admin (badges.js:782, 814, 850) | ja (BadgeManagementModal.tsx:321-323, AdminBadgesPage.tsx:123) | nein (0 Treffer) | nein | 30-leitung.md:137 |

### Material

| Aktion | B (wer) | Admin-UI | Teamer-UI | Konfi-UI | Handbuch |
|---|---|---|---|---|---|
| ansehen | teamer+ (material.js:166, 316, 681) | ja | ja (TeamerMaterialPage.tsx:111) | **kein Zugriff** (kein Material im konfi-Baum) | 20-teamer.md:104-106, 30-leitung.md:141 — konsistent |
| CRUD + Dateien | admin+org_admin (material.js:385, 454, 557, 607, 736) | ja (MaterialFormModal.tsx:270-282, AdminMaterialPage.tsx:121) | nein (MaterialFormModal nicht importiert) | nein | 30-leitung.md:141 |
| Tags CRUD | admin+org_admin (material.js:87, 112, 141) | **nein — keine Tag-UI** (0 Treffer `/tags` in components/) | nein | nein | Handbuch erwähnt Tags nicht |

### Chat (gemeinsamer Baum, Gating per Rolle)

| Aktion | B (wer) | UI bietet an | Handbuch |
|---|---|---|---|
| Direktchat anlegen | alle; Konfi nur an Team, Jahrgangsbindung (chat.js:339-385) | alle (SimpleCreateChatModal.tsx:137-160) | 90-chat.md:94-98 — konsistent |
| Gruppe anlegen | **admin+teamer** (chat.js:428; nur Konfi wird auf direct beschränkt :442-450) | admin+teamer (SimpleCreateChatModal.tsx:379-393, 419, 487) | **widersprüchlich:** 90-chat.md:39 "Nur die Leitung legt Gruppen an" vs. 20-teamer.md:34 "Du kannst Gruppenchats anlegen" |
| Mitglieder ansehen | jede:r Raum-Teilnehmer:in (chat.js:1336, 1344) | **nur `type === 'admin'`** (ChatRoomSections.tsx:74-79) | 10-konfis.md:46: "In Gruppen siehst du, wer sonst noch dabei ist" — stimmt nicht |
| Mitglieder hinzufügen/entfernen | nur admin-Typ (chat.js:1394, 1462) | nur admin + nur group (MembersModal.tsx:271) | 20-teamer.md:34-35, 90-chat.md:52-54 — konsistent |
| eigene Nachricht löschen | alle (chat.js:2117-2120) | admin: jede; teamer: eigene; **konfi: nie** (MessageBubble.tsx:749-757) | 90-chat.md:189-193: konfi "nur eigene — sie sehen den Papierkorb gar nicht erst" — UI konsistent, API lascher |
| fremde Nachricht löschen | **JEDE:R Teilnehmer:in des Raums** (chat.js:2121 via darfRaumOeffnen:280-287) — siehe Befund 4 | nur admin/org_admin | 90-chat.md:191: nur Leitung, nicht in fremden Direktchats |
| Raum löschen | nur admin-Typ (chat.js:2163ff; vgl. Bericht Chat-Löschlogiken 26.08.) | nur admin, nur direct/group (ChatOverview.tsx:518) | 90-chat.md:53-55 |
| Umfrage anlegen | nur admin-Typ (chat.js:1734) | nur admin (ChatRoomSections.tsx:74-82, ChatRoom.tsx:1474) | 90-chat.md:295-296 konsistent — aber **Teamer-Onboarding behauptet das Gegenteil** (Befund 8) |
| Export | nur Leitung, keine fremden Direktchats (chat.js:1201-1223) | nur Leitung (ChatRoom.tsx:1384-1385) | 20-teamer.md:37, 30-leitung.md:57 — konsistent |

### Konfi-Verwaltung

| Aktion | B (wer) | Admin-UI | Teamer-UI | Handbuch |
|---|---|---|---|---|
| Liste ansehen | **teamer**+admin (konfi-management.js:56; Jahrgangsfilter greift für ALLE außer org_admin/super_admin, :62-69) | ja (AdminKonfisPage) | **nein — es gibt keine Teamer-Konfi-Liste** | 45-jahrgaenge.md:178-179 beschreibt für Teamer eine Konfi-Liste; 45-jahrgaenge.md:173: Leitung "sieht immer die ganze Gemeinde" — beides trifft nicht zu (Befunde 5, 6) |
| Detail ansehen | teamer+ (konfi-management.js:468, org-weit OHNE Jahrgangs-Check) | ja (KonfiDetailView) | nein | — |
| Konfi anlegen | admin+org_admin (konfi-management.js:140) | ja (AdminKonfisPage.tsx:297, Gate :351) | nein | 30-leitung.md:18-19 |
| Konfi bearbeiten (Name, Jahrgang) | admin+org_admin (konfi-management.js:269-297, inkl. Jahrgangs-Chat-Sync) | **nein — kein Aufrufer** (KonfiModal nur Neuanlage; einziges PUT ist teamer-since) | nein | 90-chat.md:127-128 setzt voraus, dass sich der Jahrgang nachträglich setzen lässt |
| Konfi löschen / Passwort neu / befördern | admin+org_admin (konfi-management.js:395, 434, 1060) | ja (AdminKonfisPage.tsx:176, KonfiDetailView.tsx:398, 496) | nein | 30-leitung.md:35-37 |
| Teamer anlegen/bearbeiten/löschen | **nur org_admin** (users.js:158, 255, 385) | anlegen wird auch der Rolle admin angeboten (AdminKonfisPage.tsx:351-360 + UserManagementModal.tsx:143, 252) — **Befund 2**; löschen korrekt gegatet (KonfisView.tsx:391) | nein | 30-leitung.md:18-19 (Anlegen als Leitungs-Funktion), :42 (nur Löschen org_admin-exklusiv) |
| Zertifikate (Typen-CRUD, Zuweisung) | **nur org_admin** (teamer.js:626, 650, 698, 751, 809; nur GET ist requireAdmin :609, :732) | wird auch der Rolle admin angeboten (AdminCertificatesPage.tsx:442 Gate `['org_admin','admin']`; CertificateAssignModal.tsx:185, KonfiDetailSections.tsx:995-1003 unggegatet) — **Befund 3** | nein | 30-leitung.md:39, :142 ordnet Zertifikate der ganzen Leitung zu |

### Jahrgänge

| Aktion | B (wer) | Admin-UI | Teamer-UI | Handbuch |
|---|---|---|---|---|
| ansehen | teamer+ (jahrgaenge.js:42) | ja | nur als Filter-Dropdown (TeamerMaterialPage.tsx:103) | 45-jahrgaenge.md |
| CRUD | admin+org_admin (jahrgaenge.js:58, 106, 202) | ja (AdminJahrgaengeePage.tsx:161, 159, 488; Gate :545) | nein | 30-leitung.md:138, 154-165 |
| Anwesenheitsmatrix / Sprüche / Matrix-Mail | admin+org_admin (jahrgaenge.js:320, 450, 475) | ja (AttendanceMatrixModal.tsx:134, 148, 171; Gate AdminKonfisPage.tsx:351) | nein | 30-leitung.md:25-27 |

---

## Teil 3: Abweichungen, nach Schwere

### 1. HOCH: Teamer-Ansicht setzt "Events verwalten" nicht um (der Anlass, bestätigt und größer als gedacht)

**Absicht:** roles.js:173 gibt der Rolle teamer `events.full` ("Events
verwalten"); rbac.js:60 nennt "Events" als Teamer-Recht; das Gate in der
Admin-Events-Seite nennt teamer sogar ausdrücklich mit
(`frontend/src/components/admin/pages/AdminEventsPage.tsx:624-630`:
"org_admin, admin UND teamer dürfen Events verwalten").
**Backend:** erlaubt Teamern alles — anlegen (events.js:823), bearbeiten
(:1014), löschen (:1428), absagen (:3094), Serien (:2402), Teilnehmer
verwalten (:2052, :2223, :2690), Anwesenheit (:2781, :2895), Event-Chat
(:3041).
**Teamer-UI:** bietet NICHTS davon an. In
`frontend/src/components/teamer/pages/TeamerEventsPage.tsx` gibt es keinen
einzigen schreibenden Aufruf auf Event-Stammdaten; die einzigen
Schreib-Calls des gesamten teamer-Baums sind eigene Buchung/Zusage/Anträge
(TeamerEventsPage.tsx:454, 545, 581, 272; TeamerActivityRequestModal.tsx:202).
Der einzige FAB ist der QR-Scanner (TeamerEventsPage.tsx:1488). Die
Admin-Seite mit dem teamer-Gate ist für Teamer nicht geroutet
(MainTabs.tsx:297-320 routet den teamer-Zweig auf TeamerEventsPage).
**Handbuch:** `docs/handbuch/20-teamer.md:58-60` dokumentiert den
Ist-Zustand ("Termine legt die Leitung an") — also das Gegenteil der
Entscheidung.
**Dazu:** Der Handbuch-Hinweis "Die Einführung in der App sagt, du könntest
selbst Termine anlegen" (20-teamer.md:58-59) ist inzwischen selbst veraltet:
das Teamer-Onboarding wurde korrigiert und sagt "Angelegt werden Termine von
der Leitung" (`frontend/src/components/teamer/modals/TeamerOnboardingModal.tsx:50`).
**Folge:** Die Entscheidung ist zu zwei Dritteln nicht existent; bei einer
Umsetzung müssen Teamer-Events-Seite UND Handbuch (20-teamer.md:46-60,
70-termine.md) nachziehen. Zu klären ist dann auch, ob Teamer-Löschen/-
Bearbeiten auf zugewiesene Jahrgänge beschränkt sein soll — das Backend
prüft bei Events derzeit NUR die Organisation, keinen Jahrgang.

### 2. HOCH: Rolle `admin` läuft beim Teamer-Anlegen in einen 403

**Backend:** `POST /api/users` ist `requireOrgAdmin`
(`backend/routes/users.js:158`) — die Rolle admin darf keine Benutzer
anlegen. Ebenso PUT (:255) und die Jahrgangs-Zuweisung (:595).
**Admin-UI:** Der Plus-Button auf der Konfis-Seite ist für
`['org_admin','admin']` sichtbar und öffnet im Teamer-Modus das
UserManagementModal
(`frontend/src/components/admin/pages/AdminKonfisPage.tsx:351-360`); das
Modal erlaubt der Rolle admin ausdrücklich die Rollenauswahl "teamer"
(`frontend/src/components/admin/modals/UserManagementModal.tsx:140-144`)
und ruft beim Speichern `api.post('/users')` auf (:252) plus
`api.post('/users/:id/jahrgaenge')` (:266). Beides quittiert das Backend
für einen admin mit 403.
**Handbuch:** `docs/handbuch/30-leitung.md:15-19` beschreibt das Anlegen
von Teamer:innen über das Plus als normale Leitungs-Funktion; :42 nennt nur
das LÖSCHEN als org_admin-exklusiv.
**Folge:** Ein:e Admin (nicht org_admin) tippt auf Plus, füllt das Formular
aus und bekommt beim Speichern einen Fehler. Entweder das UI-Gate auf
org_admin verengen oder einen admin-tauglichen Backend-Weg schaffen —
und das Handbuch an die Entscheidung anpassen.

### 3. HOCH: Zertifikate — Admin-UI bietet der Rolle `admin` an, was nur org_admin darf

**Backend:** Zertifikat-Typen anlegen/bearbeiten/löschen und Zertifikate
zuweisen/entfernen sind `requireOrgAdmin`
(`backend/routes/teamer.js:626, 650, 698, 751, 809`); nur das Lesen ist
`requireAdmin` (:609, :732).
**Admin-UI:** Die Typen-Seite gated auf `['org_admin','admin']`
(`frontend/src/components/admin/pages/AdminCertificatesPage.tsx:442`) und
ist über den Inhalt-Block der Settings erreichbar, der allen Admins offen
steht (`AdminSettingsPage.tsx:363`). Die Zuweisung in der Teamer-Detailansicht
ist gar nicht gegatet
(`frontend/src/components/admin/views/KonfiDetailSections.tsx:995-1003`,
`modals/CertificateAssignModal.tsx:185`,
`views/KonfiDetailView.tsx:468`).
**Handbuch:** `docs/handbuch/30-leitung.md:39` ("Bei Teamer:innen kommen
Zertifikate dazu") und :142 (Tabelle "Inhalt", nicht im org_admin-Block
:144) ordnen Zertifikate der gesamten Leitung zu.
**Folge:** Ein:e Admin sieht die Buttons, füllt aus, bekommt 403. Handbuch
und UI sagen "Leitung", das Backend sagt "nur org_admin" — eine der drei
Seiten muss sich der Entscheidung beugen.

### 4. HOCH: Jede:r Raum-Teilnehmer:in kann fremde Chat-Nachrichten per API löschen

**Absicht (im Code dokumentiert):** "Fremde Nachricht: nur Leitung/Admins,
und nur in Räumen, die sie überhaupt öffnen dürfen"
(`backend/routes/chat.js:2117-2119`); ebenso das Handbuch
(`docs/handbuch/90-chat.md:189-196`: Teamer und Konfis nur eigene).
**Backend-Ist:** `DELETE /api/chat/messages/:messageId` prüft
`eigene || await darfRaumOeffnen(...)` (chat.js:2121) — und
`darfRaumOeffnen` liefert für **jede:n Teilnehmer:in des Raums** `true`
(chat.js:280-284: `if (teilnehmer) return true;`); erst der Fallback danach
ist auf den admin-Typ beschränkt (:287). Ein Konfi im Jahrgangs-Chat kann
damit jede fremde Nachricht seines Raums per API soft-löschen.
**UI:** zeigt den Papierkorb korrekt nur admin/org_admin (jede Nachricht)
bzw. Teamern (eigene)
(`frontend/src/components/chat/MessageBubble.tsx:749-757`) — der dortige
Kommentar behauptet sogar, das Backend lehne Teamer bei fremden Nachrichten
mit 403 ab. Das stimmt nicht (mehr).
**Einordnung:** Der Bericht `2026-08-26-chat-loeschlogiken.md` (Befund 3)
nennt das Nachrichten-Löschen "konsistent gelöst" — diese Bewertung ist
nach Gegenlesen der Helper-Funktion falsch: konsistent ist nur der
Direktchat-Ausschluss für NICHT-Teilnehmer, nicht die Teilnehmer-Schiene.
**Folge:** Kein UI-Weg, aber mit einem gültigen Token trivial (die
Nachrichten-IDs liefert der normale Verlaufs-Abruf). Fix: die
Fremd-Lösch-Schiene zusätzlich an den admin-Typ binden (wie beim
Raum-Löschen chat.js:2163ff) — mit Test für den verbotenen (Konfi/Teamer
löscht fremde) und den erlaubten Fall (Leitung, eigener Raum).

### 5. HOCH: Rolle `admin` ohne Jahrgangs-Zuweisung sieht eine leere Konfi-Liste

**Absicht:** rbac.js:59 ("admin — Konfis, ..."), roles.js:162
(`konfis.full`), und das Muster in `filterByJahrgangAccess`
(rbac.js:331-336: org_admin UND admin sehen org-weit). Handbuch:
`docs/handbuch/45-jahrgaenge.md:173` ("Für die Leitung gilt das alles
nicht: Sie sieht immer die ganze Gemeinde"), `30-leitung.md:13-16`.
**Backend-Ist:** `GET /api/admin/konfis` filtert für ALLE Rollen außer
org_admin/super_admin nach `assigned_jahrgaenge`
(`backend/routes/konfi-management.js:62-69`) — ein admin ohne Zuweisungen
bekommt `[]` (Zeile 68-69). Die Abweichung ist in
`docs/api/konfis-events.yaml:44-48` bereits als solche vermerkt, aber weder
behoben noch im Handbuch erwähnt.
**UI:** Die Konfi-Liste ist für admin und org_admin dieselbe Seite ohne
Hinweis (AdminKonfisPage).
**Folge:** Ein:e frisch angelegte:r Admin ohne angehakte Jahrgänge (die
Zuweisung ist im UserManagementModal optional) sieht einen leeren
Landing-Tab und hält die App für kaputt. Entweder die Route dem
rbac-Muster angleichen oder die Einschränkung zur Entscheidung erklären
und in Handbuch und Benutzer-Anlage sichtbar machen.

### 6. MITTEL: "Konfis ansehen, Punkte vergeben" für Teamer existiert nur im Backend

**Absicht:** roles.js:171-172 (`konfis.view`, `konfis.points`), rbac.js:60.
**Backend:** Konfi-Liste jahrgangsgefiltert (konfi-management.js:56),
Konfi-Detail (:468), Bonuspunkte (:770) und Aktivitäts-Direktvergabe
(activities.js:642) sind alle `requireTeamer`.
**Teamer-UI:** Es gibt keine Konfi-Liste, kein Konfi-Detail, keine
Punktevergabe — der gesamte teamer-Baum enthält keinen einzigen dieser
Aufrufe (einzige Konfi-Bezüge sind die EIGENE Konfi-Historie,
TeamerKonfiStatsPage.tsx). `GET /api/admin/konfis` und
`POST /api/admin/activities/assign-activity` haben frontend-weit keinen
Aufrufer.
**Handbuch:** beschreibt die Funktionen als vorhanden:
`40-punkte.md:65` ("Bonuspunkte dürfen auch Teamer:innen vergeben"),
`40-punkte.md:140` (Direktvergabe "Leitung und Teamer:innen"),
`45-jahrgaenge.md:178-180` (Teamer-Konfi-Liste, "Punkte vergeben").
**Folge:** Dieselbe Klasse wie Befund 1 — zugesicherte und dokumentierte
Teamer-Funktionen ohne jede Oberfläche. Zusammen mit Befund 1 fehlt der
Teamer-Ansicht der komplette Verwaltungs-Teil ihrer Rolle.

### 7. MITTEL: Die "Direktvergabe über die Aktivitäten-Seite" hat keinen UI-Aufrufer — das Handbuch beschreibt sie trotzdem im Detail

`docs/handbuch/40-punkte.md:136-146` stellt zwei Direktvergabe-Wege
gegenüber, inklusive Verhaltenstabelle (Push ja/nein, Level sofort
ja/nein). Der Weg "über die Aktivitäten-Seite" ist
`POST /api/activities/assign-activity` (backend/routes/activities.js:642,
mit Push und Level-Neuberechnung) — **kein Aufruf im gesamten Frontend**
(grep über frontend/src: einzige Direktvergabe ist
`ActivityModal.tsx:135` auf `/admin/konfis/:id/activities`, also der
"Konfi-Verwaltungs"-Weg). Unsicherheit: ob der Weg früher in der
Admin-Aktivitäten-Seite verdrahtet war und beim Umbau verloren ging, wurde
nicht per git-Archäologie geklärt — sicher ist nur, dass die im Handbuch
beschriebene Wahlmöglichkeit heute nicht existiert und damit auch der dort
empfohlene "Weg mit Push" für niemanden erreichbar ist.

### 8. MITTEL: Teamer-Onboarding verspricht "Umfragen erstellen" — UI und Backend verbieten es

Gleiche Klasse wie der Anlass, nur andersherum belegt:
`frontend/src/components/teamer/modals/TeamerOnboardingModal.tsx:43`
("... Bilder teilen und Umfragen erstellen geht ebenfalls."). Die UI zeigt
den Umfrage-Button nur dem admin-Typ
(`frontend/src/components/chat/ChatRoomSections.tsx:74-82`,
`ChatRoom.tsx:1474`), das Backend lehnt Teamer ab
(`backend/routes/chat.js:1734`: "Nur Admins können Umfragen erstellen").
Das Handbuch ist hier korrekt (`90-chat.md:295-296`). Der Onboarding-Satz
gehört korrigiert.

### 9. MITTEL: Handbuch widerspricht sich beim Gruppen-Anlegen selbst

`docs/handbuch/90-chat.md:39`: "Nur die Leitung legt Gruppen an" —
`docs/handbuch/20-teamer.md:34`: "Du kannst Gruppenchats anlegen."
Der Code entscheidet für das Teamer-Kapitel: Backend beschränkt nur Konfis
auf Direktchats (`backend/routes/chat.js:442-450`), die UI bietet Teamern
den Gruppen-Typ an
(`frontend/src/components/chat/modals/SimpleCreateChatModal.tsx:379-393,
419, 487`). `90-chat.md:39` ist falsch und muss dem Teamer-Kapitel folgen
(die Fortsetzung "Nur hier lassen sich später Mitglieder ändern" stimmt
wieder, chat.js:1394).

### 10. MITTEL: Konfi-Stammdaten lassen sich nach dem Anlegen in keiner Ansicht ändern

**Backend:** `PUT /api/admin/konfis/:id` ändert Name und Jahrgang
inklusive Jahrgangs-Chat-Sync (`backend/routes/konfi-management.js:269-299`).
**Admin-UI:** kein Aufrufer — `KonfiModal` kann nur anlegen (kein
Edit-Modus, `frontend/src/components/admin/modals/KonfiModal.tsx:32-59`),
das einzige PUT auf `/admin/konfis/` ist `teamer-since`
(`views/KonfiDetailSections.tsx:1054`); das UserManagementModal schließt
Konfis aus (UserManagementModal.tsx:138-139).
**Handbuch:** `90-chat.md:127-128` ("Bis der Jahrgang gesetzt ist, kommt
keine Teamer:in an ihn heran") setzt voraus, dass die Leitung den Jahrgang
nachträglich setzen KANN.
**Folge:** Tippfehler im Namen oder ein fehlender/falscher Jahrgang sind
nach dem Anlegen nur per API oder Löschen-und-neu-anlegen korrigierbar —
Letzteres vernichtet Punkte und Historie. Der Fall "Konfi ohne Jahrgang
per Einladungscode registriert" bleibt in der UI unheilbar.

### 11. MITTEL: Teamer-Bonuspunkte per API ohne Jahrgangs-Grenze

`POST /api/admin/konfis/:id/bonus-points` prüft für Teamer nur die
Organisation, keinen Jahrgang (`backend/routes/konfi-management.js:770-799`)
— inkonsistent zu `assign-activity`, das den Jahrgang prüft
(activities.js:642ff), und zum Handbuch
(`45-jahrgaenge.md:180`: "abgewiesen mit 'Kein Zugriff auf diesen
Konfi'"). In `docs/api/konfis-events.yaml:62-64` als Lücke vermerkt.
Praktisch nur per API erreichbar, weil die Teamer-UI gar keine
Punktevergabe hat (Befund 6) — wird Befund 6 behoben, wird diese Lücke
sofort real.

### 12. NIEDRIG: Mitgliederliste im Chat — Backend offen, UI nur für Admins, Handbuch verspricht sie Konfis

`GET /api/chat/rooms/:roomId/participants` steht jedem Raum-Teilnehmer
offen (`backend/routes/chat.js:1336, 1344`), aber der Mitglieder-Button
hängt am selben `isAdmin`-Gate wie der Umfrage-Button
(`frontend/src/components/chat/ChatRoomSections.tsx:74-79`) — Konfis und
Teamer sehen in Gruppen NICHT, wer dabei ist. Das Handbuch verspricht es
den Konfis (`docs/handbuch/10-konfis.md:46`: "In Gruppen siehst du, wer
sonst noch dabei ist").

### 13. NIEDRIG: Material-Tags — komplette Backend-Verwaltung ohne jede Oberfläche

`/api/material/tags` bietet CRUD (`backend/routes/material.js:73, 87, 112,
141`), aber weder Admin- noch Teamer-UI kennen Tags (0 Treffer für
`/tags` in `frontend/src/components/`); gefiltert wird über Suche,
Jahrgang und Event (AdminMaterialPage.tsx:218ff). Toter Backend-Code oder
nicht fertig gebaute Funktion — das Handbuch erwähnt Tags nicht.

### 14. NIEDRIG: Teamer-Kapitel verschweigt das Challenge-Löschen

Teamer können Challenges (ihrer Jahrgänge) löschen — UI
`frontend/src/components/teamer/pages/TeamerChallengesPage.tsx:150` mit
`hooks/useChallengeDelete.ts:26`, Backend `challenges.js:1408` mit
`leadershipMayAccess`. `docs/handbuch/20-teamer.md:76-78` zählt nur
"anlegen und bearbeiten", freigeben, anonymisieren, ausblenden, mitmachen
auf. `80-challenges.md:123` ("Wer verwaltet sie") deckt es nur implizit.

### 15. NIEDRIG: Teamer-Datenzugriff per API breiter als die Jahrgangs-Grenze (bereits dokumentiert)

`GET /api/admin/konfis/:id` (und `/event-points`, `/badges`) liefert
Teamern das volle Profil JEDES Konfis der Org ohne Jahrgangs-Check
(`backend/routes/konfi-management.js:468, 657, 680`) — in
`docs/api/konfis-events.yaml:56-61` als Lücke vermerkt. Kein UI-Weg
(Befund 6), daher hier nur als offener Altbefund gelistet, der bei einer
Teamer-Konfi-Ansicht mitgefixt werden muss.

### 16. NIEDRIG: Benutzerseite per Deep-Link für Admins erreichbar, Aktionen laufen in 403

Die Route `/admin/users` ist ungegatet (`MainTabs.tsx:239`), der
UI-Einstieg aber org_admin-exklusiv (`AdminSettingsPage.tsx:292`). Ein
admin, der die URL kennt, sieht Lösch-Swipes ohne Rollen-Gate (nur
`can_edit !== false`, `frontend/src/components/admin/UsersView.tsx:302-310`)
und läuft in
`requireOrgAdmin`-403s (users.js:385). Kosmetisch, solange Befund 2 den
regulären Weg betrifft.

---

## Priorisierung

**Sicherheitsrelevant, vor dem nächsten Release:**
- Befund 4 (fremde Nachrichten löschbar für jeden Raum-Teilnehmer) — mit
  Tests für verbotenen und erlaubten Fall.

**Nutzer:innen laufen heute in Fehler oder Leere:**
- Befund 2 (admin legt Teamer an → 403)
- Befund 3 (admin vergibt Zertifikate → 403)
- Befund 5 (admin ohne Zuweisung: leere Konfi-Liste)
- Befund 10 (Konfi-Name/Jahrgang nachträglich nicht änderbar)

**Entscheidung nötig, dann Umsetzung in UI + Handbuch gemeinsam:**
- Befunde 1, 6, 7 (Teamer-Verwaltungsfunktionen: umsetzen oder Absicht,
  roles.js-Liste und Handbuch auf den Ist-Zustand zurückschneiden)

**Doku-Korrekturen ohne Codeänderung:**
- Befunde 8, 9, 12, 14 sowie der veraltete Einführungs-Hinweis in
  20-teamer.md:58-59.
