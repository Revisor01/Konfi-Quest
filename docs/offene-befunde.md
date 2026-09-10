# Offene Befunde

Gemeldete und geprüfte Befunde, mit dem, was jeweils nachgemessen wurde —
damit die nächste Sitzung nicht bei null anfängt. Behobene und als
gegenstandslos erwiesene Befunde bleiben stehen und werden im Titel als
solche markiert; sonst liest sich die Liste wie eine Reihe offener Lücken,
die längst zu sind.

---

## 1. Chat: Ungelesen-Markierung verschwindet nicht (02.09.2026) — BEHOBEN

> **Behoben am 02.09.2026.** Zwei Fehler in
> `BadgeContext.markRoomAsRead`, beide im Frontend:
>
> 1. Der Cache der Raumliste (`chat:rooms:<userId>`) wurde nach dem Lesen nie
>    verworfen. Beim nächsten App-Start kam das alte `unread_count` zurück und
>    erzeugte erneut Badge und roten Trenner.
> 2. `setChatUnreadTotal` las den abzuziehenden Wert aus der Closure statt aus
>    dem aktuellen Zustand — deshalb blieb der Badge auch live stehen.
>
> Fünf Tests halten beides fest. Der Befund unten bleibt als Beschreibung
> stehen, damit die Messung nachvollziehbar ist.

**Simons Beobachtung**, in Organisation 4 (Review-Gemeinde) reproduzierbar:

> „Zumindest in der aktuellen Version wird das Chat-Badge pro Chat nicht
> gelöscht, und nach Neuladen erscheint auch der rote Strich bei neuen
> Nachrichten wieder."

Also zwei zusammenhängende Symptome:
- Die Zahl am einzelnen Chat bleibt stehen, obwohl der Chat geöffnet wurde.
- Der rote Trenner „Neue Nachrichten" kommt nach dem Neuladen zurück.

### Was nachgemessen ist (02.09.2026)

`chat_read_status` der drei Review-Konten in Raum 96 (Jahrgangs-Chat):

| Konto | last_read_at | Nachrichten danach |
|---|---|---|
| review-konfi (58) | 29.08.2026 13:42 | 16 |
| review-teamer (57) | 03.08.2026 20:46 | 32 |
| review-admin (56) | 03.08.2026 20:53 | 29 |

Der Lesestand steht bei zwei Konten auf dem **3. August**, obwohl die Konten
seither benutzt wurden (letzte Anmeldung 31.08.). Das Öffnen eines Chats
schreibt `last_read_at` also nicht zuverlässig fort.

**Ehrlicher Hinweis zur Zahl 16:** Davon stammen 16 Nachrichten aus dem
Befüllen der Demo-Daten am 02.09.2026 (Chat-Nachrichten für den
Jahresrückblick). Der Befund ist davon unabhängig — die Lesestände vom
3. August und die 29/32 ungelesenen Nachrichten der beiden anderen Konten
sind älter als dieser Eingriff.

### WICHTIG: Der Fehler sitzt im Frontend, nicht im Backend

Simon hat es live gegengeprüft (02.09.2026, angemeldet als `simonluthe`,
Nutzer 41, Organisation 1 — die echte Gemeinde, nicht die Demo):

> „Ich gehe in den Jahrgangschat und es ändert sich nicht."

Dazu die Datenbank in genau diesem Moment:

| Raum | last_read_at | ungelesen laut Datenbank |
|---|---|---|
| 62 „Jahrgang 2026/27" | 01.09.2026 22:53 | **0** |

**Das Backend hält den Lesestand also korrekt.** Der Server meldet null
ungelesene Nachrichten, die Oberfläche zeigt trotzdem eine Markierung. Der
Fehler liegt damit in der Anzeige: Sie räumt das Badge nicht ab bzw. holt
den Stand nicht neu.

Das verschiebt die Suche: **Zuerst im Frontend nachsehen**, nicht in den
SQL-Abfragen. Die früher gemessenen alten Lesestände der Review-Konten
(3. August) sind eine andere Sache — dort wurden die Chats vermutlich
schlicht nie geöffnet.

Die vier Dateien, die den Ungelesen-Zustand anfassen:

- `frontend/src/contexts/BadgeContext.tsx` — die Zahl an der Tab-Leiste
- `frontend/src/components/chat/ChatOverview.tsx` — die Zahl pro Chat in der
  Liste
- `frontend/src/components/chat/ChatRoom.tsx` — hier müsste das Markieren
  als gelesen ausgelöst werden
- `frontend/src/components/chat/useChatScroll.ts` — der rote Trenner „Neue
  Nachrichten"

Zu klären: Ruft `ChatRoom` beim Öffnen den Endpunkt auf, der `last_read_at`
setzt? Und falls ja — wird danach der `BadgeContext` bzw. die Übersicht neu
geladen, oder behält die Oberfläche ihren alten Stand im Speicher?

### Wo im Backend zu suchen ist (nachrangig)

- `backend/routes/chat.js:1287` — der einzige `INSERT INTO chat_read_status`.
  Prüfen: Wird er beim Öffnen eines Raums wirklich aufgerufen, und
  aktualisiert er `last_read_at` bei einem bestehenden Eintrag (UPSERT) oder
  läuft er ins Leere?
- `backend/routes/chat.js:791` — `unread_count` pro Raum.
- `backend/routes/chat.js:1216` und `:2027` — `total_unread` für das Badge
  an der Tab-Leiste.
- Im Frontend: Wo wird das Markieren als gelesen ausgelöst? Beim Öffnen des
  Raums, beim Verlassen, oder gar nicht?

### Was ein Test abdecken muss

- Raum öffnen -> `last_read_at` steht danach auf „jetzt".
- Danach `unread_count` für diesen Raum = 0.
- Neue Nachricht von jemand anderem -> Zähler wieder 1, roter Trenner
  erscheint genau einmal.
- Neuladen ohne neue Nachricht -> kein roter Trenner, Zähler bleibt 0.

Weiche Erwartungen sind hier ein Fehler: `toBeGreaterThanOrEqual(0)` würde
den Fehler durchlassen. Auf den konkreten Wert prüfen.

---

## 2. Sicherheitsmeldungen zu react-router (07.09.2026) — GEPRÜFT, TRIFFT UNS NICHT

Zwei Meldungen zu `react-router` 6.30.6 stehen offen und lassen sich nicht
durch ein Update schließen. Nachgemessen am 07.09.2026:

**Warum kein Update möglich ist.** Der Fix existiert ausschließlich in
7.18.0; für den 6er-Zweig gibt es keinen. Ein Sprung auf 7 ist mit Ionic
ausgeschlossen — `@ionic/react-router` deklariert als Peer:

    "react-router":     ">=6.4.0 <7"
    "react-router-dom": ">=6.4.0 <7"

Das gilt für die installierte 9.0.1, für die neueste 9.0.2 und auch für die
Nightly 9.0.3. Es ist eine harte Obergrenze, keine Empfehlung. Die Meldungen
bleiben also offen, bis Ionic nachzieht — das liegt nicht bei uns.

**Beide Lücken greifen bei uns nicht:**

| Meldung | Trifft zu? | Begründung |
|---|---|---|
| Constructor Injection in `deserializeErrors()` (SSR-Hydration) | nein | Wir haben kein SSR. Die App ist eine Vite-SPA in einer Capacitor-Hülle; der betroffene Pfad läuft nie. |
| Open Redirect via Backslash in `<Link>` / `useNavigate` | nein | Alle Navigationsziele sind feste Pfade mit eingesetzter ID (`/konfi/events/${event.id}`, `/admin/chat/room/${room.id}`). Nirgends fließt ein nutzergesteuerter Pfad oder eine ganze Adresse in ein Ziel. |

Die zweite Zeile ist der Punkt, der bei jedem Umbau neu gilt: **Sobald
irgendwo ein Ziel aus Nutzereingaben, einer API-Antwort oder einem
Push-Datenfeld gebaut wird, ist die Lücke wieder da.** Wer so etwas
einführt, prüft das Ziel gegen eine Erlaubnisliste, statt es direkt
weiterzureichen.

**Zum Gegenprüfen** (die Suche, die den Befund trägt):

    grep -rn 'navigate(`\|push(`\|routerLink={`' frontend/src

Erwartet: ausschließlich feste Pfade mit eingesetzten IDs.

---

## 3. Nächtlicher Datenbank-Dump war leer (10.09.2026) — BEHOBEN

In der Nacht des Ausfalls vom 09./10.09. lief der nächtliche Dump um 2:30,
während die Container verschwunden waren. Er hinterließ eine Datei von
**20 Byte** — das ist der leere gzip-Rahmen, ausgepackt 0 Byte. Der Lauf
davor (09.09., 448 kB) war der letzte brauchbare Stand.

### Warum der Fehlschlag still blieb

Zwei Fehler, die sich gegenseitig verdeckten:

1. **Im Sicherungsskript fehlte `pipefail`.** In einer Pipe bestimmt der
   letzte Befehl den Rückgabewert. `pg_dump | gzip` endet deshalb
   erfolgreich, auch wenn `pg_dump` gar nicht startet — `gzip` gelingt ja,
   es packt nur nichts ein. Das Skript meldete „Backup ok".
2. **Die Backup-Überwachung prüfte am Fall vorbei.** Sie kennt einen
   eigenen Schritt für verdächtig kleine Dumps, sah aber nur eines der
   beiden Dump-Verzeichnisse — ausgerechnet nicht das von Konfi Quest.
   Für Konfi Quest prüfte sie nur, ob eine Datei jung genug ist, nicht ob
   Inhalt darin steht. Um 7:30 meldete sie „OK, 2 frische Dateien" — eine
   davon war die leere.

Dazu kam ein dritter, davon unabhängiger Punkt: Das übergreifende
Sicherungsskript für alle Datenbanken führte noch die **Staging-Datenbank**,
die es seit dem 24.08.2026 nicht mehr gibt. Es meldete jede Nacht folgenlos
„SKIP" und sah dabei aus, als sei Konfi Quest dort abgedeckt. Die Produktion
hat einen eigenen Weg und war nie gemeint.

### Was geändert wurde

- Das Sicherungsskript prüft jetzt **vorher**, ob die Datenbank überhaupt
  läuft, setzt `pipefail`, prüft das Ergebnis auf Inhalt (unter 1 kB gilt als
  Fehlschlag — der kleinste je gemessene echte Dump war 236 kB) und **löscht**
  eine unbrauchbare Datei, statt sie liegen zu lassen. Bricht mit Exit 1 ab.
- Die Überwachung prüft beide Dump-Verzeichnisse auf leere Dateien.
- Die tote Staging-Zeile ist durch einen Verweis ersetzt, der sagt, wo die
  Produktion tatsächlich gesichert wird.

### Gegenprobe (alle drei am 10.09.2026 gelaufen)

| Fall | Erwartet | Gemessen |
|---|---|---|
| Datenbank läuft | Dump entsteht, Exit 0 | 468 kB, Exit 0 |
| Container fehlt | kein Dump, Exit 1 | keine Datei, Exit 1 |
| `pg_dump` liefert nichts | Datei gelöscht, Exit 1 | gelöscht, Exit 1 |
| Leere Datei im Verzeichnis | Überwachung schlägt an | „PROBLEM: Leere Dumps" |

Der leere Dump wurde ersetzt; der neue Stand enthält **111 Nutzer** und deckt
sich mit der Zählung in der laufenden Datenbank.

### Was daraus für andere Sicherungen folgt

`pg_dump | gzip > datei` ohne `set -o pipefail` meldet Erfolg, auch wenn nichts
ankommt. Wer so etwas schreibt, prüft danach die Dateigröße — sonst merkt es
niemand, bis die Sicherung gebraucht wird.

---

## 4. Screenshots zeigten die falsche Seite (10.09.2026) — BEHOBEN

Drei Fehler im Aufnahmeskript, alle **am Bild** aufgefallen und keiner am
Protokoll — das meldete durchweg Erfolg.

### 4.1 Ladeseiten als gelungene Aufnahme

`teamer-chat.png` zeigte „Chaträume werden geladen…", `teamer-profil.png`
„Profil wird geladen…". Beide waren rund 40 kB groß statt der üblichen 500 kB.

Das Skript wartet auf das Verschwinden des Ladebalkens, schluckte einen
Zeitüberlauf dabei aber still — obwohl der Kommentar an der Stelle genau das
Gegenteil versprach („Ohne das landen halb aufgebaute Listen auf den Bildern").
Jetzt folgt die Gegenprobe: Dreht danach noch etwas, fällt die Aufnahme durch.

### 4.2 Zwei Namen, ein Bild

`teamer-abzeichen.png` und `teamer-mitmachen.png` waren **Byte für Byte
identisch** — beide zeigten die Events-Seite, eine davon unter falschem Namen.
An der Dateigröße fiel das nicht auf: beide 525 kB, beide für sich genommen
tadellos.

**Gemessen:** Kommt der Seitenwechsel über die Verlaufssteuerung, während auf
der vorigen Seite noch ein Hinweis weggeklickt wird, verwirft die Oberfläche ihn
still. Die Adresse zeigt das neue Ziel, im Bild steht die alte Seite. Längeres
Warten hilft nicht — auch nach zehn Sekunden bleibt sie stehen.

Was trägt, ist der Weg, den auch ein Mensch nimmt: **den Reiter antippen.** Im
Test wechselten so alle Reiter fehlerfrei, während derselbe Wechsel über die
Verlaufssteuerung hängen blieb.

**Betroffen war jede Rolle und beide Gerätegrößen** — auch die Bilder für den
App Store, dort ebenfalls dreimal (Leitung, Team, Konfi).

### 4.3 Ein Netz darunter

Jede Aufnahme bekommt einen Fingerabdruck. Gleicht sie einer früheren derselben
Rolle, fällt sie durch und nennt den Doppelgänger beim Namen. Verglichen wird
gegen **alle** vorherigen, nicht nur die letzte — zwischen den beiden
Doppelgängern lag noch eine dritte Seite.

### Die App ist nicht betroffen

Mit echten Klicks wechselt jeder Reiter sauber (gemessen für alle fünf). Zu den
Abzeichen führt für Team und Leitung ohnehin nur der Weg über das Profil, und
der trägt — einen eigenen Reiter gibt es dort nicht. Der Fehler traf allein die
Automatik.

### Ergebnis

Alle 42 Bilder neu gezogen (21 je Gerät). Keine Duplikate, keine Datei unter
100 kB, jedes angesehen.

### Was daraus folgt

Ein `.catch(() => {})` um eine Wartebedingung hebt genau die Prüfung auf, für
die sie gedacht war. Wo eine Aufnahme fehlschlagen *soll*, muss sie es auch
dürfen — ein Bild, das niemand ansieht, ist kein Beleg. Und Dateigröße allein
beweist nichts: Zwei identische Bilder waren beide „richtig groß".
