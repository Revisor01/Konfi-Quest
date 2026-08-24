# Zähler (die roten Zahlen)

Stand: 24.08.2026. Untersucht wegen der Beobachtung, dass der Zähler bei
einigen Konfis auf Android nicht mehr wegging.

## Drei Zähler, die leicht verwechselt werden

| Nr. | Was | Wer setzt ihn |
|---|---|---|
| 1 | Zahl am App-Icon auf dem Homescreen | die laufende App über `Badge.set` / `Badge.clear` (`BadgeContext.tsx:144-147`), auf iOS zusätzlich der stille Push über `aps.badge` (`push/firebase.js`) |
| 2 | Zahl am Reiter unten in der App | `BadgeContext`, gespeist aus `GET /api/notifications/counts` |
| 3 | Zahlen an einzelnen Chats in der Liste | dieselbe Abfrage, pro Raum |

## Wann der Zähler neu berechnet wird

`BadgeContext.tsx:176-203` — kein Dauer-Abfragen, sondern Ereignisse:
Anmeldung, `sync:reconnect` (feuert auch beim Zurückkehren aus dem Hintergrund,
`AppContext.tsx:598-623`), `push:received` und neue Nachrichten über den
Socket. Das ist vollständig und wurde geprüft; hier liegt der Fehler **nicht**.

## Befunde

### 1. Eigene Nachrichten zählten als ungelesen — BEHOBEN

`notifications.js:40-52` zählte jede Nachricht neuer als `last_read_at`, auch
die selbst geschriebene. Der Hintergrunddienst schließt sie seit jeher aus
(`backgroundService.js:136`). Wer die letzte Nachricht in einem Raum schrieb
und ihn danach nicht mehr öffnete, sah dauerhaft eine Eins. Beim Öffnen
verschwand sie, weil `mark-read` läuft — deshalb war in Produktion zum
Zeitpunkt der Messung niemand betroffen, der Fehler aber real.

### 2. Der Zähler wurde nie auf null zurückgenommen — BEHOBEN

`backgroundService.js` sendete nur bei `badgeCount > 0`. Eine einmal gesetzte
Zahl nahm der Server also nie zurück; das erledigte allein die App beim
nächsten Start. Jetzt wird auch die Null gesendet, und ein Merker
(`letzterZaehler`) verhindert, dass bei jedem Takt dieselbe Zahl erneut geht.

### 3. Android bekommt vom Server keine Zahl — offen, Plattform-Eigenheit

`push/firebase.js` setzt `aps.badge` — das wirkt nur auf iOS. Android kennt
kein Betriebssystem-Abzeichen; die Zahl kann dort nur die laufende App setzen.
Der stille Push weckt eine geschlossene App nicht auf, also bleibt der Zähler
auf Android stehen, bis sie wieder geöffnet wird. **Das ist die
wahrscheinlichste Erklärung für die Beobachtung.**

Ein `android`-Block mit hoher Priorität ist ergänzt — er ist die Voraussetzung
dafür, dass ein künftiger Empfänger das Paket überhaupt erreicht. Ein
Empfänger für `badge_update` existiert im Frontend derzeit nicht; `push:received`
löst zwar einen Abgleich aus, aber nur bei laufender App.

Wer das vollständig lösen will, braucht auf Android eine sichtbare
Benachrichtigung (aus der der Launcher seinen Punkt ableitet) oder einen
Hintergrunddienst in der App. Beides ist eine Produktentscheidung, kein Bugfix.

## Geprüft und in Ordnung

- Der Resume-Pfad ist vollständig: App aktiv → `sync:reconnect` → `refreshAllCounts`.
- Gelöschte Nachrichten sind in beiden Abfragen über `deleted_at IS NULL` ausgenommen.
- `Badge.clear()` wird korrekt aufgerufen, wenn die Summe null ist.
- Der Push-Listener löst bei Empfang und beim Antippen einen Abgleich aus.
