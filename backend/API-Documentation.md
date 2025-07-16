# KonfipointsNew API Documentation

## Übersicht
Diese API bietet eine vollständige Backend-Lösung für die Verwaltung von Konfirmationspunkten in der evangelischen Kirche.

**Base URL:** `https://konfipoints.godsapp.de/api`

## Authentifizierung

### JWT Token
Alle geschützten Endpunkte benötigen einen JWT-Token im Authorization Header:
```
Authorization: Bearer <jwt_token>
```

### Login Endpoints

#### Admin Login
```http
POST /api/auth/admin/login
Content-Type: application/json

{
  "username": "admin",
  "password": "pastor2025"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "display_name": "Pastor Simon Luthe",
    "type": "admin"
  }
}
```

#### Konfi Login
```http
POST /api/auth/konfi/login
Content-Type: application/json

{
  "username": "maxmustermann",
  "password": "Johannes3,16"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "maxmustermann",
    "display_name": "Max Mustermann",
    "type": "konfi",
    "jahrgang_id": 1,
    "jahrgang_name": "Jahrgang 2024",
    "gottesdienst_points": 15,
    "gemeinde_points": 22
  }
}
```

#### Health Check
```http
GET /api/auth/health
```

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## Konfis Management

### Get All Konfis
```http
GET /api/konfis
Authorization: Bearer <token>
```

**Query Parameters:**
- `jahrgang_id` (optional): Filter by Jahrgang ID

**Response:**
```json
[
  {
    "id": 1,
    "name": "Max Mustermann",
    "username": "maxmustermann",
    "jahrgang_id": 1,
    "jahrgang_name": "Jahrgang 2024",
    "gottesdienst_points": 15,
    "gemeinde_points": 22,
    "email": "max@example.com",
    "telefon": "0123456789",
    "activity_count": 5,
    "bonus_count": 2
  }
]
```

### Get Single Konfi
```http
GET /api/konfis/{id}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": 1,
  "name": "Max Mustermann",
  "username": "maxmustermann",
  "jahrgang_id": 1,
  "jahrgang_name": "Jahrgang 2024",
  "gottesdienst_points": 15,
  "gemeinde_points": 22,
  "activities": [
    {
      "id": 1,
      "activity_name": "Gottesdienst besucht",
      "points": 3,
      "activity_type": "gottesdienst",
      "completed_date": "2024-01-10",
      "admin_name": "Pastor Simon"
    }
  ],
  "bonusPoints": [
    {
      "id": 1,
      "points": 2,
      "type": "gemeinde",
      "description": "Hilfe bei Gemeindefest",
      "completed_date": "2024-01-12",
      "admin_name": "Pastor Simon"
    }
  ],
  "badges": [
    {
      "id": 1,
      "name": "Gottesdienst-Starter",
      "description": "Ersten Gottesdienst besucht",
      "earned_at": "2024-01-10T10:00:00.000Z"
    }
  ]
}
```

### Create New Konfi
```http
POST /api/konfis
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Max Mustermann",
  "jahrgang_id": 1,
  "email": "max@example.com",
  "telefon": "0123456789",
  "addresse": "Musterstraße 1, 12345 Musterstadt",
  "eltern": "Hans und Maria Mustermann",
  "notizen": "Allergisch gegen Nüsse"
}
```

**Response:**
```json
{
  "id": 1,
  "name": "Max Mustermann",
  "username": "maxmustermann",
  "password": "Johannes3,16",
  "jahrgang_id": 1,
  "email": "max@example.com",
  "telefon": "0123456789",
  "addresse": "Musterstraße 1, 12345 Musterstadt",
  "eltern": "Hans und Maria Mustermann",
  "notizen": "Allergisch gegen Nüsse",
  "gottesdienst_points": 0,
  "gemeinde_points": 0
}
```

### Update Konfi
```http
PUT /api/konfis/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Max Mustermann",
  "jahrgang_id": 1,
  "email": "max@example.com",
  "telefon": "0123456789",
  "addresse": "Musterstraße 1, 12345 Musterstadt",
  "eltern": "Hans und Maria Mustermann",
  "notizen": "Allergisch gegen Nüsse"
}
```

### Delete Konfi
```http
DELETE /api/konfis/{id}
Authorization: Bearer <token>
```

### Regenerate Konfi Password
```http
POST /api/konfis/{id}/regenerate-password
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Password regenerated successfully",
  "newPassword": "Matthäus5,3"
}
```

---

## Activities Management

### Get All Activities
```http
GET /api/activities
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": 1,
    "name": "Gottesdienst besucht",
    "points": 3,
    "type": "gottesdienst",
    "category": "Worship"
  },
  {
    "id": 2,
    "name": "Gemeindefest geholfen",
    "points": 5,
    "type": "gemeinde",
    "category": "Community"
  }
]
```

### Create New Activity
```http
POST /api/activities
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Gottesdienst besucht",
  "points": 3,
  "type": "gottesdienst",
  "category": "Worship"
}
```

**Response:**
```json
{
  "id": 1,
  "name": "Gottesdienst besucht",
  "points": 3,
  "type": "gottesdienst",
  "category": "Worship"
}
```

### Update Activity
```http
PUT /api/activities/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Gottesdienst besucht",
  "points": 3,
  "type": "gottesdienst",
  "category": "Worship"
}
```

### Delete Activity
```http
DELETE /api/activities/{id}
Authorization: Bearer <token>
```

### Assign Activity to Konfi
```http
POST /api/konfis/{konfi_id}/activities
Authorization: Bearer <token>
Content-Type: application/json

{
  "activityId": 1,
  "completed_date": "2024-01-10"
}
```

**Response:**
```json
{
  "message": "Activity assigned successfully",
  "newBadges": [
    {
      "id": 1,
      "name": "Gottesdienst-Starter",
      "description": "Ersten Gottesdienst besucht"
    }
  ],
  "activity": {
    "name": "Gottesdienst besucht",
    "points": 3,
    "type": "gottesdienst",
    "date": "10.01.2024",
    "admin": "Pastor Simon"
  }
}
```

### Remove Activity from Konfi
```http
DELETE /api/konfis/{konfi_id}/activities/{record_id}
Authorization: Bearer <token>
```

### Add Bonus Points
```http
POST /api/konfis/{konfi_id}/bonus-points
Authorization: Bearer <token>
Content-Type: application/json

{
  "points": 2,
  "type": "gemeinde",
  "description": "Hilfe bei Gemeindefest",
  "completed_date": "2024-01-12"
}
```

**Response:**
```json
{
  "message": "Bonus points added successfully",
  "newBadges": [],
  "bonusPoints": {
    "points": 2,
    "type": "gemeinde",
    "description": "Hilfe bei Gemeindefest",
    "date": "12.01.2024",
    "admin": "Pastor Simon"
  }
}
```

---

## Events Management

### Get All Events
```http
GET /api/events
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": 1,
    "name": "Konfi-Freizeit",
    "description": "Wochenende in der Jugendherberge",
    "event_date": "2024-03-15T10:00:00.000Z",
    "location": "Jugendherberge Musterstadt",
    "location_maps_url": "https://maps.google.com/...",
    "points": 10,
    "category": "Freizeit",
    "max_participants": 20,
    "registered_count": 12,
    "registration_status": "open",
    "registration_opens_at": "2024-02-01T00:00:00.000Z",
    "registration_closes_at": "2024-03-10T23:59:59.000Z"
  }
]
```

### Get Single Event
```http
GET /api/events/{id}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": 1,
  "name": "Konfi-Freizeit",
  "description": "Wochenende in der Jugendherberge",
  "event_date": "2024-03-15T10:00:00.000Z",
  "location": "Jugendherberge Musterstadt",
  "max_participants": 20,
  "available_spots": 8,
  "participants": [
    {
      "id": 1,
      "participant_name": "Max Mustermann",
      "jahrgang_name": "Jahrgang 2024",
      "created_at": "2024-02-01T10:00:00.000Z"
    }
  ]
}
```

### Create New Event
```http
POST /api/events
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Konfi-Freizeit",
  "description": "Wochenende in der Jugendherberge",
  "event_date": "2024-03-15T10:00:00.000Z",
  "location": "Jugendherberge Musterstadt",
  "location_maps_url": "https://maps.google.com/...",
  "points": 10,
  "category": "Freizeit",
  "max_participants": 20,
  "registration_opens_at": "2024-02-01T00:00:00.000Z",
  "registration_closes_at": "2024-03-10T23:59:59.000Z",
  "has_timeslots": false
}
```

### Update Event
```http
PUT /api/events/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Konfi-Freizeit",
  "description": "Wochenende in der Jugendherberge",
  "event_date": "2024-03-15T10:00:00.000Z",
  "location": "Jugendherberge Musterstadt",
  "location_maps_url": "https://maps.google.com/...",
  "points": 10,
  "category": "Freizeit",
  "max_participants": 20,
  "registration_opens_at": "2024-02-01T00:00:00.000Z",
  "registration_closes_at": "2024-03-10T23:59:59.000Z"
}
```

### Delete Event
```http
DELETE /api/events/{id}
Authorization: Bearer <token>
```

### Book Event
```http
POST /api/events/{id}/book
Authorization: Bearer <token>
Content-Type: application/json

{
  "timeslot_id": 1
}
```

**Response:**
```json
{
  "id": 1,
  "message": "Event booked successfully",
  "booking_id": 1
}
```

### Cancel Event Booking
```http
DELETE /api/events/{id}/book
Authorization: Bearer <token>
```

### Get User's Event Bookings
```http
GET /api/events/user/bookings
Authorization: Bearer <token>
```

### Create Series Events
```http
POST /api/events/series
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Konfi-Unterricht",
  "description": "Wöchentlicher Unterricht",
  "dates": [
    "2024-02-01T16:00:00.000Z",
    "2024-02-08T16:00:00.000Z",
    "2024-02-15T16:00:00.000Z"
  ],
  "location": "Gemeindehaus",
  "points": 2,
  "category": "Unterricht",
  "max_participants": 15,
  "registration_opens_at": "2024-01-15T00:00:00.000Z",
  "registration_closes_at": "2024-01-30T23:59:59.000Z"
}
```

### Create Group Chat for Event
```http
POST /api/events/{id}/chat
Authorization: Bearer <token>
```

**Response:**
```json
{
  "chat_room_id": 1,
  "message": "Chat created and participants added successfully",
  "participants_added": 5
}
```

---

## Badges Management

### Get All Badges
```http
GET /api/badges
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": 1,
    "name": "Gottesdienst-Starter",
    "description": "Ersten Gottesdienst besucht",
    "criteria_type": "gottesdienst_points",
    "criteria_value": 1,
    "icon": "🎯"
  }
]
```

### Get Badge Criteria Types
```http
GET /api/badges/criteria-types
Authorization: Bearer <token>
```

**Response:**
```json
["gottesdienst_points", "gemeinde_points", "total_points"]
```

### Create New Badge
```http
POST /api/badges
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Gottesdienst-Starter",
  "description": "Ersten Gottesdienst besucht",
  "criteria_type": "gottesdienst_points",
  "criteria_value": 1,
  "icon": "🎯"
}
```

### Update Badge
```http
PUT /api/badges/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Gottesdienst-Starter",
  "description": "Ersten Gottesdienst besucht",
  "criteria_type": "gottesdienst_points",
  "criteria_value": 1,
  "icon": "🎯"
}
```

### Delete Badge
```http
DELETE /api/badges/{id}
Authorization: Bearer <token>
```

### Get Badges for Konfi
```http
GET /api/badges/konfis/{konfi_id}
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": 1,
    "name": "Gottesdienst-Starter",
    "description": "Ersten Gottesdienst besucht",
    "criteria_type": "gottesdienst_points",
    "criteria_value": 1,
    "icon": "🎯",
    "earned_at": "2024-01-10T10:00:00.000Z"
  }
]
```

---

## Jahrgänge Management

### Get All Jahrgänge
```http
GET /api/jahrgaenge
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": 1,
    "name": "Jahrgang 2024",
    "description": "Konfirmandenjahrgang 2024",
    "start_date": "2024-01-01",
    "end_date": "2024-12-31",
    "konfi_count": 15,
    "avg_gottesdienst_points": 12,
    "avg_gemeinde_points": 18,
    "avg_total_points": 30
  }
]
```

### Get Single Jahrgang
```http
GET /api/jahrgaenge/{id}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": 1,
  "name": "Jahrgang 2024",
  "description": "Konfirmandenjahrgang 2024",
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "konfis": [
    {
      "id": 1,
      "name": "Max Mustermann",
      "gottesdienst_points": 15,
      "gemeinde_points": 22,
      "activity_count": 5,
      "bonus_count": 2
    }
  ]
}
```

### Create New Jahrgang
```http
POST /api/jahrgaenge
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Jahrgang 2024",
  "description": "Konfirmandenjahrgang 2024",
  "start_date": "2024-01-01",
  "end_date": "2024-12-31"
}
```

### Update Jahrgang
```http
PUT /api/jahrgaenge/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Jahrgang 2024",
  "description": "Konfirmandenjahrgang 2024",
  "start_date": "2024-01-01",
  "end_date": "2024-12-31"
}
```

### Delete Jahrgang
```http
DELETE /api/jahrgaenge/{id}
Authorization: Bearer <token>
```

---

## Admins Management

### Get All Admins
```http
GET /api/admins
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": 1,
    "username": "admin",
    "display_name": "Pastor Simon Luthe",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
]
```

### Create New Admin
```http
POST /api/admins
Authorization: Bearer <token>
Content-Type: application/json

{
  "username": "admin2",
  "password": "securepassword",
  "display_name": "Pastor Maria Schmidt"
}
```

### Update Admin
```http
PUT /api/admins/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "username": "admin2",
  "password": "newsecurepassword",
  "display_name": "Pastor Maria Schmidt"
}
```

### Delete Admin
```http
DELETE /api/admins/{id}
Authorization: Bearer <token>
```

---

## Chat System

### Get Chat Rooms
```http
GET /api/chat/rooms
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": 1,
    "name": "Allgemeiner Chat",
    "type": "group",
    "created_at": "2024-01-01T00:00:00.000Z",
    "participant_count": 5,
    "unread_count": 2
  }
]
```

### Create Direct Chat
```http
POST /api/chat/direct
Authorization: Bearer <token>
Content-Type: application/json

{
  "konfiId": 1
}
```

### Create Group Chat
```http
POST /api/chat/rooms
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Konfi-Gruppe 2024",
  "participants": [
    {
      "id": 1,
      "type": "konfi"
    },
    {
      "id": 2,
      "type": "konfi"
    }
  ]
}
```

### Get Messages
```http
GET /api/chat/rooms/{room_id}/messages?limit=50&offset=0
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": 1,
    "message": "Hallo zusammen!",
    "sender_id": 1,
    "sender_type": "admin",
    "sender_name": "Pastor Simon",
    "created_at": "2024-01-15T10:00:00.000Z",
    "file_name": null,
    "file_path": null
  }
]
```

### Send Message
```http
POST /api/chat/rooms/{room_id}/messages
Authorization: Bearer <token>
Content-Type: multipart/form-data

message=Hallo zusammen!
file=<file_upload>
```

### Delete Message
```http
DELETE /api/chat/messages/{message_id}
Authorization: Bearer <token>
```

### Mark Messages as Read
```http
PUT /api/chat/rooms/{room_id}/read
Authorization: Bearer <token>
```

### Get Unread Counts
```http
GET /api/chat/unread-counts
Authorization: Bearer <token>
```

### Get Room Participants
```http
GET /api/chat/rooms/{room_id}/participants
Authorization: Bearer <token>
```

### Add Participant to Room
```http
POST /api/chat/rooms/{room_id}/participants
Authorization: Bearer <token>
Content-Type: application/json

{
  "userId": 1,
  "userType": "konfi"
}
```

### Remove Participant from Room
```http
DELETE /api/chat/rooms/{room_id}/participants/{user_id}/{user_type}
Authorization: Bearer <token>
```

---

## Statistics

### Get General Statistics
```http
GET /api/statistics
Authorization: Bearer <token>
```

**Response:**
```json
{
  "totalKonfis": 15,
  "totalActivities": 25,
  "totalBadges": 8,
  "averageGottesdienstPoints": 12,
  "averageGemeindePoints": 18,
  "totalAssignedActivities": 45,
  "totalBonusPoints": 12,
  "activityTypeDistribution": [
    {
      "type": "gottesdienst",
      "count": 20
    },
    {
      "type": "gemeinde",
      "count": 25
    }
  ],
  "monthlyActivityTrends": [
    {
      "month": "2024-01",
      "count": 12
    }
  ]
}
```

### Get Ranking
```http
GET /api/statistics/ranking?type=total&limit=10
Authorization: Bearer <token>
```

**Query Parameters:**
- `type`: "total", "gottesdienst", "gemeinde" (default: "total")
- `limit`: Number of results (default: 10)

**Response:**
```json
[
  {
    "id": 1,
    "name": "Max Mustermann",
    "gottesdienst_points": 15,
    "gemeinde_points": 22,
    "total_points": 37,
    "jahrgang_name": "Jahrgang 2024",
    "badge_count": 3,
    "position": 1
  }
]
```

### Get Jahrgang Statistics
```http
GET /api/statistics/jahrgaenge
Authorization: Bearer <token>
```

### Get Activity Statistics
```http
GET /api/statistics/activities
Authorization: Bearer <token>
```

### Get Badge Statistics
```http
GET /api/statistics/badges
Authorization: Bearer <token>
```

---

## Settings

### Get All Settings
```http
GET /api/settings
Authorization: Bearer <token>
```

**Response:**
```json
{
  "target_gottesdienst": "20",
  "target_gemeinde": "30"
}
```

### Update Settings
```http
PUT /api/settings
Authorization: Bearer <token>
Content-Type: application/json

{
  "target_gottesdienst": "25",
  "target_gemeinde": "35"
}
```

### Get Specific Setting
```http
GET /api/settings/{key}
Authorization: Bearer <token>
```

### Update Specific Setting
```http
PUT /api/settings/{key}
Authorization: Bearer <token>
Content-Type: application/json

{
  "value": "25"
}
```

---

## Activity Requests

### Get All Activity Requests
```http
GET /api/activity-requests
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": 1,
    "konfi_id": 1,
    "konfi_name": "Max Mustermann",
    "jahrgang_name": "Jahrgang 2024",
    "activity_name": "Kirchenputz",
    "description": "Habe beim Kirchenputz geholfen",
    "completed_date": "2024-01-10",
    "category": "gemeinde",
    "status": "pending",
    "photo_path": "image123.jpg",
    "created_at": "2024-01-10T10:00:00.000Z"
  }
]
```

### Get Activity Requests for Konfi
```http
GET /api/activity-requests/konfi/{konfi_id}
Authorization: Bearer <token>
```

### Create Activity Request
```http
POST /api/activity-requests
Content-Type: multipart/form-data

konfi_id=1
activity_name=Kirchenputz
description=Habe beim Kirchenputz geholfen
completed_date=2024-01-10
category=gemeinde
photo=<file_upload>
```

### Update Activity Request (Approve/Reject)
```http
PUT /api/activity-requests/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "approved",
  "admin_comment": "Gut gemacht!",
  "points": 3
}
```

### Delete Activity Request
```http
DELETE /api/activity-requests/{id}
Authorization: Bearer <token>
```

### Get Activity Request Photo
```http
GET /api/activity-requests/{id}/photo
```

### Get Activity Categories
```http
GET /api/activity-requests/categories
Authorization: Bearer <token>
```

**Response:**
```json
["gottesdienst", "gemeinde"]
```

---

## Error Handling

### Standard Error Response
```json
{
  "error": "Error message description"
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `500` - Internal Server Error

---

## File Uploads

### Chat Files
- **Endpoint**: `/api/chat/files/{filename}`
- **Max Size**: 10MB
- **Allowed Types**: Images, PDFs, Word documents, text files

### Activity Request Photos
- **Endpoint**: `/api/activity-requests/{id}/photo`
- **Max Size**: 5MB
- **Allowed Types**: Images only

---

## Rate Limiting

Aktuell kein Rate Limiting implementiert. Empfehlung: 100 Requests pro Minute pro IP.

---

## Changelog

### Version 1.0 (2024-01-15)
- Initial API implementation
- Vollständige Modularisierung der Routen
- JWT-basierte Authentifizierung
- Chat-System mit Datei-Upload
- Event-Buchungssystem
- Statistiken und Rankings
- Badge-System
- Activity Requests

---

## Support

Bei Fragen oder Problemen wenden Sie sich an:
- **Email**: support@konfipoints.godsapp.de
- **Server**: ssh root@server.godsapp.de
- **Repository**: /opt/Konfi-Quest/

---

## Deployment

### Produktionsserver
```bash
ssh root@server.godsapp.de
cd /opt/Konfi-Quest/
git pull && docker-compose down && docker-compose up -d --build
```

### API Test
```bash
curl -H "Authorization: Bearer <token>" https://konfipoints.godsapp.de/api/auth/health
```