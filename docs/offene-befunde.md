# Offene Befunde

Gemeldet von Simon, noch nicht behoben. Eine Zeile pro Befund, mit dem, was
nachgemessen wurde — damit die nächste Sitzung nicht bei null anfängt.

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
