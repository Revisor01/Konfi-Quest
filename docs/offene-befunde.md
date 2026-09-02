# Offene Befunde

Gemeldet von Simon, noch nicht behoben. Eine Zeile pro Befund, mit dem, was
nachgemessen wurde — damit die nächste Sitzung nicht bei null anfängt.

---

## 1. Chat: Ungelesen-Markierung verschwindet nicht (02.09.2026)

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

### Wo im Code zu suchen ist

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
