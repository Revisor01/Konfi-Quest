# Dashboard/Profil-Durchgang: Nachholung des ausgefallenen Volldurchgangs

Auftrag: Den im Bericht `2026-08-26-drei-ansichten-luecken.md` (Teil 4) als
ausgefallen ausgewiesenen Dashboard/Profil-Volldurchgang nachholen — Onboarding-
und Update-Walkthrough-Modale je Rolle, Wrapped im Profil, Abschnittsreihenfolge
(dashboard_section_order vs. teamer_dashboard_section_order), Neuerungen-Banner,
Verhalten von Konto-Löschen und Medien-Cache, Zeilenvergleich der Modal-Paare
ChangeEmail/ChangePassword, sowie der im Vorbericht ausgenommene Chat-Baum
(rollenspezifische Weichen).

Stand: 26.08.2026, Code-Stand `5d78112` (main).

**Urteil in einem Satz:** Dashboard-Reihenfolgen, Konto-Löschen, Medien-Cache
und die Modal-Paare sind über alle drei Rollen sauber und deckungsgleich gelöst
— aber der Chat-Baum hat ein echtes Berechtigungsloch (jeder Raum-Teilnehmer
kann fremde Nachrichten per API löschen), und die Erklär-Modale versprechen
Teamer:innen zweimal Funktionen, die UI und Backend ihnen verbieten
(Umfragen erstellen, Aktivitäten bestätigen).

Prüftiefe: Alle Befunde mit **[V]** habe ich selbst am Code nachvollzogen
(Datei geöffnet, Stelle gelesen, bei Berechtigungen Frontend UND Backend).
Vermutungen sind ausdrücklich als unsicher markiert. Frontend-Pfade relativ zu
`frontend/src/`, Backend relativ zu `backend/`.

---

## Teil 1: Überblick — wie die Bausteine je Rolle verdrahtet sind

| Baustein | admin (Leitung) | teamer | konfi | Einschätzung |
|---|---|---|---|---|
| Onboarding-Tour | `AdminOnboardingModal` (11 Slides, nutzt shared/OnboardingTour) | `TeamerOnboardingModal` (8 Slides, shared) | `KonfiOnboardingModal` (7 Slides, EIGENE Vollkopie des Swipers) | Struktur: DN2; Inhalt: DM1 |
| Update-Walkthrough 2.0 | 3 Slides | 3 Slides | 4 Slides (+ Wrapped) | konsistent, Texte je Rolle korrekt |
| Steuerung | `useOnboardingWithUpdateOnce` auf der jeweiligen Startseite (AdminKonfisPage / TeamerDashboardPage / KonfiDashboardPage), ein Flag-System für alle Rollen (`hooks/useOnboardingOnce.ts`) | dito | dito | konsistent |
| Neuerungs-Karten Startseite | NUR "Was ist neu?" (UpdateHinweisKarte) | beide Karten (NeuerungenBanner) | beide Karten | DN1 |
| Neuerungs-Banner dauerhaft | unter "Mehr" (AdminSettingsPage) | im Profil | im Profil | legitime Platzierung |
| Mitmachen-Erklärung | `MitmachenErklaerungModal rolle="admin"` | `rolle="teamer"` | `rolle="konfi"` | rolle-Prop überall korrekt; Teamer-Text falsch (DM2) |
| Wrapped im Profil | keines | "Meine Wrappeds" (`/wrapped/history/:id`, geteiltes WrappedModal) | strukturell identisch gespiegelt | legitim (Admins haben kein Wrapped); Historie-Gate: DN8 |
| Abschnittsreihenfolge | verwaltet beide Listen (AdminDashboardSettingsPage) | rendert `teamer_dashboard_section_order` | rendert `dashboard_section_order` | deckungsgleich (Teil 3), nur DN4 |
| Konto löschen | shared/DeleteAccountModal + eine Route | dito | dito | identisch [V] |
| Medien-Cache | hooks/useMediaCacheControl | dito | dito | identisch [V] |
| ChangeEmail/ChangePassword | eigene Kopien (admin/modals) | importiert die Konfi-Kopien | eigene Kopien (konfi/modals) | funktional identisch, nur Styling-Props (DN3) |
| Chat | ein gemeinsamer Baum (`components/chat/`) mit Weichen auf `user.type`/`role_name` | dito | dito | ein HOCH-Befund (DH1), mehrere kleine Weichen-Risse |

---

## Teil 2: Befunde

### Schwere HOCH

**DH1 — Chat: Jeder Raum-Teilnehmer kann FREMDE Nachrichten per API löschen — der Code widerspricht seinem eigenen Kommentar.** [V]
`DELETE /chat/messages/:messageId` kommentiert „Eigene Nachricht: immer.
Fremde Nachricht: nur Leitung/Admins" und prüft dann:
`canDelete = eigene || await darfRaumOeffnen(message.room_id, req.user)`
(routes/chat.js:2117-2121). `darfRaumOeffnen` liefert aber für JEDEN
Teilnehmer des Raums true (routes/chat.js:280-284; der Leitung-Zweig kommt
erst danach, Zeile 287). Damit kann ein Konfi im Jahrgangs-Chat jede
Nachricht — auch die der Leitung oder anderer Konfis — per direktem
API-Aufruf soft-löschen; das `messageDeleted`-Event wird an alle im Raum
gebroadcastet (routes/chat.js:2131-2136). Die UI verdeckt das nur: Der
Löschen-Button ist für Konfis ganz und für Teamer:innen bei fremden
Nachrichten ausgeblendet, ausdrücklich als bewusste Entscheidung kommentiert
(`components/chat/MessageBubble.tsx:749-757`). Frontend-Regel und
Backend-Regel behaupten dasselbe und implementieren Verschiedenes — die
strengere Regel existiert nur in der UI. Fix-Skizze: fremde Nachricht
zusätzlich an `user.type === 'admin'` binden (wie es der Kommentar und
MessageBubble beschreiben).

### Schwere MITTEL

**DM1 — Teamer-Onboarding verspricht „Umfragen erstellen" — UI und Backend verbieten es.** [V]
Chat-Slide der Teamer-Tour: „Bilder teilen und Umfragen erstellen geht
ebenfalls" (`components/teamer/modals/TeamerOnboardingModal.tsx:43`).
Tatsächlich: Der Umfrage-Button hängt an `isAdmin={user?.type === 'admin'}`
(`components/chat/ChatRoom.tsx:1512`,
`components/chat/ChatRoomSections.tsx:79-88`), und das Backend antwortet
allen außer type 'admin' mit 403 „Nur Admins können Umfragen erstellen"
(routes/chat.js:1732-1734; Teamer haben type 'teamer',
routes/auth.js:63-64). Der wortgleiche Satz in der Admin-Tour
(`AdminOnboardingModal.tsx:43`) stimmt dagegen. Das ist der im Vorbericht
angekündigte Fall — bestätigt. Entweder Text kürzen oder Teamer:innen
Umfragen erlauben; Stand heute lernt jede neue Teamer:in etwas Falsches.

**DM2 — Mitmachen-Erklärung verspricht Teamer:innen das Bestätigen von Konfi-Aktivitäten — das dürfen nur Admins.** [V]
`slidesFuer('teamer')` liefert den Team-Slide „Aktivitäten: bestätigen":
„Unter ‚Aktivitäten' landen die Meldungen der Konfis … Du siehst sie mit
Datum und Foto und bestätigst oder lehnst ab"
(`components/shared/MitmachenErklaerungModal.tsx:46-57`). Aufgerufen wird er
mit `rolle="teamer"` von Startseite und Profil
(`TeamerDashboardPage.tsx:1197-1199`, `TeamerProfilePage.tsx:655-657`) —
dauerhaft erreichbar über den grünen Banner. Tatsächlich ist die Moderation
`requireAdmin` (routes/activities.js:473 für `PUT /requests/:id`, auch die
Liste routes/activities.js:323; requireAdmin = org_admin/admin,
middleware/rbac.js:273). Der Teamer-Aktivitäten-Reiter zeigt die EIGENEN
Einsätze, die die Leitung bestätigt — genau andersherum als der Slide
behauptet (so steht es richtig in der Teamer-Onboarding-Tour,
`TeamerOnboardingModal.tsx:57`). Für `rolle="teamer"` braucht es einen
eigenen Text; der Team-Slide passt nur für `rolle="admin"`. Nebenbefund im
selben Modal: Der Events-Slide (`MitmachenErklaerungModal.tsx:34`) spricht
auch Admins mit „Du meldest dich vorher an … kommst auf die Warteliste" an,
obwohl der Admin-Mitmachen-Tab eine Verwaltungsansicht ist, und erwähnt
Pflichttermine (Konfi-Konzept) auch gegenüber dem Team — Textkosmetik,
gleiche Ursache: ein Basis-Slide für drei Rollen.

### Schwere NIEDRIG / strukturell

**DN1 — Admin-Startseite zeigt nur eine der beiden Neuerungs-Karten; das Mitmachen-Flag bleibt für Bestands-Admins ewig ungesetzt.** [V]
Konfi- und Teamer-Startseite rendern beide Karten über NeuerungenBanner
(`KonfiDashboardPage.tsx:370-378`, `TeamerDashboardPage.tsx:532-539`).
AdminKonfisPage destrukturiert nur den Update-Teil des Hooks
(`AdminKonfisPage.tsx:84-88`) und rendert allein die UpdateHinweisKarte
(`AdminKonfisPage.tsx:384-390`) — die grüne Mitmachen-Karte erscheint für
Bestands-Admins nie, `markMitmachenHinweisGesehen` wird nie aufgerufen.
Abgefedert: Der Admin-Update-Walkthrough enthält selbst einen
Mitmachen-Slide, und unter „Mehr" stehen beide Banner dauerhaft
(`AdminSettingsPage.tsx:216-220`). Trotzdem eine stille Asymmetrie im
Ein-Flag-System, das laut Hook-Kommentar rollenübergreifend gleich gedacht
ist (`hooks/useOnboardingOnce.ts:5-8`).

**DN2 — KonfiOnboardingModal ist eine 279-Zeilen-Vollkopie der geteilten OnboardingTour.** [V]
Admin- und Teamer-Tour rendern über `shared/OnboardingTour.tsx`; die
Konfi-Tour hat einen eigenen, aktuell deckungsgleichen Swiper samt
ROSE_POSITIONS/BUBBLE_SETS (`KonfiOnboardingModal.tsx:88-279`). Der
OnboardingTour-Kommentar sagt selbst „Stil identisch zur ursprünglichen
Konfi-Tour" (`shared/OnboardingTour.tsx:66-68`) — die Quelle wurde beim
Extrahieren nicht umgestellt. Heute kein sichtbarer Unterschied, aber exakt
die Kopier-Konstellation, die im Vorbericht (M4, N7) nachweislich driftet.

**DN3 — Modal-Paare ChangeEmail/ChangePassword: KEINE funktionale Drift — Entwarnung zum offenen Punkt des Vorberichts.** [V]
Zeilenvergleich per diff: Die Paare `admin/modals/` vs. `konfi/modals/`
unterscheiden sich ausschließlich in Styling-Props
(sectionIconClass/submitBtnClass/infoBoxClass mit Defaults,
`konfi/modals/ChangeEmailModal.tsx:35-46`,
`konfi/modals/ChangePasswordModal.tsx:41-75`) und Attributreihenfolge;
Validierung, Endpunkte (`/auth/update-email`: admin:76/konfi:82;
`/auth/change-password`: admin:123/konfi:130), Fehlerbehandlung und
Offline-Sperre sind identisch. Die Teamer-Seite importiert bewusst die
parametrisierbaren Konfi-Kopien (`TeamerProfilePage.tsx:51-52`). Das
Driftrisiko zweier Kopien bleibt; die Admin-Kopie ließe sich durch die
Konfi-Variante mit Props ersetzen. (Die Kontext-Aktualisierung nach
E-Mail-Änderung divergiert weiterhin je AUFRUFER — Konfi lädt den User-Context
nicht neu — das ist Befund M9 des Vorberichts, Admin-Seite hier gegengeprüft:
sie aktualisiert Context und tokenStore, `AdminProfilePage.tsx:58-73`.)

**DN4 — Veraltete Fallback-Reihenfolgen im Settings-Endpunkt.** [V]
`GET /settings` fällt bei kaputtem JSON auf hartcodierte Listen OHNE
'challenges' und 'konfispruch' zurück (routes/settings.js:83-84) — die
gepflegten Defaults stehen in `utils/sectionOrder.ts:11-29`. Praktisch
folgenlos, weil alle Verbraucher clientseitig mergen
(`mergeSectionOrder`, KonfiDashboardPage:320-323, TeamerDashboardPage:595,
AdminDashboardSettingsPage:159-160) und der Fallback nur bei defektem
Speicherstand greift; als dritte, veraltete Kopie derselben Liste trotzdem
eine Falle.

**DN5 — Chat: super_admin fällt zwischen die Weichen.** [V]
Drei Gates, drei Definitionen von „Leitung":
- „Team-Chat leeren": Frontend zeigt den Mülleimer für
  admin/org_admin/super_admin (`ChatRoom.tsx:1395-1396,1523`), das Backend
  lehnt super_admin ab (routes/chat.js:2294) — Klick endet im 403.
- Nachricht löschen: MessageBubble erlaubt nur `['admin','org_admin']`
  (`MessageBubble.tsx:754-756`) — ein super_admin sieht den Button nicht
  einmal bei eigenen Nachrichten, obwohl das Backend eigene immer erlaubt
  (routes/chat.js:2120).
- Export: Frontend und Backend einig inklusive super_admin
  (routes/chat.js:1200-1204).
Kleine Nutzergruppe, aber dieselbe Rolle wird an vergleichbaren Stellen
dreimal unterschiedlich behandelt.

**DN6 — Admin-Onboarding verspricht jedem type-admin die volle Verwaltung.** [V]
Der „Mehr"-Slide zählt „… Material und Benutzer" auf
(`AdminOnboardingModal.tsx:71`). Die Benutzer-Verwaltung sieht aber nur
org_admin/super_admin (`AdminSettingsPage.tsx:292` Block „Verwaltung",
`/admin/users`-Eintrag Zeile 305); eine Person mit Rolle 'admin' bekommt
dieselbe Tour und findet den Punkt nicht. Umgekehrt bekommt auch ein
super_admin die Tour, sieht aber den kompletten „Inhalt"-Block nicht
(`AdminSettingsPage.tsx:363`). Eine Tour für drei Admin-Spielarten.

**DN7 — has_wrapped: Konfi prüft nur die Freigabe, Teamer nur die Snapshot-Existenz.** [V]
Konfi-Dashboard-Karte erscheint, sobald der Jahrgang freigegeben ist —
ohne zu prüfen, ob für DIESEN Konfi ein Snapshot existiert
(routes/konfi.js:167-173); die Teamer-Karte prüft genau umgekehrt nur die
Snapshot-Existenz (routes/teamer.js:954-962, für Teamer gibt es keine
Freigabe — das ist konsistent). Ein nach der Generierungsrunde
hinzugekommener Konfi in einem freigegebenen Jahrgang sähe die Karte,
hinter der kein Snapshot liegt. Unsicher, ob dieser Fall in Produktion
vorkommt (erneutes Generieren erfasst ihn wieder).

**DN8 — Wrapped-Historie im Profil prüft die Freigabe nicht — praktisch derzeit entschärft.** [V]
`GET /wrapped/history/:userId` liefert alle eigenen Snapshots ohne Blick auf
`wrapped_released_at` (routes/wrapped.js:674-682); Konfi- und Teamer-Profil
rendern daraus „Meine Wrappeds" (`konfi/views/ProfileView.tsx:215-243,
561-590`, `TeamerProfilePage.tsx:181-208,560-590` — strukturell sauber
gespiegelt, gleiche Labels, geteiltes WrappedModal). Dass daraus heute kein
Vorab-Leak wird, liegt an der Kopplung: Jede Generierung setzt die Freigabe
im selben Zug (routes/wrapped.js:508-511, 718-721), und der Entzug löscht
die Snapshots mit (routes/wrapped.js:608-649). Die Absicherung ist also
implizit — wer je „generieren ohne freigeben" baut, öffnet gleichzeitig
`/wrapped/me` (Vorbericht M7) und diese Profil-Historie.

**DN9 — Event-Chat verlassen: nur Konfis sind an die Event-Teilnahme gekoppelt.** [V für den Code, unsicher in der Bewertung]
Backend und Frontend verbieten übereinstimmend nur KONFIS das direkte
Verlassen von Event-Chats (routes/chat.js:1523-1527,
`ChatRoom.tsx:1385-1390`); eine gebuchte Teamerin kann den Event-Chat
verlassen und bleibt am Termin angemeldet. Kommentiert ist nur der
Konfi-Fall — ob die Teamer-Ausnahme Absicht ist, ist nirgends festgehalten.

**DN10 — Mitgliederliste im Chat: UI nur für die Leitung, API für alle Teilnehmer offen.** [V]
Der „Mitglieder anzeigen"-Button hängt am selben `isAdmin`-Gate wie der
Umfrage-Button (`ChatRoomSections.tsx:79-84`, `ChatRoom.tsx:1512`);
`GET /chat/rooms/:roomId/participants` erlaubt aber jedem Raum-Teilnehmer
das Lesen (routes/chat.js:1336-1346). Harmlose Richtung (nur lesend), aber
Teamer:innen und Konfis können in Gruppenchats regulär nicht sehen, wer
mitliest — unsicher, ob bewusst.

---

## Teil 3: Legitime Unterschiede (geprüft, KEIN Handlungsbedarf)

- **Abschnittsreihenfolge verhält sich je Rolle GLEICH.** Beide Listen
  (`dashboard_section_order`, `teamer_dashboard_section_order`) laufen über
  dieselbe Settings-Route mit identischem Speicher- und Parse-Pfad
  (routes/settings.js:159-169, 89-92), dieselbe Merge-Logik für neue
  Sektionen (`utils/sectionOrder.ts`, von allen drei Verbrauchern importiert)
  und dieselbe Editor-Seite mit identischem Offline-/Optimistic-Verhalten
  für beide Segmente (`AdminDashboardSettingsPage.tsx:112-129, 166-205`).
  Rollenspezifische Sektionen sind konsistent: konfirmation/ranking nur
  Konfi, zertifikate nur Teamer, alle Toggle-Keys in Editor, Backend-
  Validierung (routes/settings.js:13-27) und Dashboards deckungsgleich.
  Auch der Konfispruch-Schalter wirkt für Konfis korrekt serverseitig
  (routes/konfi.js:316-317) und für Teamer clientseitig
  (`TeamerDashboardPage.tsx:812`) — Teamer haben keinen Jahrgang, daher
  ohne konfspruch_enabled-Bindung (wie im Vorbericht als legitim vermerkt).
- **Konto löschen ist über alle drei Rollen identisch:** ein geteiltes Modal
  (`shared/DeleteAccountModal.tsx`), eine Route für alle Rollen mit
  Passwort-Pflicht und Letzter-org_admin-Schutz (routes/auth.js:328-368),
  in allen drei Profilen gleich verdrahtet (`AdminProfilePage.tsx:112-120`,
  `TeamerProfilePage.tsx:177-179,625`, `konfi/views/ProfileView.tsx:345-348,
  858`).
- **Medien-Cache-Steuerung ist identisch:** ein geteilter Hook
  (`hooks/useMediaCacheControl.ts`) mit Größenanzeige und Bestätigungs-Alert,
  in allen drei Profilen gleich eingebunden (admin:48/324/349,
  teamer:96/461/475, konfi:214/816/826).
- **Update-Walkthrough-Texte stimmen je Rolle:** Der Teamer-Walkthrough
  verspricht Anlegen, Freigeben, Anonymisieren, Ausblenden von Challenges —
  alles requireTeamer-gedeckt (routes/challenges.js:1136, 1527-1529, 1470,
  1665-1667); der Konfi-Walkthrough (inkl. Wrapped-Slide) und der
  Admin-Walkthrough passen zu den jeweiligen Fähigkeiten.
- **Onboarding-/Banner-Steuerung ist ein System für alle:** derselbe Hook,
  dieselben Flag-Schlüssel mit Versions-Präfix, Erstnutzer sehen die Tour
  statt der Karten, Wiedereinstieg je Rolle dauerhaft möglich (Konfi/Teamer
  im Profil, Admin unter „Mehr" — bewusste Platzierung, Admins haben dort
  ihre Einstellungs-Heimat).
- **Wrapped: Admin-Profil ohne „Meine Wrappeds"** — Admins bekommen kein
  eigenes Wrapped generiert; die fehlende Ansicht fremder Konfi-Wrappeds ist
  Befund N5 des Vorberichts, kein neuer.
- **Chat-Erstellung:** Konfis dürfen nur Direktchats zum Team anlegen — UI
  und Backend deckungsgleich (`SimpleCreateChatModal.tsx:120-140,355-362`,
  routes/chat.js:441-450). Team-Reiter der Übersicht für Teamer:innen
  sichtbar (`ChatOverview.tsx:85-89`, dort als behobener früherer Fehler
  kommentiert). Raum löschen/Teilnehmer entfernen nur Leitung — UI und
  Backend einig (`ChatOverview.tsx:518`, routes/chat.js:2163-2171,
  1453-1462). Verlassen-Regeln (Admins nie, jahrgang/direct nie) in
  `canLeaveChat` und Backend deckungsgleich (`ChatRoom.tsx:1380-1391`,
  routes/chat.js:1506-1520).

---

## Teil 4: Nicht geprüft (ehrliche Lücken dieses Durchgangs)

- **Chat-Backend nicht vollständig:** Geprüft habe ich Erstellen, Nachricht
  löschen, Raum löschen, Team-Chat leeren, Verlassen, Teilnehmer
  entfernen/lesen, Export und Umfrage-Erstellung. NICHT geprüft: Reaktionen,
  Lesebestätigungen/Unread-Zählung, Datei-Zugriff (`/chat/files/:filename`),
  Chat-Push-Benachrichtigungen und die Socket-Pfade jenseits von
  `darfRaumBetreten`.
- **Wrapped-INHALTE (Slides) nicht inhaltlich verglichen** — WrappedModal ist
  eine geteilte Komponente mit wrappedType-Prop; ob die Slide-Inhalte für
  'konfi' und 'teamer' jeweils fachlich stimmen, habe ich nicht geprüft.
- **Onboarding-Verhalten bei Mehr-Organisationen-Konten** (super_admin/
  org_admin mit Org-Wechsel): Die Flags hängen an der userId, nicht an der
  Organisation — ob das gewollt ist, nicht untersucht.
- **Kein Laufzeit-Test:** alle Befunde sind Code-Lektüre; insbesondere DH1
  habe ich nicht gegen eine laufende Instanz gemessen (die Code-Lage ist
  aber eindeutig: der Teilnehmer-Zweig von darfRaumOeffnen kommt vor dem
  Leitungs-Zweig und kennt keine Nachrichten-Eigentümerschaft).
- **AdminMetricsPage, AdminInvitePage, OrgSwitcher** und weitere reine
  Admin-Seiten ohne Pendant in anderen Bäumen: nur auf Auftragsrelevanz
  gesichtet, nicht analysiert.

---

## Anhang: Muster-Erkenntnis

Der Vorbericht-Befund bestätigt sich auch hier: Überall, wo GETEILT wird
(OnboardingTour, NeuerungenBanner, MitmachenErklaerungModal-Gerüst,
DeleteAccountModal, useMediaCacheControl, sectionOrder.ts, WrappedModal),
sind die drei Rollen deckungsgleich. Die neuen Risse liegen (a) in
rollenspezifischen TEXTEN geteilter/paralleler Erklär-Modale, die
Fähigkeiten versprechen, die die Rolle nicht hat (DM1, DM2, DN6) — Texte
driften genauso wie Code —, und (b) im Chat, wo dieselbe Regel („wer darf
löschen?") in UI und Backend unabhängig implementiert ist und das Backend
die laxere Variante hat (DH1). Erklär-Texte gehören deshalb wie Code
behandelt: Wer eine Berechtigung ändert, muss die Slides aller drei Rollen
mitlesen — der bestehende Textbaustein-Test (onboardingSlides.test.ts)
prüft bislang nur die Mitmachen-Benennung, nicht solche Versprechen.
