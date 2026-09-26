# Feature-Empfehlungen für die EKD-Ausrollung — 26.09.2026

Dieser Bericht enthält **Empfehlungen, keine Fehlerbefunde**. Jede Empfehlung
ist am heutigen Code oder an der Doku belegt (Fundstelle mit `datei:zeile`).
Wo unklar ist, ob die EKD etwas will, steht es unten als offene Frage und nicht
als Vorschlag. Grundlage: Stand des Repos am 26.09.2026 (CHANGELOG „Unreleased
2.3.0", Store-Apps 2.2.x in Betrieb).

## Ausgangslage

Konfi Quest ist eine Ionic-9/React-19-App für iOS, Android und Browser mit
einem Node-22/Express-5-Backend auf PostgreSQL 15 (`README.md:122-141`). Das
Backend deklariert 251 Routen in `backend/routes/` plus 11 direkt in
`backend/createApp.js` (gezählt per `grep`), 89 additive Migrationen liegen in
`backend/migrations/`; das Repo hat 2.163 Commits seit dem 23.03.2026. Fünf
feste Rollen — konfi, teamer, admin, org_admin, super_admin — mit fester
Hierarchie (`backend/utils/roleHierarchy.js:6-12`) und reinen
Namens-Whitelists als Guards (`backend/middleware/rbac.js:272-274`); die
Mandantentrennung läuft über `req.user.organization_id` in den Abfragen
(`rbac.js:295-300`), seit den Migrationen 101 und 159 auch mit
Mehrfach-Mitgliedschaft und eigener Rolle je Gemeinde (`rbac.js:150-172`,
`backend/routes/einladungen.js`).

Fachlich deckt die App ab: Punkte in zwei Arten mit Zielen je Jahrgang,
Aktivitäten mit Antragsweg, Termine mit Anmeldung, Warteliste, Zeitfenstern,
Serien, Pflicht-Events, QR-Check-in und Anwesenheit samt Abmeldung und Notiz,
Challenges mit Moderation und Stempeln, Chat (Jahrgang, Team, Termin, Gruppe,
Direkt), Abzeichen mit 16 Bedingungen, Level, Material fürs Team, Zertifikate
für Teamer:innen, Jahresrückblick für Konfis und Team, Postfach, Push in vier
abwählbaren Gruppen mit 32 Push-Arten (`backend/utils/pushGruppen.js:76-118`),
Offline-Warteschlange und App-Sperre (Handbuch, 14 Kapitel, 5.236 Zeilen).

Betrieben wird die App heute auf **einem** Host als Portainer-Stack: ein
Postgres-Container (1 GB, `max_connections=200`), zwei Backend-Replicas mit je
512 MB / 0,5 CPU plus ein Test-Backend, Uploads auf lokaler Platte
(`/opt/Konfi-Quest/uploads`), Push über Firebase, Mail über einen eigenen
SMTP-Server, Tageslosung über ketiv.de, anonyme Nutzungsmessung über Umami
(`deploy/compose.konfi_quest.yml:16-45, 58-111, 137-170`,
`backend/services/losungService.js:20-22`, `frontend/src/services/analytics.ts:1-30`).
Produktionsgröße, gemessen am 25.09.2026: **6 Gemeinden, 108 Konfis, 14
Leitungskonten** (`backend/services/backgroundService.js:1104-1105`); am
10.09.2026 zählte der Dump 111 Nutzer:innen (`docs/offene-befunde.md`, Nr. 3).

Neue Gemeinden legt ausschließlich ein super_admin an
(`backend/routes/organizations.js:284`, `requireSuperAdmin`); die Oberfläche
dafür sieht nur, wer das Super-Admin-Flag trägt
(`frontend/src/components/admin/pages/AdminSettingsPage.tsx:206-213`). Jede
neue Gemeinde startet als 30-Tage-Testphase (`organizations.js:319-322`) mit
Tarifstufen 15/50/75/100 Konfis (`backend/utils/konfiLimit.js:12`); die
Webseite nennt Jahreslizenzen von 49 bis 179 Euro und eine Organisationslizenz
für bis zu vier Gemeinden (`frontend/public/landing.html:156`). Support läuft
über `moin@konfi-quest.de` (`README.md:80`), die Löschseite verweist auf eine
persönliche Dienstadresse (`frontend/public/konto-loeschen.html:138`). Das
Handbuch steht unter konfi-quest.de/docs (33 MB erzeugtes HTML samt Bildern in
`frontend/public/docs/`), aus der App heraus ist es nicht verlinkt (kein
Treffer für `/docs` in `frontend/src` außerhalb von Kommentaren).

## Was die Ausrollung anders macht als der bisherige Betrieb

1. **Anzahl der Mandanten.** Von 6 Gemeinden, die der Entwickler persönlich
   kennt, auf Dutzende bis Hunderte. Alles, was heute ein super_admin von Hand
   tut — Gemeinde anlegen (`organizations.js:284`), Konfi-Limit setzen
   (`:931`), Mitglieder zuordnen (`:1153`), Lizenz verlängern (`:700-712`) —
   wird zur Warteschlange bei einer Person.
2. **Ehrenamtliche als Leitung.** Die Rolle `admin` heißt in jeder neu
   angelegten Gemeinde „Hauptamt" (`organizations.js:340`), die
   Passwort-Notfallpfade enden beim „Betreiber der App"
   (`docs/handbuch/35-passwoerter.md`, Abschnitt „Wenn gar nichts geht"), und
   das Handbuch setzt voraus, dass jemand die Jahrgangs-Zuweisung versteht
   (`docs/handbuch/05-rollen.md`, „An die eigenen Jahrgänge gebunden sein").
   Bei Hunderten Ehrenamtlichen entscheidet Selbsthilfe in der App über die
   Support-Last.
3. **Jährlich wechselnde Kohorte Minderjähriger.** 10.000–25.000
   Nutzer:innen pro Jahr heißt: jedes Jahr werden fast alle Konfi-Konten
   angelegt und wieder gelöscht. Die Auto-Löschung 60/120 Tage nach der
   Konfirmation existiert (`backgroundService.js:1056-1075, 1423-1530`), greift
   aber nur, wenn ein Konfirmationstermin in der App steht (`:1454`:
   „Kein Konfirmationstermin -> keine Löschung"). Einwilligung und Rechtstexte
   werden bisher außerhalb der App erledigt (`frontend/public/datenschutz.html:290-291`).
4. **Mehrere Landeskirchen.** Es gibt heute genau eine Ebene über den
   Nutzer:innen: die Organisation. `kirchenkreis` ist ein Freitextfeld
   (`backend/tests/schema/prod-schema.sql:1521`,
   `frontend/src/components/admin/modals/OrganizationManagementModal.tsx:837-841`).
   Eine Sicht „alle Gemeinden meines Kirchenkreises" oder Kennzahlen je
   Landeskirche gibt es nicht; die Kennzahlen-Routen sind super_admin-only und
   technisch (`createApp.js:436-451`, `organizations.js:78-118, 1288`).
5. **Datenmengen.** Das Postfach ist für den EKD-Rollout auf ~3,3 Mio. Zeilen
   und ~2 GB je Jahr hochgerechnet (`backgroundService.js:1110-1113`); für
   Uploads (Challenges bis 50 MB je Datei, Chat 5 MB, Material 20 MB;
   `docs/handbuch/80-challenges.md`, `90-chat.md`) gibt es keine Kennzahl je
   Gemeinde und keine Quote.
6. **Der API-Vertrag der Store-Apps.** Jede Empfehlung unten muss additiv
   umsetzbar sein: neue Felder, neue Routen, nie geänderte Formen
   (`CLAUDE.md`, „Ausgelieferte Apps nie brechen"; `docs/api/ABRISS.md`). Was
   die alte App nicht kennt, muss der Server erzwingen, nicht die Oberfläche.

## Empfehlungen

### A) Vor dem Release / im Release-Zeitraum

### E-01: Rechtstexte, Einwilligung und Datenschutzhinweis in der App

- **Für wen:** Konfi / Leitung / Betrieb
- **Warum jetzt:** Die Registrierung per Einladungscode nimmt `invite_code,
  display_name, username, password, email` entgegen — kein Häkchen, keine
  Textversion, kein Zeitstempel einer Zustimmung (`backend/routes/auth.js:930-937`;
  `frontend/src/components/auth/KonfiRegisterPage.tsx:432-549` kennt kein
  Zustimmungsfeld). Die Datenschutzerklärung erklärt, die Einwilligung der
  Erziehungsberechtigten werde „in schriftlicher Form im Rahmen der Anmeldung
  zum Konfirmand:innenunterricht erteilt" (`frontend/public/datenschutz.html:290-291`)
  — das gilt für Simons Gemeinden, aber nicht automatisch für jede Gemeinde der
  EKD. In der App selbst gibt es keinen Link auf Datenschutz oder Impressum
  (kein Treffer für „impressum|datenschutz" in `frontend/src` außer in
  Kommentaren von `analytics.ts` und `deepLinks.ts`); die Löschseite nennt eine
  persönliche Dienstadresse (`konto-loeschen.html:138`).
- **Was heute existiert:** Datenschutz- und Impressumsseiten auf der Webseite
  (`frontend/public/datenschutz.html`, `impressum.html`), der Datenschutz-Link
  im Mail-Footer (`backend/services/emailService.js:86, 123`), die
  Kontolöschung in der App (`auth.js:374`, `DeleteAccountModal.tsx`), der
  Apple-Privacy-Manifest-Test (`frontend/src/__tests__/config/privacyManifest.test.ts`).
- **Vorschlag:** (1) Links auf Datenschutz, Impressum und Nutzungsbedingungen
  im Login und im Profil aller drei Rollen. (2) Bei der Registrierung ein
  Pflicht-Häkchen „Ich habe die Datenschutzhinweise gelesen; meine
  Erziehungsberechtigten sind einverstanden", dazu ein additives Feld
  `consent_version` + `consent_at` an `konfi_profiles` (Migration additiv,
  Body-Feld optional, damit 2.2.x-Apps weiter registrieren können; der Server
  verlangt es erst, wenn die App die Version mitsendet). (3) Die Löschseite
  auf eine Rollenadresse umstellen und auf die In-App-Löschung verweisen.
  (4) Der Text in `datenschutz.html` §11 muss zur EKD-Realität passen —
  das ist eine Aufgabe für Simon und die EKD-Datenschutzstelle, nicht für Code.
- **Aufwand (grob):** S — zwei Links, ein Häkchen, eine additive Spalte,
  ein Textabgleich.
- **Risiken/Abhängigkeiten:** Store-Apps 2.2.x senden das Feld nicht; die
  Prüfung darf deshalb nur greifen, wenn ein `app_version`-Hinweis mitkommt
  (Muster: Migration 156 `push_tokens.app_version`). Wer die Einwilligung der
  Eltern wirklich rechtssicher haben will, braucht ein Verfahren außerhalb der
  App (13-Jährige können nicht selbst einwilligen) — siehe offene Frage 1.

### E-02: Löschfrist auch ohne Konfirmationstermin greifen lassen

- **Für wen:** Leitung / Betrieb (Datenschutz)
- **Warum jetzt:** Die Auto-Löschung leitet den Stichtag aus dem
  `is_konfirmation`-Event ab; fehlt er, passiert nichts — bewusst „sicherer
  Default" (`backgroundService.js:1423-1462`). Bei 6 Gemeinden mit
  dem Entwickler als Ansprechpartner ist das vertretbar; bei Hunderten
  Gemeinden bleiben Jahrgänge ohne eingetragene Konfirmation dauerhaft
  gespeichert, mit Fotos, Chat und Challenge-Beiträgen Minderjähriger. Die
  Spalte `jahrgaenge.confirmation_date` existiert im Schema
  (`prod-schema.sql:1077`), wird aber von keiner Route gelesen oder
  geschrieben (grep in `backend/routes`, `services`, `utils`: nur
  Event-Aliasse); das Handbuch sagt ausdrücklich „Am Jahrgang selbst wird kein
  Konfirmationsdatum gepflegt" (`docs/handbuch/45-jahrgaenge.md`, letzter
  Abschnitt).
- **Was heute existiert:** Soft-Löschung Tag 60, Hard-Löschung Tag 120, Warnung
  an die Leitung 7 Tage vorher per Mail und Push
  (`backgroundService.js:1313-1420`), `deleteKonfiCascade` als einzige
  Löschkaskade (`backend/utils/konfiDeletion.js`), Postfach-Aufräumen nach 365
  Tagen (`:1120-1127`).
- **Vorschlag:** (1) `jahrgaenge.confirmation_date` als Rückfall-Stichtag
  nutzen, wenn kein Konfirmationstermin existiert; im Jahrgangs-Formular
  pflegbar als „Abschluss des Jahrgangs". (2) Zusätzlich ein Zeit-Rückfall:
  Jahrgang ohne jeden Stichtag und ohne Aktivität seit N Monaten → Warnung an
  die Leitung, nicht automatische Löschung. (3) In der Löschwarnung den Weg zum
  Export nennen (siehe E-14). (4) Die Fristen 60/120 in der Doku für die EKD
  begründen (DSG-EKD) und als Betriebsparameter halten, nicht als Konstante.
- **Aufwand (grob):** S — Spalte ist da, Cron ist da; ein zweiter Stichtag-
  Zweig plus Formularfeld.
- **Risiken/Abhängigkeiten:** Löschung ist endgültig; jeder neue Stichtag
  braucht Tests für „löscht" und „löscht nicht". Landeskirchen könnten
  abweichende Fristen verlangen — offene Frage 2.

### E-03: Gemeinden anlegen ohne Flaschenhals — Antragsweg, EKD-Vorgaben, zweiter Org-Admin

- **Für wen:** Landeskirche / Betrieb / Leitung
- **Warum jetzt:** `POST /organizations` ist `requireSuperAdmin`
  (`organizations.js:284`); jede Anlage schreibt Name, Slug, Kontakt,
  Kirchenkreis, Limit, Trial, Admin-Zugang von Hand (`:286-289`). Der Standard
  ist eine 30-Tage-Testphase mit Sperre danach (`:319-322`,
  `backgroundService.js:1146-1165`), Konfi-Limits nach Tarif
  (`konfiLimit.js:9-12`). Für eine EKD-weite Lizenz ist beides voraussichtlich
  falsch voreingestellt. Jede Gemeinde startet mit genau **einem** Org-Admin
  (`organizations.js:362-366`); das Handbuch warnt, dass ohne zweiten Org-Admin
  nur der Betreiber helfen kann (`35-passwoerter.md`, „Wenn gar nichts geht").
- **Was heute existiert:** Die vollständige Anlage-Logik mit Standardkatalog
  (`organizations.js:284-650`), Tarif- und Zeitraumwahl im Super-Admin-Dialog
  (`OrganizationManagementModal.tsx:1284, 1315, 1369`), Kontaktformular auf
  der Webseite (`landing.html:1041`), Einladung bestehender Konten in eine
  Gemeinde (`einladungen.js`), `POST /organizations/:id/admins` auch für
  org_admin (`organizations.js:1029`).
- **Vorschlag:** (1) Ein Antragsformular auf der Webseite, das eine Gemeinde
  als **inaktiv/wartend** anlegt (neue Route, Rate-Limit wie
  `registerLimiter`); der Betrieb aktiviert mit einem Klick. (2) Eine
  Vorgabe „EKD-Lizenz" im Dialog: `is_trial=false`, `trial_ends_at=NULL`,
  `max_konfis=NULL` oder eine von der EKD genannte Grenze — verhindert, dass
  Gemeinden nach 30 Tagen still gesperrt werden. (3) Beim Anlegen zwei
  Org-Admin-Zugänge erzwingen oder nach dem ersten Login einen Hinweis „Zweite
  Leitungsperson anlegen" zeigen, bis es sie gibt. (4) Ein Skript für die
  Massenanlage aus einer CSV (Name, Kirchenkreis, Landeskirche, Kontakt), das
  die bestehende Anlage-Logik aufruft.
- **Aufwand (grob):** M — Antragsroute und Freigabe-Liste sind neu, die
  Anlage selbst existiert.
- **Risiken/Abhängigkeiten:** Wer Gemeinden beantragen darf (jede Pastorin?
  nur Kirchenkreise?) ist eine EKD-Entscheidung — offene Frage 3. Ein
  öffentlicher Antragsweg braucht Missbrauchsschutz (Bestätigungsmail an eine
  kirchliche Adresse).

### E-04: Hilfe und Support in der App

- **Für wen:** Konfi / Teamer:in / Leitung / Betrieb
- **Warum jetzt:** README verspricht „Handbuch in der App" (`README.md:61`);
  tatsächlich verlinkt die App das Handbuch nirgends (grep `/docs` in
  `frontend/src`), es liegt nur auf der Webseite (`landing.html:604`). In der
  App gibt es Erklärtexte hinter Info-Knöpfen im „Mehr"-Reiter
  (`AdminSettingsPage.tsx:92-180`), die Onboarding-Tour
  (`frontend/src/components/shared/OnboardingTour.tsx`,
  `konfi/modals/KonfiOnboardingModal.tsx:34-77`) und den „Was ist neu"-Banner
  (`NeuerungenBanner.tsx`). Die Diagnose-Anzeige „Mitteilungen prüfen" wurde
  wieder entfernt (CHANGELOG Unreleased, „Behoben"), obwohl das Handbuch sie
  als „schnellste Antwort auf ‚woran liegt es'" empfiehlt
  (`03-bedienung.md`, „Benachrichtigungen wieder zum Laufen bringen"). Bei
  25.000 Nutzer:innen landet jede Frage sonst bei der Leitung oder bei
  `moin@`.
- **Was heute existiert:** Handbuch als erzeugtes HTML mit
  Inhaltsverzeichnis (`frontend/public/docs/`), Kapitelstruktur nach Rollen
  (`00-start.md`, `10-konfis.md`, `20-teamer.md`, `30-leitung.md`),
  Kontaktdaten der Gemeinde in `organizations` (`contact_name, contact_email,
  contact_phone`, `prod-schema.sql:1513-1524`), Absturzmeldung ohne
  Personenbezug (`frontend/src/services/absturzdiagnose.ts`).
- **Vorschlag:** Ein Eintrag „Hilfe" im Profil jeder Rolle mit (1) dem
  rollenpassenden Handbuch-Kapitel (Deep-Link auf `/docs/konfis.html` usw.,
  bei Konfis zuerst „Häufige Fragen"), (2) „Deine Ansprechperson": Name und
  Kontakt der Gemeindeleitung aus den Org-Stammdaten, (3) für Leitungen der
  Kontakt des Betriebs, (4) die Diagnose-Zeile (Version, Push erlaubt,
  Gemeinde) zum Kopieren — wieder hinein, aber unter „Hilfe" statt im Profil.
- **Aufwand (grob):** S — Links und eine Seite; die Inhalte existieren.
- **Risiken/Abhängigkeiten:** Handbuch-Links müssen Deep-Links bleiben, die
  Android ins Browserfenster leitet (`deepLinks.ts:27`); keine
  Vertragsänderung. Das Handbuch selbst ist heute an Simons Gemeinden
  orientiert („Kirchspiel West", „Stavanger"); eine EKD-neutrale Fassung ist
  Doku-Arbeit.

### E-05: Wartungshinweis und Mindestversion über `/api/app-version`

- **Für wen:** Betrieb / alle Rollen
- **Warum jetzt:** Die App zeigt nur „eine neuere Version ist da"
  (`frontend/src/services/updateCheck.ts:11-18`, „Nur ein HINWEIS, nie eine
  Blockade"); der Endpunkt liefert genau `ios/android: {version, url}`
  (`backend/routes/appVersion.js:11-20`). Es gibt keinen Weg, allen Geräten
  „heute Abend Wartung" oder „Version 2.1 wird ab 1.3. nicht mehr
  unterstützt" mitzuteilen. Die Abrissliste hält fest: „Ein erzwungenes
  Mindest-Update verkürzt das, ist aber bisher nicht eingerichtet"
  (`docs/api/ABRISS.md:43-44`). Mit Zehntausenden Installationen kann keine
  alte Route je abgerissen werden, solange es kein Signal an die Geräte gibt.
- **Was heute existiert:** Der Endpunkt mit Vertragskommentar „nie ändern, nur
  ergänzen" (`appVersion.js:11`), der iTunes-Lookup mit Cache
  (`backend/utils/storeVersion.js`), `StoreUpdateBanner.tsx` und
  `TrialBanner.tsx` als Banner-Muster, `/api/status` mit Version und Commit
  (`createApp.js:394-413`).
- **Vorschlag:** Additive Felder in `/api/app-version`: `minimum_supported`
  (Version, ab der die App einen dauerhaften, nicht wegklickbaren Hinweis
  zeigt) und `notice` (`{text, bis, art: 'wartung'|'stoerung'|'info'}`), beide
  aus einer kleinen Tabelle oder Umgebungsvariable, pflegbar über die
  Betriebsseite. Die App 2.3.0 liest sie; 2.2.x ignoriert sie folgenlos.
- **Aufwand (grob):** S — zwei Felder, ein Banner, ein Formular.
- **Risiken/Abhängigkeiten:** Apple lehnt harte Sperren ab
  (`updateCheck.ts:13-16`); der Hinweis bleibt ein Hinweis (siehe E-29). Erst
  ab 2.3.0 wirksam — deshalb muss es **in** dieses Release, damit der
  Rollout-Bestand es kennt.

### E-06: Ranking als Opt-in und ohne Klarnamen in der Antwort

- **Für wen:** Konfi / Leitung
- **Warum jetzt:** Das Konfi-Dashboard zeigt „Dein Ranking" standardmäßig
  (`backend/routes/konfi.js:335`: `show_ranking` Default `true`); die Antwort
  enthält für die drei Punktbesten `display_name` und exakte Punktzahl an jeden
  Konfi des Jahrgangs, obwohl die Oberfläche nur Initialen zeigt
  (`konfi.js:136-137, 265-267`; als Lücke der Datenminimierung in
  `docs/api/konfis-events.yaml:26-28` festgehalten). Das Handbuch verspricht
  „dein Platz, ohne die Punkte der anderen zu zeigen"
  (`docs/handbuch/10-konfis.md`, Startseite). Für die EKD-weite Nutzung mit
  13-Jährigen ist ein Leistungsvergleich, der an jeden Konfi ausgeliefert wird,
  eine Produktentscheidung, keine Voreinstellung.
- **Was heute existiert:** Der Dashboard-Schalter je Gemeinde
  (`backend/routes/settings.js:16`, `dashboard_show_ranking`), die
  Initialen-Berechnung (`konfi.js:265-267`), die Rangposition im Profil
  (`konfi.js:512-571`).
- **Vorschlag:** (1) Neue Gemeinden starten mit `dashboard_show_ranking =
  false`; bestehende bleiben. (2) Die Antwort liefert nur `initials` und den
  eigenen Rang — als neue Route oder als zusätzliches Feld, das die
  Klarnamen-Felder ab einer App-Version ersetzt; die alten Felder bleiben bis
  zum Abriss (ABRISS-Liste).
- **Aufwand (grob):** S.
- **Risiken/Abhängigkeiten:** Antwortform ist Vertrag — kein Feld
  entfernen, nur ergänzen und die App umstellen.

### E-07: Rollenbezeichnungen für Ehrenamtliche

- **Für wen:** Leitung / Landeskirche
- **Warum jetzt:** Jede neu angelegte Gemeinde bekommt die Rolle `admin` mit
  `display_name: 'Hauptamt'` (`organizations.js:340`); Handbuch und Oberfläche
  sprechen dagegen von „Admin" und „Org-Admin" (`05-rollen.md`, Tabelle „Wer
  darf was"). In der EKD-Realität leiten vielfach Ehrenamtliche oder
  Diakon:innen; „Hauptamt" als Rollenname ist dort falsch und wirkt in jeder
  Nutzerliste. Rollen sind hart kodiert, `routes/roles.js` ist nur lesend.
- **Was heute existiert:** `roles.display_name` je Gemeinde in der Datenbank
  (wird bei Anlage geschrieben), `users.role_title` als frei wählbare
  Funktionsbezeichnung für Teamer:innen (`20-teamer.md`, Profil), die
  Rollen-Symbole in der Benutzerliste (CHANGELOG Unreleased, „Geändert").
- **Vorschlag:** Vor der Massenanlage die Vorgabe auf „Leitung" (admin) und
  „Gemeindeleitung" (org_admin) setzen — gleichlautend mit dem Handbuch; für
  bestehende Gemeinden eine additive Migration, die nur den Standardtext
  „Hauptamt" ersetzt. Optional: `display_name` je Gemeinde änderbar machen
  (kleine PUT-Route auf `roles`), damit „Pastor:in" oder „Diakon:in" möglich
  ist.
- **Aufwand (grob):** S.
- **Risiken/Abhängigkeiten:** Keine Formänderung; Store-Apps zeigen
  `role_display_name` nur an.

### E-08: Einladungscode länger und wählbar gültig

- **Für wen:** Leitung / Konfi
- **Warum jetzt:** Ein Einladungscode gilt 7 Tage, verlängerbar um jeweils 7
  Tage, ein abgelaufener lässt sich nicht wiederbeleben
  (`auth.js:758, 808-846`; `35-passwoerter.md`, „Eine Einladung verlängern
  oder löschen"). Das Handbuch empfiehlt den Code für Elternbriefe
  (`35-passwoerter.md`, „Link kopieren und in eine E-Mail oder einen
  Elternbrief setzen") — ein Elternbrief hat regelmäßig mehr als sieben Tage
  Vorlauf. Bei Hunderten Gemeinden ist „Code abgelaufen" ein
  vorhersehbarer Support-Treiber.
- **Was heute existiert:** Die Code-Erzeugung je Jahrgang, Gültigkeitsanzeige
  mit Tagen und Warnfarbe (CHANGELOG Unreleased, „Marken"), die Registrierung
  mit Fehlercodes `expired`/`not_found` (`auth.js:895-928`).
- **Vorschlag:** Gültigkeit beim Erzeugen wählbar (7, 30, 60, 90 Tage),
  Verlängerung auch für abgelaufene Codes derselben Jahrgangszuordnung. Der
  Missbrauchsschutz bleibt: Rate-Limit auf `/register-konfi`
  (`backend/server.js:308`), Konfi-Limit je Gemeinde (`konfiLimit.js`).
- **Aufwand (grob):** S.
- **Risiken/Abhängigkeiten:** Ein lange gültiger Code, der in einem
  Elternbrief steht, ist ein geteiltes Geheimnis; die Leitung sieht die
  Registrierungen im Postfach (`pushService.js:2190`) und kann den Code
  löschen.

### E-09: Sprache und Barrierefreiheit der Web-Variante

- **Für wen:** Konfi / Leitung (wer kein Smartphone hat oder mit Hilfsmitteln
  arbeitet)
- **Warum jetzt:** Die Browser-Variante ist der einzige Weg ohne Smartphone
  („dieselbe Oberfläche, ohne Installation", `README.md:73-75`). Das
  Dokument deklariert `<html lang="en">` (`frontend/index.html:2`) — Vorlesehilfen
  sprechen die deutsche Oberfläche englisch aus. 361 `aria-label`-Attribute und
  5 `prefers-reduced-motion`-Stellen zeigen, dass Barrierefreiheit mitgedacht
  wird (grep in `frontend/src`); ein Gesamtcheck (Kontrast im Dunkelmodus,
  Tastaturbedienung der Wischgesten, Schriftskalierung) liegt nicht vor.
- **Was heute existiert:** Web-Deploy als eigener Container
  (`compose.konfi_quest.yml`, Service `frontend`), Dunkelmodus mit Tokens
  (CHANGELOG Unreleased), beschriftete Eck-Marken
  (`__tests__/components/eckBadgesBarrierefrei.test.tsx`).
- **Vorschlag:** `lang="de"` setzen (eine Zeile), danach ein kurzer
  Barrierefreiheits-Durchgang je Rolle mit Bildschirmleser und Tastatur;
  Ergebnisse als Empfehlungsliste, keine Umbauten vor dem Release.
- **Aufwand (grob):** S für die Sprache, M für den Durchgang.
- **Risiken/Abhängigkeiten:** Wischgesten zum Löschen
  (`03-bedienung.md`, „Etwas löschen: nach links wischen") haben im Browser
  keinen Tastaturweg; das ist eine bewusste Ionic-Konvention und würde
  Alternativen (Menü) brauchen.

### B) In den ersten 3 Monaten

### E-10: Landeskirche und Kirchenkreis als Ebene über der Gemeinde, mit anonymen Kennzahlen

- **Für wen:** Landeskirche / Betrieb
- **Warum jetzt:** Es gibt genau zwei Ebenen: Nutzer:in und Organisation.
  `kirchenkreis` ist Freitext (`prod-schema.sql:1521`,
  `OrganizationManagementModal.tsx:837-841`); eine Landeskirche kommt nirgends
  vor. Wer alle Gemeinden eines Kirchenkreises sehen will, braucht heute das
  Super-Admin-Flag, und das zeigt **alle** Gemeinden der Instanz samt
  Kontaktdaten (`organizations.js:78-118`, `:203`). Die EKD wird wissen wollen,
  ob die App genutzt wird — ohne Namen: Gemeinden je Landeskirche, aktive
  Konfis, Termine, Challenges, Push-Zustellung.
- **Was heute existiert:** `GET /organizations` mit `user_count, konfi_count,
  event_count` je Gemeinde (`organizations.js:78-118`), `GET
  /organizations/:id/stats` (`:1288-1330`), APM-Kennzahlen technisch
  (`createApp.js:436-509`, `AdminMetricsPage.tsx`), Umami ohne
  Organisationsbezug (`analytics.ts:12-15`, bewusst), Multi-Org-Mitgliedschaft
  mit Rolle je Gemeinde (`user_organizations`, `rbac.js:150-172`).
- **Vorschlag:** (1) Additive Tabelle `verbaende` (Landeskirche, Kirchenkreis)
  und `organizations.verband_id`; `kirchenkreis`-Text bleibt als Anzeige. (2)
  Eine Rolle **außerhalb** der Gemeinde: `verband_leser` mit Lesezugriff auf
  aggregierte Zahlen seiner Gemeinden — keine Personendaten, kein Chat, keine
  Konfi-Liste; technisch als eigenes Flag wie `is_super_admin`, nicht als
  sechste Gemeinderolle (die Whitelists in `rbac.js:272-274` bleiben
  unberührt). (3) Eine Route `GET /verbaende/:id/kennzahlen` mit Zählwerten je
  Gemeinde und Monat; dieselben Zahlen als CSV. (4) Eine EKD-Gesamtsicht für
  den Betrieb.
- **Aufwand (grob):** M–L — Datenmodell klein, aber Rechteprüfung, Ansicht
  und Tests sind neu.
- **Risiken/Abhängigkeiten:** Kennzahlen kleiner Gemeinden sind faktisch
  personenbezogen (drei Teamer:innen); Mindestgröße für Ausweisung festlegen
  (Muster: Umami-Begründung in `analytics.ts:12-15`). Wer im Kirchenkreis lesen
  darf — offene Frage 4.

### E-11: Vorlagenkatalog zwischen Gemeinden (Aktivitäten, Kategorien, Abzeichen, Challenges, Termine)

- **Für wen:** Leitung / Landeskirche
- **Warum jetzt:** Jede neue Gemeinde bekommt denselben hart kodierten
  Startsatz: 27 Konfi- und 9 Teamer-Abzeichen, 4 Zertifikatstypen, 6 Level, 14
  Kategorien, 5 Konfi- und 4 Teamer-Aktivitäten, 3 Beispiel-Challenges als
  Entwurf (`organizations.js:369-616`). Danach ist jede Gemeinde für sich
  allein; Termine lassen sich nur innerhalb der Gemeinde kopieren (CHANGELOG
  2.2.0, „Termine lassen sich kopieren"). Für die EKD ist entscheidend, dass
  eine gute Challenge-Sammlung oder ein Aktivitätenkatalog einer Landeskirche
  nicht in Hunderten Gemeinden neu getippt wird — und dass Änderungen am
  Standardkatalog nicht nur künftige Gemeinden erreichen.
- **Was heute existiert:** Der Standardkatalog als Daten im Code
  (`organizations.js:369-616`), Termine kopieren (`EventDetailView`,
  CHANGELOG 2.2.0), `seedDefaultCertificates` als Nachzieh-Muster für Bestand
  (`organizations.js:1340-1369`), Challenges mit Entwurfsstatus
  (`80-challenges.md`, „Erst als Entwurf speichern").
- **Vorschlag:** (1) Den Startsatz aus dem Code in eine
  „Vorlagen-Organisation" (oder Tabelle `vorlagen` mit `verband_id`) ziehen,
  die der Betrieb und später Landeskirchen pflegen. (2) In der Leitung unter
  „Mehr" ein „Aus Vorlagen übernehmen" für Aktivitäten, Kategorien, Abzeichen
  und Challenges — Kopie in die eigene Gemeinde, danach frei änderbar,
  Namensdopplungen werden abgefangen (Kategorie-Unique, `45-jahrgaenge.md`).
  (3) Challenge-Vorlagen als Entwürfe importieren, wie heute die drei
  Beispiele.
- **Aufwand (grob):** M — Kopierlogik je Entität ist klein, der Katalog-Ort
  und die Rechte sind der Aufwand.
- **Risiken/Abhängigkeiten:** Kategorie-Abzeichen hängen am **Namen** der
  Kategorie (`60-badges.md`, „Wichtige Falle"); Vorlagen müssen Kategorien vor
  Abzeichen anlegen und Umbenennungen warnen. Keine Änderung an bestehenden
  Antwortformen.

### E-12: CSV-Import von Konfis mit Passwortliste

- **Für wen:** Leitung
- **Warum jetzt:** Konfis entstehen einzeln (`konfi-management.js:208-216`:
  `name, jahrgang_id`, generiertes Bibel-Passwort) oder per Einladungscode
  (`auth.js:930`). Einen Import gibt es nicht (grep `csv|import` in
  `backend/routes`: nur Dateityp-Prüfungen). Gemeinden haben ihre Konfi-Listen
  aus dem Meldewesen ohnehin als Tabelle; bei 40 Konfis ist Einzelanlage eine
  Stunde Arbeit, bei fehlender Handy-Nutzung einzelner Konfis der einzige Weg.
- **Was heute existiert:** `generateBiblicalPassword`, `generateUniqueUsername`
  (`konfi-management.js:215, 225`), Konfi-Limit mit Kulanz
  (`konfiLimit.js`), Datei-Typprüfung per Magic Bytes (`material.js:847-862`),
  Anwesenheits-Mail als HTML-Tabelle (`emailService.js:370`).
- **Vorschlag:** `POST /admin/konfis/import` mit CSV (Spalten: Name,
  optional E-Mail, Jahrgang), Vorschau mit Dopplungen, dann Anlage in einer
  Transaktion bis zum Limit; Rückgabe einer Passwortliste als CSV/PDF zum
  einmaligen Download. Die hochgeladene Datei wird nicht gespeichert.
- **Aufwand (grob):** M.
- **Risiken/Abhängigkeiten:** Passwortlisten sind heikel — nur einmal
  abrufbar, danach Reset über die Leitung (`35-passwoerter.md`, Weg 1). Format
  der Kirchenbuch-Programme ist unbekannt — deshalb generisches CSV, keine
  Direktanbindung (siehe E-33).

### E-13: Kalender-Export (ICS) und Termin-Abo — auch als Elterninformation

- **Für wen:** Konfi / Teamer:in / Eltern (indirekt)
- **Warum jetzt:** Termine leben nur in der App; es gibt kein ICS, keinen
  Kalender-Abo-Link (grep `ics|ical|text/calendar` ohne Treffer). Erinnerungen
  kommen als Push 1 Tag und 1 Stunde vorher (`backgroundService.js:661-760`).
  Eltern von 13-Jährigen planen den Familienkalender; heute erfahren sie
  Termine nur über das Kind oder den Elternbrief. Ein Abo-Link löst das ohne
  Elternrolle (siehe E-27).
- **Was heute existiert:** Terminfelder `event_date, event_end_time,
  location, location_maps_url, bring_items` (`prod-schema.sql:976-997`),
  Buchungsstatus je Konfi (`konfi.js:1125`), Jahrgangszuordnung, signierte
  Tokens als Muster (`docsAuth.js`, QR-Token).
- **Vorschlag:** (1) „In Kalender speichern" am Termin (ICS-Datei, nur dieser
  Termin, keine Teilnehmernamen). (2) Ein persönlicher Abo-Link
  `GET /kalender/:token.ics` mit den eigenen gebuchten Terminen und den
  Pflichtterminen des Jahrgangs; Token widerrufbar im Profil. (3) Optional ein
  Jahrgangs-Kalender ohne Personenbezug, den die Leitung als Link im
  Elternbrief weitergibt.
- **Aufwand (grob):** S–M — ICS ist Textformat; Aufwand liegt in Token und
  Tests.
- **Risiken/Abhängigkeiten:** Der Abo-Link ist ein Zugangsgeheimnis; nur
  Terminname, Zeit, Ort — keine Punkte, keine Teilnehmenden. Neue Route, kein
  Vertragseingriff.

### E-14: Jahrgangsabschluss — Export für Urkunden und Archivierung

- **Für wen:** Leitung
- **Warum jetzt:** Vor der Konfirmation braucht die Leitung Sprüche,
  Konfirmationsdatum, Anwesenheit und Punkte je Konfi; danach löscht die App
  ab Tag 60 (`backgroundService.js:1506-1530`). Heute gibt es dafür nur eine
  E-Mail mit HTML-Tabelle an die eigene Adresse der Admin:in
  (`jahrgaenge.js:665-760`, `emailService.js:370`) und die Matrix als JSON
  (`jahrgaenge.js:466`); der Challenge-Export ist eine Textdatei
  (`challenges.js:1977`). Keine Datei zum Ablegen in der Gemeindeakte, kein
  Hinweis in der Löschwarnung, wie man vorher sichert. Einen Zustand
  „Jahrgang abgeschlossen" gibt es nicht — Löschen ist blockiert, solange
  Konfis zugeordnet sind (`45-jahrgaenge.md`, „Einen Jahrgang löschen").
- **Was heute existiert:** Sprüche-Liste (`jahrgaenge.js:634`),
  Anwesenheits-Matrix, Punkte-Historie (`konfi.js:588`), Wrapped-Ausgaben je
  Jahrgang (`wrapped.js:2894`), Löschwarnung mit Mail und Push
  (`backgroundService.js:1313-1420`).
- **Vorschlag:** (1) `GET /admin/jahrgaenge/:id/abschluss.csv` (und PDF):
  Name, Konfirmationstermin, Spruch mit Übersetzung, Pflichttermine
  anwesend/gesamt, Punkte je Art. (2) Der Link dazu steht in der
  Löschwarnung. (3) Ein Zustand „abgeschlossen" am Jahrgang: schreibgeschützt
  für Konfis (keine Anträge, kein Chat-Schreiben), sichtbar für die Leitung
  bis zur Hard-Löschung; startet den Stichtag, wenn kein Konfirmationstermin
  existiert (E-02).
- **Aufwand (grob):** M.
- **Risiken/Abhängigkeiten:** Der Export enthält Personendaten Minderjähriger
  — nur für die Leitung, Download protokollieren. Die Konfispruch-Texte sind
  aus Lizenzgründen nur für zwei Übersetzungen hinterlegt (CHANGELOG 2.1.0);
  der Export gibt Stelle und Text, wo vorhanden.

### E-15: Nachricht melden und Konfi im Raum stummschalten

- **Für wen:** Konfi / Teamer:in / Leitung
- **Warum jetzt:** Der Chat ist bewusst eng geführt: Konfis erreichen einander
  nie direkt, sechs positive Reaktionen (`chat.js:2579`), die Leitung kann jeden
  Gruppenraum lesen und fremde Nachrichten löschen (`90-chat.md`, „Wer wen
  anschreiben darf", „Nachvollziehen, was die Leitung sehen kann"). Was fehlt:
  ein Weg für Konfis, eine Nachricht zu **melden**, und ein Weg für die
  Leitung, eine Person im Jahrgangs-Chat vorübergehend stumm zu schalten (grep
  `melden|report|block|mute` in `chat.js` ohne Treffer). Bei 6 Gemeinden liest
  Simon mit; bei Hunderten Jahrgangs-Chats mit 13-Jährigen muss die Meldung
  vom Kind ausgehen können.
- **Was heute existiert:** Postfach-Arten für die Leitung
  (`backend/utils/postfachArten.js`), Push-Gruppe „Anfragen und Freigaben"
  (`pushGruppen.js:66-71`), Nachricht löschen durch Leitung (`90-chat.md`),
  Raum-Zugriffsprüfung (`backend/utils/chatRoomAccess.js`).
- **Vorschlag:** (1) „Nachricht melden" im Nachrichtenmenü für alle Rollen →
  Eintrag im Postfach der Leitung dieser Gemeinde mit Sprung zur Nachricht;
  kein Push an den Absender. (2) „Stummschalten bis …" je Teilnehmer:in in
  Jahrgangs- und Gruppenräumen (Server lehnt Nachrichten ab, Lesen bleibt).
  (3) Eine Moderationsliste „Gemeldete Nachrichten" unter „Mehr".
- **Aufwand (grob):** M.
- **Risiken/Abhängigkeiten:** Neue Routen; alte Apps zeigen den Menüpunkt
  nicht, funktionieren aber weiter. Stummschaltung muss der Server
  durchsetzen, nicht die Oberfläche. Wortfilter bewusst nicht (E-28).

### E-16: Nachtruhe für Push je Gemeinde

- **Für wen:** Konfi / Leitung
- **Warum jetzt:** Push geht sofort raus, unabhängig von der Uhrzeit — Chat,
  Freigaben, Punkte (`pushService.js`, kein Zeitfenster; grep
  `quiet|nacht|ruhe` ohne Treffer). Die Tageserinnerung „Morgen: …" wird zur
  Uhrzeit des Termins am Vortag verschickt (`backgroundService.js:666-670`:
  `now + 24h`, Fenster ±15 Minuten) — ein Termin um 22:00 erinnert um 22:00.
  Eine Leitung, die um 23:30 Anträge verbucht, weckt Konfis. Für Minderjährige
  ist eine Nachtruhe ein erwartbarer Standard.
- **Was heute existiert:** Vier Push-Gruppen mit Abwahl je Person
  (`pushGruppen.js`, Migration 158), Postfach als Rückfall (alles steht dort,
  `03-bedienung.md`), Cron-Zeitzone Europe/Berlin (`compose.konfi_quest.yml:64`).
- **Vorschlag:** Einstellung je Gemeinde `push_ruhe_von/bis` (Vorgabe 21–7
  Uhr) in `settings`; Pushes der Gruppen Chat und Fortschritt werden in der
  Ruhezeit nicht gesendet, sondern beim Ende der Ruhezeit als eine
  Sammelmeldung („3 neue Mitteilungen"); Termin-Erinnerungen „gleich" und
  Absagen bleiben ausgenommen; die Tageserinnerung wird auf eine feste Uhrzeit
  (z. B. 18:00 am Vortag) gelegt.
- **Aufwand (grob):** S–M — Zeitfensterprüfung an einer Stelle
  (`getTokensForUser`/`sendToUser`, `pushService.js:689`), eine Warteschlange
  für die Sammelmeldung.
- **Risiken/Abhängigkeiten:** Keine Formänderung. Sammelmeldungen brauchen
  eigene Push-Art und Postfach-Eintrag; Test in `pushGruppenAuswahl.test.js`
  prüft Vollständigkeit der Arten.

### E-17: Feature-Schalter je Gemeinde

- **Für wen:** Leitung / Landeskirche / Betrieb
- **Warum jetzt:** `settings` kennt 15 Schlüssel, alle Dashboard-Kacheln und
  deren Reihenfolge (`settings.js:11-26`); es gibt keinen Schalter, der einen
  ganzen Bereich abschaltet — Chat, Challenges, Ranking, Rückblick, Tageslosung
  (grep `feature` in `backend` ohne Treffer). Die Reiter sind je Rolle fest
  (`frontend/src/navigation/rollenBaeume.ts:182-310`). Bei Hunderten Gemeinden
  wird es solche geben, die keinen Chat mit Minderjährigen betreiben wollen
  oder nur die Terminfunktion brauchen. Ohne Schalter ist die Antwort heute
  „geht nicht".
- **Was heute existiert:** `settings` je Gemeinde mit `ON CONFLICT`-Upsert
  (`settings.js:152-168`), Live-Update an die Gemeinde nach dem Speichern
  (`:176`), Rollenbäume als Tabelle mit Tabs (`rollenBaeume.ts`), serverseitige
  Guards je Route.
- **Vorschlag:** Additive Schlüssel `feature_chat`, `feature_challenges`,
  `feature_ranking`, `feature_wrapped`, `feature_losung` (Vorgabe an). Die App
  blendet Reiter aus; **der Server** liefert bei abgeschaltetem Bereich 403
  oder leere Listen — sonst zeigen 2.2.x-Apps den Reiter weiter. Optional ein
  Vorgabe-Satz je Landeskirche (E-10).
- **Aufwand (grob):** M — der Schalter ist klein, das Durchsetzen an den
  Routen und das Ausblenden in drei Rollenbäumen ist die Arbeit.
- **Risiken/Abhängigkeiten:** Abschalten des Chats lässt Jahrgangs-Räume mit
  Inhalt zurück — Verhalten definieren (lesen ja, schreiben nein). Postfach und
  Zähler müssen den Bereich ebenfalls ausnehmen (`notifications.js:42`).

### E-18: Fehler melden aus der App

- **Für wen:** alle Rollen / Betrieb
- **Warum jetzt:** Abstürze werden automatisch und ohne Personenbezug gemeldet
  (`absturzdiagnose.ts`, CHANGELOG Unreleased „Sonstiges"); Fehler mit Art und
  Ort werden gezählt (CHANGELOG 2.2.0 „Sonstiges"). Was fehlt, ist der Weg für
  Menschen: „Das hier stimmt nicht" mit Bildschirm, Version, Rolle, Gemeinde —
  ohne dass die Person erst eine Mail formuliert. Der Betrieb kann bei 25.000
  Nutzer:innen nicht aus Einzelmails rekonstruieren, welche Fassung auf
  welchem Gerät lief.
- **Was heute existiert:** Fehlerdiagnose-Hilfen (`frontend/src/utils/fehler.ts`,
  `__tests__/services/fehlerdiagnose.test.ts`), Umami-Ereignisse mit Rolle
  (`analytics.ts`), Kontaktadresse.
- **Vorschlag:** „Problem melden" unter „Hilfe" (E-04): Freitext + automatisch
  Version, Plattform, Rolle, Gemeinde-ID, letzte Route (keine Namen); Versand
  an eine Betriebs-Mailbox oder ein Ticket-Postfach. Für die Leitung
  zusätzlich „Vorschlag einreichen".
- **Aufwand (grob):** S.
- **Risiken/Abhängigkeiten:** Rate-Limit gegen Spam (Muster
  `server.js:279-297`); Freitext von Minderjährigen kann Personendaten
  enthalten — Hinweis im Formular, kurze Aufbewahrung.

### E-19: Öffentliche Statusseite und Störungshinweis

- **Für wen:** Leitung / Betrieb
- **Warum jetzt:** `/api/status` liefert Version, Commit, Datenbank-Zustand
  als JSON (`createApp.js:394-413`); der Rolling-Deploy liest es
  (`deploy/rolling-deploy.sh:95-110`). Für Menschen gibt es keine Seite „Läuft
  die App gerade?". Beim Ausfall vom 09./10.09.2026 (`offene-befunde.md`,
  Nr. 3) hätten Leitungen nur raten können. Bei Hunderten Gemeinden ist die
  Statusseite die erste Support-Entlastung.
- **Was heute existiert:** `/api/health`, `/api/status`, Traefik-Healthchecks
  (`compose.konfi_quest.yml:125-129`), Betriebs-Dashboard für Super-Admins
  (`AdminMetricsPage.tsx`), Banner-Muster in der App.
- **Vorschlag:** Externe Statusseite (statisch gehostet, unabhängig vom
  Stack), gespeist aus `/api/status` und einem Wartungskalender; der
  `notice`-Text aus E-05 erscheint auch dort. Link „Status" in der Hilfe.
- **Aufwand (grob):** S.
- **Risiken/Abhängigkeiten:** Die Seite darf nicht auf demselben Host liegen
  wie der Stack, sonst fällt sie mit aus.

### E-20: Speicher- und Mengen-Kennzahlen je Gemeinde (Grundlage für das Kostenmodell)

- **Für wen:** Betrieb / Landeskirche
- **Warum jetzt:** Push ist über Firebase kostenfrei (`backend/push/firebase.js`,
  `sendEach`), Mail läuft über den eigenen SMTP-Server mit sieben
  Vorlagen (`emailService.js:155-370`), Speicher liegt auf lokaler Platte
  (`compose.konfi_quest.yml:82`). Es gibt keine Zahl je Gemeinde für
  Dateivolumen, Nachrichten oder Push-Zustellungen; der einzige Mengenbezug im
  Code ist die Postfach-Hochrechnung (`backgroundService.js:1104-1113`). Ohne
  Kennzahlen lässt sich weder ein Preis je Gemeinde begründen noch erkennen,
  wann `/opt/Konfi-Quest/uploads` voll ist.
- **Was heute existiert:** Dateigrößen in `chat_messages.file_size` und
  `material_files.size` (`chat.js:1157, material.js:882`), Zähler je Gemeinde
  in `GET /organizations` (`organizations.js:78-118`), APM-Snapshots alle
  fünf Minuten (`backgroundService.js:1548-1580`), Postgres-Poolstand im
  Snapshot (`createApp.js:416-434`).
- **Vorschlag:** Additive Felder in `GET /organizations`: Summe Dateigrößen
  (Chat, Material, Challenges, Nachweisfotos), Nachrichten letzte 30 Tage,
  Push-Zustellungen letzte 30 Tage, letzte Aktivität; ein nächtlicher Lauf
  schreibt sie in eine Tabelle `org_kennzahlen`. Daraus: Plattengröße je
  Gemeinde → Quote je Lizenz, Hochrechnung für 25.000 Nutzer:innen mit
  gemessenen statt geschätzten Werten.
- **Aufwand (grob):** S.
- **Risiken/Abhängigkeiten:** Challenge-Dateien liegen verschlüsselt mit
  Zufallsnamen (`80-challenges.md`, „Wo die Dateien liegen"); Größe muss beim
  Upload mitgeschrieben werden, falls noch nicht (prüfen an
  `challenge_submissions`).

### E-21: Selbstauskunft — Datenexport für das eigene Konto

- **Für wen:** Konfi / Teamer:in / Leitung
- **Warum jetzt:** Das Löschrecht ist Selbstbedienung (`auth.js:374`,
  `DeleteAccountModal.tsx`); das Auskunftsrecht (§ 19 DSG-EKD) läuft über
  E-Mail an den Betreiber (`konto-loeschen.html`, Abschnitt „Fragen?"). Bei
  25.000 Nutzer:innen pro Jahr sind auch wenige Promille Anfragen ein
  wöchentlicher Handgriff mit Datenbankzugriff.
- **Was heute existiert:** Die Löschkaskade kennt alle 16 abhängigen Tabellen
  (`konfiDeletion.js`) — dieselbe Liste ist der Export. Punkte-Historie
  (`konfi.js:588`), eigene Beiträge (`challenges.js:440-581`), eigene
  Nachrichten, Buchungen, Abzeichen.
- **Vorschlag:** `GET /auth/meine-daten` liefert eine JSON- oder ZIP-Datei mit
  allen Zeilen, die der Person zugeordnet sind (ohne fremde Chat-Nachrichten,
  ohne Interna der Leitung), plus Liste der Dateien; Abruf mit
  Passwortbestätigung wie beim Löschen, Rate-Limit 1/Tag.
- **Aufwand (grob):** M.
- **Risiken/Abhängigkeiten:** Chat-Nachrichten anderer enthalten die Person
  als Empfänger — nur eigene Nachrichten exportieren. Große Dateien (Videos) als
  Liste mit Einzeldownload, nicht als ZIP im Speicher (Lehre aus dem
  Upload-Umbau, CHANGELOG Unreleased).

### C) Danach

### E-22: Material und Aufgaben für Konfis

- **Für wen:** Konfi / Leitung
- **Warum:** Material ist ausschließlich Teamsache (`material.js:260`
  `requireTeamer`; `30-leitung.md`: „Konfis sehen Material nicht"). Konfis
  haben keinen Ort für Arbeitsblätter, Liedtexte oder eine Aufgabe „bis
  nächste Woche" — Challenges decken den kreativen Teil ab (`80-challenges.md`),
  aber ausdrücklich ohne Pflicht und ohne Punkte. Ob Gemeinden das wollen, ist
  offen (Frage 6).
- **Was heute existiert:** Material mit Dateien und Links, Jahrgangs- und
  Terminbindung, verschlüsselte Ablage bis 20 MB (`material.js`,
  `90-chat.md`), Termin-Feld `bring_items` (`prod-schema.sql:997`).
- **Vorschlag:** Sichtbarkeit „auch für Konfis der zugeordneten Jahrgänge" je
  Material (additive Spalte), Anzeige am Termin und in einem Abschnitt der
  Konfi-Startseite; keine eigene Aufgabenverwaltung.
- **Aufwand (grob):** M.
- **Risiken/Abhängigkeiten:** Neue Konfi-Route für Materialdateien mit
  Rechteprüfung; Speicherwachstum (E-20).

### E-23: Ehrenamtsnachweis für Teamer:innen als Dokument

- **Für wen:** Teamer:in / Leitung
- **Warum:** Zertifikate mit Gültigkeit existieren (JuLeiCa, Teamer-Card,
  Erste Hilfe, Rettungsschwimmer; `teamer.js:447-651`, `organizations.js:444-451`),
  der Team-Rückblick zählt Einsätze und Jahre (`95-wrapped.md`, „Die Seiten des
  Teamer-Rückblicks"). Ein ausdruckbarer Nachweis für Bewerbungen oder die
  JuLeiCa-Verlängerung fehlt (grep `urkunde|pdf` in Routen ohne Treffer).
- **Vorschlag:** „Engagement-Nachweis" als PDF aus dem Profil: Zeitraum,
  begleitete Termine, Aktivitäten, Zertifikate, unterschrieben von der
  Gemeinde (Name aus Org-Stammdaten). Stunden werden nicht erfasst — nur
  Termine mit Dauer (`event_end_time`).
- **Aufwand (grob):** M.
- **Risiken/Abhängigkeiten:** Rechtlich ist das ein Dokument der Gemeinde;
  Freigabe durch die Leitung, nicht Selbstbedienung.

### E-24: Mehrjahresvergleich für die Leitung

- **Für wen:** Leitung / Landeskirche
- **Warum:** Wrapped-Ausgaben und Team-Rückblicke liegen je Jahrgang bzw.
  Jahr (`wrapped.js:2894, 2824`), die Anwesenheits-Matrix je Jahrgang
  (`jahrgaenge.js:466`). Eine Sicht „Jahrgang 2025 gegen 2026" gibt es nicht.
  Nach dem ersten vollen EKD-Jahr wird die Frage kommen.
- **Vorschlag:** Eine Leitungsseite „Jahrgänge im Vergleich" mit Kennzahlen
  je Jahrgang aus den eingefrorenen Wrapped-Daten (Teilnahme, Punkte,
  Challenges) — ohne Personenbezug, damit sie die Löschung überlebt.
- **Aufwand (grob):** M.
- **Risiken/Abhängigkeiten:** Nach der Hard-Löschung existieren nur noch
  Aggregate, wenn sie vorher geschrieben wurden — hängt an E-14.

### E-25: Objektspeicher und Mandanten-Quoten

- **Für wen:** Betrieb
- **Warum:** Uploads liegen auf einer Host-Platte im Container-Pfad
  (`photoStorage.js:10-13`, `compose.konfi_quest.yml:82`), drei Container
  teilen das Volume. Bei 25.000 Nutzer:innen mit Challenge-Videos bis 50 MB
  entscheidet die Platte über den Betrieb; ein zweiter Host ist ohne
  gemeinsamen Speicher nicht möglich.
- **Vorschlag:** Speicher-Schnittstelle hinter `photoStorage.js` (heute
  `fs`), S3-kompatibler Speicher als zweite Implementierung; Quote je Gemeinde
  aus E-20. Erst nach gemessenen Zahlen, nicht vorher.
- **Aufwand (grob):** L.
- **Risiken/Abhängigkeiten:** Verschlüsselung (`photoCrypto.js`) und
  Stream-Uploads (CHANGELOG Unreleased) müssen erhalten bleiben.

### E-26: Delegierte Gemeindeverwaltung durch Kirchenkreise

- **Für wen:** Landeskirche / Betrieb
- **Warum:** Folgt aus E-03 und E-10: Wenn Kirchenkreise Gemeinden selbst
  anlegen, Org-Admins zurücksetzen und Lizenzen zuordnen dürfen, entfällt der
  Super-Admin als Engpass. Heute kann das nur das globale Flag
  (`rbac.js:263-270`), das **alle** Gemeinden sieht.
- **Vorschlag:** Die Verbandsrolle aus E-10 um Schreibrechte auf
  „Gemeinde anlegen im eigenen Verband" und „Org-Admin nachsetzen" erweitern;
  Protokoll aller Verwaltungsaktionen.
- **Aufwand (grob):** L.
- **Risiken/Abhängigkeiten:** Rechtemodell wird dreistufig; alle
  `requireSuperAdmin`-Stellen (`organizations.js`) brauchen eine
  Verbands-Variante mit Tests für den verbotenen und den erlaubten Fall.

### D) Bewusst nicht empfohlen

### E-27: Eltern-Konten oder Elternrolle

- **Begründung:** Eine sechste Rolle, die Chats, Beiträge oder Punkte eines
  Kindes einsieht, widerspricht der Datenminimierung, die die App an vielen
  Stellen bewusst verfolgt (anonyme Beiträge, deren Name „den Server gar nicht
  erst verlässt", `80-challenges.md`; Umami ohne Organisation,
  `analytics.ts:12-15`), und würde das Rechtemodell (`rbac.js`, `roleHierarchy.js`)
  an jeder jahrgangsgebundenen Stelle berühren. Der Informationsbedarf der
  Eltern — Termine, Ort, Mitbringsel — lässt sich ohne Personenkonto decken
  (E-13, Elternbrief). Aufwand wäre L, Nutzen unklar (offene Frage 5).

### E-28: Wortfilter im Chat

- **Begründung:** Der Chat ist strukturell entschärft: keine
  Konfi-zu-Konfi-Direktnachrichten, nur positive Reaktionen (`chat.js:2579`),
  Leitung liest jeden Gruppenraum mit und löscht (`90-chat.md`). Ein Wortfilter
  auf Jugendsprache erzeugt Fehlalarme und ersetzt keine Moderation; Melden
  und Stummschalten (E-15) wirken zielgenauer.

### E-29: Zwangsupdate oder harte Sperre alter App-Versionen

- **Begründung:** `updateCheck.ts:13-16` hält fest, dass eine gesperrte App
  bei Apple ein Ablehnungsgrund wäre; die Abrissliste setzt auf Zählung im
  Zugriffslog statt auf Zwang (`docs/api/ABRISS.md`). Der Mindestversions-
  Hinweis (E-05) plus API-Vertrag reicht; eine harte Sperre würde ausgerechnet
  die Konfis treffen, die selten aktualisieren.

### E-30: Mehrsprachigkeit

- **Begründung:** Es gibt kein Übersetzungssystem; alle Texte stehen als
  deutsche Zeichenketten in Komponenten und Routen (grep `i18n|useTranslation`
  ohne Treffer). Zielgruppe der EKD-Ausrollung sind deutschsprachige Gemeinden;
  eine Umstellung wäre L (Tausende Strings, Handbuch, Push-Texte in
  `pushText.js`) bei geringem Nutzen. Einzelne mehrsprachige Elemente
  (Bibelübersetzungen) existieren fachlich bereits (`konfspruch.js`).

### E-31: Terminverwaltung für Teamer:innen wieder öffnen

- **Begründung:** Simons Entscheidung vom 16.09.2026: Teamer:innen verwalten
  Termine nicht (`offene-befunde.md`, Nr. 13; CHANGELOG 2.2.0 „Geändert").
  Für Ehrenamts-Leitungen mag der Wunsch nach Delegation kommen — dann als
  bewusste Rücknahme dieser Entscheidung, nicht als Nebenwirkung. QR-Check-in
  bleibt für Teamer:innen offen (`checkin.js:276`).

### E-32: Direktnachrichten zwischen Konfis

- **Begründung:** Bewusst ausgeschlossen („Konfis erreichen einander nie",
  `90-chat.md`); der Jahrgangs-Chat ist der moderierte Raum. Bei 13-Jährigen
  ist das die richtige Grenze; jede Öffnung erzeugt Moderationslast ohne
  Gegenwert für den Konfi-Unterricht.

### E-33: Direkte Schnittstellen zu Kirchenbuch- oder Meldewesen-Systemen

- **Begründung:** Welche Systeme die Gemeinden der EKD-Landeskirchen nutzen
  und ob deren Anbieter Schnittstellen freigeben, ist aus dem Repo nicht
  ersichtlich und mir nicht bekannt. Ein CSV-Import (E-12) deckt den Bedarf
  zunächst; eine Direktanbindung wäre eine Erfindung ohne Gegenstelle. Offene
  Frage 7.

## Priorisierte Reihenfolge (Top 10)

1. **E-01 Rechtstexte und Einwilligung in der App** — betrifft jede:n der
   25.000 Minderjährigen, ist klein und vor der ersten Registrierung einer
   EKD-Gemeinde nötig.
2. **E-05 Wartungshinweis und Mindestversion** — muss in 2.3.0 stecken, sonst
   fehlt dem gesamten Rollout-Bestand der Kanal für Betriebsmeldungen.
3. **E-03 Gemeinden anlegen ohne Flaschenhals** — ohne Antragsweg und
   EKD-Vorgabe wird jede Gemeinde nach 30 Tagen still gesperrt oder wartet auf
   Simon.
4. **E-02 Löschfrist auch ohne Konfirmationstermin** — die Aufbewahrung
   Minderjähriger darf nicht daran hängen, ob eine Leitung ein Häkchen setzt.
5. **E-04 Hilfe und Support in der App** — der größte Hebel gegen
   Support-Last bei Ehrenamtlichen; alle Inhalte existieren.
6. **E-17 Feature-Schalter je Gemeinde** — gibt Landeskirchen und Gemeinden
   die Wahl (Chat ja/nein) und ist Voraussetzung für Vorgaben je Verband.
7. **E-15 Nachricht melden und Stummschalten** — Jugendschutz, der vom Kind
   ausgehen kann; die Moderationsansicht der Leitung fehlt sonst bei Hunderten
   Chats.
8. **E-14 Jahrgangsabschluss mit Export** — trifft jede Gemeinde im ersten
   Jahr vor der Konfirmation; heute nur eine HTML-Mail.
9. **E-11 Vorlagenkatalog** — verhindert, dass Hunderte Gemeinden denselben
   Katalog neu bauen; macht Landeskirchen-Inhalte verteilbar.
10. **E-10 Verbandsebene mit anonymen Kennzahlen** — die EKD wird Zahlen
    verlangen; heute gibt es nur Super-Admin-Sichten mit Kontaktdaten.

E-12 (CSV-Import), E-13 (ICS) und E-16 (Nachtruhe) folgen direkt danach; sie
sind klein, aber weniger dringend als die Punkte oben.

## Offene Produktfragen an Simon

1. **Einwilligung der Eltern:** Bleibt es beim schriftlichen Verfahren der
   Gemeinde außerhalb der App (`datenschutz.html:290-291`), oder soll die App
   die Zustimmung dokumentieren (E-01)? Wer ist Verantwortlicher im Sinne des
   DSG-EKD — die Gemeinde, die Landeskirche oder der Betreiber?
2. **Löschfristen:** Sind 60/120 Tage nach Konfirmation
   (`backgroundService.js:1460-1530`) mit der EKD abgestimmt, und gelten sie
   für alle Landeskirchen gleich? Was passiert mit Jahrgängen ohne
   Konfirmationstermin (E-02)?
3. **Wer legt Gemeinden an?** Jede Pastorin per Antrag, nur Kirchenkreise,
   oder die EKD zentral per Liste (E-03)? Gilt das 30-Tage-Trial- und
   Tarifmodell (`konfiLimit.js:12`, `landing.html:156`) im EKD-Vertrag
   weiter, oder ist es eine Pauschallizenz?
4. **Verbandsebene:** Soll es eine Sicht für Kirchenkreis oder Landeskirche
   geben, und mit welchen Rechten — nur Zahlen (E-10) oder auch Verwaltung
   (E-26)? Welche Mindestgröße für ausgewiesene Kennzahlen?
5. **Eltern:** Reicht Elterninformation über Kalender-Abo und Elternbrief
   (E-13), oder erwartet die EKD eine Elternrolle (E-27, nicht empfohlen)?
6. **Material für Konfis:** Wollen Gemeinden Arbeitsblätter und Aufgaben in
   der App (E-22), oder bleibt Konfi Quest bewusst bei Punkten, Terminen und
   Challenges?
7. **Datenaustausch:** Welche Kirchenbuch- oder Meldewesen-Programme nutzen
   die Zielgemeinden, und liegt ein Exportformat vor, auf das ein CSV-Import
   (E-12) zugeschnitten werden sollte (E-33)?
8. **Chat je Gemeinde abschaltbar?** Ist ein Konfi-Jahrgang ohne Chat für
   Simon ein gültiger Betriebsmodus (E-17), und wie soll die Leitung dann
   Gruppenabsprachen treffen?
9. **Support-Modell:** Wer beantwortet Anfragen aus Hunderten Gemeinden —
   der Betrieb, die Landeskirche, ein Ticketsystem? Davon hängt ab, wohin
   „Problem melden" (E-18) und die Hilfe (E-04) verweisen.
10. **Ranking:** Soll das Ranking in neuen Gemeinden aus sein (E-06), und
    darf die Antwort weiterhin Klarnamen der drei Punktbesten an jeden Konfi
    liefern, bis alle Apps umgestellt sind?
