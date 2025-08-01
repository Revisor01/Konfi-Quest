# Modal Styling Guide - Konfipoints/Konfi Quest System

## 📋 Allgemeine Prinzipien

Dieser Guide definiert das einheitliche Design für alle Modals im Konfipoints System, basierend auf dem EventModal-Design (Juli 2025).

## 🎨 Design-Struktur

### **Überschriften außerhalb der Cards**
```tsx
<div style={{ 
  display: 'flex', 
  alignItems: 'center', 
  gap: '12px',
  margin: '16px 16px 8px 16px'  // Erster Block: 16px oben, weitere: 24px oben
}}>
  <div style={{ 
    width: '32px', 
    height: '32px',
    backgroundColor: '#007aff',  // Farbkodierung je Sektion
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(0, 123, 255, 0.3)',  // Passend zur Farbe
    flexShrink: 0
  }}>
    <IonIcon icon={create} style={{ fontSize: '1rem', color: 'white' }} />
  </div>
  <h2 style={{ 
    fontWeight: '600', 
    fontSize: '1.1rem',
    margin: '0',
    color: '#333'
  }}>
    Sektions-Titel
  </h2>
</div>
```

### **Cards ohne Header**
```tsx
<IonCard style={{ margin: '0 16px 16px 16px', borderRadius: '12px' }}>
  <IonCardContent style={{ padding: '12px 0' }}>
    <IonList style={{ background: 'transparent' }}>
      {/* Inhalt */}
    </IonList>
  </IonCardContent>
</IonCard>
```

## 🎯 Farbkodierung für Icons

| Sektion | Farbe | Hex Code | Icon | Beschreibung |
|---------|-------|----------|------|--------------|
| **Grunddaten** | Blau | `#007aff` | `create` | Basis-Informationen |
| **Zeit/Datum** | Grün | `#28a745` | `calendar` | Zeitbezogene Daten |
| **Teilnehmer** | Orange | `#f39c12` | `people` | Personen-bezogen |
| **Kategorien** | Lila | `#9b59b6` | `people` | Gruppierungen |
| **Anmeldungen** | Rot | `#e74c3c` | `people` | Status-bezogen |
| **Optionen** | Grau | `#6c757d` | `time` | Zusatz-Features |
| **Serien** | Türkis | `#17a2b8` | `time` | Wiederholungen |

## 📏 Spacing-Regeln

### **Zwischen Sektionen:**
- **Erster Block**: `margin: '16px 16px 8px 16px'`
- **Weitere Blöcke**: `margin: '24px 16px 8px 16px'`
- **Letzter Block** (Event-Serie): `margin: '0 16px 48px 16px'` (extra Abstand unten)

### **Innerhalb Cards:**
- **Card margins**: `margin: '0 16px 16px 16px'`
- **Padding**: `padding: '0'` (Cards ohne eigenes Padding)
- **DateTime-Buttons**: `paddingBottom: '12px'` für besseren Abstand

### **Spezielle Elemente:**
- **Zeitfenster-Icons**: 24px statt 32px mit Nummern
- **Delete-Buttons**: `size="small"` und `fill="clear"`

## 🔧 Code-Patterns

### **IonItems ohne Linien:**
```tsx
<IonItem lines="none" style={{ paddingBottom: '12px' }}>
  <IonLabel position="stacked">Label</IonLabel>
  <IonDatetimeButton datetime="picker-id" />
</IonItem>
```

### **Zeitfenster-Überschriften:**
```tsx
<div style={{ 
  display: 'flex', 
  alignItems: 'center', 
  gap: '12px',
  margin: '24px 16px 8px 16px'
}}>
  <div style={{ 
    width: '24px',  // Kleiner für Sub-Elemente
    height: '24px',
    backgroundColor: '#6c757d',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  }}>
    <span style={{ fontSize: '0.8rem', color: 'white', fontWeight: 'bold' }}>
      {index + 1}
    </span>
  </div>
  <h3 style={{ 
    fontWeight: '500',  // Weniger bold für Sub-Level
    fontSize: '1rem',   // Kleiner als Haupt-Überschriften
    margin: '0',
    color: '#333',
    flex: 1
  }}>
    Sub-Titel {index + 1}
  </h3>
  <IonButton fill="clear" color="danger" size="small">
    <IonIcon icon={trash} />
  </IonButton>
</div>
```

## 🎛️ Default-Werte

### **Event-spezifische Defaults:**
- **Max. Teilnehmer**: `5`
- **Max. Warteliste**: `3`
- **Punkte**: `0`
- **Point Type**: `'gemeinde'`
- **Warteliste aktiviert**: `true`

### **Zeit-Defaults:**
- **Event-Datum**: Morgen um 9:00 Uhr
- **Event-Endzeit**: 1 Stunde nach Start
- **Anmeldung öffnet**: Heute um 9:00 Uhr  
- **Anmeldeschluss**: 24 Stunden vor Event

## 📱 Responsive Verhalten

- **Icons**: Immer `flexShrink: 0` für konsistente Größe
- **Text**: `flex: 1` für verfügbaren Platz nutzen
- **Buttons**: Feste Größen mit `size="small"` für kompakte Darstellung

## ✅ Checkliste für neue Modals

- [ ] Überschriften außerhalb der Cards
- [ ] Farbkodierte runde Icons (32px)
- [ ] Weiße Cards ohne Gradient-Header
- [ ] Korrektes Spacing (16px/24px/48px)
- [ ] `lines="none"` bei DateTime-Buttons
- [ ] `paddingBottom: '12px'` für besseren Abstand
- [ ] Transparente Listen in Cards
- [ ] Konsistente Default-Werte
- [ ] Extra Abstand bei letztem Block

## 🔄 Wartung

Wenn dieses Design geändert wird, muss dieser Guide entsprechend aktualisiert werden. Bei Inkonsistenzen in bestehenden Modals auf diesen Guide verweisen.

---
**Erstellt**: Juli 2025 auf Basis von EventModal.tsx  
**Status**: Aktiv - Verbindlich für alle neuen und überarbeiteten Modals