# Support-Ansicht als echte Web-Oberfläche

Stand: 03.10.2026. Gehört zur Web-Version ([web-version.md](web-version.md))
und baut auf der Support-Mail auf ([support-mail.md](support-mail.md)).

## Was Simon will (03.10.2026)

> „Ich finde, die Support-Struktur soll rein Web sein, arbeitet aber mit
> Listenelementen wie die App. Ich brauche die Liste in der Support-Ansicht
> nicht. Ich hab ja alles auf der linken Seite. Das reicht. Sonst ist es eine
> Doppelung. Dann lieber ordentliche Statistiken und Anzeigen auf der
> Support-Übersicht: neueste Anfragen auf Account, neueste Support-Anfragen
> etc. Saubere Statistik mit Entwicklung etc."

> „Gut wäre, wenn wir die Gemeinden Test Teamer Sicht, Test Konfi Sicht und
> Admin Review Sicht nicht auf der offiziellen Liste anzeigen. Das verwalten
> nur wir gemeinsam via Backend direkt."

> „Die Gemeindeansichten sollten nach Landeskirche und nach Kirchenkreisen
> geordnet sein, mit Akkordeon und einer Live-Suche. […] Auch braucht man
> auf den Gemeinden eigentlich sofort einen Zugriff auf den Admin, nicht erst
> nach Klick und Details und wieder Klick."

> „Ich brauche auch eine Beispielanfrage an Support und an moin, damit ich
> das mal sehe. […] Die Verwaltung auf dem Handy ist ok, aber wir brauchen
> eine eigene CSS für Webansichten. […] Und ich will in meinem Account, also
> in einer geteilten Gemeinde und Support, auch die Seitennavigation wie nur
> Support zusätzlich zu meiner."

## Entschieden

1. **Zwei Gesichter, eine Seite.** Jede Seite der Support-Ansicht zeigt im
   breiten Browserfenster (Web, ab 992 px — dieselbe Grenze wie die Leiste,
   `navigation/breitesLayout.ts`) eine **Web-Variante**: Tabellen, Karten im
   Raster, Kennzahl-Kacheln, Diagramme — keine Ionic-Listenelemente. Auf dem
   Handy und im schmalen Fenster bleibt die heutige App-Darstellung.
2. **Eigenes Stylesheet** `frontend/src/theme/web-ansicht.css`: Klassen mit
   Präfix `web-`, Farben, Abstände und Schrift nur über die vorhandenen
   Tokens (`var(--app-…)`), Dunkelmodus inklusive. Bausteine in
   `frontend/src/components/support/web/`.
3. **Übersicht = Dashboard.** Im breiten Fenster keine Liste der Bereiche
   mehr (die steht links). Stattdessen: Kennzahlen, Entwicklung als
   Diagramme, neueste Anfragen, neueste Support-Mails, Testphasen, die bald
   enden. Im schmalen Fenster bleibt die Liste der Bereiche (dort gibt es
   keine Leiste).
4. **Gemeinden** im breiten Fenster: nach Landeskirche → Kirchenkreis
   gruppiert, aufklappbar, mit Live-Suche (Gemeinde, Kirchenkreis,
   Landeskirche, Name/Benutzername/E-Mail der Gemeindeleitung). Je Gemeinde
   steht die **Gemeindeleitung direkt da** (Name, Benutzername, E-Mail als
   Link, gesperrt ja/nein, zuletzt angemeldet), dazu Laufzeit/Testphase,
   Konfis/Limit, Wunschlizenz, und die Aktionen **Bearbeiten** (das
   bestehende Formular „Gemeinde") und **Schreiben** (Schriftwechsel).
5. **Interne Gemeinden ausblenden.** Neue Spalte `organizations.intern`
   (Migration 194, additiv, Standard `false`). Interne Gemeinden (die drei
   Review- und Test-Gemeinden für die Stores) erscheinen in keiner Liste und
   keiner Zahl der Support-Ansicht und nicht in `GET /organizations`. Gesetzt
   wird die Spalte nur direkt in der Datenbank (Auftrag an den lokalen
   Agenten), es gibt keinen Schalter in der Oberfläche.
6. **Leiste im eigenen Konto.** Ein Konto mit Gemeinde und Super-Admin-Merkmal
   (Simons) bekommt in der Leiste unter den eigenen Bereichen zusätzlich die
   Gruppe **Support** mit denselben Einträgen wie das reine Support-Konto
   (`SUPPORT_BEREICHE`). Nur Web, nur breites Fenster.
7. **Beispiele zum Ansehen:** Bildschirmfotos der Web-Variante mit
   Beispieldaten (Anfrage an moin@, Mail an support@) aus dem Browser mit
   nachgebildeter API; in der Produktion nach dem Deploy eine Probe-Anfrage
   und je eine Probe-Mail an moin@ und support@ (Auftrag an den lokalen
   Agenten).
8. **Gemeinde-Umschalter nur unten in der Leiste.** Simon (03.10.2026): „In
   der Webansicht ist der Switcher für die Org unten in der Navi, das finde
   ich gut, aber auch aktuell noch im Header, das finde ich doof. Und unten
   in der Navi links darf der schon gestylt sein. Also eigene Webview, ohne
   die App-View zu zerstören." Im breiten Fenster steht der Umschalter nicht
   mehr in der Kopfzeile, sondern nur unten in der Leiste — als eigene,
   gestaltete Fläche (Symbol, voller Name der Gemeinde, Rolle dort, Pfeil;
   die Liste klappt nach oben auf, mit roter Zahl je Gemeinde; eingeklappt
   nur das Symbol mit Tooltip). In der App und im schmalen Fenster bleibt
   die Kopfzeile, wie sie ist.
9. **Support bleibt in der App.** Simons Weg über „Mehr" → Support und die
   Bereichsliste im schmalen Fenster bleiben unverändert.
10. **Posteingang wie ein Mailprogramm.** Simon (03.10.2026): „Und auch
    Support-Anfragen etc. kommen ins Postfach, oder?" Im breiten Fenster
    zeigt der Posteingang **alle** eingehenden Mails beider Postfächer, mit
    Filtern „Alle", „Nicht zugeordnet", „moin@", „support@" und einer Spalte,
    wohin die Mail gehört (Link zur Anfrage bzw. zum Schriftwechsel der
    Gemeinde). Die rote Zahl am Posteingang bleibt bei den nicht
    zugeordneten ungelesenen Mails — die zugeordneten zählen schon an der
    Anfrage bzw. Gemeinde — und steht zusätzlich am Filter „Nicht
    zugeordnet". Im schmalen Fenster bleibt der Posteingang, wie er ist.

## Neue Routen (nur Super-Admin, unter `/api/support`)

### `GET /uebersicht`

Interne Gemeinden zählen nirgends mit.

```
{
  kennzahlen: {
    gemeinden: { gesamt, testphase, lizenz, unbegrenzt, gesperrt },
    konten: { konfi, teamer, admin, org_admin },
    aktiv_30_tage,                 // wie GET /statistik, über alle Gemeinden (je Konto einmal)
    anfragen_offen,                // Status neu oder in_arbeit
    mails_ungelesen                // eingehend, gelesen_am IS NULL
  },
  entwicklung: {
    monate: ['2025-11', …, '2026-10'],        // die letzten 12 Kalendermonate, ältester zuerst
    gemeinden_neu: [n, …],                     // organizations.created_at je Monat
    konten_neu: { konfi: [n, …], team: [n, …] },  // users.created_at je Monat, team = teamer+admin+org_admin
    konten_gesamt: [n, …],                     // Konten (nicht gelöscht) am Monatsende, kumuliert
    anfragen_neu: [n, …]                       // gemeinde_anfragen.created_at je Monat
  },
  aktivitaet: {
    wochen: ['2026-W29', …, '2026-W40'],      // die letzten 12 ISO-Wochen, älteste zuerst
    antraege: [n, …],                          // eingereichte Anträge (Tabelle der Aktivitäts-Anträge)
    buchungen: [n, …],                         // Event-Anmeldungen
    nachrichten: [n, …]                        // Chat-Nachrichten
  },
  neueste_anfragen: [ { id, gemeinde, kontakt_name, status, wunsch_lizenz, created_at, ungelesen } ],  // 5, neueste zuerst
  neueste_mails: [ { id, postfach, von_name, von_adresse, betreff, gesendet_am, gelesen_am,
                     anfrage_id, organization_id, gemeinde_name } ],            // 5 eingehende, neueste zuerst
  testphase_endet: [ { id, display_name, trial_ends_at } ]                       // in den nächsten 14 Tagen, früheste zuerst
}
```

Monate mit null Einträgen stehen als `0` da (lückenlose Reihen). Welche
Tabellen „Anträge", „Buchungen" und „Nachrichten" sind, legt das Backend fest
und schreibt es in die API-Doku; Gemeinde-Zugehörigkeit über die Tabelle
selbst (organization_id), interne Gemeinden ausgenommen.

### `GET /gemeinden`

```
[ {
  id, name, display_name, is_active, is_trial, trial_ends_at, max_konfis,
  konfi_count, team_count, created_at,
  kirchenkreis_id, kirchenkreis, landeskirche_id, landeskirche,
  wunsch_lizenz,
  leitung: [ { id, display_name, username, email, is_active, last_login_at } ]   // Gemeindeleitungen (org_admin), beide Quellen der Zugehörigkeit
} ]
```

Sortiert nach Landeskirche, Kirchenkreis, Anzeigename (ohne Zuordnung
zuletzt). Ohne interne Gemeinden.

### Bestehende Routen

`GET /organizations` (Super-Admin-Liste), `GET /support/statistik` und die
Gemeinde-Auswahl beim Zuordnen von Mails lassen interne Gemeinden weg.
Antwortformen bleiben gleich — nur weniger Einträge.

`GET /mail/eingang` bekommt den Parameter `zuordnung` (`offen` = Vorgabe,
heutiges Verhalten: nur nicht zugeordnete; `alle` = alle eingehenden) und
je Mail die zusätzlichen Felder `anfrage_id`, `organization_id`,
`gemeinde_name` (Gemeinde der Zuordnung bzw. Gemeindename der Anfrage).
Ohne Parameter bleibt die Antwort, wie sie ist.

## Offen

- Weitere Kennzahlen (Speicher, Medien) und eine Auswahl des Zeitraums.
- Interne Gemeinden in einer eigenen, versteckten Liste anzeigen, falls das
  Verwalten „direkt im Backend" zu umständlich wird.
