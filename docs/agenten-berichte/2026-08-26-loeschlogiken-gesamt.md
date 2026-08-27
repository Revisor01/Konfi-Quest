# Löschlogiken: Gesamtprüfung aller Bereiche (außer Chat)

> **ERLEDIGT am 26.08.2026 durch die PRs #72–#78.** Der Kopfvermerk fehlte
> bisher (Registerregel 4) und wurde am 27.08. nachgetragen. Im Register stand
> zusätzlich „zwei Punkte bewusst offen" — welche das sein sollten, liess sich
> weder hier noch in `BAUSTELLEN.md` belegen (dort stehen alle drei Aufträge
> aus diesem Bericht als erledigt). Die Angabe ist deshalb gestrichen.

**Auftrag:** Alle Löschlogiken der App evaluieren — Personen, Termine,
Aktivitäten/Anträge, Challenges, Stammdaten (Abzeichen, Kategorien, Level,
Jahrgänge, Material, Rollen), Organisationen, Dateien auf der Platte,
Fremdschlüssel, Aufräumjobs. Chat ausgenommen (eigener Prüfauftrag); Stellen,
an denen andere Löschungen Chats mitreißen, sind nur benannt. Analyse, kein
Umbau.
**Datum:** 26.08.2026
**Geprüfter Commit:** `109d4e0` (main)
**Urteil in einem Satz:** Die Löschpfade sind einzeln erstaunlich sorgfältig
gebaut (Transaktionen, 409-Blockaden, Org-Scope, Bestätigungsdialoge fast
überall), aber die Absicherung beruht auf handgepflegten Löschlisten statt auf
FK-Regeln — und genau dort stecken die vier gravierenden Lücken: der
`invite_codes`-Fremdschlüssel blockiert drei Löschpfade mit 500ern (inklusive
der kompletten Org-Löschung), der letzte Org-Admin kann sich selbst löschen
und hinterlässt eine führungslose Organisation, das Löschen eines Events lässt
vergebene Punkte ohne Herkunftsbeleg im Profil stehen, und Chat- wie
Material-Dateien überleben die Org-Löschung dauerhaft auf der Platte
(DSGVO Art. 17).

**Hinweis zur Beleglage:** Schema-Aussagen stützen sich auf
`backend/tests/schema/prod-schema.sql` (pg_dump der Produktion, am 24.08.2026
als deckungsgleich nachgemessen). Gegen die laufende Produktions-DB wurde
nichts gemessen — als UNSICHER markierte Befunde sind Code-belegte
Möglichkeiten, deren Eintreten von den Produktionsdaten abhängt.

---

## Antworten auf die Leitfragen

**Ist Gelöschtes bei allen weg oder nur ausgeblendet?**
Fast alles ist hartes DELETE. Nur zwei Soft-Mechanismen existieren:
(1) Konfi-Soft-Delete durch den Auto-Deletion-Cron (Tag 60–120 nach
Konfirmation, `users.deleted_at`/`archived_at`, Migration 082) — der Konfi ist
dann ausgeblendet, alle Daten inkl. Fotos bleiben. (2) Challenge-Beiträge
werden nie gelöscht, sondern nur verborgen (`moderation_status='hidden'`,
challenges.js:1584-1590) — für die Gruppe unsichtbar, für die einreichende
Person und die Leitung weiter sichtbar, die Datei bleibt auf der Platte.
Event-Absage (`cancelled=TRUE`, events.js:3104) ist ein Zustandswechsel, keine
Löschung — Buchungen, Punkte und Chat bleiben vollständig erhalten.

**Reißt eine Löschung Unerwartetes mit?**
Ja, an fünf Stellen: Badge-Löschung entfernt rückwirkend alle verliehenen
Abzeichen (badges.js:855), ohne dass der Dialog es sagt. Jahrgang-Löschung
kaskadiert still auf Einladungscodes, Challenge-Zielgruppen (danach ggf.
verwaiste Challenge ohne Publikum), Event- und Teamer-Zuordnungen. Das
Verbergen eines Challenge-Beitrags entzieht ggf. still das daraus abgeleitete
Abzeichen. Event-Löschung nimmt den Event-Chat samt Dateien mit (events.js:
1512-1549) — der Server-Warnhinweis dazu erreicht nie jemanden, weil das
Frontend immer `force=true` sendet. Jahrgang-Löschung mit force nimmt den
Jahrgangs-Chat mit (jahrgaenge.js:250-286; Vertiefung beim Chat-Agenten).

**Bleiben verwaiste Daten zurück?**
In der DB kaum (die FK-CASCADEs und Purge-Listen greifen weitgehend); auf der
**Platte massiv**: Chat- und Material-Dateien überleben die Org-Löschung,
Teamer-Antragsfotos überleben das Löschen des Antrags, Fotos genehmigter
Anträge werden nie gelöscht, und der einzige Waisen-Finder
(`scripts/cleanupOrphanPhotos.js`) läuft nur manuell und kennt
`uploads/challenges/` gar nicht. Die Uploads liegen auf einem persistenten
Bind-Mount (`/opt/Konfi-Quest/uploads`, deploy/compose.konfi_quest.yml:70-71)
— Waisen bleiben für immer.

**Kann man löschen, was man laut Rolle nicht dürfte?**
Eine echte Abweichung: einfache Teamer dürfen per API jedes Event der Org
unwiderruflich löschen (events.js:1428 mit `requireTeamer`), obwohl die
Teamer-Oberfläche das gar nicht anbietet. Sonst ist die Rechteabgrenzung
konsequent (Konfis: nur eigene offene Anträge und eigene Buchungen; Teamer:
zusätzlich eigene Anträge und Challenge-Löschung nur bei zugewiesenem
Jahrgang; Org-Löschung nur super_admin). Org-Scope ist überall geprüft, wo
gestichprobt wurde.

---

## Übersichtstabelle

| Was wird gelöscht | Wer darf | Hart/Soft | Was hängt dran | Befund |
|---|---|---|---|---|
| Konfi (durch Leitung) | org_admin, admin (konfi-management.js:394) | Hart, `deleteKonfiCascade` | 16 Tabellen + Fotos/Challenge-Dateien von der Platte; Urheberfelder anonymisiert | Sauber; aber soft-gelöschte Konfis sind manuell NICHT löschbar (404) |
| Teamer/Admin (User-Verwaltung) | nur org_admin, Hierarchie-Check (users.js:385) | Hart, **eigene** Inline-Kaskade | wie oben, plus Aufräumen verwaister Direct-Chats | Kaskade weicht von konfiDeletion ab (`chat_message_reactions` fehlt → 500er-Kandidat); Last-Admin-Check ohne Sperre |
| Eigenes Konto | alle Rollen, mit Passwort (auth.js:328) | Hart, `deleteKonfiCascade` | wie Konfi | **Kein Schutz für letzten Org-Admin** |
| Konfi (Auto-Delete) | Cron 02:00 (backgroundService.js:734, 1043) | Tag 60: Soft (`deleted_at`), Tag 120: Hart | wie Konfi; Vorwarnung Tag 53 an Admins | Solide gebaut und gut getestet |
| Event | org_admin, admin, **teamer** (events.js:1428) | Hart | Buchungen, Slots, Punkte-Zeilen, Chat samt Dateien, Erinnerungen (CASCADE); Push an Konfis | **Punktestände werden nicht zurückgerechnet**; Guards durch `force=true` tot |
| Event absagen | dito (events.js:3075) | Soft (`cancelled`) | nichts — alles bleibt | Punkte/Buchungen bewusst unangetastet; Absage-Begründung erreicht niemanden |
| Eigene Event-Buchung | Konfi (konfi.js:1709) bzw. alle (events.js:1850) | Hart | Warteliste rückt nach, Chat-Austrag, Punkte-Rücknahme nur in events.js-Variante | 2-Tage-Frist und Pflicht-Guard über events.js:1850 umgehbar |
| Aktivitäts-Vorlage | org_admin, admin (activities.js:220) | Hart | 409 bei Verbuchungen/offenen Anträgen; abgelehnte Anträge samt Fotos mit weg | Vorbildlich |
| Verbuchte Aktivität / Bonus | org_admin, admin (konfi-management.js:972, 849) | Hart | Punkte per `GREATEST(0,…)` zurückgerechnet | **Abzeichen bleiben trotz Punktentzug**; kein Level-Downgrade (heilt sich verzögert) |
| Antrag | Konfi/Teamer nur eigene `pending`; Admin nur `rejected` (konfi.js:936, teamer.js:1453, activities.js:357) | Hart | Foto von der Platte — außer im Teamer-Pfad | **Teamer-Pfad lässt Foto verwaisen**; Genehmigtes nur per Reset (heuristische Zuordnung) |
| Challenge | Leitung; Teamer nur bei zugewiesenem Jahrgang (challenges.js:1408) | Hart, 409 ohne `force` bei gestarteter Challenge | Beiträge (CASCADE) + Mediendateien von der Platte; Abzeichen verschwinden (abgeleitet) | Sauber; DB-Delete und Dateilöschung nicht atomar |
| Challenge-Beitrag | niemand (403 auch für den Konfi, challenges.js:831) — nur Verbergen | Soft (`hidden`) | ggf. stiller Abzeichen-Entzug | Kein Weg, eine einzelne rechtswidrige Datei zu tilgen |
| Abzeichen | org_admin, admin (badges.js:850) | Hart | verliehene `user_badges` explizit mit weg | Dialog verschweigt den rückwirkenden Verlust |
| Kategorie | org_admin, admin (categories.js:97) | Hart | 409 bei Verwendung | Sauber |
| Level | org_admin, admin (levels.js:164) | Hart | 409 bei Verwendung — **aber soft-gelöschte Konfis übersehen → 500** | Einziger reproduzierbarer 500er im Stammdaten-Bereich |
| Jahrgang | org_admin, admin, `force` ohne Extra-Rolle (jahrgaenge.js:202) | Hart | 409 bei aktiven Konfis; Chat, Codes, Challenge-/Event-/Teamer-Zuordnungen kaskadieren still | Dialog nennt nur einen Bruchteil der Folgen |
| Material / Datei / Tag | org_admin, admin (material.js:557, 736, 141) | Hart | Dateien von der Platte (nicht atomar); Tag-Löschung ohne Prüfung und ohne UI | OK; Tag-Route nur per API erreichbar |
| Rolle | niemand — keine DELETE-Route (roles.js) | — | — | Rollen sind hartkodiert; FKs nur über Org-Purge scharf |
| Einladungscode | org_admin (auth.js:737) | Hart | **FK von konfi_profiles ohne Regel → 500 bei benutztem Code** | Kernbefund 1 |
| Organisation | nur super_admin (organizations.js:636) | Hart, 13-Block-Purge in einer Transaktion | alles — außer Chat-/Material-Dateien auf der Platte | **invite_codes vor konfi_profiles → 500**; notifications über falschen Schlüssel; keine zweite Sicherung |

---

## Einzelbefunde nach Schwere

### KRITISCH

**K1 — `konfi_profiles.invite_code_id` ohne ON DELETE blockiert drei
Löschpfade mit 500ern.**
Der FK `konfi_profiles_invite_code_id_fkey` hat keine ON-DELETE-Regel
(prod-schema.sql:4536, NO ACTION), und jede Selbstregistrierung setzt die
Spalte (auth.js:910-912). Kein Codepfad nullt sie je. Damit scheitert jedes
`DELETE FROM invite_codes`, solange ein Konfi-Profil den Code referenziert:

1. **Org-Löschung:** Der Purge löscht `invite_codes` (organizations.js:744)
   VOR `konfi_profiles` (organizations.js:749). Sobald sich in der Org je ein
   Konfi per Einladungscode registriert hat, bricht die Transaktion mit
   FK-Verletzung ab → 500, die Organisation ist **gar nicht löschbar**.
   Das dürfte jede reale Org betreffen. (Belegt aus Code + Schema;
   UNSICHER nur, ob je jemand eine Org-Löschung versucht hat.)
2. **Personenlöschung von Code-Erstellern:** `deleteKonfiCascade`
   (konfiDeletion.js:106) und die users.js-Kaskade (users.js:458) löschen
   `invite_codes WHERE created_by = userId`. Hat auch nur ein noch
   existierender Konfi einen dieser Codes benutzt, scheitert die gesamte
   Löschung → der Admin/Teamer, der die Codes angelegt hat, kann weder von
   der Leitung gelöscht werden noch sich selbst löschen. Exakt dieselbe
   Fehlerklasse wie die am 22.08. und 24.08. reparierten Befunde
   (user_certificates etc.) — nur diesmal über eine Kind-Tabelle der
   zu löschenden Codes statt über den User selbst.
3. **Einzelner Code:** `DELETE /api/auth/invite-codes/:id` (auth.js:737-753)
   löscht ohne Verwendungsprüfung → 500 "Fehler beim Löschen des
   Einladungscodes" bei jedem benutzten Code.

Fix-Richtung (nicht umgesetzt): `ON DELETE SET NULL` auf den FK — die
Herkunftsinfo ist nach der Registrierung ohnehin nur Statistik — oder vor
jedem Code-Delete `UPDATE konfi_profiles SET invite_code_id = NULL`.

**K2 — Der letzte Org-Admin kann sich selbst löschen; die Org ist danach
führungslos.**
`POST /auth/delete-account` (auth.js:328-370) prüft nur das Passwort, nicht
die Rolle. Die User-Verwaltung hat den Schutz (users.js:394-411, 409 "Letzter
Org-Admin kann nicht gelöscht werden"), die Selbstlöschung nicht. Danach gibt
es niemanden mehr mit `requireOrgAdmin` — User-Verwaltung, Rollenvergabe und
Org-Einstellungen sind nur noch per DB-Eingriff erreichbar. Nebenbefunde im
selben Umfeld: der Last-Admin-Check in users.js läuft außerhalb der
Transaktion und ohne Sperre (Race bei zwei parallelen Löschungen) und zählt
deaktivierte/soft-gelöschte Admins mit (users.js:399-402); ein super_admin
kann sich ebenfalls selbst löschen.

### HOCH

**H1 — Event-Löschung lässt vergebene Punkte ohne Herkunft im Profil stehen.**
`DELETE /events/:id` (events.js:1428-1580) enthält kein einziges
`UPDATE konfi_profiles`; die `event_points`-Zeilen verschwinden per FK-CASCADE
(prod-schema.sql:4176). Konfis, die beim Event als anwesend verbucht waren,
behalten die Punkte im Aggregat, während der Beleg weg ist — Aggregat und
Historie laufen dauerhaft und nicht rekonstruierbar auseinander. Die
Einzel-Storno-Pfade machen es richtig (events.js:1878-1889, 2228-2244).

**H2 — Chat- und Material-Dateien überleben die Org-Löschung; Waisen-Cleanup
ist manuell und blind für Challenges.**
Der Org-Purge sammelt nur Antragsfotos und Challenge-Dateien ein
(organizations.js:697-701, 779-786); für `uploads/chat/` und
`uploads/material/` gibt es dort weder SELECT noch Unlink — die DB-Zeilen
verschwinden, die verschlüsselten Dateien bleiben unbegrenzt auf dem
persistenten Bind-Mount (compose.konfi_quest.yml:70-71). Der einzige
Waisen-Finder `scripts/cleanupOrphanPhotos.js` kennt nur requests/chat/
material (Zeilen 18-31) — `uploads/challenges/` prüft niemand — und ist
nirgends verdrahtet (kein Cron, kein npm-Script). Für ein Löschverlangen nach
Art. 17 DSGVO ist das die relevanteste Lücke: Fotos, Videos und
Sprachnachrichten einer gelöschten Gemeinde bleiben physisch liegen.

**H3 — Abzeichen werden nach Punktkorrekturen nie aberkannt.**
`checkAndAwardBadges` (badges.js:104-336) vergibt ausschließlich; im gesamten
Backend existiert kein `DELETE FROM user_badges` außerhalb der
User-/Org-Löschung. Löscht die Leitung eine Fehlbuchung
(konfi-management.js:849, 972), sinken die Punkte, das darauf beruhende
Abzeichen bleibt — ohne jeden Entzugsweg. Für das bewusste Deaktivieren eines
Badges ist das dokumentiert gewollt (konfiBadgeProgress.js:37-44), für den
Korrekturfall nicht durchdacht.

**H4 — Org-Purge löscht `notifications` über den falschen Schlüssel.**
organizations.js:715 löscht per `user_id IN (Org-User)`; die Tabelle hat aber
`organization_id NOT NULL` mit FK ohne ON DELETE (prod-schema.sql:4400).
Notifications, die ein Gast-User einer anderen Org in dieser Org erzeugt hat
(Multi-Org, Migration 101), überleben und blockieren den finalen Org-Delete →
Rollback, 500. UNSICHER, ob solche Zeilen in Produktion existieren; der
Codepfad dorthin existiert (z.B. teamer.js:1414).

### MITTEL

**M1 — Zwei divergierende Personen-Kaskaden.** users.js:385 hat eine eigene
Inline-Kaskade statt `deleteKonfiCascade`; nachweislich fehlt dort
`chat_message_reactions` (konfiDeletion.js:52 begründet das explizite Löschen
mit "kein CASCADE garantiert") → 500er-Kandidat: eine Person, die je auf eine
Chatnachricht reagiert hat, wäre von der Leitung nicht löschbar, per
Selbstlöschung schon. UNSICHER — vor jedem Fix gegen die Prod-DB prüfen
(`\d chat_message_reactions`). Strukturell: Jede neue Migration mit
`REFERENCES users(id)` ohne ON DELETE erzeugt still den nächsten 500er; ein
Schema-Test (alle FKs auf users gegen Whitelist) würde die Fehlerklasse
dauerhaft schließen.

**M2 — Teamer dürfen Events per API hart löschen** (events.js:1428 mit
`requireTeamer`, rbac.js:274) — die Teamer-UI bietet es nicht an, die API
erlaubt es. Keine Trennung zwischen Bearbeiten und unwiderruflichem Löschen.

**M3 — Die Server-Guards der Event-Löschung sind faktisch tot.** Das
Admin-Frontend sendet immer `force=true` (AdminEventsPage.tsx:334, 360); der
409 bei Buchungen und der Chat-Verlust-Hinweis (events.js:1450-1496) erreichen
nie jemanden. Der Client-Alert warnt nur vor Anmeldungen, nicht vor
Chatverlauf oder Material. Zudem entfällt der Buchungs-Guard ganz, wenn das
Event vorher abgesagt wurde (events.js:1449).

**M4 — Level-Löschung wirft 500 statt 409, wenn ein soft-gelöschter Konfi das
Level trägt.** Der Verwendungs-Check filtert `u.deleted_at IS NULL`
(levels.js:188), der FK `konfi_profiles.current_level_id` hat keine Regel
(prod-schema.sql:4528). Beim Soft-Delete (Tag 60-120) bleibt das Profil
bestehen — der Fall ist real konstruierbar.

**M5 — Teamer-Antragslöschung lässt das Nachweisfoto verwaisen.**
teamer.js:1453-1477 ruft `deletePhotoFile` nicht auf (photoStorage wird in
teamer.js gar nicht importiert); Konfi- und Admin-Pfad machen es richtig
(konfi.js:966-969, activities.js:380-382). Die Datei ist danach ohne
DB-Referenz und wird nie mehr gefunden.

**M6 — Konfi-Abmeldefrist und Pflicht-Event-Schutz sind umgehbar.**
`DELETE /events/:id/book` (events.js:1850) steht auch Konfis offen und prüft
weder die 2-Tage-Frist noch Pflicht-Events; `DELETE /konfi/events/:id/register`
(konfi.js:1719, 1751) prüft beides. Letztere Route nimmt zudem keine
Punkte zurück und läuft ohne Transaktion.

**M7 — Soft-gelöschte Konfis sind manuell nicht löschbar.** Der Admin-Delete
filtert `deleted_at IS NULL` (konfi-management.js:400) → 404; zwischen Tag 60
und 120 gibt es keinen Weg, einem sofortigen Löschverlangen (DSGVO)
nachzukommen, außer auf den Cron zu warten.

**M8 — Kein Weg, eine einzelne rechtswidrige Challenge-Datei zu tilgen.**
Beiträge kann niemand hart löschen (403 by design, challenges.js:831-841);
Verbergen (challenges.js:1584-1590) entfernt die verschlüsselte Datei nicht.
Bei einem rechtlich problematischen Upload bleibt nur Challenge- oder
User-Löschung. Nebenbefund: War es der einzige genehmigte Beitrag, verliert
der Konfi durchs Verbergen still sein Abzeichen (challenges.js:482 + 1584).

**M9 — Org-Löschung ohne zweite Sicherung.** Nur super_admin, aber kein
Passwort-Re-Auth, kein Namen-Eintippen — die einzige Hürde ist ein
Client-Alert (organizations.js:636, AdminOrganizationsPage.tsx:94-112). Für
eine irreversible Totallöschung inkl. aller Konfi-Daten zu dünn.

**M10 — Ansammlung ohne Retention.** `notifications` (größter Ansammler),
`password_resets`, `event_reminders` (bis Event-Ende), abgelaufene
`invite_codes` — nichts davon räumt je ein Job ab. Der
Refresh-Token-Cleanup läuft als boot-verankerter setInterval im Router
(auth.js:1239-1248) auf beiden Replicas und umgeht die
Cron-Leader-Architektur; bei häufigen Deploys läuft er womöglich nie.
UNSICHER: `socket_io_attachments` — der PG-Adapter wird ohne explizites
`cleanupInterval` initialisiert (server.js:71-73); ob der Adapter-Default
aufräumt, ist nicht belegt.

**M11 — Antrag-Reset trifft heuristisch den user_activities-Eintrag.**
activities.js:440-450 löscht mangels `request_id`-Spalte den jüngsten
passenden Eintrag — bei Mehrfachverbuchung derselben Aktivität stimmen danach
die Punkte, aber Datum/Kommentar/Vergebende der Historie können verrutschen.

### NIEDRIG

**N1 — Dialoge verschweigen Mitreiß-Effekte.** Jahrgang-Dialog
(AdminJahrgaengeePage.tsx:521) nennt Chat und Konfis, nicht aber
Einladungscodes, Challenge-Zielgruppen (danach ggf. verwaiste Challenge ohne
Publikum), Event- und Teamer-Zuordnungen; der Frontend-Text "Als
Organisation-Admin können Sie dennoch löschen" deckt sich nicht mit dem
Backend (`force` steht jedem admin offen, jahrgaenge.js:204). Badge-Dialog
(AdminBadgesPage.tsx:115) verschweigt den rückwirkenden Verlust verliehener
Abzeichen. Der User-Lösch-Dialog (AdminUsersPage.tsx:70) ist der schwächste
der drei Personen-Dialoge — keine Konsequenzwarnung.

**N2 — Kleinere Event-Reste.** Verwaiste unsichtbare Timeslots mit aktiven
Buchungen nach Slot-Entfernung (events.js:1171-1181); `series_id` der
Geschwister zeigt nach Anker-Löschung ins Leere (Serienlöschung existiert nur
als Frontend-Schleife, AdminEventsPage.tsx:359-361); angemeldete Teamer
bekommen beim Löschen keinen Push (Filter `r.name='konfi'`, events.js:1474);
die individuelle Absage-Begründung wird verworfen (events.js:3127).

**N3 — Verwaiste Direct-Chaträume nach Konfi-/Selbstlöschung.** Nur die
users.js-Kaskade räumt sie auf (users.js:465-472), `deleteKonfiCascade`
nicht — Benennung für den Chat-Agenten.

**N4 — Fotos genehmigter Anträge werden nie gelöscht.** Die Löschung bei
Genehmigung ist bewusst auskommentiert (activities.js:524-566, Begründung vom
28.06.2026), der dort angekündigte zeitversetzte Cron existiert nicht.

**N5 — Nicht-atomare Datei-Löschungen.** Material (material.js:570-590),
Challenges (challenges.js:1442-1447) und Org-Purge (organizations.js:767-786)
löschen erst DB, dann Dateien; ein Crash dazwischen erzeugt stille Waisen,
und die Rückgabewerte von `deletePhotoFile`/`deleteChallengeFile` wertet
keine Aufrufstelle aus (photoStorage.js:27-34). In Kombination mit dem
fehlenden Challenge-Cleanup (H2) unauffindbar.

**N6 — Kleinkram.** `DELETE /material/tags/:id` hat keinen Frontend-Aufrufer
und damit keinen Bestätigungsdialog (material.js:141); die Admin-Route zum
Löschen abgelehnter Anträge (activities.js:357) hat ebenfalls keine UI;
`user_badges` wird im Org-Purge doppelt gelöscht (organizations.js:695, 741,
No-Op); `GREATEST(0,…)` klemmt Punktedrift still auf 0 statt sie sichtbar zu
machen (konfi-management.js:871, 1008).

### Ausdrücklich gut gelöst

- Aktivitäts-Vorlagen-Löschung: Blockade statt Kaskade, differenzierte
  409-Texte, Transaktion, Fotolöschung nach COMMIT (activities.js:220-315).
- Auto-Deletion: sicherer Default ohne Konfirmationstermin, Fehler-Isolation
  pro Konfi, Vorwarnung an Admins, Teamer-Ausnahme — und gut getestet
  (backgroundService.js:1043-1140).
- Org-Purge-Transaktionsführung: dedizierter Client, finally-release,
  rollback-sicheres Catch, Cache-Invalidierung nach COMMIT
  (organizations.js:636-796) — die Lücken liegen an den Rändern, nicht im
  Gerüst.
- Kategorien-Löschung mit bewusst strengerer 409-Blockade als die DB
  (categories.js:101-115).
- Challenge-Löschung sammelt Dateipfade vor dem DB-Delete ein und ist
  zweistufig (challenges.js:1428-1447).

---

## Nicht durch Tests abgesichert

Gut abgedeckt sind: Personen-Löschpfade (konfiDeletion, Auto-Deletion,
users/auth/konfi-management — zusammen ~24 Tests), Vorlagen-Löschung inkl.
Antragshistorie, Badge-Löschung inkl. user_badges-Kaskade, Kategorien-409,
Jahrgang-Blockaden, Challenge-Beitrags-Sperre. Ungetestet sind ausgerechnet
die Kernstellen der gefundenen Lücken:

1. **`DELETE /events/:id` komplett** — kein Happy Path, kein 409-Guard, kein
   `force`, keine Kaskade, kein Push. Ebenso `PUT /events/:id/cancel` und
   `GET /events/cancelled`.
2. **Punkte-Rückrechnung nach Löschungen** — die Delete-Tests in
   konfi-management prüfen nur Statuscodes, nie `konfi_profiles`
   (konfi-management.test.js:676-708). Das Herzstück der Löschlogik.
3. **`DELETE /challenges/admin/:id`** — weder 409-ohne-force noch Kaskade
   noch Dateilöschung noch Teamer-RBAC.
4. **Org-Löschung** — der 13-Block-Purge hat keinen Test; der K1-500er
   (invite_codes vor konfi_profiles) wäre mit einem einzigen Test mit
   registriertem Invite-Konfi sofort aufgefallen.
5. **Letzter-Org-Admin-Schutz** — weder der vorhandene 409 in users.js:405
   noch sein Fehlen in auth.js ist getestet.
6. **Physische Dateilöschung** — kein einziger Test prüft, ob eine Datei nach
   dem Löschen wirklich von der Platte verschwunden ist (DSGVO-relevant).
7. **Level-409 bei Verwendung** und der M4-500er mit soft-gelöschtem Konfi.
8. **`DELETE /konfi/requests/:id`** (Konfi löscht eigenen Antrag) — kein
   Treffer in konfi.test.js; ebenso die 2-Tage-Frist und der
   Pflicht-Event-Guard der Konfi-Abmeldung.
9. **Schema-Drift-Wächter fehlt** — kein Test prüft, dass jeder FK auf
   `users(id)`/`organizations(id)` entweder eine ON-DELETE-Regel hat oder in
   den Löschlisten (konfiDeletion.js, users.js, organizations.js) vorkommt.
   Genau diese Lücke hat die 500er-Klasse (user_certificates damals,
   invite_codes/chat_message_reactions heute) wiederholt erzeugt.
