# Changelog

Alle nennenswerten Änderungen an Konfi Quest werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
die Versionierung folgt [Semantic Versioning](https://semver.org/lang/de/).
Store-Builds (iOS-Build / Android versionCode) stehen jeweils unter der
Versionsüberschrift.

## [Unreleased] - 2.4.0

### Hinzugefügt
- In der Detailansicht einer Person lässt sich Offenes direkt bestätigen:
  Ein Tipp auf eine gemeldete Aktivität öffnet das Prüfen mit Genehmigen und
  Ablehnen, und Events mit ausstehender Anwesenheit stehen oben in der
  Eventliste mit „Anwesend" und „Nicht anwesend" — die Knöpfe erscheinen nur
  mit dem passenden Recht.
- Die Eventliste in der Detailansicht einer Person zeigt oben auch die
  kommenden Events, zu denen sie angemeldet ist oder auf der Warteliste steht;
  ein Tipp darauf öffnet das Event.
- Unter Betrieb zeigt ein Reiter „Sprüche“, welche Konfisprüche über alle
  Gemeinden gewählt werden — jeder Spruch mit Anzahl, eigene im Wortlaut,
  ohne Namen; die Zahlen bleiben auch nach dem Löschen eines Kontos.
- Gibt es eine Challenge nicht mehr oder gehört sie zu einem Jahrgang, der
  dir nicht zugewiesen ist, sagt ihre Seite das und bietet den Weg zurück zu
  den Challenges.
- Support-Konten ohne eigene Gemeinde lassen sich anlegen, sperren und
  löschen; sie melden sich nur im Browser an (die Apps zeigen einen Hinweis)
  und kommen nur als sichtbare Gemeindeleitung in eine Gemeinde.
- Das letzte aktive Konto mit Super-Admin-Recht lässt sich weder sperren noch
  löschen.
- Im breiten Browserfenster zeigt die Web-Version links eine ein- und
  ausklappbare Leiste statt der Reiterleiste unten — mit denselben Bereichen
  und Zahlen, dazu Profil und Abmelden; im schmalen Fenster und in den Apps
  bleibt alles, wie es ist.
- Eine Support-Ansicht im Browser bündelt für den Betrieb Kennzahlen je
  Landeskirche, Kirchenkreis und Gemeinde (Konten je Rolle, in den letzten 30
  Tagen aktive Konten, Jahrgänge — ohne Namen), die Anfragen von Gemeinden,
  die Zuordnung zu Kirchenkreisen und Landeskirchen und die Support-Konten.
- Eine Gemeinde kann Konfi Quest über ein Formular auf konfi-quest.de
  anfragen und dabei ihre Wunschlizenz wählen: Die anfragende Adresse bekommt
  eine Bestätigung, der Support
  einen Hinweis ohne Kontaktdaten. Der Support macht daraus mit wenigen
  Schritten die Gemeinde samt erster Gemeindeleitung — mit denselben
  Vorlagen wie beim Anlegen einer Gemeinde. Abgelehnte Anfragen werden 180
  Tage nach der Ablehnung gelöscht, unbearbeitete nach 365 Tagen ohne
  Änderung.
- Gemeinden lassen sich einem Kirchenkreis und darüber einer Landeskirche
  zuordnen; die bisher eingetragenen Kirchenkreise werden dabei übernommen.
- Der Support beantwortet Anfragen und Mails direkt in der Support-Ansicht:
  Antworten von Gemeinden landen in der richtigen Anfrage oder bei der
  richtigen Gemeinde, was sich nicht zuordnen lässt, im Posteingang. Dazu
  gibt es Textbausteine mit Platzhaltern und eine gemeinsame Fußzeile.
- Die Support-Ansicht hat im breiten Browserfenster eine eigene
  Web-Oberfläche: Die Übersicht zeigt Kennzahlen, die Entwicklung von
  Gemeinden, Konten und Anfragen über zwölf Monate, die Aktivität über zwölf
  Wochen, die neuesten Anfragen und Mails und die Testphasen, die bald enden;
  Anfragen, Posteingang, Schriftwechsel, Textbausteine, Struktur und
  Support-Konten stehen als Tabellen und Karten statt als Listen.
- Die Gemeinden stehen in der Support-Ansicht im Browser nach Landeskirche und
  Kirchenkreis aufklappbar geordnet, mit einer Suche, die beim Tippen filtert
  — auch nach der Gemeindeleitung. Die Gemeindeleitung steht mit
  Benutzername, Mail und letzter Anmeldung direkt an jeder Gemeinde.
- Der Posteingang zeigt im Browser alle eingehenden Mails an moin@ und
  support@, mit Filtern und der Angabe, zu welcher Anfrage oder Gemeinde eine
  Mail gehört.
- Anfragen und Posteingang lassen sich im Browser nach offenen bzw.
  ungelesenen filtern; die Kennzahlen der Übersicht führen direkt dorthin.
- Der Schriftwechsel mit einer Gemeinde zeigt im Browser Gemeinde und
  Gemeindeleitung neben den Mails und führt mit einem Klick ins Formular.
- Ein Konto mit eigener Gemeinde und Super-Admin-Recht hat in der Leiste im
  Browser zusätzlich die Bereiche der Support-Ansicht.
- Auf konfi-quest.de steht eine Vorlage zur Einwilligung der Eltern zum
  Ausdrucken bereit.
- Im Browser hat jeder Bereich eine eigene Ansicht für breite Fenster; in
  den Apps und im schmalen Fenster bleibt alles, wie es ist:
  - Der Chat steht wie in einem Messenger: links die Chats mit Suche,
    Reitern und roten Zahlen, rechts der geöffnete Chat. Enter sendet,
    Umschalt+Enter beginnt eine neue Zeile, Dateien lassen sich auf den Chat
    ziehen oder einfügen, Aktionen an einer Nachricht erscheinen beim
    Darüberfahren, und ein angefangener Text bleibt je Chat stehen.
  - Start, Badges und Profil von Konfis und Team zeigen Karten statt einer
    langen Spalte, Badges mit Suche und Filtern; die Konfi-Historie des
    Teams steht nebeneinander.
  - Mitmachen zeigt der Leitung Events und gemeldete Aktivitäten als
    Tabellen mit Filtern, den Katalog der Aktivitäten wie in der App unter
    „Mehr"; ein Event steht zweispaltig da, mit Anwesend und
    Abwesend je Zeile. Konfis und Team sehen die Events als Karten und
    melden sich im zweispaltigen Event an und ab.
  - Challenges stehen als Karten im Raster mit Filtern und roter Zahl;
    eine Challenge zeigt Aufgabe und große Beiträge links, Aktionen, Angaben
    und Stempel rechts; Beiträge lassen sich direkt am Beitrag freigeben,
    ausblenden und anonym stellen.
  - Die Leitung sieht Konfis und Team als Tabelle mit Suche, Jahrgang und
    Sortierung, die Seite einer Konfi oder Teamer:in zweispaltig,
    Benutzer:innen, Kategorien, Level, Zertifikate, Jahrgänge, Material,
    Rückblick und Betrieb als Tabellen und „Mehr" als Kacheln; Badges werden
    in einer Tabelle verwaltet.
- Support-Ansicht: Jedes Anliegen ist ein Vorgang — Anfrage von der
  Homepage, Support-Formular oder Mail — mit Art, Bereich, Dringlichkeit,
  Stand und Gemeinde; im Browser als Tabelle mit Filtern, Suche und
  Sammelaktionen, in der App als Liste. Vorgänge lassen sich selbst anlegen,
  zum Beispiel um eine Gemeinde anzuschreiben.
- Support-Ansicht: Mails im Posteingang lassen sich einem bestehenden oder
  neuen Vorgang zuordnen, archivieren oder löschen, auch mehrere auf einmal;
  Vorgänge lassen sich archivieren und löschen.
- Auf konfi-quest.de gibt es ein Formular „Hilfe und Support" mit Art,
  Bereich und Dringlichkeit zum Auswählen; unter „Mehr" führt „Hilfe und
  Support" für Gemeindeleitung und Leitung dorthin.
- Die Gemeindeleitung legt je Jahrgang fest, wer aus der Leitung dort
  Anträge entscheiden, Events verbuchen und Challenge-Beiträge freigeben darf.
  Ohne das Recht bleiben die Vorgänge sichtbar, aber ohne Knöpfe, ohne Push,
  ohne Postfach-Eintrag und ohne rote Zahl; bisher Zugewiesene behalten alle
  drei Rechte.
- Die Gemeindeleitung legt auch für Teamer:innen je Jahrgang fest, ob sie
  dort Challenge-Beiträge freigeben dürfen; ohne das Recht lesen sie die
  Beiträge nur mit und bekommen dafür weder Push noch rote Zahl. Bisher
  Zugewiesene behalten das Recht.
- Blockiert der Browser in der Web-Version etwas, das die Sicherheitsregeln
  nicht erlauben, meldet er es dem Server; der Betrieb sieht die Meldungen
  unter „Fehler“ — ohne Abfrageteile der Adressen und ohne Angaben zur Person.
- Ein Event und die Seite einer Person, die du schon einmal mit Netz geöffnet
  hattest, gehen ohne Netz wieder so auf wie zuletzt — mit Teilnehmerliste,
  Zeitfenstern, Material und Punkte-Historie statt der grauen Zeile
  „offline nicht verfügbar".

### Geändert
- Im Browser heißen die Reiter der Challenges wie in der App **Aktuell** und
  **Archiv**.
- Bei den eigenen Aktivitäten stehen in der App die Reiter über der Suche, wie
  bei den Events; das Team beginnt dort bei **Offen**.
- Im Browser stehen in der Chat-Liste die Reiter über der Suche, wie in der App.
- Die Anwesenheit steht ab Beginn eines Events aus, nicht erst nach seinem
  Ende: Konfis und Team sehen während des Events „Ausstehend“ statt
  „Angemeldet“ oder „Dabei“, und die Leitung sieht „Verbuchen“, wie schon im
  Reiter „Verbuchen“. Das Team sieht ab Beginn keine Zusage-Knöpfe mehr, die
  ohnehin nicht mehr angenommen wurden.
- Der Punkte-Verlauf im Browser zeigt alle Einträge auf einmal; ein Klick auf
  einen Spaltenkopf ordnet die ganze Liste.
- Hinweistexte in Hinweis-Kästen (etwa unter „E-Mail ändern“,
  „Funktionsbeschreibung“ und „Benachrichtigungen“) sind auf iPhone und
  Android gleich groß und kleiner als die Zeilentitel; auf dem iPhone waren
  sie bisher größer.
- In der Event-Liste im Browser steht vor jedem Event ein farbiger Kreis mit
  Symbol, der den Stand zeigt — wie die Initialen in der Konfi-Liste.
- Das Annehmen oder Ablehnen einer gemeldeten Aktivität ist sofort erledigt;
  Mitteilung und Postfach-Eintrag an die Konfi folgen gleich danach.
- Im Browser lässt sich jede Liste per Klick auf den Spaltennamen sortieren,
  ein zweiter Klick dreht die Richtung.
- Status-Spalten im Browser sortieren nach dem Ablauf, Offenes zuerst — etwa
  Offen, Verbucht, Abgelehnt — statt nach dem Alphabet.
- Die Aktivitäten unter „Mehr“ und die gemeldeten Aktivitäten unter
  „Mitmachen“ lassen sich im Browser auch als Kacheln ansehen.
- In der Teilnehmerliste eines Events im Browser hat der Stand mehr Platz:
  Anwesend und Abwesend sind kompakte Knöpfe mit Symbol, verbucht grün bzw.
  rot.
- Im Browser tragen alle Angaben das Symbol der App in ihrer Farbe, und die
  Merkmale eines Events (Pflicht, Nur Team, Konfirmation …) stehen als
  farbige Marken mit Symbol.
- Im Browser sind die Kacheln von Konfis, Team und Events gebaut wie die der
  Challenges: farbiger Kopf mit Symbol, darunter die Angaben mit Symbolen und
  unten die Knöpfe; bei Events und Personen steht der Name im Kopf, Merkmale
  wie „Pflicht" stehen als Marken.
- Im Browser sehen die Stempel in den Challenges genauso aus wie auf der
  Seite einer Person und zeigen beim Darüberfahren dieselbe Info; ein Klick
  öffnet weiter die Challenge.
- Auf der Seite einer Person im Browser stehen die Events links zwischen
  Aktivitäten und Bonuspunkten bzw. Zertifikaten, als Tabelle mit denselben
  Spaltenbreiten wie die übrigen Listen.
- Badges und Stempel einer Person sehen im Browser gleich aus — Badges in
  ihrer Farbe, offene Stempel gedämpft — und zeigen ihre Info beim
  Darüberfahren, beim Ansteuern mit der Tastatur und beim Antippen.
- Im breiten Browserfenster steht der Gemeinde-Umschalter nur noch unten in
  der Leiste — mit dem Namen der Gemeinde, der eigenen Rolle dort und den
  roten Zahlen je Gemeinde; in den Apps und im schmalen Fenster bleibt er oben
  in der Kopfzeile.
- Gemeinden, die nur dem Betrieb dienen (Test- und Review-Gemeinden für die
  Stores), erscheinen in keiner Liste und keiner Zahl der Support-Ansicht.
- „Bearbeiten" an einer Gemeinde öffnet in der Support-Ansicht im Browser
  gleich das Formular.
- Eine neue Gemeinde startet in der Testphase mit einem Limit von 5 Konfis;
  danach gilt die Lizenz, die sie gewählt hat. Die Tarif-Auswahl nennt den
  Preis; die Tarife 15, 50, 75 und 100 und „Unbegrenzt" bleiben wählbar.
- Unter „Mehr" führt das Symbol oben rechts Konten mit Super-Admin-Recht in
  die Support-Ansicht statt direkt zu den Gemeinden.
- Die Datenschutzerklärung beschreibt das Anfrageformular und den
  Schriftwechsel per Mail mit dem Support: welche Angaben, wozu und wie
  lange.
- Die Gemeindeleitung kann ein Konto des Supports, das als Gast in ihrer
  Gemeinde ist, selbst wieder herausnehmen; das Konto des Supports bleibt.
- Eine Challenge öffnet sich als eigene Seite statt in einem Fenster über der
  Liste — für Konfis, Team und Leitung; der Pfeil oben führt zurück in die
  Liste.
- Mitteilungen zu einer Challenge — neue Challenge, neuer Beitrag, Stempel,
  ausgeblendeter Beitrag — führen beim Antippen direkt in diese Challenge, auf
  dem Gerät wie im Postfach. Liegt sie in einer anderen Gemeinde, wechselt die
  App vorher dorthin.
- Eine Challenge auf der Startseite öffnet beim Antippen gleich diese
  Challenge statt der Liste.
- Gemeindeleitung (Indigo), Leitung (Petrol) und Teamer:innen (Beere) stehen
  in jeder Personenliste in ihrer eigenen Farbe — am Strich links, am Kreis,
  an der Marke in der Ecke und an den kleinen Symbolen: bei den
  Chat-Mitgliedern, beim Hinzufügen von Mitgliedern, beim Anlegen eines Chats,
  in der Benutzerliste, in den offenen Einladungen, beim Zuordnen von Team und
  Leitung zu einem Event und beim Zugriff auf einen neuen Jahrgang.
- Support-Ansicht: Anfragen von der Homepage sind Vorgänge der Art „Neue
  Gemeinde"; erledigte Vorgänge liegen im Archiv und werden zwei Jahre nach
  dem Archivieren gelöscht; eine neue Mail holt einen Vorgang zurück. Rote
  Zahlen gibt es für Vorgänge und Posteingang.
- Im Browser markiert die Leiste auch auf Seiten, die über „Mehr" erreicht
  werden, den Eintrag „Mehr".
- Im Browser stehen gewählte Filter in der Farbe der eigenen Rolle.
- Im Browser heißen die Event-Filter der Konfis wie in der App: Alle, Meine,
  Konfirmation.
- Im Browser lassen sich Events, Challenges und Konfis wahlweise als Liste oder
  als Kacheln ansehen; die Leitung beginnt mit der Liste, Konfis und Team mit
  Kacheln, und der Browser merkt sich die Wahl.
- Im Browser sind die Seiten aller Events und Challenges und für die Leitung
  die Seite jeder Konfi und Teamer:in gleich aufgebaut: alle Aktionen oben
  rechts, darunter Kennzahlen, links das Eigentliche, rechts die Angaben.
- In der Konfi-Liste der Leitung im Browser gibt es keinen Knopf „Punkte"
  mehr; Aktivitäten und Bonuspunkte vergibst du auf der Seite der Konfi.

- Wer in mehreren Gemeinden mitarbeitet, hat in jeder Gemeinde eine eigene
  Funktionsbezeichnung, ein eigenes „Teamer:in seit" und eine eigene Sperre;
  die Leitung einer weiteren Gemeinde kann Funktionsbezeichnung und Sperre
  bei sich selbst setzen.
- Sperrt eine Gemeinde eine Person, die auch anderswo mitarbeitet, gilt die
  Sperre nur dort: Die Person meldet sich weiter an und arbeitet in ihren
  anderen Gemeinden; erst wenn alle Gemeinden sie gesperrt haben, ist das
  Konto gesperrt.
- Wer in einer Gemeinde gesperrt ist, bekommt aus ihr keine Mitteilungen und
  Chat-Nachrichten mehr aufs Handy; aus den anderen Gemeinden weiter.
- Löscht die Leitung eine Konfi, deren Konto noch zu einer weiteren Gemeinde
  gehört, endet nur die Mitgliedschaft in der eigenen Gemeinde.

### Behoben
- Bei den Konfis bleibt ein laufendes mehrtägiges Event in der App unter
  **Alle**, bis es zu Ende ist, und die Suche findet Events auch über ihren
  Namen.
- Die Zahlen über den eigenen Aktivitäten zählen in der App jeden Stand, nicht
  nur den gewählten Reiter; die Kachel heißt wie der Reiter **Angerechnet**.
- Beim Team zählt ein laufendes mehrtägiges Event in der App nicht schon als
  vergangen.
- Ein leerer Reiter bei den gemeldeten Aktivitäten der Leitung sagt in der App,
  was fehlt, statt immer denselben Satz.
- Im Katalog der Aktivitäten zeigt die App nach dem Wechsel zu **Team** die
  Team-Aktivitäten, auch wenn vorher eine Art gewählt war; die Kachel heißt
  wie der Reiter **GoDi**, und im Browser passt der Untertitel zur Rolle.
- Findet eine Suche nichts, sagt die App das, statt „Noch keine … angelegt“
  oder „Alle Badges erreicht!“ — bei Badges, Konfis, Benutzer:innen,
  Aktivitäten, Vorgängen und Material.
- Ein gewählter Jahrgang ohne Konfis sagt in der App „In diesem Jahrgang gibt
  es noch keine Konfis.“
- Unter **Ungelesen** im Chat steht jeder Raum mit roter Zahl.
- Im Posteingang des Browsers steht wie in der App, wenn einem Postfach die
  Zugangsdaten fehlen; in der App sagt ein leerer Filter, was fehlt.
- Die Suche im Material des Teams übergeht Leerzeichen am Rand und findet
  „mueller“ auch als „Müller“.
- Mitteilungen im Postfach vom 21. bis 23.08.2026 zeigen ihre richtige
  Uhrzeit statt einer zwei Stunden späteren.
- Zwischen Mitternacht und 2 Uhr nachts gilt auch auf dem Server schon der neue
  Tag: Ein gestern abgelaufenes Zertifikat zählt nicht mehr als gültig, die
  Startseite des Teams zeigt die Events ab Mitternacht, Bonuspunkte tragen das
  richtige Datum, und wer ins Team kommt, ist es seit heute.
- Speichert die Gemeindeleitung die Angaben ihrer Gemeinde mit einer älteren
  App, verliert der Kurzname der Gemeinde seine Umlaute nicht mehr
  („Travemuende" wurde zu „Travemnde").
- Wer im Benutzerfenster gespeichert oder beim Anlegen eines Jahrgangs
  zugewiesen wird, bekommt das Recht, Konfis und Termine diesem Jahrgang
  zuzuordnen, nur noch als Leitung — Teamer:innen bekamen es bisher still
  mit, und eine zur Leitung gemachte Teamer:in bekommt es beim Speichern
  dazu.
- Im Fenster „Benachrichtigungen“ sind die Untertitel der Schalter nicht mehr
  größer als die Titel; Zeilen und Hinweis sehen aus wie auf den übrigen
  Seiten unter Konto.
- Eine Event-Serie, die ohne Netz gespeichert und später gesendet wird,
  entsteht auch dann nur einmal, wenn die Verbindung beim Senden abreißt.
- Bleibt beim Anlegen einer Konfi die Antwort aus, legt „Erneut versuchen"
  kein zweites Konto an, sondern zeigt für dasselbe Konto ein neues
  Einmalpasswort.
- Entfernt die Leitung eine Konfi, deren Konto noch zu einer anderen Gemeinde
  gehört, gehen mit ihr auch Aktivitäten, Punkte, Anträge, Beiträge und
  Badges aus dieser Gemeinde; in der anderen Gemeinde bleibt alles.
- Gehört eine Konfi nur über eine weitere Mitgliedschaft zu einer Gemeinde,
  bekommt sie dort die Mitteilung über neue Beiträge im Challenge-Feed ihres
  Jahrgangs.
- Im Chat-Export steht hinter jedem Namen die Rolle in der Gemeinde des
  Chats, nicht die aus der Heimatgemeinde.
- Die Leitung kann Teamer:innen, die aus einer anderen Gemeinde bei ihr
  mitarbeiten, wieder von einem Event austragen; bisher kam „Zugriff
  verweigert".
- Die letzte Gemeindeleitung einer Gemeinde lässt sich auch dann nicht
  löschen und kann ihr Konto nicht selbst löschen, wenn sie aus einer anderen
  Gemeinde kommt; umgekehrt zählt eine solche zweite Gemeindeleitung jetzt
  mit, sodass das Löschen nicht mehr unnötig abgelehnt wird.
- Die Leitung kann für Teamer:innen, die aus einer anderen Gemeinde bei ihr
  mitarbeiten, ein Einmalpasswort erzeugen und die Gemeindeleitung ein
  Passwort setzen, auch im Bearbeiten-Dialog; bisher kam „Person nicht
  gefunden" oder „Keine Berechtigung", und das Passwortfeld war gesperrt.
- Wer in zwei Gemeinden verschiedene Rollen hat, sieht Änderungen an Punkten,
  Anträgen, Badges und Events in der weiteren Gemeinde sofort, ohne neu zu
  laden.
- Beim Anlegen eines Jahrgangs lassen sich Teamer:innen aus einer anderen
  Gemeinde, die bei dir mitarbeiten, gleich zuweisen.
- Im Teamer-Rückblick zählen zu „Dein Team" auch Teamer:innen aus einer
  anderen Gemeinde, und die Auswahl der Jahre richtet sich nach der Rolle in
  dieser Gemeinde.
- In der Teilnehmerliste eines Events, die Konfis sehen, fehlen die
  Teamer:innen der Gemeinde auch dann, wenn sie anderswo eine andere Rolle
  haben; Leitungen aus einer anderen Gemeinde stehen wieder darin.
- Die Zahl am App-Symbol und neue Badges kommen auch bei Personen an, deren
  eigene Gemeinde gesperrt ist, die aber in einer weiteren Gemeinde
  mitarbeiten.
- Eine Gemeindeleitung, die nur in dieser Gemeinde gesperrt ist, verlässt
  die Jahrgangs-Chats dieser Gemeinde.
- Nach dem Schließen einer Seite laufen dort angestoßene Meldungen,
  Rückfragen und Nachladevorgänge nicht mehr weiter — so entsteht kein
  Einmalpasswort mehr, wenn man die Seite einer Person direkt nach dem
  Bestätigen verlässt.
- Die Videovorschau im Chat lädt nach dem Schließen nicht weiter, und ein
  langer Druck auf eine gerade verschwundene Nachricht öffnet kein Menü mehr.
- In der Web-Version tragen die Start- und Profilseiten nicht mehr Rahmen,
  Fläche und Schrift der Rollenmarke aus der Benutzerliste; Beschreibungen
  und Menüs anderer Seiten mischen sich ebenso nicht mehr.
- Die Filterzeile der Challenges steht in der Web-Version auch bei 1366 px
  Fensterbreite in einer Zeile.
- Bonuspunkte und neue Events, die ohne Netz gespeichert und später gesendet
  werden, kommen auch dann nur einmal an, wenn die Verbindung beim Senden
  abreißt.
- Ändert die Leitung die Punkteart einer Aktivität, bleiben schon vergebene
  Punkte in ihrer Säule — in Liste, Verlauf und beim Zurücknehmen.
- Der Benutzername einer neuen Gemeindeleitung folgt denselben Regeln wie
  jeder andere Benutzername (3 bis 50 Zeichen, Buchstaben, Ziffern, Punkt und
  Bindestrich).
- Setzt der Support einem Support-Konto ein neues Passwort, sagt die
  Bestätigungsmail, dass es der Support war, statt von der Leitung einer
  Gemeinde zu sprechen.
- In der Benutzerverwaltung stehen Konten mit Super-Admin-Recht ohne
  Bearbeiten und Löschen, in App und Browser; bisher gab es die Knöpfe, aber
  sie endeten mit einer Fehlermeldung. Ein Support-Konto kann die
  Gemeindeleitung weiterhin aus der Gemeinde nehmen.
- Mitteilungen gehen bei einem Update des Servers nicht mehr verloren: Push,
  Postfach-Eintrag und E-Mail nach einer Änderung (etwa einer genehmigten
  Aktivität, einer Anmeldung oder einer neuen Chat-Nachricht) kommen auch
  dann an, wenn der Server direkt danach neu startet, und werden bei einer
  Störung später noch einmal versucht — ohne doppelt zu kommen.
- Auch die Mail „Passwort vergessen" und die Kopie einer Support-Antwort im
  Gesendet-Ordner gehen bei einem Update des Servers nicht mehr verloren und
  werden bei einer Störung später noch einmal versucht.
- Im Browser öffnen sich die Seite einer Person und die Seite eines Events
  beim ersten Klick; bisher blieb sie weiß, bis man ein zweites Mal klickte
  oder neu lud.
- Auf der Seite einer Teamer:in zeigen die Events, ob sie wirklich da war:
  Bisher stand bei jedem gebuchten Event „Anwesend", auch bei künftigen und
  bei als abwesend verbuchten.
- In der Konfi-Liste der Leitung im Browser waren die Fortschrittsbalken nur
  ein flacher Streifen mit abgeschnittener Zahl, und vor dem Namen klaffte eine
  leere Fläche statt des Kreises mit den Initialen.
- Direkt nach der Anmeldung zeigte der Gemeinde-Umschalter den Namen der
  eigenen Gemeinde nicht, bis man einmal gewechselt hatte.
- Nach einem Update zeigt die Web-Version sofort die neuen Bilder der
  Startseite, des Rückblicks und die neue Fassung der API-Referenz; bisher
  konnte der Browser bis zu ein Jahr lang die alten zeigen.
- In der Mitgliederliste eines Chats trug die Marke in der Ecke die Farbe der
  Rolle aus der Stamm-Gemeinde; Personen, die eine Gemeinde zusätzlich
  betreuen, erscheinen dort jetzt mit ihrer Rolle in dieser Gemeinde.
- Beim Anlegen eines Chats stand jede Leitung und Gemeindeleitung in der Farbe
  der Teamer:innen.
- Die Gemeindeleitung einer Gemeinde stand beim Bearbeiten der Gemeinde in der
  Farbe der Teamer:innen.
- Beim Zuordnen der Leitung zu einem Event heißt die Gemeindeleitung jetzt
  „Gemeindeleitung" statt „Leitung".
- Ein gesperrtes Konto mit Super-Admin-Recht kann sich nicht mehr anmelden;
  bisher kam die Anmeldung durch, und erst jede weitere Anfrage scheiterte.
- Ein Support-Konto ohne Gemeinde kann sich im Browser abmelden; bisher gab es
  dort keinen Weg hinaus.
- Die Leitung wählt im Browser im Profil aus, welche Benachrichtigungen aufs
  Handy kommen; der Eintrag fehlte dort.
- Support-Ansicht: Listen, Zahlen und Übersicht zeigen nach einer Änderung
  (Status gesetzt, Mail gelesen, einsortiert, archiviert) sofort den neuen
  Stand.
- Die roten Zahlen im Chat laufen nach dem Verlassen eines Chats live weiter.
- Ein bevorstehendes Pflicht-Event heißt in der Liste der Leitung „Pflicht"
  statt „Geschlossen".
- Die Rückfrage „Alle bestätigen" für das Team ist wieder ein vollständiger
  Satz.

- Eine Sperre wirkt sofort auf jedem Gerät; bisher konnte eine laufende
  Sitzung bis zu 30 Sekunden weiterarbeiten.
- Wer in einer weiteren Gemeinde mitarbeitet, steht in Teilnehmerlisten,
  Chat-Nachrichten und Event-Chats dort mit der Rolle dieser Gemeinde, nicht
  mit der aus der eigenen.
- Teamer:innen aus einer anderen Gemeinde lassen sich als Urheber:in einer
  Challenge wählen, und die Leitung öffnet ihre Detailansicht mit den Angaben
  aus der eigenen Gemeinde.
- Beim Bearbeiten einer Gemeinde steht die ganze Gemeindeleitung da, auch wer
  sie über eine Einladung leitet.
- Mitteilungen aus einer weiteren Gemeinde führen beim Antippen immer in diese
  Gemeinde.
- Wird einer Person eine Gemeinde entzogen, zeigt die App sofort Rolle und
  Namen der Gemeinde, in die sie zurückwechselt.

### Sonstiges
- Reiter, Filter und Leertexte jeder Seite stehen für App und Browser an
  einer Stelle; ein neuer Filter erscheint so in beiden zugleich.
- Alle Zeitangaben der Datenbank tragen jetzt eine Zeitzone.
- Die anonyme Nutzungsmessung erfasst weitere Funktionen — etwa Abmeldungen,
  Postfach, Push-Auswahl, Einladungen, Suche, Jahresrückblick und offline
  Erledigtes —, weiterhin ohne Namen, Inhalte und Suchbegriffe.
- Die Statusabfrage des Servers meldet zusätzlich, wie viele Mitteilungen
  hängen oder endgültig gescheitert sind.
- Eine automatische Prüfung stellt sicher, dass Zeitgeber und Horcher mit
  ihrer Seite enden.
- Nach vielen Chat-Nachrichten kurz hintereinander werden die Zähler einmal
  statt für jede Nachricht neu abgefragt.
- Die iOS-App verlangt keine veraltete 32-Bit-Geräteeigenschaft mehr.
- Eine neue Installation bekommt als ersten Zugang ein Support-Konto ohne
  Gemeinde statt einer eigenen Gemeinde für den Betrieb.
- Sicherheitsupdate für eine Bibliothek, die der Server für den Versand von
  Mitteilungen mitbringt.
- Das Projekt ist aufgeräumt: Alte Analysen, abgeschlossene Prüfberichte und
  erledigte Aufträge sind aus dem Repo genommen. Planung, Betrieb und offene
  Punkte stehen jeweils an einer Stelle.
- Eine neue Installation entsteht allein aus dem gesicherten Datenbankschema;
  die über hundert älteren Datenbank-Änderungen, die darin längst enthalten
  sind, liegen nicht mehr daneben.
- Die API-Dokumentation im Browser nutzt eine gepflegte, aktuelle Fassung
  ihrer Anzeige statt einer eingefrorenen Kopie.
- Die automatischen Prüfungen testen auch den nativen Teil der Android-App.
  Ist nur dieser Teil rot, sagt die Meldung zur roten Prüfung, dass die
  Web-Version trotzdem ausgeliefert wurde und nur die Store-Builds warten.
- Verwaiste Upload-Dateien werden nur noch aufgelistet; gelöscht wird erst auf
  ausdrücklichen Wunsch und nur, was mindestens eine Woche alt ist.
- Der Bau der Android-App bricht ohne die Zugangsdatei für Mitteilungen und
  Absturzberichte nicht mehr gleich zu Beginn ab; er läuft dann ohne beides.
- Die Logik der Seiten liegt in Hooks, die App und Browser gemeinsam
  nutzen; die Bausteine der Web-Ansicht stehen an einer Stelle.
- Die Android-App wird mit aktuellen Bauwerkzeugen gebaut; das Bundle ist
  etwas kleiner, die Ressourcen schrumpfen um rund ein Viertel.
- Das gesonderte Test-System neben dem Betrieb ist abgeschafft: Jede
  Fassung der App, auch jeder Testbuild, spricht mit dem echten Betrieb.

## [2.3.0] - 2026-10-02

iOS-Build 240 · Android versionCode 134

Ein großes Dankeschön an Ron31: Er hat diese Version über Wochen
ausdauernd getestet, Fehler gemeldet und viele Verbesserungen vorgeschlagen —
von den Mitteilungen nach einem Update über die App-Sperre, den Dunkelmodus
und die Links aus Einladung und Passwort-Mail bis zum Hochladen von PDF und
Word.

### Hinzugefügt
- Im Profil lassen sich die Absturzberichte abschalten: Der Schalter
  „Absturzberichte senden" unter „Konto-Einstellungen" gilt für das Gerät;
  ausgeschaltet geht kein Bericht mehr hinaus, und was noch auf dem Gerät lag,
  wird verworfen.
- Eine orange Zahl in den Umschaltern oben zeigt, hinter welchem Reiter etwas
  wartet: Freigaben bei den Challenges (auch im Archiv) für alle, die freigeben
  dürfen, dazu für die Leitung zu verbuchende Events und offene Anträge.
- Einladungscodes gelten wahlweise 7, 14, 30, 60 oder 90 Tage. Beim
  Verlängern wählt die Gemeindeleitung ebenfalls, um wie viele Tage — höchstens
  bis 90 Tage im Voraus. Jeder Code läuft ab; abgelaufene lassen sich nicht
  wieder aufleben.
- Die Rückfrage vor dem Löschen eines Jahrgangs nennt, wie viele Events und
  Challenges mitgehen, wie viele dieser Events noch in der Zukunft liegen und
  was bestehen bleibt.
- Bei der Beförderung zur Teamer:in hält die App die Konfi-Zeit fest: besuchte
  Events mit Anwesenheit und Punkten, Aktivitäten, Bonuspunkte, Badges,
  Stempel und Konfispruch. Die Events stehen in der Konfi-Historie der
  Teamer:in und in der Detailansicht der Leitung — auch nachdem der alte
  Jahrgang gelöscht ist.
- Dateien im Material bleiben nach dem ersten Öffnen auf dem Gerät und öffnen
  sich beim nächsten Mal sofort — auch ohne Netz, dann mit dem zuletzt
  geladenen Stand des Materials. Beim Laden steht in der Zeile, wie weit es
  ist, und im Betrachter lässt sich durch alle Dateien des Materials wischen.
  Was die Leitung löscht, verschwindet auch vom Gerät; Links öffnen weiter im
  Browser. „Medien-Cache leeren" im Profil leert Material zusammen mit Chat
  und Challenges.
- Bilder und Dateien in Challenges bleiben auf dem Gerät gespeichert und laden
  beim zweiten Öffnen sofort — in der Galerie, bei den eigenen Beiträgen, in
  der Ansicht der Leitung und im Jahresrückblick, auch ohne Netz. Beim Laden
  steht wie im Chat, wie weit es ist; klappt es nicht, geht es mit „Erneut
  versuchen" noch einmal. Ein Foto lässt sich antippen und öffnen, mit Teilen
  und Sichern. Chat und Challenges teilen sich dabei einen Speicher, den
  „Medien-Cache leeren" im Profil zusammen leert.
- Die Gemeindeleitung kann jemanden, der schon ein Konto hat, in ihre Gemeinde
  einladen — unter „Mehr › Benutzer:innen" über den Knopf oben rechts. Dazu
  reicht der Benutzername oder die E-Mail-Adresse, und die Leitung gibt gleich
  die Rolle mit. Die eingeladene Person bekommt eine Mitteilung und eine
  E-Mail, findet die Einladung in ihrem Profil — in jeder Rolle an derselben
  Stelle, dorthin führen auch Mitteilung und Postfach — und entscheidet
  selbst; erst mit ihrer Zusage gehört sie zur Gemeinde.
  Sie behält Benutzername und Passwort, ihre bisherige Gemeinde bleibt
  unverändert. Die Einladung gilt 14 Tage. Solange sie offen ist, steht sie
  in „Mehr › Benutzer:innen" unter „Offene Einladungen" und lässt sich dort
  zurückziehen; bei der eingeladenen Person verschwindet sie dann aus Profil
  und Postfach. Konfis werden weiterhin über einen Einladungscode
  aufgenommen.
- In mehreren Gemeinden mitarbeiten, mit eigener Rolle je Gemeinde: Wer in der
  einen die Leitung stellt, kann in der anderen Teamer:in sein — die Rechte
  richten sich nach der Gemeinde, in der man gerade arbeitet. Der Umschalter
  steht auf den Hauptseiten und zeigt je Gemeinde, wo etwas offen ist;
  Mitteilungen, Postfach und Team-Kontaktliste umfassen alle Gemeinden. Wer
  in einer Gemeinde mitarbeitet, ist dort auch verwaltbar und bekommt dort
  Jahrgänge zugewiesen. Eine zweite Mitgliedschaft entsteht über die Einladung
  der Gemeindeleitung (siehe oben) oder über den Betrieb von Konfi Quest; das
  bestehende Konto bleibt erhalten.
- Der Jahresrückblick fürs Team wird je Gemeinde erstellt: Wer in zwei
  Gemeinden im Team ist, bekommt in jeder einen eigenen Rückblick mit den
  Zahlen genau dieser Gemeinde. Bisher gab es nur den der Stamm-Gemeinde.
- Eine Übersicht nach dem Update zeigt, was sich in dieser Fassung geändert
  hat — je Rolle das, was dort ankommt. Nachlesen geht jederzeit über „Was ist
  neu?" im Profil beziehungsweise unter „Mehr".
- Kündigt der Betrieb eine Wartung an, steht der Hinweis auf der Startseite
  jeder Rolle und auf der Anmeldeseite; wird eine App-Version nicht mehr
  unterstützt, bittet ein deutlicher Hinweis um das Update und führt direkt
  in den Store. Er lässt sich mit „Später" schließen, die App bleibt nutzbar,
  und erst beim nächsten Start fragt sie wieder — im Browser und ohne Netz nie.
- Auswählen, welche Mitteilungen aufs Handy kommen — auf iPhone und Android
  gleich, in der App statt in den Systemeinstellungen: Unter
  „Benachrichtigungen" im Profil beziehungsweise unter „Mehr" lassen sich
  „Nachrichten", „Events", „Punkte und Badges" sowie (für Team und Leitung)
  „Anfragen und Freigaben" einzeln ab- und anschalten, dazu ein Hauptschalter
  für alles. Abgeschaltet wird nur der Weg aufs Handy — im Postfach unter der
  Glocke steht jede Mitteilung weiterhin.
- Die App folgt dem Dunkelmodus des Handys: Steht das Gerät auf Dunkel,
  werden Hintergründe, Karten, Listen und Texte dunkel, die Bereichsfarben
  bleiben erkennbar. Umschalten geht in den Systemeinstellungen, nicht in
  der App. Auch Chat-Reaktionen, Rollenfarben, der Testphasen-Hinweis, die
  Ampel der Kennzahlen und die farbigen Kopfbereiche folgen dem Wechsel —
  sie hielten zunächst an den hellen Farben fest.
- Wer mehrere Gemeinden betreut, sieht in der Gemeinde-Auswahl oben links an
  jeder Gemeinde eine rote Zahl, wenn dort etwas offen ist — Anträge, Events,
  Beiträge, Chats, je nach eigener Rolle in dieser Gemeinde. So ist klar, wo
  Arbeit liegt, ohne erst hineinzuwechseln.
- Ein Postfach: Oben rechts steht jetzt eine Glocke, die alles sammelt, was
  die App dir mitteilen will — verliehene Badges, eingereichte Anträge und
  die Entscheidungen dazu. Auch was du als Push verpasst hast, steht dort.
  Ungelesenes ist markiert, Antippen führt an die passende Stelle, „Alle
  gelesen" räumt auf. Wer in mehreren Gemeinden mitarbeitet, sieht die
  Mitteilungen aller Gemeinden an einem Ort, jede mit ihrem Gemeindenamen.
- Das Postfach enthält jetzt alles, was bisher nur als Push kam: Punkte aus
  einem Event, Bonuspunkte, zugewiesene Aktivitäten, Level-Aufstiege,
  Stempel, Anmeldungen, Abmeldungen, Nachrücken von der Warteliste, abgesagte,
  geänderte und wieder stattfindende Events, ausgeblendete Beiträge. Für
  Team und Leitung: Abmeldungen von Konfis, Buchungen und Absagen des Teams,
  Events, die auf Verbuchung warten, neue Registrierungen, Beiträge zur
  Freigabe, die Warnung vor dem Löschen eines Jahrgangs sowie Ab- und
  Wieder-Anmeldungen von Pflicht-Events. Wer kein Push-Gerät hat oder
  Mitteilungen abgeschaltet hat, findet all das trotzdem hier. Nicht im
  Postfach: die Event-Erinnerung „morgen"/„gleich", neue Events, gestartete
  Challenges und Chat-Nachrichten — dafür gibt es eigene Listen und Zähler.
- Auch der freigegebene Jahresrückblick und ein neues Zertifikat stehen im
  Postfach. Antippen des Rückblicks öffnet genau die Ausgabe, um die es geht.
- Die Zahl am App-Symbol ist die Summe der Reiter, bei mehreren Gemeinden
  der Reiter aller Gemeinden. Ungelesene Mitteilungen im Postfach zählen
  dort nicht mit, ebenso wenig in den Zahlen am Gemeinde-Umschalter — sie
  zeigt der blaue Punkt an der Glocke. Ein offener Antrag zählt deshalb
  einmal, am Reiter, auch wenn „Neuer Antrag eingegangen" noch ungelesen im
  Postfach liegt. Eine Mitteilung „Events warten auf Verbuchung" ersetzt die
  vom Vortag, solange die noch ungelesen ist, statt sich täglich zu stapeln.
  Geräte, auf denen noch eine ältere App ohne Postfach läuft, bekommen die
  Zahl ohne Challenge-Neuigkeiten — dort ließen sie sich nicht abbauen, und
  die Zahl ginge nie auf null.
- Mitteilungen zu einem Event, einer Challenge oder einem Jahrgang
  verschwinden mit, wenn das Event, die Challenge oder der Jahrgang gelöscht
  wird — statt beim Antippen ins Leere zu führen. Die Meldung „Konfi hat sich
  abgemeldet" führt die Leitung jetzt direkt zum Event.
- Die Zahl an der Glocke zählt zusammen, was ungelesen ist und was noch aus
  einer Funklücke gesendet wird; ein endgültig gescheiterter Vorgang färbt sie
  rot.
- Im Postfach zeigt jede Badge-Mitteilung das Symbol des Badges statt eines
  allgemeinen Bands; Datum und Gemeinde tragen ein Symbol wie in den
  Event-Listen. Auf dem iPhone geht das Postfach als Karte mit abgedunkeltem
  Hintergrund auf und schließt über das Kreuz, wie jedes andere Fenster der
  App.
- Eine Badge-Mitteilung heißt nur noch „Neues Badge erhalten!" — vorher
  hing der technische Symbolname am Titel („… sunny-outline"), auch bei
  älteren Mitteilungen wird er nicht mehr gezeigt.
- Das Postfach räumt sich selbst auf: Ziehst du einen Antrag zurück oder
  löscht die Leitung ein Badge, verschwinden die Mitteilungen dazu — bei
  dir und bei der Leitung. Entscheidungen („verbucht", „abgelehnt") bleiben
  als Verlauf stehen.
- Das orange Feld an der einzelnen Challenge, das Leitung und Team offene
  Freigaben anzeigt, geht jetzt sofort mit — auch ohne Neuladen der Liste und
  immer im Gleichklang mit der Zahl am Reiter.
- Konfis sehen jetzt, wo es bei den Challenges etwas Neues gibt — wie im Chat:
  eine rote Zahl am Reiter, am App-Symbol und an der einzelnen Challenge. Sie
  zählt, was seit dem letzten Öffnen dazukam: eine neue Challenge, neue
  Beiträge in der Galerie und die Entscheidung des Teams über den eigenen
  Beitrag. Öffnen setzt die Zahl zurück.
- Einladungslinks, der Link aus der Passwort-vergessen-Mail und der
  Anmelde-Link der Webseite öffnen auf Android und auf dem iPhone direkt die
  App, wenn sie installiert ist — ohne Nachfrage und ohne Umweg über den
  Browser. Webseite, Datenschutz und Handbuch bleiben im Browser.
- Die Auslastungsanzeige ist ein Betriebs-Überblick geworden. Ganz oben steht
  in einem Satz, ob gerade alles läuft. Darunter: wie viele Anfragen zügig
  genug waren, wie viele Menschen in der letzten Stunde unterwegs waren und
  wie viele davon warten mussten oder einen Fehler bekamen.
- Ein Vergleich mit den Vortagen zeigt, was heute anders ist — bei Anfragen,
  Fehlern und der langsamsten Stelle. Der angebrochene Tag wird dafür auf die
  Stunde hochgerechnet, sonst sähe jeder Vormittag nach Einbruch aus.
- Die Ansicht „Routen" zeigt je Seite groß die typische Antwortzeit, daneben
  Durchschnitt und den langsamen Rand. So ist auf einen Blick zu sehen, ob
  eine Seite grundsätzlich langsam ist oder nur gelegentlich ausreißt. Dazu
  die Aufrufzahl und der Anteil an der gesamten Arbeit des Servers. Sortiert
  wird wahlweise nach Zeit pro Aufruf oder nach Häufigkeit.
- Fehler stehen jetzt zusammengefasst statt als Rohliste: was, wie oft, seit
  wann und wann zuletzt. Die Einzelfälle stehen weiterhin darunter.
- Leitung und Team sehen neue Challenge-Beiträge wie ungelesene Nachrichten im
  Chat: eine rote Zahl am Reiter und am Symbol der Challenge, bis sie die
  Challenge öffnen — auch bei Challenges ohne Freigabe, bei denen ein Beitrag
  sofort in der Galerie steht. Wartende Freigaben zeigt zusätzlich das orange
  Feld mit Uhr; am Reiter zählt ein Beitrag nie doppelt.
  Gemeinde-Umschalter und App-Symbol zählen die neuen Beiträge mit.
- Beim Anlegen einer Challenge gibt es wieder die Zielgruppe „Nur die
  Konfis": Die Konfis der gewählten Jahrgänge reichen ein, das Team dieser
  Jahrgänge sieht die Beiträge und begleitet die Challenge. Bestehende
  Challenges nur für Konfis behalten ihre Zielgruppe beim Bearbeiten, statt
  still auf „Jahrgang und Team" zu wechseln.
- Im Handbuch stehen unter dem geöffneten Kapitel dessen Abschnitte (13.1,
  13.2 …) als Unterpunkte in der Navigation, auch im Menü auf dem Handy. Der
  Abschnitt, in dem man gerade liest, ist dort markiert; ein Tipp auf einen
  Unterpunkt springt hin und schließt auf dem Handy das Menü.
- Wer von der Leitung aus einem Event ausgetragen oder auf die Warteliste
  zurückgesetzt wird, bekommt eine Mitteilung — als Push und im Postfach, für
  Konfis, Teamer:innen und Leitung. Antippen öffnet das Event. Bisher
  meldete sich nur das Eintragen, und wer ausgetragen war, hielt sich den
  Tag womöglich weiter frei.
- Nach jeder Passwortänderung kommt eine Bestätigung an die hinterlegte
  E-Mail-Adresse — ob selbst geändert, über „Passwort vergessen" neu gesetzt
  oder von der Leitung neu gesetzt. Setzt die Leitung das Passwort, sagt die
  Mail das; das Passwort selbst steht nie darin.
- Wer jemanden in die eigene Gemeinde eingeladen hat, erfährt, ob die Person
  zusagt oder absagt — als Mitteilung und im Postfach; Antippen öffnet die
  Benutzerliste. Gehört die einladende Person dort nicht mehr zur
  Gemeindeleitung, geht die Mitteilung an die Gemeindeleitung.

### Geändert
- Bei Pflicht-Events steht die Konfi-Liste eines Events nach Vornamen
  sortiert, wie in der Konfi-Ansicht — für die Leitung und unter „Wer kommt"
  für das Team. Bei anderen Events bleibt die Reihenfolge der Anmeldung.
- Mitteilungen an die Leitung über einzelne Konfis aus der Zeit vor dem
  27. September (Abmeldungen mit Grund, neue Registrierungen, Beiträge, Zu-
  und Absagen des Teams) sind aus dem Postfach entfernt. Sie ließen sich
  keinem Konto zuordnen und wären sonst ein Jahr lang stehen geblieben, auch
  nach dem Löschen der Person. Die Vorgänge selbst stehen weiter an Event und
  Challenge.
- Bei Event-Punkten steht in der Punkte-Übersicht, in der Konfi-Ansicht der
  Leitung und in der Konfi-Historie jetzt das Datum des Events statt des Tages
  der Verbuchung — so findet man das Event wieder, wie bei Aktivitäten mit
  ihrem Datum. Die Listen sind danach geordnet.
- Chat-Benachrichtigungen nennen nur noch, wer geschrieben hat und was es ist
  („Neue Nachricht von Anna", „Neues Foto von Anna"). Text, Dateinamen und
  Umfragefragen zeigt erst die App — sie stehen damit weder auf dem
  Sperrbildschirm noch bei Google oder Apple.
- Der Fortschritt an einem Serien-Badge zeigt 0, sobald die Serie gerissen
  ist — also wenn weder in dieser noch in der vergangenen Woche etwas
  eingetragen wurde. Bisher stand dort etwa „3/4" für eine Serie, die seit
  Monaten vorbei war. Wann das Badge vergeben wird, ändert sich nicht.
- Die App ist beim Herunterladen und bei jedem Update deutlich kleiner: Das
  Handbuch mit seinen Bildern, die Werbeseite und die Rechtstexte, die sie nie
  angezeigt hat, liegen nicht mehr darin — rund 36 MB weniger. Im Browser ist
  alles unverändert erreichbar.
- Das Handbuch im Browser lädt seine Bildschirmfotos viel schneller: zusammen
  1,4 statt 12 MB, in voller Schärfe. Nach dem Austausch eines Bildes zeigt
  der Browser gleich das neue.
- Auf dem iPhone erscheint Konfi Quest nicht mehr in der Dateien-App: Fotos,
  die auf das Hochladen warten, und geteilte Chat-Dateien liegen dort nicht
  mehr offen — auch nicht an der App-Sperre vorbei.
- Eine aus dem Chat geteilte Datei bleibt auf Android nicht mehr im
  öffentlichen Ordner „Dokumente“ liegen, wo andere Apps sie lesen konnten.
- Die Datenschutzerklärung beschreibt genau, wann die App einen Absturzbericht
  sendet: auch bei abgefangenen Fehlern im Hintergrund, höchstens 20 bis zum
  nächsten Start, dazu der Beginn jeder Sitzung.
- Die Datenschutzerklärung nennt die Geräte-Kennung, die die App bei der
  Anmeldung und beim Verlängern der Anmeldung sendet, wozu sie gespeichert und
  wann sie gelöscht wird.
- Die Datenschutzerklärung sagt, was in einer Push-Benachrichtigung steht — bei
  Chat-Nachrichten der vollständige Text — und dass sie auf iPhone und iPad
  auch über Apple zugestellt wird.
- Lange Listen der Leitung — Konfis, Events und gemeldete Aktivitäten — öffnen
  schneller: Sie zeigen zuerst 30 Einträge und laden beim Scrollen die nächsten
  nach; ein Knopf unter der Liste tut dasselbe. Suche, Filter und Zahlen gelten
  weiter für die ganze Liste.
- Auf Android steht am App-Symbol dieselbe Zahl wie auf dem iPhone, wo das
  Handy eine Zahl anzeigen kann. Auf Samsung- und Xiaomi-Geräten, die die
  Zahl aus den Mitteilungen bilden, ersetzt dafür jede neue Mitteilung von
  Konfi Quest die vorige; in der Leiste steht dort nur die neueste.
- Im Browser zeigt der Betrachter PDFs so wie die App auf Android: alle Seiten
  untereinander, mit Zoom. Bisher zeigte jeder Browser sie auf seine eigene
  Weise.
- Die orange Zahl in den Umschaltern steht mittig zur Beschriftung statt ein
  Stück darunter.
- Die Leitung hat eine eigene Farbe (Petrol) und ist damit auf einen Blick von
  der Gemeindeleitung (Indigo) und den Teamer:innen (Beere) zu unterscheiden — in
  der Benutzerliste, beim Anlegen und Einladen, bei den offenen Einladungen und
  bei den Mitgliedern eines Chats.
- Ist ein Event voll, fragt die App nach, bevor die Leitung jemanden über die
  Grenze nimmt — beim Bestätigen von der Warteliste wie beim Eintragen von
  Hand, für Konfis und Team getrennt. Nach „Trotzdem bestätigen" oder
  „Trotzdem eintragen" ist das Event überbucht. Bisher lehnte die App das
  Bestätigen nur mit „Fehler beim Bestätigen des Teilnehmers" ab, und das
  Eintragen von Hand überbuchte ohne Hinweis.
- Beim Löschen eines Jahrgangs gehen die Events und Challenges mit, die nur zu
  ihm gehören — samt Anmeldungen, Chats und Beiträgen. Gehören sie auch zu
  einem anderen Jahrgang, fällt nur die Zuordnung weg; Events „Nur Team" und
  Challenges „Nur das Team" bleiben. Vergebene Punkte bleiben gutgeschrieben,
  und Teamer:innen und Leitung behalten ihre Stempel aus den gelöschten
  Challenges.
- Material, das nur zu einem gelöschten Jahrgang gehörte, bleibt erhalten und
  gilt danach ausdrücklich für das ganze Team, mit Globus in der Liste; die
  Rückfrage vor dem Löschen nennt, wie viel Material das betrifft.
- Wer als Konfi ins Team befördert wurde, behält in der Konfi-Historie seine
  Konfi-Badges so, wie er sie verdient hat — auch wenn die Leitung ein Badge
  später löscht, umbenennt oder den Zielwert ändert. Aktuelle Konfis sehen
  Änderungen weiter sofort, ein gelöschtes Badge verschwindet bei ihnen.
- In der Challenge-Liste von Leitung und Team zählt die rote Zahl am Symbol
  jeden neuen Beitrag seit dem letzten Öffnen, auch einen, der noch auf
  Freigabe wartet, und verschwindet beim Öffnen — wie im Chat. Orange steht
  nur für Wartendes: im Feld mit Uhr an der Challenge, das keine Zahl mehr
  trägt, und als Zahl an den Umschaltern Aktuell, Geplant und Archiv und in
  der geöffneten Challenge am Reiter „Wartet“, wo sie beim Freigeben und
  Ablehnen sofort mitgeht.
- Ungelesene Mitteilungen zeigt die Glocke in jeder Rolle mit einem blauen
  Punkt statt mit einer Zahl; eine Zahl an der Glocke steht nur noch für
  Vorgänge, die aus einer Funklücke gesendet werden. Im Postfach trägt jede
  ungelesene Mitteilung denselben Punkt in der Ecke.
- Die Rollen heißen überall „Leitung" und „Gemeindeleitung" statt „Admin",
  „Hauptamt" oder „Org-Admin" — beim Anlegen und Einladen, in der
  Rollenauswahl, in den Listen, im Chat und im Handbuch. Beide Rollen können
  Haupt- wie Ehrenamtliche haben.
- App, Meldungen, Mails und Handbuch sprechen von „Gemeinde" statt von
  „Organisation" — etwa bei „Gemeinde wechseln", in der Verwaltung der
  Gemeinden und im Hinweis auf eine gesperrte Gemeinde.
- Die Rolle „Org-Leitung" heißt jetzt „Gemeindeleitung" — in der App, in
  Mitteilungen, Mails, im Handbuch und auf der Startseite im Web. Dort heißt
  der Tarif für bis zu vier Gemeinden jetzt „Verbund".
- Beim Öffnen eines Antrags und einer Konfi lädt die App für die Leitung nur
  noch die Anträge, um die es geht, statt der ganzen Antragsgeschichte der
  Gemeinde.
- Eine Anmeldung gilt nur auf dem Gerät, auf dem sie entstanden ist. Landen
  die gespeicherten Anmeldedaten auf einem anderen Gerät, etwa mit einer
  Sicherung auf einem neuen Handy, fragt die App dort einmal nach dem
  Passwort.
- Ein Event ohne Jahrgang gilt der ganzen Gemeinde: Alle Konfis sehen es in
  ihrer Event-Liste und können sich anmelden, auch Konfis ohne Jahrgang.
  Bisher sahen Konfis solche Events gar nicht.
- Beim Anlegen von Material werden Fotos wie im Chat verkleinert, und eine
  Datei über 20 MB meldet die App gleich bei der Auswahl statt erst beim
  Speichern. Beim Speichern steht, wie weit das Hochladen ist.
- Das Foto zu einer gemeldeten Aktivität zeigt beim Laden, wie weit es ist,
  und lässt sich mit „Erneut versuchen" neu laden — beim Konfi, beim Team und
  bei der Leitung, auch groß im Konfi-Profil, das sich dafür sofort öffnet.
  Ohne Netz steht statt einer Ladeanzeige, dass das Foto offline nicht
  verfügbar ist. Nachweisfotos bleiben dabei bewusst nicht auf dem Gerät.
- Beim Melden einer Aktivität wird das Foto wie in Chat und Challenges
  verkleinert; ist es danach noch zu groß, sagt die App es mit demselben Satz
  wie dort. Beim Absenden steht, wie weit das Hochladen ist.
- Eine neue Challenge, bei der das Team mitmacht, steht bei Teamer:innen und
  Leitung als rote Zahl an der Challenge und am Reiter, bis sie geöffnet
  wird — wie bei den Konfis. Bisher zählten fürs Team nur neue Beiträge.
- Eine Challenge lässt sich ohne Netz öffnen: Sie zeigt den zuletzt geladenen
  Stand samt Fotos vom Gerät. War sie noch nie offen, sagt sie, dass die
  Beiträge offline nicht verfügbar sind — bisher kamen eine Fehlermeldung und
  eine leere Galerie, als gäbe es keine Beiträge. Mit Netz gilt wie bisher
  immer der Stand des Servers.
- Beim Einreichen eines Challenge-Beitrags mit Foto, Video oder Aufnahme steht
  wie im Chat, wie weit das Hochladen ist — mit Prozentzahl und Balken, bei
  100 % „Wird verarbeitet…". Fotos werden in Chat und Challenges auf demselben
  Weg verkleinert, und eine zu große Datei meldet die App überall mit demselben
  Satz. Eine zu große Tonaufnahme fällt gleich nach der Aufnahme auf statt erst
  beim Einreichen.
- Bilder und Videos im Chat zeigen beim Laden, wie weit sie sind — mit
  Prozentzahl und Balken wie beim Öffnen einer Datei. Klappt das Laden nicht,
  lässt es sich mit „Erneut versuchen" wiederholen. Ohne Netz steht statt einer
  Ladeanzeige, dass das Bild offline nicht verfügbar ist; es lädt von selbst,
  sobald wieder Netz da ist.
- Wer im Chat durch die Dateien wischt oder eine Datei teilt, lädt sie nicht
  mehr erneut herunter, wenn sie schon auf dem Gerät liegt.
- Im Dunkelmodus setzen sich Karten und Listen deutlicher vom Hintergrund ab:
  Sie sind jetzt erkennbar heller als der Grund statt fast schwarz auf schwarz
  und werfen einen leichten Schatten. Auf Android war der Unterschied bisher
  am kleinsten.
- Die kleinen Marken in der Ecke von Karten zeigen jetzt durchgehend Symbole
  statt Wörter: die Rolle in der Benutzerliste (Gebäude für die Gemeindeleitung, Schild
  für Admin, Person für Teamer:in), „Voll"/„Frei" bei den Events einer Serie
  (Kreuz/Haken), „Aktiviert" bei den Benachrichtigungen (Haken), „Neu" im
  Postfach (ein blauer Punkt) und die Restlaufzeit von Einladungscodes
  (Zahl der Tage plus Uhr; am letzten Tag ein oranges, abgelaufen ein rotes
  Warnzeichen). In der Antragsliste der Konfis erschien als Einzige noch ein
  Wort — auch dort steht jetzt das Symbol. Ein Konfirmationstermin, der nicht
  mehr wählbar ist, weil schon ein anderer gebucht ist, trägt einen
  Doppelpfeil („woanders angemeldet") statt eines Schlosses. Wer mit dem
  Finger darauf bleibt, bekommt weiterhin den ganzen Satz.
- Alle Symbol-Marken in den Ecken der Karten sind jetzt für Vorlesehilfen
  beschriftet — der Satz, der beim Verweilen erscheint, wird auch vorgelesen.
  Bisher galt das nur für einen Teil von ihnen.
- Mitteilungen über Punkte — aus einem Event, als Bonus oder für eine
  eingetragene Aktivität — führen beim Antippen in die Punkte-Übersicht statt
  zum Event oder auf die Startseite. Ein Stempel führt zu den Challenges,
  wo die Stempel stehen, nicht mehr zu den Badges. Der Jahresrückblick
  öffnet den jeweiligen Rückblick im Profil statt der Startseite.
- Eine neue Gemeinde startet mit denselben sechs Levels wie die bestehenden —
  mit geschlechtsneutralen Titeln (Noviz:in, Lehrling, Unterstützung,
  Expert:in, Meisterschaft, Legende). Sie sind ein Startpunkt und lassen sich
  wie bisher umbenennen, umfärben und in den Punkten ändern.
- Der runde Knopf unten links ist verschwunden, der anzeigte, dass noch etwas
  gesendet wird: Die Warteschlange steht jetzt im Postfach hinter der Glocke
  oben rechts. Bei den Anträgen bleibt die Karte „Wird gesendet…" mit den
  einzelnen Vorgängen.
- Der Gemeinde-Umschalter oben links steht auf allen Seiten, die über die
  Leiste unten erreichbar sind — Konfis, Chat, Mitmachen, Challenges und
  „Mehr" für die Leitung; Start, Chat, Challenges und Mitmachen für Konfis
  und Team, dazu Badges bei den Konfis und Material beim Team —, nicht mehr
  nur in der Konfi-Liste. Wer über einen Push oder das Postfach in eine
  andere Gemeinde gewechselt ist, sieht so, wo er gerade arbeitet, und kommt
  von jeder dieser Seiten zurück. Nicht steht er in Detailansichten
  (einzelnes Event, einzelne Konfi, einzelnes Material, Chatraum), auf den
  Unterseiten unter „Mehr" (Aktivitäten, Badges, Jahrgänge, Level, Material,
  Jahresrückblick) sowie auf Profil, Benutzer:innen, Organisationen und
  Betrieb: Was dort zu sehen ist, gehört zu genau einer Gemeinde, ein Wechsel
  führte ins Leere. Die Glocke steht dagegen auf jeder Seite, auch im
  Chatraum.
- In der Gemeinde-Auswahl steht die aktive Gemeinde fett und leicht
  hinterlegt statt mit grünem Haken; der Gemeindename am Knopf ist kleiner und
  nimmt in der Kopfzeile weniger Platz ein.
- Die Mitteilungen im Postfach sehen aus wie jede andere Liste der App: Karte
  im Hintergrund, farbiger Rand und Symbol je Bereich — Badges in der
  Badge-Farbe, Anträge in der Aktivitätenfarbe. Ungelesenes trägt einen
  blauen Punkt in der Ecke.
- Die Nutzungsbedingungen sind neu gefasst: Der Quelltext bleibt öffentlich
  einsehbar, der Betrieb braucht künftig eine schriftliche Vereinbarung.
- Große Dateien laufen zuverlässiger durch: Fotos, Sprachaufnahmen und
  Videoclips gehen beim Hochladen und Abrufen nicht mehr durch den
  Arbeitsspeicher. Mehrere gleichzeitige Uploads bringen den Server damit nicht
  mehr an seine Grenze — auch nicht, wenn viele Gemeinden zusammenkommen.
- Der Dunkelmodus ist flächig überarbeitet: Listen, Suchfelder, Auswahlfelder,
  Meldungen und die Fenster, die sich über eine Seite legen, liegen jetzt auf
  demselben dunklen Kartenton wie die Karten — auf iPhone und Android gleich.
  Auf dem iPhone waren Listen und Suchfelder bisher tiefschwarz und die Karten
  dunkler als vorgesehen, sodass bis zu fünf Grautöne auf einem Bildschirm
  standen. Farbige Beschriftungen, Symbole und Hinweiskästen — „Gesamt" in
  Konfi-Violett, Materialhinweise in Orange, Chat-Antworten in Türkis — sind
  im Dunkeln jetzt in einer aufgehellten Stufe ihrer Bereichsfarbe gesetzt
  und damit lesbar; im Hellen bleiben sie, wie sie sind.
- Graue Nebentexte — Zeitstempel, Untertitel, Zähler, Leerzustände wie „Noch
  keine Materialien vorhanden", die Namen noch nicht erreichter Stempel —
  sind in beiden Modi etwas kräftiger und damit auch bei Sonne oder
  schwächeren Augen lesbar. Im Hellen waren die drei zartesten Grautöne unter
  der Lesbarkeitsgrenze für Fließtext, im Dunkeln war der zarteste sogar
  dunkler statt heller gesetzt und auf den Stempel-Kacheln kaum zu erkennen.
  Die Abstufung untereinander bleibt erhalten.
- Die Regler für Punkte, Plätze und Wiederholungen zeigen jetzt Rastermarken
  und rasten darauf ein. Die Höchstwerte für Teilnehmende und Zeitfenster sind
  auf ein alltagstaugliches Maß gesetzt; bestehende Events mit mehr Plätzen
  behalten ihre Zahl.
- Die Event-Listen für Konfis, Team und Leitung laden spürbar schneller, wenn
  viele Gemeinden dieselbe Datenbank teilen: Die Buchungszahlen je Event
  werden nur noch für die eigenen Events gezählt statt für alle Buchungen
  aller Gemeinden. An den angezeigten Zahlen ändert sich nichts.
- Die App gibt Deutsch als ihre Sprache an. Vorlesefunktionen wie VoiceOver
  und TalkBack lesen sie deshalb mit deutscher Stimme vor statt mit englischer.
- Auf der Anmeldeseite sind Benutzername und Passwort als solche
  gekennzeichnet, damit Passwort-Manager und Hilfsmittel die Felder erkennen.
- Nachrichten in großen Gruppen kommen schneller an: Die Mitteilungen aufs
  Handy werden für alle Teilnehmenden zusammen vorbereitet statt für jede
  Person einzeln. Wer die Nachricht bekommt, was darin steht und welche Zahl
  am App-Symbol erscheint, bleibt gleich — auch bei vielen Gemeinden in
  derselben Datenbank bleibt der Rest der App dabei flüssig.
- Die Erinnerungen vor einem Event gehen bei vielen Angemeldeten gesammelt
  hinaus, je Event auf einmal statt Person für Person. An der Auswahl, wer
  erinnert wird, und am Text ändert das nichts; ein Erinnerungslauf mit
  vielen Events belastet die Datenbank nicht mehr minutenlang.
- Die App folgt der Einstellung „Bewegung reduzieren" des Geräts: Dann
  entfallen Seitenübergänge, das Schütteln bei falscher Anmeldung, pulsierende
  Ladepunkte und Badges, gleitende Karten und der Wisch durch die
  Einführung — alles erscheint sofort an seinem Platz. Der Jahresrückblick
  kennt diese Einstellung bereits und bleibt, wie er ist.
- Admins bekommen die Mitteilung über neue Beiträge nur noch zu Challenges,
  die sie auch sehen: denen ihrer Jahrgänge und denen nur fürs Team. Bisher
  bekam jeder Admin zu jeder Challenge eine Mitteilung, sah viele davon in
  Liste und Reiter aber gar nicht.
- Teamer:innen bekommen die Mitteilung über neue Beiträge auch bei Challenges
  nur fürs Team, die sie ja mitverwalten. Wer selbst etwas einreicht, bekommt
  über den eigenen Beitrag keine Mitteilung mehr.
- Daten stehen überall in derselben Form: kurz als 14.09.2026 in Listen,
  Karten und Übersichten — auch dort, wo bisher „8. Sept. 2026" oder
  „8.9.2026" stand —, auf den Event-Karten der Startseite mit Wochentag
  (Mo., 14.09.2026), ausgeschrieben als „Montag, 14. September 2026" in
  Einzelansichten und Rückfragen, Uhrzeiten als 18:00. Wo der Platz
  knapp ist (Chat, Anwesenheitsliste), fällt das Jahr weg: 14.09.
- Neue Anträge melden sich nur noch bei der Leitung, die sie auch in ihrer
  Antragsliste sieht: bei der Gemeindeleitung immer, bei Admins nur für Konfis
  aus ihren Jahrgängen. Anträge von Teamer:innen hängen an keinem Jahrgang
  und gehen weiterhin an alle Admins und die Gemeindeleitung. Bisher bekam
  jeder Admin jeden Antrag gemeldet — samt Zahl an Glocke und App-Symbol —,
  auch wenn er ihn gar nicht öffnen konnte. Wer selbst eine Aktivität meldet,
  bekommt über den eigenen Antrag keine Mitteilung mehr.
- Abmeldungen von Konfis, Ab- und Wieder-Anmeldungen bei Pflicht-Events und
  Zu- oder Absagen des Teams melden sich nur noch bei der Leitung, die das
  Event in ihrer Liste sieht: bei der Gemeindeleitung immer, bei Admins nur
  für Events ihrer Jahrgänge; Events „Nur Team" und Events ohne Jahrgang
  weiterhin bei allen Admins. Bisher bekam jeder Admin jede dieser Meldungen
  samt Namen und Grund, auch zu Events, die er nicht öffnen konnte. Wer selbst
  zu- oder absagt, bekommt darüber keine Meldung mehr, und eine Abmeldung, die
  nicht über die App kam, meldet sich wie jede andere.
- „Events warten auf Verbuchung" nennt jeder Person die Zahl, die ihr Reiter
  „Verbuchen" zeigt, statt der Zahl der ganzen Gemeinde; wer nichts zu
  verbuchen hat, bekommt keine Erinnerung. Reiter und App-Symbol zählen
  „Team gesucht"-Events fremder Jahrgänge nicht mehr mit — sie ließen sich
  dort weder finden noch verbuchen.
- „Neue Registrierung" geht immer an die Gemeindeleitung und an die Admins
  des Jahrgangs. Bisher fiel die Gemeindeleitung heraus, sobald ein Admin dem
  Jahrgang zugewiesen war, und war niemand zugewiesen, bekam jeder Admin der
  Gemeinde die Meldung. Die Warnung vor dem Löschen eines Jahrgangs geht an
  die Gemeindeleitung und die Admins, die in diesem Jahrgang befördern dürfen,
  statt an jeden Admin.
- Die Erinnerung an eine ablaufende Lizenz geht an alle in der
  Gemeindeleitung, auch an die, die sie über eine Einladung mitleiten — und nicht
  mehr an Admins.
- Mitteilungen zu Challenge-Beiträgen bekommt nur noch, wer den Jahrgang auch
  ansehen darf; eine Zuweisung ohne Leserecht reicht dafür nicht mehr.
- App und Handbuch sprechen dieselbe Sprache: Was man besucht, sammelt und
  mitmacht, heißt überall Event, Badge, Challenge und Stempel — auch in
  Mitteilungen, Einführung, Rückblick, Fehlermeldungen und in den
  Android-Einstellungen („Events", „Punkte und Badges"). „Termin" steht nur
  noch für Datum und Uhrzeit, die Suche heißt in allen Rollen „Events
  durchsuchen" und „Badges durchsuchen". Ein kurzes Glossar im Handbuch
  erklärt die Wörter.
- Im Chat zu einem Event ist, wer bestätigt angemeldet ist — auch wer sich
  erst nach dem Anlegen des Chats anmeldet oder von der Warteliste nachrückt.
  Wer auf der Warteliste steht oder schon abgemeldet ist, kommt nicht mehr
  hinein, und wer auf die Warteliste zurückgesetzt wird, verlässt den Chat.
  Bisher saßen dort auch Wartende und beim Anlegen schon Abgemeldete.
- Admins öffnen Chats, in denen sie nicht selbst Mitglied sind, nur noch für
  ihre Jahrgänge: Jahrgangs-Chats ihrer Jahrgänge, Event-Chats von Events aus
  ihrer Event-Liste und Räume nur fürs Team. Jahrgangs-Chats, Event-Chats und
  Gruppen mit Konfis anderer Jahrgänge lassen sich nicht mehr lesen,
  beschreiben, exportieren oder live mitverfolgen, und niemand trägt sich
  dort selbst ein oder löscht sie. Die Gemeindeleitung öffnet weiterhin jeden
  gemeinschaftlichen Chat der Gemeinde; fremde Zweiergespräche bleiben für
  alle zu und lassen sich auch nicht mehr löschen. In der Chatliste ändert
  sich nichts.
- Ein Konto ist entweder Konfi oder im Team, auch über Gemeindegrenzen
  hinweg: Konfi ist nur, wer zu genau einer Gemeinde gehört. Einladungen,
  Zuweisungen und Rollenwechsel, die beides verbinden würden, lehnt die App
  mit einer Erklärung ab.
- Fragt das iPhone zum ersten Mal nach der Kamera, nennt der Text auch das
  Scannen der QR-Codes beim Einchecken zu Events und Fotos für Aktivitäten —
  bisher nur Fotos für Chat und Challenges.
- Den QR-Code zum Einchecken und den Zähler darunter zeigen Admins und
  Teamer:innen nur noch für Events ihrer Jahrgänge, für Events „Nur Team" und
  für Events ohne Jahrgang — also für die Events, die sie in ihrer Liste sehen.
  Die Gemeindeleitung kommt weiter an jeden Code der Gemeinde.
- Wird ein Konto gelöscht, bleiben die Einladungscodes, die die Person für
  die Gemeinde angelegt hat, gültig — wie ihre Events, ihr Material und ihre
  Badges, jeweils ohne ihren Namen. Bisher verschwanden die Codes mit dem
  Konto.
- Die Rückfragen vor dem Löschen eines Kontos — einer Konfi, einer
  Teamer:in, unter „Benutzer:innen" und im eigenen Profil — nennen knapp,
  was verschwindet: Punkte, Badges, Stempel, Anträge samt Fotos,
  Event-Anmeldungen, Challenge-Beiträge, Chat-Nachrichten und
  Zweiergespräche; beim Team auch, was der Gemeinde bleibt.
- Ein Konto bleibt auf höchstens zehn Geräten oder Browsern gleichzeitig
  angemeldet, auf jedem Gerät mit einer Anmeldung. Kommt eine weitere dazu,
  endet die Anmeldung, die am längsten nicht benutzt wurde; auf Geräten, die
  lange nicht genutzt wurden, ist dann eine neue Anmeldung nötig.

### Entfernt
- Das Balkendiagramm „Anfragen pro Minute" in der Auslastungsanzeige ist weg.
  Es hatte weder Skala noch Zeitmarken und keine ablesbaren Werte. Die
  Aufrufzahlen stehen als Zahl in den Kennzahlen, die Fehler mit Zeitpunkt
  unter „Fehler".

### Behoben
- Dateinamen mit Umlauten stehen in Chat, Material und Challenges richtig da:
  aus „Gebetswürfel.pdf“ wurde bisher „GebetswÃ¼rfel.pdf“. Das gilt auch für
  die Dateien, die schon hochgeladen sind.
- Auf Samsung- und Xiaomi-Handys bleibt keine 1 mehr am App-Symbol stehen,
  wenn nichts offen ist: Eine Mitteilung wie eine Event-Erinnerung, die kam,
  als nichts zu tun war, verschwindet beim Öffnen der App.
- Die Erinnerung „Gleich: …" kommt nicht mehr bis zu 75 Minuten vor Beginn,
  sondern eine Stunde vorher und nennt die Uhrzeit des Events („Gleich:
  Konfistunde um 16:00 Uhr") statt „In 1 Stunde". Beginnt ein Event nicht zur
  vollen oder Viertelstunde, kommt sie bis zu einer Viertelstunde später, nie
  früher. Dasselbe gilt für „Morgen: …" 24 Stunden vorher; ein Event kurz nach
  Mitternacht wird nicht mehr am Abend zwei Tage davor als „morgen"
  angekündigt.
- Auf der Startseite der Teamer:innen steht unter der Begrüßung die eigene
  Funktionsbeschreibung wie im Profil, statt immer „Teamer:in". Eine geänderte
  Beschreibung gilt dort sofort.
- PDF-, Word- und andere Dokumente lassen sich vom Android-Handy wieder in den
  Chat und ins Material hochladen, auch aus Google Drive oder dem
  Download-Ordner. Bisher brach das Hochladen dort ohne Grund ab. Die App
  liest ein gewähltes Dokument dafür gleich bei der Auswahl ein, wie Fotos.
- Eine Chat-Nachricht mit Datei, die wegen einer abgerissenen Verbindung nicht
  rausging, bleibt in der Warteschlange und geht später los, statt als
  fehlgeschlagen stehen zu bleiben. Dasselbe gilt für einen Antrag mit Foto,
  der ohne Netz gestellt wird.
- Kommt beim Speichern eines neuen Materials die Datei nicht an, legt ein
  zweites Speichern kein weiteres Material an, sondern lädt die Datei in das
  schon gespeicherte. Die Meldung sagt, dass nur die Dateien fehlen.
- Wer einen Chat öffnet, findet dessen Mitteilungen danach nicht mehr in der
  Leiste — auf Android ging das bisher nie, auf dem iPhone nicht, wenn ein
  Push die App gestartet hatte. Beim Öffnen der Events gilt dasselbe für die
  Event-Mitteilungen. Auf Samsung und Xiaomi bleibt die eine Mitteilung, an
  der die Zahl am App-Symbol hängt, bis nichts mehr offen ist.
- Im Event-Formular trägt „Jahrgänge“ das Pflicht-Sternchen nur noch bei
  Pflicht-Events; ohne Auswahl steht dort, dass das Event der ganzen Gemeinde
  gilt.
- Bei genau einem Punkt heißt es überall „1 Punkt" statt „1 Punkte" — etwa
  beim Fortschritt zum nächsten Level auf der Startseite der Konfis, in der
  Rangliste, bei Levels und Badges und im Rückblick.
- Im Profil steht unter dem Namen die eigene Funktionsbeschreibung; besteht
  sie nur aus Leerzeichen, steht dort bei Teamer:innen „Teamer:in" und bei der
  Leitung nur die Rolle statt einer leeren Angabe.
- Ein Update des Servers unterbricht die App nicht mehr; bisher war sie dabei
  rund eine halbe Minute nicht erreichbar. Nur die Web-Version kann während
  eines Updates wenige Sekunden lang nicht laden.
- Ein Benutzername lässt sich beim Bearbeiten nicht mehr auf einen Namen ändern,
  den es schon gibt — auch nicht in anderer Schreibweise oder aus einer anderen
  Gemeinde; die Anmeldung bleibt so eindeutig.
- Der Systemname einer Gemeinde behält Umlaute (aus „Büsum“ wird „buesum“ statt
  „bsum“) und bleibt beim Speichern unverändert, solange ihr Name gleich bleibt.
- Legen zwei Personen im selben Moment ein Konto mit demselben Benutzernamen
  an, entsteht nur eines; die andere Anlage meldet, dass der Name vergeben ist.
- Die Badges einer Konfi, die nur über eine weitere Gemeinde dazugehört, lassen
  sich in der Leitung öffnen; bisher kam dort „nicht gefunden".
- Karten, Store-, Musik- und Weblinks aus der App lösen die App-Sperre nicht
  mehr aus, auch nicht bei „Sofort“.
- Lehnt der Server eine Chat-Nachricht ab — etwa weil die Datei zu groß ist
  oder ihr Format nicht angenommen wird —, steht der Grund an der Nachricht
  und oben als Hinweis. Die App versucht es dann nicht mehr sinnlos noch
  einmal, und das Menü an der Nachricht bietet nur noch das Löschen an.
- Eine im Chat geschriebene Nachricht, die nicht rausging, steht sofort als
  fehlgeschlagen da statt weiter als „wartet“, und „Nachricht löschen“ nimmt
  sie auch nach dem nächsten Öffnen des Chats nicht wieder zurück in die Liste.
- Der Titel der Konfi-Liste der Leitung wird auf Android nicht mehr
  abgeschnitten („Konfirmand…“): Er heißt wie der Reiter „Konfis“, im
  Umschalter auf „Team“ entsprechend „Team“.
- Die Rückfrage vor dem Löschen einer ganzen Gemeinde sagt nicht mehr, alle
  Benutzer:innen würden gelöscht: Gelöscht werden die Konten, die nur zu
  dieser Gemeinde gehören; wer auch zu einer anderen gehört, behält sein
  Konto. Die Meldung danach nennt, wie viele Konten gelöscht und wie viele
  umgezogen sind.
- Auf Samsung- und Xiaomi-Geräten nimmt die App die Mitteilung, an der die
  Zahl am App-Symbol hängt, aus der Leiste, sobald die Zahl auf 0 sinkt.
  Bisher blieb dort eine 1 stehen, bis man die Mitteilung wegwischte. Alle
  anderen Mitteilungen bleiben liegen, bis man sie antippt oder wegwischt.
- Auf Android erscheint eine Mitteilung auch, während die App offen ist — wie
  auf dem iPhone —, und die Zahlen an den Reitern stellen sich sofort darauf
  ein.
- Mitteilungen zeigen auf Android in der Statusleiste und in der Mitteilung
  die Lutherrose von Konfi Quest in Violett statt eines weißen Flecks.
- Die Dateiauswahl löst die App-Sperre nicht mehr aus: Wer im Chat, im
  Material oder für einen Antrag ein Foto oder eine Datei auswählt, wird danach
  nicht mehr nach Fingerabdruck oder Face ID gefragt.
- Word-Dateien lassen sich auf Android wieder im Chat senden. Nennt das Handy
  keinen Dateityp, zählt die Endung des Dateinamens — ebenso im Material, bei
  Challenge-Beiträgen und beim Foto zu einem Antrag.
- Die Dateiauswahl im Chat bietet alle Formate an, die der Chat annimmt, auch
  PowerPoint, CSV und Tondateien.
- Eine Datei in einem Format, das Chat oder Material nicht annehmen, fällt
  nicht mehr still weg: Die Chat-Nachricht geht dann nicht ohne sie raus, und
  das Material meldet „Dieser Dateityp kann nicht hochgeladen werden."
- Endet oder beginnt eine Challenge, während sie offen ist, zeigt die Ansicht
  das im selben Moment: Eine gerade beendete Challenge bietet kein Einreichen
  mehr an, statt bis zum nächsten Laden als laufend dazustehen.
- Eine neue Gemeinde entsteht ganz oder gar nicht: Geht beim Anlegen etwas
  schief, bleibt keine halb angelegte Gemeinde zurück. Der Benutzername der
  ersten Gemeindeleitung muss im ganzen System frei sein, wie bei jedem
  anderen Konto, und der Systemname behält Umlaute als ae, oe, ue und ss
  („buesum" statt „bsum"). Bestehende Gemeinden behalten ihren Namen.
- Ein Konto mit Super-Admin-Recht kann die eigene Gemeinde nicht mehr löschen,
  wenn es nur dort Mitglied ist — es hätte sich dabei selbst mitgelöscht und
  ausgesperrt. Die Meldung sagt, wer es stattdessen tun kann.
- Wird ein Pflicht-Event abgesagt, gilt auch eine Konfi als entschuldigt, die
  sich abgemeldet hatte, dann doch kam und schon verbucht war. Bisher blieb
  sie anwesend, und das abgesagte Event zählte bei ihr als besuchtes
  Pflicht-Event. Ihre Abmeldung bleibt sichtbar; wird die Absage
  zurückgenommen, steht sie wieder als abgemeldet da.
- Die Begrüßung auf der Startseite fürs Team springt beim Neuladen nicht mehr
  zwischen „Moin" und der Tageszeit hin und her; sie wird einmal beim Öffnen
  festgelegt.
- Android: Auf Huawei-Geräten kam die Zahl, die die App ans App-Symbol meldet,
  in der Store-Fassung nicht an; auf Samsung-Geräten nahm sie nur einen von
  zwei Wegen. Beides ist behoben, und Sony-Geräte mit dem älteren
  Xperia-Startbildschirm erreicht die Zahl jetzt ebenfalls.
- Android: Auf Sony-Geräten steht am App-Symbol die Zahl der App statt nur
  eines Punkts — dieselbe Summe wie auf dem iPhone, auch bei geschlossener
  App.
- Android: Mit jeder Mitteilung zieht die Zahl am App-Symbol auf Sony- und
  Huawei-Geräten sofort nach, wie auf dem iPhone — auch wenn die App
  geschlossen ist.
- Wird eine ganze Gemeinde gelöscht, behält, wer auch zu einer anderen
  Gemeinde gehört, sein Konto und ist ab dann dort zuhause; bisher verschwand
  es mitsamt der Arbeit in der anderen Gemeinde. Die übrigen Konten gehen
  vollständig, auch mit ihren Spuren in anderen Gemeinden — bisher konnte das
  Löschen der Gemeinde daran scheitern.
- Der Team-Rückblick zählt nur Team-Badges. Badges aus der Konfi-Zeit stehen
  dort nicht mehr — weder in der Zahl noch als erstes Badge des Jahres — und
  machen kein Jahr mehr wählbar.
- Wer in einer weiteren Gemeinde im Team ist, sieht dort im Profil keine
  Konfi-Historie aus der eigenen Gemeinde mehr; sie steht in der Gemeinde, in
  der die Konfi-Zeit war.
- Ein Jahrgang lässt sich nicht mehr löschen, solange darin jemand Konfi ist,
  der in einer anderen Gemeinde zum Team gehört. Bisher galt diese Person als
  befördert und verlor beim Löschen ihren Jahrgang.
- Eine geplante, noch nicht gestartete Challenge lässt sich nach einer
  einfachen Rückfrage löschen, wie im Handbuch beschrieben; bisher warnte die
  App, sie sei bereits gestartet.
- Auf Android öffnen Bilder, Videos und PDFs jetzt in der App: im Betrachter
  mit Zoom und Wischen zu den übrigen Dateien, PDFs mit allen Seiten
  untereinander. Bisher gingen sie in eine andere App.
- Wer eine Datei in einer anderen App öffnet — auf Android etwa ein
  Word-Dokument — und zurückkommt, wird bei eingeschalteter App-Sperre nicht
  mehr nach Fingerabdruck oder Face ID gefragt. Bisher kam die Abfrage bei
  „Sofort" nach jeder Datei.
- Teamer:innen und Leitung lassen sich wieder von Hand zu Events hinzufügen:
  Die Auswahl blieb leer, obwohl sie dem Jahrgang des Events zugewiesen waren.
- Wer über eine Einladung im Team oder in der Leitung einer Gemeinde ist, steht
  dort jetzt in der Team-Liste, in der Auswahl am Event und in der
  Detailansicht und lässt sich eintragen; Jahrgänge, Badges und Punkte zeigen
  Liste und Detailansicht nur aus dieser Gemeinde.
- Teamer-Badges und Zertifikate bleiben bei der Gemeinde, in der sie
  entstanden sind: Wer in mehreren Gemeinden im Team ist, bekommt Badges in
  jeder Gemeinde auch über die stündliche Prüfung, und die Leitung einer
  weiteren Gemeinde sieht dort deren Badges und kann Zertifikate verleihen.
  Bisher prüfte die App nur die Stamm-Gemeinde, und die Leitung der weiteren
  Gemeinde bekam „nicht gefunden".
- Die automatische Löschung nach der Konfirmation lässt ein Konto stehen, das
  noch zu einer weiteren Gemeinde gehört. Bisher sperrte und löschte sie das
  ganze Konto, und die andere Gemeinde verlor die Person mit.
- Die Beschriftungen der Reiter unten sind wieder ganz zu lesen: Bei
  „Challenges" und „Badges" fehlte auf iOS und Android der untere Bogen des g.
- In der Detailansicht einer Konfi stehen ihre offenen Anträge wieder als
  „gemeldet" zwischen den Aktivitäten.
- In der Detailansicht eines Events steht bei den Teamer:innen kein
  Gemeinde-Umschalter mehr — wie in allen anderen Detailansichten.
- Teamer:innen, die den Hinweis auf ihren Rückblick auf der Startseite
  weggeklickt haben, sehen den nächsten Team-Rückblick dort wieder. Wer ihn
  bisher weggeklickt hat, sieht den aktuellen noch einmal.
- Nach dem Zu- oder Absagen einer Einladung in eine weitere Gemeinde
  verschwindet die Mitteilung dazu aus dem Postfach der eingeladenen Person
  und zählt nicht mehr als ungelesen; bei einer abgelaufenen Einladung
  geschieht das in der Nacht danach. Die Nachricht an die einladende Leitung
  bleibt.
- Eine abgelaufene Einladung in eine weitere Gemeinde verhindert keine neue
  mehr: Die Leitung kann dieselbe Person wieder einladen, statt die Meldung
  „steht bereits eine Einladung offen" zu bekommen.
- Werden die Team-Rückblicke eines Jahres im Betrieb gelöscht, verschwindet
  auch ihre Ausgabe aus der Liste der Leitung, und der Rückblick lässt sich
  danach neu erzeugen, statt als „besteht bereits" gesperrt zu bleiben.
- Nach dem Löschen eines Jahrgangs bleiben dessen Events nicht mehr als Events
  der ganzen Gemeinde stehen — auch keine Pflicht-Events ohne Jahrgang, die
  sich danach nicht mehr speichern ließen.
- Das Löschen eines Jahrgangs geschieht ganz oder gar nicht; ein Abbruch
  mittendrin hinterlässt keinen halb gelöschten Jahrgang mehr.
- Der erste Termin einer Serie lässt sich löschen, auch zusammen mit der
  ganzen Serie; vorher brach das mit einem Fehler ab.
- Nach der Beförderung zur Teamer:in geht nicht mehr verloren, bei welchen
  Events jemand als Konfi dabei war.
- Eine Einladung in eine weitere Gemeinde nennt in Mitteilung und E-Mail die
  Rolle mit ihrem Namen statt mit dem technischen Wort „admin".
- Die rote Zahl an einer Challenge verschwindet nach dem Öffnen dauerhaft und
  kommt beim Zurückgehen in die Liste nicht wieder, auch wenn Beiträge dort ein
  Datum in der Zukunft tragen.
- Die Zahl am App-Symbol zählt keine Chat-Nachrichten mit einem Datum in der
  Zukunft mehr mit und stimmt damit wieder mit den Reitern überein.
- Ältere Chat-Nachrichten lassen sich durch Hochscrollen nachladen — bisher
  endete jeder Chat nach den letzten 100 Nachrichten. Oben steht „Anfang des
  Chats", wenn der ganze Verlauf geladen ist.
- Wird eine Chat-Nachricht gelöscht, sehen alle im Raum sofort den Platzhalter
  „Diese Nachricht wurde gelöscht" — bisher stand sie bei den anderen mit
  Inhalt da, bis sie den Chat neu öffneten.
- Bilder, Videos und Dateien aus dem Chat gibt der Server nur noch heraus, wenn
  die Anmeldung im Kopf der Anfrage steht, nicht mehr in der Adresse. Dort
  hätte sie in den Zugriffsprotokollen des Servers gestanden. Die App hat sie
  nie so geschickt; im Chat ändert sich dadurch nichts.
- Wechselt das Handy zwischen WLAN und Mobilfunk, während die App die
  Anmeldung im Hintergrund erneuert, hängt die App nicht mehr minutenlang:
  Nach spätestens 20 Sekunden geht es weiter, und du bleibst angemeldet.
- Scheitert eine Anfrage, steht im Protokoll des Geräts weder der
  Anmeldeschlüssel noch der Inhalt, der gesendet werden sollte.
- Reißt im Funkloch die Verbindung erst beim Senden ab, landen Abmeldungen
  von Events, gemeldete Aktivitäten, Zu- und Absagen im Team, die Wahl der
  Bibelübersetzung und bei der Leitung das Bearbeiten von Badges, Leveln,
  Aktivitäten, Kategorien, Zertifikaten, Jahrgängen und Dashboard-Einstellungen
  unter „Wird gesendet…" statt in einer Fehlermeldung.
- Ein Event, dessen Ende vor dem Beginn liegt, lässt sich nicht mehr
  speichern; das Formular sagt es vor dem Absenden, und die Endzeit lässt sich
  nicht mehr vor den Beginn stellen.
- Eine Serie, deren erstes Event erst am nächsten Tag endet, überträgt die
  Dauer auf jedes Event, statt Events anzulegen, die vor ihrem Beginn enden.
- Eine Abmeldung von einem Event, die ohne Netz abgegeben und doppelt
  gesendet wurde, erscheint nicht mehr als „Nicht gesendet", obwohl sie
  angekommen ist.
- Wer sich nach einer Abmeldung wieder anmeldet oder nach einer Absage wieder
  zusagt, stellt sich auf der Warteliste hinten an, statt die Wartenden zu
  überholen. Liste und Detailansicht zeigen denselben Wartelistenplatz, und
  wartende Teamer:innen zählen beim Platz einer Konfi nicht mehr mit.
- Setzt die Leitung jemanden auf die Warteliste zurück, rückt die nächste
  wartende Person nach, auch wenn die zurückgesetzte Person sich früher
  angemeldet hatte; vorher blieb der Platz in diesem Fall leer.
- Stellt die Leitung die Teilnehmerzahl eines Events auf unbegrenzt, rücken
  alle wartenden Konfis nach und bekommen Bescheid — wie beim Team schon
  bisher.
- Eine Teamer-Aktivität lässt sich nur noch Personen zuordnen, die in der
  eigenen Gemeinde mitarbeiten; über die Schnittstelle ging das bisher auch
  für Teamer:innen fremder Gemeinden.
- Bei einer fehlgeschlagenen Anmeldung landet das eingegebene Passwort nicht
  mehr im Protokoll des Geräts. Ebenso bleiben die Schlüssel der Sitzung
  draußen, wenn das Abmelden, die Anmeldung per Face ID oder Fingerabdruck
  oder das Einrichten der Mitteilungen scheitert.
- Im Dunkelmodus sind die Antworten einer Umfrage im Chat lesbar. Sie standen
  in heller Schrift auf weißer Fläche, in der eigenen Nachricht auch die Frage
  und das Zitat einer beantworteten Nachricht. Jetzt liegen sie auf einer
  dunklen Fläche, vergebene Antworten und Rahmen heben sich ab; im Hellen
  bleibt alles wie zuvor.
- Beim Anlegen eines Konfis versprach der Hinweis, das Passwort lasse sich
  später einsehen. Es wird aber nur einmal angezeigt, danach lässt sich nur
  ein neues erzeugen — das sagt der Hinweis jetzt, damit es vor dem Schließen
  kopiert wird.
- Wer in einer Gemeinde zur Leitung gehört, bekommt dort keine Badges mehr.
  Trug sich eine Leitung, die in einer anderen Gemeinde Konfi ist, bei einem
  Event als anwesend ein, konnte sie Konfi-Badges der eigenen Gemeinde
  erhalten. Badges gibt es nur für Konfis und Teamer:innen, und nur in der
  Gemeinde, in der sie das sind.
- Das Badge „Teamer-Jahr" zählt nur noch die Jahre in der eigenen Gemeinde,
  so wie es die Fortschrittsanzeige schon tat. „Badge neu prüfen" erreicht
  jetzt auch Konfis und Teamer:innen, die in der Gemeinde zusätzlich zu einer
  anderen mitmachen.
- Wer in einer Gemeinde die Leitung stellt und in einer anderen im Team ist,
  sagt dort nur noch für Events der eigenen Jahrgänge zu — wie alle
  Teamer:innen. Bisher galt die Leitungsrolle der Stamm-Gemeinde auch dort,
  und jedes Event ließ sich buchen. Umgekehrt sagt, wer in einer weiteren
  Gemeinde die Leitung stellt, dort für jedes Event zu.
- Teilen sich mehrere ein Gerät, sieht nach einer abgelaufenen Sitzung die
  nächste Person nichts mehr vom gespeicherten Stand der vorigen, und deren
  wartende Nachrichten oder Abmeldungen gehen nicht mehr unter falschem Namen
  raus. Wer sich selbst wieder anmeldet, findet alles wie vorher.
- Im Funkloch oder ohne Empfang merkt die App jetzt, dass sie offline ist:
  Nachrichten, Abmeldungen und gemeldete Aktivitäten warten dann und gehen
  raus, sobald wieder Netz da ist. Bisher galt sie dort als online, schickte
  ins Leere und gab nach drei Versuchen auf. Hat die App das Funkloch noch
  nicht bemerkt oder reißt die Verbindung mitten im Senden ab, wartet nur
  eine Chat-Nachricht; eine Abmeldung, ein Antrag und die übrigen Formulare
  melden dann einen Fehler und müssen später noch einmal abgeschickt werden.
- Einmalpasswörter lassen sich nicht mehr durchprobieren: Nach zehn falschen
  Passwörtern innerhalb einer Stunde nimmt ein Konto keine Anmeldung mehr an,
  auch nicht mit dem richtigen Passwort — bis die Stunde um ist oder das Konto
  ein neues Passwort bekommt.
- Scheitert die Anmeldung, nennt die App den Grund — falsches Passwort,
  deaktivierter Zugang, gesperrte Gemeinde oder zu viele Versuche. Bisher
  stand in jedem dieser Fälle „Keine Verbindung zum Server".
- Eine gesperrte Gemeinde bekommt nichts mehr von allein — keine Erinnerungen
  vor Events, kein „Neues Event!" zum Anmeldestart, keinen Challenge-Start,
  kein „Events warten auf Verbuchung", keine Warnung vor dem Löschen eines
  Jahrgangs, keinen Team-Rückblick am 6. Januar und keine Zahl ans
  App-Symbol. Bisher kamen diese Mitteilungen weiter, obwohl sich dort
  niemand anmelden kann. Wird die Gemeinde wieder freigegeben, kommen
  Anmeldestart und Challenge-Start nach, solange sie noch anstehen.
- Wird ein Konto gelöscht, verschwinden bei der Leitung auch die Mitteilungen
  über diese Person — Registrierung, Abmeldungen samt Grund, Ab- und
  Wieder-Anmeldungen von Pflicht-Events, Beiträge, Zu- und Absagen des Teams.
  Bisher standen sie mit Namen und Grund noch ein Jahr im Postfach. Endet
  eine Mitgliedschaft in einer Gemeinde, gehen die Mitteilungen aus dieser
  Gemeinde mit; Glocke, App-Symbol und Gemeinde-Auswahl zählen sie nicht
  mehr. Ein entzogener Jahrgang lässt die Mitteilungen als Verlauf stehen.
- Ließ sich das Nachweisfoto beim Prüfen eines Antrags nicht laden, stand dort
  für immer „Lade Foto...". Jetzt sagt die App, dass es nicht geladen werden
  konnte, und bietet „Erneut versuchen" an.
- Wer zur Teamer:in befördert wird, verlässt sofort die Event-Chats der
  bisherigen Anmeldungen und — solange ihr der alte Jahrgang nicht zugewiesen
  ist — dessen Chat; in den Team-Chat kommt sie sofort. Bisher bekam sie
  die Nachrichten der ehemaligen Mitkonfis weiter aufs Handy, bis der Chat
  des Jahrgangs zufällig neu abgeglichen wurde, und kam erst nach einigen
  Minuten in den Team-Chat.
- Im Chat wird nach einem Zeilenumbruch der nächste Buchstabe nicht mehr
  von selbst großgeschrieben, sondern nur noch am Anfang und nach einem Punkt,
  Ausrufe- oder Fragezeichen.
- Die anonyme Fehlermessung überträgt Meldungen des Servers nicht mehr im
  Wortlaut, damit keine Namen, Dateinamen oder Namen von Events in die
  Statistik gelangen — bisher kam etwa „… gehört zu keinem Jahrgang dieses
  Events" samt Namen dort an. Im Wortlaut gezählt werden nur noch Meldungen,
  die fest in der App stehen, und einige feste Hinweise zur An- und Abmeldung
  bei Events; sonst steht dort nur, an welcher Stelle und aus welchem Grund
  es klemmte. Dasselbe gilt für die Absturzberichte. Die Datenschutzerklärung
  beschreibt es genauer.
- Hebt der Betrieb von Konfi Quest eine Mitgliedschaft in einer Gemeinde auf,
  gehen auch die Jahrgänge und alle Chat-Plätze dieser Gemeinde mit — wie
  wenn die Gemeindeleitung die Person entfernt. Bisher blieb sie in Gruppen
  und Einzelchats und bekam deren Nachrichten weiter aufs Handy; bei einer
  erneuten Aufnahme galten die alten Jahrgänge sofort wieder.
- Wer einen Chat öffnen darf, ohne darin Mitglied zu sein — etwa die
  Gemeindeleitung in einer Gruppe —, sieht dort jetzt auch Bilder und Dateien. Bisher blieben
  sie leer, obwohl die Nachrichten lesbar waren.
- Startet eine Challenge, bekommen jetzt alle die Mitteilung „Neue Challenge",
  die mitmachen: bei „Nur das Team" das ganze Team, bei „Jahrgang und Team"
  auch Teamer:innen und Leitung der Jahrgänge. Bisher kam sie nur bei den
  Konfis an — eine Challenge nur fürs Team startete ganz ohne Mitteilung.
  Wer die Challenge angelegt hat, bekommt keine.
- Wird ein Event gelöscht statt abgesagt, erfahren es jetzt alle, die dafür
  angemeldet waren oder auf der Warteliste standen — auch Teamer:innen und
  Leitung, genau wie bei einer Absage. Bisher bekamen nur Konfis die Meldung;
  bei einem Event „Nur Team" erfuhr es niemand.
- Die Mitteilung „Neues Event!" bekommen nur noch die Konfis, die das Event
  in ihrer Event-Liste finden — die Konfis der Jahrgänge, für die es gilt, bei
  einem Event ohne Jahrgang alle Konfis der Gemeinde. Bisher ging sie an alle
  Konfis der Gemeinde, auch zu Events anderer Jahrgänge; wer darauf tippte,
  fand nichts.
- Konfis können sich nur noch zu Events anmelden, die in ihrer Event-Liste
  stehen, und nur bei diesen sehen, wer mitkommt. Bisher nahm der Server eine
  Anmeldung auch für ein Event eines anderen Jahrgangs an und zeigte dessen
  Teilnehmende, wenn die App danach fragte.
- Im Chat sagt die App bei einer Datei über 5 MB gleich bei der Auswahl, dass
  sie zu groß ist. Bisher ließ sie Dateien bis 10 MB zu, die dann beim Senden
  ohne verständliche Meldung scheiterten.
- Geladene Bilder und Dateien werden beim Abmelden, beim Wechsel der Gemeinde
  und bei der Anmeldung eines anderen Kontos vom Gerät gelöscht. Bisher blieben
  sie liegen, bis jemand den Medien-Cache von Hand leerte — wer das Gerät danach
  benutzte, fand die Dateien der vorigen Person vor. Nach dem Update lädt die
  App deshalb einmal alles neu, was schon gespeichert war.
- Ein Pflicht-Event lässt sich nicht mehr ohne Jahrgang speichern. Bisher war
  das möglich — und dann wurde niemand automatisch angemeldet, obwohl das
  Event für alle sichtbar war. In einer Gemeinde standen dadurch nur vier von
  zwölf Konfis an den Pflicht-Events. Events ohne Pflicht dürfen weiterhin
  ohne Jahrgang für die ganze Gemeinde gelten.
- Der Punkt an der Postfach-Glocke geht sofort weg, sobald man die letzte
  ungelesene Mitteilung antippt oder alle als gelesen markiert. Bisher blieb
  die Anzeige oft stehen, weil eine ältere Zählung die neue überschrieb.
- Im Handbuch stehen zwischen den Abschnitten wieder Trennlinien statt drei
  Striche im Text (Badges, Challenges, Chat).
- Im Dunkelmodus blieben die Anmeldeseiten hell — Anmeldung, Passwort vergessen,
  neues Passwort und die Registrierung über einen Einladungslink.
- Im Dunkelmodus leuchteten die farbigen Kopfbereiche greller als im hellen
  Modus. Die Bereichsfarben sind jetzt in beiden Modi dieselben.
- Im Dunkelmodus waren die Ränder von Karten und Listen nicht mehr zu erkennen,
  und im Chat blieben die Datumsmarken und die Eingabezeile hell.
- Die Sprechblase an Badges und Stempeln ist jetzt schlicht weiß, Fläche
  und Spitze gleich. Bisher schimmerte durch, was darunter lag, und die Spitze
  hatte einen anderen Ton als die Blase — am Bildschirm kaum zu sehen, auf dem
  Telefon deutlich. Das galt auf allen Seiten, in allen Rollen.
- Auf der Startseite fürs Team waren die Sprechblasen an Badges und
  Urkunden schmaler als anderswo, sodass Texte unnötig umbrachen. Sie sind
  jetzt so breit wie überall sonst.
- Ein laufendes Event steht jetzt schon unter „Verbuchen", nicht erst nach
  seinem Ende. Bisher zeigte der Reiter „Mitmachen" während des Events eine
  rote Zahl, hinter der eine leere Liste wartete — wer mitten im Konfisamstag
  jemanden verbuchen wollte, fand ihn dort nicht.
- Unter „Benachrichtigungen" stand derselbe Hinweis zweimal; jetzt steht er
  einmal, in derselben Form wie die Hinweise überall sonst.
- Im Dunkelmodus verloren Karten, Popover und der Datumswähler ihre Tiefe, weil
  ihre Schatten auf dunklem Grund unsichtbar wurden. Sie sind im Dunkeln jetzt
  kräftiger; im hellen Modus ändert sich nichts.
- Auf Android waren die Knöpfe der Systemleiste unter der App (Zurück, Start,
  Übersicht) unsichtbar, sobald das Telefon im Dunkelmodus lief: Die Symbole
  wurden weiß, die App darunter blieb hell. Die Symbole folgen jetzt dem
  Telefon — dunkel auf der hellen App, hell auf der dunklen — und sind damit in
  beiden Modi lesbar.
- Hat eine Gemeinde noch keine Level, trägt das Symbol im leeren Zustand jetzt
  die Level-Farbe wie der Rest der Seite — nicht mehr das Violett der Konfis.
- Die Sprechblase, die beim Antippen eines Badges, Stempels oder Levels
  aufgeht, passt wieder zu ihrem Inhalt. Auf dem iPhone ragte der weiße
  Inhalt über die Glasblase hinaus, und der Pfeil zeigte neben die Kachel.
- In der Level-Sprechblase bricht die Zeile mit den nötigen Punkten nicht mehr
  mitten im Satz um.
- Die rote Zahl am Symbol eines Chat-Raums oder einer Challenge sitzt höher und
  weiter rechts auf der Symbolecke, in beiden Listen an derselben Stelle, mit
  schmalerem weißen Rand.
- Wer in einer zweiten Gemeinde eine andere Rolle hat, sieht dort jetzt auch
  die Ansicht dieser Rolle. Bisher zeigte die App die Rolle der Stamm-Gemeinde
  — wer in der zweiten Gemeinde Teamer:in ist, bekam die Leitungsansicht mit
  Knöpfen, die der Server dann ablehnte. Die Rechte waren immer richtig, nur
  die Anzeige nicht.
- Im Profil steht jetzt der Name der Gemeinde, in der man gerade arbeitet.
  Bisher stand dort immer die Gemeinde des Kontos.
- Wer in einer Gemeinde Konfi ist und in einer anderen zur Leitung oder zum
  Team gehört, sieht dort jetzt Startseite, Profil und Badges. Bisher blieb
  die Startseite leer und es wurden keine Badges angezeigt.
- Auf der Materialseite des Teams steht der Hinweis „Keine Materialien" jetzt
  auf einer Karte wie überall sonst; bisher stand er ohne Hintergrund da.
- Die Leitung sieht die Jahresrückblicke auch von Personen, die über eine
  zweite Mitgliedschaft in ihrer Gemeinde arbeiten. Bisher blieb die Liste
  dort verschlossen.
- Im Profil stehen nur noch die Jahresrückblicke der Gemeinde, in der man
  gerade ist. Wer in mehreren mitarbeitet, sah bisher alle untereinander.
- Öffnet man ein Event aus dem Postfach, führt der Zurück-Knopf wieder
  dorthin zurück, wo man war. Bisher war er ohne Funktion.
- Wer mehrere Gemeinden betreut, bekommt die Mitteilungen an die Leitung jetzt
  aus allen — neue Anträge, Ab- und Anmeldungen, Challenge-Beiträge, Buchungen
  des Teams, Registrierungen, Lösch-Warnungen für Jahrgänge. Bisher kamen sie
  nur aus der Stamm-Gemeinde, obwohl die App die anderen längst anzeigte. Die
  Rolle zählt dabei je Gemeinde: Wer in der zweiten nur Teamer:in ist, bekommt
  dort keine Leitungs-Meldungen. Dasselbe gilt für die Mitteilungen in der App
  und die Warn-Mail vor dem Löschen eines Jahrgangs.
- Wer mehrere Gemeinden betreut, steht jetzt auch in der Team-Kontaktliste des
  Chats seiner zweiten Gemeinde — mit der Rolle, die er dort hat. Bisher fehlte
  er dort, und umgekehrt zeigte ihm die Liste nach dem Wechsel das Team der
  Stamm-Gemeinde statt der gewählten.
- Beim Eintragen von Hand bietet die Auswahl nur noch Personen an, die zu
  einem Jahrgang des Events gehören — bei Konfis wie beim Team und der
  Leitung. Ein Hinweis nennt die Jahrgänge des Events, damit klar ist, warum
  jemand fehlt. Der Server weist andere Einträge ab und sagt, um wen es geht.
  Bisher stand das Team ungefiltert in der Liste, und ein Konfi aus einem
  fremden Jahrgang ließ sich über die Schnittstelle trotzdem eintragen. Events
  ohne Jahrgang und „Nur Team"-Events bleiben für alle offen; die
  Gemeindeleitung ist ausgenommen.
- Auch Teamer:innen kommen aus einer Event-Mitteilung direkt zum Event
  statt nur zur Event-Liste. Bisher landeten sie auf der Liste; ein Link auf
  ein einzelnes Event führte sogar zur Startseite.
- Ein zweiter Link auf ein anderes Event öffnet bei Teamer:innen jetzt
  auch das zweite Event. Bisher wirkte nur der erste Link nach dem Start.
- Ein Event aus einem fremden Jahrgang lässt sich von Teamer:innen und
  Leitung nicht mehr über seine Kennung abrufen — samt Teilnehmerliste und
  Abmeldegründen. Sichtbar ist nur, was auch in der eigenen Event-Liste steht.
- Wer aus einer Event-Mitteilung auf ein Event kommt, dessen Jahrgang
  ihm nicht zugewiesen ist, liest jetzt den Grund und den Weg hinaus („Nicht
  deinem Jahrgang zugeordnet") — statt einer allgemeinen Fehlermeldung über
  einer leeren Seite oder einer stummen Event-Liste.
- Auswahllisten öffnen sich ohne den kleinen Zipfel am Rand.
- Die Hinweise im Profil („Was ist neu", „Events und Aktivitäten") zeigen
  rechts keinen Pfeil mehr.
- Der Umschalter zwischen Konfis und Team hat auf iPhones die milchige
  Glasfläche, die auch die Navigationsleiste unten verwendet.
- Eine Mitteilung zu einem Event führt beim Antippen zum Event selbst statt
  nur zur Event-Liste. Das gilt für Anmeldung, Abmeldung, Nachrücken von der
  Warteliste, bestätigte Teilnahme und Erinnerungen — und für die Meldungen an
  die Leitung, wenn sich jemand an- oder abmeldet.
- Steht die App-Sperre auf „Sofort", sperrt die App jetzt auch, wenn man sie
  aus der App-Übersicht zurückholt. Bisher fragte sie nur beim ersten Öffnen
  nach Face ID oder Fingerabdruck.
- Die Leiste oben rechts zeigt ihre Symbole wieder als zusammenhängende Fläche
  statt als einzelne Punkte, und der milchige Glaseffekt ist in der
  Navigationsleiste und auf den Knöpfen wieder da.
- Mitteilungen an eine ganze Gemeinde oder einen ganzen Jahrgang kommen
  zuverlässig an. Bisher konnte bei vielen Empfängerinnen und Empfängern
  gleichzeitig die Zahl am App-Symbol fehlen, und bei einzelnen kam die
  Mitteilung gar nicht — je größer die Gruppe, desto häufiger.
- Klemmt der Mitteilungsdienst kurz, wird die Nachricht erneut zugestellt
  statt verworfen.
- Das Antippen einer Mitteilung stürzte die App auf Android ab: Sie öffnete
  sich kurz und war wieder weg, auch aus dem Hintergrund heraus — erst nach
  vollständigem Schließen ließ sie sich wieder starten. Zwei Ursachen steckten
  dahinter, beide behoben. Der Tipp führt jetzt direkt zum gemeinten Event,
  Chat oder Badge.
- Die App-Sperre fragte beim Öffnen zweimal gleichzeitig nach dem
  Fingerabdruck. Auf Android brach die erste Abfrage dadurch ab und meldete
  „Nicht erkannt", obwohl niemand abgebrochen hatte — erst der zweite Versuch
  von Hand ging durch. Jetzt wird genau einmal gefragt, und das Entsperren
  klappt beim ersten Mal.
- Android-Geräte bekamen keine Mitteilungen mehr, sobald die App einmal
  aktualisiert oder neu angemeldet wurde — dauerhaft und ohne Hinweis. Die App
  konnte sich beim Mitteilungsdienst nicht erneut eintragen, weil das System
  die dafür nötige Kennung nur einmal je Installation herausgibt. Sie fragt
  sie jetzt aktiv ab, bei jeder Anmeldung und bei jedem Öffnen. Wer betroffen
  war, bekommt Mitteilungen wieder, sobald die App einmal geöffnet wird.
- Wer sich abgemeldet und wieder angemeldet hat, bekam ebenfalls keine
  Mitteilungen mehr. Beim Abmelden wird das Gerät abgemeldet, die App hielt
  sich aber weiter für eingetragen.
- Ein kurzer Aussetzer beim Eintragen für Mitteilungen ließ das Gerät bis zur
  nächsten Anmeldung ohne Mitteilungen — etwa bei wackligem Netz oder direkt
  nach dem Flugmodus. Die App versucht es jetzt mehrmals mit wachsendem
  Abstand, im Hintergrund, ohne die Anmeldung aufzuhalten.
- Mehrtägige Events zeigen in den Details jetzt beide Tage. Eine Freizeit von
  Freitagabend bis Sonntagmittag stand vorher als „Freitag · 16:30 – 12:30" da,
  als ob sie am selben Tag endete.
- Die Auslastungsanzeige misst jetzt die Zeit, die der Server wirklich
  braucht. Vorher zählte sie das Warten auf langsame Mobilfunkverbindungen
  mit — ein einzelner Foto-Upload ließ die Anzeige tagelang bei 56 Sekunden
  stehen, obwohl dieselbe Seite in Millisekunden antwortete. Was auf der
  Leitung lag, steht jetzt getrennt daneben.
- Laufen mehrere Server-Instanzen, wurden Seiten, die gleichzeitig zu den
  langsamsten und zu den häufigsten zählten, doppelt gezählt. Die
  Aufrufzahlen im Betriebs-Überblick waren dadurch zu hoch.
- Die Liste der langsamsten Seiten geht jetzt nach der Zeit, die der Server
  wirklich braucht. Vorher entschied die Verbindung des Geräts mit, welche
  Seiten überhaupt in der Liste auftauchten — eine Seite mit viel Inhalt
  stand dort oben, obwohl der Server sie in Millisekunden beantwortet.
- Beruht der langsame Rand einer Seite auf zu wenigen Aufrufen, steht das
  jetzt dabei. Bisher las sich ein einzelner Ausreißer wie eine dauerhafte
  Eigenschaft der Seite.
- Der Check-in-Code weiterer Events einer Reihe war in den Event-Details
  enthalten. Damit ließ sich die Anwesenheit für die ganze Reihe eintragen,
  ohne vor Ort zu sein.
- Android: Die Reiterleiste unten ist wieder deckend und so hoch wie
  vorgesehen. Bisher war sie durchsichtig und doppelt so hoch — die Liste
  schien hinter den Beschriftungen durch, und die Zähler an den Reitern
  schwebten weit über ihren Symbolen.
- iOS: Die Zähler an den Reitern sitzen wieder oben rechts am Symbol. Bisher
  hingen sie zu tief und lagen fast mittig auf dem Symbol.
- Beim Wechsel in eine andere Gemeinde nahmen die Zähler an den Reitern die
  Zahlen der vorigen Gemeinde mit — an Challenges stand eine Neun, obwohl es
  in der neuen Gemeinde gar keine Challenges gibt. Das galt auch für Chat,
  Anträge, Events, Freigaben und Badges. Die Zähler fallen jetzt beim
  Wechsel sofort auf null und werden für die neue Gemeinde frisch geladen.
  Die Zahl an der Glocke bleibt stehen: Das Postfach gehört zum Konto und
  umfasst alle Gemeinden.
- Beim Abmelden blieb die Zahl an der Glocke des vorigen Kontos stehen.
- Verliert jemand den Zugang zu einer zweiten Gemeinde, fällt die App auf die
  eigene Gemeinde zurück — dabei blieben bis zuletzt Zähler und bereits
  geöffnete Listen der verlorenen Gemeinde stehen. Jetzt laden auch in diesem
  Fall alle Ansichten frisch.
- Wer in zwei Gemeinden mitarbeitet, kam aus der zweiten nicht mehr in die
  eigene zurück: Der Wechsel dorthin scheiterte mit „Organisation konnte nicht
  gewechselt werden", auch nach Neustart der App; erst Abmelden und Anmelden
  führte zurück. Betroffen waren Konten, die nach einer bestimmten Umstellung
  angelegt wurden — ältere Konten konnten wechseln, darum fiel es je nach
  Person auf oder nicht. Jetzt gilt die eigene Gemeinde beim Wechsel genauso
  als Mitgliedschaft wie jede weitere.
- Konten mit Super-Admin-Rechten kann nur noch ein Super-Admin bearbeiten.
  Bisher konnte die Leitung einer Gemeinde, in der ein solches Konto zuhause
  ist, dessen Passwort setzen, es sperren oder löschen — und damit Zugriff auf
  alle Gemeinden erlangen.
- Eine Gemeinde-Einladung an einen Konfi läuft ins Leere: Konfis anderer
  Gemeinden ließen sich als Teamer:in einladen, und die Abfrage verriet zu
  jeder E-Mail-Adresse, ob ein Konto dazu existiert — auch bei Kindern
  fremder Gemeinden. Jetzt antwortet die App bei Konfis genauso wie bei einer
  unbekannten Kennung.
- Ein Direktchat besteht aus genau zwei Personen. Bisher ließ sich über die
  Schnittstelle ein „Direktchat" mit mehreren Konfis anlegen, den die Leitung
  nicht einsehen konnte — obwohl Konfis einander nur in Räumen schreiben
  sollen, die die Leitung mitliest. Solche Räume werden beim Update zu Gruppen
  und damit für die Leitung sichtbar; echte Zweiergespräche bleiben privat.
- Nach der Registrierung endete die Sitzung neuer Konfis nach einer
  Viertelstunde mit „Deine Sitzung ist abgelaufen", und sie mussten sich mit
  dem gerade gewählten Passwort neu anmelden. Die Registrierung meldet jetzt
  dauerhaft an, genau wie der Login.
- Wer über eine Gemeinde-Einladung dazukam, fehlte danach unter „Mehr ›
  Benutzer:innen" und bekam weder Rolle noch Jahrgänge. Jetzt steht die Person
  dort mit dem Vermerk „zuhause in einer anderen Gemeinde"; die Leitung vergibt
  Rolle und Jahrgänge, während Name, E-Mail, Passwort und Sperre bei der
  Stamm-Gemeinde bleiben. Wegwischen beendet nur die Mitgliedschaft in dieser
  Gemeinde, das Konto bleibt. Aus allen Chats dieser Gemeinde ist die Person
  danach heraus, auch aus Gruppen und Einzelchats, und bekommt von dort keine
  Mitteilungen mehr.
- Die Erinnerung „Morgen: …" zu einem Event kam kurz nach Mitternacht aufs
  Handy — für ein Event um 18:00 Uhr also 34 Stunden vorher. Sie kommt jetzt
  genau 24 Stunden vor Beginn, so wie die Erinnerung „Gleich: …" eine Stunde
  vorher. Außerdem kann ein langer Erinnerungslauf nicht mehr vom nächsten
  überholt werden — dieselbe Erinnerung ging sonst zweimal hinaus.
- Hat die Leitung eine Konfi von einem Event abgemeldet, sah die Konfi ein
  offenes Event mit grauem Knopf „Nicht verfügbar" — und kam nicht zurück.
  Jetzt steht dort „Von der Leitung abgemeldet" und ein Knopf „Wieder
  anmelden"; Anmeldeschluss und Plätze gelten dabei wie für alle.
- Wer auf der Warteliste stand, konnte nicht herunter: Statt eines
  Abmelden-Knopfs gab es „Warteliste offen", und der endete in einer
  Fehlermeldung. Jetzt zeigt das Event den Wartelistenplatz und den Knopf
  „Von der Warteliste abmelden" — auch in den letzten zwei Tagen, denn wer
  wartet, belegt keinen Platz.
- Die Regel für Pflicht-Events, die Abmeldefrist und die eingetragene
  Anwesenheit gelten jetzt auf jedem Abmeldeweg. Über einen älteren Nebenweg
  konnte eine Konfi bislang ein von der Leitung eingetragenes „Gefehlt" selbst
  löschen oder sich am Vortag ohne Spur abmelden; die Anwesenheitsliste war so
  nicht verlässlich.
- Löschte die Leitung einen alten Jahrgang, verschwand damit der
  Konfi-Rückblick aller inzwischen beförderten Teamer:innen — obwohl ihre
  Punkte, Level und Badges bewusst erhalten bleiben. Der Rückblick bleibt
  jetzt ebenfalls und steht weiter im Profil.
- Bei schlechter Verbindung schickte die App eine hängende Anfrage bis zu
  dreimal erneut — auch beim Speichern. So konnten Bonuspunkte mehrfach
  vergeben, ein Event mehrfach angelegt oder eine Anmeldung als „bereits
  angemeldet" abgewiesen werden, obwohl sie längst stand. Wiederholt wird
  jetzt nur noch, was folgenlos wiederholbar ist: Laden, Löschen und die
  meisten Änderungen an bestehenden Einträgen. Anlegen, Anmelden, Einreichen
  und Vergeben gehen genau einmal hinaus, ebenso einzelne Änderungen wie die
  Wahl des Konfispruchs.
- Ein kurzer Aussetzer der Datenbank (etwa ein Neustart) legte bisher den
  gesamten Dienst lahm: Alle Server beendeten sich im selben Moment, die App
  zeigte für einige Zeit Verbindungsfehler, offene Chats verloren die
  Live-Verbindung. Jetzt bleiben die Server erreichbar, verbinden sich von
  selbst wieder mit der Datenbank, und Chat-Nachrichten und
  Live-Aktualisierungen kommen danach wieder auf allen Geräten an.
- Im Dunkelmodus waren auf den Anmeldeseiten die Überschrift und die Links
  („Passwort vergessen?", „Noch keinen Account?", „Zurück zum Login") kaum zu
  erkennen — dunkles Lila auf dunkler Karte. Sie sind jetzt aufgehellt und
  lesbar; im Hellen bleibt alles wie zuvor.
- Auf dem Dashboard von Konfis und Team liefen die Karten „Ranking" und
  „Events" im Dunkelmodus unten in Mint beziehungsweise Rosa aus, und die
  weiße Schrift darauf war kaum zu lesen. Die Verläufe enden jetzt auch im
  Dunkeln auf einem dunklen Ton; im Hellen sehen sie aus wie bisher.
- Auf dem iPhone bekamen die Karten im Dunkelmodus nicht den vorgesehenen
  helleren Grauton, sondern blieben fast schwarz und hoben sich kaum vom
  Hintergrund ab — Android zeigte ihn längst. Jetzt sind Karten auf beiden
  Plattformen gleich abgesetzt, auch im Postfach.
- Im Chat war im Dunkelmodus an fremden Nachrichten nicht zu erkennen, wie
  viele reagiert haben: Die Zahl am Reaktions-Chip stand schwarz auf dunkel.
  Sie folgt jetzt der Textfarbe der Nachricht.
- Der Knopf „Zur Teamer:in befördern" in der Konfi-Verwaltung zeigte im
  Dunkelmodus schwarze Schrift auf Lila; sie ist jetzt weiß wie im Hellen.
- Im Dunkelmodus sind die kleinen farbigen Marken an Listeneinträgen —
  Punkte („+2P"), Level („20P"), Status — jetzt lesbar: Sie werden eine Stufe
  tiefer, damit die weiße Schrift darauf genug Kontrast hat. Auch die
  Prozentzahl im Fortschrittsring der Badges nimmt im Dunkeln eine hellere
  Stufe ihrer Farbe. Im Hellen ändert sich nichts.
- Die Anmeldeseiten — Anmelden, Passwort vergessen, neues Passwort setzen,
  Registrieren mit Einladungscode — lassen sich mit Tastatur und
  Vorlesefunktion bedienen: Jedes Feld hat einen Namen, der Augen-Knopf am
  Passwortfeld sowie „Passwort vergessen?", „Zurück" und „Registrieren" sind
  per Tab erreichbar, Enter schickt das Formular ab, der Fokus ist sichtbar,
  und Fehlermeldungen werden vorgelesen. Bisher kam man am Rechner nur bis zum
  Anmelde-Knopf und musste nach dem Passwort zur Maus greifen.
- „Passwort vergessen" konnte alle Anfragen der gesamten Plattform
  zusammenzählen: Nach fünf Anfragen in einer Viertelstunde — egal von wem —
  bekam jede:r „Zu viele Passwort-Reset-Anfragen", auch beim ersten eigenen
  Versuch. Die Grenze gilt jetzt je Gerät oder Netz; zusätzlich sind für
  dieselbe E-Mail-Adresse höchstens drei Anfragen pro Stunde möglich, damit
  niemand ein fremdes Postfach mit Reset-Mails flutet.
- Eine alte Spalte, in der frühere Versionen die Einmalpasswörter von Konfis
  im Klartext ablegten, wird beim Update geleert. Gelesen hat sie schon lange
  nichts mehr; geleert wurde sie bisher nur, wenn die Leitung ein neues
  Einmalpasswort erzeugte — alle anderen Einträge blieben stehen und wanderten
  mit jeder Sicherung mit.
- Ehemalige Konfis, die 60 Tage nach der Konfirmation automatisch aus den
  Listen der Leitung genommen wurden, konnten sich bis zur endgültigen Löschung
  weiter anmelden, im Jahrgangs-Chat schreiben und Events buchen — für die
  Leitung unsichtbar. Jetzt ist die Anmeldung ab diesem Zeitpunkt gesperrt wie
  bei einem deaktivierten Konto, und laufende Sitzungen enden.
- Der Schlüssel, mit dem ein Gerät seine Anmeldung im Hintergrund verlängert,
  ließ sich nach dem Tausch fünf Minuten lang beliebig oft erneut einlösen —
  wer ihn abgriff, blieb monatelang unbemerkt angemeldet. Jetzt geht das genau
  einmal (für den Fall, dass die App den neuen Schlüssel nicht mehr speichern
  konnte). Ein weiterer Versuch beendet alle Anmeldungen des Kontos, weil dann
  jemand anderes den Schlüssel haben könnte.
- „Zugang deaktivieren" und das Löschen eines Kontos wirken jetzt sofort.
  Bisher konnte die betroffene Person mit ihrer laufenden Sitzung noch bis zu
  einer halben Minute weiterarbeiten.
- Änderte die Leitung den Punktwert einer Aktivität, wirkte das rückwirkend
  auf alle, die sie schon bekommen hatten: Die Punktegeschichte zeigte den
  neuen Wert, und beim Zurücknehmen wurde der neue Wert abgezogen statt des
  gutgeschriebenen. Jede Vergabe merkt sich jetzt ihren Wert; ein geänderter
  Punktwert gilt nur für künftige Vergaben.
- Wer über eine Einladung in einer weiteren Gemeinde mitarbeitet, ließ sich
  dort nicht in Gruppenchats eintragen: Beim Anlegen einer Gruppe fehlte die
  Person danach ohne Hinweis, beim nachträglichen Hinzufügen kam „nicht in
  deiner Organisation" — obwohl sie in der Team-Kontaktliste stand. Jetzt
  kommt sie hinein, mit der Rolle, die sie in dieser Gemeinde hat.
- Der automatische Team-Rückblick am 6. Januar übersah, wer über eine
  Einladung in einer weiteren Gemeinde im Team ist — dort entstand kein
  Rückblick, und nachholen ließ er sich nicht, weil das Jahr als erledigt
  galt. Jetzt bekommt jede Teamer:in in jeder ihrer Gemeinden ihren eigenen
  Rückblick, auch beim automatischen Lauf; gesperrte Konten bleiben außen vor.
- Wer in zwei Gemeinden im Team ist, bekam auf der Startseite der zweiten
  Gemeinde „Dein Team-Jahr ist da" angezeigt und sah beim Antippen die Zahlen
  der anderen Gemeinde. Rückblick, Liste der eigenen Rückblicke und der
  Hinweis auf der Startseite gehören jetzt zur Gemeinde, in der man gerade
  arbeitet; gibt es dort keinen, gibt es auch keinen Hinweis.
- Wurde jemandem die Mitgliedschaft in einer weiteren Gemeinde entzogen,
  während er gerade dort arbeitete, zeigte die App bis zu einer Viertelstunde
  lang in jeder Gemeinde nur leere Listen und Fehlermeldungen; erst Abmelden
  und Neuanmelden half. Jetzt wechselt sie sofort sauber in die
  Stamm-Gemeinde, und auch Chat und Live-Aktualisierungen laufen dort weiter.
- Eine neue Chat-Nachricht kam bei allen, die den Chat gerade offen hatten,
  doppelt an — unsichtbar, aber jedes Mal wurden die Zähler zweimal neu
  geladen. Sie kommt jetzt genau einmal.
- Chat-Nachrichten, Räume und Konten lassen sich auch bei sehr vielen
  gespeicherten Nachrichten zügig löschen. Bisher konnte „Team-Chat leeren",
  das Löschen eines Events mit Event-Chat oder eines Kontos bei großen
  Nachrichtenmengen in einen Zeitüberschreitungsfehler laufen.
- Nach jedem Neustart des Servers wurde die Zahl am App-Symbol auf allen
  Geräten auf einmal nachgeführt — bei vielen Gemeinden war die App danach
  bis zu einer Stunde träge, und mehrere solcher Läufe konnten sich
  überlappen. Der erste Lauf merkt sich jetzt nur die Stände; nachgeführt
  wird weiterhin alle fünf Minuten, sobald sich bei jemandem etwas ändert,
  und nie zwei Läufe gleichzeitig.
- Werden nach einer Pause des Servers auf einmal sehr viele Events
  anmeldbar, kamen alle „Anmeldung möglich"-Mitteilungen in einem Schwall.
  Sie gehen jetzt nach und nach hinaus, die am längsten offenen zuerst; im
  Alltag ändert sich nichts.
- Ein Server-Neustart (etwa bei einer Auslieferung) dauert nicht mehr länger
  als nötig und wird nicht mehr als Absturz gezählt. Solange ein Server
  herunterfährt, nimmt er sich selbst aus der Verteilung, statt Anfragen ins
  Leere laufen zu lassen.
- Die Grenzen für Anmeldeversuche, Registrierungen, Chat-Nachrichten,
  Buchungen und Uploads gelten jetzt für alle Server gemeinsam statt je
  Server einzeln — sie waren dadurch doppelt so weit wie gedacht, und die
  Meldung „Zu viele Anfragen" kam scheinbar zufällig.
- Bei einer Auslieferung werden die beiden Server nacheinander getauscht,
  der zweite erst, wenn der erste wieder antwortet — statt beide zugleich,
  was die App für einige Sekunden „Verbindung fehlgeschlagen" melden ließ.
- Das Erstellen des Jahresrückblicks für einen ganzen Jahrgang belegt nicht
  mehr alle Datenbankverbindungen auf einmal; die App bleibt währenddessen
  für alle anderen flüssig.
- Jedes Eingabefeld der App nennt der Vorlesefunktion seinen Namen — „Name",
  „Pflicht-Event", „Max. Teilnehmer:innen" statt nur „Textfeld" oder
  „Schalter". Bisher galt das nur auf den Anmeldeseiten; jetzt lassen sich
  auch Event-, Konfi-, Benutzer- und Umfrage-Formulare mit VoiceOver und
  TalkBack ausfüllen. Sichtbar ändert sich nichts.
- Alles, was sich antippen lässt, lässt sich auch mit der Tastatur bedienen
  und heißt für die Vorlesefunktion „Schaltfläche": die Einträge unter
  „Mehr" und im Profil, die Auswahlzeilen in den Formularen der Leitung,
  Badge- und Stempel-Kacheln, Event-Karten auf der Startseite, die
  Aktionen und Reaktionen im Chat. Tab erreicht sie, Enter oder Leertaste
  löst sie aus, ein Ring zeigt, wo man ist. Vorher waren sie am Rechner
  unerreichbar und wurden nur als Text vorgelesen.
- Jedes Fenster, das sich über eine Seite legt, meldet sich der
  Vorlesefunktion mit seinem Titel statt nur als „Dialog": die Formulare
  (etwa „Passwort ändern"), die Punkte-Übersicht, das Postfach,
  die Datumswähler („Datum wählen"), die Ansicht einer Datei mit ihrem
  Dateinamen und der Rückblick. Ändert sich der Titel, während das Fenster
  offen ist, zieht der Name mit.
- Auf den Hinweiskarten der Startseite — „Was ist neu", „Events und
  Aktivitäten", „Version … ist da" — sind Karte und Kreuz für Tastatur und
  Vorlesefunktion zwei getrennte Schaltflächen. Bisher steckte das Kreuz in
  der Karte, und wer es per Tastatur auslöste, öffnete die Karte gleich mit.
- Die Beschriftungen der Reiter unten sind größer und besser lesbar, auf
  Android wie auf dem iPhone. Auf schmalen Android-Handys stehen
  „Challenges" und „Mitmachen" jetzt vollständig da, statt mit „…" gekürzt
  zu werden.
- Im Browser lässt sich Konfi Quest mit zwei Fingern vergrößern, auch auf
  Android. Bisher war das gesperrt.
- Kleine Knöpfe — das Auge am Passwortfeld, das X an Hinweisen und
  Fehlermeldungen, Anhängen und Senden im Chat — lassen sich leichter
  treffen: Die Fläche, die auf den Finger reagiert, ist jetzt mindestens
  44 Punkte groß, die Knöpfe sehen aber aus wie zuvor.
- Am Rechner und mit der Tastatur lassen sich die Aktionen zu einer
  Chat-Nachricht öffnen — Reagieren, Antworten, Teilen, Löschen: über einen
  Knopf neben der Nachricht, der beim Überfahren mit der Maus erscheint und per
  Tab erreichbar ist; Escape schließt die Auswahl wieder. Bisher ging das nur
  mit langem Druck auf dem Handy oder einem Rechtsklick, den niemand kannte.
  Auf dem Handy bleibt alles wie gewohnt.
- Wer in mehreren Gemeinden mitarbeitet, sah am Gemeinde-Umschalter jede
  ungelesene Mitteilung mehrfach gezählt — so oft, wie er in Gemeinden dieselbe
  Rolle hat. Ein neuer Challenge-Beitrag ergab dort 3 statt 2: die Freigabe und
  die Mitteilung dazu, die Mitteilung aber doppelt. Jetzt zählt jede Mitteilung
  einmal, bei der Gemeinde, aus der sie stammt.
- Wer mehreren Gemeinden angehört, sieht am App-Symbol jetzt immer dieselbe
  Zahl: die Summe aller Gemeinden, jede mit der Rolle, die man dort hat — also
  die Zahlen im Gemeinde-Umschalter zusammen. Bisher setzte ein Push eine
  andere Zahl als die geöffnete App, etwa 5 und 2: Der Push zählte in jeder
  Gemeinde mit der Rolle der Stamm-Gemeinde, auch Anträge, die man dort gar
  nicht sieht, und jede ungelesene Mitteilung je Gemeinde erneut; die geöffnete
  App zählte nur die Gemeinde, in der man gerade arbeitet. Für alle, die einer
  Gemeinde angehören, bleibt die Zahl, wie sie war.
- Wer in der eigenen Gemeinde zuhause ist und zugleich in einer anderen
  mitarbeitet, lässt sich aus der eigenen Gemeinde entfernen, ohne dass sein
  Konto verschwindet: Es bleibt in der anderen Gemeinde bestehen, mit der Rolle
  von dort. Bisher löschte das Wegwischen das ganze Konto, samt der
  Mitgliedschaft in der anderen Gemeinde; die Sicherheitsabfrage sagt jetzt
  vorher, was passiert.
- Umlaute stehen jetzt überall richtig: in den Beschreibungen der
  Mitteilungsgruppen in den Android-Einstellungen („Änderungen", „Rückblick"),
  in den Namen der Symbole zur Auswahl („Glühbirne", „Kopfhörer"), bei der
  Reaktion „Gefällt mir" und in einigen Fehlermeldungen. Vorlesehilfen sprechen
  „Änderungen speichern" jetzt richtig aus. Auch die Hinweise bei zu vielen
  Anfragen („Bitte versuche es später erneut") und die Prüfmeldungen beim
  Anlegen von Events und Rückblicken („größer", „höchstens", „enthält")
  schreiben Umlaute.
- „Passwort vergessen" erreicht jedes Konto mit der eingegebenen Adresse: Wer
  in mehreren Gemeinden ein Konto mit derselben Adresse hat, bekommt für jedes
  eine eigene Mail mit eigenem Link, darin Gemeinde und Benutzername. Bisher
  bekam nur eines den Link — und auch gesperrte oder gelöschte Konten, mit
  denen man sich gar nicht anmelden kann.
- Die Mail „Passwort zurücksetzen" nennt die richtige Gültigkeit des Links:
  24 Stunden statt einer Stunde.
- Android: Das App-Symbol wird nicht mehr beschnitten — die Blüte steht bei
  jeder Symbolform (Kreis, Squircle, Tropfen) vollständig auf dunklem Grund,
  auch als einfarbiges Themen-Symbol.
- Android: Startbildschirme, die eine Zahl am App-Symbol von der App annehmen,
  bekommen sie jetzt gemeldet; wo das nicht geht, etwa auf Pixel-Geräten,
  zeigt das Symbol einen Punkt, solange eine Mitteilung in der Leiste liegt.
- Beim Öffnen der App bleiben die Mitteilungen der Leitung in der Leiste
  liegen, auf iPhone und Android, bis sie angetippt oder weggewischt werden;
  auf Android verschwinden dadurch auch Punkt oder Zahl am App-Symbol nicht
  mehr jedes Mal.
- Ein schneller zweiter Tipp auf „Anmelden" bei einem Event schickt keine
  zweite Anmeldung mehr und zeigt nicht mehr „Du bist bereits für dieses Event
  angemeldet", obwohl alles geklappt hat; der Knopf ist gesperrt, bis die
  Anmeldung durch ist.
- Geht das Handy beim Scannen des QR-Codes zum Einchecken offline, meldet die
  App „Du bist offline" statt „QR-Code konnte nicht verarbeitet werden".
- Die Badges-Seite der Konfis zeigt die Badges auch dann, wenn die Punkte des
  Profils gerade nicht geladen werden konnten, statt „Keine Badges gefunden".
- Auf Geräten, auf denen die App schon lange installiert ist, bleiben nach dem
  Abmelden keine alten Anmeldedaten mit Name und E-Mail-Adresse mehr im
  Speicher der App zurück; die App räumt sie beim nächsten Start weg.
- Wird ein Konto deaktiviert, eine Gemeinde gesperrt oder läuft ihre Testphase
  ab, während jemand angemeldet ist, nennt die Anmeldeseite gleich diesen
  Grund statt „Deine Sitzung ist abgelaufen" — bisher erfuhr man ihn erst nach
  dem nächsten Anmeldeversuch.
- Wer unter Badges oder Aktivitäten zwischen Konfis und Teamer:innen
  umschaltet, sieht bis zum Laden der neuen Liste nicht mehr die alte unter
  dem neuen Reiter — und wenn die neue nicht geladen werden kann, auch danach
  nicht. Beim Suchen im Material bleibt die bisherige Liste bis zum Ergebnis
  stehen, nach einem Fehlschlag aber nicht.
- Eine Rückblick-Ausgabe eines Jahrgangs löschen darf nur, wer im Jahrgang
  auch bearbeiten darf — wie beim Anlegen. Eine Zuweisung nur zum Ansehen
  reichte bisher zum Löschen.
- Nach einer eigenen Nachricht steht an diesem Chat keine Eins mehr, auch
  nicht kurz beim Öffnen der Chat-Übersicht; auch die Markierung „Neu" beim
  Öffnen eines Chats zählt eigene Nachrichten nicht mehr mit.
- Bei einer Challenge, die nur einen Beitrag je Person annimmt, entstehen aus
  zwei gleichzeitig abgeschickten Beiträgen (etwa nach einem doppelten Tipp
  oder einer Wiederholung nach Netzabbruch) nicht mehr zwei.
- In der Jahrgangsliste der Leitung steht als Punkteziel dieselbe Zahl, mit
  der auch das Dashboard der Konfis rechnet; ein Ziel von 0 nimmt der Server
  nicht mehr an, wie schon der Regler in der App.
- Beim Anlegen einer Konfi entsteht das Konto nur zusammen mit ihren
  Pflicht-Events: Klappt die Einschreibung nicht, meldet die App einen Fehler,
  statt eine Konfi ohne Pflicht-Events anzulegen.
- Eine Chat-Gruppe, in der jemand ausgewählt ist, der nicht zur Gemeinde
  gehört, entsteht nicht mehr stillschweigend ohne diese Person; die App
  meldet stattdessen, dass die Auswahl nicht stimmt.
- Die Mails zum Ablauf der Lizenz und zur Löschung eines Jahrgangs zeigen
  Namen mit Sonderzeichen wie „&" oder „<" so an, wie sie eingegeben wurden,
  statt sie als Formatierung zu lesen.
- Wird ein Konto gelöscht — von der Leitung, von der Person selbst oder nach
  der Konfirmation von allein —, geht wirklich alles mit, was zu ihr gehört:
  auch ihre Zweiergespräche samt der Bilder und Dateien darin und alles aus
  weiteren Gemeinden. Löscht die Leitung eine Teamer:in, rückt auf ihre
  Plätze bei Events jetzt die Warteliste nach.
- Wer in einer weiteren Gemeinde mitarbeitet und dort einen Antrag gestellt
  hat, kann sein Konto wieder selbst löschen; bisher brach das mit einem
  Fehler ab.

### Sonstiges
- Die Datenbank hat keine Spalte für Klartext-Passwörter von Konfis mehr. Sie
  stammte aus der Anfangszeit der App und war seit Ende September leer.
- Das Startprotokoll des Servers meldet die Hintergrund-Jobs nicht mehr pauschal
  als gestartet: Es steht dort „Deaktiviert" oder „Leader-Wahl", je nachdem,
  ob der Server sie übernehmen darf.
- Die Datenschutzerklärung beschreibt die Reichweitenmessung genauer:
  Sitzungen werden innerhalb eines Kalendermonats zusammengefasst, und der
  ungefähre Standort umfasst Land, Region und Stadt.
- Die Bausteine der App für Oberfläche, Gerätefunktionen und die Anmeldung per
  Gesicht oder Fingerabdruck sind auf dem aktuellen Stand der Hersteller.
- Das Mitglieder-Fenster im Chat lädt die Personenlisten zum Hinzufügen nur
  noch für die Leitung; bei Konfis lief dabei bisher jedes Mal eine
  abgelehnte Anfrage ins Leere.
- Mehr Tests prüfen das Verhalten der App statt ihres Quelltexts.
- Sicherheitsupdate für die Echtzeitverbindung von Chat und Live-Aktualisierung:
  Eine fehlerhafte Anfrage kann den Server nicht mehr ausbremsen.
- Server, Web-Version und alle automatischen Prüfungen laufen auf derselben
  Fassung der Laufzeitumgebung, einer mit Langzeitunterstützung.
- Der Notfallweg zum schnellen Ausrollen oder Zurückdrehen eines Stands tauscht
  die Server nacheinander wie jede reguläre Auslieferung und lässt sich
  gefahrlos proben, ohne etwas zu ändern. Ohne Angabe eines Stands nimmt er den
  jüngsten, der fertig gebaut ist, auch wenn danach nur Dokumentation geändert
  wurde.
- Die Web-Version gibt beim Öffnen fremder Links nur noch ihre Adresse weiter,
  nie Einladungscodes oder Passwort-Links, und erlaubt Kamera und Mikrofon
  nur sich selbst. Eine Schutzregel gegen eingeschleuste Skripte ist in
  Kraft: Die Web-Version führt nur ihre eigenen Programmteile aus und lädt
  Inhalte nur von bekannten Adressen.
- Ein neues Android-Update erreicht über Google Play zuerst einen Teil der
  Nutzer:innen (10 %) und erst nach Freigabe alle; Testfassungen bleiben
  sofort für alle Testenden verfügbar.
- Ein Stand, dessen Prüfungen länger dauern als die eines neueren, wird nicht
  mehr nachträglich über den neueren ausgeliefert; die Web-Version kann so
  nicht mehr unbemerkt auf einen älteren Stand zurückfallen.
- Die Zuordnung der Web-Adresse zur iPhone-App ist korrekt hinterlegt statt
  als Platzhalter. Einladungs- und Passwort-Links öffnen auf dem iPhone die
  App, sobald die App diese Zuordnung selbst anmeldet.
- Das Server-Abbild wird genau aus den festgelegten Paketständen gebaut und
  enthält nur noch, was zum Betrieb gebraucht wird — keine Tests, keine
  Entwicklungswerkzeuge, keine Kopie des Datenbankschemas. Es ist damit
  rund viermal kleiner.
- Einladungscodes, Links zum Zurücksetzen des Passworts und das Erneuern der
  Anmeldung lassen sich nicht mehr beliebig oft durchprobieren: Nach vielen
  Fehlversuchen aus demselben Netz ist für 15 Minuten Pause. Gültige Codes,
  gültige Links und laufende Anmeldungen zählen dabei nicht mit.
- Beim Anlegen eines Events und bei der Zu- oder Absage des Teams gibt der
  Server seine Datenbankverbindung frei, bevor Chat und Mitteilungen
  erledigt werden. Unter Last konnten sich solche Anfragen sonst gegenseitig
  die Verbindungen wegnehmen.
- Die Tageslosung hängt nicht mehr an einem Zusatzpaket, das auf dem Server
  nur zufällig mitinstalliert war; fehlt es einmal, fällt sie nicht aus.
- Zwei Bausteine des Servers — für Datei-Uploads und für die Anfragegrenzen —
  sind auf Fassungen ohne die zuletzt gemeldeten mittelschweren
  Sicherheitslücken gehoben.
- Auch der Baustein für den Mailversand ist auf eine Fassung ohne die zuletzt
  gemeldete mittelschwere Sicherheitslücke gehoben; für den Server ist damit
  keine bekannte Lücke mehr offen.
- Die Code-Regeln der App werden bei jeder Änderung geprüft, nicht mehr nur
  bei Pull Requests; der Altbestand an Regelverstößen in der App ist
  abgebaut. Der Server hat jetzt eine eigene solche Prüfung, die vor allem
  Tippfehler in selten laufenden Abläufen findet, bevor sie ausgeliefert
  werden.
- Eine neu eingerichtete Instanz kommt beim ersten Start wieder hoch: Ein
  Hilfsskript im Ordner für die Ersteinrichtung der Datenbank wurde dort
  mit ausgeführt und brach den Start ab.
- Eine Sicherung lässt sich mit einem Skript in eine leere Datenbank
  zurückspielen, auch auf einer frisch eingerichteten Instanz; der bisher
  beschriebene Weg brach dort ab und hinterließ eine leere Datenbank. Das
  Skript weigert sich, eine Datenbank mit Konten ohne ausdrückliche
  Bestätigung zu ersetzen.
- Eine neu eingerichtete Datenbank rechnet in derselben Zeitzone wie der
  laufende Betrieb. Nach der bisherigen Vorlage hätte sie Berliner Zeit
  genommen, und Zeiten etwa im Postfach wären um zwei Stunden verrutscht.
- Für eine neu eingerichtete Instanz gibt es einen beschriebenen Weg zum
  ersten Zugang: Ein Skript legt die erste Gemeinde und ein Konto mit
  Super-Admin-Recht an, von dem aus sich in der App alle weiteren Gemeinden
  anlegen lassen.
- Die Datenbank nimmt keine Passwörter im Klartext mehr an: Das alte Feld
  dafür aus der Anfangszeit bleibt leer und lässt sich nicht mehr befüllen.
- Wann eine Anmeldung oder ein Zeitfenster angelegt wurde, speichert die
  Datenbank als Zeitpunkt statt als Text; sortiert wird damit nach dem
  Zeitpunkt, auch über die Nacht der Zeitumstellung hinweg.
- Das Server-Protokoll fasst Mitteilungen an viele zusammen: eine Zeile je
  Versand statt einer je Person ohne Gerät, und bei einer Störung des
  Mitteilungsdienstes eine Fehlerzeile mit Anzahl und erster Meldung statt
  einer je Gerät. So bleiben frühere Einträge länger lesbar.
- Nächtliche E-Mails an viele — Lizenz-Erinnerungen und Löschwarnungen —
  gehen gebündelt über eine Verbindung und in begrenztem Tempo hinaus, damit
  der Mailanbieter sie nicht ablehnt. Einzelne Mails wie ein Passwort-Reset
  warten dabei nicht.
- Abgelaufene und längst widerrufene Anmeldungen werden jetzt tatsächlich
  aus der Datenbank entfernt: gleich beim Start des Servers und danach alle
  sechs Stunden. Vorher geschah das nur nach einem ganzen Tag ohne Neustart,
  also praktisch nie.
- Die automatischen Prüfungen zeigen mehr Ansichten wirklich an, statt nur den
  Programmtext zu lesen — darunter Termin-Detail, Chat-Übersicht,
  Gemeinde-Einladung und Abmeldung; sie hängen nicht mehr von Uhrzeit und
  Zeitzone des Prüfrechners ab, und der Durchlauf im Browser prüft den
  Punktestand nach einer Vergabe auf den genauen Wert.
- Bleibt eine Auslieferung aus, weil die automatischen Prüfungen fehlschlagen,
  meldet sich das sofort als offener Eintrag im Projekt; er schließt sich
  selbst, sobald die Prüfungen wieder durchlaufen.
- Jede an die Stores hochgeladene Fassung ist im Quellcode mit Version,
  Plattform und Build-Nummer markiert; ein Absturzbericht lässt sich so dem
  genauen Stand zuordnen.
- Der Anmeldeschlüssel, den die App bei jeder Anfrage mitschickt, enthält
  Name und E-Mail-Adresse nicht mehr.
- Ob ein Benutzername schon vergeben ist, lässt sich ohne Anmeldung nur noch
  begrenzt oft abfragen, damit niemand Namenslisten abgleicht. Beim
  Registrieren in einer Gruppe merkt man davon nichts.
- Textdateien im Chat und im Material prüft der Server auf ihren Inhalt: Eine
  Webseite, ein Skript oder ein Programm unter dem Namen einer Textdatei wird
  abgelehnt, ebenso eine Textdatei über 2 MB. Gewöhnliche Texte und
  Excel-Listen gehen weiter durch.
- Das Aufräumen verwaister Dateien auf dem Server und die Verschlüsselung
  alter Dateien umfassen auch die Beiträge zu Challenges.
- Die Fehlerliste der Auslastungsanzeige zeigt Adressen ohne Suchbegriffe,
  Benutzernamen und Anmeldeschlüssel.
- Das Server-Protokoll führt keine Benutzernamen, E-Mail-Adressen, Dateinamen
  und Freitexte mehr, sondern nur noch die interne Kennung eines Kontos; auch
  eine Anmeldung hinterlässt dort keinen Namen. Fehlgeschlagene Anmeldungen
  stehen weiter im Protokoll, mit der Kennung des Kontos oder als unbekannter
  Benutzername.
- Fehlerhafte oder zu große Anfragen beantwortet der Server als solche, mit
  deutscher Meldung, statt als Serverfehler; sie füllen das Server-Protokoll
  nicht mehr.
- Lehnt der Server eine Anfrage auch nach dem Erneuern der Anmeldung ab,
  reicht die App die Ablehnung weiter, statt es endlos erneut zu versuchen.
- Die mit Face ID oder Fingerabdruck gesicherte Anmeldung (derzeit ohne
  Schalter in der App) legt den Anmeldeschlüssel auch nach dem regelmäßigen
  Erneuern nur noch geschützt ab, nicht zusätzlich offen auf dem Gerät.
- Ein fehlerhafter Aufruf beim Eintragen von Teilnehmenden von Hand bekommt
  eine klare Meldung statt eines Datenbankfehlers und legt keine Buchung mit
  unbekanntem Status mehr an.
- Mitteilungen, die älter als ein Jahr sind, werden nachts aufgeräumt.
- Die anonyme Nutzungsmessung unterscheidet unter „Mitmachen“ zwischen Events
  und Aktivitäten und zählt eingereichte Aktivitäten (mit oder ohne Foto).
- Die anonyme Nutzungsmessung zählt außerdem, wie oft die Leitung Anträge
  annimmt oder ablehnt (getrennt nach Konfis und Team), ob Material angesehen
  und Dateien oder Links daraus geöffnet werden und ob ein Konfispruch aus den
  Vorschlägen oder ein eigener gespeichert wird, samt Bibelübersetzung. Nie
  dabei: die Bibelstelle, Titel, Namen oder ein Ablehnungsgrund. Der
  Material-Reiter des Teams zählt als Material statt als Profil. Die
  Datenschutzerklärung nennt die neuen Arten.
- Scheitert das Hochladen einer Datei, hält die anonyme Fehlermessung fest,
  an welchem Schritt (Lesen der Datei, Senden, zweiter Versuch) und aus
  welchem groben Grund (Netz, Zeitgrenze, Antwort des Servers) — ohne
  Dateiname, Größe oder Typ.
- Die iPhone-App ist auf das Startverfahren umgestellt, das neuere
  iOS-Fassungen verlangen. Für die Bedienung ändert sich nichts — ohne die
  Umstellung ließe sich die App künftig aber nicht mehr öffnen.
- Der Server bricht eine Datenbankabfrage ab, die nicht mehr antwortet, statt
  ihren Platz dauerhaft zu belegen. In der Auslastungsanzeige steht jetzt auch,
  wie viele Anfragen gerade auf eine freie Datenbankverbindung warten.
- Stürzt die App ab, wird das jetzt automatisch gemeldet, damit die Ursache
  gefunden werden kann. Übertragen werden nur technische Angaben und die Rolle
  in grober Einteilung — kein Name, keine Kennung. Was dabei an Google geht,
  steht in der Datenschutzerklärung.
- Das Konfi-Profil lädt die Badges nicht mehr ein zweites Mal, nur um die
  Zahl in der Kachel anzuzeigen. Sie stand ohnehin schon in den Profildaten.
- Die iPhone-App legt Apple gegenüber offen, was sie erhebt: anonyme
  Nutzungsstatistik ohne Personenbezug, die Geräte-Kennung für Mitteilungen
  und Absturzberichte — und dass nichts davon zur Nachverfolgung über andere
  Apps oder Anbieter dient.
- Die Android-Fassung wird beim Bauen verkleinert und verschleiert. Das spart
  Platz auf dem Gerät und entspricht den Anforderungen von Google Play.
- Ein nicht mehr benutztes Kamera-Modul ist aus der App geflogen; die
  Fotoauswahl lief ohnehin längst über die Dateiauswahl des Systems.
- Innenabstände und Eckradien der eingebauten Bedienelemente hängen jetzt
  ebenfalls an der gemeinsamen Abstands-Skala; ein Test wacht darüber. Nichts
  sieht anders aus.
- Die Store-Fassungen für iPhone und Android werden nur noch aus geprüften Ständen
  gebaut: Der Bau wartet, bis die automatischen Prüfungen für genau diesen Stand
  bestanden sind, und bricht bei einem roten Ergebnis ab.
- Zwei Auslieferungen des Web-Stands laufen nicht mehr gleichzeitig, sondern
  nacheinander; die Test-Umgebung wird von einer Auslieferung nicht mehr mit
  umgestellt.
- Typprüfung und Web-Build laufen bei jeder Änderung als Teil der Prüfungen mit:
  Ein Stand, der sich nicht bauen lässt, fällt vor der Auslieferung auf statt still
  danach.
- Ein Prüflauf, der keine Tests findet, gilt nicht mehr als bestanden; bekannte
  Sicherheitslücken in Abhängigkeiten stoppen ihn ab der Stufe „hoch".
- An 21 geschützten Routen, für die es das bisher nicht gab, prüfen die Tests
  jetzt, dass eine fremde Gemeinde nichts sieht und nichts ändert. Zehn weiche
  Prüfungen, die auch eine falsche Antwort durchgehen ließen, erwarten jetzt
  den genauen Wert, etwa einen bestimmten Fehlerstatus statt „irgendein
  Fehler"; weitere weiche Prüfungen gibt es noch.
- Wer über die Schnittstelle Bonuspunkte, eine Aktivität oder Event-Punkte für
  eine Konfi einer anderen Gemeinde anfragt, bekommt „Konfi nicht gefunden"
  statt eines Serverfehlers. Die Prüfung steht jetzt vor jedem Konfi-Zugriff
  der Leitung und des Teams, nicht erst beim Speichern.
- Das Handbuch beschreibt den Wechsel der E-Mail-Adresse, die Challenge-Rechte
  des Teams, die Beförderung zur Teamer:in und den Gemeinde-Umschalter so, wie
  die App sich verhält.
- Die API-Referenz nennt an fünf Routen die Rollen, die der Server tatsächlich
  prüft, und führt zwei bisher fehlende Routen (Einladung zurückziehen, Jahre
  des Team-Rückblicks).
- Die Referenz-Konfiguration des Servers, die Abrissliste und ein Wartungsskript
  im öffentlichen Repo nennen keine Betriebsadressen mehr; sie kommen aus den
  Stack-Variablen des Betriebs.
- Die Anfragegrenzen des Servers übernehmen die Absenderadresse aus dem
  Header des eigenen Proxys nur noch, wenn die Anfrage auch wirklich von dort
  kommt. Vorher hätte ein Client, der den Proxy umgeht, jede Grenze mit einer
  selbst gesetzten Adresse aushebeln können.
- Der Mailversand prüft jetzt das Zertifikat des Mailservers, statt jedes
  anzunehmen. Über diesen Weg gehen Reset-Links und Listen mit Namen; wer sich
  dazwischenschaltete, hätte mitlesen können. Für den Notfall lässt sich die
  Prüfung im Betrieb abschalten, dann steht eine Warnung im Server-Log.
- Der Mailversand kennt keine eingebaute Serveradresse und keinen eingebauten
  Absender mehr; beides kommt nur noch aus der Betriebskonfiguration. Fehlt
  es, meldet der Server das klar, statt still eine falsche Adresse zu nutzen.
- Eine große Datenbank-Anpassung beim Start bricht nicht mehr nach kurzer
  Zeit ab, und ein zweiter Server, der auf sie wartet, beendet sich dabei
  nicht mehr mit der irreführenden Meldung „Datenbank nicht erreichbar". Ob
  beim Start eine Anpassung übersprungen wurde, steht in der Statusabfrage.
- Zwei gleichzeitig startende Server legen die Standard-Zertifikatstypen
  nicht mehr um die Wette an.
- Die zeitgesteuerten Aufgaben (Erinnerungen, Aufräumen, Löschfristen,
  Rückblick) übernimmt automatisch ein anderer Server, wenn der zuständige
  ausfällt. Ob gerade einer zuständig ist, steht in der Statusabfrage.
- Der Kennzahlen-Verlauf über lange Zeiträume kommt verdichtet (je Stunde
  beziehungsweise je Tag) statt als Rohdaten, die die Auslastungsanzeige
  mit vielen Megabyte überluden. Die letzten Wochen bleiben unverändert fein.
- Die Betriebsvorlage bemisst die Datenbank für viele Gemeinden in einer
  gemeinsamen Datenbank (mehr Rechenleistung, Speicher und
  Verbindungen) und nennt die Verbindungs- und Zeitgrenzen der Server
  ausdrücklich.
- Sicherung und Wiederherstellung sind beschrieben: was gesichert wird, wie
  eine Sicherung geprüft wird, wie sie in eine leere Datenbank zurückgespielt
  wird und wie die Rückspielprobe läuft — samt Prüfliste für den Betrieb und
  einem Referenzskript.
- Die Statusabfrage des Servers nennt die App-Version statt einer internen
  Paketnummer, und alle Versionsangaben im Projekt folgen einer einzigen Quelle;
  eine Prüfung schlägt an, sobald eine Stelle abweicht.
- Nach dem Anlegen einer Konfi erscheint das Einmalpasswort ohne eine vorher
  ins Leere laufende Anfrage; den Jahrgangs-Chat pflegt der Server ohnehin
  selbst.
- Beim Öffnen der Konfi-Liste lädt die App keine Angaben zur Gemeinde mehr,
  die sie gar nicht anzeigt.
- Alte, nicht mehr benutzte Anmeldungen werden einmalig beendet, damit kein
  Konto mehr als zehn offen hat; wer die App gerade benutzt, bleibt angemeldet.
- Das Server-Protokoll hält wiederkehrende Routinemeldungen nur noch bei einer
  Änderung oder gebündelt je Viertelstunde fest und reicht damit auch bei
  vielen Gemeinden länger zurück.

## [2.2.0] - 2026-09-18

iOS-Build 206 · Android versionCode 113

### Hinzugefügt
- Termine lassen sich **kopieren**: In der Terminliste nach links wischen oder
  in der Detailansicht oben auf das Kopieren-Symbol tippen. Das Formular öffnet
  sich mit allen Werten des Originals — angelegt wird erst beim Speichern.
  Material und Chat kommen nicht mit, ebenso wenig Anmeldungen, Anwesenheit und
  vergebene Punkte. Das Datum steht auf heute, der Anmeldeschluss wird daraus
  neu berechnet, und die Dauer bleibt erhalten. Die Kopie eines abgesagten
  Termins ist nicht abgesagt — so lässt sich ein ausgefallener Termin nachholen.
  Nach dem Speichern geht es zurück zur Terminliste, in der der neue Termin
  sofort steht.
- Teamer:innen sehen am Termin, **wer kommt**: die Teilnehmenden mit Jahrgang
  und Stand der Teilnahme, nach Konfis und Team getrennt. Wer auf einer
  Freizeit mitfährt, weiß damit vorher, wen er erwartet. Bei Abgemeldeten
  steht der **Grund** dabei, dazu **Notizen** wie „geht um 14 Uhr" und wer sie
  eingetragen hat — wer vor Ort ist, muss das wissen. Verbucht und geändert
  wird die Liste weiterhin von der Leitung.
- Im Challenges-Tab von Team und Leitung stehen jetzt auch die **noch nicht
  erhaltenen Stempel** grau daneben, und ein Tipp auf einen Stempel zeigt
  Name, Challenge und Datum — so, wie Konfis es schon kannten.
- In der Detailansicht der Leitung stehen unter den Abzeichen auch die
  Challenge-Stempel der angesehenen Person, bei Konfis wie bei Teamer:innen.
  Gezählt werden nur eigene, freigegebene Beiträge. Wer nur bestimmte
  Jahrgänge betreut, sieht die Stempel auch nur dort.
- Die Anwesenheit kennt einen dritten Eintrag: **Abgemeldet**. Wird jemand
  außerhalb der App abgemeldet, etwa weil die Eltern anrufen und das Kind
  krank ist, lässt sich das in einem eigenen Fenster mit Grund und Notiz
  festhalten. Der Grund steht in der Teilnehmerliste, damit das ganze Team ihn
  sieht. Punkte gibt es dabei keine; schon vergebene werden zurückgenommen.
  Die Konfi bekommt eine Mitteilung, dass die Abmeldung eingetragen wurde.
- Beim Absagen eines Termins lässt sich ein **Grund** angeben. Er ist
  freiwillig — ohne ihn wird wie bisher nur die Absage gemeldet. Wird einer
  eingetragen, sehen ihn alle Teilnehmenden am Termin, und er steht in der
  Mitteilung, die auf den Handys ankommt. Darunter steht klein, wer abgesagt
  hat und wann.
- Der Absagegrund lässt sich bei einem bereits abgesagten Termin nachtragen,
  ändern oder wieder entfernen — wer beim Absagen in Eile nichts eingetragen
  oder sich vertippt hat, kommt jetzt noch einmal heran. Eine neue Mitteilung
  geht dabei nicht raus; die Absage war schon gemeldet. Korrigiert jemand
  anderes als die absagende Person, steht das darunter, und „Abgesagt von"
  nennt weiterhin, wer den Termin tatsächlich abgesagt hat.
- Eine **Absage lässt sich zurücknehmen**: Ist die Heizung doch rechtzeitig
  repariert, findet der Termin wieder statt — ohne ihn neu anzulegen.
  Anmeldungen, Warteliste und Chat bleiben, wie sie waren; jede Person kommt
  genau dorthin zurück, wo sie vorher stand. Alle Wiederangemeldeten bekommen
  die Mitteilung „Termin findet doch statt" mit der Bitte, ihre Zeit zu
  prüfen und sich sonst abzumelden. Wer schon vor der Absage abgemeldet war —
  selbst oder von der Leitung —, bleibt abgemeldet und bekommt keine
  Nachricht. Punkte werden nicht wiederhergestellt; der Termin steht ja erst
  bevor. Vor dem Zurücknehmen wird gefragt und genannt, wie viele Personen
  wieder angemeldet werden. Zwei Wege führen dorthin: der Wisch in der
  Terminliste und ein Knopf ganz unten im Termin — dort, wo bei einem
  laufenden Termin „Event absagen" steht.
- Zu jeder Anwesenheit lässt sich eine **Notiz** eintragen, etwa „ging um
  14 Uhr". Sie ändert nichts am Status: Wer anwesend war, bleibt anwesend und
  behält seine Punkte. Notizen lassen sich auch wieder löschen.
- Die Anwesenheits-Matrix zeigt nachgetragene Abmeldungen als eigenen grauen
  Punkt; der Termin zählt dort nicht in die Pflicht-Summe, genau wie bei einer
  Abmeldung, die der Konfi selbst vorgenommen hat.
- Unter dem Eintrag steht klein, wer die Anwesenheit zuletzt eingetragen hat
  und wann — bei einer Rückfrage ist damit klar, wen man fragt. Anwesenheit
  und Notiz werden dabei getrennt geführt: Trägt eine Kollegin nur eine Notiz
  nach, bleibt bei der Abmeldung der Name stehen, der dorthin gehört. Bei
  einem Check-in per QR-Code und bei älteren Einträgen fehlt die Zeile: dort
  gibt es niemanden aus dem Team, der sie eingetragen hätte.
- Wer sich per QR-Code eingecheckt hat, ist daran jetzt auch zu erkennen:
  Unter dem Eintrag steht „Eingecheckt per QR-Code" mit dem Datum. Vorher war
  ein Selbst-Check-in nicht von einem alten Eintrag zu unterscheiden — bei
  beiden stand dort gar nichts. Trägst du den Status später von Hand nach,
  tritt dein Name an die Stelle dieser Zeile.
- Ein Tippen auf einen Challenge-Stempel zeigt jetzt, woher er stammt: die
  Challenge, ihre Beschreibung und das Datum, an dem er vergeben wurde.
  Stempel, die es noch zu holen gibt oder deren Challenge vorbei ist, stehen
  grau daneben — mit einem Hinweis, was noch geht.
- Die App lässt sich mit Face ID, Touch ID oder Fingerabdruck **sperren**.
  Im Profil wählt man, nach welcher Zeit im Hintergrund die Abfrage kommt:
  sofort, nach 1, 5 oder 15 Minuten. Das ist praktisch, wenn das Handy einmal
  aus der Hand gegeben wird — angemeldet bleibt man dabei. Die Sperre ist von
  Haus aus aus und erscheint nur, wenn auf dem Gerät eine Erkennung
  eingerichtet ist. Wer nicht hineinkommt, meldet sich über einen Knopf auf
  dem Sperrbildschirm ab und wieder neu an.
- Bei eingeschalteter Sperre zeigt die App auch in der Übersicht der offenen
  Apps nichts mehr her: Statt Namen, Punkten und Beiträgen steht dort nur noch
  das Logo. Auf Android sind bei eingeschalteter Sperre zusätzlich
  Bildschirmfotos innerhalb der App gesperrt. Wer die Sperre auf „Aus" stehen
  lässt, merkt davon nichts.
- Beim Anlegen einer Organisation gibt es unter dem Passwortfeld denselben
  Knopf „Sicheres Passwort vorschlagen" wie beim Setzen eines neuen
  Passworts — der Vorschlag ist sichtbar, damit er sich weitergeben lässt.

### Geändert
- **Die eigene Zu- und Absage der Leitung funktioniert wie im Team:** Solange
  nichts entschieden ist, stehen beide Knöpfe da; danach nur noch der Weg
  zurück — „Nicht mehr dabei" nach einer Zusage, „Doch dabei" nach einer
  Absage. Den Grund fragt dasselbe Fenster ab wie bei den Teamer:innen.
- **Ein abgesagter Termin steht bei den Konfis an seinem Datum**, nicht am
  Ende der Liste — durchgestrichen und mit rotem Eck. So beantwortet die
  Liste im Vorbeigehen die Frage, die man wirklich hat: Was ist mit dem
  Termin am Freitag?
- **Die App-Sperre fragt beim Einschalten einmal nach Face ID beziehungsweise
  dem Fingerabdruck.** Klappt es, ist die Sperre an; klappt es nicht, bleibt
  sie aus und sagt das. So merkt man sofort, ob die Sperre auf diesem Gerät
  funktioniert, statt es erst beim nächsten Start der App herauszufinden.
  Beim Abschalten und beim Ändern der Wartezeit wird nicht erneut gefragt.
- **Termine anlegen, ändern und absagen ist Sache der Leitung.** Das gilt auch
  fürs Löschen, fürs Ein- und Austragen von Personen und fürs Verbuchen der
  Anwesenheit. Teamer:innen sagen weiterhin für sich selbst zu oder ab, zeigen
  den QR-Code zum Einchecken und öffnen den Termin-Chat. Ist ein Termin
  abgesagt, sehen sie das und den Grund dazu.
- **Eine Absage meldet wirklich alle ab** — auch, wen du schon als anwesend
  oder abwesend verbucht hattest. Ein abgesagter Termin hat keine Anwesenden;
  Punkte, die dafür schon vergeben waren, werden zurückgenommen. Wer sich vor
  der Absage selbst abgemeldet hatte oder von dir mit eigenem Grund abgemeldet
  wurde, behält diesen Grund unverändert. Waren trotzdem welche da, setzt du
  sie danach wie gewohnt auf anwesend und gibst ihnen Punkte. Nimmst du die
  Absage später zurück, kommen alle als noch nicht verbucht zurück — eine
  Anwesenheit von vor der Absage steht dann nicht mehr da.
- Der Absagegrund steht in der Detailansicht eines Termins jetzt in einer
  eigenen Karte „Absage" — in derselben weißen Form wie die Details darunter
  und mit denselben Zeilen: ein rotes Zeichen am Anfang, darüber „Grund" und
  „Abgesagt von", darunter der Text. Geändert wird beides nicht mehr hier,
  sondern mit einem Wisch am Termin in der Liste.
- **Abgesagte Termine sehen überall gleich aus.** In allen Listen und auf den
  Startseiten steht ein abgesagter Termin durchgestrichen und grau — bisher
  galt das für Konfis und Leitung, im Team sah er aus wie jeder andere. Der
  Absagegrund steht jetzt auch auf den Startseiten, also genau dort, wo man
  nach der Mitteilung zuerst landet. Wer den Grund nachträglich geändert hat,
  wird für alle genannt und nicht nur der Leitung. Ist kein Grund angegeben,
  sagt die Detailansicht das auch — vorher war „kein Grund" nicht von einer
  alten Absage zu unterscheiden. Und das Team kann einen Grund jetzt selbst
  nachtragen oder ändern; erlaubt war es längst, nur der Weg dorthin fehlte.
- **Grund ändern und Absage zurücknehmen liegen jetzt beide auf dem Wisch** am
  abgesagten Termin in der Terminliste — der grüne Pfeil nimmt die Absage
  zurück, der Stift daneben öffnet den Grund. Leitung und Team haben beide
  Wege; im Termin selbst steht die Absage nur noch zum Lesen.
- Die Kachel „Abgemeldet" zählt nach einer Terminabsage wieder alle
  Abgemeldeten statt null. In Terminen mit Zeitfenstern stehen Abmeldungen
  jetzt ebenfalls in der Teilnehmerliste — mit Grund und in derselben Farbe
  wie in Terminen ohne Zeitfenster; vorher fielen sie dort ganz heraus und der
  Platz sah frei aus.
- Im Reiter „Alle" stehen abgesagte Termine am Ende der Liste statt zwischen
  den Terminen, für die man sich noch anmelden kann.
- Wird ein Termin abgesagt, sind alle Angemeldeten und alle auf der Warteliste
  automatisch **abgemeldet** — mit dem Absagegrund als Grund, ohne Grund mit dem
  Vermerk „Termin abgesagt". Punkte gibt es dafür keine; schon vergebene werden
  zurückgenommen, denn der Termin hat nicht stattgefunden. Der Termin steht damit
  nicht mehr als „noch zu verbuchen" im Zähler. Wer trotzdem da war und geholfen
  hat, lässt sich weiterhin einzeln auf anwesend setzen und bekommt seine Punkte.
  Eine zusätzliche Mitteilung geht nicht raus — die Absage war schon gemeldet.
  Bereits abgesagte Termine bleiben, wie sie sind.
- Nach einem Update zeigt die App einmal, was sich geändert hat — je nach
  Rolle das, was für Konfis, Team oder Leitung wichtig ist. Wer die App neu
  installiert, bekommt sie nicht zu sehen, und zwischen zwei Testversionen
  derselben Ausgabe erscheint sie auch nicht.
- Dateien aus dem Chat werden nur noch einmal geladen. Wer eine PDF, ein
  Dokument oder eine Tondatei ein zweites Mal antippt, hat sie sofort vor sich —
  ohne Ladeanzeige und ohne Netz. Bisher galt das nur für Bilder und Videos,
  alles andere lud jedes Mal neu.
- Der Speicher für diese Dateien räumt sich selbst auf: Wird es eng, verschwindet
  zuerst, was am längsten niemand geöffnet hat. Vorher wuchs er immer weiter, bis
  jemand von Hand „Medien-Cache leeren" drückte.
- Termine lassen sich nur noch in den eigenen Jahrgängen anlegen, ändern,
  absagen und löschen — auch Serientermine. Dasselbe gilt fürs Eintragen von
  Personen und fürs Verbuchen der Anwesenheit. Bisher galt diese Grenze nur
  beim Ansehen und Buchen. Allgemeine Termine und reine Team-Termine bleiben
  für alle offen.
- Wer ein Passwort für eine andere Person zurücksetzt, beendet damit auch deren
  laufende Sitzungen. Vorher blieb ein fremder Zugriff bestehen, obwohl das
  Passwort neu war.
- Nachweisfotos sehen nur noch Verantwortliche der betreffenden Jahrgänge.
- Die App startet spürbar schneller: Beim Öffnen wird rund ein Drittel weniger
  geladen.
- Für Abzeichen, Stempel und Zertifikate stehen 95 Symbole zur Auswahl statt
  bisher 54 — mehr aus Musik, Sport, Spiel, Essen, Wetter und Unterwegssein.
- Knöpfe, die etwas löschen oder abmelden, sehen überall gleich aus: rot
  umrandet, über die volle Breite. Der Knopf zum Löschen einer Notiz stand
  bisher als blasser Text daneben.

### Behoben
- Im Challenges-Tab von Team und Leitung standen **Stempel aus Entwürfen und
  aus geplanten Challenges** in der Reihe der noch zu holenden — als ließen
  sie sich schon jetzt erreichen. Angezeigt werden jetzt nur Stempel aus
  laufenden und vergangenen Challenges, so wie Konfis es ohnehin sahen.
- Beim Verschieben eines Termins auf ein anderes Datum wurde die **Dauer auf
  eine Stunde zurückgesetzt**. Aus einer Freizeit über ein ganzes Wochenende
  wurde so ein Ein-Stunden-Termin. Das Ende wandert jetzt mit dem Beginn mit.
- Beim Anlegen einer **Terminserie** wurde ein Anmeldeschluss, der schon
  abgelaufen war, kommentarlos übernommen — der erste Termin der Reihe war
  damit von Anfang an geschlossen. Serien werden jetzt genauso geprüft wie
  einzelne Termine. Reihen nachzutragen, die in der Vergangenheit liegen,
  bleibt möglich.
- Teamer:innen wurden Knöpfe zum **Anlegen, Absagen, Löschen und Bearbeiten**
  von Terminen angezeigt, die beim Antippen mit einer Fehlermeldung endeten —
  Terminverwaltung ist Leitungssache. Die Knöpfe sind dort jetzt nicht mehr
  zu sehen. Termine ansehen, die eigene Zu- und Absage und der QR-Check-in
  bleiben unverändert.
- Ist ein Termin **abgesagt**, steht der Hinweis darauf im Team jetzt in
  derselben ruhigen Darstellung wie bei den Konfis, statt in Rot. Die rote
  Kennzeichnung des Termins selbst — in der Liste und am Eck — bleibt.
- Sagte eine Teamer:in im Termin zu oder ab, **änderte sich in der App nichts**:
  Die Liste „Wer kommt" zeigte weiter den alten Stand, erst ein Neuladen half.
  Im Browser war es sofort zu sehen. Jetzt steht der neue Stand direkt da —
  beim Zusagen wie beim Absagen und auch beim Herunterziehen der Seite.
- Eine **Zusage wurde nicht bestätigt**: Wer „Dabei" antippte, bekam keine
  Rückmeldung; nur ein Wartelistenplatz meldete sich. Jetzt kommt in beiden
  Fällen eine Meldung.
- Zusage und Absage einer Teamer:in nehmen denselben Weg. Vorher lief die
  Zusage anders als die Absage, und die Leitung konnte nicht erkennen, dass
  eine Absage eine vorherige Zusage zurückgenommen hatte.
- Ein kurzfristig eingetragener Termin war **sofort geschlossen**: Der
  voreingestellte Anmeldeschluss lag 24 Stunden vor Beginn und damit bei allem,
  was noch heute stattfindet, in der Vergangenheit — niemand konnte sich
  anmelden, und nichts wies darauf hin. Der Vorschlag rückt jetzt nach, wenn
  der Termin näher liegt, und bleibt immer zwischen jetzt und Beginn. Ist bei
  einem noch kommenden Termin trotzdem ein abgelaufener Schluss eingetragen,
  sagt das Speichern es und der Termin wird nicht angelegt. Termine, die
  nachträglich eingetragen oder korrigiert werden, sind davon nicht betroffen.
- Ein Termin mit Anmeldungen ließ sich **nicht löschen**: Die Rückfrage, ob die
  Anmeldungen wirklich verloren gehen sollen, erschien nie. Der Dialog
  verschwand, der Termin blieb stehen. Jetzt kommt die Rückfrage und nennt, was
  verloren geht — bei einzelnen Terminen wie bei ganzen Serien.
- **Die eigene Zusage der Leitung zeigte immer beide Knöpfe**, auch nachdem man
  sich längst entschieden hatte. Jetzt ist es wie im Team: Solange nichts
  gewählt ist, stehen beide da; danach nur noch der Weg zurück — „Nicht mehr
  dabei" nach einer Zusage, „Doch dabei" nach einer Absage.
- Im Team stand unter **„Bist du dabei?"** bei manchen Terminen eine leere
  weiße Karte ohne Inhalt — etwa bei einem vergangenen Termin, an dem man nicht
  teilgenommen hatte. Der Abschnitt entfällt jetzt ganz, wenn es dort nichts zu
  sagen gibt.
- Bei einem **abgesagten Termin** bot die Team-Ansicht als einzige weiter die
  Zusage an, obwohl der Termin nicht stattfindet. Dort steht jetzt derselbe
  Hinweis wie bei Konfis und Leitung.
- Wer von der Leitung zu einem Termin angemeldet wurde, **erfuhr es nicht** —
  weder Konfis noch Teamer:innen bekamen eine Mitteilung, die Anmeldung tauchte
  irgendwann kommentarlos in der eigenen Liste auf. Jetzt kommt dieselbe
  Mitteilung an wie bei der Selbstanmeldung; wer direkt auf die Warteliste
  gesetzt wird, erfährt auch das.
- Auf dem Anmelde-Knopf eines Termins, zu dem sich noch niemand angemeldet
  hatte, stand „null" statt der Zahl der Angemeldeten. Dort steht jetzt „0".
- Ein Termin, auf dessen **Warteliste** man steht, fehlte unter „Meine" — bei
  Konfis wie im Team. Er steht dort jetzt wieder, zusammen mit den Terminen,
  die man selbst abgesagt hat: Unter „Meine" stehen alle Termine, zu denen es
  eine eigene Rückmeldung gibt, egal welche. Die Zähler über der Liste zählen
  genauso.
- Wer von der Leitung abgemeldet wurde, kam **nicht mehr auf den Termin
  zurück**: Die Anmeldung wurde mit „Du bist bereits angemeldet" abgelehnt,
  obwohl das Gegenteil der Fall war, und es gab auch sonst keinen Weg. Wird
  das Kind rechtzeitig gesund, steht der Termin jetzt wieder da wie jeder
  andere offene Termin — mit Anmeldeschluss, Warteliste und Zeitfenstern wie
  gewohnt. Am Termin selbst bleibt der QR-Code gesperrt, damit niemand sich
  die zurückgenommenen Punkte selbst wiederholt.
- Im Fenster zum **Anlegen und Bearbeiten eines Termins wurden Texte und
  Knöpfe abgeschnitten**: Die Beschriftungen über den Datumsfeldern — „Event
  Datum & Uhrzeit", „Endzeit", „Anmeldeschluss" sowie Start- und Endzeit eines
  Zeitfensters — lagen halb unter den Datumsfeldern und waren an der unteren
  Kante angeschnitten. Auch der Knopf „Zeitfenster hinzufügen" war unten
  angeschnitten. Beschriftungen und Knöpfe stehen jetzt vollständig da.
- Die **Startseite blieb beim ersten Öffnen der App leer** — bei Konfis und im
  Team. Die Tab-Leiste stand da, der Inhalt fehlte; erst wer einmal auf einen
  anderen Reiter und zurück tippte, sah seine Startseite. Sie wird jetzt sofort
  angezeigt.
- Ein eingetragener Anwesenheitseintrag ließ sich nicht mehr **zurücknehmen**:
  Wer versehentlich jemanden abgemeldet oder verbucht hatte, konnte den Eintrag
  nur noch ändern, nicht löschen. Im Menü der Teilnehmerliste steht jetzt
  „Eintrag zurücksetzen" — die Person gilt danach wieder als nicht verbucht,
  Grund und Punkte sind zurückgenommen, die Notiz bleibt stehen.
- Eine Wartende ließ sich auch dann bestätigen, wenn der Termin **voll** war —
  zwei Personen standen dann auf einem Platz, ohne dass es irgendwo auffiel.
  Das wird jetzt abgelehnt, mit dem Hinweis, erst die Teilnehmerzahl zu
  erhöhen.
- In der **Konfi-Historie** einer Teamer:in standen auch deren Teamer-Abzeichen.
  Dort gehört nur die eigene Konfi-Zeit hin; die Teamer-Abzeichen stehen
  weiterhin unter „Badges".
- Ein abgesagter Termin, zu dem man angemeldet war, verschwand aus dem Reiter
  **Meine** — ausgerechnet bei der Person, die es angeht. Er steht dort wieder,
  durchgestrichen, und zählt in den Zahlen darüber mit.
- Beim Absagen eines Termins oder beim Speichern des Absagegrundes blieb das
  Fenster stehen, ohne etwas zu sagen, wenn der Server die Änderung ablehnte.
  Jetzt erscheint die Meldung, und der Text bleibt zum Weiterbearbeiten stehen.
- Zu einem **abgesagten Termin kann man sich nicht mehr anmelden**. Wer sich
  von einem Pflichttermin abgemeldet hatte und danach die Absage erlebte, sah
  weiterhin „Wieder anmelden" — und der Knopf funktionierte auch: Man stand
  danach angemeldet an einem Termin, der nicht stattfindet. Die Anmelde-Knöpfe
  verschwinden jetzt, solange die Absage steht, und auch die Leitung trägt
  dort niemanden mehr ein. Abmelden geht weiter, und beim Zurücknehmen der
  Absage kommen alle wie gewohnt zurück.
- In der Absage eines Termins stand „Abgesagt von" doppelt: einmal als
  Überschrift und einmal davor im Namen.
- Die Rückfrage vor dem Absagen eines Termins zählte Abgemeldete mit. Bei 13
  eingetragenen Konfis, von denen sich eine selbst abgemeldet hatte und eine
  von der Leitung abgemeldet worden war, stand dort „13 Konfis angemeldet",
  während die Zahlen darüber im selben Bild richtig 11 zeigten. Jetzt steht
  überall dieselbe Zahl: Wer abgemeldet ist, zählt nicht als angemeldet.
- In der Terminliste einer Serie wurden Teamer:innen und zugeordnete Leitung
  als Teilnehmende mitgezählt, obwohl daneben „TN" stand und überall sonst nur
  Konfis gemeint sind. Ein Serientermin mit 19 Konfis und 4 Teamer:innen
  meldete dort 23.
- Ein **abgesagter** Termin zeigte in der Konfi-Ansicht „0 frei", „0 dabei"
  und „Teilnehmer:innen 0 von unbegrenzt". Die Nullen waren zwar richtig — bei
  einer Absage ist niemand mehr angemeldet —, sagten aber nichts. Jetzt steht
  dort, um wie viele es ging: „13 abgemeldet". Freie Plätze entfallen; an
  einem Termin, der ausfällt, ist keiner frei.

- Wird ein Platz frei, rückt jetzt in **jedem** Fall die nächste wartende
  Person nach — auch wenn eine Konfi sich von einem Pflichttermin abmeldet, die
  Leitung jemanden abmeldet, jemanden auf die Warteliste zurücksetzt, eine
  Konfi löscht, sie zur Teamer:in befördert oder in einen anderen Jahrgang
  verschiebt. Bisher verfiel der Platz auf diesen Wegen stillschweigend: Die
  Warteliste blieb stehen, obwohl er offen war.
- An einem **abgesagten** Termin rückt niemand mehr nach. Bisher konnte dort
  „Ein Platz ist frei geworden — du bist jetzt angemeldet" ankommen, für einen
  Termin, der gar nicht stattfindet.
- Holt die Leitung jemanden von Hand von der Warteliste, merkt sich der
  Jahresrückblick jetzt, dass diese Person gewartet hat. Dasselbe gilt beim
  Erhöhen der Plätze — dort kamen die Nachgerückten außerdem nicht in den Chat
  zum Termin.
- Wird der Absagegrund nachträglich geändert, kommt die Korrektur jetzt auch
  bei den Teilnehmenden an. Bisher stand am Termin der neue Text und in der
  Teilnehmerliste bei jeder einzelnen Person weiter der alte. Wer einen
  eigenen Grund bekommen hat, etwa „krank, Mutter hat angerufen", behält ihn.
- Ein Tipp auf die Absage-Meldung führt jetzt zum Termin statt nur zur
  Terminliste — dort steht der Grund ausführlich und darunter, wer abgesagt
  hat.
- Wird ein bereits abgesagter Termin später gelöscht, geht keine zweite
  Absage-Meldung mehr raus. Bisher bekamen die Angemeldeten denselben Termin
  zweimal abgesagt. Beim Löschen eines Termins, der noch nicht abgesagt war,
  wird weiterhin benachrichtigt.
- Wer abgemeldet ist, bekommt keine Erinnerung mehr zu dem Termin. Bisher kam
  nach „Abmeldung eingetragen" trotzdem am Vortag „Morgen: …" und kurz vor
  Beginn „Gleich: …". Das gilt jetzt für jede verbuchte Anwesenheit — wer als
  anwesend, abwesend oder abgemeldet eingetragen ist, wird nicht mehr erinnert.
- Eine Abmeldung gibt den Platz jetzt wirklich frei. Bisher zählte die
  abgemeldete Person weiter als angemeldet: Der Termin blieb ausgebucht,
  niemand rückte von der Warteliste nach, und in der Teilnehmerliste stand sie
  ganz oben zwischen den Anwesenden. Jetzt rutscht sie zu den Abgemeldeten
  nach unten, der Platz ist wieder buchbar und die Warteliste rückt nach.
  Wird die Anwesenheit später doch auf anwesend gesetzt, zählt die Anmeldung
  wieder.
- Wer abgemeldet ist, kann sich nicht mehr selbst per QR-Code einchecken. Die
  Meldung sagt jetzt, dass abgemeldet wurde, statt von einer unbestätigten
  Anmeldung zu sprechen. Wer doch da ist, wird von der Leitung eingetragen.
- Auf der Startseite der Teamer:innen steht ein abgesagter Termin, zu dem man
  zugesagt hat, weiterhin in der Liste — als abgesagt, mit Grund und mit dem
  Namen der Person, die abgesagt hat. Bisher verschwand er wortlos, und die
  Zusage blieb im Kopf. Termine, für die nur Team gesucht wurde, verschwinden
  nach einer Absage wie bisher.
- Im Browser am Rechner ließen sich Bilder und Dateien im Chat nicht mehr
  öffnen: Statt der Datei kam die Meldung „Fehler beim Öffnen der Datei", ohne
  dass die Datei überhaupt geladen wurde. Ursache war die kurze Vibration, die
  beim Antippen ausgelöst wird — Geräte ohne Vibration brachen den ganzen
  Vorgang damit ab. Betroffen waren neben dem Chat auch das Öffnen von
  Material und das Abspielen von Videos; Links aus dem Material gingen aus
  demselben Grund gar nicht erst auf.
- Die App zeigte überall ein Fingerabdruck-Symbol, auch auf Geräten mit Face ID.
  Jetzt passt das Symbol zum Verfahren des Geräts: ein Gesicht bei Face ID und
  bei der Gesichtserkennung auf Android, ein Finger bei Touch ID und beim
  Fingerabdruck. Lässt sich nicht sicher sagen, womit das Gerät entsperrt,
  stehen ein Schloss und der neutrale Text „Biometrie" da statt einer Vermutung.
- Abgesagte Termine verschwanden in der Terminübersicht der Leitung aus allen
  Reitern, sobald ihr Datum vorbei war. Sie stehen jetzt durchgestrichen unter
  „Vergangen".
- Die App zeigt beim Start wieder sofort das Dashboard. Zuletzt blieb der
  Bildschirm leer, bis man einen anderen Reiter antippte und zurückkam.
- Lange Namen unter Abzeichen und Stempeln werden nicht mehr mitten im Wort
  abgeschnitten. Passt ein Name nicht, endet er sauber mit drei Punkten; der
  volle Name steht beim Antippen da.
- Die Kacheln einer Reihe sind gleich hoch, auch wenn ein Name zwei Zeilen
  braucht und der daneben nur eine.
- Wer sich selbst von einem Pflichttermin abgemeldet hat und dann doch kommt,
  lässt sich jetzt ganz normal verbuchen — anwesend, abwesend, abgemeldet oder
  mit einer Notiz. Vorher passierte beim Tippen auf den Eintrag nichts. Die
  ursprüngliche Abmeldung bleibt als Vorgeschichte darunter stehen, und der
  Termin zählt wieder in die Pflicht-Summe.
- In der Challenge-Ansicht für Leitung und Team trägt das Symbol über einem
  leeren Reiter jetzt die Farbe der Challenges statt der des Teams.
- Wer nur bestimmte Jahrgänge betreut, kommt an die Profile der übrigen Konfis
  nicht mehr heran. Die Detailansicht folgt damit derselben Grenze wie alles
  andere; Teamer:innen bleiben wie bisher für die ganze Leitung sichtbar.
- Abgesagte Termine treiben die rote Zahl am Reiter „Verbuchen" nicht mehr
  hoch. Bisher stand dort eine Zahl, hinter der eine leere Liste wartete, weil
  abgesagte Termine gar nicht zum Verbuchen angezeigt werden. Das gilt auch für
  die Zahl am App-Symbol.
- Nach dem Öffnen einer Datei blieb auf dem Gerät jedes Mal eine Kopie zurück,
  die nie wieder verschwand. Sie wird jetzt aufgeräumt.
- Teamer:innen, die selbst einmal Konfi waren, kommen wieder an ihre
  Konfi-Historie — auch wenn ihr damaliger Jahrgang gelöscht wurde. Der
  Einstieg fehlte dann, obwohl Punkte und Abzeichen von damals noch da sind.
- Große Anhänge brechen beim Öffnen nicht mehr ab, wenn die Verbindung langsam
  ist. Bisher galt dieselbe knappe Wartezeit wie für alles andere — ein großes
  PDF im Gemeindehaus scheiterte damit zuverlässig.
- Abzeichen, für die ein Emoji gewählt wurde, zeigen im Rückblick endlich
  dieses Emoji statt einer Trophäe — auf allen Seiten, auch dort, wo die
  gesammelten Abzeichen nebeneinanderstehen.
- Videos im Chat geben ihren Speicher wieder frei, wenn man vorbeiscrollt,
  bevor sie geladen sind.
- Die Anwesenheitsanzeige mit QR-Code hört auf, im Hintergrund weiterzuzählen,
  nachdem man sie geschlossen hat.
- Scheitert das Anlegen des Team-Rückblicks vollständig, sagt die Seite das
  jetzt. Vorher meldete sie Erfolg, und das ganze Team bekam eine Nachricht für
  einen Rückblick, den es gar nicht gab. Der Versuch lässt sich danach
  wiederholen.
- Einzelne fehlende Angaben lassen den Team-Rückblick nicht mehr scheitern.
  Fehlte etwa die Angabe zu den Challenge-Beiträgen, blieb vorher die ganze
  Erstellung stecken; jetzt entfällt nur die betroffene Seite.
- Die Hintergrund-Aufgaben — Termin-Erinnerungen, das Aufräumen alter
  Anmeldungen, die automatische Löschung — laufen auch dann weiter, wenn beim
  Start einmal etwas schiefgeht. Vorher konnte sich der Server dabei in einer
  Neustartschleife festfahren, ohne dass es nach außen auffiel.
- Gleichzeitige Zugriffe kommen sich nicht mehr ins Gehege. In seltenen Fällen
  konnte das Speichern einer Umfrage, eines Check-ins oder einer Termin-Änderung
  eine fremde, parallel laufende Aktion abbrechen.
- Eine eingetragene Anwesenheit wird nicht mehr als Fehler gemeldet, obwohl sie
  gespeichert wurde. Wer daraufhin ein zweites Mal tippte, konnte vergebene
  Punkte durcheinanderbringen.
- Bei eingeschalteter App-Sperre blitzte beim Start aus dem ganz geschlossenen
  Zustand kurz die App auf, bevor der Sperrbildschirm davorsprang. Jetzt ist bis
  zur Sperre nichts davon zu sehen. Wer die Sperre nicht nutzt, startet
  unverändert.

### Sonstiges
- Zwei Kacheln im Konfi-Profil, die seit ihrer Entstehung nie erschienen sind
  („Nächstes Badge" und „Letzte Aktivitäten"), sind entfernt.
- Eine Vorbereitung der Chat-Räume beim Serverstart, die seit über einem Jahr
  wirkungslos war, ist entfernt. Die Räume entstehen an anderer Stelle und
  vollständiger; für Nutzer:innen ändert sich nichts.
- Neu aufgesetzte Installationen legen ihre Datenbank wieder vollständig an.
  Bestehende Gemeinden waren nicht betroffen.
- Eine neu aufgesetzte Gemeinde startet jetzt mit demselben Datenbankstand wie
  die bestehenden. Zuvor wäre sie mit einem veralteten, unvollständigen Stand
  gestartet und gar nicht erst hochgekommen. Bestehende Gemeinden waren nicht
  betroffen.
- Zusätzliche Absicherung beim Zuordnen von Jahrgängen, damit Zuweisungen die
  Grenze der eigenen Gemeinde in keinem Fall überschreiten können.
- Die stündliche Abzeichen-Prüfung sieht nur noch Personen an, bei denen sich
  seit dem letzten Mal etwas getan hat. Vergeben wird unverändert dasselbe; in
  großen Gemeinden spart das erheblich Rechenzeit.
- Die anonyme Nutzungsmessung erfasst zusätzlich, welche Art von Arbeit in der
  App geschieht — Punkte vergeben, Anwesenheit erfassen, Beiträge durchsehen,
  Termine anlegen, Material bereitstellen. Übertragen werden ausschließlich die
  Art der Handlung und die Rolle, keinerlei Angaben zu einzelnen Personen.
- Bei einer Fehlermeldung wird zusätzlich vermerkt, welcher Art der Fehler war
  (etwa Zeitüberschreitung oder fehlende Verbindung) und an welcher Stelle der
  App er auftrat. Das hilft, wiederkehrende Fehler zu finden.
- Die Zählung der Werbeseite trennt jetzt sauber von der App: Aufrufe aus der
  App landen nicht mehr in der Werbestatistik, und wer die Startseite nur als
  Einstieg zur Anmeldung nutzt, wird als solcher erkannt.
- Die Verlaufszahlen im Betriebs-Dashboard reichen jetzt zwei Jahre zurück
  statt 30 Tage.

## [2.1.1] - 2026-09-11

iOS-Build 182 · Android versionCode 90

### Hinzugefügt
- Teamer:innen, für die in einem Jahr nichts zusammengekommen ist, bekommen
  keinen Rückblick voller Nullen mehr, sondern einen Zuspruch: eine
  Begrüßung, ein Segenswort und einen Dank. Der Spruch bleibt derselbe, so
  oft man den Rückblick auch öffnet, und lässt sich teilen wie jede andere
  Seite.
- Teamer:innen bekommen im Rückblick dieselbe Challenge-Seite wie Konfis:
  wie oft sie selbst mitgemacht haben und bei welcher Challenge am liebsten.
- Der Team-Rückblick zeigt außerdem, wie viele Challenges jemand selbst
  gestellt hat, mit den drei neuesten Titeln — ab drei gestellten.
- JuLeiCa und Teamer-Card werden auf der Zertifikate-Seite des Rückblicks
  eigens genannt.
- Neue Gemeinden starten mit neun Abzeichen für ihr Team. Bisher gab es dort
  nur Abzeichen für Konfis. Das Handbuch nennt die mitgelieferten Abzeichen
  jetzt beim Namen.
- Ein neues Handbuch-Kapitel „Die App bedienen" erklärt, was überall gleich
  funktioniert: nach links wischen zum Löschen, nach unten ziehen zum
  Aktualisieren, der Aufbau der Reiter und was ohne Internet geht.
- Wer bei der Sommerfreizeit 2026 in Stavanger dabei war, findet im
  Rückblick eine eigene Seite dazu — Konfis wie Team. Alle anderen sehen sie
  nicht.
- Der Jahresrückblick erzählt jetzt eine Geschichte statt einer festen Liste:
  Auftakt, Chat, Termine, die eigenen Schwerpunkte, Challenges, Punkte,
  Abzeichen und Abschluss. Wie viele Seiten jemand sieht, hängt davon ab, was
  er im Jahr getan hat — wer viel erlebt hat, bekommt mehr zu sehen; leere
  Seiten mit einer Null darauf gibt es nicht.
- Neue Seiten im Rückblick zeigen die eigenen Schwerpunkte: Fest, Freizeit,
  Jugend, Kinder, Konzert, Kreativ, Seelsorge, Senior:innen,
  Öffentlichkeitsarbeit, Weihnachten, Kasualien, Gottesdienst und Gemeinde.
  Jede Seite hat ihr eigenes Bild und ihren eigenen Ton.
- Besondere Zeiten im Kirchenjahr bekommen eigene Seiten — Advent,
  Weihnachten, der Jahreswechsel, Passion und Ostern, Erntedank und der
  Sommer. Sie richten sich nach dem Datum des Termins, nicht nach seinem
  Namen: Ein Gottesdienst am 24. Dezember ist Heiligabend, ganz gleich wie
  die Kategorie in der Gemeinde heißt.
- Neue Gemeinden starten mit einem erweiterten Satz an Kategorien, der die
  Arbeit vor Ort besser abbildet.
- Abzeichen können jetzt verlangen, dass jemand aus mehreren verschiedenen
  Kategorien dabei war — etwa Konfifahrt, Übernachtung und Sommerfreizeit für
  ein Freizeiten-Abzeichen. Dreimal dasselbe zählt dabei nur einmal.

- Ein Jahrgang kann jetzt mehrere Rückblicke haben. Frühere bleiben
  erhalten, wenn ein neuer dazukommt, und Konfis wie Teamer:innen sehen sie
  alle.
- Der Rückblick fürs Team entsteht ab sofort in jeder Gemeinde von selbst:
  am 6. Januar für das Jahr davor. Von Hand geht es weiterhin — doppelt wird
  er dabei nie angelegt.
- Einzelne Rückblick-Ausgaben lassen sich gezielt löschen, ohne die anderen
  anzurühren.
- Die Leitung sieht im Profil einer Konfi oder Teamer:in alle Rückblicke —
  auch noch nicht freigegebene, um vor der Freigabe hineinzusehen.
- Geänderte Abzeichen werden jetzt automatisch nachträglich vergeben; in der
  Abzeichen-Verwaltung lässt sich die Prüfung für Sonderfälle zusätzlich von
  Hand anstoßen.

- Nach dem Update erklärt ein Hinweis auf der Startseite, was in Version 2.1
  neu ist — für Konfis, Teamer:innen und die Leitung jeweils das, was ihre
  Rolle betrifft. Einmal weggeklickt, kommt er nicht wieder; im Profil bleibt
  er dauerhaft erreichbar.

### Geändert
- Die App startet schneller: Beim Öffnen wird nur noch geladen, was die eigene
  Rolle braucht — Konfis laden die Leitungsoberfläche nicht mehr mit. Die
  restlichen Seiten der eigenen Rolle werden kurz nach dem Start im
  Hintergrund nachgeladen, damit auch ohne Netz alles erreichbar bleibt.
- Beim Senden und Öffnen von Dateien im Chat zeigt die Nachricht jetzt, wie
  weit sie ist — mit Prozentzahl und Balken. Vorher passierte scheinbar
  nichts, besonders bei größeren PDFs.
- Der Senden-Knopf im Chat zeigt einen geraden Pfeil statt des schräg
  liegenden Papierfliegers.
- Android sortiert die Mitteilungen von Konfi Quest jetzt in vier Gruppen:
  Nachrichten, Termine, Punkte und Abzeichen sowie „Anfragen und
  Freigaben". In den
  Einstellungen des Geräts lässt sich damit jede Gruppe einzeln leiser oder
  stumm stellen — der Chat kann hörbar bleiben, während Terminerinnerungen
  still ankommen. Bisher gab es dort nur einen Eintrag „Sonstiges" für alles.
- Der Jahresrückblick hat 30 neue Hintergrundbilder statt bisher 17: Watt,
  Priel, Nordsee, Sturm und Sterne, dazu Lagerfeuer, Wunderkerzen,
  Konzertlichter und ein Sprung von der Klippe. Alle im Hochformat — die
  alten waren querformatig und wurden zur Hälfte abgeschnitten. Bei einem
  Rückblick sieht niemand ein Bild zweimal.
- Auf Android-Geräten war die untere Leiste breiter als der Bildschirm: Der
  erste und der letzte Reiter waren angeschnitten, aus „Material" wurde
  „Materia". Jetzt sind alle fünf vollständig lesbar.
- Auf Android wurden Umschalter wie „Ungelesen", „Verbuchen" und „Vergangen"
  abgeschnitten. Sie stehen jetzt in normaler Schreibweise statt in
  Großbuchstaben und passen damit.
- Der QR-Scanner steht auf der Termin-Seite jetzt oben in der Leiste. Als
  schwebender Knopf unten rechts lag er auf der Terminkarte und verdeckte
  Text.
- Der Zähler über den Challenges hieß „ABZEICHEN", obwohl der Abschnitt
  darunter „Deine Stempel" heißt. Jetzt heißt auch der Zähler „Stempel".
- Die Seite „Hinter den Kulissen" im Team-Rückblick, die freigegebene
  Beiträge zählte, entfällt.
- Das Bild zum Teilen zeigt jetzt das Konfirmationsdatum groß statt der
  Punktzahl, dazu das Konfi-Quest-Logo. Ohne eingetragene Konfirmation
  bleiben Gemeinde und Spruch.
- Beim Team-Rückblick stehen nur noch Jahre zur Wahl, für die es auch Daten
  gibt. Die Auswahl öffnet sich jetzt als Liste von unten, damit der Hinweis
  zum laufenden Jahr lesbar bleibt.
- Konfi-Rückblicke bekommen wieder einen Namen. Er steht in der Liste und auf
  der ersten Folie — hilfreich, sobald es mehrere gibt.
- Der Rückblick meldet sich jetzt bei jeder neuen Ausgabe. Bisher blieb es
  still, wenn für einen Jahrgang ein zweiter Rückblick entstand — niemand
  erfuhr davon.
- Die Mitteilung zum Rückblick heißt jetzt „Deine Konfi-Zeit Wrapped ist da!"
  beziehungsweise „Dein Team-Jahr Wrapped ist da!".
- Die Handbuch-Kapitel haben nummerierte Abschnitte (13.1, 13.1.1) und ein
  eigenes Inhaltsverzeichnis. Bei langen Kapiteln startet es zugeklappt.
- Der Rückblick braucht keine Einstellungen mehr. Für Konfis zählt er immer
  die ganze Konfi-Zeit vom Beginn bis heute, fürs Team immer ein
  Kalenderjahr — gewählt wird nur noch, welches. Namen und Datumsfelder sind
  entfallen: Die Überschrift heißt „Deine Konfi-Zeit" beziehungsweise „Dein
  Teamerjahr" mit der Jahreszahl. Ist die Konfirmation noch mehr als einen
  Monat hin, steht „(bis jetzt)" dabei.
- Das laufende Jahr lässt sich fürs Team erst zurückblicken, wenn es vorbei
  ist. In der Auswahl steht es sichtbar, aber gesperrt, mit dem Hinweis, ab
  wann es geht.
- Das seltenste eigene Abzeichen bekommt seine Seite jetzt sicher, wenn
  höchstens ein Fünftel der anderen es auch hat. Vorher konnte sie
  wegfallen, wenn viele seltene Seiten zusammenkamen.
- Die Seite zur Sommerfreizeit erscheint nur noch in den beiden Gemeinden,
  die mitgefahren sind. Andernorts bleibt der Rückblick allgemein, auch wenn
  dort eine gleichnamige Kategorie geführt wird.
- Der Rückblick endet jetzt mit der Übersicht statt mit der Einladung ins
  Team. Die Einladung steht davor, die Übersicht ganz zuletzt — sie ist die
  Seite, die man weitergibt.
- Die Übersicht am Ende nennt die Kirchengemeinde, die Punkte und den
  Konfirmationstermin, darüber „Dein Weg. Deine Zeit. Dein Glaube.". Das
  geteilte Bild zeigt dasselbe. Ältere Rückblicke kennen den Gemeindenamen
  noch nicht; dort bleibt die Zeile weg, alles andere ist unverändert.
- Die Einladung ins Team lädt jetzt zu einem ersten Schritt ein: „Schreib
  einfach jemandem aus dem Team." Der Pfeil darunter ist weg.
- Die Termin-Seite nennt den zuletzt besuchten Termin nicht mehr — auch nicht
  auf dem geteilten Bild. Sie erzählt, wie oft jemand da war.
- Die Schrift im Rückblick erscheint jetzt nacheinander statt auf einen
  Schlag: erst die Überschrift, dann die Zahl, dann der Spruch Zeile für
  Zeile, zuletzt der Satz darunter. Wer im Gerät „Bewegung reduzieren"
  eingestellt hat, bekommt alles sofort und unbewegt.

- Der Jahresrückblick zeigt jetzt höchstens zehn Seiten statt bis zu neunzehn
  — und ausgewählt werden die seltensten. Wie viele andere im Jahrgang
  dieselbe Seite auch bekommen, entscheidet darüber, wer sie sieht: Wer bei
  etwas dabei war, das nur wenige erlebt haben, bekommt genau dafür eine
  Seite. Auftakt, Abschluss, die eigenen Zahlen und mindestens ein
  Schwerpunkt sind dabei immer dabei. Das gilt für Konfis und fürs Team.

- Der Rückblick einer Konfi umfasst jetzt die ganze Konfi-Zeit — vom Beginn
  bis heute, auch wenn das zwei Jahre sind. Der Konfirmationstermin schneidet
  nichts mehr ab; er wird weiterhin auf der eigenen Seite gezeigt.
- Ein Teamer-Rückblick schließt jetzt lückenlos an den vorigen an: Der erste
  beginnt beim Eintritt ins Team, jeder weitere am Ende des letzten.
- Beim Anlegen eines Rückblicks bleibt der Zeitraum leer und wird automatisch
  bestimmt. Nur für einen Zwischenbericht trägt die Leitung eigene Daten ein;
  ein Hinweis im Formular erklärt beides.
- Statt „Dein Konfi-Jahr 2026" heißt es im Rückblick jetzt „Deine Konfi-Zeit" —
  eine einzelne Jahreszahl passt nicht mehr, wenn der Zeitraum länger ist.
- Die Gruppe heißt in der App jetzt durchgehend „Team“ — in Titeln, Reitern,
  Listen und Hinweisen. Die einzelne Person bleibt „Teamer:in“.
- Gleiche Dinge sehen jetzt überall gleich aus: Gottesdienst, Abzeichen,
  Gemeinde und der Reiter „Mitmachen" trugen je nach Ansicht verschiedene
  Symbole, teils sogar verschiedene Farben. Auch Kopfbereiche und Hinweise
  stehen bei Konfis, Team und Leitung jetzt gleich hoch.
- Challenges haben eine eigene Farbe bekommen und teilen sich das Rot nicht
  mehr mit dem Team-Bereich.
- Zu- und Absage zu einem Termin stehen für das Team jetzt von Anfang an
  nebeneinander. Wer geantwortet hat, sieht nur noch den Gegenknopf —
  „Nicht mehr dabei" nach einer Zusage, „Doch dabei" nach einer Absage.
  Absagen geht jetzt auch, wenn kein Platz mehr frei ist oder man auf der
  Warteliste steht.
- Der Zurück-Pfeil ist feiner gezeichnet und wirkt dadurch leichter.
- Das Rot im Team-Bereich ist durchgehend dunkler statt pink — im Profilkopf
  wie auf der Rückblick-Kachel des Startbildschirms.
- Umlaute stehen in den Rückblick-Seiten und in den vorgeschlagenen Titeln
  jetzt überall richtig.
- Im Team-Profil steht die App-Tour zwischen Bibelübersetzung und
  Medien-Cache und hat wieder Abstand zum Eintrag darüber.
- Der Willkommensrundgang erklärt jetzt zu Beginn noch einmal, was Challenges
  eigentlich sind, und jede Seite trägt die Farbe ihres Bereichs.
- Die Seite für den Jahresrückblick ist aufgebaut wie die übrigen Seiten:
  mit Zurück-Weg, Kennzahlen im Kopf und den gewohnten Listen-Symbolen.
  Gelöscht wird durch Wischen statt über einen Knopf in der Zeile.
- Überschriften in Listen werden nicht mehr früh abgeschnitten, sondern
  laufen aus.
- Links im Material entfernt man jetzt durch Wischen, wie die Dateien
  darunter.
- Die Profile von Konfis und Teamer:innen sind neu sortiert: erst die
  Konfirmation, dann der Rückblick, danach die Listen und zuletzt die
  Abzeichen. Bei übernommenen Teamer:innen stehen Konfispruch und
  Konfirmationstermin jetzt ebenfalls oben, zusammen mit "Teamer:in seit".
- Abzeichen tragen wieder die Farbe ihrer Kategorie statt durchgehend
  Blau. Eine eigens gewählte Farbe bleibt erhalten.
- Der Jahresrückblick steht im Profil jetzt direkt über den Einstellungen.
- Der Hinweis auf einen neuen Jahresrückblick lässt sich auf der Startseite
  wegklicken; im Profil bleibt er erreichbar. Er trägt den Namen, den die
  Gemeinde der Ausgabe gegeben hat.
- Ohne gebuchten Konfirmationstermin steht im Profil keine leere Karte mehr.
- Beim Termin steht die Beschreibung jetzt vor der Zusage — erst lesen,
  worum es geht, dann zusagen.
- Die Zusage-Knöpfe bei einem Termin sitzen jetzt so eng in ihrer Karte wie
  die übrigen Knöpfe der Seite.
- Die Terminliste zeigt jetzt auch Kategorie und Punkteart, nicht mehr nur im
  einzelnen Termin. Bei Pflichtterminen, der Konfirmation und reinen
  Team-Terminen bleibt die Punkteart weg — dort gibt es keine Punkte zu holen.
- Der Rückblick zeigt endlich die tatsächlichen Kategorien der Termine und
  Aktivitäten. Bisher stand dort nur eine grobe Einteilung, weil die
  Auswertung an der falschen Stelle nachsah.
- Der Jahresrückblick ist jetzt persönlich: Direkt nach der Begrüßung zeigt
  eine eigene Seite, was diesen Konfi besonders macht — Chat-Star,
  Reaktions-Magnet, Challenge-Fan oder Fels in der Brandung (nie abgesagt).
  Ausgewählt wird, worin jemand im Vergleich zum eigenen Jahrgang
  heraussticht; der Vergleich bleibt anonym und erscheint nur, wenn er
  freundlich ist. Ein Highlight fürs Absagen gibt es bewusst nicht.
- Fotos aus Challenge-Beiträgen erscheinen im Rückblick größer; bei ein oder
  zwei Beiträgen füllen sie die Seite.
- Die letzte Seite des Rückblicks endet mit „Dein Weg. Deine Zeit. Dein
  Glaube.“ und der Einladung, Teamer:in zu werden.
- Teamer:innen sagen zu Terminen ausdrücklich zu oder ab („Bin dabei" /
  „Bin nicht dabei") und können ihre Antwort jederzeit ändern — auch zurück
  zur Zusage. Ein Grund für die Absage ist freiwillig; wer nach einer Zusage
  absagt, muss einen angeben, damit die Leitung umplanen kann. Bei einer
  Absage wird der Platz frei und die Warteliste rückt nach.
- Die Leitung sieht in der Terminansicht, wer abgesagt hat und warum — eine
  Absage nach vorheriger Zusage ist eigens gekennzeichnet. Die Mitteilung
  über eine Teamer-Absage nennt jetzt auch den Grund.
- Liegt in den Stores eine neuere App-Version, weist die Startseite dezent
  darauf hin. Ein Tipp öffnet die Store-Seite zum Aktualisieren; das X blendet
  den Hinweis für diese Version dauerhaft aus. Nichts wird erzwungen, ohne
  Internet erscheint der Hinweis nicht.
- Wer Material sieht, entscheidet allein die Jahrgangs-Zuordnung: mit
  Jahrgang nur dessen Teamer:innen, ohne Jahrgang alle Teamer:innen der
  Gemeinde. Material für alle steht bei den Teamer:innen in einem eigenen
  Abschnitt ganz oben und ist in der Leitung am Globus zu erkennen. Ein
  eigener Sichtbarkeits-Schalter ist dafür nicht mehr nötig. Konfis sehen
  Material weiterhin grundsätzlich nicht; bestehendes Material bleibt
  sichtbar wie bisher.
- Das Handbuch hat ein neues Kapitel „Rollen und Rechte": Es erklärt Konfis,
  Teamer:innen, Admins und Org-Admins, wer wen anlegen darf und was die
  Jahrgangs-Zuweisung je Rolle bedeutet — samt der Klarstellung, dass auch
  Admins ohne Zuweisung keine Konfis sehen.
- Material trägt Dateien und Links jetzt zusammen — zum Beispiel ein PDF
  und dazu mehrere YouTube-Videos. Beide Bereiche stehen im Formular immer
  offen, nichts muss vorher ausgewählt werden. Teamer:innen erkennen Links
  am Link-Symbol; ein Tipp darauf öffnet sie im Browser.
- Wird ein Challenge-Beitrag im Feed sichtbar, bekommen die Konfis des
  Jahrgangs eine Mitteilung — mit Namen, oder ohne, wenn der Beitrag anonym
  ist. Dabei steht dabei, um was für einen Beitrag es sich handelt.
- Die Leitung lässt sich einem Termin zuordnen — genau wie Teamer:innen, über
  „Leitung hinzufügen" in der Terminansicht. Wer zugeordnet ist, ist auch im
  Chat zum Termin dabei. Das geschieht bewusst für jeden Termin einzeln;
  niemand landet automatisch in einem Termin-Chat, und bestehende Chats
  ändern sich dadurch nicht.

- Material an einem Termin steht für Leitung und Teamer:innen jetzt direkt
  bei den Eckdaten der Detailansicht und ist dort klickbar: Ein einzelnes
  Material öffnet sich sofort, bei mehreren springt die Seite zur
  Materialliste weiter unten — die bleibt unverändert bestehen.
- Der Kopf der Materialseite zählt neben Material und Dateien jetzt auch die
  hinterlegten Links — bei Leitung und Teamer:innen gleichermaßen.
- Die Jahrgangs-Bindung für Admins gilt jetzt auch im Direktchat: Ein Admin
  kann nur noch Konfis seiner zugewiesenen Jahrgänge anschreiben oder in
  Gruppenchats aufnehmen — wie Teamer:innen. Der Org-Admin erreicht
  weiterhin alle Konfis. Bereits bestehende Gespräche bleiben unverändert
  bestehen.
- Die Jahrgangs-Grenze im Chat gilt jetzt in beide Richtungen: Konfis
  erreichen nur noch die Admins und Teamer:innen ihres eigenen Jahrgangs —
  die Leitung (Org-Admin) bleibt für jeden Konfi erreichbar, auch wenn dem
  Jahrgang niemand zugewiesen ist. Die Kontaktliste zeigt nur noch, wer
  auch wirklich anschreibbar ist. Bereits bestehende Gespräche bleiben
  unverändert bestehen.
- Eine Gemeindeleitung, die in mehreren Gemeinden tätig ist, ist jetzt auch
  in ihren weiteren Gemeinden für Konfis im Chat erreichbar — vorher fand
  die Kontaktliste sie dort nicht.
- Material bearbeiten und löschen kann nur noch, wer es angelegt hat — dazu
  gehört auch das Anhängen und Entfernen von Dateien. Die Gemeindeleitung
  darf weiterhin alles, damit Material verwaltbar bleibt, wenn die
  erstellende Person die Gemeinde verlässt. Bei fremdem Material öffnet
  sich die Ansicht schreibgeschützt und nennt, wer es angelegt hat; Anlegen
  von neuem Material geht unverändert für die ganze Leitung.
- Die Jahrgangs-Bindung für Admins greift jetzt überall: Terminliste,
  Konfi-Auswahl im Chat, Material, Jahrgangs-Liste und die Meldungs-Zähler an
  den Reitern und die Zahl am App-Symbol zeigen einem Admin nur noch seine
  zugewiesenen Jahrgänge —
  genau wie die Konfi-Liste schon zuvor. Teamer:innen, Termine ohne Jahrgang,
  Team-Runden und Material „für alle" sieht er weiterhin. Der Org-Admin sieht
  unverändert die ganze Gemeinde.
- Konfis löschen oder befördern, ihr Passwort zurücksetzen, Punkte und
  Aktivitäten zurücknehmen sowie Anwesenheits- und Spruchlisten abrufen geht
  für Admins nur noch in den eigenen Jahrgängen; auch Jahrgänge bearbeiten
  oder löschen und den Jahresrückblick freigeben ist an die eigene Zuweisung
  gebunden.
- Neue Jahrgänge legt nur noch der Org-Admin an — Admins sehen den
  Anlege-Knopf nicht mehr. Dafür wählt der Org-Admin schon beim Anlegen aus,
  welche Admins und Teamer:innen den neuen Jahrgang sehen und bearbeiten
  sollen; die Ausgewählten sind sofort zuständig und im Jahrgangs-Chat. Die
  Auswahl ist freiwillig, zuweisen geht weiterhin auch später über die
  Benutzerverwaltung.
- Beim Befördern eines Konfis zur Teamer:in wird der alte Jahrgang nicht mehr
  automatisch als Zuweisung übernommen. Die frisch beförderte Person hatte
  dadurch sofort vollen Blick auf ihre bisherige Gruppe samt Bearbeitungsrecht
  — jetzt vergibt die Leitung die Zuweisung bewusst, sobald die neue
  Teamer:in aktiv werden soll. Die eigenen Punkte und Abzeichen aus der
  Konfi-Zeit bleiben unverändert sichtbar.
- Die Startseite der Konfis ist schneller da: Die Abzeichen laden erst, wenn
  die Startseite steht, statt den Start mit auszubremsen. Sichtbar bleibt
  alles wie bisher.
- Die Angabe zum Check-in-Fenster bei Terminen ist kürzer: „QR-Code 30 Min.
  (vor/nach Beginn)".
- Mitteilungen zu Chat-Nachrichten sagen jetzt, was ankam: „Foto",
  „Sprachnachricht" oder „Datei" samt Namen, statt nur „Anhang".
- Ist einem Admin oder einer Teamer:in kein Jahrgang zugewiesen, sagen jetzt
  auch die Challenge-Verwaltung und die Aktivitäts-Meldungen den Grund für die
  leere Liste — wie es die Konfi-Liste schon tut. Vorher stand dort „keine
  Challenges" bzw. „keine Aktivitäten", was nach einem Fehler aussah. Ein
  Admin ohne Jahrgang ist weiterhin ausdrücklich erlaubt, etwa wenn er nur
  mit den Teamer:innen arbeitet.
- Auch die Material-Liste nennt jetzt den Grund, wenn sie wegen fehlender
  Jahrgangs-Zuweisung leer bleibt — Material „für alle“ und Material ohne
  Jahrgang bleiben unverändert sichtbar. Vorher stand dort „keine
  Materialien“, was nach einem Fehler aussah.

- Der Hinweis auf eine neue App-Version sieht jetzt aus wie die anderen
  Hinweise auf der Startseite, nur in Blau. Ein Tippen führt weiterhin in
  den Store, das X blendet ihn dauerhaft aus.

### Behoben
- Auf Android fehlte die Anmeldung per Fingerabdruck: Der Schalter ließ sich
  nicht einschalten, das Gerät meldete die Funktion als nicht verfügbar. Sie
  steht jetzt auch auf Android zur Verfügung.
- Wer einen Einladungslink mit Code öffnete, konnte sich nicht registrieren:
  Die Seite flackerte und lud endlos neu. Sie steht jetzt still, und die
  Anmeldung funktioniert.
- Im Team-Rückblick fiel die Seite „Das erste Abzeichen" weg. Sie zeigte fast
  immer das Abzeichen fürs erste Teamer-Jahr — eine Selbstverständlichkeit,
  keine Erinnerung.
- Auf Android kamen bei vielen keine Push-Nachrichten mehr an — weder für
  Chat-Nachrichten noch für Termine. Das Gerät meldete sich beim Anmelden nur
  ein einziges Mal an; ging diese eine Meldung unter, gab es keinen zweiten
  Versuch, und zwar dauerhaft. Auch Neuinstallieren half nicht. Jetzt meldet
  sich die App bei jedem Öffnen neu an. Wer betroffen war, bekommt beim
  nächsten Start wieder Nachrichten.
- Die Konfirmations-Folie nannte die Tage zweimal.
- Das Zurücksetzen des Passworts scheiterte bei Teamer:innen mit „Fehler beim
  Zurücksetzen". Es funktioniert wieder, und wenn doch etwas schiefgeht,
  steht jetzt dort, woran es lag.
- Termine, für die Teamer:innen gesucht werden, tauchen nur noch bei denen
  auf, die den Jahrgang auch betreuen. Vorher standen sie in jeder Liste,
  ließen sich seit dem Fix aber nicht mehr buchen.
- Teamer:innen konnten sich zu Terminen von Jahrgängen anmelden, denen sie
  gar nicht zugewiesen sind. Das gilt jetzt wie im Chat: nur der eigene
  Jahrgang. Termine für das Team allein sind davon ausgenommen.
- Ein Challenge-Beitrag ein zweites Mal freigegeben schickte dem ganzen
  Jahrgang erneut „Neuer Beitrag von …". Die Mitteilung geht jetzt nur noch
  bei der ersten Freigabe raus.
- Ein zweites Mal denselben Team-Rückblick zu erstellen legte eine zweite
  Ausgabe an und schickte dem ganzen Team noch einmal „Dein Teamer-Jahr ist
  da!". Jetzt bleibt es bei einer Ausgabe je Jahr, und die Seite sagt, dass
  nichts geändert wurde.
- Das Handbuch behauptete, ein erneut erstellter Rückblick überschreibe den
  alten und der vorherige Stand sei unwiderruflich weg. Tatsächlich entsteht
  eine zusätzliche Ausgabe, die alte bleibt stehen.
- Das Handbuch riet davon ab, Abzeichen zu deaktivieren — angeblich
  verschwinden sie dann auch bei denen, die sie schon hatten. Das stimmt seit
  Ende August nicht mehr: Verdiente Abzeichen bleiben sichtbar. Deaktivieren
  ist damit der richtige Weg, ein Abzeichen aus dem Verkehr zu ziehen.
- Das Handbuch behauptete, zeitabhängige Abzeichen („Serie", „Zeitbasiert")
  kämen nur bei eingeschalteten Mitteilungen. Das stimmt nicht: Sie werden
  jedem verliehen. Ohne Mitteilungen erfährt man nur später davon.
- Das Handbuch beschreibt jetzt alle fünfzehn Bedingungen für Abzeichen. Die
  „Kategorie-Kombination" fehlte bisher ganz — also gerade die, bei der der
  Wert sagt, aus wie vielen Kategorien jemand dabei gewesen sein muss, und
  nicht wie oft. Dazu eine Übersicht, welche Bedingung wofür taugt.
- Das Handbuch-Kapitel zum Jahresrückblick ist nach Aufgaben geordnet: einen
  Rückblick anlegen, neu berechnen, löschen, wiederfinden, teilen. Dazu waren
  drei Angaben veraltet — der Weg dorthin, der Name des Bereichs im Profil und
  wie gelöscht wird.
- Die Jahrgangs-Verwaltung kündigt keine Rückblick-Freigabe mehr an. Die gibt
  es dort seit der letzten Version nicht mehr — verwaltet wird der Rückblick
  unter „Mehr“. Die Beschriftungen zeigten weiterhin an den alten Ort.
- Termine standen in der Detailansicht der Leitung als „Geschlossen", obwohl
  die Anmeldung offen war. Betroffen waren vor allem Termine ohne
  Anmeldefrist und ohne Teilnehmerbegrenzung; in der Terminliste stand
  derselbe Termin korrekt als offen.
- Bei Terminen nur fürs Team stand der Hinweis, dass Konfis sich bis zwei
  Tage vorher abmelden können — obwohl dort gar keine Konfis teilnehmen.
- Aktivitäten von Teamer:innen ließen sich nicht mehr aus dem Profil
  entfernen — der Versuch endete mit einer Fehlermeldung. Jetzt klappt das
  Löschen wieder.
- Beiträge in einer Challenge-Galerie und Nachrichten im Chat konnten ihre
  Reihenfolge zwischen zwei Aufrufen wechseln, wenn sie in derselben Sekunde
  entstanden waren. Beim Blättern im Chat konnte dadurch eine Nachricht
  doppelt erscheinen oder fehlen.
- Ein Name für einen Rückblick, der zu lang war oder Steuerzeichen enthielt,
  wurde stillschweigend zurechtgeschnitten — bei einem Emoji am Ende blieb
  ein kaputtes Zeichen auf der Folie stehen. Solche Eingaben werden jetzt
  abgelehnt statt heimlich verändert.
- Die Liste der Jahresrückblicke blieb für Admins ohne Jahrgangs-Zuweisung
  leer und riet trotzdem, einen anzulegen. Sie nennt jetzt den Grund, wie es
  die Konfi-, Termin-, Material- und Challenge-Listen schon tun.
- Beim Team-Rückblick wurden Jahre zur Auswahl angeboten, in denen es noch
  gar kein Team gab. Gezählt wurde alles, was in der Gemeinde passiert ist —
  auch reine Konfi-Termine. Jetzt zählt nur, was Teamer:innen betrifft.
- Das Handbuch behauptete, beim Anlegen eines Rückblicks lasse sich nichts
  einstellen und kein Name vergeben. Konfi-Rückblicke bekommen sehr wohl einen
  Namen, der auf der Begrüßungsfolie und in der Liste erscheint.
- Das Handbuch nannte für die Teilen-Karte die gesammelten Punkte. Sie zeigt
  die Konfirmation, nicht die Punktzahl.
- Das Handbuch gab die Überschrift des Team-Rückblicks als „Dein Team-Jahr"
  an. Sie lautet „Dein Teamerjahr", und die genannten Texte der Mitteilungen
  stimmten ebenfalls nicht.
- Das Handbuch behauptete, fremde Rückblicke könne nur die Leitung ansehen.
  Admins können das auch, jeweils in der eigenen Gemeinde.
- Das Handbuch beschrieb den Hinweis auf eine neue Version als Zeile über der
  App. Es ist eine Karte auf der Startseite, und im Browser erscheint sie gar
  nicht.
- Das Handbuch beschrieb den Hinweis auf noch nicht gesendete Vorgänge als
  Balken am unteren Rand. Es ist ein Knopf mit Zähler.
- Das Handbuch beschrieb den Jahresrückblick an mehreren Stellen so, wie er
  einmal war: Es verwies für die Freigabe noch auf den Jahrgang statt auf
  „Mehr → Jahresrückblick", kannte nur einen Rückblick pro Person und Jahr
  statt der Ausgaben, nannte eine Löschabfrage, die es so nicht mehr gibt,
  und beschrieb eine Seite, die im Rückblick gar nicht mehr vorkommt.
  Außerdem stimmten einzelne Angaben nicht: die Termin-Seite zeigt kein „von
  N verfügbaren", die Zertifikats-Seite nur das zuletzt erhaltene Zertifikat,
  „Deine Momente" verlangt keinen Beitrag mit Bild oder Text, und der
  Ersatztext beim Teilen lautet „Meine Konfi-Zeit" statt „Mein Konfi-Jahr".
- Ein Termin zählt im Rückblick nur noch einmal. Ein Gottesdienst in der
  Passionszeit erschien bisher auf der Oster-Seite und zusätzlich auf der
  Gottesdienst-Seite — dieselbe Stunde, zweimal gezählt. Fällt ein Termin in
  eine besondere Zeit des Kirchenjahres, gehört er dieser Seite; sonst seiner
  Kategorie.
- Auf den Seiten zu Advent, Ostern und den anderen besonderen Zeiten stand im
  Spruch eine andere Zahl als in der Zeile darunter — „Dreimal auf dem Weg
  nach Ostern" über „4 Mal". Die Sprüche nennen keine Menge mehr, wenn sie
  eine Spanne meinen; bei genau einem oder genau zwei Malen bleibt es beim
  Zahlwort, dort stimmt es.
- Die Oster-Seite sprach von der Karwoche, zählt aber die ganze Passionszeit
  von Aschermittwoch bis Ostermontag. Sie sagt das jetzt auch so.
- Die Weihnachts-Seite hiess „Heiligabend", zählt aber den 24. bis 26.
  Dezember. Wer nur am ersten Feiertag da war, las dort einen falschen Tag.
- Im Rückblick fürs Team standen Umlaute als Behelfsschreibung auf dem
  Bildschirm — „gaebe", „weiss", „zaehlt", „ausserhalb" — und auf der
  Termin-Seite erschien statt des Mal-Zeichens eine Buchstabenfolge. Alle
  Texte sind jetzt richtig geschrieben.
- Der Rückblick redet nicht mehr vom Jahr, das „noch nicht vorbei" sei. Er
  rechnet über die ganze Konfi-Zeit, und die dauert bei vielen länger als
  ein Jahr. Advent, Erntedank und der Jahreswechsel behalten ihr Jahr — dort
  ist der Kalender gemeint.
- Die Seite „Der lange Atem" erzählt jetzt die Spanne vom ersten bis zum
  letzten Termin, statt dieselbe Terminzahl zu wiederholen, die zwei andere
  Seiten schon nennen.
- Im Rückblick stehen keine gleichlautenden Sprüche mehr auf Seiten, die
  zusammen auftreten können.
- Die Abzeichen-Seite des Rückblicks zählt jetzt alle Abzeichen, die jemand
  besitzt. Vorher zählten nur die, deren Verleihungsdatum im
  Rückblickszeitraum lag — wer fünfzehn hatte, las dort oft „Das erste ist
  das schönste".
- Als erreichbare Abzeichen zählt der Rückblick nur noch die, die es in der
  Gemeinde wirklich zu holen gibt: aktive, und nur die der eigenen Rolle. Die
  Zahl hinter dem Schrägstrich stimmt damit wieder mit der Abzeichen-Ansicht
  überein.
- Der Jahresrückblick entsteht auch dann vollständig, wenn eine einzelne
  Auswertung nicht möglich ist — betroffen ist dann nur die eine Seite, die
  davon lebt, nicht der ganze Rückblick.
- Der Jahresrückblick zeigt keine Seite mehr mit einer Null darauf. Wer im
  Rückblickszeitraum keine Abzeichen, keine Punkte oder keine Termine hat,
  bekommt diese Seite gar nicht erst — statt „0 von 55". Auftakt, Abschluss
  und die Einladung ins Team bleiben, damit immer ein Rückblick entsteht.
- Einzelne Seiten des Jahresrückblicks lassen sich wieder teilen. Bei rund der
  Hälfte der Seiten kam bisher ein leeres, schwarzes Bild heraus — darunter die
  Einladung ins Team, die jede Konfi am Ende bekommt.
- Das geteilte Bild sieht jetzt aus wie die Seite, von der es stammt: mit
  ihrem Hintergrundmotiv, ihrer Farbe und demselben Spruch.
- Wenn das Teilen nicht klappt, sagt die App es jetzt, statt kommentarlos
  nichts zu tun. Während das Bild entsteht, ist das am Knopf zu sehen.
- Im Browser wird eine Seite jetzt wirklich geteilt, wo das Gerät es anbietet —
  bisher landete sie nur im Download-Ordner.
- Der Teamer-Rückblick zeigt, wie viele Challenge-Beiträge jemand
  freigegeben hat — Arbeit, die sonst niemand sieht. Nur die eigene
  Freigabe, nie eine Ablehnungsquote. Für frühere Freigaben lässt sich das
  nicht mehr feststellen.
- Wer im Konfi-Jahr von der Warteliste nachgerückt ist, bekommt dafür eine
  eigene Seite im Rückblick. Für frühere Anmeldungen lässt sich das nicht
  mehr feststellen — dort bleibt die Seite aus.
- Der Teamer-Rückblick zeigt, mit wie vielen anderen zusammen die Jahrgänge
  betreut wurden, und begrüßt alle, die im Rückblicksjahr neu ins Team
  gekommen sind.
- Neue Seiten im Konfi-Rückblick: über welche Spanne jemand dabei war, an
  welchem Wochentag die Termine meist lagen, und auf wie vielen Wegen jemand
  bei Challenges geantwortet hat.
- Bei einer sehr aktiven Konfi konnten am Ende Seiten wegfallen, die sie sich
  erst verdient hatte — das seltenste Abzeichen und die Konfirmation. Sie
  bleiben jetzt erhalten.
- Der Teamer-Rückblick erinnert an den ersten Termin des Jahres und an das
  zuerst verliehene Abzeichen — nicht nur daran, wie viele es wurden.
- Der Teamer-Rückblick zeigt, wie oft jemand im Chat auf andere geantwortet
  hat — die Zuwendung, die sonst in keiner Zahl auftaucht.
- Teamer:innen, die selbst einmal Konfi in ihrer Gemeinde waren, bekommen im
  Rückblick eine eigene Seite dazu — mit dem eigenen Jahrgang.
- Der Rückblick für Teamer:innen zeigt keine leeren Seiten mehr. Bisher kamen
  immer sieben Seiten, auch wenn fünf davon eine Null trugen — wer neu im Team
  ist, bekommt jetzt einen kürzeren Rückblick statt „0 Abzeichen",
  „0 Zertifikate" und „0 Konfis" hintereinander.
- Beim Anlegen eines Rückblicks lässt sich jetzt der Zeitraum angeben, den er
  zählen soll — vorbelegt mit dem laufenden Konfi-Jahr. Bisher stand in der
  Übersicht ein Zeitraum, unter dem Zahlen aus einem anderen standen.
- Bonuspunkte aus früheren Jahren zählen nicht mehr in den aktuellen
  Rückblick.
- Der Rückblick zeigt wieder, in welchem Monat jemand am meisten unterwegs
  war. Die Seite war seit dem Umbau der Reihenfolge aus dem Rückblick
  gefallen; sie erscheint jetzt zwischen Punkten und Abzeichen, sobald in
  dem Monat mindestens zwei Dinge zusammenkamen.
- Im Jahresrückblick blieb eine Seite zwischen den Challenges leer. Sie
  zeigt jetzt, wie oft jemand mitgemacht hat und bei welcher Challenge am
  liebsten. Die angekündigte Chat-Seite gab es nie — die Chat-Zahlen stehen
  weiterhin auf der persönlichen Highlight-Seite.
- Der Rückblick für Teamer:innen zeigt jetzt wirklich das Jahr. Termine,
  Abzeichen und Zertifikate wurden bisher seit dem allerersten Tag gezählt —
  wer seit Jahren dabei ist, sah alles auf einmal unter einer Jahreszahl. Wie
  lange jemand schon im Team ist, bleibt bewusst die Gesamtzeit.
- Beim Material lassen sich wieder Dateien anhängen. Die Auswahl kam nicht an, der Upload passierte still gar nicht.
- Auf der Startseite des Teams stehen unter „Zertifikate" nur noch die
  wirklich erhaltenen. Wer keine hat, sieht den Block gar nicht mehr statt
  einer Reihe leerer Platzhalter; bei einem einzelnen füllt es die Breite.
- Die eigene Absage zeigt in der Terminliste jetzt ein Symbol wie alle
  anderen Zustände, statt den Text auszuschreiben.
- Auf der Material-Seite des Teams ist der überflüssige Zurück-Pfeil
  verschwunden — sie ist ein eigener Reiter.
- Im Jahresrückblick der Leitung sind die Hinweise überarbeitet: Der Satz
  darüber, wer was sieht, ist entfallen, der Hinweis beim Anlegen steht im
  gewohnten Kasten, und die Hinweise auf beiden Reitern sind gleich hoch.
- Beim Öffnen der App bleibt der Bildschirm nicht mehr weiß, wenn zuletzt eine Seite offen war, die es so nicht mehr gibt.
- Abmelden beendet die Sitzung jetzt zuverlässig. Vorher konnte man nach dem Neustart wieder im alten Konto landen, und ein Kontowechsel mischte die Ansichten beider Konten.
- Der Jahresrückblick lässt sich jetzt unter „Mehr → Jahresrückblick"
  verwalten: Ausgaben anlegen, benennen, freigeben und einzeln löschen. Der
  frühere Schalter im Jahrgang ist entfallen — er konnte immer nur einen
  Rückblick abbilden.
- Im Profil einer Konfi oder Teamer:in steht jetzt der Name der Ausgabe
  („Zwischenstand") statt mehrfach derselben Jahreszahl.
- Der Jahresrückblick sieht durchgehend gleich aus: Jede Seite trägt einen
  Spruch statt einer nackten Zahl, hat ein Hintergrundbild und eine eigene
  Farbe. Der Text richtet sich nach dem, was jemand erlebt hat — wer wenig
  dabei war, bekommt einen Satz, der trägt, statt eines mageren Vergleichs.
- Die Seite mit den Challenge-Momenten sieht jetzt aus wie eine Pinnwand:
  Die Beiträge liegen als Polaroids übereinander, leicht schief, mit
  Klebestreifen — statt untereinander in einer Liste.
- Neu ist die Seite zum seltensten Abzeichen: „Das haben nur x %." Die
  Prozentzahl steht groß — sie sagt als einzige Zahl im Rückblick, wie
  besonders etwas ist.
- Die erste Seite trägt den Namen der Ausgabe: „Willkommen zu deinem
  Zwischenstand" statt immer „Konfi-Jahr".
- Ungelesene Nachrichten mit einem Datum in der Zukunft lassen den
  Chat-Zähler nicht mehr stehen.
- Die Ungelesen-Markierung im Chat verschwindet jetzt zuverlässig. Der Zähler
  wurde bisher direkt nach dem Lesen wieder mit dem alten Stand überschrieben,
  weil die App die Zahlen abfragte, bevor der Server das Lesen verbucht hatte.
- Unter „Einstellungen" öffnete „Was ist neu" noch den Rückblick der
  vorherigen Version, obwohl daneben die aktuelle Versionsnummer stand.

- Team-Runden erscheinen jetzt auch dann in der Challenge-Verwaltung, wenn
  der Teamer:in oder dem Admin kein Jahrgang zugewiesen ist. Vorher blieb die
  Liste grundlos leer, obwohl Team-Runden ausdrücklich für das ganze Team
  gedacht sind und sich auch ohne Jahrgang moderieren lassen.
- Das Zurücksetzen von Konfi-Passwörtern trifft nur noch Konfis. Vorher
  konnte über diesen Weg das Passwort jedes Kontos der Gemeinde neu gesetzt
  werden, auch das von Teamer:innen und Leitung.
- Die Tageslosung verhält sich für Konfis und Teamer:innen wieder gleich. Bei
  einer Störung der Losungs-Quelle griff nur auf einer der beiden Seiten der
  Rückfall auf den zuletzt geladenen Vers.
- Nach einem Passwortwechsel oder Passwort-Reset bekommen abgemeldete Geräte
  keine Mitteilungen mehr für das Konto. Bisher liefen Push-Nachrichten —
  auch Chat-Inhalte — dort unbegrenzt weiter, obwohl die Sitzung beendet war;
  das eigene Gerät ist beim Passwortwechsel nicht betroffen. Auch wer sich
  lange nicht anmeldet, bekommt nach Ablauf der Sitzung keine Mitteilungen
  mehr aufs Gerät.
- Wer einen bereits freigegebenen Jahresrückblick noch einmal erzeugt — etwa
  um eine Zahl richtigzustellen —, benachrichtigt den Jahrgang nicht ein
  zweites Mal. Beim ersten Freigeben kommt die Mitteilung wie bisher.
- Der Jahresrückblick der Teamer:innen lässt sich wieder entfernen. Bisher
  blieb er nach dem Erzeugen dauerhaft stehen, auch wenn er fehlerhafte Zahlen
  enthielt.
- Beim Wechsel von einem Termin zum nächsten standen kurz noch die
  Teilnehmer:innen und Abmeldungen des vorherigen Termins — ohne Verbindung
  blieben sie sogar dauerhaft stehen. Jetzt zeigt jeder Termin von Anfang an
  nur seine eigenen Daten.
- Uhrzeiten in Mitteilungen und E-Mails stimmen wieder. Erinnerungen,
  Terminabsagen und Änderungshinweise nannten die Zeit zwei Stunden zu früh —
  eine Konfirmation um 10 Uhr wurde als „08:00" angekündigt. Auch das Datum in
  der Absage eines Termins stimmt jetzt: Bei einem Termin kurz nach Mitternacht
  stand dort der Vortag.
- Die Tageslosung wechselt wieder um Mitternacht statt erst am frühen Morgen —
  jetzt auch in der Anzeige, nicht nur im Hintergrund.
- Termine am selben Tag stehen als „Heute" statt fälschlich als „Morgen". Ein
  Termin am Abend wurde bisher schon auf den nächsten Tag gerechnet. Dasselbe
  galt für Restlaufzeiten: Ein Einladungscode, der noch heute abläuft, stand
  als „Läuft morgen ab" da, und auch die Anzeige der Testphase zählte einen
  Tag zu viel.
- Im Jahresrückblick der Teamer:innen erschien die Seite „Dein Engagement"
  auch ohne hinterlegtes Eintrittsdatum — mit „0 Jahre als Teamer:in". Sie
  wird jetzt nur noch gezeigt, wenn das Datum bekannt ist.
- Der Zeitpunkt im Kopf eines Chat-Exports stimmt: Er stand zwei Stunden zu
  früh, während die Nachrichten darunter richtig waren.
- Punkte und Anträge, die spätnachts eingetragen werden, tragen jetzt das
  richtige Datum — die von Konfis wie die von Teamer:innen. Bisher landeten sie
  zwischen Mitternacht und zwei Uhr im Vortag — und damit im falschen Tag der
  Punkte-Historie und des Rückblicks.
- Abmeldezeiten in der Teilnehmerliste stimmen wieder. Wer sich um 12:34
  abgemeldet hatte, stand dort mit 14:34.
- Mehrtägige Termine bleiben während sie laufen in der Terminliste und auf der
  Startseite der Konfis. Bisher verschwand ausgerechnet die Freizeit, an der
  man gerade teilnahm, ab dem zweiten Tag aus der Liste, obwohl die Kachel sie
  noch als laufend auswies.
- Plätze bei Terminen wurden teilweise falsch gezählt. Gelöschte Konten
  belegten weiterhin einen Platz und hielten ihn sogar besetzt, wenn jemand
  absagte — Wartende rückten dann nicht nach. Wer aus der Leitung einem
  Termin zugeordnet war, zählte gegen die Plätze der Konfis statt gegen die
  des Teams. Beides ist korrigiert; Termine, die deshalb zu früh als
  ausgebucht galten, haben ihre freien Plätze zurück.
- Bei Terminen mit Zeitfenstern konnte es passieren, dass zwei Konfis
  gleichzeitig den letzten Platz eines Zeitfensters bekamen. Jetzt bekommt
  ihn genau eine, die andere landet auf der Warteliste oder wird abgewiesen.
- Eine Anmeldung zu einem abgesagten Termin ist jetzt auf allen Wegen
  ausgeschlossen. Über einen der beiden Wege war sie bisher noch möglich.
- Ein Antrag von Teamer:innen konnte mit einer Fehlermeldung enden, obwohl er
  längst eingereicht war: Brach die Verbindung ab und versuchte es die App
  erneut, kam beim zweiten Versuch ein Fehler statt des bereits gestellten
  Antrags. Jetzt zeigt die App in diesem Fall den vorhandenen Antrag — wie es
  bei Konfis schon immer war.
- Im Punkte-Verlauf der Teamer:innen wird der Punktestand jetzt sicher auf die
  eigene Gemeinde begrenzt. Angezeigte Punkte ändern sich dadurch nicht.
- Sicherheitslücke geschlossen: In der Terminliste der Konfis wurde der
  Check-in-Code jedes Termins mitgeliefert. Damit hätte man sich von zu Hause
  als anwesend eintragen und Punkte gutschreiben können, ohne dagewesen zu
  sein. Der Code verlässt den Server jetzt nicht mehr.
- Beim Zuweisen von Jahrgängen bot die App einem Admin auch Jahrgänge an, für
  die er gar nicht zuständig ist — beim Speichern kam dann eine Fehlermeldung.
  Die Auswahl zeigt jetzt nur die eigenen Jahrgänge. Wer selbst keinen
  zugewiesen hat, sieht das jetzt im Klartext statt „keine verfügbar".
- Ein Admin konnte Konfis Punkte geben, Bonuspunkte vergeben und ihre Anträge
  genehmigen, zurücksetzen oder löschen, auch wenn sie zu einem Jahrgang
  gehörten, für den er gar nicht zuständig ist. Das ist jetzt auf seine
  eigenen Jahrgänge begrenzt. In der Antragsliste sieht er nur noch Anträge
  aus seinen Jahrgängen, und die Nachweisfotos fremder Konfis bleiben ihm
  verschlossen. Der Org-Admin darf weiterhin alles; Anträge und Aktivitäten
  von Teamer:innen bleiben für die ganze Leitung sichtbar.
- Ein Admin konnte Konfis in Jahrgängen anlegen und in Jahrgänge verschieben,
  für die er gar nicht zuständig ist — und sah sie danach nicht mehr, weil
  seine Liste nur die eigenen Jahrgänge zeigt. Anlegen und Verschieben sind
  jetzt auf die eigenen Jahrgänge begrenzt. Der Org-Admin darf weiterhin
  alles.
- Wies ein Admin einer Teamer:in einen Jahrgang zu, verlor sie dabei still
  alle Jahrgänge, für die dieser Admin nicht zuständig ist. Zuweisungen
  fremder Jahrgänge bleiben jetzt erhalten; ein Admin ändert nur seine
  eigenen. Der Org-Admin verwaltet weiterhin alle.
- Eine frisch gegebene oder entzogene Jahrgangs-Zuweisung wirkte bis zu eine
  halbe Minute lang nicht. Sie greift jetzt sofort.
- Ein Admin sah und bearbeitete Challenges aller Jahrgänge — auch derer, für
  die er nicht zuständig ist, samt Beiträgen der Konfis. Challenges,
  Beiträge und deren Moderation richten sich jetzt nach seinen Jahrgängen. Der
  Org-Admin sieht weiterhin alles, Challenges für das ganze Team bleiben für
  die gesamte Leitung sichtbar.
- In der Leitung konnte man den Knopf „Neue Teamer:in anlegen" zwar antippen,
  das Formular blieb aber ohne Auswahl und liess sich nicht abschicken.
  Teamer:innen anlegen und ihnen Jahrgänge geben klappt jetzt für die ganze
  Leitung. Personen mit mehr Rechten bleiben unangetastet: Wer sie bisher nicht
  bearbeiten durfte, kann auch ihre Jahrgänge nicht ändern.
- Trug die Leitung sich selbst oder eine andere Person aus der Leitung in einen
  Termin ein, belegte sie einen Platz der Konfis und tauchte in deren Liste
  auf. Bei Terminen nur für Teamer:innen wurde sie ganz abgewiesen. Die Leitung
  zählt jetzt zum Team.
- In der Material-Übersicht der Teamer:innen lieferte der Jahrgangs-Filter
  immer eine leere Liste. Er zeigt jetzt das Material des gewählten Jahrgangs.
- Beim Bearbeiten einer Konfi stand beim Jahrgang "Keine Jahrgänge verfügbar",
  obwohl es welche gibt. Die Auswahl ist wieder da, und der Jahrgang der Konfi
  bleibt sichtbar und vorausgewählt — auch ohne Verbindung.
- Beim ersten Aufruf einer Seite blieb sie weiß; erst beim zweiten Anlauf
  erschien der Inhalt. Betraf jede Seite, auch Detailansichten und Chaträume.
- Öffnete man einen Chat über eine Push-Nachricht, war der Zurück-Knopf ohne
  Funktion — man kam aus dem Raum nicht mehr heraus. Das galt auch für
  Termine und Konfi-Profile, die über eine Benachrichtigung geöffnet wurden.
- Beim Ansehen von Foto-Nachweisen (bei Meldungen und in der Antragsprüfung
  der Leitung) wurde der Bildspeicher nie wieder freigegeben — er wuchs mit
  jedem angesehenen Foto, bis die App neu gestartet wurde.
- Wechselte man von einer Meldung mit Foto zu einer ohne, blieb das Foto der
  vorherigen Meldung stehen.
- Beim Wechsel auf das Teamer-Segment in der Konfi-Verwaltung stand während
  des Ladens fälschlich "Noch keine Teamer:innen vorhanden". Jetzt dreht sich
  dort ein Ladekreis, bis die Liste da ist.
- Bei einer beendeten Challenge ohne eigenen Beitrag riet die App, "oben auf
  das Plus" zu tippen — den Knopf gibt es bei beendeten Challenges gar nicht.
  Jetzt steht dort, dass die Challenge beendet ist.
- Wurde eine Challenge im geöffneten Beitrags-Fenster auf "nur Leitung"
  umgestellt, blieb die Kachel "Abgelehnt" stehen, obwohl es dann keine
  Gruppen-Galerie mehr gibt. Die Kachelleiste folgt jetzt der Sichtbarkeit.
- Beim Löschen eines Termins, der zu einer Serie gehört, fragt die App wieder
  zuverlässig nach, ob nur dieser oder die ganze Serie gelöscht werden soll.
- Bei den Bonuspunkten einer Konfi steht jetzt der Name der Person, die sie
  vergeben hat. Bisher stand dort immer nur „Admin".
- Bei den Aktivitäten einer Konfi steht jetzt der Name der Person, die sie
  eingetragen hat. Bisher blieb die Zeile dort leer.
- Wer etwas eingetragen oder vergeben hat, steht in der Konfi-Ansicht der
  Leitung jetzt überall mit einem Personen-Symbol davor — bei Aktivitäten,
  Bonuspunkten und Terminen gleich.
- Nach dem Anlegen einer Konfi steht im Passwort-Hinweis wieder ihr Name.
  Bisher stand dort „Konfi "undefined" erstellt".

- Ein geöffneter Chat gilt jetzt zuverlässig als gelesen: Die Zahl am Chat
  verschwindet sofort, und nach einem Neustart der App sind weder die Zahl
  noch der rote Strich „Neue Nachrichten" wieder da.
- Abzeichen zeigen wieder ihr eigenes Symbol. Rund 40 Prozent von ihnen
  erschienen überall als Pokal — im Jahresrückblick, in der Abzeichen-Liste
  und in der Verwaltung.
- Die Seiten des Jahresrückblicks haben jetzt tatsächlich Bilder im
  Hintergrund.
- Die Leitung kann den Jahresrückblick einer Teamer:in jetzt auch ansehen —
  bisher ging das nur bei Konfis, obwohl die Berechtigung dafür längst
  bestand. In der Personenansicht stehen alle Rückblicke mit ihrem Jahr
  untereinander.
- Beim Löschen der Teamer-Rückblicke lässt sich jetzt ein einzelnes Jahr
  auswählen. Vorher verschwanden immer alle Jahre auf einmal, sodass beim
  nächsten Erzeugen die gesamte Historie weg gewesen wäre.

### Sonstiges
- Gelegentlich fehlschlagende Tests im Entwicklungsbetrieb behoben. Für
  Nutzer:innen ändert sich nichts.
- Sicherheitsmeldungen zu verwendeten Fremdbibliotheken abgearbeitet.
- Die Testumgebung rechnet jetzt in derselben Zeitzone wie der Betrieb. Zuvor
  schlugen die Prüfungen der Termin-Erinnerungen zwischen Mitternacht und
  zwei Uhr fehl, obwohl die Erinnerungen selbst korrekt verschickt wurden.
- Die Prüfung der Tab-Leiste im Team-Bereich folgt wieder der tatsächlichen
  Reihenfolge. Sie blockierte sonst die Auslieferung.
- Zwei Konfigurationsdateien der Entwicklungsumgebung sind nicht mehr Teil des
  Projekts. Für Nutzer:innen ändert sich nichts.
- Die Regeln für die Mitarbeit am Projekt stehen jetzt im Projekt selbst.

## [2.1.0] - 2026-08-29

iOS-Build 151

### Hinzugefügt
- Wartende Vorgänge sind jetzt überall in der App sichtbar: Solange etwas ohne
  Netz eingetragen wurde und noch nicht gesendet ist, steht unten ein Hinweis,
  der antippbar die offenen Vorgänge zeigt. Bisher gab es das nur bei den
  Anträgen; Abmeldungen, Buchungen und alle Aktionen der Leitung liefen
  unsichtbar.
- Was endgültig nicht gesendet werden konnte, bleibt sichtbar, bis man es zur
  Kenntnis genommen hat. Bisher verschwand die Meldung nach vier Sekunden — wer
  gerade nicht hinsah, erfuhr nie davon.
- Beim Wählen des Konfispruchs steht jetzt der Wortlaut da — in Luther 2017
  und in der Gute Nachricht Bibel. Bisher sah man nur die Stellenangabe und
  den Hinweis, der Text werde noch ergänzt. Für die Bibel in gerechter Sprache
  und die Elberfelder steht das noch aus.

### Geändert
- Der Hinweis auf noch nicht gesendete Vorgänge ist jetzt ein kleiner Knopf
  mit Zähler statt eines breiten Balkens quer über den Bildschirm. Antippen
  zeigt wie bisher, was aussteht; was endgültig nicht gesendet werden konnte,
  bleibt rot und damit deutlich sichtbar.
- In der Leitungssicht heißt ein verbuchter Antrag jetzt **Verbucht** statt
  „Genehmigt" — dasselbe Wort wie bei den Terminen. Es sagt, was passiert ist:
  Die Punkte sind gutgeschrieben.
- Tippt man im Teamer-Bereich ein noch nicht erreichtes Abzeichen an, steht
  jetzt sein Name da statt „???" — man sieht, was es zu holen gibt. Bei Konfis
  war das schon so. Wirklich geheime Abzeichen bleiben weiterhin verdeckt.
- Die automatisch vergebenen Passwörter sind jetzt echte Bibelstellen: Wer
  `Rut4,17` bekommt, kann den Vers aufschlagen. Bisher wurden Kapitel und Vers
  blind gewürfelt, unabhängig vom Buch — dabei entstanden auch Angaben, die es
  gar nicht gibt. Bücher mit Ordnungszahl sind jetzt vollständig dabei
  (`1Korinther13,4`), und kein Passwort ist mehr zu kurz für die eigenen
  Vorgaben.
- Bei abgesagten Terminen zählte die Teilnehmerzahl bisher Konfis und
  Teamer:innen zusammen, während dieselbe Zahl überall sonst nur Konfis meint.
  Jetzt ist sie überall gleich zu lesen; die Teamer:innen stehen daneben.
- Die Abzeichen-Zahlen im Teamer-Bereich („x von y", „x Geheimnisse") zählen
  jetzt genauso wie bei den Konfis: Abgeschaltete und nicht erreichbare
  Abzeichen blähen die Ziele nicht mehr auf, und Dashboard und Abzeichen-Seite
  zeigen dieselben Zahlen.

### Behoben
- Von einem Termin abmelden geht jetzt auch ohne Verbindung — die Abmeldung
  wird gesendet, sobald wieder Netz da ist. Bisher war der Knopf ausgegraut,
  obwohl die Warteschlange das längst konnte. Anmelden bleibt online-pflichtig,
  weil die Plätze begrenzt sind.
- Ohne Verbindung sagt die App jetzt, was fehlt: Wo Teilnehmerliste,
  Zeitfenster oder Punkte-Historie nicht geladen werden konnten, steht ein
  Hinweis. Bisher verschwanden diese Abschnitte wortlos — man konnte nicht
  erkennen, ob es nichts gibt oder nur nichts geladen wurde.
- Tippt die Leitung ohne Verbindung auf Anwesenheit, Teilnehmer entfernen
  oder Chat anlegen, kommt jetzt eine Meldung. Bisher passierte kommentarlos
  nichts.
- Ausgegraute Knöpfe sagen jetzt beim Berühren, warum sie nicht gehen.
- Teamer:innen wurden direkt nach dem Anmelden wieder herausgeworfen. Ursache
  war eine Änderung an den Abzeichen-Daten, mit der die veröffentlichte App
  nichts anfangen konnte. Rückgängig gemacht; die App läuft wieder.
- Öffnet die Leitung ohne Verbindung eine Person aus der Konfi-Liste, stehen
  jetzt Name und Punktestand da statt einer roten Fehlermeldung. Punkte-
  Historie und Anwesenheit brauchen weiterhin eine Verbindung.
- Öffnet die Leitung ohne Verbindung einen Termin, steht jetzt der Termin da
  statt einer roten Fehlermeldung ohne Titel. Teilnehmerliste und Abmeldungen
  bleiben dabei leer — die brauchen eine Verbindung.
- Wird ein Chat-Raum gelöscht, verschwinden jetzt auch die darin geteilten
  Bilder und Dateien zuverlässig. Je nachdem, wo die Uploads liegen, blieben
  sie bisher auf dem Server zurück, obwohl der Raum weg war.
- Abmelden entfernt den Push-Token jetzt auch dann, wenn man gerade in einer
  zweiten Gemeinde angemeldet ist. Vorher blieb er stehen und das Gerät bekam
  weiter Mitteilungen für das abgemeldete Konto.
- Abstimmen in Umfragen folgt derselben Regel wie der übrige Chat: Die Leitung
  kann jetzt auch in ihrer eigenen Umfrage in einem Gruppenchat abstimmen, in
  dem sie nicht als Mitglied eingetragen ist. Fremde Zweiergespräche bleiben
  weiterhin zu.
- Gesperrte und gelöschte Konten bekommen keine Mitteilungen mehr. Wer aus dem
  Team ausgeschieden war, wurde bisher weiter über neue Anträge und Termine
  informiert.
- Wer die App länger nicht öffnet, bekommt danach wieder Mitteilungen. Bisher
  endete die Zustellung nach 30 Tagen Pause stillschweigend.
- Die Antragsliste lässt sich jetzt nach offen, verbucht oder abgelehnt
  abfragen. Bisher kam immer alles zurück, egal was angefragt war.
- Eine offline abgegebene Abmeldung oder Stornierung wird nicht mehr als
  fehlgeschlagen gemeldet, wenn sie in Wahrheit angekommen war. Bisher konnte
  eine erfolgreiche Abmeldung als Fehler in der Liste stehen.
- Eine ohne Netz abgegebene Stimme in einer Umfrage und eine Reaktion im Chat
  scheitern nicht mehr stillschweigend. Bisher wurde die Stimme angezeigt, kam
  aber womöglich nie an, und beim nächsten Laden war sie kommentarlos weg.
- Terminlisten zählen Buchungen gelöschter Konten nicht mehr mit. Die Zahl in
  der Liste konnte dadurch höher liegen als die Teilnehmerliste lang war.
- Bei Terminserien über eine Monatsgrenze hinweg öffnete die Anmeldung erst
  nach dem Termin — niemand konnte sich anmelden. Betroffen war jeder Termin
  einer solchen Serie.
- Wird jemand von einem Termin entfernt oder auf die Warteliste gesetzt, kann
  der Punktestand nicht mehr halb verändert zurückbleiben. Bricht etwas ab,
  wird alles rückgängig gemacht statt ein Teil stehenzulassen.
- Meldet sich jemand ab, während gleichzeitig jemand anders bucht, kann der
  Termin nicht mehr überbelegt werden.
- Beim Teilen einer Chat-Nachricht wird sicher die angetippte Nachricht
  geteilt.

### Sonstiges
- Ungenutzte Reste aus der Aufteilung der Chat-Ansicht entfernt.

## [2.0.0] - 2026-08-27

**Neu ist vor allem eins: Challenges.** Alles andere in dieser Liste sind
Verbesserungen und Fehlerbehebungen an dem, was es schon gab — viele davon
unter der Haube: kürzere Ladezeiten, zusammengelegte Ansichten, deutlich
weniger Abfragen. Zwei gemessene Beispiele: Die Tageslosung braucht statt
7 Sekunden noch 4,5 Millisekunden, die Zähler der Organisationsübersicht
statt 198 Millisekunden noch 0,9.

Diese Version setzt iPhone und iPad mit iOS 16.4 oder neuer voraus. Auf
älteren Geräten bleibt die zuletzt installierte Version nutzbar.

### Hinzugefügt
- Name und Jahrgang einer Konfi lassen sich jetzt nachträglich ändern — bisher
  ging das nach dem Anlegen gar nicht mehr, ein Tippfehler blieb stehen. Beim
  Jahrgangswechsel steht vorher, was er bewirkt: Anmeldungen zu künftigen
  Terminen des alten Jahrgangs fallen weg, Pflichttermine des neuen kommen
  dazu, der Jahrgangs-Chat wechselt mit. Erfasste Anwesenheiten und vergangene
  Termine bleiben unberührt.

- Team-Chat leeren: Die Leitung kann über das Mülleimer-Symbol oben im
  Team-Chat alle Nachrichten samt Dateien endgültig löschen — nach klarer
  Rückfrage; der Chat selbst und seine Mitglieder bleiben bestehen.
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
  ihren Bedingungen. Das Einladen per QR-Code und der Check-in per QR-Code sind
  jetzt vollständig beschrieben — mit Zeitfenster, Zähler und dem, was ein Scan
  sofort auslöst. Die Kapitel verweisen untereinander, sodass man von einem
  Thema zum nächsten springen kann, und zeigen Bildschirmfotos aus der App.
- Chat-Verlauf exportieren: Die Leitung kann einen kompletten Chat als
  Textdatei sichern — etwa um Beiträge für einen Gottesdienst zu sammeln.
  Zu finden über das Menü oben rechts im Chat.
- **Challenges** — der große neue Bereich dieser Version. Aufgaben, auf die
  Konfis über einen frei gewählten Zeitraum mit eigenen Beiträgen antworten:
  Foto, Text, Aufnahme oder Link. Bewusst **ohne Punkte, ohne Zähler und ohne
  Rangliste** — fürs Mitmachen gibt es einen Stempel.
  - **Anlegen:** Jahrgänge, Zeitraum, erlaubte Medienarten, Sichtbarkeit und
    Freigabe werden beim Erstellen festgelegt. Nach dem Start bleiben
    Sichtbarkeit und Freigabe unveränderlich — die Zusage an die Konfis gilt.
    Entwürfe brauchen noch kein Datum und stehen im Reiter "Geplant".
  - **Sichtbarkeit:** Konfis entscheiden je Beitrag, ob er mit Namen, anonym
    oder nur für die Leitung sichtbar ist. Im Kopf der Challenge steht
    ausdrücklich, was gilt.
  - **Wer mitmacht:** Teamer:innen und Leitung nehmen selbst teil; es gibt
    auch Runden nur fürs Team und Runden nur für Konfis.
  - **Moderation:** Die Leitung kann Beiträge freigeben, anonym stellen,
    ausblenden (umkehrbar, auf Wunsch mit Begründung an die einreichende
    Person) oder endgültig löschen — samt Datei, nach deutlicher Rückfrage.
  - **Aufbau:** Für alle gleich — Reiter für Aktuelles und Archiv, die
    Leitung sieht zusätzlich "Geplant". Die Zahlen über der Liste springen
    zum jeweiligen Reiter. Laufende Challenges erscheinen auch auf der
    Startseite von Konfis und Teamer:innen.
  - **Link-Beiträge** nehmen Musik-Links von Spotify, Apple Music und
    YouTube Music an und zeigen nur die Seite statt der vollen Adresse.
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

- Die Leitung kann den Jahresrückblick einer Konfi jetzt auf deren Profilseite
  ansehen — denselben, den die Konfi selbst sieht. Er erscheint erst, wenn der
  Rückblick für den Jahrgang freigegeben wurde.

- Teamer:innen können bei Terminen jetzt ausdrücklich absagen: "Ich bin dabei"
  und "Ich bin nicht dabei" stehen nebeneinander. Eine Absage ist damit eine
  Rückmeldung und nicht mehr dasselbe wie Schweigen — die Leitung sieht sie in
  der Teamer-Liste und muss nicht nachfragen. Eine Begründung ist freiwillig,
  und die Zusage lässt sich jederzeit ändern.

- Konfis und Teamer:innen kommen jetzt direkt aus dem Termin in den Termin-Chat,
  statt ihn in der Chat-Übersicht suchen zu müssen. Der Einstieg erscheint nur,
  wenn es einen Chat gibt und man darin ist.

- Das Check-in-Fenster steht jetzt im Termin — bisher ließ es sich einstellen,
  aber nirgends nachlesen. Alle drei Ansichten zeigen, wie lange vor und nach
  Beginn der QR-Code gilt.

- Termine aus einer Reihe sind jetzt auch für Konfis und Teamer:innen als solche
  erkennbar.

- Teamer:innen sehen im Termin jetzt den Anmeldezeitraum, wie Leitung und Konfis
  schon vorher.

### Geändert

- Was es fürs Mitmachen bei einer Challenge gibt, heißt jetzt **Stempel** statt
  Abzeichen. Der alte Name versprach etwas zum Sammeln — genau das ist es
  nicht: Es geht nicht um Punkte oder Ranglisten, sondern darum, dabei gewesen
  zu sein. Abzeichen bleiben Abzeichen; die sammelt man weiterhin.

- Die Leitung kann Teamer:innen jetzt anlegen, bearbeiten und löschen — bisher
  konnten das nur Org-Admins, obwohl die App den Weg allen anbot. Org-Admins
  selbst lassen sich weiterhin nur von anderen Org-Admins verwalten.
- Zertifikate anlegen, ändern und vergeben ist jetzt Sache der ganzen Leitung
  statt nur der Org-Admins.
- Nach dem Update begrüßt die Startseite mit einer Karte "Was ist neu in
  Version 2.0?": Antippen öffnet den Überblick über die Neuerungen, das X
  blendet sie dauerhaft aus. Der Überblick springt nicht mehr von selbst auf
  und bleibt über "Was ist neu?" im Profil jederzeit erreichbar.

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
- Challenges: In der geöffneten Challenge gibt es oben einen Bearbeiten-Knopf —
  bisher ging Bearbeiten nur über das Wischen in der Liste.
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

- Die App bleibt jetzt stabil, wenn eine Live-Verbindung fehlschlägt. Bisher
  konnte ein abgebrochener Verbindungsversuch den Server kurz aus dem Tritt
  bringen — für alle gleichzeitig, mit einer kurzen Unterbrechung.
- Benachrichtigungen führen beim Antippen jetzt überall an die richtige
  Stelle. Bei zehn Arten — darunter geänderte Termine, Pflichttermine,
  Stempel und Zertifikate — öffnete sich die App bisher einfach dort, wo sie
  zuletzt stand. Teamer:innen landen bei Anträgen und Abzeichen jetzt direkt
  auf der jeweiligen Seite statt eine Ebene darüber.
- Die Zahl am App-Symbol stimmt jetzt. Sie zeigt alles Offene zusammen —
  bisher überschrieb eine neue Chat-Nachricht die Anzahl der Anträge, Termine
  und Abzeichen, andere Benachrichtigungen setzten sie auf eins, und wenig
  später fiel sie wieder auf die reinen Chat-Nachrichten zurück. Sie wird
  außerdem wieder auf null zurückgesetzt, wenn nichts mehr offen ist (auf
  Android blieb sie sonst oft stehen), und auch für das Hauptamt im
  Hintergrund nachgeführt statt erst beim Öffnen der App.
- Wer aus einer Gemeinde ausgeschieden ist, bekommt von ihr keine Hinweise
  auf neue Termine mehr.
- Für Teamer:innen in mehreren Gemeinden führen Abzeichen- und
  Antragsmeldungen jetzt in die Gemeinde, um die es geht — bisher konnte die
  App dabei in die falsche wechseln.
- Wenn eine offline gestartete Aktion später vom Server abgelehnt wird, geht
  der Hinweis darauf nicht mehr verloren. Bisher gab es nur eine kurze
  Meldung, die man verpasste, sobald die App im Hintergrund nachreichte.
- Die Buchung eines Termins braucht für Teamer:innen jetzt eine Verbindung.
  Offline ließ sie sich zwar auslösen, aber niemand erfuhr, ob daraus ein
  Platz oder die Warteliste wurde. Zu- und Absagen gehen weiterhin offline.
- Abgesagte Termine erinnern nicht mehr. Bisher kam nach der Nachricht
  "Der Termin wurde abgesagt" am Vortag trotzdem noch "Morgen: Event!" und
  eine Stunde vorher "Gleich: Event!". Auch die Leitung wird nicht mehr
  aufgefordert, die Teilnahme an einem abgesagten Termin nachzuverbuchen.
- Teamer:innen können jetzt auch im Chat auf Nachrichten reagieren. Der
  Reaktionsknopf war für sie sichtbar, das Antippen blieb aber wirkungslos —
  die Reaktion wurde nie gespeichert. Für die Leitung und für Konfis hat es
  von Anfang an funktioniert.
- Die Leitung sieht auf ihrer Startseite jetzt beide Neuerungs-Karten — auch
  den Hinweis zum Mitmachen-Bereich, den bisher nur Konfis und Teamer:innen
  dort hatten. Beide lassen sich wie gewohnt wegklicken und stehen dauerhaft
  unter "Mehr".
- Challenges: Die Kachel über der Beitragsliste zeigt bei genau einem Beitrag
  wieder "Beitrag" statt "Beiträge".

- Beim Jahrgangswechsel bleibt keine Anmeldung mehr für einen Termin liegen,
  den die Konfi gar nicht mehr sieht. Bisher belegte sie dort weiter einen
  Platz, auf den niemand nachrücken konnte.
- Sicherheit: Beim Ändern eines Konfi-Datensatzes wird der Jahrgang jetzt
  gegen die eigene Gemeinde geprüft. Über die App war das nie möglich, der
  Weg dorthin stand aber offen.

- Ist einer Leitungsperson noch kein Jahrgang zugewiesen, sagt die leere
  Konfi-Liste das jetzt auch. Bisher stand dort "Noch keine Konfis angelegt",
  obwohl es Konfis gibt.

- Die Abzeichen-Seite der Teamer:innen bleibt auch dann heil, wenn bei einem
  einzelnen Abzeichen die hinterlegte Bedingung beschädigt ist. Bisher konnte
  ein einziger solcher Eintrag die ganze Seite unbenutzbar machen.

- Teamer:innen sehen keine Abzeichen mehr, die niemand erreichen kann, weil
  ihnen die Bedingung fehlt — so wie Konfis das schon länger nicht tun.

- Die Zahl der geheimen Abzeichen bedeutet jetzt in beiden Ansichten dasselbe:
  wie viele es noch zu entdecken gibt. Bei Teamer:innen zählten abgeschaltete
  Abzeichen mit.

- Die Abzeichen-Zahl auf der Konfi-Startseite nennt jetzt ein Ziel, das sich
  auch erreichen lässt. Abzeichen, die niemand bekommen kann, zählten bisher
  mit — dann stand dort etwa "3 von 10", obwohl es nur acht zu holen gab.

- Der Einstieg zum Jahresrückblick erscheint nur noch, wenn der Rückblick
  wirklich vorliegt. Schlug die Erstellung für einzelne Konfis fehl, führte
  der Einstieg bisher ins Leere.

- Der Papierkorb zum Leeren des Team-Chats erscheint nur noch dort, wo er
  auch funktioniert. Bisher war er in einem Fall sichtbar und scheiterte beim
  Antippen.

- Auf der Benutzerverwaltung erscheinen Lösch-Aktionen nur noch dort, wo sie
  auch erlaubt sind. Bisher waren sie in manchen Fällen sichtbar und
  scheiterten dann beim Antippen.

- Der Anmeldestatus eines Termins ist in Liste und Detailansicht jetzt derselbe.
  Bisher konnte ein Pflichttermin im Detail als "Geschlossen" gelten und ein
  ausgebuchter Termin mit freier Warteliste ebenso, obwohl die Warteliste offen
  war.

- Bei Terminen ohne Punkte steht in der Leitungsansicht nicht mehr "Punkte 0".


- In Gruppenchats sehen jetzt alle Mitglieder, wer sonst noch dabei ist —
  bisher war die Mitgliederliste der Leitung vorbehalten, obwohl das Handbuch
  sie allen versprach. Mitglieder entfernen oder hinzufügen kann weiterhin
  nur die Leitung.

- Teamer:innen können Bonuspunkte nur noch an Konfis ihrer eigenen Jahrgänge
  vergeben. Bisher war das über die Schnittstelle auch bei fremden Jahrgängen
  möglich, obwohl das Handbuch es ausschließt.

- Mehrtägige Termine gelten jetzt überall erst nach ihrem letzten Tag als
  vergangen. Bisher zeigten Liste und Detailansicht desselben Termins
  Unterschiedliches an — bei einer laufenden Freizeit stand in der Übersicht
  noch "läuft", in der Detailansicht schon "vergangen".

- Wird eine Konfi zur Teamer:in befördert, bleibt die gewählte
  Bibelübersetzung für die Tageslosung erhalten. Bisher stand danach wieder
  die Lutherbibel eingestellt.

- Konfis können sich nicht mehr zu Terminen anmelden, die nur für
  Teamer:innen gedacht sind oder die abgesagt wurden. Wer bereits angemeldet
  war, kann sich von einem abgesagten Termin weiterhin abmelden.

- Anträge von Konfis sind jetzt auf Aktivitäten für Konfis beschränkt.
  Aktivitäten, die nur für Teamer:innen gedacht sind, lassen sich nicht mehr
  beantragen und tauchen in der Antragsliste nicht auf.

- Ändert eine Konfi ihre E-Mail-Adresse, wird die neue Adresse sofort überall
  in der App verwendet — bisher blieb bis zur nächsten Anmeldung die alte
  stehen.

- Wählen Teamer:innen im Profil ohne Netz eine andere Bibelübersetzung, wird
  die Wahl jetzt nachgetragen, sobald die App wieder online ist. Bisher sah
  sie übernommen aus und war beim nächsten Start wieder verschwunden.

- Die Auswahl der Bibelübersetzung für die Tageslosung ist überall dieselbe.
  Bisher bot das Konfi-Profil eine Übersetzung mehr an als die Startseite und
  die Teamer-Ansichten.

- Challenges: Das Häkchen "bereits eingereicht" erscheint jetzt in allen
  Ansichten, sobald ein eigener Beitrag abgeschickt ist. Bei Challenges mit
  Freigabe fehlte es Leitung und Teamer:innen bisher, bis der Beitrag geprüft
  war — Konfis sahen es sofort.

- Ist die Tageslosung gerade nicht abrufbar, sehen Teamer:innen jetzt denselben
  Ersatztext wie Konfis, statt einer Fehlermeldung.

- Termine: Teamer:innen sehen jetzt schon in der Liste, ob das Team-Kontingent
  voll ist — bisher stand dort "Offen", und der Platzmangel zeigte sich erst
  beim Anmelden. Auch die Zahl der Wartenden steht jetzt auf der Terminkarte.

- Die Zahl neuer Abzeichen verschwindet jetzt sofort, wenn man die
  Abzeichen-Seite öffnet — bisher blieb sie bis zum nächsten App-Start stehen.
  Das Symbol auf dem App-Icon zählt neue Abzeichen jetzt ebenfalls mit.
- Teamer:innen sehen neue Abzeichen jetzt auch als neu: Der Reiter zeigt eine
  Zahl, die beim Öffnen der Abzeichen-Seite verschwindet. Bisher gab es diese
  Kennzeichnung nur für Konfis.

- Anträge von Teamer:innen erscheinen jetzt auch im Mitteilungscenter der
  Leitung — bisher gab es dafür nur eine Push-Nachricht. Zugleich bekommen
  jetzt alle Leitungsrollen die Mitteilung, nicht nur ein Teil.
- Der Jahresrückblick der Konfis ist erst nach der Freigabe durch die Leitung
  abrufbar — bisher versteckte nur die Startseite den Einstieg, die Daten
  selbst waren schon vorher zugänglich.
- Auf der Teamer-Startseite erscheinen unter "Deine Challenge" nur noch
  Challenges, an denen Teamer:innen auch teilnehmen dürfen — reine
  Konfi-Challenges tauchen dort nicht mehr auf.
- Teamer:innen wird beim ersten Start nicht mehr versprochen, dass sie Umfragen
  anlegen und Konfi-Meldungen bestätigen können — beides ist der Leitung
  vorbehalten. Die Erklärtexte sagen jetzt, was Teamer:innen wirklich tun.
- Termine: Auch Teamer:innen lassen sich jetzt über "Alle bestätigen" auf
  einmal verbuchen, statt einzeln. Bei reinen Teamer-Terminen fehlte die
  Schaltfläche bisher ganz — solche Termine blieben deshalb dauerhaft im
  Reiter "Verbuchen" stehen.
- Teamer:innen sehen auf ihrer Startseite jetzt auch Termine, für die
  Teamer:innen gesucht werden — bisher standen dort nur Termine, für die man
  schon angemeldet war. Reine Konfi-Termine erscheinen dort nicht mehr.
- Der Zähler am Challenges-Reiter berücksichtigt für Teamer:innen jetzt auch
  Runden, die nur fürs Team gedacht sind. Bisher wurde niemand darauf
  hingewiesen, dass dort Beiträge auf Freigabe warten.
- Abgesagte Termine lassen sich wieder öffnen, wenn man angemeldet war. Bisher
  stand der Termin zwar in der Liste, ließ sich aber nicht mehr aufrufen.

- Ist eine Punkteart für einen Jahrgang abgeschaltet, wird sie der Leitung
  jetzt auch nicht mehr zur Auswahl angeboten: beim Vergeben von Bonuspunkten,
  beim Zuweisen einer Aktivität und beim Anlegen eines Termins. Vorher liess
  sie sich anklicken, und erst das Speichern scheiterte mit einer Fehlermeldung.
- Konfis sehen in ihrer Punktehistorie keine abgeschaltete Punkteart mehr.
- Termine: Beim Löschen eines Termins werden bereits vergebene Punkte den
  Konfis jetzt wieder abgezogen — vorher behielten sie Punkte ohne Beleg.
- Termine: Vor dem Löschen erscheint jetzt eine echte Rückfrage, die konkret
  nennt, was verloren geht — Anmeldungen, Chat-Nachrichten und vergebene
  Punkte. Vorher wurde die Warnung des Servers stillschweigend übergangen.
- Eine Gemeinde lässt sich auch dann löschen, wenn noch eine Zeitschiene ohne
  zugeordneten Termin oder eine Mitteilung an ein Mitglied aus einer anderen
  Gemeinde daran hängt. Vorher brach das Löschen in diesen Fällen mit einem
  allgemeinen Fehler ab.
- Wer eine Person löscht, löscht jetzt wirklich alles: Auch ihre Chat-Anhänge
  (Fotos, Dateien) werden vom Server entfernt — vorher blieben sie dauerhaft
  liegen. Dasselbe gilt beim Löschen einer ganzen Organisation, dort
  zusätzlich für die Material-Dateien.
- Löschen Teamer:innen einen eigenen Antrag, wird das Nachweisfoto jetzt mit
  entfernt statt auf dem Server zu verbleiben. Auch bei der Beförderung eines
  Konfis zum:zur Teamer:in werden die Fotos der dabei entfernten offenen
  Anträge mit gelöscht.
- Der Anhang einer gelöschten Chat-Nachricht lässt sich nicht mehr
  herunterladen, solange die Nachricht gelöscht ist.
- Level löschen meldet jetzt verständlich, wenn das Level noch vergeben ist —
  auch wenn nur bereits archivierte Konfis es tragen. Vorher endete das in
  einem allgemeinen Fehler. Tipp in der Meldung: Umbenennen geht immer, alle
  sehen sofort den neuen Namen.
- Challenges: Die eigenen Beiträge stehen jetzt in einem Reiter statt in einem
  eigenen Abschnitt darüber — Konfis wählen zwischen "Feed" und "Meins",
  Leitung und Teamer:innen zwischen "Feed", "Wartet", "Abgelehnt" und "Meins".
  Vorher standen zwei Bereiche untereinander und die Seite wurde zu lang.
- Challenges: Der Grund einer Ablehnung steht jetzt unter dem Beitrag, im
  selben Kasten wie bei den Aktivitäten — mit der Überschrift "Grund der
  Ablehnung" statt als roter Fließtext mittendrin.
- Challenges: In der Leitungsansicht stand der eigene Beitrag doppelt — einmal
  in einem eigenen Abschnitt oben, einmal im Feed. Jetzt steht er nur noch im
  Feed, dort farbig hinterlegt und mit "Dein Beitrag" gekennzeichnet. Bei
  Challenges nur für die Leitung entfällt die Reiterleiste, weil es dort nichts
  zu wählen gibt.
- Musik-Links von Spotify zeigen wieder den Interpreten. Spotify liefert ihn
  seit Kurzem nicht mehr mit; er wird jetzt aus einer zweiten Quelle geholt.
  Deezer, YouTube Music und Apple Music zeigten ihn bereits.
- Teamer:innen kommen im Termin an den QR-Code zum Einchecken. Bisher zeigte
  ihn nur die Leitung — waren bei einem Termin allein Teamer:innen vor Ort,
  konnte sich niemand einchecken.
- Die beiden Hinweise auf Neuerungen — "Was ist neu?" und "Events und
  Aktivitäten" — sehen jetzt für alle Rollen gleich aus und stehen an
  denselben Stellen: dauerhaft im Profil, und auf der Startseite von
  Konfis und Teamer:innen, wo man sie einzeln wegklicken kann.
- Ein Termin bleibt als "zu verbuchen" gekennzeichnet, solange noch
  Teamer:innen offen sind — auch wenn alle Konfis schon verbucht sind. Vorher
  verschwand er aus der Liste und das Team rutschte durch.
- Teamer:innen werden jetzt getrennt von den Konfis verbucht — "Alle
  bestätigen" fragt, für wen. Das Team bekommt dadurch seine Abzeichen für die
  Teilnahme, aber keine Konfi-Punkte.
- Termine, an denen nur das Team teilnimmt, blieben nach dem Termin dauerhaft
  im Reiter "Verbuchen" hängen, während die Kachel sie als abgeschlossen
  zeigte. Beide sagen jetzt dasselbe.

- Ohne Verbindung zeigt ein geöffneter Termin wieder seine Daten. Bisher stand
  dort alles auf null, sobald man einen Termin antippte, den man vorher noch
  nicht einzeln geöffnet hatte.
- Aktivitäten melden geht jetzt auch ohne Verbindung: Die Auswahlliste kommt
  aus dem Zwischenspeicher, die Meldung wird nachgesendet.
- Die Tageslosung ist für Konfis auch ohne Verbindung da — wie bei
  Teamer:innen schon vorher.
- Aktionen, die wirklich eine Verbindung brauchen, sagen das jetzt. Bisher
  passierte beim Antippen einfach nichts.

- Termine ohne Teilnehmergrenze und ohne Warteliste galten für Konfis
  fälschlich als geschlossen — der Anmelden-Knopf fehlte, obwohl die Anmeldung
  offen war.
- Die Termin-Detailansicht zählte angemeldete Teamer:innen zu den
  Konfi-Plätzen; dadurch konnte sie "Ausgebucht" melden, während die Liste
  denselben Termin als offen zeigte.
- Anwesenheitsmatrix und Anwesenheitsliste zeigen Abgemeldete jetzt mit einem
  eigenen Zeichen statt als "ausstehend", und abgemeldete Termine zählen nicht
  mehr in die Pflicht-Summe.
- Änderungen erscheinen wieder zuverlässig sofort bei allen Beteiligten. Traf
  eine Änderung ein, während die Seite gerade lud, blieb sie unsichtbar, bis
  jemand die Ansicht neu öffnete — betroffen waren alle drei Rollen.
- Teamer:innen sehen unter "Alle" jetzt auch die Termine, die nur fürs Team
  sind. Bisher tauchten die dort nicht auf.
- Bei Terminen nur fürs Team zeigt die Übersicht die Team-Zahlen statt der
  Konfi-Zahlen — in der Liste, in den Kacheln und in den Details. Konfi-Plätze,
  Punkte und Typ standen dort bisher, obwohl sie nichts aussagen.
- In der Terminliste stimmt die Zahl der angemeldeten Konfis wieder. Angemeldete
  Teamer:innen wurden versehentlich doppelt abgezogen — aus 19 Konfis wurden so
  15. Betraf alle drei Ansichten.
- Der Hinweis auf den Mitmachen-Tab ist zurück: Auf der Startseite steht er als
  zweite Karte neben "Was ist neu" und lässt sich einzeln wegklicken, unter
  "Mehr" bleibt er dauerhaft stehen. Ein Tipp darauf erklärt in drei Schritten,
  wie Events und Aktivitäten zusammenspielen.
- Eingereichte Musik-Links sehen besser aus: Titel, Interpret und Album stehen
  jetzt untereinander statt in einer Zeile, die auf dem Handy abgeschnitten
  wurde. Bei Apple Music kommt das Album dazu, und bei YouTube Music steht
  endlich der Interpret dort statt des Kanalnamens.
- Beim Abmelden von einem Pflichttermin steht jetzt dabei, dass die Eltern die
  Abmeldung noch bestätigen müssen.
- Bei Pflichtterminen stimmt die Teilnehmerzahl wieder. Sie zeigte die
  Anwesenden statt der Angemeldeten und stand deshalb auf "0", solange niemand
  als anwesend erfasst war — obwohl Anmeldungen vorlagen. Abgemeldete zählen
  nicht mehr in die Teilnehmerzahl hinein, und die Anwesenheit steht jetzt als
  eigene Angabe daneben.
- Im Kopf einer Challenge steht jetzt ausdrücklich "Sichtbarkeit: ..." und
  "Moderiert: ja/nein". Vorher stand dort eine Kurzform, bei der nicht zu
  erkennen war, welche Angabe wofür stand.
- Bei Challenges, die nur die Leitung sieht, gibt es kein "Ausgeblendet" mehr —
  dort gibt es keine Galerie, aus der etwas herausgenommen werden könnte.
- Die eigenen Beiträge heißen jetzt "Dein Beitrag" oder "Deine Beiträge", je
  nachdem wie viele es sind.
- Abzeichen werden beim Bearbeiten nicht mehr versehentlich abgeschaltet.
  Wurde nur ein Teil geändert, etwa die Beschreibung, verschwand das Abzeichen
  bisher still aus der Anzeige.
- Die Terminseite aktualisiert sich jetzt live: Meldet sich jemand an oder ab,
  oder checkt per QR-Code ein, sehen es alle sofort — bisher stand der Zähler
  auf dem geöffneten QR-Code still.
- Die Konfi-Ansicht der Leitung zeigt Punkte, Anträge und Abzeichen jetzt
  sofort, auch wenn eine zweite Person sie vergibt.
- Teamer:innen bekommen Aktualisierungen auf Startseite, Abzeichen, Profil und
  Konfi-Statistik. Bisher blieben diese Seiten stehen, bis man sie neu öffnete.
- Trägt die Leitung eine Teamerin zu einem Termin ein oder rückt sie von der
  Warteliste nach, erfährt sie es jetzt sofort. Auch bei Anwesenheitslisten
  und QR-Check-in erreichen die Aktualisierungen jetzt Teamer:innen.
- Die Punkte-Regler zeigen jetzt links den kleinsten und rechts den größten
  wählbaren Wert in Grau; der eingestellte Wert steht farbig in der
  Überschrift. Bisher stand rechts der eingestellte Wert farbig — beim
  Vergeben von Bonuspunkten sogar dauerhaft die 10, die aussah wie eine
  Einstellung, sich aber nie änderte.
- Abzeichen mit einem Wert über 20 lassen sich wieder gefahrlos bearbeiten.
  Der Regler reichte nur bis 20 und hätte einen höheren Wert beim ersten
  Anfassen darauf heruntergesetzt — das Abzeichen wäre sofort an alle
  gegangen, die 20 Punkte haben.
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

- Nachrichten anderer Personen im Chat lassen sich jetzt wirklich nur noch von
  der Leitung löschen. Die App hatte die Schaltfläche zwar nie angeboten, der
  Server prüfte die Berechtigung aber nicht mit.
- Läuft die Sitzung ab, trennt die App jetzt auch die Live-Verbindung. Vorher
  konnte auf einem geteilten Gerät die nächste angemeldete Person noch
  Live-Nachrichten des vorherigen Kontos empfangen.
- Android: App-Daten wie Chats und Anmeldedaten werden nicht mehr ins
  Google-Konto gesichert.
- Die Anmeldung zur API-Dokumentation bremst wiederholte Fehlversuche jetzt
  aus — das gemeinsame Passwort lässt sich nicht mehr durchprobieren.
- Challenges: Links aus Beiträgen öffnen nur noch reguläre Web-Adressen.
  Apple Music, YouTube Music und Deezer an; das Einreichen-Formular sagt das
  vorher an. Titel und Interpret werden automatisch dazugeschrieben — ein
  Cover wird bewusst nicht geladen, damit der Musikdienst beim Ansehen der
  Beiträge nichts mitbekommt.

### Sonstiges

Betrifft nicht die App, gehört nicht in die Store-Release-Notes.

- E-Mail- und Passwort-Ändern sind für alle drei Rollen jetzt dieselbe
  Oberfläche in den jeweiligen Rollenfarben; künftige Korrekturen wirken
  damit automatisch überall.
- Die Willkommens-Tour der Konfis nutzt dieselbe Darstellung wie die der
  anderen Rollen; nur die Texte sind weiterhin eigene.
- Aktualisierte Oberflächen-Themes für iOS und Android: zweizeilige
  Listeneinträge, neue Textlayouts und überarbeitete iOS-Eingabefelder.
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
- Neues Wartungswerkzeug, das hochgeladene Dateien ohne zugehörigen Eintrag
  findet und auf Wunsch entfernt — für Altbestand, der vor den Löschkorrekturen
  liegengeblieben ist.

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
