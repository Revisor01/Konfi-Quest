# Listen Design Guide - Konfi Quest

Dieser Guide definiert das standardisierte Listen-Design für alle Listen im Konfi Quest System (Events, Konfis, Aktivitäten, etc.).

**Basis**: EventsView - Optimierte, kompakte Listendarstellung mit Swipe-Actions

---

## 1. Listen-Container

### Card mit List:
```tsx
<IonCard style={{ margin: '16px' }}>
  <IonCardContent style={{ padding: '8px 0' }}>
    <IonList lines="none" style={{ background: 'transparent' }}>
      {/* List Items */}
    </IonList>
  </IonCardContent>
</IonCard>
```

---

## 2. Listen-Item Struktur

### Basis-Template:
```tsx
<IonItemSliding key={item.id}>
  <IonItem
    button
    onClick={() => onSelect(item)}
    detail={false}
    style={{
      '--min-height': '110px',
      '--padding-start': '16px',
      '--padding-top': '0px',
      '--padding-bottom': '0px',
      '--background': '#fbfbfb',
      '--border-radius': '12px',
      margin: '4px 8px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      border: '1px solid #e0e0e0',
      borderRadius: '12px',
      opacity: shouldGrayOut ? 0.6 : 1
    }}
  >
    <IonLabel>
      {/* Item Content - siehe unten */}
    </IonLabel>
  </IonItem>

  {/* Swipe Actions - siehe unten */}
</IonItemSliding>
```

### Wichtige Werte:
- **min-height**: `110px` (kompakt, aber lesbar)
- **margin**: `4px 8px` (vertikal 4px, horizontal 8px)
- **background**: `#fbfbfb` (leichtes Grau)
- **border**: `1px solid #e0e0e0` (dezenter Rahmen)
- **boxShadow**: `0 2px 8px rgba(0,0,0,0.06)` (subtiler Schatten)

### Sonderfälle - Border/Shadow:
```tsx
// Abgesagt/Cancelled
boxShadow: '0 2px 8px rgba(239, 68, 68, 0.2)'
border: '1px solid #fca5a5'

// Konfirmation (nur bei Events)
boxShadow: '0 2px 8px rgba(139, 92, 246, 0.15)'
border: '1px solid #c4b5fd'
```

---

## 3. Item Content Layout

### Struktur (3 Zeilen):

```tsx
<IonLabel>
  {/* ZEILE 1: Header mit Icon und Status Badge */}
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '6px'
  }}>
    {/* 32px Status-Icon */}
    <div style={{
      width: '32px',
      height: '32px',
      backgroundColor: statusColor,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)',
      flexShrink: 0
    }}>
      <IonIcon icon={statusIcon} style={{ fontSize: '1rem', color: 'white' }} />
    </div>

    {/* Titel */}
    <h2 style={{
      fontWeight: '600',
      fontSize: 'clamp(0.9rem, 2.5vw, 1.1rem)',
      margin: '0',
      color: '#333',
      lineHeight: '1.3',
      flex: 1,
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }}>
      {item.name}
    </h2>

    {/* Status Badge - rechtsbündig */}
    <div style={{
      marginLeft: 'auto',
      display: 'flex',
      gap: '4px',
      alignItems: 'center',
      flexShrink: 0
    }}>
      <span style={{
        fontSize: '0.7rem',
        color: statusColor,
        fontWeight: '600',
        backgroundColor: statusBgColor,
        padding: '3px 6px',
        borderRadius: '6px',
        border: statusBorderColor,
        whiteSpace: 'nowrap',
        boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        {statusText}
      </span>
    </div>
  </div>

  {/* ZEILE 2: Primäre Informationen */}
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.85rem',
    color: '#666',
    marginBottom: '4px'
  }}>
    <IonIcon icon={primaryIcon} style={{ fontSize: '0.9rem', color: '#dc2626' }} />
    <span style={{ fontWeight: '500', color: '#333' }}>{primaryInfo}</span>
    <IonIcon icon={secondaryIcon} style={{ fontSize: '0.9rem', color: '#ff6b35', marginLeft: '8px' }} />
    <span>{secondaryInfo}</span>
  </div>

  {/* ZEILE 3: Sekundäre Informationen */}
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    fontSize: '0.8rem',
    color: '#666'
  }}>
    {/* Mehrere kleine Info-Elemente mit Icons */}
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <IonIcon icon={infoIcon} style={{ fontSize: '0.8rem', color: iconColor }} />
      <span>{infoText}</span>
    </div>
  </div>
</IonLabel>
```

### Abstände zwischen Zeilen:
- **Nach Zeile 1**: `marginBottom: '6px'`
- **Nach Zeile 2**: `marginBottom: '4px'`
- **Zeile 3**: Keine marginBottom (letzte Zeile)

---

## 4. Swipe Actions

### Struktur (nach ICON_STYLING_GUIDE.md):
```tsx
<IonItemOptions side="end" style={{
  gap: '4px',
  '--ion-item-background': 'transparent'
}}>
  {/* Optionale erste Action (z.B. Warteliste) */}
  <IonItemOption
    onClick={() => handleAction1(item)}
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
      <IonIcon icon={actionIcon} style={{ fontSize: '1.2rem', color: 'white' }} />
    </div>
  </IonItemOption>

  {/* Delete Action (immer rechts, mit extra Abstand) */}
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
      paddingRight: '20px',  // Extra Abstand rechts
      minWidth: '48px',
      maxWidth: '68px'       // Größer wegen paddingRight
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
```

### Swipe-Icon Farben:
- **Delete**: `#dc3545` (Rot)
- **Warning/Warteliste**: `#ff9500` (Orange)
- **Cancel/Abbrechen**: `#ff9500` (Orange)

### Wichtig:
- Immer transparente Backgrounds für kein blaues Highlight
- `paddingRight: '20px'` NUR beim rechtesten Icon
- Schimmer-Effekt: `inset 0 1px 2px rgba(255, 255, 255, 0.3)`

---

## 5. Status-Badges

### Badge-Styling:
```tsx
<span style={{
  fontSize: '0.7rem',
  color: statusColor,
  fontWeight: '600',
  backgroundColor: statusBgColor,
  padding: '3px 6px',
  borderRadius: '6px',
  border: statusBorder,
  whiteSpace: 'nowrap',
  boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
  display: 'flex',
  alignItems: 'center',
  gap: '4px'
}}>
  {statusText}
</span>
```

### Event-Status Farben (Beispiel):
| Status | Text Color | Background | Border |
|--------|-----------|------------|--------|
| OFFEN | `#007aff` | `rgba(0, 122, 255, 0.15)` | `1px solid rgba(0, 122, 255, 0.3)` |
| BALD | `#fd7e14` | `rgba(253, 126, 20, 0.15)` | `1px solid rgba(253, 126, 20, 0.3)` |
| VERBUCHEN | `#ff6b35` | `rgba(255, 107, 53, 0.15)` | `1px solid rgba(255, 107, 53, 0.3)` |
| VERBUCHT | `#34c759` | `rgba(52, 199, 89, 0.15)` | `1px solid rgba(52, 199, 89, 0.3)` |
| GESCHLOSSEN | `#dc3545` | `rgba(220, 38, 38, 0.15)` | `1px solid rgba(220, 38, 38, 0.3)` |
| ABGESAGT | `#dc3545` | `rgba(220, 38, 38, 0.15)` | `1px solid rgba(220, 38, 38, 0.3)` |

**Formel**:
- Background: Farbe mit 15% Opacity
- Border: Farbe mit 30% Opacity

---

## 6. Icon-Farben (Zeile 2 & 3)

### Standard-Icon-Farben:
| Icon-Typ | Farbe | Verwendung |
|----------|-------|------------|
| Kalender | `#dc2626` | Datum/Event-Datum |
| Zeit | `#ff6b35` | Uhrzeit |
| Location | `#007aff` | Ort |
| People | `#34c759` | Teilnehmer/Personen |
| Trophy | `#ff9500` | Punkte |
| List | `#fd7e14` | Warteliste |

---

## 7. Gray-Out für vergangene Items

```tsx
const shouldGrayOut = isPastItem && !requiresAction;

// Auf IonItem:
opacity: shouldGrayOut ? 0.6 : 1

// Auf Text/Icons:
color: shouldGrayOut ? '#999' : normalColor
```

---

## 8. Vollständiges Beispiel (Events)

Siehe `/frontend/src/components/admin/EventsView.tsx` ab Zeile 357

Kernelemente:
- Kompakte 110px Höhe
- 3-Zeilen-Layout (Header, Primary Info, Secondary Info)
- Swipe-Actions mit Kreisen (44px)
- Status-Badge rechtsbündig
- Gray-Out für vergangene Items

---

## 9. Anpassungen für verschiedene Listen-Typen

### Events:
- Status-Badge: BALD/OFFEN/VERBUCHEN/VERBUCHT/GESCHLOSSEN
- Primary Info: Datum + Zeit
- Secondary Info: Location, Teilnehmer, Punkte

### Konfis:
- Status-Badge: Jahr/Jahrgang
- Primary Info: Email/Gruppe
- Secondary Info: Punkte, Badges, Aktivitäten

### Aktivitäten:
- Status-Badge: Kategorie
- Primary Info: Datum
- Secondary Info: Punkte, Typ

---

## 10. Best Practices

### ✅ DO:
- Verwende 110px min-height für Kompaktheit
- 4px vertikaler Margin zwischen Items
- 32px Status-Icons im Header
- 44px Swipe-Action-Icons mit Schimmer
- Transparente Swipe-Backgrounds
- Gray-Out für inaktive Items

### ❌ DON'T:
- Keine Swipe-Actions ohne transparente Backgrounds
- Kein paddingRight bei nicht-rechtesten Swipe-Icons
- Keine Status-Badges ohne Border
- Keine Icons ohne definierte Farben
- Keine vertikalen Margins > 6px zwischen Zeilen

---

**Letzte Aktualisierung**: 2025-01-18 (basierend auf finaler EventsView)
