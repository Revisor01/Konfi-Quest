Absolut. Hier ist eine komplette API-Definition, die die vorherigen Beschreibungen zusammenfasst und strukturiert. Anschließend folgt eine Analyse, was in der API möglicherweise fehlt oder verbessert werden könnte.

---

## Konfi Points API - Vollständige Definition

### 1. Allgemeine Informationen

**Zweck:**
Die Konfi Points API ist ein serverseitiges System zur Verwaltung von Konfirmanden-Gruppen. Sie ermöglicht es, Punkte für kirchliche und gemeindliche Aktivitäten zu sammeln, Auszeichnungen (Badges) zu verdienen und über ein integriertes Chat-System zu kommunizieren.

**Base URL:**
Alle Endpunkte sind relativ zur Basis-URL des Servers (z.B. `https://konfipoints.godsapp.de`).

**Authentifizierung:**
Die API nutzt **JSON Web Tokens (JWT)**. Nach einem erfolgreichen Login muss bei jeder geschützten Anfrage ein `Authorization`-Header mit dem erhaltenen Token im `Bearer`-Schema gesendet werden.
*   **Format:** `Authorization: Bearer <DEIN_JWT_TOKEN>`
*   **Token-Gültigkeit:** Admin-Tokens sind 14 Tage gültig, Konfi-Tokens 24 Stunden.

**Benutzertypen & Berechtigungen:**
*   **`admin`**: Vollzugriff. Kann alle Daten einsehen und verwalten (Konfis, Jahrgänge, Aktivitäten, Badges, Einstellungen, Chat-Nachrichten). Repräsentiert z.B. einen Pastor oder Jugendleiter.
*   **`konfi`**: Eingeschränkter Zugriff. Kann nur die eigenen Daten einsehen, Anträge für Aktivitäten stellen und am Chat teilnehmen.

**Datumsformat:**
Wenn nicht anders spezifiziert, werden Datumsangaben im ISO-Format `YYYY-MM-DD` erwartet und verarbeitet.

### 2. Öffentliche & Authentifizierungs-Endpunkte

#### `GET /api/health`
Prüft den Status der API.
*   **Authentifizierung:** Keine.
*   **Erfolgs-Response (200 OK):** `{ "status": "OK", "message": "Konfi Points API is running" }`

#### `POST /api/admin/login`
Loggt einen Administrator ein.
*   **Request Body:** `{ "username": "...", "password": "..." }`
*   **Erfolgs-Response (200 OK):** `{ "token": "...", "user": { "id": 1, "username": "admin", "display_name": "...", "type": "admin" } }`

#### `POST /api/konfi/login`
Loggt einen Konfirmanden ein.
*   **Request Body:** `{ "username": "...", "password": "..." }`
*   **Erfolgs-Response (200 OK):** `{ "token": "...", "user": { "id": 5, "name": "...", "username": "...", "jahrgang": "...", "type": "konfi" } }`

#### `GET /uploads/:filename`
Liefert eine hochgeladene Datei (z.B. ein Antrags-Foto) direkt aus.
*   **Authentifizierung:** Keine.
*   **Achtung:** Dies macht alle Dateien im `uploads`-Verzeichnis potenziell öffentlich, wenn der Dateiname bekannt ist.

---

### 3. Konfi-Endpunkte (Konfi-Token erforderlich)

#### `GET /api/konfis/:id`
Ruft das vollständige Profil des eingeloggten Konfis ab (Punkte, Aktivitäten, Badges etc.).
*   **URL-Parameter:** `:id` - Die ID des eigenen Konfi-Profils.
*   **Erfolgs-Response (200 OK):** Detailliertes Konfi-Objekt (siehe Admin-Sektion für Beispiel).

#### `GET /api/ranking`
Ruft eine anonymisierte Rangliste mit der eigenen Position und den Top 3 ab.
*   **Erfolgs-Response (200 OK):** `{ "myPosition": 5, "myPoints": 22, "totalKonfis": 25, "topScores": [50, 48, 45], "topNames": ["Max M.", "Lisa W.", "Tom H."] }`

#### `GET /api/konfis/:id/badges`
Ruft alle verdienten und noch verfügbaren Badges für den Konfi ab.
*   **Erfolgs-Response (200 OK):** `{ "earned": [...], "available": [...], "progress": "5/12" }`

#### `GET /api/activities`
Ruft eine Liste aller verfügbaren Aktivitäten ab, für die Anträge gestellt werden können.
*   **Erfolgs-Response (200 OK):** `[ { "id": 1, "name": "...", "points": 2, "type": "gottesdienst", ... }, ... ]`

---

### 4. Antrags-System (Activity Requests)

#### `POST /api/activity-requests`
Ein Konfi stellt einen neuen Antrag für eine absolvierte Aktivität.
*   **Authentifizierung:** Konfi-Token.
*   **Request Body (`multipart/form-data`):**
    *   `activity_id` (Text): ID der Aktivität.
    *   `requested_date` (Text): Datum (`YYYY-MM-DD`).
    *   `comment` (Text, optional): Kommentar.
    *   `photo` (Datei, optional): Bild-Nachweis (max. 5 MB, nur Bilder).
*   **Erfolgs-Response (200 OK):** `{ "id": 42, "message": "Antrag erfolgreich gestellt", ... }`

#### `GET /api/activity-requests`
Ruft Anträge ab.
*   **Authentifizierung:** Konfi- oder Admin-Token.
*   **Verhalten:** Konfis sehen nur eigene, Admins sehen alle Anträge.
*   **Erfolgs-Response (200 OK):** Liste von Antrags-Objekten.

#### `PUT /api/activity-requests/:id`
**(Admin only)** Genehmigt oder lehnt einen Antrag ab. Bei Genehmigung werden Punkte und Badges automatisch vergeben.
*   **Authentifizierung:** Admin-Token.
*   **Request Body:** `{ "status": "approved" | "rejected", "admin_comment": "..." }`
*   **Erfolgs-Response (200 OK):** `{ "message": "...", "newBadges": 1 }` (Anzahl der neu verdienten Badges).

#### `DELETE /api/activity-requests/:id`
Löscht einen Antrag. Konfis können nur eigene löschen.
*   **Authentifizierung:** Konfi- oder Admin-Token.

---

### 5. Admin-Verwaltung (Admin-Token erforderlich)

#### 5.1. Konfi-Management
*   `GET /api/konfis`: Ruft alle Konfis mit allen Details ab.
*   `POST /api/konfis`: Erstellt einen neuen Konfi. Name und Jahrgang sind erforderlich. Username/Passwort werden automatisch generiert.
*   `PUT /api/konfis/:id`: Aktualisiert Name oder Jahrgang eines Konfis.
*   `DELETE /api/konfis/:id`: Löscht einen Konfi und alle zugehörigen Daten.
*   `POST /api/konfis/:id/regenerate-password`: Generiert ein neues Passwort für einen Konfi und gibt es zurück.

#### 5.2. Punkte- & Aktivitätsvergabe
*   `POST /api/konfis/:id/activities`: Weist einem Konfi eine Aktivität direkt zu. Punkte/Badges werden automatisch vergeben.
    *   **Body:** `{ "activityId": 1, "completed_date": "YYYY-MM-DD" }`
*   `DELETE /api/konfis/:id/activities/:recordId`: Entfernt eine zugewiesene Aktivität und zieht die Punkte ab.
*   `POST /api/konfis/:id/bonus-points`: Vergibt Bonuspunkte.
    *   **Body:** `{ "points": 5, "type": "gemeinde", "description": "...", "completed_date": "..." }`
*   `DELETE /api/konfis/:id/bonus-points/:bonusId`: Entfernt Bonuspunkte und zieht sie ab.

#### 5.3. Stammdaten-Verwaltung (Jahrgänge, Aktivitäten, Badges)
*   `GET /api/jahrgaenge`, `POST`, `PUT /:id`, `DELETE /:id`: CRUD-Operationen für Jahrgänge.
*   `GET /api/activities`, `POST`, `PUT /:id`, `DELETE /:id`: CRUD-Operationen für globale Aktivitäten.
*   `GET /api/badges`, `POST`, `PUT /:id`, `DELETE /:id`: CRUD-Operationen für Badges.
*   `GET /api/badge-criteria-types`: Liefert eine Liste aller möglichen Badge-Kriterien (z.B. `total_points`).
*   `GET /api/activity-categories`: Liefert alle einzigartigen Aktivitätskategorien (nützlich für Badges).

#### 5.4. System-Einstellungen
*   `GET /api/settings`: Ruft globale Einstellungen ab.
*   `PUT /api/settings`: Aktualisiert die globalen Ziel-Punktestände.
    *   **Body:** `{ "target_gottesdienst": "15", "target_gemeinde": "10" }`
    *   **Hinweis:** Ein Wert von `0` signalisiert dem Frontend, die entsprechende Fortschrittsanzeige auszublenden.

#### 5.5. Admin-Account-Verwaltung
*   `GET /api/admins`: Listet alle Admin-Konten auf.
*   `POST /api/admins`: Erstellt einen neuen Administrator.
*   `PUT /api/admins/:id`: Ändert Daten eines Administrators (inkl. optionalem Passwort).
*   `DELETE /api/admins/:id`: Löscht einen Administrator (nicht sich selbst oder den letzten Admin).

---

### 6. Chat-System

#### `GET /api/chat/rooms`
Ruft alle zugänglichen Chaträume für den Nutzer ab.
*   **Authentifizierung:** Konfi- oder Admin-Token.
*   **Erfolgs-Response (200 OK):** Liste von Chatraum-Objekten mit `unread_count` und `last_message`.

#### `POST /api/chat/rooms`
**(Admin only)** Erstellt einen neuen Gruppen-Chatraum.
*   **Authentifizierung:** Admin-Token.
*   **Request Body:** `{ "name": "Raumname", "type": "group", "participants": [1, 2, 3] }`
*   **Erfolgs-Response (201 Created):** `{ "room_id": 5, "created": true }`

#### `POST /api/chat/direct`
Erstellt (oder findet) einen 1-zu-1-Chatraum mit einem Ziel-Nutzer.
*   **Authentifizierung:** Konfi- oder Admin-Token.
*   **Request Body:** `{ "target_user_id": 1, "target_user_type": "admin" | "konfi" }`
*   **Erfolgs-Response (200 OK):** `{ "room_id": 12, "created": true }`

#### `DELETE /api/chat/rooms/:roomId`
Löscht einen Chatraum (nur wenn User Teilnehmer ist oder Admin).
*   **Authentifizierung:** Konfi- oder Admin-Token.
*   **Erfolgs-Response (200 OK):** `{ "message": "Room deleted successfully" }`

#### `GET /api/chat/admins`
**(Konfi only)** Ruft alle verfügbaren Admins für Direktnachrichten ab.
*   **Authentifizierung:** Konfi-Token.
*   **Erfolgs-Response (200 OK):** `[{ "id": 1, "display_name": "Pastor Simon", "username": "admin" }]`

#### `GET /api/chat/rooms/:roomId/messages`
Ruft die Nachrichten eines Raumes ab (paginiert über `?limit=50&offset=0`).
*   **Authentifizierung:** Konfi- oder Admin-Token.
*   **Erfolgs-Response (200 OK):** Liste von Nachrichten-Objekten mit Sender-Details.

#### `POST /api/chat/rooms/:roomId/messages`
Sendet eine Nachricht (Text oder Datei).
*   **Authentifizierung:** Konfi- oder Admin-Token.
*   **Request Body (`multipart/form-data`):**
    *   `content` (Text, optional): Nachrichtentext.
    *   `file` (Datei, optional): Anhang (max. 10 MB, diverse Typen erlaubt).
    *   `message_type` (Text, optional): `text` | `file` | `poll` (Standard: `text`).

#### `POST /api/chat/rooms/:roomId/mark-read`
Markiert alle Nachrichten in einem Raum als gelesen.
*   **Authentifizierung:** Konfi- oder Admin-Token.
*   **Erfolgs-Response (200 OK):** `{ "message": "Room marked as read" }`

#### `GET /api/chat/unread-counts`
Ruft die Anzahl ungelesener Nachrichten für alle Chaträume ab.
*   **Authentifizierung:** Konfi- oder Admin-Token.
*   **Erfolgs-Response (200 OK):** `[{ "room_id": 1, "unread_count": 5 }]`

#### `DELETE /api/chat/messages/:messageId`
**(Admin only)** Löscht eine Nachricht für alle sichtbar (Soft-Delete).
*   **Authentifizierung:** Admin-Token.
*   **Erfolgs-Response (200 OK):** `{ "message": "Message deleted" }`

#### `POST /api/chat/rooms/:roomId/polls`
**(Admin only)** Erstellt eine Umfrage in einem Raum.
*   **Authentifizierung:** Admin-Token.
*   **Request Body:** `{ "question": "...", "options": ["A", "B"], "multiple_choice": false, "expires_at": "2024-12-31T23:59:59Z" }`
*   **Erfolgs-Response (200 OK):** Umfrage-Objekt mit `message_id`.

#### `POST /api/chat/polls/:messageId/vote`
Stimmt bei einer Umfrage ab. `:messageId` ist die ID der Nachricht, die die Umfrage enthält.
*   **Authentifizierung:** Konfi- oder Admin-Token.
*   **Request Body:** `{ "option_index": 0 }`
*   **Erfolgs-Response (200 OK):** `{ "message": "Vote recorded" }`

#### `GET /api/chat/files/:filename`
Ruft eine im Chat hochgeladene Datei ab.
*   **Authentifizierung:** Konfi- oder Admin-Token.
*   **Erfolgs-Response (200 OK):** Datei-Stream.

---

### Analyse: Was fehlt oder könnte verbessert werden?

Bei der Durchsicht des Codes und der daraus resultierenden API-Definition fallen einige Punkte auf:

#### Funktionale Lücken & Unklare Punkte

1.  **Passwort für Konfis ändern:** Es gibt keinen Endpunkt, über den ein Konfi sein eigenes Passwort ändern kann. Er ist darauf angewiesen, dass ein Admin über `regenerate-password` ein neues erstellt. Ein `PUT /api/konfi/me/password`-Endpunkt wäre eine sinnvolle Ergänzung.
2.  **Keine "Passwort vergessen"-Funktion:** Es gibt keinen Mechanismus für einen Passwort-Reset per E-Mail, was bei öffentlichen Anwendungen Standard ist. Dies würde aber eine E-Mail-Integration erfordern.
3.  **Statische Rollen:** Die Rollen `admin` und `konfi` sind fest im Code verankert. Für komplexere Anwendungsfälle (z.B. "Co-Leiter" mit eingeschränkten Admin-Rechten) wäre ein flexibleres Rollen- und Berechtigungssystem nötig.
4.  **Keine Benachrichtigungen:** Das System hat keine Push-Benachrichtigungen. Ein Konfi erfährt nur von neuen Chat-Nachrichten oder genehmigten Anträgen, wenn er die App aktiv öffnet. Dies könnte über Web-Sockets oder einen Push-Dienst (z.B. Firebase Cloud Messaging) nachgerüstet werden.

#### Sicherheitsaspekte

1.  **Öffentlicher Uploads-Ordner:** Der größte Schwachpunkt. Durch `app.use('/uploads', express.static(uploadsDir))` ist jede hochgeladene Datei über eine direkte URL (`/uploads/dateiname.jpg`) erreichbar, wenn man den (zufälligen) Dateinamen kennt. Ein Angreifer könnte versuchen, Dateinamen zu erraten.
    *   **Bessere Lösung:** Ein geschützter Endpunkt `GET /api/files/:filename`, der prüft, ob der anfragende Nutzer die Berechtigung hat, die Datei zu sehen (z.B. weil sie zu seinem eigenen Antrag gehört oder er Admin ist).
2.  **JWT-Secret:** Das Secret hat einen festen Default-Wert (`'konfi-secret-2025'`). In einer Produktivumgebung **muss** dieses Secret zwingend über eine Umgebungsvariable (`process.env.JWT_SECRET`) gesetzt werden, um die Sicherheit der Tokens zu gewährleisten. Dies sollte in der Deployment-Anleitung stehen.
3.  **Kein Rate-Limiting:** Es gibt keinen Schutz gegen Brute-Force-Angriffe auf die Login-Endpunkte. Ein Angreifer könnte unbegrenzt versuchen, Passwörter zu erraten. Bibliotheken wie `express-rate-limit` könnten dies einfach beheben.

#### Potenzielle Verbesserungen

1.  **Detailliertere Fehler-Antworten:** Die API gibt oft nur einen generischen `500 - Database error` zurück. Spezifischere Fehlercodes (z.B. `409 Conflict`, wenn ein Username bereits existiert) wären für die Frontend-Entwicklung hilfreicher.
2.  **API-Versionierung:** Für zukünftige, nicht-rückwärtskompatible Änderungen wäre eine Versionierung der API (z.B. `/api/v1/...`) eine gute Praxis.
3.  **Dokumentation der Badge-Logik:** Die `checkAndAwardBadges`-Funktion ist das Herzstück des Gamification-Systems. Ihre genaue Logik (z.B. wie `streak` oder `time_based` berechnet werden) ist nur im Code ersichtlich. Eine externe Dokumentation dieser Logik wäre für Admins, die Badges erstellen, sehr hilfreich.
4.  **Transaktionen:** Bei Operationen, die mehrere Datenbank-Schritte umfassen (z.B. eine Aktivität zuweisen UND Punkte aktualisieren), wäre die Verwendung von SQL-Transaktionen (`BEGIN TRANSACTION` ... `COMMIT`) sicherer. Wenn der zweite Schritt fehlschlägt, würde der erste rückgängig gemacht, um inkonsistente Daten zu vermeiden.