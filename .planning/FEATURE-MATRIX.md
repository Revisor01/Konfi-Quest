# Rollen-Feature-Matrix

Generiert am 2026-06-01 aus backend/middleware/rbac.js + allen 18 Routes + Frontend-UI-Gating (Multi-Agenten-Extraktion ueber 22 Quellen).
Quelle der Wahrheit fuer 'welche Rolle darf was'. Bei Code-Aenderungen an Routes/RBAC aktualisieren.

---

# Konfipoints RBAC - Feature-Matrix (2026-06-01)

## Rollen-Kurzbeschreibung

| Rolle | Zugriff | Bereich |
|-------|---------|--------|
| **super_admin** (Level 5) | Organisationen verwalten (CRUD), System-Admin | Nur Org-Verwaltung; KEIN Zugriff auf Jahrgangsdaten |
| **org_admin** (Level 4) | Alles in der Organisation (User, Jahrgänge, Events, Konfis, Settings) | Org-isoliert; kann User verwalten; darf Konfis-Limit nicht selbst erhöhen |
| **admin** (Level 3) | Alles AUSSER User-Verwaltung; Events, Konfis, Aktivitäten, Badges | Org-isoliert; reduzierte Hierarchie beim User-Delegieren |
| **teamer** (Level 2) | Events/Konfis ansehen, Punkte vergeben, eigene Requests | Org-isoliert; nur zugewiesene Jahrgänge; kann nicht verwalten |
| **konfi** (Level 1) | Eigene Daten: Events, Badges, Punkte, Aktivitätsanträge | Nur eigene Daten; read-only für meiste Inhalte |

---

## Auth / Konto-Management

| Feature | super_admin | org_admin | admin | teamer | konfi | Hinweise |
|---------|-------------|----------|-------|--------|-------|----------|
| Anmelden (Login) | ja | ja | ja | ja | ja | Öffentlicher Endpoint; alle Rollen akzeptiert |
| Passwort ändern (selbst) | ja | ja | ja | ja | ja | Alle eingeloggt; aktuelles Passwort erforderlich |
| E-Mail aktualisieren (selbst) | ja | ja | ja | ja | ja | Alle eingeloggt; Unique-Constraint |
| Funktionsbeschreibung setzen | nein | ja | ja | ja | nein | Nur teamer/admin/org_admin; konfi blockiert (403) |
| Profil abrufen (eigenes) | ja | ja | ja | ja | ja | Alle eingeloggt; GET /auth/me |
| Passwort-Reset anfordern | ja | ja | ja | ja | ja | Öffentlich, unauthenticated; Rate-Limit 5 pro 15 min |
| Passwort zurücksetzen (via Token) | ja | ja | ja | ja | ja | Öffentlich, unauthenticated; Token 24h gültig |
| Account selbst löschen | ja | ja | ja | ja | ja | Alle eingeloggt; Passwort-bestätigt; Kaskade |
| Abmelden (Logout) | ja | ja | ja | ja | ja | Alle eingeloggt; revoked_at des Tokens gesetzt |
| Token refreshen | ja | ja | ja | ja | ja | Unauthenticated mit Refresh-Token; Token-Rotation |

---

## Authentifizierung / Zugang (Org-spezifisch)

| Feature | super_admin | org_admin | admin | teamer | konfi | Hinweise |
|---------|-------------|----------|-------|--------|-------|----------|
| Einladungscode generieren | ja | ja | nein | nein | nein | Nur super_admin + org_admin; 7 Tage gültig |
| Einladungscodes auflisten | ja | ja | nein | nein | nein | Nur org_admin; zeigt Nutzungs-Count |
| Einladungscode verlängern | ja | ja | nein | nein | nein | Nur org_admin; +7 Tage Gültigkeit |
| Einladungscode löschen | ja | ja | nein | nein | nein | Nur org_admin; org-isoliert |
| Einladungscode validieren | ja | ja | ja | ja | ja | Öffentlich, unauthenticated; prüft Ablauf |
| Konfi registrieren (via Code) | ja | ja | ja | ja | ja | Öffentlich; prüft Konfi-Limit; Auto-Enrollment |
| Benutzername verfügbar prüfen | ja | ja | ja | ja | ja | Öffentlich; min. 3 Zeichen, alphanumerisch |

---

## Organisationen (Org-Verwaltung)

| Feature | super_admin | org_admin | admin | teamer | konfi | Hinweise |
|---------|-------------|----------|-------|--------|-------|----------|
| Alle Orgs auflisten | ja | nein | nein | nein | nein | Nur super_admin; mit Statistiken |
| Org-Details abrufen (nach ID) | ja (alle) | ja (eigene) | nein | nein | nein | Super_admin org-übergreifend; andere nur eigene |
| Org-Details der aktuellen Org | ja (alle) | ja | ja | ja | ja | Alle eingeloggt; zeigt Statistiken |
| Neue Org erstellen | ja | nein | nein | nein | nein | Nur super_admin; erstellt Admin + Default-Badges |
| Org aktualisieren (Name, Slug, Kontakt) | ja (alle) | ja (eigene) | nein | nein | nein | Super_admin org-übergreifend; org_admin nur eigene |
| Org löschen | ja | nein | nein | nein | nein | Nur super_admin; Cascade mit allen Daten |
| Konfi-Limit setzen | ja | nein | nein | nein | nein | Nur super_admin; verhindert Tarif-Umgehung |
| User der Org auflisten | ja (alle) | ja (eigene) | nein | nein | nein | Super_admin org-übergreifend; org_admin nur eigene |
| Org-Admins auflisten | ja (alle) | ja (eigene) | nein | nein | nein | Super_admin org-übergreifend; org_admin nur eigene |
| Neuen Org-Admin hinzufügen | ja (alle) | ja (eigene) | nein | nein | nein | Super_admin org-übergreifend; org_admin nur eigene |
| Org-Statistiken abrufen | ja (alle) | ja (eigene) | ja (eigene) | ja (eigene) | ja (eigene) | Org-isoliert; zeigt Konfis, Events, Badges |

---

## Benutzer-Verwaltung (User CRUD)

| Feature | super_admin | org_admin | admin | teamer | konfi | Hinweise |
|---------|-------------|----------|-------|--------|-------|----------|
| Users auflisten | nein | ja | ja | nein | nein | Nur org_admin + admin; org-isoliert; zeigt Rollen |
| User-Details abrufen | nein | ja | ja | nein | nein | Nur org_admin + admin; org-isoliert; mit Jahrgängen |
| User erstellen | nein | ja | ja | nein | nein | Nur org_admin + admin; org-isoliert; Hierarchie-Check |
| User aktualisieren (Daten, Rolle, Status) | nein | ja | ja | nein | nein | Nur org_admin + admin; org-isoliert; Hierarchie-Check |
| User löschen | nein | ja | ja | nein | nein | Nur org_admin + admin; org-isoliert; verhindert Selbst-Löschung |
| Jahrgänge User zuweisen | nein | ja | ja | nein | nein | Nur org_admin + admin; auto-Chat-Enrollment |
| Eigene Jahrgänge abrufen | ja | ja | ja | ja | ja | Alle eingeloggt; nur eigene Zuweisungen |
| User-Jahrgänge abrufen | nein | ja | ja | nein | nein | Nur org_admin + admin; org-isoliert |
| Passwort zurücksetzen (anderer User) | ja (alle) | ja (eigene Org) | nein | nein | nein | Super_admin org-übergreifend; org_admin nur eigene |

---

## Rollen (Role Management)

| Feature | super_admin | org_admin | admin | teamer | konfi | Hinweise |
|---------|-------------|----------|-------|--------|-------|----------|
| Alle Rollen der Org auflisten | nein | ja | nein | nein | nein | Nur org_admin; zeigt User-Count pro Rolle |
| Einzelne Rolle abrufen | nein | ja | nein | nein | nein | Nur org_admin; org-isoliert |
| Zuweisbare Rollen abrufen (abhängig Hierarchie) | nein | ja (org_admin/admin/teamer/konfi) | ja (admin/teamer/konfi) | nein | nein | Hierarchie-basiert; org-isoliert |

---

## Jahrgänge (Konfirmanden-Kohorten)

| Feature | super_admin | org_admin | admin | teamer | konfi | Hinweise |
|---------|-------------|----------|-------|--------|-------|----------|
| Jahrgänge auflisten | nein | ja | ja | zugew. JG | nein | Teamer sehen nur zugewiesene; org-isoliert |
| Jahrgang erstellen | nein | ja | ja | nein | nein | Org-isoliert; mit Aktivierungsflags + Punkte-Ziele |
| Jahrgang aktualisieren | nein | ja | ja | nein | nein | Org-isoliert; mit Warn-Meldung bei Deaktivierung |
| Jahrgang löschen | nein | ja | ja | nein | nein | Org-isoliert; Force-Delete mit Chat-Cleanup |
| Anwesenheitsmatrix abrufen | nein | ja | ja | nein | nein | Org-isoliert; Konfis x Mandatory-Events |

---

## Konfis (Konfi-Verwaltung)

| Feature | super_admin | org_admin | admin | teamer | konfi | Hinweise |
|---------|-------------|----------|-------|--------|-------|----------|
| Konfis auflisten | nein | ja | ja | zugew. JG | nein | Teamer sehen nur can_view-Jahrgänge; org-isoliert |
| Teamer auflisten | nein | ja | ja | ja | nein | Org-isoliert; nur Teamer anzeigen |
| Konfi/Teamer-Details abrufen | nein | ja | ja | ja | nein | Teamer sehen Konfi-Historie nur wenn Teamer-Rolle |
| Event-Punkte abrufen | nein | ja | ja | ja | nein | Org-isoliert |
| Attendance-Statistiken abrufen | nein | ja | ja | nein | nein | Org-isoliert; nur Admin |
| Konfi erstellen | nein | ja | ja | nein | nein | Konfi-Limit-Check; Auto-Enrollment Pflicht-Events |
| Konfi aktualisieren (Name, Jahrgang) | nein | ja | ja | nein | nein | Jahrgang-Wechsel -> Chat-Update; org-isoliert |
| Konfi löschen | nein | ja | ja | nein | nein | Kaskadierende Löschung; org-isoliert |
| Konfi-Passwort neu generieren | nein | ja | ja | nein | nein | Org-isoliert |
| Bonuspunkte vergeben | nein | ja | ja | ja | nein | Badge-Check + Level-Up; org-isoliert |
| Bonuspunkte löschen | nein | ja | ja | nein | nein | Badge-Check nach Löschung; org-isoliert |
| Aktivität zuweisen | nein | ja | ja | nein | nein | Punkte-Typ-Guard; Badge-Check; org-isoliert |
| Aktivität löschen | nein | ja | ja | nein | nein | Badge-Check; org-isoliert |
| teamer_since ändern | nein | ja | ja | nein | nein | Nur sichtbar für Teamer; org-isoliert |
| Konfi -> Teamer befördern | nein | ja | ja | nein | nein | Daten-Migration; Bookings löschen; org-isoliert |

---

## Konfi-Dashboard & Profil (Self-Service)

| Feature | super_admin | org_admin | admin | teamer | konfi | Hinweise |
|---------|-------------|----------|-------|--------|-------|----------|
| Konfi-Dashboard laden | nein | nein | nein | nein | ja | Nur eigene Daten; Punkte, Badges, Events, Ranking |
| Eigenes Konfi-Profil ansehen | nein | nein | nein | nein | ja | Nur eigene Daten; Punkte, Badges, Aktivitäten |
| Punkte-Historie einsehen | nein | nein | nein | nein | ja | Nur eigene Daten; Aktivitäts- + Event-Punkte |
| Aktivitäts-Anfragen ansehen | nein | nein | nein | nein | ja | Nur eigene; pending/approved/rejected |
| Aktivitäts-Anfrage einreichen | nein | nein | nein | nein | ja | Nur eigene; optional Foto; mit client_id Idempotenz |
| Foto hochladen (für Anfrage) | nein | nein | nein | ja | ja | Konfi/Teamer; Magic Bytes validiert |
| Foto abrufen (aus Anfrage) | nein | ja | ja | ja | nein | Admins sehen alle; Konfis/Teamer nur eigene |
| Aktivitäts-Anfrage löschen (pending) | nein | nein | nein | nein | ja | Nur eigene; nur wenn status=pending |
| Verfügbare Aktivitäten anschauen | nein | nein | nein | nein | ja | Nur target_role=null oder konfi |
| Bibelübersetzungs-Vorliebe setzen | nein | nein | nein | nein | ja | Nur eigene; validiert Auswahl |
| Tageslosung abrufen | nein | nein | nein | nein | ja | Nutzt Bibelübersetzungs-Vorliebe; gecacht |

---

## Konfi-Badges & Levels

| Feature | super_admin | org_admin | admin | teamer | konfi | Hinweise |
|---------|-------------|----------|-------|--------|-------|----------|
| Badges ansehen (verdient + verfügbar) | nein | nein | nein | nein | ja | Nur eigene; zeigt Progress (15 Kriterientypen) |
| Badge-Statistik | nein | nein | nein | nein | ja | Nur eigene; verdient vs. insgesamt |
| Alle Badges als gesehen markieren | nein | nein | nein | nein | ja | Nur eigene; setzt seen=true |
| Alle Level auflisten | ja | ja | ja | ja | ja | Org-isoliert; read-only; sortiert nach Punkte |
| Level-Fortschritt abrufen (konfi) | nein | nein | nein | nein | ja | Nur eigener Fortschritt; live berechnet |

---

## Konfi-Events (Self-Service)

| Feature | super_admin | org_admin | admin | teamer | konfi | Hinweise |
|---------|-------------|----------|-------|--------|-------|----------|
| Events ansehen (mit Status) | nein | nein | nein | nein | ja | Nur eigene Jahrgänge; zeigt Registrierungsstatus |
| Registrierungsstatus abrufen | nein | nein | nein | nein | ja | Nur eigene Registierung; booking_status, confirmed/waitlist |
| Teilnehmer-Info abrufen (anon.) | nein | nein | nein | nein | ja | Anonymisiert; zeigt nur Vorname + Nachname-Anfang |
| Timeslots abrufen | nein | nein | nein | nein | ja | Nur wenn Event has_timeslots=true |
| Für Event anmelden | nein | nein | nein | nein | ja | Registrierungsfenster-Check; Wartelisten-Logik |
| Von Event abmelden | nein | nein | nein | nein | ja | Nicht für Pflicht-Events; max 2 Tage vorher |
| Von Pflicht-Event abmelden (Grund) | nein | nein | nein | nein | ja | Nur mandatory Events; Grund min. 5 Zeichen |
| Zu Pflicht-Event anmelden (opt-in) | nein | nein | nein | nein | ja | Rückgängig machen opt-out |
| QR-Checkin durchführen | nein | nein | nein | nein | ja | Token-Validierung; Zeitfenster-Check; Punkte nur non-mandatory |

---

## Aktivitäten (Activities)

| Feature | super_admin | org_admin | admin | teamer | konfi | Hinweise |
|---------|-------------|----------|-------|--------|-------|----------|
| Aktivitäten (alle) auflisten | nein | ja | ja | ja | nein | Org-isoliert; optional target_role filter |
| Aktivität erstellen | nein | ja | ja | nein | nein | Org-isoliert; mit Kategorien |
| Aktivität aktualisieren | nein | ja | ja | nein | nein | Org-isoliert; replaces Kategorien |
| Aktivität löschen | nein | ja | ja | nein | nein | Org-isoliert; fails wenn aktive Zuweisungen |
| Aktivitäts-Anfragen auflisten (Admin) | nein | ja | ja | nein | nein | Org-isoliert; zeigt Konfi-Namen, Approval-Daten |
| Aktivitäts-Anfrage genehmigen/ablehnen | nein | ja | ja | nein | nein | Org-isoliert; Punkte + Badges bei Genehmigung |
| Aktivitäts-Anfrage zurücksetzen | nein | ja | ja | nein | nein | Org-isoliert; revert auf pending |
| Aktivität direkt zuweisen (zu Konfi) | nein | ja | ja | ja | nein | Teamer nur zugewiesene JG; Punkte + Badge-Check |

---

## Teamer-Features (Self-Service)

| Feature | super_admin | org_admin | admin | teamer | konfi | Hinweise |
|---------|-------------|----------|-------|--------|-------|----------|
| Teamer-Dashboard | nein | nein | nein | ja | nein | Zertifikate, Events, Badges, Tageslosung |
| Teamer-Profil (E-Mail, Passwort, Titel) | nein | nein | nein | ja | nein | Nur eigene Daten |
| Teamer-Activities (teamer-target) auflisten | nein | ja | ja | ja | nein | Org-isoliert; target_role=teamer only |
| Teamer-Requests einreichen | nein | ja | ja | ja | nein | Org-isoliert; nur teamer-target activities |
| Teamer-Requests ansehen (eigene) | nein | ja | ja | ja | nein | Org-isoliert; nur eigene pending/approved/rejected |
| Teamer-Request löschen (pending) | nein | ja | ja | ja | nein | Org-isoliert; nur pending |
| Wrapped/Jahresrückblick (Teamer) | nein | nein | nein | ja | nein | Nur eigenes; Events geleitet, Konfis, Zertifikate |

---

## Badges (Badge-Management)

| Feature | super_admin | org_admin | admin | teamer | konfi | Hinweise |
|---------|-------------|----------|-------|--------|-------|----------|
| Kriterientypen auflisten | nein | ja | ja | ja | nein | Statisch; 15 Typen (points, events, activities, streak, etc.) |
| Alle Badges (Org) auflisten | nein | ja | ja | ja | nein | Org-isoliert; optional target_role (konfi/teamer) |
| Einzelnes Badge abrufen | nein | ja | ja | ja | nein | Org-isoliert; mit earned_count aggregiert |
| Badge erstellen | nein | ja | ja | nein | nein | Org-isoliert; mit Kriterien + Farbe + Icon |
| Badge aktualisieren | nein | ja | ja | nein | nein | Org-isoliert; name, icon, description, kriterien |
| Badge löschen | nein | ja | ja | nein | nein | Org-isoliert; kaskadiert user_badges |
| Badges automatisch vergeben (intern) | nein | ja | ja | ja | ja | Intern aufgerufen; unterschiedlich konfi vs teamer |

---

## Events (Event-Management)

| Feature | super_admin | org_admin | admin | teamer | konfi | Hinweise |
|---------|-------------|----------|-------|--------|-------|----------|
| Events auflisten | nein | ja | ja | ja | ja | Teamer sehen nur zugewiesene JG; Konfis sehen keine teamer_only |
| Abgesagte Events auflisten | nein | ja | ja | ja | nein | Nur admin+; org-isoliert |
| Event-Details abrufen | nein | ja | ja | ja | ja | Org-isoliert; mit Teilnehmern, Timeslots, Kategorien |
| Event-Timeslots abrufen | nein | ja | ja | ja | ja | Nur wenn Event has_timeslots=true |
| Live-Anwesenheits-Zähler | nein | ja | ja | ja | nein | Nur teamer+; zählt confirmed+present |
| Event erstellen | nein | ja | ja | ja | nein | Teamer wenn teamer_needed/teamer_only; Auto-Enrollment mandatory |
| Event aktualisieren (Daten, Timeslots) | nein | ja | ja | ja | nein | Teamer nur zugewiesene JG; Booking-Preservation |
| Event löschen | nein | ja | ja | ja | nein | Teamer nur zugewiesene JG; Chat-Cleanup; blocks wenn Bookings |
| Event absagen | nein | ja | ja | ja | nein | Teamer nur zugewiesene JG; sendet Push an Teilnehmer |
| Teilnehmer hinzufügen (manuell) | nein | ja | ja | ja | nein | Teamer nur zugewiesene JG; auto-Status, transactional |
| Teilnehmer entfernen | nein | ja | ja | ja | nein | Teamer nur zugewiesene JG; auto-Waitlist-Promotion |
| Teilnehmer-Status ändern | nein | ja | ja | ja | nein | Teamer nur zugewiesene JG; Punkte-Handling |
| Anwesenheit registrieren (present/absent) | nein | ja | ja | ja | nein | Teamer nur zugewiesene JG; Punkte + Badge-Check |
| QR-Token generieren | nein | ja | ja | ja | nein | Teamer nur zugewiesene JG; JWT mit QR_SECRET |
| Serien-Events erstellen | nein | ja | ja | ja | nein | Teamer nur zugewiesene JG; N Events mit Interval |
| Event-Chat erstellen | nein | ja | ja | ja | nein | Teamer nur zugewiesene JG; auto-Participant-Enrollment |

---

## Chat (Messaging)

| Feature | super_admin | org_admin | admin | teamer | konfi | Hinweise |
|---------|-------------|----------|-------|--------|-------|----------|
| Chat-Admins auflisten (für DM) | nein | nein | nein | nein | ja | Konfis only; zeigt admin/org_admin/teamer ihrer Org |
| Direct-Chat erstellen/abrufen | nein | ja | ja | ja | ja | Konfis nur mit Admins; Admin mit allen |
| Chat-Räume erstellen (group/direct/jahrgang) | nein | ja | ja | ja | nein | Konfis restricted zu direct; Jahrgänge auto-Konfis |
| Chat-Räume auflisten (eigene) | nein | ja | ja | ja | ja | Org-isoliert; mit unread-Count; auto-Jahrgang-Enrollment |
| Chat-Raum-Details abrufen | nein | ja | ja | ja | ja | Konfis nur wenn Participant; Admins alle ihrer Org |
| Nachrichten abrufen | nein | ja | ja | ja | ja | Konfis nur wenn Participant; Admins alle ihrer Org; pagination |
| Nachricht senden | nein | ja | ja | ja | ja | Konfis nur wenn Participant; 4000 Zeichen; Broadcast via WebSocket |
| Raum als gelesen markieren | nein | ja | ja | ja | ja | Org-isoliert; updated last_read_at |
| Raum-Teilnehmer auflisten | nein | ja | ja | ja | ja | Konfis nur wenn Participant; Admins alle ihrer Org |
| Teilnehmer hinzufügen | nein | ja | ja | nein | nein | Admin-only; group-type only |
| Teilnehmer entfernen | nein | ja | ja | nein | nein | Admin-only; group-type only |
| Chat-Raum verlassen (self) | nein | ja | ja | ja | ja | Admins können nicht verlassen; Konfis nur group-Räume |
| Chat-Dateien herunterladen | nein | ja | ja | ja | ja | Org-isoliert; Path-Traversal-Schutz |
| Chat-Badge-Update abrufen | nein | ja | ja | ja | ja | Berechnet unread-Count; sendet Push |
| Poll erstellen | nein | ja | ja | nein | nein | Admin-only; Ablaufzeit optional |
| Poll abstimmen (by pollId) | nein | ja | ja | ja | ja | Org-isoliert; Single/Multiple-Choice |
| Nachricht löschen (soft) | nein | ja | ja | ja | ja | User kann eigene; Admin kann alle in Org; Broadcast via WS |
| Poll abstimmen (by messageId) | nein | ja | ja | ja | ja | Alternative Endpoint; gleiche Logik |
| Chat-Raum löschen | nein | ja | ja | nein | nein | Admin-only; blockiert wenn Nachrichten (force=true zum Override) |
| Reaction zu Nachricht hinzufügen | nein | ja | ja | ja | ja | Predefined Emojis nur; toggle-off wenn exists; Broadcast |
| Reactions abrufen (für Nachricht) | nein | ja | ja | ja | ja | Konfis nur wenn Participant; Admins alle ihrer Org |
| Verfügbare Chat-Partner (für Konfi) | nein | nein | nein | nein | ja | Konfis only; zeigt admin/org_admin/teamer ihrer Org |

---

## Kategorien (für Aktivitäten)

| Feature | super_admin | org_admin | admin | teamer | konfi | Hinweise |
|---------|-------------|----------|-------|--------|-------|----------|
| Kategorien auflisten | nein | ja | ja | ja | nein | Org-isoliert; alphabetisch sortiert |
| Kategorie erstellen | nein | ja | ja | nein | nein | Org-isoliert; Name erforderlich; Type optional (gottesdienst/gemeinde/both) |
| Kategorie aktualisieren | nein | ja | ja | nein | nein | Org-isoliert; Duplikat-Constraint |
| Kategorie löschen | nein | ja | ja | nein | nein | Org-isoliert; fails wenn in Aktivitäten/Events verwendet |

---

## Levels (Konfis-Levels)

| Feature | super_admin | org_admin | admin | teamer | konfi | Hinweise |
|---------|-------------|----------|-------|--------|-------|----------|
| Alle Level auflisten | nein | ja | ja | ja | ja | Org-isoliert; sortiert nach Punkte-Schwelle |
| Level erstellen | nein | ja | ja | nein | nein | Org-isoliert; Punkte eindeutig |
| Level aktualisieren | nein | ja | ja | nein | nein | Org-isoliert; Punkte eindeutig |
| Level löschen | nein | ja | ja | nein | nein | Org-isoliert; fails wenn Konfis das Level erreicht haben |

---

## Material-Verwaltung

| Feature | super_admin | org_admin | admin | teamer | konfi | Hinweise |
|---------|-------------|----------|-------|--------|-------|----------|
| Tags auflisten | nein | ja | ja | ja | nein | Org-isoliert |
| Tag erstellen | nein | ja | nein | nein | nein | Org-isoliert; nur org_admin |
| Tag aktualisieren | nein | ja | nein | nein | nein | Org-isoliert; nur org_admin |
| Tag löschen | nein | ja | nein | nein | nein | Org-isoliert; nur org_admin; CASCADE |
| Materialien auflisten (mit Filter) | nein | ja | ja | ja | nein | Org-isoliert; Filter: tag, search, event, jahrgang |
| Materialien zu Event auflisten | nein | ja | ja | ja | nein | Org-isoliert; nur verknüpfte Materialien |
| Material-Detail abrufen | nein | ja | ja | ja | nein | Org-isoliert; mit Tags, Events, Jahrgänge, Dateien |
| Material erstellen | nein | ja | nein | nein | nein | Org-isoliert; nur org_admin; M2M optional |
| Material aktualisieren | nein | ja | nein | nein | nein | Org-isoliert; nur org_admin; M2M per DELETE+INSERT |
| Material löschen | nein | ja | nein | nein | nein | Org-isoliert; nur org_admin; CASCADE + Dateien gelöscht |
| Dateien hochladen | nein | ja | nein | nein | nein | Org-isoliert; nur org_admin; max 10; Magic Bytes validiert |
| Datei herunterladen | nein | ja | ja | ja | nein | Org-isoliert; Path-Traversal-Schutz; original_name als Content-Disposition |
| Einzelne Datei löschen | nein | ja | nein | nein | nein | Org-isoliert; nur org_admin; DB + Dateisystem |

---

## Settings & Konfiguration

| Feature | super_admin | org_admin | admin | teamer | konfi | Hinweise |
|---------|-------------|----------|-------|--------|-------|----------|
| Settings abrufen | nein | ja | ja | ja | ja | Org-isoliert; zeigt Dashboard-Widgets, Chat-Berechtigungen, Wartelisten |
| Settings aktualisieren | nein | ja | nein | nein | nein | Org-isoliert; nur org_admin; Widget-Toggles, Wartelisten-Config |

---

## Benachrichtigungen (Push)

| Feature | super_admin | org_admin | admin | teamer | konfi | Hinweise |
|---------|-------------|----------|-------|--------|-------|----------|
| Push-Token registrieren/updaten | ja | ja | ja | ja | ja | Alle eingeloggt; auto-deduplicate FCM-Token |
| Test-Push senden | ja | ja | ja | ja | ja | Alle eingeloggt; nur zu eigenen Devices |
| Push-Token löschen (Logout) | ja | ja | ja | ja | ja | Alle eingeloggt; query-Filter nach user_id + org |

---

## Wrapped (Jahresrückblick)

| Feature | super_admin | org_admin | admin | teamer | konfi | Hinweise |
|---------|-------------|----------|-------|--------|-------|----------|
| Eigenen Wrapped abrufen | nein | nein | nein | ja | ja | Konfi zeigt konfi-wrapped; Teamer teamer-wrapped; nur neuester |
| Konfi-Wrapped generieren (Jahrgang) | nein | ja | ja | nein | nein | Org-isoliert; parallel für alle Konfis; sendet Push |
| Teamer-Wrapped generieren (Org) | nein | ja | nein | nein | nein | Org-isoliert; nur org_admin; sendet Push |
| Wrapped-Snapshots löschen | nein | ja | nein | nein | nein | Org-isoliert; nur org_admin; setzt released_at=NULL |
| Wrapped-Historie abrufen (User) | nein | ja | ja | ja | ja | Konfi nur eigene; Admin nur gleiche Org; org-isoliert |

---

## Zusammenfassung: Auffaelligkeiten & Klaerungsbedarf

### 1. Super-Admin hat KEINEN Zugriff auf Jahrgangsdaten — ENTSCHIEDEN: so gewollt
   - super_admin = reine Institutions-/Org-Verwaltung. Zugriff in fremde Orgs laeuft bewusst
     ueber Passwort-Reset der org_admins (super_admin darf das, PUT /users/:id/reset-password org-uebergreifend).
   - NEU (01.06.): Org-Verwaltung kann via is_super_admin-FLAG an einen org_admin gekoppelt werden
     (requireSuperAdmin + organizations.js gaten jetzt auf das Flag statt nur auf role_name).
     Dann erscheint die "Organisationen"-Kachel zusaetzlich im Mehr-Tab dieses Admins, ohne die
     volle org_admin-Arbeit zu verlieren. Simons Konto bekommt dieses Flag (Prod-DB beim Deploy).

### 2. ~~Konfi-Limit per confirm=true umgehbar~~ — VERIFIZIERT KORREKT (kein Bug)
   - Nachgeprueft in konfi-management.js:168-194 + konfiLimit.js: `confirm=true` umgeht NUR
     den Grace-Bereich (limit .. limit+5). Bei `hard_block` (count >= limit+5) gibt die Route
     403 zurueck — explizit "kein Override, auch nicht mit confirm" (Zeile 172). Kein Tarif-Bypass.
   - 3-Stufen-Logik (Phase 115) arbeitet wie spezifiziert: under_limit -> ok, grace -> 409/confirm, hard_block -> 403.

### 3. Material-CRUD — ERLEDIGT: Admins duerfen jetzt verwalten
   - material.js Tags + Material + Files CRUD von requireOrgAdmin auf requireAdmin umgestellt
     (01.06.). admin + org_admin koennen verwalten, Teamer weiterhin nur lesen (requireTeamer).
     Test ergaenzt (admin erstellt Tag -> 201).

### 4. Teamer-Rechte je nach Kontext — ENTSCHIEDEN: so gewollt (kein Handlungsbedarf)
   - Teamer wie admin bei Events (teamer_needed/teamer_only), aber bei Aktivitaeten/Konfis auf
     zugewiesene Jahrgaenge begrenzt. Das ist beabsichtigtes Design, bleibt wie ist.

### 5. Zwei Request-Systeme — GEKLAERT: KEIN Duplikat, beide korrekt
   - `/konfi/requests` (jeder Konfi) ist fuer KONFI-Aktivitaeten, `/teamer/requests` (requireTeamer,
     Kommentar "nur Teamer-Aktivitaeten") fuer TEAMER-Aktivitaeten. Beide schreiben in dieselbe
     Tabelle activity_requests, aber fuer unterschiedliche Aktivitaetstypen. Hintergrund: Konfis
     koennen zu Teamern befoerdert werden — dann reicht dieselbe Person je nach Aktivitaetstyp ueber
     den passenden Endpoint ein. Beide bleiben. Kein Deprecate.

---

**Ende Rollen-Feature-Matrix**