# Icon-/Layout-Angleichung Anträge ↔ Events (Plan, 29.06.2026)

Ziel (User): Icons bei Events + Anträgen/Aktivitäten über alle 3 Rollen
(Konfi/Teamer/Admin) angleichen, AUCH im Layout. **Referenz = Event-Detail-View.**

Branch: von `main` (HEAD e2a6a253). Eigener Branch empfohlen.

---

## TEIL 1 — Icon-/Text-Abweichungen (klein, 5 Stellen)

Anträge sollen die Event-Detail-Icons übernehmen. Status-Icons
(hourglass/checkmarkCircle/closeCircle) + Farben sind SCHON konsistent — nur:

| Datei | Zeile~ | Ist | Soll |
|---|---|---|---|
| `konfi/modals/RequestDetailModal.tsx` | 178 | `trophyOutline` (Punkte) | `trophy` |
| `konfi/modals/RequestDetailModal.tsx` | 223 | `imageOutline` (Foto) | `camera` |
| `konfi/modals/RequestDetailModal.tsx` | 206 | `chatbubbleEllipsesOutline` (Kommentar) | `documentTextOutline` |
| `admin/.../ActivityRequestsView.tsx` | 16 | `documentOutline` (Doku) | `documentTextOutline` |
| `admin/.../ActivityRequestsView.tsx` | 151 | Status-Text "Genehmigt" | "Verbucht" (wie Konfi) |

ACHTUNG: Zeilennummern vor Umsetzung per grep neu verifizieren (können
abweichen). Import-Statements der Icons mit anpassen (alte ggf. entfernen,
wenn ungenutzt).

Event-Detail-Referenz-Icons (Soll-Standard):
- Datum=`calendar`, Uhrzeit=`time`, Ort=`location`, Teilnehmer=`people`,
  Punkte=`trophy`, Typ Gottesdienst=`home`/Gemeinde=`people`,
  Kategorien=`pricetag`, Pflicht=`shieldCheckmark`, Mitbringen=`bagHandle`,
  Beschreibung=`informationCircle`, Foto=`camera`, Kommentar=`documentTextOutline`.

---

## TEIL 2 — Layout RequestDetailModal auf Event-Detail-Pattern (größer)

`konfi/modals/RequestDetailModal.tsx` nutzt generische `IonItem`-Zeilen.
Event-Detail nutzt `app-info-row` (Icon + Label + Value) + `app-status-box`
(farbige Status-Box). → Modal auf diese Klassen umbauen.

Referenz-Struktur (aus konfi/admin EventDetailView):
- `<div className="app-info-row">` mit Icon + Label + Value
- `<div className="app-status-box app-status-box--success|--events|...">` für Status
- `SectionHeader` als farbiger Kopf (optional)
- `IonCard className="app-card"` > `IonCardContent className="app-card-content"`

RequestDetailModal-Blöcke (heute 4 IonList-Blöcke):
1. Antragsdaten (Aktivität, Punkte, Datum, Eingereicht, Kommentar) → app-info-row
2. Nachweis-Foto (nur pending) → behalten, Icon `camera`
3. Status (Status, Ablehnungsgrund) → app-status-box statt IonItem;
   Ablehnungsgrund-Box mit `alertCircleOutline`
4. Löschen-Button (nur pending) → bleibt

---

## TEIL 3 — Optional: Admin-Filter-Section angleichen

Admin `ActivityRequestsView` hat KEINE separate Filter-`IonList` mit
`filterOutline` wie Konfi/Events. Niedrige Prio — nur wenn gewünscht.

---

## VORGEHEN
1. Branch ab main.
2. Teil 1 (Icons) — schnell, einzeln verifizieren + Build.
3. Teil 2 (Modal-Layout) — sorgfältig, mit Browser-Verifikation
   (Konfi simon1234 hat Anträge? sonst Test-Antrag anlegen).
4. Teil 3 optional.
5. Build/Tests grün, dann Build 71 falls Release gewünscht.

Status-Texte vereinheitlichen: Konfi nutzt "Offen/Verbucht/Abgelehnt",
Admin "Offen/Genehmigt/Abgelehnt" → auf "Verbucht" angleichen (User-Wunsch
implizit über "angleichen").
