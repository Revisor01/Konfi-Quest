# Changelog

Alle nennenswerten Änderungen an Konfi Quest werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
die Versionierung folgt [Semantic Versioning](https://semver.org/lang/de/).
Store-Builds (iOS-Build / Android versionCode) stehen jeweils unter der
Versionsüberschrift.

## [Unreleased] - 2.0.0

Diese Version setzt iPhone und iPad mit iOS 16.4 oder neuer voraus. Auf
älteren Geräten bleibt die zuletzt installierte Version nutzbar.

### Hinzugefügt

- Challenges: Beim Ausblenden eines Beitrags kann die Leitung eine Begründung
  eintragen — die einreichende Person sieht sie bei ihrem Beitrag und bekommt
  eine Mitteilung. Die Begründung ist freiwillig, Ausblenden geht auch ohne.
- Teamer-Dashboard: Laufende Challenges erscheinen jetzt auch auf der
  Startseite der Teamer:innen, mit Restzeit und Absprung in den
  Challenges-Bereich. Die Leitung kann die Karte in den
  Dashboard-Einstellungen abschalten.
- Teamer:innen sehen ihren Konfispruch auf der Startseite: Wer als Konfi
  einen gewählt hatte, bringt ihn mit; alle anderen können ihn dort
  eintragen — aus der Liste oder als eigener Spruch. Die Leitung kann die
  Karte in den Dashboard-Einstellungen abschalten; der dortige
  Konfispruch-Schalter wirkt jetzt auch für das Konfi-Dashboard.
- Handbuch unter konfi-quest.de/docs: erklärt für Konfis, Teamer:innen und die
  Leitung getrennt, was sie in der App tun können. Auf der Startseite oben in
  der Navigation, bei den häufigen Fragen und im Fußbereich verlinkt. Dazu
  Nachschlage-Kapitel zu Passwörtern und Zugängen sowie zu den Abzeichen und
  ihren Bedingungen.
- Chat-Verlauf exportieren: Die Leitung kann einen kompletten Chat als
  Textdatei sichern — etwa um Beiträge für einen Gottesdienst zu sammeln.
  Zu finden über das Menü oben rechts im Chat.
- Challenges: Aufgaben, auf die Konfis über einen frei gewählten Zeitraum mit
  eigenen Beiträgen antworten — Foto, Text, Aufnahme oder Link. Bewusst ohne
  Punkte, ohne Zähler und ohne Rangliste; fürs Mitmachen gibt es ein Abzeichen.
- Challenges: Beim Anlegen werden Jahrgänge, Zeitraum, erlaubte Medienarten,
  Sichtbarkeit und Freigabe festgelegt. Nach dem Start bleiben Sichtbarkeit und
  Freigabe unveränderlich — die Zusage an die Konfis gilt.
- Challenges: Konfis entscheiden je Beitrag, ob er mit Namen, anonym oder nur
  für die Leitung sichtbar ist.
- Challenges: Teamer:innen und Leitung nehmen selbst teil; es gibt auch Runden
  nur fürs Team.
- Challenges: Die Leitung kann Beiträge freigeben, nachträglich anonymisieren
  oder ausblenden. Anonymisieren lässt sich nicht zurücknehmen.
- Veranstaltungen: eigenes Kontingent für Teamer:innen mit eigener Warteliste,
  getrennt von den Plätzen der Konfis.
- Veranstaltungen: Termine nur für Teamer:innen sowie Termine, zu denen
  Teamer:innen gesucht werden.
- Veranstaltungen: Anmeldung kann ab sofort geöffnet werden, ohne Startdatum.
- Teamer-Profil: Die Leitung sieht dort jetzt auch die Abzeichen der
  Teamer:in — bisher gab es die Übersicht nur für Konfis.
- Anonyme Nutzungsstatistik in der App: erfasst wird, welche Bereiche und
  Funktionen genutzt werden und wo Fehlermeldungen erscheinen — ohne Namen,
  Kennung, Gemeinde oder Inhalte. Näheres in der Datenschutzerklärung.

### Geändert

- Umfrage im Chat: Die Einstellungs-Schalter sehen jetzt aus wie beim
  Challenge-Erstellen, und die Erklärungstexte brechen mehrzeilig um, statt
  auf schmalen Bildschirmen abgeschnitten zu werden.
- Handbuch: Auf dem Handy steckt das Inhaltsverzeichnis jetzt hinter einer
  schmalen Leiste, die beim Lesen oben mitläuft — mit Kapitelnummer, Titel und
  einem Knopf zum Aufklappen. Der Kapitelinhalt beginnt damit direkt oben,
  statt erst nach einem halben Bildschirm Navigation.
- Handbuch: Die Kapitel verweisen aufeinander wie in einem Wiki — wo ein
  Begriff in einem anderen Kapitel erklärt wird, führt jetzt ein Link direkt
  zum passenden Abschnitt.
- Challenges: Das Abzeichen fürs Mitmachen gibt es bei moderierten Challenges
  erst, wenn der Beitrag freigegeben wurde; ohne Freigabe-Pflicht weiterhin
  sofort. Gilt für alle gleich, auch für Teamer:innen und Leitung.
- Challenges: Die Beitragsliste der Leitung zeigt im Reiter "Feed" nur noch,
  was auch die Konfis sehen — Wartendes und Ausgeblendetes steht in eigenen
  Reitern.
- Challenges: Die Leitung kann jetzt jeden Beitrag nachträglich anonym
  stellen, auch in Runden ohne eigene Sichtbarkeits-Wahl und bei Beiträgen
  von Teamer:innen. Wie bisher gilt: Das lässt sich nicht rückgängig machen.
- Challenges: Eigene Beiträge der Leitung haben keine "Ausblenden"-Aktion
  mehr — sie war dort ohne Nutzen.
- Challenges: Entwürfe stehen jetzt im Reiter "Geplant" statt unter "Aktuell" —
  dort steht nur noch, was wirklich läuft.
- Challenges: In der geöffneten Challenge gibt es oben einen Bearbeiten-Knopf —
  bisher ging Bearbeiten nur über das Wischen in der Liste.
- Challenges: Ein Entwurf braucht kein Start- und Enddatum mehr; der Zeitraum
  wird erst beim Einplanen festgelegt.
- Challenges: Klarere Beschriftungen — die Sichtbarkeit "Konfi entscheidet"
  heißt jetzt "Selbst entscheiden" (sie gilt auch fürs Team), "Nur für euch
  in der Leitung" kurz "Nur Leitung", und wartende Freigaben zeigen in der
  Liste nur noch Zahl und Uhr statt "5 offen".
- Challenges: In der geöffneten Challenge steht unter "Worum geht es" jetzt
  auch, wer die Beiträge sieht und ob sie sofort oder erst nach Freigabe
  erscheinen — der separate Hinweis-Kasten ist dafür entfallen.
- Challenges: Beim Einreichen steht der Hinweis, wer den Beitrag sieht, jetzt
  direkt in der Kopf-Überschrift statt in einem eigenen Kasten darüber.
- Challenges: Die erklärenden Hinweise zu Abzeichen, Zeitraum und Sichtbarkeit
  stehen nicht mehr im Anlegen-Formular, sondern im Handbuch-Kapitel
  Challenges.
- Challenges: Freigegebene Beiträge tragen jetzt denselben dunkleren Grünton
  wie laufende Challenges — der bisherige helle Ton war schwer lesbar.
- Das Handbuch ist auf der Website jetzt oben in der Navigation und im Text
  bei den häufigen Fragen verlinkt — bisher nur ganz unten im Fußbereich. Auf
  dem Handy steht es als Symbol neben den Store-Links.
- Aus dem Handbuch führt jetzt ein Verweis zur Schnittstellen-Referenz.
- Im Bereich Mitmachen wechselt die Überschrift jetzt mit: Beim Umschalten auf
  Aktivitäten steht dort auch "Aktivitäten" statt weiterhin "Events".
- Beim Anlegen eines Konfis wird der Jahrgang jetzt aus einer Liste ausgewählt
  statt aus einem Aufklappmenü — wie beim Anlegen von Teamer:innen.
- Das Handbuch steht jetzt Kapitel für Kapitel auf eigenen Seiten statt
  gesammelt auf einer. Die Kapitel sind nummeriert, sodass man sich darauf
  beziehen kann ("steht in Kapitel 7"), und unten geht es mit einem Klick zum
  vorherigen oder nächsten weiter.
- Material mit Jahrgang sehen nur noch die Teamer:innen dieses Jahrgangs;
  Material ohne Jahrgang weiterhin alle. Die Leitung sieht wie bisher alles.
  Bisher war die Zuordnung nur eine Sortierhilfe, und jede Teamer:in sah jedes
  Dokument. Beim Anlegen steht jetzt dabei, wer es dadurch zu sehen bekommt.
- Der Tab "Events" heißt jetzt "Mitmachen" — er trägt Termine und Aktivitäten
  gemeinsam und hieß bisher wie einer seiner eigenen Bereiche.
- App-Tour und "Was ist neu" stellen für alle drei Rollen den Mitmachen-Tab
  mit seinen beiden Reitern vor — samt dem Unterschied: zu Events meldet man
  sich vorher an, Aktivitäten meldet man hinterher und sie werden bestätigt.
  Bisher sprachen die Touren dort noch vom "Events-Tab".
- Chat: Private Zweiergespräche kann nur noch lesen und exportieren, wer selbst
  daran beteiligt ist. Gruppen-, Jahrgangs- und Team-Chats bleiben für die
  Leitung wie bisher zugänglich.

- Die Zahlen oben im Kopfbereich sind antippbar und springen zum passenden
  Reiter — etwa von "Verbuchen" direkt in die Liste der offenen Verbuchungen.
- Aus "Anträgen" werden "Aktivitäten" — überall in der App, vom Reiter bis zu
  den Meldungen. Gemeint ist dasselbe: gemeldet wird, was schon passiert ist.
- Profil: "Was ist neu?" steht jetzt als eigener Punkt über den Einstellungen
  statt darin — bei Konfis, Teamer:innen und der Leitung an derselben Stelle.
- Konfi-Übersicht: Der Plus-Button legt jetzt eine Teamer:in an, wenn die
  Teamer-Liste geöffnet ist.
- Challenges: Aktuelle Challenges und Archiv liegen jetzt auf zwei Reitern
  statt untereinander.
- Challenges: Eingereichte Links zeigen nur noch die Seite (etwa
  "youtube.com") statt der vollen Adresse über mehrere Zeilen.
- Die Absenderadresse für E-Mails aus der App ist jetzt moin@konfi-quest.de.
- Die Einstellung "Chat-Berechtigungen" ist entfallen. Sie war nicht erreichbar
  und ohne Wirkung; es gilt unverändert: Konfis schreiben nur das Team an.
- Im Chat lässt sich der Papierkorb nur noch dort antippen, wo das Löschen auch
  erlaubt ist: Teamer:innen bei eigenen Nachrichten, die Leitung bei allen.

- Die Tab-Leiste hat einen eigenen Challenges-Tab; die Aktivitäten sind kein
  eigener Tab mehr, sondern ein Bereich oben im Veranstaltungs-Tab. Gilt für
  Konfis, Teamer:innen und Leitung.
- Jahresrückblick: erzählt den eigenen Weg statt Platzierungen — mit den
  Challenge-Momenten und ohne Vergleich mit anderen.
- Einführung und "Was ist neu?": Aktivitäten werden direkt nach den
  Veranstaltungen erklärt, mit Beispielen passend zur jeweiligen Rolle.
  "Was ist neu?" lässt sich jederzeit erneut aufrufen.
- Veranstaltungs-Formular neu geordnet; Anmeldung ist ein eigener Abschnitt.
- Challenge-Beiträge werden per Tippen und Wischen bearbeitet, wie in den
  übrigen Listen.
- Challenges bei Leitung und Teamer:innen: "Verwalten" und "Mitmachen" sind
  zusammengefasst. Eine Liste zeigt alle Challenges samt eigener Abzeichen, und
  in der geöffneten Challenge stehen der eigene Beitrag und die Beiträge der
  Gruppe beieinander. Ein Plus oben schreibt den eigenen Beitrag.
- Challenges sind für alle gleich aufgebaut: aktuelle Challenges, eigene
  Abzeichen, Archiv. Leitung und Teamer:innen sehen im ersten Abschnitt
  zusätzlich geplante Challenges und Entwürfe.
- Verwaltungslisten folgen jetzt durchgängig einer Regel: Tippen öffnet zum
  Bearbeiten, Wischen löscht.
- Konfi-Ansichten sprechen verständlicher: aus "Antragsdetails" wird "Deine
  Meldung", aus "verbucht" wird "angerechnet", aus "Nachweis-Foto" "Dein Foto".
- Bildschirmlesegeräte benennen jetzt alle Symbol-Schaltflächen und
  Wischaktionen mit ihrer Funktion statt nur "Schaltfläche".


### Behoben

- Der Chat öffnet schneller: Beim Wechsel in den Chat-Bereich wurde die
  Raumliste bisher zweimal hintereinander geladen — in allen drei Rollen.
  Jetzt nur noch einmal.
- Beim ersten Blick auf neue Abzeichen wurde die "Gesehen"-Meldung doppelt
  an den Server geschickt. Jetzt nur noch einmal.
- Challenges: Zähler sprechen jetzt in korrekter Einzahl und Mehrzahl —
  "1 Beitrag" statt "1 Beiträge".
- Chat: Ungesendete Nachrichten sind nach einem App-Neustart nicht mehr
  unsichtbar — sie stehen wieder im Verlauf, als "wird gesendet" oder als
  fehlgeschlagen mit der Möglichkeit, sie erneut zu senden oder zu löschen.
  Auch endgültig gescheiterte Nachrichten verschwinden nicht mehr spurlos.
- Chat: Schlägt das Senden trotz bestehender Verbindung fehl (Funkloch,
  Zeitüberschreitung), wird die Nachricht gesichert und automatisch erneut
  versucht, statt beim Verlassen des Chats verloren zu gehen. Ein doppelter
  Versand ist dabei ausgeschlossen.
- Chat: Offline geschriebene Nachrichten gehen direkt beim nächsten App-Start
  raus, nicht erst beim nächsten Verbindungswechsel — und solange die App
  offline ist, verbrauchen aussichtslose Sendeversuche keine Wiederholungen
  mehr.
- Beim Wechsel der Organisation und beim Abmelden werden ungesendete
  Nachrichten vorher noch zugestellt; geht das nicht, meldet die App den
  Verlust beim Organisationswechsel, statt still zu verwerfen. Nach dem
  Abmelden wird nichts mehr unter einem anderen Konto gesendet.
- Handbuch: Zwei überholte Aussagen richtiggestellt — die Leitung kann fremde
  Einzelgespräche nicht mehr mitlesen, und beim Ablehnen eines Antrags ist die
  Begründung inzwischen Pflicht.
- Der Challenges-Schalter in den Dashboard-Einstellungen war für das
  Konfi-Dashboard wirkungslos — die Challenges-Karte erschien auch
  abgeschaltet. Jetzt greift er.
- Auf der Startseite lief die obere Navigation auf üblichen Bildschirmbreiten
  über: Das Logo stieß an den ersten Menüpunkt, die Knöpfe brachen zweizeilig
  um. Die Navigation hält jetzt in jeder Breite eine Zeile; auf schmaleren
  Bildschirmen führt ein Buch-Symbol zum Handbuch.
- Wer in mehreren Gemeinden zur Leitung gehört, landete beim Antippen einer
  Push-Nachricht aus der anderen Gemeinde in der falschen — im Chat stand dann
  nur eine Fehlermeldung. Die App wechselt jetzt automatisch in die richtige
  Gemeinde und öffnet erst dann das Ziel.
- Auf Android waren der erste und der letzte Reiter unten teilweise
  abgeschnitten, weil die Leiste den seitlichen Systembereich nicht
  berücksichtigte. Lange Beschriftungen werden jetzt gekürzt statt überzulaufen.
- Die eigene zuletzt geschriebene Nachricht zählte als ungelesen. Am Reiter
  stand dadurch eine Eins, bis man den Chat noch einmal öffnete.
- Die Zahl am App-Symbol wird jetzt auch auf null zurückgesetzt. Bisher nahm
  der Server sie nie zurück — auf Android blieb sie deshalb oft stehen.
- Ein verdientes Abzeichen bleibt jetzt sichtbar, auch wenn die Leitung es
  später abschaltet — etwa zum Saisonende. Bisher verschwand es aus der Liste,
  während die Zähler es weiter mitzählten.
- Abzeichen vom Typ "Aktivitäts-Kombination" verlangten bei Teamer:innen alle
  hinterlegten Aktivitäten statt der eingestellten Mindestanzahl. Der
  Fortschritt konnte dadurch 100 Prozent anzeigen, ohne dass es vergeben wurde.
- Abzeichen für Pflicht-Anwesenheit tauchten in der Liste der Konfis nie auf,
  obwohl sie vergeben wurden und die Meldung kam. Drei Abzeichen betroffen.
- Geheime Abzeichen für Teamer:innen wurden mit Namen, Beschreibung und
  Fortschritt angezeigt, bevor sie verdient waren. Jetzt bleiben sie verdeckt,
  die Anzahl der noch zu entdeckenden stimmt weiterhin.
- Die Abzeichen-Übersicht der Konfis zählte die Abzeichen der Teamer:innen mit.
  Der Fortschritt wirkte dadurch schlechter, als er war.
- Abzeichen ohne hinterlegte Bedingung werden nicht mehr als erreichbar
  angezeigt. Sie konnten nie vergeben werden — betroffene Abzeichen einmal
  öffnen, Bedingung eintragen und neu speichern.
- In der Abzeichen-Liste der Leitung fehlten bei "Bestimmte Aktivität" und
  "Aktivitäts-Kombination" die Angaben, sobald das Abzeichen neu gespeichert
  worden war.
- Die Hilfe beim Abzeichen "Bonuspunkte" beschrieb die Bedingung falsch: Es
  zählt die Summe der Punkte, nicht die Anzahl der Vergaben.
- Personen, die eine Urkunde erhalten haben, ließen sich nicht mehr löschen —
  der Versuch endete mit einer Fehlermeldung. Die Urkunden werden jetzt
  mitgelöscht.
- Teamer:innen, die einen Termin angelegt oder jemandem einen Jahrgang
  zugewiesen hatten, ließen sich von der Leitung nicht löschen. Termine und
  Zuweisungen bleiben erhalten, nur der Name der anlegenden Person entfällt.
- Beim Löschen einer Teamer:in blieben deren Dateien aus Challenge-Beiträgen
  auf dem Server liegen. Sie werden jetzt mit entfernt.
- Wer sich zu einem Termin anmeldet, kommt jetzt in den Chat dazu — auf allen
  Wegen: eigene Anmeldung, Eintragen durch die Leitung und Nachrücken von der
  Warteliste. Bisher nahm der Chat beim Anlegen einmalig die damals
  Angemeldeten auf; wer später dazukam, blieb draußen.
- Wird der Chat zu einem Termin nachträglich angelegt, sind auch die Wartenden
  darin. Bisher kamen nur die bestätigten Anmeldungen hinein.
- Wer sich von einem Termin abmeldet, verlässt jetzt auch den zugehörigen
  Chat. Bisher galt das nur, wenn Teamer:innen sich selbst abmeldeten — Konfis
  blieben im Chat und lasen dort weiter mit, obwohl sie nicht mehr dabei waren.
  Selbst verlassen konnten sie ihn auch nicht.
- Trägt die Leitung jemanden aus einem Termin aus, verlässt diese Person
  ebenfalls den Chat dazu.
- Kommt zu einem Pflichttermin nachträglich ein weiterer Jahrgang dazu, werden
  dessen Konfis jetzt angemeldet. Bisher blieben sie ohne Hinweis außen vor.
- Beim Wechsel in einen anderen Jahrgang fallen die künftigen Pflichttermine des
  alten Jahrgangs weg. Bisher standen die Konfis in den Pflichtterminen beider
  Jahrgänge. Bereits erfasste Anwesenheiten und vergangene Termine bleiben
  unangetastet.
- Konnte eine Aktivität nicht eingetragen werden, blieb das Fenster wortlos
  stehen. Jetzt erscheint die Begründung — etwa wenn die Punktart für den
  Jahrgang abgeschaltet ist.
- Leitungen, die zu mehreren Gemeinden gehören, kamen nach dem Wechsel in die
  zweite Gemeinde in keinen ihrer dortigen Chats mehr hinein.
- Aktivitäten ließen sich nicht mehr löschen, sobald irgendwann ein Antrag
  darauf gestellt wurde — auch wenn er abgelehnt worden war. Abgelehnte Anträge
  stehen dem Löschen jetzt nicht mehr im Weg und werden mit entfernt. Gesperrt
  bleibt nur, was offen ist oder schon Punkte gebracht hat.
- Abgelehnte Anträge lassen sich einzeln löschen.
- Beim Ablehnen einer gemeldeten Aktivität ist eine Begründung jetzt
  verbindlich. Bisher konnte sie unter Umständen entfallen, und die Meldung kam
  ohne Erklärung zurück.
- Ein Jahrgang lässt sich nicht mehr so einstellen, dass beide Punktarten
  abgeschaltet sind — dann wären in diesem Jahrgang gar keine Punkte mehr
  möglich gewesen.
- Sicherheit: Chats zwischen zwei Personen bleiben auch beim Mitlesen neuer
  Nachrichten geschützt. Der Schutz galt bisher nur für den bereits
  geschriebenen Verlauf.
- Sicherheit: Konfis konnten den Punktestand und das Level anderer Konfis
  ihrer Gemeinde abrufen. Das geht jetzt nur noch für die eigenen Punkte;
  Leitung und Teamer:innen sehen wie bisher alles.
- Abzeichen mit den Bedingungen "Spezifische Aktivität" und
  "Aktivitäts-Kombination" wurden nie verliehen: Die im Formular gewählte
  Aktivität kam bei der Prüfung nicht an. Bestehende Abzeichen dieser Art
  einmal öffnen und neu speichern, dann greifen sie.
- Beim Anlegen einer Teamer:in erschien ein leerer Abschnitt "Status".
- Challenges: Im Reiter "Archiv" standen die eigenen Abzeichen über dem
  Archiv. Sie stehen jetzt in allen Reitern unten.
- Challenges: Der leere Reiter "Geplant" zeigte eine Flagge; jetzt eine Uhr.
- Challenges standen doppelt in der Navigation — als eigener Tab und unter
  "Mehr". Der Eintrag unter "Mehr" ist entfallen.
- Die Einführung sagte Teamer:innen, sie könnten selbst Termine anlegen. Das
  stimmt nicht — Termine legt die Leitung an.
- Chat: Der Filter "Team" beim Anlegen eines Chats zeigte nur Admins. Die
  Teamer:innen fehlten darin, obwohl sie zum Team gehören.
- Chat: Teamer:innen wurden in der Personenliste wie Konfis dargestellt — in
  der falschen Farbe und ohne ihre Funktionsbezeichnung.
- Chat: Direktnachrichten mit Teamer:innen lagen in der Übersicht im falschen
  Reiter und erschienen nicht unter "Team".
- Chat: Stimmte eine Teamer:in offline in einer Umfrage ab, wurde die eigene
  Auswahl nicht als gesetzt angezeigt.
- Chat: Neue Nachrichten aus einem Chat konnten von Angemeldeten derselben
  Gemeinde mitgelesen werden, die gar nicht daran beteiligt waren. Der Zugang
  setzt jetzt voraus, dass man Teil des Chats ist; die Leitung sieht wie bisher
  die Chats ihrer Gemeinde.
- Chat: Bei anonymen Umfragen ließ sich trotzdem herausfinden, wer was gewählt
  hat. Fremde Stimmen zählen jetzt wirklich ohne Zuordnung mit — auch für die
  Leitung.
- Chat: Bei Umfragen, in denen jede Option nur einmal vergeben werden kann
  ("wer macht welche Tour?"), konnte dieselbe Option unter Umständen doppelt
  belegt werden.
- Chat: Teamer:innen sehen jetzt auch den Reiter "Team" in der Chat-Übersicht.
  Bisher blieb er der Leitung vorbehalten, obwohl Teamer:innen selbst in
  Team-Chats sind.
- "Was ist neu?" hebt sich jetzt deutlich vom Rest der Seite ab, statt wie
  eine Einstellung zwischen anderen auszusehen.
- Der Hinweis auf den Umzug der Aktivitäten unter Termine ist entfallen — die
  Neuerungen stehen bereits in der Einführung.
- Challenges: Die Leitungsansicht hat jetzt die Reiter Aktuell, Geplant und
  Archiv; die Zahlen darüber springen zum jeweiligen Reiter.
- Die Startseite der Konfis lädt die Tageslosung nur noch einmal statt zweimal.
- Ist die Tageslosung in den Einstellungen abgeschaltet, wird sie auch nicht
  mehr im Hintergrund abgerufen. Startseiten öffnen dadurch ohne Wartezeit,
  selbst wenn der Losungs-Dienst gerade nicht erreichbar ist.
- Beim Anlegen einer Teamer:in wird der Benutzername automatisch aus dem Namen
  gebildet, wie bei Konfis. Der Dialog zeigt außerdem die Teamer-Farben und
  fragt nicht mehr nach dem Konto-Status — neue Konten sind immer aktiv.
- Teamer:innen und Konfis erreichen einander nur noch über einen gemeinsamen
  Jahrgang — in beide Richtungen. Konfis sehen im Chat also nur die
  Teamer:innen, die für ihren Jahrgang zuständig sind. Wer keinem Jahrgang
  zugeordnet ist, erreicht keine Konfis und ist für sie nicht sichtbar.
  Leitung und Admins bleiben für alle Konfis erreichbar, und im Team bleiben
  weiterhin alle untereinander erreichbar.
- Nach dem Abmelden kommen keine Mitteilungen mehr auf dem Gerät an. Bisher
  konnten sie weiterlaufen, bis man sich dort erneut anmeldete.
- Wer in mehreren Gemeinden arbeitet, sieht Bilder und Dateien im Chat jetzt
  auch in der zweiten Gemeinde. Bisher blieben sie dort leer.
- Sicherheit: Wird jemandem der Zugang zu einer Gemeinde entzogen, endet der
  Zugriff sofort — auch auf bereits geöffneten Geräten.
- Sicherheit: Gesperrte oder gelöschte Konten verlieren jetzt sofort ihre
  Verbindung zum Chat, statt bis zu einer Viertelstunde weiterzulaufen.
- Konten lassen sich wieder löschen, auch wenn damit schon Punkte vergeben,
  Termine angelegt oder Abzeichen erstellt wurden. Diese Einträge bleiben
  erhalten, nur der Bezug auf das gelöschte Konto entfällt.
- Beim Anlegen einer Teamer:in über die Konfi-Übersicht wird nicht mehr die
  volle Rollenauswahl gezeigt. Der Dialog legt genau das an, was der Knopf
  verspricht; Verwaltungskonten entstehen weiterhin unter Nutzende.
- Namen mit Akzentzeichen ergeben wieder brauchbare Benutzernamen: Aus
  "Noémi Burau" wird "noemi.burau" statt "noemiburau". Bestehende
  Benutzernamen bleiben unverändert.
- Chat: Der Reiter "Direkt" ist jetzt "Ungelesen" — er zeigt die Chats, in
  denen etwas auf dich wartet. Nach Chat-Art zu filtern half beim Wiederfinden
  kaum, dafür gibt es die Suche.
- Chat: Die Zahlen über der Liste ("Chats", "Ungelesen") lassen sich antippen
  und schalten direkt auf den passenden Reiter.
- Challenges: Die Leitungsansicht hat jetzt dieselben Reiter wie die
  Konfi-Ansicht — Aktuell und Archiv statt zweier Listen untereinander. Die
  Zahlen darüber springen zum jeweiligen Reiter.
- Sicherheit: Der Link zum Zurücksetzen des Passworts wird nicht mehr im
  Klartext gespeichert.
- Sicherheit: Beim Anfordern eines Passwort-Links lässt die Antwort nicht mehr
  erkennen, ob es zu einer E-Mail-Adresse ein Konto gibt.
- Für neue Verwaltungskonten und beim Ändern eines Passworts durch die Leitung
  gelten jetzt dieselben Passwortregeln wie überall sonst.
- Die eigene Gemeinde lässt sich nicht mehr versehentlich deaktivieren — das
  hätte alle Mitglieder ausgesperrt.
- Sicherheit: Beim Ändern oder Zurücksetzen des Passworts werden jetzt alle
  anderen angemeldeten Geräte abgemeldet. Bisher blieben sie monatelang
  angemeldet — wer sein Passwort aus Sorge um den Zugang änderte, sperrte
  fremde Zugriffe damit nicht aus.
- Sicherheit: Der Check-in-Code eines Termins wurde in der Terminliste an alle
  ausgeliefert. Konfis konnten sich damit selbst als anwesend eintragen und
  Punkte gutschreiben. Der Code wird jetzt nur noch beim Anzeigen des QR-Codes
  ausgegeben.
- Sicherheit: Kontaktdaten, Adresse und Lizenzangaben der Gemeinde waren für
  Konfis abrufbar. Sie sind jetzt der Leitung und dem Team vorbehalten.
- Teamer:innen ohne zugewiesenen Jahrgang sahen alle Termine der Gemeinde
  statt nur der allgemeinen und der Team-Termine.
- Termine mit unbegrenzter Teilnehmerzahl lassen sich wieder anlegen. Der
  Schalter "Unbegrenzte Teilnehmer:innen" führte bisher zur Meldung, dass eine
  maximale Teilnehmerzahl erforderlich sei.
- Die Tageslosung wird wieder angezeigt. Sie fehlte seit dem 20. August.
- Startseite und Profil öffnen wieder ohne Verzögerung: War die Tageslosung
  nicht abrufbar, wartete die App bei jedem Öffnen mehrere Sekunden auf eine
  Antwort, die nicht kam.
- Ist die Tageslosung einmal nicht erreichbar, zeigen Teamer:innen jetzt die
  zuletzt verfügbare Losung statt einer leeren Karte.
- Wer in mehreren Gemeinden arbeitet, bekommt Live-Aktualisierungen jetzt auch
  in der zweiten Gemeinde. Bisher blieben Listen dort stehen, bis man die
  Ansicht neu lud.
- Chat: Nicht zugestellte Nachrichten konnten verschwinden — beim erneuten
  Laden des Chats oder nach "Erneut senden". Sie bleiben jetzt erhalten und
  lassen sich wirklich noch einmal senden.
- Nach dem Anmelden kamen manchmal gar keine Live-Aktualisierungen an — Listen
  blieben dann stehen, bis die App neu geöffnet wurde.
- Neue und gelöschte Challenges erscheinen bzw. verschwinden jetzt sofort bei
  allen, statt erst nach dem Neuladen.
- Punkte erscheinen jetzt sofort auf Startseite und im Profil, egal auf
  welchem Weg sie vergeben wurden.
- Material erscheint jetzt sofort bei Teamer:innen, statt erst beim nächsten
  Öffnen.
- Push-Nachrichten kamen nach der Server-Umstellung nicht mehr an.
- Abgesagte Termine werden auch der Leitung als abgesagt und durchgestrichen
  angezeigt — bisher sahen das nur die Konfis.
- Doppelte Aktivität "Gottesdienst" in Hennstedt mit "Gottesdienstbesuch"
  zusammengeführt, bereits vergebene Punkte bleiben erhalten.
- Die antippbaren Zahlen im Kopfbereich waren flacher als die übrigen und
  fielen dadurch aus der Reihe.
- Konfi-Ansicht: Die Termine in der Liste klebten ohne Abstand aneinander.
- Veranstaltungen: In den Zeitfenstern klebten die Einträge der Warteliste
  ohne Abstand aneinander.
- Teamer:innen können im Chat wieder andere Teamer:innen und die Leitung
  anschreiben — die Auswahlliste blieb für sie leer.
- Android: Das Menü beim langen Drücken auf eine Chat-Nachricht blitzte nur kurz
  auf und verschwand sofort wieder. Es bleibt jetzt offen.
- Android: Der QR-Scanner startet die Kamera wieder; bisher ließ sie sich beim
  Einchecken gar nicht öffnen.
- Android 13 und neuer: Push-Nachrichten kommen wieder an. Die App durfte dort
  bisher gar keine Benachrichtigungen anzeigen.

- Teamer:innen: Im Profil standen an mehreren Stellen Punkte und die
  Einteilung in Gottesdienst und Gemeinde, die es dort gar nicht gibt — im
  Aktivitätsdetail, bei Terminen nur fürs Team und in der Aktivitätenauswahl.
- Teamer:innen: Beim Anlegen eines Abzeichens mit einer bestimmten Aktivität
  wurden die Konfi-Aktivitäten zur Auswahl gestellt. Jetzt erscheinen nur die
  Aktivitäten der jeweiligen Zielgruppe.
- Abzeichen-Liste: Ein Abzeichen für eine bestimmte Aktivität zeigt nun deren
  Namen statt einer Nummer — mehrere solche Abzeichen waren nicht
  unterscheidbar.
- Teamer-Profil: Zertifikate zeigen wieder ihr eigenes Symbol, und die Liste
  der Termine erscheint auch, wenn noch keiner dabei war.
- Teamer-Bereich: Kopfbereiche, Listen und Farben folgen jetzt überall
  demselben Muster — im Profil standen bisher drei verschiedene Listenformen
  untereinander.
- Auswahllisten beim Anlegen von Abzeichen zeigen die Auswahl jetzt wie überall
  sonst durch farbige Hinterlegung statt durch Ankreuzkästchen. Kategorien,
  Zielgruppen und Bedingungen tragen dabei ihre eigene Farbe statt durchgehend
  Orange, und die Einträge sind gleich aufgebaut wie in den übrigen Listen.
- Teamer-Profil: Die Abzeichen stehen jetzt unter den Terminen und
  Aktivitäten statt ganz oben.
- Fenster ließen sich nach einem doppelten Tippen auf Speichern nicht mehr
  über das X schließen, sondern nur noch durch Wischen. Betraf Abzeichen,
  Challenges, Veranstaltungen und die Teilnehmerverwaltung.
- Die anonyme Nutzungsstatistik zählte keine Besuche. Die Zahlen im
  Auswertungswerkzeug blieben dadurch leer.
- Veranstaltungen: Bei Zeitfenster-Terminen konnte eine Anmeldung ohne Auswahl
  eines Zeitfensters zustande kommen, wenn die Zeitfenster nicht geladen werden
  konnten.
- Veranstaltungen: Teilnehmende entfernen und auf die Warteliste setzen fragen
  jetzt nach — beides wird per Wischgeste ausgelöst.
- Veranstaltungen: In zwei Listen ließen sich Einträge anwischen, ohne dass es
  eine Aktion dazu gab.
- Startseite: Neben dem eigenen Platz standen erfundene Punktzahlen der
  Nachbarplätze. Dort steht jetzt nur noch der Platz.
- Bibelübersetzung wechseln meldet jetzt, wenn das Speichern fehlschlägt.
- Challenges: "Nur für euch in der Leitung" erschien auch bei Konfis.
- Einzelne Beschriftungen liefen aus ihrer Kachel heraus.
- Teamer-Bereich: Schreibfehler "Gueltig" bei Zertifikaten.
- Konnte ein Foto zu einer Meldung nicht geladen werden, stand dort
  fälschlich "Kein Foto hochgeladen".
- Beim Hinzufügen einer Aktivität im Profil einer Teamer:in kam es zum
  Rauswurf aus der App — Ursache waren Aktivitäten ohne Punkte-Art
  ("Konfi-Wochenende", "Konfi-Freizeit begleitet").
- Wischaktionen in Listen klappen nach dem Antippen wieder zu.
- Nach dem Öffnen einer Veranstaltung, eines Profils oder eines Chats zeigten
  andere Tabs teils die falsche Seite an.
- Challenges: Ein freigegebener Beitrag, den nur die Leitung sieht, trug
  fälschlich einen grünen Haken.
- Challenges: Die eigenen Abzeichen werden bei Leitung und Teamer:innen auch
  dann angezeigt, wenn noch keins vergeben ist.
- Challenges: "Anonym stellen" und "Ausblenden" hatten dasselbe Symbol.
- Challenges: Der eigene Beitrag öffnet sich jetzt wie die übrigen Fenster.
- Challenges: Die Aufgabe steht in einer Karte statt im farbigen Hinweiskasten.
- Challenges: Überflüssiger Zurück-Pfeil auf der Hauptseite entfernt.
- Beim Abmelden von einem Termin steht jetzt der Grund dabei, wenn es nicht
  mehr geht (bis 2 Tage vorher).
- Veranstaltungen: Speichern brach in manchen Fällen ohne Meldung ab. Fehlende
  Pflichtangaben werden jetzt benannt.
- Anträge werden schneller abgeschickt; Benachrichtigungen an die Leitung
  laufen jetzt im Hintergrund.
- Tageslosung: Bei gleichzeitigem Abruf durch viele Geräte wird nur noch einmal
  nachgeladen.
- Veranstaltungen: Termine nur für Teamer:innen vergaben fälschlich Punkte,
  zeigten ein wirkungsloses Anmeldefenster und eine Konfi-Warteliste.
- Veranstaltungen: Terminserien übernehmen alle Angaben des ersten Termins.
- Veranstaltungen: Termine mit Anmeldungen lassen sich wieder löschen.
- Challenges: Aufruf einer Challenge konnte zur Abmeldung führen.
- Veranstaltungen: Entfernt die Leitung eine Teamer:in, rückt jetzt auch eine
  Teamer:in von der Warteliste nach — bisher konnte der Platz an eine Konfi
  gehen und das Teamer-Kontingent blieb leer.
- Challenges: Fotos und Videos gingen beim Auswählen manchmal verloren, wenn
  das Handy für die Aufbereitung länger brauchte.
- Challenges: Der Zeitraum verschob sich, wenn das Gerät in einer anderen
  Zeitzone stand.
- Der Hinweis auf den Umzug der Anträge in den Veranstaltungs-Tab wurde
  abgeschnitten und war dadurch unlesbar.

### Sicherheit

- Android: App-Daten wie Chats und Anmeldedaten werden nicht mehr ins
  Google-Konto gesichert.
- Die Anmeldung zur API-Dokumentation bremst wiederholte Fehlversuche jetzt
  aus — das gemeinsame Passwort lässt sich nicht mehr durchprobieren.
- Challenges: Links aus Beiträgen öffnen nur noch reguläre Web-Adressen.
- Challenges: Link-Beiträge nehmen nur noch Musik-Links von Spotify,
  Apple Music, YouTube Music und Deezer an; das Einreichen-Formular sagt das
  vorher an. Titel und Interpret werden automatisch dazugeschrieben — ein
  Cover wird bewusst nicht geladen, damit der Musikdienst beim Ansehen der
  Beiträge nichts mitbekommt.

### Sonstiges

Betrifft nicht die App, gehört nicht in die Store-Release-Notes.

- Zugangsdaten werden nicht mehr in der Projektdatei hinterlegt, sondern getrennt konfiguriert.
- API-Referenz neu gegliedert: 21 Themen statt 5 Sammelblöcke, einheitliche
  Adressen, Parameter und Fehlerfälle genauer beschrieben.
- Startseite um einen Abschnitt zu den Challenges erweitert.
- Startseite: Klick-Auswertung erkennt die Ziel-Adresse jetzt zuverlässig —
  fremde Adressen konnten sich zuvor als App-Store-Link ausgeben.
- Sicherheitsaktualisierung veralteter Entwicklungs-Pakete.
- Die Schnittstellen-Referenz beschreibt jetzt alle Endpunkte der App samt der
  jeweils nötigen Berechtigungen.
- Die Anmeldung zur Schnittstellen-Referenz funktioniert unabhängig davon,
  über welchen Weg die Seite ausgeliefert wird.
- Die getrennte Testumgebung wurde abgebaut; sie wurde nicht mehr genutzt.

## [1.5.3] - 2026-08-04

### Hinzugefügt

- Chat: Button zum Springen ans Ende der Nachrichtenliste.

### Geändert

- Tageslosung lädt schneller.
- Neue Organisationen starten mit "Küsterdienst" als Beispielaktivität.

### Behoben

- Admin: Organisationswechsel funktioniert wieder — bisher blieben die Daten der
  alten Organisation stehen.
- Veranstaltungen: Bei Teilnehmenden eines Zeitfensters wird die Anwesenheit
  jetzt richtig angezeigt.

### Sonstiges

Betrifft nicht die App, gehört nicht in die Store-Release-Notes.

- Startseite: anonyme, cookiefreie Reichweitenmessung um Klicks, Scrolltiefe und
  gelesene Abschnitte erweitert.
- Startseite: Sitemap war für Google nicht abrufbar, die Adresse mit "www" wird
  jetzt weitergeleitet.
- Quelltext unter Lizenz gestellt: nicht-kommerzielle Nutzung erlaubt,
  Änderungen müssen öffentlich gemacht werden.

## [1.5.2] - 2026-07-31

iOS Build 86 + Android versionCode 74. Bugfix-Release rund um Benutzernamen
plus Sicherheits-Härtung (CodeQL-Durchsicht).

### Hinzugefügt

- Registrierung: Benutzername-Regeln live im Formular sichtbar (unzulässige
  Zeichen werden sofort angezeigt, analog zur Passwort-Checkliste); die
  Fehlermeldung beim Absenden zeigt die konkrete Backend-Validierung, der
  Registrieren-Button ist bei ungültigem Benutzernamen deaktiviert.

### Geändert

- Changelog auf strikt Keep a Changelog umgestellt (feste Kategorien, knappe
  Bullets, ISO-Daten); Commit-Verlauf und Store-Texte entfernt.
- Admin-Anlage von Konfis: Benutzername-Generierung an die Registrierungs-Regeln
  angeglichen — Umlaute werden transliteriert (`Jürgen Müller` →
  `juergen.mueller`), Zahlen und Bindestriche bleiben erhalten, bei Kollisionen
  wird automatisch hochgezählt (`anna.musterfrau2`) statt mit Datenbankfehler
  abzubrechen. Beim Benutzer-Update durch Org-Admins gelten jetzt ebenfalls die
  vollen Zeichenregeln.

### Behoben

- Konfi-Bearbeitung überschrieb selbstgewählte Benutzernamen: Das Backend
  generierte den Usernamen bei jedem Speichern neu aus dem Anzeigenamen —
  selbstgewählte Namen aus der Registrierung (z.B. `anna.musterfrau`) wurden
  still überschrieben und der Login schlug scheinbar grundlos fehl. Der Username
  bleibt beim Bearbeiten jetzt unangetastet.

### Sicherheit

- CodeQL-Findings abgeräumt (19 → 0): Der Passwort-Generator im
  Admin-Reset-Modal nutzt jetzt `crypto.getRandomValues` statt `Math.random`
  (mit Rejection-Sampling gegen Modulo-Bias); 35 Log-Aufrufe mit User-Input im
  Format-String auf statische Strings mit separaten Argumenten umgestellt
  (Log-Injection); ReDoS-anfällige Trim-Regex im usernameGenerator durch
  lineares Trimmen ersetzt; strikte Content-Security-Policy für das Backend
  aktiviert (liefert kein HTML aus — verhindert Script-Ausführung, falls eine
  hochgeladene SVG-/HTML-Datei direkt als Dokument geöffnet wird); explizite
  `permissions: contents: read` für die CI-Workflow-Jobs. 9 False Positives
  (Rate-Limiting per Dependency Injection für CodeQL unsichtbar, DOM-XSS mit
  vorhandenem Allowlist-Sanitizer) mit Begründung dismissed. Zusätzlich 9
  überholte Dependabot-PRs geschlossen (Zielversionen auf main längst
  erreicht).
- Transitive Dependency-Updates (nur Lockfiles): Backend npm audit auf 0
  (u.a. body-parser, brace-expansion, postcss), Frontend js-yaml/tar/postcss
  gefixt. Verbleibende 6 High-Findings stecken komplett in der
  ESLint-Dev-Toolchain und sind erst mit dem ESLint-10-Major-Sprung lösbar
  (weder Build-Artefakt noch Laufzeit betroffen; eingeplant für den
  Challenges-Milestone).

## [1.5.1] - 2026-07-18

Android versionCode 73 (Google Play Production). Reiner Bugfix-Release für den
Android-Push-/Chat-Ausfall seit 1.5.0; Backend-Fix via CI deployt.

### Behoben

- Android: Push- und Chat-Totalausfall seit dem 1.5.0-Rollout (09.07.) — auf
  allen Android-Geräten kamen keine Push-Nachrichten mehr an, Chats luden nur
  veralteten Cache (iOS lief noch auf 1.4.x). Tatsächliche Ursache (nachträglich
  korrigiert): ein falscher/fehlender Header in der Proxy-Konfiguration, der die
  Requests von Capacitor auf Android nicht durchließ — Capacitor nutzt für iOS
  und Android unterschiedliche URL-Endpoints/Origins. Die zunächst vermutete
  Ursache (Session-Race beim Token-Refresh) war es nicht; die dabei gebauten
  Härtungen bleiben aber drin: Der Refresh-Token wird jetzt vor dem Access-Token
  persistiert, das serverseitige Grace-Window für rotierte Tokens wurde von 30 s
  auf 5 Minuten erhöht.

### Hinzugefügt

- Build-Absicherung gegen fehlende Firebase-Config: versionierte Master-Kopie
  von `google-services.json` unter `frontend/config/` plus Pflicht-Skript
  `frontend/scripts/prepare-android.sh`, das die Config vor dem Build
  wiederherstellt, Firebase-Projekt/Package verifiziert und sonst hart abbricht.
  Vorher wurde das google-services-Gradle-Plugin bei fehlender Datei still nicht
  angewendet — der Build lief durch, die App bekam aber keinen FCM-Token.

## [1.5.0] - 2026-07-08

iOS Build 85 + Android versionCode 72. Der Play-Production-Track stand noch auf
1.4.2, daher enthalten die Play-Release-Notes auch die 1.4.3-Highlights.

### Hinzugefügt

- Konfi-Detailansicht (Admin/Teamer): erreichte Badges des Konfis als klickbare
  Kreis-Symbole mit Detail-Popover (Name, Beschreibung, Datum). Konfi- und
  Admin-Endpoint nutzen dieselbe Wertungsquelle (`utils/konfiBadgeProgress.js`)
  und zeigen garantiert denselben Stand.

### Geändert

- Einheitliche Empty-States in der Konfi-Detailansicht (Bonus, Events,
  Aktivitäten, Zertifikate, Historie, Badges) über die gemeinsame
  `EmptyState`-Komponente.

### Behoben

- Badge-Vergabe: Punkte-Badges wurden falsch bewertet — PostgreSQL liefert
  Punkte-Spalten als String, wodurch die Addition zur String-Verkettung wurde
  ("0"+"3"+"5" = "035") und der Vergleich gegen `criteria_value` lexikografisch
  lief. Fix per parseInt bzw. `::int`-Cast in Wertung und Fortschritt;
  Regressionstest ergänzt.
- Datenkorrektur: 68 infolge des String-Bugs fälschlich vergebene Punkte-Badges
  in Kirchspiel West per verifizierter SQL-Bereinigung entfernt (nur Einträge
  unterhalb des criteria_value; legitime Badges blieben unangetastet).
- Weitere pg-String-Bugs bei Punkte-Summen in der Konfi-Punkte-Historie
  (`GET /points-history`) und der Teamer-Ansicht behoben (parseInt auf beide
  Summanden).
- Live-Update bei Teamer-Aktivitäten ging ins Leere — `assign-activity` sendete
  hart an den Konfi-Socket-Raum; jetzt `sendToUserByRole`.
- Rollen-Zuweisung: `GET /roles/list/assignable` prüft jetzt zusätzlich das
  `is_super_admin`-Flag (org_admins mit Flag bekamen org_admin nicht als
  zuweisbare Rolle).
- Blob-URL-Leaks im Datei-Viewer behoben (FileViewerModal gab gecachte URLs nie
  frei, KonfiDetailView revokte die Foto-URL nicht vor dem Überschreiben).

### Sicherheit

- Abhängigkeiten aktualisiert (Code-Durchsicht 07.07.): Frontend 0
  Vulnerabilities (vorher 3 high, u.a. ws-DoS), Backend von 7 auf 1 reduziert
  (form-data CRLF, multer DoS, ws-DoS, protobufjs). Ionic 8.8.13, Capacitor
  8.4.1. Offen blieb nodemailer (Breaking-Major, Backlog — inzwischen erledigt).

## [1.4.3] - 2026-07-06

iOS Build 82 (TestFlight). Schwerpunkt Zeitslot-Events und Warteliste.

### Geändert

- Timeslot-Events: Warteliste gilt jetzt pro Zeitslot statt event-weit — voller
  Slot mit aktiver Warteliste setzt auf die Warteliste dieses Slots, Nachrücken
  beim Stornieren rechnet slot-bezogen, der Slot wird beim Buchen gegen
  Doppelbuchung des letzten Platzes gesperrt (FOR UPDATE), alle
  Timeslot-Endpoints liefern `waitlist_count` je Slot.
- Badge-Endpoint `GET /konfi/badges`: ~60 sequenzielle Queries durch 11 parallel
  vorab geladene Aggregate ersetzt (vorher ~1 s Antwortzeit, langsamster
  Endpoint des App-Starts); Zählsemantik unverändert und gegen die Vergabe
  verifiziert.
- Admin: Wartelisten-Teilnehmer unter Zeitslots orange statt blau (konsistent
  zur globalen Liste); „Voll"/„Frei"-Eckbadges mit Icon.

### Behoben

- Konfis kamen bei vollem Zeitslot nie auf die Slot-Warteliste (clientseitige
  Blockade „Dieser Zeitslot ist leider voll") — jetzt Button „voll — auf
  Warteliste" mit Bestätigung; Admin- und Teamer-Ansichten zeigen die Warteliste
  pro Slot, Bestätigen aus der Warteliste rückt slot-korrekt nach.
- Zwei Org-Filter-Drifts im Badge-Fortschritt: `unique_activities` und
  `bonus_points` zählten org-übergreifend, die Vergabe aber org-gefiltert —
  Multi-Org-Konfis konnten 10/10 sehen, ohne dass der Badge kam.

### Sicherheit

- Org-Isolation: fremde IDs in Request-Bodies werden abgewiesen — neuer
  zentraler Guard `allIdsBelongToOrg` in allen Schreibpfaden mit ID-Arrays
  (Events, Aktivitäten, Material); fremde IDs geben 400 mit klarer Meldung.

## [1.4.2] - 2026-07-05

iOS Build 80 + Android versionCode 69. Stabilitäts-Release (Auth/Token +
Foto-Upload).

### Behoben

- Aktivitätsfotos: Handykamera-Fotos (8–16 MB) wurden unkomprimiert hochgeladen
  und über 5 MB clientseitig abgewiesen; der globale 20-s-Timeout killte
  langsame Uploads auf Mobilfunk. Jetzt komprimiert `compressForUpload`
  (1920 px / JPEG q0.8) vor der Größenprüfung in beiden Antrags-Modals,
  Upload-Timeouts liegen bei 60 s, das Backend antwortet beim Multer-Limit mit
  413 und klarer deutscher Meldung.
- Auth: App-Öffnen-Hänger und Socket-Reconnect-Fehler durch abgelaufene Tokens —
  proaktiver Token-Refresh (`ensureFreshToken` prüft das `exp`-Claim vor dem
  Senden) statt 401-Umweg pro Request; der Socket holt sich den Token pro
  Handshake frisch; auf einen scheiternden Refresh wartende Requests werden
  sauber rejected statt ewig zu hängen.

### Geändert

- Infra: Traefik-Ausbau (Retry-/Ratelimit-/Compress-Middlewares, gefiltertes
  JSON-Access-Log, Prometheus-Metrics), ntfy-Healthcheck-Monitoring ersetzt
  Uptime Kuma, Nextcloud-AiO-CPU-Limits per Cron persistent.

## [1.4.1] - 2026-07-04

iOS Build 78 + Android versionCode 67. Großes Stabilitäts- und Echtzeit-Release
(Audit-Phasen F–H); enthält die Vorab-Änderungen aus iOS Build 75 (02.07.).

### Hinzugefügt

- Push bei Termin-/Ortsänderung gebuchter Events an alle gebuchten Teilnehmer
  (confirmed + Warteliste, inkl. Teamer:innen) mit dem konkret geänderten Wert;
  feuert nur bei echten Änderungen zukünftiger, nicht abgesagter Events.
- Leichtgewichtiger Endpoint `GET /notifications/badge-counts` für die
  Tab-Zähler — ersetzt drei Volllisten-Endpoints pro Badge-Refresh.
- Landing-Page: USP „Von einem Pastor für die Konfi-Arbeit entwickelt" als
  Hero-Eyebrow plus Story-Sektion mit Gründungsgeschichte.

### Geändert

- „Alle bestätigen" verbucht jetzt alle angemeldeten Konfis ohne
  Anwesenheits-Status als anwesend (inkl. Punktevergabe und Badge-Prüfung)
  statt die Warteliste kapazitätsübersteuernd zu befördern; die beiden
  Warteliste-Bulk-Endpoints wurden entfernt, Nachrücken läuft weiter
  automatisch (FIFO) bzw. einzeln.
- Events-Listen-Queries restrukturiert: LATERAL-Aggregate statt Join-Explosion
  mit korrelierten Subqueries, JSON-Response feldgenau identisch. Beide Listen
  liefern standardmäßig nur noch das letzte Jahr plus Zukunft (`?all=true` als
  Escape-Hatch).
- Performance: Mark-Read auf 1,5 s gebündelt (lokaler Badge weiterhin sofort),
  Chat-Fallback-Poll inkrementell und nur bei sichtbarem Tab,
  Chat-Mitgliedschafts-Sync mit 10-Minuten-TTL vom Lesepfad entkoppelt,
  Konfi-Dashboard-Queries parallelisiert (p95 ~1 s → langsamste Einzel-Query),
  device-token-Sendefenster von 10 s auf 12 h, 30-s-Admin-Polling und
  60-s-Konfi-Badge-Polling durch Socket-/LiveUpdate-Events ersetzt,
  redundanter ChatOverview-Doppelhandler entfernt, Push-Listener-Cleanup
  ergänzt.
- Datenbank-Härtung (Migrationen 110–116): verwaiste Daten bereinigt, fehlende
  Foreign Keys, NOT-NULL-Constraints und ein Unique-Guard gegen doppelte
  Badge-Vergabe nachgezogen, funktionslose FK-Duplikate und redundante Indizes
  entfernt. Migrationslauf per `pg_advisory_lock` serialisiert (Race der beiden
  Backend-Replikas beim Deploy behoben).
- Chat-Rendering: eigene Nachrichten werden beim Server-Bestätigen in-place
  ersetzt (kein Doppel-Blitzen, kein Voll-Reload pro Senden), Auto-Scroll
  springt sofort statt animiert, die Tastatur bleibt beim Senden offen.
- Konfi-Event-Detail: Anmelde- und Wartelisten-Buttons wieder als gefüllte
  Vollfarb-Buttons (Outline-Variante aus 1.4.0 zurückgenommen).

### Behoben

- Direktchat mit Teamer:innen war unsichtbar: Teilnehmer wurden mit falschem
  `user_type` eingetragen — der Server leitet den Typ jetzt immer selbst aus
  der echten Rolle ab, Migration 117 repariert die Bestandsdaten.
- Chat-Sync kannte keine Multi-Org-Mitgliedschaften (Org-Switcher):
  eingewechselte Mitglieder wurden aus Jahrgangs-/Team-Chats der Zweit-Org
  entfernt; neue Teamer:innen/Admins erscheinen jetzt sofort im Team-Chat
  (Inline-Sync bei User-Anlage/-Änderung und in den Switcher-Endpoints).
- Kein Push mehr vom alten Account nach Logout+Login: Der Token-DELETE lief
  nach `clearAuth` in einen stillen 401 — jetzt davor, das Sendefenster wird
  zurückgesetzt, bei Account-Wechsel wird der Token sofort umregistriert.
- Chat-Push öffnet jetzt direkt den richtigen Raum (vorher Query-Parameter,
  den keine Seite konsumierte).
- „Neue Nachrichten"-Trenner: per Message-ID an der ersten ungelesenen
  Nachricht verankert (sprang vorher über eigene Nachrichten) und als
  einmaliger Einstiegs-Indikator ausgelegt.
- Live-Updates und Chat-Events gingen zwischen den beiden Server-Replikas
  verloren (kein Socket.IO-Adapter) — jetzt `@socket.io/postgres-adapter`
  über NOTIFY/LISTEN (Migration 109).
- Teamer:innen waren vom gesamten LiveUpdate-System abgeschnitten:
  `sendToOrgAdmins` adressiert jetzt auch den Teamer-Raum, neuer Helper
  `sendToUserByRole` trifft den rollenkorrekten Socket-Raum.
- WebSocket-Reconnect robuster: unbegrenzte Versuche mit 30-s-Backoff-Deckel
  (Deploy-Fenster verbrannte vorher die 10 Versuche endgültig), aktiver
  Reconnect beim App-Resume, sichtbare View revalidiert nach Reconnect,
  Chat-Badge bindet nach Token-Reconnect neu (socketEpoch).
- Fehlende Live-Updates in der Verwaltung nachgerüstet (Konfis,
  Selbstregistrierung, Benutzer, Einstellungen, Badges, Organisationen,
  Levels) sowie fehlende Push-/Live-Updates bei Teamer-Anträgen,
  Zertifikat-Zuweisung, Wartelisten-Statuswechsel, Antrag-Reset und
  Serien-Events.
- Umfragen erscheinen jetzt live und Votes aktualisieren sich live
  (`newMessage`-/`pollUpdated`-Events); Raum-Änderungen erscheinen live
  (`roomsChanged`).
- Benutzer mit Konfi-History ließen sich nicht löschen (NO-ACTION-FK-Altlast
  aus SQLite-Zeiten blockierte den CASCADE) — die History wird jetzt explizit
  vorab abgeräumt; beim Jahrgang-Löschen bleibt die History Beförderter
  weiterhin erhalten.
- Aktivität mit abgeschlossenen Anträgen löschen: sauberer 409 mit Hinweis auf
  die Antragshistorie statt „Datenbankfehler".
- User-Löschung räumt leere Direktchat-Räume mit auf.
- Genehmigen/Ablehnen-Buttons liefen auf schmalen Android-Geräten aus dem Bild
  (Flex-Layout-Konflikt).
- networkMonitor-Tests an den Android-Online-Fix angepasst — das rote
  CI-Deploy-Gate blockierte seit dem 30.06. alle Deploys.

### Entfernt

- 13 tote `*Update`-Kompatibilitäts-Socket-Listener im `LiveUpdateContext`
  (kein Server-Code emittierte diese Events mehr).

### Sicherheit

- Aktive Socket-Verbindungen werden bei Konto-Löschung, Passwort-Reset und
  Deaktivierung sofort getrennt (`disconnectUserSockets`, replika-übergreifend
  über den Postgres-Adapter) — vorher konnte eine tote Session weiter mitlesen.
- Organisationsübergreifender Legacy-Broadcast bei Antrags-Genehmigung entfernt
  (Isolation-Verletzung; org-gezielte LiveUpdates übernehmen).

## [1.4.0] - 2026-06

App-Store-Release. iOS-Builds 64–74, Android versionCode 66. Schwerpunkte:
Medien-Verschlüsselung, Foto-Sichtbarkeit, Chat-Darstellung, Android-Login.

### Sicherheit

- Hochgeladene Medien werden verschlüsselt gespeichert (AES-256-GCM) —
  Antrags-Nachweisfotos, Chat-Medien und Team-Material; Bestandsdateien per
  Migration nachverschlüsselt, abwärtskompatibel ohne Ausfallzeit.
- Nachweisfotos sind nach der Bearbeitung des Antrags nur noch für Admins
  abrufbar (serverseitig erzwungen, nicht nur in der Oberfläche).

### Hinzugefügt

- Admins können das Nachweisfoto eines Antrags manuell löschen (Antrag bleibt
  erhalten).
- Antrags-Fotos werden beim Zurückziehen offener Anträge und bei Konto-Löschung
  zuverlässig mitgelöscht; Wartungsskripte für Nachverschlüsselung und
  Verwaisten-Aufräumung ergänzt.

### Geändert

- Symbole in den Antrags- und Event-Detailansichten vereinheitlicht;
  Antrags-Status heißt admin-seitig einheitlich „Verbucht".
- Backend-Tests laufen jetzt auch lokal gegen ein Homebrew-PostgreSQL (vorher
  nur CI); neue Tests für Medien-Verschlüsselung, Foto-Status-Gate und
  Lösch-Logik.

### Behoben

- Chat-Detailseiten: schwarzer Header im Geräte-Dark-Mode und falsche
  Safe-Area — opaker Header mit korrektem Abstand, Toolbar-Grundfarbe app-weit
  auf helles Standard-Grau festgelegt.
- Nachweisfoto „kam zurück", nachdem ein Antrag zurückgesetzt/neu gestellt
  wurde (Status-Gate + saubere Lösch-Logik).
- Android: Login schlug bei Netzwerkstatus „none/unknown" fälschlich mit
  „Keine Verbindung" fehl — die App bleibt jetzt optimistisch online.
- Material-Datei-Download lehnte gültige Dateinamen ab (Längen-Prüfung).

## [1.3.x] - 2026-06 (Nachträge nach iOS-Build 60)

Committet und deployt (Backend live), auf 1.3.0 folgend.

### Hinzugefügt

- „Anmeldung möglich"-Push an die tatsächliche Anmeldbarkeit gekoppelt: sofort
  beim Erstellen (falls offen), beim Öffnen durch Änderung oder pünktlich zum
  Anmeldestart (Hintergrund-Dienst); erneutes Öffnen feuert erneut, Tippen
  öffnet direkt das Event.
- Dashboard-Tageslosung (Konfi): gewählte Bibelübersetzung sichtbar, Tippen
  öffnet die Auswahl, Losung lädt sofort neu.
- Zeit-/Serien-Badges erklären beim Antippen ihren Zählzeitraum.
- Events: Info-Button mit kompletter Farb- und Symbol-Legende (rollenabhängig).

### Geändert

- Badge-Regel präzisiert: Bei Konfis zählen Pflicht-Events und Konfirmationen
  nicht mehr für Badges (nur freiwillige, bestätigte Events plus Aktivitäten);
  bei Teamer:innen zählen weiterhin alle bestätigten Events. Badge
  „Turbo-Woche" entfernt.
- Einheitliches Event-Status-System: Kreis-Icon vorne = Eck-Badge hinten;
  „Anmeldung möglich" = Plus-Kreis, „Ausgebucht" = Schloss, „Verbuchen" =
  offener Kreis.

### Behoben

- „Anmeldung möglich"-Push wurde teils doppelt gesendet — jetzt sendet
  ausschließlich der Hintergrund-Dienst, genau ein Push pro Öffnung.
- Selbst gebuchte Event-Anmeldungen wurden ohne `organization_id` gespeichert
  und zählten dadurch nicht für Badges — Insert korrigiert, 23 Alt-Buchungen
  zugeordnet, 22 rückwirkend verdiente Badges vergeben.
- Badge-Fortschritt vollständig auditiert, Abweichungen zwischen Wertung und
  Anzeige behoben: Teamer-Fortschritt für Kategorie/Kombination/Serie/Zeitraum
  zeigte 0, Konfi-Kategorie-Fortschritt zählte Events nicht mit, Bonuspunkte
  werden nach Summe statt Anzahl gewertet.
- Teamer-Anwesenheit bestätigen warf 400 („Konfi-Profil nicht gefunden") —
  Punkte gibt es jetzt nur noch für Konfis.
- Einladungscode verlängern warf einen Fehler (Abfrage einer nicht
  existierenden Spalte).
- Tab-Zähler für Anträge und Events aktualisieren sofort statt nach ~30 s.
- Event-Liste: lange Titel brechen auf zwei Zeilen um statt zu früh
  abgeschnitten zu werden; Legende um „Anmeldung bald" ergänzt.
- Teamer:innen sehen reine Konfi-Events korrekt als „Nur zur Info"; Konfis
  sehen keine reinen Team-Events und keinen „Teamer gesucht"-Hinweis mehr.
- Event-Erklärung öffnete als Vollbild statt als Card-Modal (Konfi & Admin).

## [1.3.0] - 2026-06-25

iOS Build 60, Android versionCode 64. 42 Commits (22.–25.06.), iOS-Builds
B49–B60. Feature-Release: Onboarding, Chat-Medien & Umfragen, Info-Hilfen,
einheitliches Event-Status-System.

### Hinzugefügt

- Onboarding-Tour beim ersten Login für alle Rollen als Vollbild-Overlay mit
  direkter Ansprache; eigene Slides für Material & Zertifikate (Admin/Teamer).
- Chat: Bild-Versand mit automatischer Kompression, persistenter Bild-Cache
  mit Vorausladen, „Cache leeren" in allen Profilen, Umfragen (anonym oder
  offen, optional exklusive Optionen), sticky Tages-Trenner im WhatsApp-Stil,
  Sprung zur ersten ungelesenen Nachricht, neuer Chat öffnet sich nach dem
  Erstellen direkt.
- Info-(i)-Buttons mit Erklär-Modals in allen Bereichen der „Mehr"-Seite;
  Events-Legende mit Farben und Symbolen (rollenabhängig).
- Teamer:innen: eigene Bibelübersetzung für die Tageslosung, Aktivitäten
  zeigen „Team" statt Gemeinde/Punkte, eigene Onboarding-Tour.

### Geändert

- Einheitliches Event-Status-System: Status-Icon vorne und Eck-Badge hinten
  zeigen immer dasselbe Symbol, klare Farbcodierung pro Status und Rolle,
  Status-Icons aus einer zentralen Map (StatusBadge) als Single Source of
  Truth.
- Vollbild-Onboarding statt Modal, deckend, Vollfarb-Optik; klare
  Rollen-Benennung (Org-Admin / Admin / Teamer:in).
- Migrationen: 106 (Umfragen anonym/exklusiv), 107 (Teamer-Bibelübersetzung).

### Behoben

- Events-Tab-Zähler verschwindet sofort nach vollständigem Verbuchen (vorher
  bis zu 30 s; Provider-Reihenfolge LiveUpdate/Badge korrigiert).
- Deaktivierte Punkt-Kategorien werden bei Punkten, Badges und Level
  konsistent berücksichtigt.
- Super-Admins können organisationsübergreifend Passwörter zurücksetzen.
- Chat: kein Bild-Ruckeln/Reload-Loop mehr, korrekter Abstand unter der
  letzten Nachricht auf iOS, kein Fehler mehr bei Antwort auf gelöschte
  Nachrichten.
- Deutlicher Warnhinweis beim Löschen von Konfis.
