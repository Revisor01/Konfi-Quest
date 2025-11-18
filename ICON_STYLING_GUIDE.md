# Icon & Circle Styling Guide - Konfi Quest

Dieser Guide definiert die standardisierten Styles für Icons und Kreise im gesamten Konfi Quest System.

## 1. Listen-Icons (28px Kreise)

Verwendet in: Grauen Listen-Items (#fbfbfb), Detail-Ansichten, Modals

### Basis-Struktur:

```tsx
<div style={{
  width: '28px',
  height: '28px',
  backgroundColor: '{FARBE}',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  boxShadow: '{SCHATTEN_MIT_SCHIMMER}'
}}>
  <IonIcon icon={iconName} style={{ fontSize: '0.9rem', color: 'white' }} />
</div>
```

### Farben & Schatten:

| Verwendung | Farbe | Box Shadow |
|------------|-------|------------|
| **Primary/Events** | `#eb445a` | `0 2px 8px rgba(235, 68, 90, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)` |
| **Konfis/Lila** | `#8b5cf6` | `0 2px 8px rgba(139, 92, 246, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)` |
| **Success/Grün** | `#2dd36f` | `0 2px 8px rgba(45, 211, 111, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)` |
| **Blau/Bestätigt** | `#007aff` | `0 2px 8px rgba(0, 122, 255, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)` |
| **Orange/Warning** | `#ff9500` | `0 2px 8px rgba(255, 149, 0, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)` |
| **Danger/Rot** | `#eb445a` | `0 2px 8px rgba(235, 68, 90, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)` |

### Beispiel - Teilnehmer Status Icon:

```tsx
<div style={{
  width: '28px',
  height: '28px',
  backgroundColor: participant.attendance_status === 'present' ? '#2dd36f' :
                  participant.attendance_status === 'absent' ? '#eb445a' :
                  participant.status === 'pending' ? '#ff9500' : '#007aff',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  boxShadow: participant.attendance_status === 'present' ? '0 2px 8px rgba(45, 211, 111, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)' :
             participant.attendance_status === 'absent' ? '0 2px 8px rgba(235, 68, 90, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)' :
             participant.status === 'pending' ? '0 2px 8px rgba(255, 149, 0, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)' :
             '0 2px 8px rgba(0, 122, 255, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)'
}}>
  <IonIcon
    icon={participant.attendance_status === 'present' ? checkmarkCircle :
          participant.attendance_status === 'absent' ? closeCircle : people}
    style={{ fontSize: '0.9rem', color: 'white' }}
  />
</div>
```

### Beispiel - Konfi Initialen Icon (Lila):

```tsx
<div style={{
  width: '28px',
  height: '28px',
  backgroundColor: '#8b5cf6',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  boxShadow: '0 2px 8px rgba(139, 92, 246, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)'
}}>
  <span style={{
    fontSize: '0.7rem',
    fontWeight: '600',
    color: 'white',
    textTransform: 'uppercase'
  }}>
    {konfi.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
  </span>
</div>
```

---

## 2. Header Icons (32px Kreise)

Verwendet in: Sektions-Headers in Modals, Detail-View Headers

### Basis-Struktur:

```tsx
<div style={{
  width: '32px',
  height: '32px',
  backgroundColor: '#eb445a',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 2px 8px rgba(235, 68, 90, 0.3)',
  flexShrink: 0
}}>
  <IonIcon icon={iconName} style={{ fontSize: '1rem', color: 'white' }} />
</div>
```

**WICHTIG:** Header-Icons verwenden KEINEN Schimmer-Effekt (kein `inset`), nur normalen Schatten!

### Verwendung:

```tsx
{/* SEKTION HEADER */}
<div style={{
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  margin: '16px 16px 12px 16px'
}}>
  <div style={{
    width: '32px',
    height: '32px',
    backgroundColor: '#eb445a',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(235, 68, 90, 0.3)',
    flexShrink: 0
  }}>
    <IonIcon icon={personAdd} style={{ fontSize: '1rem', color: 'white' }} />
  </div>
  <h2 style={{
    fontWeight: '600',
    fontSize: '1.1rem',
    margin: '0',
    color: '#333'
  }}>
    Sektion Titel
  </h2>
</div>
```

---

## 3. Swipe Action Icons (44px Kreise)

Verwendet in: IonItemSliding Swipe-Actions (Löschen, Abbrechen, etc.)

### Basis-Struktur:

```tsx
<IonItemOptions side="end" style={{
  gap: '4px',
  '--ion-item-background': 'transparent'
}}>
  <IonItemOption
    onClick={handleAction}
    style={{
      '--background': 'transparent',
      '--background-activated': 'transparent',
      '--background-focused': 'transparent',
      '--background-hover': 'transparent',
      '--color': 'transparent',
      '--ripple-color': 'transparent',
      padding: '0 2px',
      paddingRight: '20px',  // Nur beim letzten Icon (rechteste Position)
      minWidth: '48px',
      maxWidth: '68px'       // 68px wenn paddingRight: 20px, sonst 48px
    }}
  >
    <div style={{
      width: '44px',
      height: '44px',
      backgroundColor: '{FARBE}',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '{SCHATTEN_MIT_SCHIMMER}'
    }}>
      <IonIcon icon={iconName} style={{ fontSize: '1.2rem', color: 'white' }} />
    </div>
  </IonItemOption>
</IonItemOptions>
```

### Farben & Schatten für Swipe Actions:

| Action | Farbe | Icon | Box Shadow |
|--------|-------|------|------------|
| **Löschen** | `#dc3545` | `trash` | `0 2px 8px rgba(220, 53, 69, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)` |
| **Abbrechen/Cancel** | `#ff9500` | `ban` | `0 2px 8px rgba(255, 149, 0, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)` |
| **Warteliste** | `#ff9500` | `list` | `0 2px 8px rgba(255, 149, 0, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)` |

### Vollständiges Beispiel:

```tsx
<IonItemSliding key={item.id}>
  <IonItem {...itemProps}>
    {/* Item Content */}
  </IonItem>

  <IonItemOptions side="end" style={{
    gap: '4px',
    '--ion-item-background': 'transparent'
  }}>
    {/* Optional: Warteliste Action */}
    <IonItemOption
      onClick={() => handleDemote(item)}
      style={{
        '--background': 'transparent',
        '--background-activated': 'transparent',
        '--background-focused': 'transparent',
        '--background-hover': 'transparent',
        '--color': 'transparent',
        '--ripple-color': 'transparent',
        padding: '0 2px',
        minWidth: '48px',
        maxWidth: '48px'
      }}
    >
      <div style={{
        width: '44px',
        height: '44px',
        backgroundColor: '#ff9500',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(255, 149, 0, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)'
      }}>
        <IonIcon icon={list} style={{ fontSize: '1.2rem', color: 'white' }} />
      </div>
    </IonItemOption>

    {/* Delete Action (immer rechts) */}
    <IonItemOption
      onClick={() => handleDelete(item)}
      style={{
        '--background': 'transparent',
        '--background-activated': 'transparent',
        '--background-focused': 'transparent',
        '--background-hover': 'transparent',
        '--color': 'transparent',
        '--ripple-color': 'transparent',
        padding: '0 2px',
        paddingRight: '20px',
        minWidth: '48px',
        maxWidth: '68px'
      }}
    >
      <div style={{
        width: '44px',
        height: '44px',
        backgroundColor: '#dc3545',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(220, 53, 69, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)'
      }}>
        <IonIcon icon={trash} style={{ fontSize: '1.2rem', color: 'white' }} />
      </div>
    </IonItemOption>
  </IonItemOptions>
</IonItemSliding>
```

---

## 4. Wichtige Regeln

### Box Shadow Anatomy:

```
boxShadow: '0 2px 8px rgba(R, G, B, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)'
           \_____________________________/  \___________________________________/
                    Äußerer Schatten                    Innerer Schimmer
```

- **Äußerer Schatten**: `0 2px 8px rgba({FARBE}, 0.4)` - nutzt die Icon-Farbe mit 40% Opacity
- **Innerer Schimmer**: `inset 0 1px 2px rgba(255, 255, 255, 0.3)` - immer gleich (weiß, 30%)

### Sizing:

| Kontext | Größe | Icon Size | Verwendung |
|---------|-------|-----------|------------|
| Listen-Icons | 28px | 0.9rem | Graue Listen, Modals, Details |
| Header-Icons | 32px | 1rem | Sektions-Header in Modals |
| Swipe-Icons | 44px | 1.2rem | Swipe-Actions |

### Transparenz für Swipe-Actions:

**IMMER** diese CSS-Variablen setzen, um blaues Click-Highlight zu entfernen:

```tsx
style={{
  '--background': 'transparent',
  '--background-activated': 'transparent',
  '--background-focused': 'transparent',
  '--background-hover': 'transparent',
  '--color': 'transparent',
  '--ripple-color': 'transparent'
}}
```

Und auf `IonItemOptions`:

```tsx
style={{
  gap: '4px',
  '--ion-item-background': 'transparent'
}}
```

---

## 5. Häufige Anwendungsfälle

### Status-Indikatoren (Events):

| Status | Farbe | Icon | Shadow |
|--------|-------|------|--------|
| Offen | `#007aff` | `checkmarkCircle` | `rgba(0, 122, 255, 0.4)` |
| Bald | `#fd7e14` | `hourglass` | `rgba(253, 126, 20, 0.4)` |
| Geschlossen | `#dc3545` | `close` | `rgba(220, 38, 38, 0.4)` |
| Abgesagt | `#dc3545` | `close` | `rgba(220, 38, 38, 0.4)` |
| Verbucht | `#6c757d` | `checkmarkCircle` | `rgba(108, 117, 125, 0.4)` |
| Zu Verbuchen | `#ff6b35` | `hourglass` | `rgba(255, 107, 53, 0.4)` |

### Anwesenheit-Status (Teilnehmer):

| Status | Farbe | Icon | Shadow |
|--------|-------|------|--------|
| Anwesend | `#2dd36f` | `checkmarkCircle` | `rgba(45, 211, 111, 0.4)` |
| Abwesend | `#eb445a` | `closeCircle` | `rgba(235, 68, 90, 0.4)` |
| Bestätigt | `#007aff` | `people` | `rgba(0, 122, 255, 0.4)` |
| Warteliste | `#ff9500` | `people` | `rgba(255, 149, 0, 0.4)` |

---

## 6. Checkliste für neue Icons

- [ ] Richtige Größe gewählt (28px/32px/44px)?
- [ ] `borderRadius: '50%'` gesetzt?
- [ ] `flexShrink: 0` für konstante Größe?
- [ ] Box Shadow mit äußerem Schatten UND innerem Schimmer?
- [ ] RGBA-Werte im Schatten passen zur Hintergrundfarbe?
- [ ] Icon-Farbe ist weiß?
- [ ] Icon fontSize passt zur Kreisgröße?
- [ ] Bei Swipe-Actions: Alle Transparenz-Variablen gesetzt?
- [ ] Bei Swipe-Actions: `paddingRight: '20px'` nur beim letzten Icon?

---

**Letzte Aktualisierung**: 2025-01-18
