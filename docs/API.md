openapi: 3.0.3
info:
  title: Konfi Quest API
  description: API für die Konfi Quest App zur Verwaltung von Konfis, Aktivitäten, Punkten, Organisationen und mehr.
  version: 1.1.0
  contact:
    name: Konfi Quest Team
    email: team@konfi-quest.de

servers:
  - url: https://konfipoints.godsapp.de/api
    description: Production Server
  - url: http://localhost:5000/api
    description: Development Server

# ====================================================================
# Tags (Gruppierung der Endpunkte in der UI)
# ====================================================================
tags:
  - name: Authentication
    description: Authentifizierung und Benutzer-Login.
  - name: Konfi (Public)
    description: Endpunkte für eingeloggte Konfis zur Ansicht ihrer eigenen Daten.
  - name: Activities (Admin)
    description: Verwaltung der Aktivitäten-Masterliste und Zuweisungen durch Admins.
  - name: Badges (Admin)
    description: Verwaltung des Badge-Systems durch Admins.
  - name: Categories (Admin)
    description: Verwaltung von Aktivitäts- und Event-Kategorien.
  - name: Chat
    description: Echtzeit-Chat-Funktionen.
  - name: Events
    description: Verwaltung und Buchung von Events.
  - name: Jahrgänge (Admin)
    description: Verwaltung der Konfi-Jahrgänge.
  - name: Konfis (Admin)
    description: Verwaltung der Konfi-Profile durch Admins.
  - name: Organizations
    description: Verwaltung von Organisationen (Mandanten).
  - name: Permissions
    description: Abrufen verfügbarer Berechtigungen.
  - name: Roles
    description: Verwaltung von Benutzerrollen und deren Berechtigungen.
  - name: Settings
    description: Systemeinstellungen.
  - name: Statistics
    description: Abrufen von Statistiken und Ranglisten.
  - name: Users
    description: Verwaltung von Admin-/Teamer-Benutzern.
  - name: Health Check
    description: Überprüfung des Server-Status.

# ====================================================================
# Reusable Components
# ====================================================================
components:
  # --------------------------------------------------------------------
  # Schemas (Datenmodelle)
  # --------------------------------------------------------------------
  schemas:
    # Allgemeine Schemas
    ErrorResponse:
      type: object
      properties:
        error:
          type: string
          description: Eine menschenlesbare Fehlerbeschreibung.
          example: "Activity not found"
    SuccessMessage:
      type: object
      properties:
        message:
          type: string
          example: "Operation successful"

    # Authentifizierung
    LoginCredentials:
      type: object
      required: [username, password]
      properties:
        username:
          type: string
        password:
          type: string
          format: password
    LoginResponse:
      type: object
      properties:
        token:
          type: string
          description: JWT-Token für die Authentifizierung.
        user:
          type: object
          properties:
            id:
              type: integer
            display_name:
              type: string
            username:
              type: string
            email:
              type: string
              format: email
            type:
              type: string
              enum: [admin, konfi]
            organization:
              type: string
            roles:
              type: array
              items:
                type: string

    # Konfi
    Konfi:
      type: object
      properties:
        id: { type: integer }
        name: { type: string }
        username: { type: string }
        jahrgang_id: { type: integer }
        jahrgang_name: { type: string }
        gottesdienst_points: { type: integer }
        gemeinde_points: { type: integer }
        password_plain: { type: string, description: "Nur bei der Erstellung oder Passwort-Reset sichtbar." }
    KonfiInput:
      type: object
      required: [name, jahrgang_id]
      properties:
        name: { type: string }
        jahrgang_id: { type: integer }

    # Jahrgang
    Jahrgang:
      type: object
      properties:
        id: { type: integer }
        name: { type: string }
        confirmation_date: { type: string, format: date }
    JahrgangInput:
      type: object
      required: [name]
      properties:
        name: { type: string }
        confirmation_date: { type: string, format: date }

    # Aktivität
    CategoryInfo:
      type: object
      properties:
        id: { type: integer }
        name: { type: string }
    Activity:
      type: object
      properties:
        id: { type: integer }
        name: { type: string }
        points: { type: integer }
        type: { type: string, enum: [gottesdienst, gemeinde] }
        categories:
          type: array
          items:
            $ref: '#/components/schemas/CategoryInfo'
    ActivityInput:
      type: object
      required: [name, points, type]
      properties:
        name: { type: string }
        points: { type: integer }
        type: { type: string, enum: [gottesdienst, gemeinde] }
        category_ids:
          type: array
          items:
            type: integer
    
    # Anträge (Requests)
    ActivityRequest:
      type: object
      properties:
        id: { type: integer }
        konfi_id: { type: integer }
        konfi_name: { type: string }
        activity_id: { type: integer }
        activity_name: { type: string }
        activity_points: { type: integer }
        requested_date: { type: string, format: date }
        comment: { type: string }
        photo_filename: { type: string }
        status: { type: string, enum: [pending, approved, rejected] }
        admin_comment: { type: string }
        approved_by_name: { type: string }
        created_at: { type: string, format: date-time }
    RequestStatusUpdate:
      type: object
      required: [status]
      properties:
        status: { type: string, enum: [approved, rejected] }
        admin_comment: { type: string }
    
    # Zuweisungen
    AssignActivityInput:
      type: object
      required: [konfiId, activityId]
      properties:
        konfiId: { type: integer }
        activityId: { type: integer }
        completed_date: { type: string, format: date }
    AssignBonusInput:
      type: object
      required: [konfiId, points, type, description]
      properties:
        konfiId: { type: integer }
        points: { type: integer }
        type: { type: string, enum: [gottesdienst, gemeinde] }
        description: { type: string }
        completed_date: { type: string, format: date }

    # Kategorien
    Category:
      type: object
      properties:
        id: { type: integer }
        name: { type: string }
        description: { type: string }
        type: { type: string, enum: [activity, event, both] }
    CategoryInput:
      type: object
      required: [name]
      properties:
        name: { type: string }
        description: { type: string }
        type: { type: string, enum: [activity, event, both] }

    # Badges
    Badge:
      type: object
      properties:
        id: { type: integer }
        name: { type: string }
        icon: { type: string }
        description: { type: string }
        criteria_type: { type: string }
        criteria_value: { type: integer }
        criteria_extra: { type: string, description: "JSON string mit zusätzlichen Kriterien" }
        is_active: { type: boolean }
        is_hidden: { type: boolean }
        created_by_name: { type: string }
        earned_count: { type: integer }
    BadgeInput:
      type: object
      required: [name, icon, criteria_type, criteria_value]
      properties:
        name: { type: string }
        icon: { type: string }
        description: { type: string }
        criteria_type: { type: string }
        criteria_value: { type: integer }
        criteria_extra: { type: object, description: "Zusätzliche Kriterien als JSON-Objekt" }
        is_active: { type: boolean }
        is_hidden: { type: boolean }
    
    # Organisationen, Rollen, Benutzer (RBAC)
    User:
      type: object
      properties:
        id: { type: integer }
        username: { type: string }
        email: { type: string, format: email }
        display_name: { type: string }
        is_active: { type: boolean }
        role_name: { type: string }
    UserInput:
      type: object
      required: [username, display_name, password, role_id]
      properties:
        username: { type: string }
        email: { type: string, format: email }
        display_name: { type: string }
        password: { type: string, format: password }
        role_id: { type: integer }
    
    Role:
      type: object
      properties:
        id: { type: integer }
        name: { type: string }
        display_name: { type: string }
        description: { type: string }
        is_system_role: { type: boolean }
        user_count: { type: integer }
        permission_count: { type: integer }
    RoleInput:
      type: object
      required: [name, display_name]
      properties:
        name: { type: string }
        display_name: { type: string }
        description: { type: string }
        permissions:
          type: array
          items:
            type: object
            properties:
              permission_id: { type: integer }
              granted: { type: boolean }

  # --------------------------------------------------------------------
  # Security Schemes
  # --------------------------------------------------------------------
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: "JWT Token für die Authentifizierung aller geschützten Endpunkte."

# ====================================================================
# API Paths
# ====================================================================
paths:
  # --------------------------------------------------------------------
  # Health Check
  # --------------------------------------------------------------------
  /health:
    get:
      tags: [Health Check]
      summary: Überprüft den Status der API.
      responses:
        '200':
          description: API ist online und funktionsfähig.
          content:
            application/json:
              schema:
                type: object
                properties:
                  status: { type: string, example: "OK" }
                  message: { type: string, example: "Konfi Points API is running" }

  # --------------------------------------------------------------------
  # Authentication
  # --------------------------------------------------------------------
  /auth/login:
    post:
      tags: [Authentication]
      summary: Loggt einen Benutzer (Admin oder Konfi) ein.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/LoginCredentials'
      responses:
        '200':
          description: Login erfolgreich.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/LoginResponse'
        '401':
          description: Ungültige Anmeldedaten.
  
  # --------------------------------------------------------------------
  # Konfi (Public) - Routen für eingeloggte Konfis
  # --------------------------------------------------------------------
  /konfi/dashboard:
    get:
      tags: [Konfi (Public)]
      summary: Ruft die Dashboard-Daten für den eingeloggten Konfi ab.
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Dashboard-Daten erfolgreich geladen.
        '403':
          description: Zugriff nur für Konfis erlaubt.

  # --------------------------------------------------------------------
  # Admin: Konfis
  # --------------------------------------------------------------------
  /admin/konfis:
    get:
      tags: [Konfis (Admin)]
      summary: Ruft alle Konfis einer Organisation ab.
      description: Erfordert die Berechtigung `admin.konfis.view`.
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Eine Liste von Konfis.
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Konfi'
    post:
      tags: [Konfis (Admin)]
      summary: Erstellt einen neuen Konfi.
      description: Erfordert die Berechtigung `admin.konfis.create`.
      security:
        - bearerAuth: []
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/KonfiInput'
      responses:
        '201':
          description: Konfi erfolgreich erstellt.

  /admin/konfis/{id}:
    parameters:
      - name: id
        in: path
        required: true
        schema: { type: integer }
    get:
      tags: [Konfis (Admin)]
      summary: Ruft die Details eines bestimmten Konfis ab.
      description: Erfordert die Berechtigung `admin.konfis.view`.
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Konfi-Details.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Konfi'
        '404':
          description: Konfi nicht gefunden.
    put:
      tags: [Konfis (Admin)]
      summary: Aktualisiert einen Konfi.
      description: Erfordert die Berechtigung `admin.konfis.edit`.
      security:
        - bearerAuth: []
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/KonfiInput'
      responses:
        '200':
          description: Konfi erfolgreich aktualisiert.
    delete:
      tags: [Konfis (Admin)]
      summary: Löscht einen Konfi und alle zugehörigen Daten.
      description: Erfordert die Berechtigung `admin.konfis.delete`.
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Konfi erfolgreich gelöscht.

  /admin/konfis/{id}/regenerate-password:
    post:
      tags: [Konfis (Admin)]
      summary: Generiert ein neues Passwort für einen Konfi.
      description: Erfordert die Berechtigung `admin.konfis.reset_password`.
      security:
        - bearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: integer }
      responses:
        '200':
          description: Neues Passwort wurde generiert.
          content:
            application/json:
              schema:
                type: object
                properties:
                  message: { type: string }
                  password: { type: string }

  # --------------------------------------------------------------------
  # Admin: Aktivitäten
  # --------------------------------------------------------------------
  /admin/activities:
    get:
      tags: [Activities (Admin)]
      summary: Ruft die Masterliste aller Aktivitäten ab.
      description: Erfordert die Berechtigung `admin.activities.view`.
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Eine Liste von Aktivitäten.
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Activity'
    post:
      tags: [Activities (Admin)]
      summary: Erstellt eine neue Aktivität in der Masterliste.
      description: Erfordert die Berechtigung `admin.activities.create`.
      security:
        - bearerAuth: []
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ActivityInput'
      responses:
        '201':
          description: Aktivität erstellt.

  /admin/activities/{id}:
    parameters:
      - name: id
        in: path
        required: true
        schema: { type: integer }
    put:
      tags: [Activities (Admin)]
      summary: Aktualisiert eine Aktivität in der Masterliste.
      description: Erfordert die Berechtigung `admin.activities.edit`.
      security:
        - bearerAuth: []
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ActivityInput'
      responses:
        '200':
          description: Aktivität aktualisiert.
    delete:
      tags: [Activities (Admin)]
      summary: Löscht eine Aktivität aus der Masterliste.
      description: Funktioniert nur, wenn die Aktivität nicht in Verwendung ist. Erfordert die Berechtigung `admin.activities.delete`.
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Aktivität gelöscht.
        '409':
          description: Aktivität wird verwendet und kann nicht gelöscht werden.

  /admin/activities/requests:
    get:
      tags: [Activities (Admin)]
      summary: Ruft alle offenen und bearbeiteten Aktivitätsanträge ab.
      description: Erfordert die Berechtigung `admin.requests.view`.
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Eine Liste von Anträgen.
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/ActivityRequest'
  
  /admin/activities/requests/{id}:
    parameters:
      - name: id
        in: path
        required: true
        schema: { type: integer }
    put:
      tags: [Activities (Admin)]
      summary: Genehmigt oder lehnt einen Aktivitätsantrag ab.
      description: Erfordert die Berechtigung `admin.requests.approve`.
      security:
        - bearerAuth: []
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/RequestStatusUpdate'
      responses:
        '200':
          description: Antragsstatus aktualisiert.

  /admin/activities/assign-activity:
    post:
      tags: [Activities (Admin)]
      summary: Weist einem Konfi direkt eine Aktivität zu.
      description: Erfordert die Berechtigung `admin.konfis.assign_points`.
      security:
        - bearerAuth: []
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/AssignActivityInput'
      responses:
        '200':
          description: Aktivität erfolgreich zugewiesen.
  
  /admin/activities/assign-bonus:
    post:
      tags: [Activities (Admin)]
      summary: Weist einem Konfi Bonuspunkte zu.
      description: Erfordert die Berechtigung `admin.konfis.assign_points`.
      security:
        - bearerAuth: []
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/AssignBonusInput'
      responses:
        '200':
          description: Bonuspunkte erfolgreich zugewiesen.

  # --------------------------------------------------------------------
  # Admin: Badges
  # --------------------------------------------------------------------
  /admin/badges:
    get:
      tags: [Badges (Admin)]
      summary: Ruft alle konfigurierbaren Badges ab.
      description: Erfordert die Berechtigung `admin.badges.view`.
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Eine Liste von Badges.
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Badge'
    post:
      tags: [Badges (Admin)]
      summary: Erstellt einen neuen Badge.
      description: Erfordert die Berechtigung `admin.badges.create`.
      security:
        - bearerAuth: []
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/BadgeInput'
      responses:
        '201':
          description: Badge erfolgreich erstellt.

  /admin/badges/criteria-types:
    get:
      tags: [Badges (Admin)]
      summary: Ruft alle verfügbaren Kriterientypen für Badges ab.
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Eine Map von Kriterientypen.

  /admin/badges/{id}:
    parameters:
      - name: id
        in: path
        required: true
        schema: { type: integer }
    put:
      tags: [Badges (Admin)]
      summary: Aktualisiert einen Badge.
      description: Erfordert die Berechtigung `admin.badges.edit`.
      security:
        - bearerAuth: []
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/BadgeInput'
      responses:
        '200':
          description: Badge erfolgreich aktualisiert.
    delete:
      tags: [Badges (Admin)]
      summary: Löscht einen Badge.
      description: Erfordert die Berechtigung `admin.badges.delete`.
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Badge erfolgreich gelöscht.

  # --------------------------------------------------------------------
  # Admin: Kategorien
  # --------------------------------------------------------------------
  /admin/categories:
    get:
      tags: [Categories (Admin)]
      summary: Ruft alle Kategorien ab.
      description: Erfordert die Berechtigung `admin.categories.view`.
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Eine Liste von Kategorien.
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Category'
    post:
      tags: [Categories (Admin)]
      summary: Erstellt eine neue Kategorie.
      description: Erfordert die Berechtigung `admin.categories.create`.
      security:
        - bearerAuth: []
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CategoryInput'
      responses:
        '201':
          description: Kategorie erstellt.

  /admin/categories/{id}:
    parameters:
      - name: id
        in: path
        required: true
        schema: { type: integer }
    put:
      tags: [Categories (Admin)]
      summary: Aktualisiert eine Kategorie.
      description: Erfordert die Berechtigung `admin.categories.edit`.
      security:
        - bearerAuth: []
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CategoryInput'
      responses:
        '200':
          description: Kategorie aktualisiert.
    delete:
      tags: [Categories (Admin)]
      summary: Löscht eine Kategorie.
      description: Funktioniert nur, wenn die Kategorie nicht in Verwendung ist. Erfordert die Berechtigung `admin.categories.delete`.
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Kategorie gelöscht.
        '409':
          description: Kategorie wird verwendet.

  # --------------------------------------------------------------------
  # Admin: Jahrgänge
  # --------------------------------------------------------------------
  /admin/jahrgaenge:
    get:
      tags: [Jahrgänge (Admin)]
      summary: Ruft alle Jahrgänge ab.
      description: Erfordert die Berechtigung `admin.jahrgaenge.view`.
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Eine Liste von Jahrgängen.
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Jahrgang'
    post:
      tags: [Jahrgänge (Admin)]
      summary: Erstellt einen neuen Jahrgang.
      description: Erfordert die Berechtigung `admin.jahrgaenge.create`.
      security:
        - bearerAuth: []
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/JahrgangInput'
      responses:
        '201':
          description: Jahrgang erstellt.

  /admin/jahrgaenge/{id}:
    parameters:
      - name: id
        in: path
        required: true
        schema: { type: integer }
    put:
      tags: [Jahrgänge (Admin)]
      summary: Aktualisiert einen Jahrgang.
      description: Erfordert die Berechtigung `admin.jahrgaenge.edit`.
      security:
        - bearerAuth: []
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/JahrgangInput'
      responses:
        '200':
          description: Jahrgang aktualisiert.
    delete:
      tags: [Jahrgänge (Admin)]
      summary: Löscht einen Jahrgang.
      description: Funktioniert nur, wenn keine Konfis zugewiesen sind. Erfordert die Berechtigung `admin.jahrgaenge.delete`.
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Jahrgang gelöscht.
        '409':
          description: Jahrgang wird verwendet.

  # --------------------------------------------------------------------
  # RBAC: Users, Roles, Permissions, Organizations
  # --------------------------------------------------------------------
  /users:
    get:
      tags: [Users]
      summary: Ruft alle Benutzer (Admins/Teamer) der Organisation ab.
      description: Erfordert die Berechtigung `admin.users.view`.
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Eine Liste von Benutzern.
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/User'
    post:
      tags: [Users]
      summary: Erstellt einen neuen Benutzer.
      description: Erfordert die Berechtigung `admin.users.create`.
      security:
        - bearerAuth: []
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UserInput'
      responses:
        '201':
          description: Benutzer erstellt.

  # Die restlichen Endpunkte für Users, Roles, etc. folgen dem gleichen Muster...
  # Ich lasse sie hier aus, um die Antwort übersichtlich zu halten, aber das Prinzip ist klar.
  # /users/{id}, /roles, /roles/{id}, /permissions/grouped, /organizations, etc.