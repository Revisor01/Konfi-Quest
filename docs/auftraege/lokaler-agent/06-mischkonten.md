# 06 — Mischkonten messen (Konfi und Team zugleich)

Simon, 28.09.2026: „Konfi und Team geht nicht parallel." Ein Konto ist
entweder **Konfi** (genau eine Gemeinde, die Stamm-Gemeinde) oder **Team**
(teamer, admin, org_admin — auch in mehreren Gemeinden), nie beides. Seit
dem 28.09.2026 lehnt der Server jeden Weg ab, auf dem ein solcher
Mischzustand neu entsteht (`backend/utils/konfiOderTeam.js`). Was vorher
entstanden ist, bleibt stehen, bis jemand entscheidet.

Diese Messung sagt, wie viel Altbestand es gibt. **Nur lesen, nichts
ändern.** In das Ergebnis gehören Anzahlen und Kennungen (`users.id`), keine
Namen, Benutzernamen oder E-Mail-Adressen.

Zugehörigkeit hat zwei Quellen: `users.organization_id`/`users.role_id`
(Stamm-Gemeinde) und `user_organizations` (weitere Gemeinden; Migration 101
hat außerdem jedes damalige Konto mit seiner Stamm-Gemeinde dort
eingetragen).

## 1. Konfi-Konten mit einer weiteren Gemeinde

Diese Konten überspringt die Auto-Löschung nach der Konfirmation seit dem
28.09.2026 (Tag 60 und 120) und schreibt dazu je Lauf eine Log-Zeile
„Auto-Deletion: Konto <id> übersprungen …".

- [ ] Abfrage:

```sql
SELECT u.id, o_stamm.id AS stamm_gemeinde, uo.organization_id AS weitere_gemeinde,
       r_dort.name AS rolle_dort, u.deleted_at IS NOT NULL AS soft_geloescht
  FROM users u
  JOIN roles r_stamm ON r_stamm.id = u.role_id AND r_stamm.name = 'konfi'
  JOIN organizations o_stamm ON o_stamm.id = u.organization_id
  JOIN user_organizations uo ON uo.user_id = u.id
                            AND uo.organization_id <> u.organization_id
  JOIN roles r_dort ON r_dort.id = uo.role_id
 ORDER BY u.id, uo.organization_id;
```

- [ ] **Ergebnis:** Anzahl Konten, Anzahl Zeilen, je Rolle dort die Anzahl.

## 2. Team-Konten mit einer Konfi-Zeile in einer anderen Gemeinde

Der Fall aus dem Produktionsbefund vom 27.09.2026 (Leitung zuhause, Konfi in
einer Testgemeinde).

- [ ] Abfrage:

```sql
SELECT u.id, u.organization_id AS stamm_gemeinde, r_stamm.name AS rolle_zuhause,
       uo.organization_id AS konfi_in
  FROM users u
  JOIN roles r_stamm ON r_stamm.id = u.role_id AND r_stamm.name <> 'konfi'
  JOIN user_organizations uo ON uo.user_id = u.id
                            AND uo.organization_id <> u.organization_id
  JOIN roles r_dort ON r_dort.id = uo.role_id AND r_dort.name = 'konfi'
 WHERE u.deleted_at IS NULL
 ORDER BY u.id;
```

- [ ] **Ergebnis:** Anzahl Konten; je Konto, ob es in der Konfi-Gemeinde ein
      Konfi-Profil gibt (`SELECT user_id, organization_id FROM konfi_profiles
      WHERE user_id = ANY(<Kennungen>)`).

## 3. Stamm-Gemeinde in `user_organizations` mit anderer Rolle

Wurde ein Konto nach Migration 101 befördert oder zuhause umgestellt, blieb
in `user_organizations` die alte Rolle stehen (seit dem 28.09.2026 ziehen
Beförderung und Rollenwechsel die Zeile mit). Wer dort noch `konfi` steht
hat, zählt für jede Abfrage über diese Tabelle weiter als Konfi.

- [ ] Abfrage:

```sql
SELECT r_stamm.name AS rolle_am_konto, r_zeile.name AS rolle_in_zeile, COUNT(*) AS anzahl
  FROM users u
  JOIN roles r_stamm ON r_stamm.id = u.role_id
  JOIN user_organizations uo ON uo.user_id = u.id
                            AND uo.organization_id = u.organization_id
  JOIN roles r_zeile ON r_zeile.id = uo.role_id
 WHERE r_stamm.name <> r_zeile.name
   AND u.deleted_at IS NULL
 GROUP BY 1, 2
 ORDER BY 3 DESC;
```

- [ ] **Ergebnis:** die Tabelle (Rolle am Konto, Rolle in der Zeile, Anzahl).

## 4. Offene Einladungen an Konfis oder mit der Konfi-Rolle

Vor dem 26.09.2026 (Sicherheit BF-03) möglich. Seit dem 28.09.2026 lehnt die
Annahme sie mit 409 ab; sie laufen nach 14 Tagen ab.

- [ ] Abfrage:

```sql
SELECT e.id, e.organization_id, e.user_id, r_angebot.name AS angebotene_rolle,
       r_konto.name AS rolle_am_konto, e.expires_at
  FROM org_einladungen e
  JOIN roles r_angebot ON r_angebot.id = e.role_id
  JOIN users u ON u.id = e.user_id
  JOIN roles r_konto ON r_konto.id = u.role_id
 WHERE e.status = 'offen'
   AND (r_angebot.name = 'konfi' OR r_konto.name = 'konfi');
```

- [ ] **Ergebnis:** Anzahl.

## 5. Verschiedene Team-Rollen je Gemeinde

Keine Mischkonten, aber Grundlage für die Gesprächsvorlage
`docs/audit/2026-09-28/mehrfach-konten.md` (etwa zuhause Org-Admin, woanders
Teamer:in).

- [ ] Abfrage:

```sql
SELECT r_stamm.name AS rolle_zuhause, r_dort.name AS rolle_dort, COUNT(DISTINCT u.id) AS konten
  FROM users u
  JOIN roles r_stamm ON r_stamm.id = u.role_id
  JOIN user_organizations uo ON uo.user_id = u.id
                            AND uo.organization_id <> u.organization_id
  JOIN roles r_dort ON r_dort.id = uo.role_id
 WHERE u.deleted_at IS NULL
   AND r_stamm.name <> 'konfi' AND r_dort.name <> 'konfi'
 GROUP BY 1, 2
 ORDER BY 3 DESC;
```

- [ ] **Ergebnis:** die Tabelle. Dazu die Gesamtzahl der Konten mit mindestens
      einer weiteren Gemeinde.

## Rückmeldung

Die Zahlen unter die Punkte schreiben (Datum, Messwert) und in
`docs/audit/2026-09-26/backend-fachlogik-punkte-termine.md`, Abschnitt
„Nachtrag 27.09.2026: Rolle je Gemeinde", eine Zeile „gemessen TT.MM.JJJJ — …"
ergänzen. Was mit gefundenen Mischkonten geschieht, entscheidet Simon;
bis dahin nichts ändern.
