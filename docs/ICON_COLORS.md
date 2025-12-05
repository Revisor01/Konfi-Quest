# Icon-Farbpalette - Konfi Quest

Konsistente Farben für Icons in allen Listen und Views.

## Primäre Icons (aus EventsView)

| Icon | Ionicon | Bedeutung | Farbe | Hex-Code |
|------|---------|-----------|-------|----------|
| Kalender | `calendar` | Datum | Rot | `#dc2626` |
| Uhrzeit | `time` | Uhrzeit | Orange | `#ff6b35` |
| Ort | `location` | Location | Blau | `#007aff` |
| Personen | `people` | Teilnehmer | Grün | `#34c759` |
| Pokal | `trophy` | Punkte | Gold | `#ff9500` |
| Liste | `listOutline` | Warteliste | Orange | `#fd7e14` |

## Rollen & Verwaltung

| Icon | Ionicon | Bedeutung | Farbe | Hex-Code |
|------|---------|-----------|-------|----------|
| Schild | `shield` | Admin/Rolle | Blau | `#3b82f6` |
| Person | `person` | Teamer | Orange | `#f59e0b` |
| Schule | `school` | Jahrgänge | Blau | `#007aff` |
| Gebäude | `business` | Organisation | Grün | `#2dd36f` |
| At-Zeichen | `at` | Benutzername | Blau | `#007aff` |
| E-Mail | `mailOutline` | E-Mail | Blau | `#007aff` |
| Aktentasche | `briefcaseOutline` | Funktionsbeschreibung | Orange | `#f59e0b` |

## Inhalte

| Icon | Ionicon | Bedeutung | Farbe | Hex-Code |
|------|---------|-----------|-------|----------|
| Blitz | `flash` | Aktivitäten | Grün | `#16a34a` |
| Preisschild | `pricetag` | Kategorien | Orange | `#ff9500` |
| Pokal | `trophy` | Level | Lila | `#9b59b6` |
| Stern | `star` | Badges | Gold | `#ff9500` |
| Dokument | `document` | Anträge | Antragsgrün | `#059669` |

## Status-Farben

| Status | Farbe | Hex-Code | Verwendung |
|--------|-------|----------|------------|
| Offen/Aktiv | Blau | `#007aff` | Anmeldung offen |
| Erfolg | Grün | `#34c759` | Verbucht, Bestätigt |
| Warnung | Orange | `#ff6b35` | Zu verbuchen, Bald |
| Fehler/Abgesagt | Rot | `#dc3545` | Abgesagt, Geschlossen |
| Inaktiv | Grau | `#6c757d` | Vergangen, Deaktiviert |

## Gradient-Farben (Header)

| View | Gradient | Start | End |
|------|----------|-------|-----|
| Events | Rot | `#dc2626` | `#991b1b` |
| Users | Lila | `#667eea` | `#764ba2` |
| Aktivitäten | Grün | `#16a34a` | `#15803d` |
| Level | Lila | `#9b59b6` | `#8e44ad` |
| Konfis | Blau | `#3b82f6` | `#1d4ed8` |
| Anträge | Antragsgrün | `#059669` | `#047857` |
| Organisationen | Grün | `#2dd36f` | `#16a34a` |

## Verwendung

```tsx
// Beispiel: Icon in Liste
<IonIcon
  icon={calendar}
  style={{ fontSize: '0.9rem', color: '#dc2626' }}
/>

// Beispiel: Icon-Kreis
<div style={{
  width: '32px',
  height: '32px',
  backgroundColor: '#dc2626',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
}}>
  <IonIcon icon={calendar} style={{ fontSize: '0.9rem', color: 'white' }} />
</div>
```
