# Chat System API Dokumentation

## Übersicht
Das Chat-System unterstützt Multi-Room-Chats mit verschiedenen Nachrichtentypen, Datei-Uploads, Polls und Push-Notifications. Alle Routen erfordern `verifyTokenRBAC` Authentifizierung.

---

## Datenbank-Architektur

### Kern-Tabellen:
```sql
-- Chat Räume
chat_rooms: id, name, type, jahrgang_id, created_by, organization_id

-- Nachrichten  
chat_messages: id, room_id, user_id, user_type, message_type, content, file_path, file_name, file_size, reply_to, created_at, deleted_at

-- Teilnehmer
chat_participants: id, room_id, user_id, user_type, joined_at

-- Read Status
chat_read_status: id, room_id, user_id, last_read_at

-- Polls
chat_polls: id, message_id, question, options (JSON as TEXT), multiple_choice, expires_at

-- Poll Votes
chat_poll_votes: id, poll_id, user_id, user_type, option_index, voted_at
```

---

## API Endpoints

### 1. GET `/api/chat/rooms`
**Zweck:** Alle Chat-Räume für den aktuellen User abrufen

**Berechtigung:** `verifyTokenRBAC`

**Response:**
```json
[
  {
    "id": 1,
    "name": "2024/25 Jahrgang",
    "type": "jahrgang",
    "jahrgang_id": 5,
    "created_by": 1,
    "organization_id": 1,
    "created_at": "2024-01-01T10:00:00Z",
    "unread_count": 3,
    "last_message": {
      "content": "Hallo zusammen!",
      "sender_name": "Max Mustermann",
      "created_at": "2024-01-01T12:00:00Z"
    }
  }
]
```

**Funktionsweise:**
- Lädt alle Räume basierend auf `chat_participants` Membership
- Berechnet `unread_count` basierend auf `chat_read_status.last_read_at`
- Lädt die letzte Nachricht für Preview
- Filtert nach `organization_id` für Multi-Tenancy

---

### 2. GET `/api/chat/rooms/:roomId/messages`
**Zweck:** Nachrichten für einen Chat-Raum laden

**Berechtigung:** `verifyTokenRBAC` + Room-Access-Check

**Parameter:**
- `:roomId` - Chat Room ID
- `?limit=50` - Anzahl Messages (default: 50)
- `?offset=0` - Offset für Pagination (default: 0)

**Response:**
```json
{
  "messages": [
    {
      "id": 123,
      "room_id": 1,
      "sender_id": 45,
      "sender_type": "konfi",
      "sender_name": "Max Mustermann",
      "sender_username": "max.mustermann",
      "message_type": "text",
      "content": "Hallo zusammen!",
      "created_at": "2024-01-01T12:00:00Z",
      "is_deleted": false,
      "reply_to": null
    },
    {
      "id": 124,
      "message_type": "poll",
      "content": "Was wollen wir nächste Woche machen?",
      "question": "Was wollen wir nächste Woche machen?",
      "options": ["Gottesdienst", "Ausflug", "Basteln"],
      "multiple_choice": false,
      "expires_at": "2024-01-08T12:00:00Z",
      "poll_id": 15,
      "votes": [
        {
          "user_id": 45,
          "user_type": "konfi",
          "option_index": 0,
          "voter_name": "Max Mustermann"
        }
      ]
    },
    {
      "id": 125,
      "message_type": "file",
      "content": "",
      "file_path": "/uploads/chat/abc123.jpg",
      "file_name": "gruppenfoto.jpg",
      "file_size": 245760
    }
  ],
  "room": {
    "id": 1,
    "name": "2024/25 Jahrgang",
    "type": "jahrgang"
  }
}
```

**Wichtige Features:**
- **Poll Support:** `options` werden von JSON-Text zu Array geparst
- **File Attachments:** Dateiname, Größe und Pfad
- **Soft Delete:** Gelöschte Nachrichten zeigen "Diese Nachricht wurde gelöscht"
- **Reply Threading:** `reply_to` für Antworten auf andere Nachrichten

---

### 3. POST `/api/chat/rooms/:roomId/messages`
**Zweck:** Neue Nachricht senden (Text, Datei oder Poll)

**Berechtigung:** `verifyTokenRBAC` + Room-Access-Check

**Content-Type:** `multipart/form-data` (für Datei-Uploads)

**Request Body (Text Message):**
```json
{
  "content": "Hallo zusammen!",
  "message_type": "text",
  "reply_to": 122
}
```

**Request Body (Poll):**
```json
{
  "content": "Was wollen wir machen?",
  "message_type": "poll",
  "poll_question": "Was wollen wir nächste Woche machen?",
  "poll_options": ["Gottesdienst", "Ausflug", "Basteln"],
  "poll_multiple_choice": false,
  "poll_expires_at": "2024-01-08T12:00:00Z"
}
```

**Request Body (File Upload):**
```
FormData:
- file: [Binary File Data]
- content: "Schaut mal das Foto!"
- message_type: "file"
```

**Response:**
```json
{
  "id": 126,
  "room_id": 1,
  "sender_id": 45,
  "sender_name": "Max Mustermann",
  "message_type": "text",
  "content": "Hallo zusammen!",
  "created_at": "2024-01-01T12:05:00Z"
}
```

**File Upload Unterstützung:**
- **Erlaubte Formate:** jpeg, jpg, png, gif, heic, webp, pdf, mp3, wav, m4a, mp4, mov, avi, docx, txt, pptx, xlsx, rtf, zip
- **Max Größe:** 10MB
- **Speicherort:** `/uploads/chat/`
- **MIME-Type Validation:** Strenge Prüfung gegen erlaubte MIME-Types

---

### 4. POST `/api/chat/rooms/:roomId/polls/:pollId/vote`
**Zweck:** Für Poll-Option abstimmen

**Berechtigung:** `verifyTokenRBAC` + Room-Access-Check

**Request Body:**
```json
{
  "option_index": 1
}
```

**Response:**
```json
{
  "message": "Vote recorded successfully",
  "poll_id": 15,
  "option_index": 1,
  "user_id": 45
}
```

**Funktionsweise:**
- Prüft, ob Poll noch nicht abgelaufen ist (`expires_at`)
- Bei Single-Choice: Entfernt vorherige Stimme desselben Users
- Bei Multiple-Choice: Erlaubt mehrere Stimmen
- Verhindert doppelte Stimmen für dieselbe Option

---

### 5. POST `/api/chat/rooms/:roomId/mark-read`
**Zweck:** Raum als gelesen markieren

**Berechtigung:** `verifyTokenRBAC` + Room-Access-Check

**Response:**
```json
{
  "message": "Room marked as read",
  "room_id": 1,
  "last_read_at": "2024-01-01T12:10:00Z"
}
```

**Funktionsweise:**
- Aktualisiert `chat_read_status.last_read_at` auf aktuelle Zeit
- Wird für Unread-Counter in Room-Liste verwendet
- UPSERT Operation (INSERT oder UPDATE)

---

### 6. DELETE `/api/chat/rooms/:roomId/messages/:messageId`
**Zweck:** Nachricht löschen (Soft Delete)

**Berechtigung:** `verifyTokenRBAC` + Message-Owner-Check

**Response:**
```json
{
  "message": "Message deleted successfully",
  "message_id": 123
}
```

**Funktionsweise:**
- **Soft Delete:** Setzt `deleted_at` Timestamp
- Nachricht wird als "Diese Nachricht wurde gelöscht" angezeigt
- Nur Eigentümer oder Admins können löschen
- Datei-Attachments bleiben physisch erhalten

---

### 7. POST `/api/chat/rooms`
**Zweck:** Neuen Chat-Raum erstellen

**Berechtigung:** `verifyTokenRBAC` (meist nur Admins)

**Request Body:**
```json
{
  "name": "Spezial Gruppe",
  "type": "custom",
  "jahrgang_id": null
}
```

**Response:**
```json
{
  "id": 15,
  "name": "Spezial Gruppe",
  "type": "custom",
  "organization_id": 1,
  "created_by": 1
}
```

**Room Types:**
- `jahrgang` - Automatischer Jahrgang-Chat
- `custom` - Manuell erstellter Raum
- `direct` - 1:1 Direct Messages (geplant)

---

## File Serving

### GET `/api/chat/files/:filename`
**Zweck:** Chat-Dateien ausliefern

**Berechtigung:** Keine (öffentlich über NGINX)

**Response:** Binary File Data mit korrekten MIME-Headers

**Beispiel:** 
```
GET /api/chat/files/abc123_gruppenfoto.jpg
→ Liefert JPEG-Datei mit Content-Type: image/jpeg
```

---

## Push Notifications

### Integration mit FCM (Firebase Cloud Messaging)
- **Trigger:** Neue Nachricht in Room
- **Payload:** 
  ```json
  {
    "title": "Neue Nachricht in 2024/25 Jahrgang",
    "body": "Max Mustermann: Hallo zusammen!",
    "data": {
      "room_id": "1",
      "message_id": "123",
      "sender_id": "45"
    }
  }
  ```
- **Filtering:** Nur an Room-Teilnehmer (außer Sender)

---

## Sicherheitsaspekte

### 1. **Room Access Control**
```sql
-- Prüfung für jeden Message-Request:
SELECT 1 FROM chat_participants cp 
JOIN chat_rooms cr ON cp.room_id = cr.id 
WHERE cp.room_id = $1 AND cp.user_id = $2 AND cr.organization_id = $3
```

### 2. **Organization Isolation**
- Alle Räume haben `organization_id`
- Cross-Organization Access wird blockiert
- Teilnehmer können nur Räume ihrer Organisation sehen

### 3. **File Upload Security**
- **Extension Whitelist:** Nur erlaubte Dateitypen
- **MIME-Type Validation:** Doppelte Prüfung gegen Spoofing
- **Size Limits:** 10MB Maximum
- **Isolation:** Files in `/uploads/chat/` mit Random-Namen

### 4. **Poll Security**
- **Expiration Check:** Votes nur vor `expires_at`
- **Duplicate Prevention:** UNIQUE constraint auf (poll_id, user_id, option_index)
- **JSON Validation:** Options werden serverseitig validiert

---

## Performance Considerations

### 1. **Message Pagination**
- Default: 50 Messages pro Request
- LIMIT/OFFSET für ältere Nachrichten
- Index auf `(room_id, created_at DESC)`

### 2. **Unread Count Optimization**
```sql
-- Efficient unread counting:
SELECT COUNT(*) FROM chat_messages cm 
LEFT JOIN chat_read_status crs ON cm.room_id = crs.room_id AND crs.user_id = $1
WHERE cm.room_id = $2 AND (crs.last_read_at IS NULL OR cm.created_at > crs.last_read_at)
```

### 3. **Poll Vote Aggregation**
- Votes werden bei Message-Load aggregiert
- Könnte bei vielen Votes zu Materialized Views optimiert werden

---

## Häufige Fehlerquellen

### 1. **Poll Options Parsing**
**Problem:** `options` als TEXT gespeichert, Frontend erwartet Array
**Lösung:** JSON.parse() im Backend vor Response

### 2. **File Upload CORS**
**Problem:** Multipart uploads scheitern bei CORS-Problemen  
**Lösung:** Korrekte CORS-Headers für file endpoints

### 3. **Room Access Denial**
**Problem:** 403 Errors bei legitimen Usern
**Debug:** `chat_participants` Membership prüfen

### 4. **Push Notification Failures**
**Problem:** FCM Tokens expired oder ungültig
**Lösung:** Token-Refresh-Mechanismus implementiert

---

## Database Schema Updates für Performance

### Empfohlene Indexes:
```sql
-- Message Loading Performance
CREATE INDEX idx_chat_messages_room_created ON chat_messages (room_id, created_at DESC);

-- Unread Count Performance  
CREATE INDEX idx_chat_read_status_user_room ON chat_read_status (user_id, room_id);

-- Poll Performance
CREATE INDEX idx_chat_poll_votes_poll ON chat_poll_votes (poll_id);
CREATE INDEX idx_chat_polls_message ON chat_polls (message_id);

-- File Access
CREATE INDEX idx_chat_messages_file_path ON chat_messages (file_path) WHERE file_path IS NOT NULL;
```