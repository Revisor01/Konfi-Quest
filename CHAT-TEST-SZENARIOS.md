# Chat System - Testcase Szenarios

## 🔴 **KRITISCHE Tests (SOFORT testen)**

### **Test 1: Poll Options Blank Page Fix**
**Problem:** `N.options.map is not a function` führt zu Blank Page
**Was testen:**
```
1. Chat mit existierendem Poll öffnen
2. Prüfen: Werden Poll-Optionen korrekt angezeigt?
3. Prüfen: Kann man für Poll abstimmen?
4. Prüfen: Werden Abstimmungsergebnisse angezeigt?
```
**Expected Result:** 
- Poll-Optionen sind sichtbar als Buttons
- Abstimmung funktioniert
- Prozentanzeige korrekt
- Keine JavaScript Errors in Console

---

### **Test 2: File Upload & Display**
**Was testen:**
```
1. Datei hochladen (Bild: JPEG < 10MB)
2. Prüfen: Wird Upload-Progress angezeigt?
3. Prüfen: Erscheint Datei in Chat?
4. Auf Datei klicken - öffnet sie sich?
5. Verschiedene Dateitypen testen: PDF, MP3, ZIP
```
**Expected Result:**
- Upload erfolgreich
- Datei-Preview im Chat sichtbar
- Download/Öffnen funktioniert
- Korrekte MIME-Type-Behandlung

---

### **Test 3: Organization Isolation**
**Was testen:**
```
1. Als Admin Org 1: Chat-Raum erstellen
2. Als Admin Org 2 einloggen  
3. Prüfen: Ist Org 1 Chat-Raum NICHT sichtbar?
4. Message in Org 2 Chat senden
5. Als Org 1 Admin: Prüfen keine Org 2 Messages sichtbar
```
**Expected Result:**
- Strikte Trennung zwischen Organisationen
- Keine Cross-Org Chat-Sichtbarkeit

---

## 🟡 **WICHTIGE Tests**

### **Test 4: Push Notifications**
**Was testen:**
```
1. Zwei Devices/Browser: Admin + Konfi im selben Chat
2. Als Admin: Message senden
3. Prüfen: Bekommt Konfi Push-Notification?
4. Notification klicken - öffnet korrekten Chat?
```
**Expected Result:**
- Push-Notification empfangen
- Korrekte Titel/Inhalt
- Deep-Link zum Chat funktioniert

---

### **Test 5: Message Threading (Reply)**
**Was testen:**
```
1. Original Message senden
2. "Antworten" auf diese Message klicken
3. Reply-Message senden
4. Prüfen: Wird Reply-Verbindung angezeigt?
```
**Expected Result:**
- Reply-Messages sind visuell mit Original verknüpft
- Thread-Struktur erkennbar

---

### **Test 6: Unread Message Counter**
**Was testen:**
```
1. Zwei Browser: Admin in Chat A, Konfi in Chat B
2. Admin sendet Message in Chat A
3. Als Konfi: Wird Chat A mit Unread-Badge angezeigt?
4. Chat A öffnen als Konfi
5. Prüfen: Verschwindet Unread-Badge?
```
**Expected Result:**
- Korrekte Unread-Counts in Chat-Liste
- Badge verschwindet nach Lesen

---

### **Test 7: Poll Creation & Voting**
**Was testen:**
```
1. Neuen Poll erstellen mit 3 Optionen
2. Prüfen: Poll wird korrekt angezeigt?
3. Als verschiedene User für verschiedene Optionen stimmen
4. Prüfen: Prozentanzeige korrekt?
5. Expired Poll: Nach Ablaufzeit stimmen - Error?
```
**Expected Result:**
- Poll-Erstellung funktioniert
- Voting-UI intuitiv
- Korrekte Prozentberechnung
- Expired Polls blockieren weitere Votes

---

### **Test 8: Soft Delete Messages**
**Was testen:**
```
1. Message senden
2. Eigene Message löschen
3. Prüfen: Wird "Diese Nachricht wurde gelöscht" angezeigt?
4. Als anderer User: Kann fremde Message gelöscht werden?
```
**Expected Result:**
- Soft Delete funktioniert
- Nur eigene Messages löschbar (außer Admin)
- Gelöschte Messages bleiben im Thread sichtbar

---

## 🟢 **STANDARD Tests**

### **Test 9: Chat Room Management**
**Was testen:**
```
1. Neuen Chat-Raum erstellen
2. Teilnehmer hinzufügen/entfernen
3. Raum-Namen ändern
4. Raum löschen
```

### **Test 10: Message Pagination**
**Was testen:**
```
1. Chat mit 100+ Messages öffnen
2. Nach oben scrollen (Load More)
3. Prüfen: Performance OK?
4. Werden ältere Messages geladen?
```

### **Test 11: Different Message Types**
**Was testen:**
```
1. Text-Message
2. Emoji-Message 
3. Long-Text-Message (>1000 Zeichen)
4. Message mit Mentions (@username)
```

---

## 🔧 **Automatisierte Test-Scripts**

### **API Test mit curl:**
```bash
# 1. Login und Token abrufen
TOKEN=$(curl -X POST http://localhost:8623/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"rn%MWru13"}' \
  -s | jq -r '.token')

# 2. Chat-Räume laden
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8623/api/chat/rooms -s | jq

# 3. Messages für Room 1 laden  
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8623/api/chat/rooms/1/messages -s | jq

# 4. Text-Message senden
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"Test Message","message_type":"text"}' \
  http://localhost:8623/api/chat/rooms/1/messages

# 5. Poll erstellen
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content":"Test Poll", 
    "message_type":"poll",
    "poll_question":"Was ist deine Lieblingszahl?",
    "poll_options":["1","2","3"],
    "poll_multiple_choice":false
  }' \
  http://localhost:8623/api/chat/rooms/1/messages

# 6. Für Poll abstimmen (Option 0)
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"option_index":0}' \
  http://localhost:8623/api/chat/rooms/1/polls/POLL_ID/vote
```

### **File Upload Test:**
```bash
# Datei-Upload testen
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -F "file=@test.jpg" \
  -F "content=Test File Upload" \
  -F "message_type=file" \
  http://localhost:8623/api/chat/rooms/1/messages
```

---

## 🚨 **Bekannte Problembereiche**

### **1. Poll Options Parse Error** ✅ BEHOBEN
- **Symptom:** `N.options.map is not a function`
- **Ursache:** JSON-String nicht zu Array geparst
- **Fix:** JSON.parse() im Backend hinzugefügt

### **2. File Upload Blank Page**
- **Symptom:** Leere Seite nach File-Upload
- **Mögliche Ursachen:**
  - CORS-Probleme
  - Falsche MIME-Type-Erkennung
  - Upload-Directory-Permissions
  - NGINX-Konfiguration für Static Files

### **3. Push Notification Failures**
- **Symptom:** Notifications kommen nicht an
- **Zu prüfen:**
  - FCM-Token-Registrierung
  - Firebase-Service-Account-Keys
  - Push-Token-Expiration

### **4. Organization Isolation Gaps**
- **Risiko:** Cross-Org-Data-Leaks
- **Zu prüfen:** Alle Queries haben `organization_id` Filter

---

## 📋 **Manuelle Test-Checkliste für dich:**

### **SOFORT-Tests (15 Minuten):**
- [ ] **Chat mit Poll öffnen** - Blank Page weg?
- [ ] **Datei hochladen** - Funktioniert Upload + Anzeige?
- [ ] **Org-Isolation** - Verschiedene Orgs sehen eigene Chats?

### **Vollständige Tests (30 Minuten):**
- [ ] **Poll erstellen** - 3 Optionen, Multiple Choice
- [ ] **Poll abstimmen** - Als verschiedene User
- [ ] **Message löschen** - Soft Delete funktioniert?
- [ ] **Reply-Thread** - Antworten verknüpft?
- [ ] **Unread Counter** - Badge-Updates korrekt?
- [ ] **File-Types** - PDF, MP3, ZIP uploads?

### **Performance Tests (10 Minuten):**
- [ ] **Viele Messages** - 100+ Messages scrollen
- [ ] **Große Dateien** - 8MB Upload Performance
- [ ] **Concurrent Users** - 2+ Browser gleichzeitig

---

## 🐛 **Debugging-Hilfe**

### **JavaScript Console Errors checken:**
```javascript
// Im Browser DevTools:
console.log("Poll options:", message.options);
console.log("Options type:", typeof message.options);
console.log("Is Array:", Array.isArray(message.options));
```

### **Backend Logs checken:**
```bash
# Im Server:
ssh root@server.godsapp.de "cd /opt/Konfi-Quest && docker-compose logs -f backend | grep -i poll"
```

### **Database Debug:**
```sql
-- Defekte Poll-Daten finden:
SELECT m.id, m.message_type, p.options, 
       CASE WHEN p.options ~ '^\\[.*\\]$' THEN 'JSON_ARRAY' ELSE 'INVALID' END as format_check
FROM chat_messages m 
LEFT JOIN chat_polls p ON m.id = p.message_id 
WHERE m.message_type = 'poll';
```

**Die 3 kritischsten Tests:**
1. ✅ **Poll Blank Page** - ist das jetzt behoben?
2. 🔄 **File Upload** - funktionieren Datei-Uploads?
3. 🔄 **Organization Isolation** - strikte Trennung?

Deployiere den Poll-Fix und teste zuerst die **Blank Page**!