# Styling Guide - Konfipoints/Konfi Quest System

## 📋 Allgemeine Prinzipien

Dieser Guide definiert das einheitliche Design für Modals und Gradient Headers im Konfipoints System, basierend auf dem EventModal-Design und Events Header-Design (Juli 2025).

---

## 🌈 GRADIENT HEADER STYLE (Ausgangs-Design)

### **Standard Gradient Header (Events-Style)**
```tsx
{/* Events Header - Dashboard-Style */}
<div style={{
  background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
  borderRadius: '24px',
  padding: '0',
  margin: '16px',
  marginBottom: '16px',
  boxShadow: '0 20px 40px rgba(220, 38, 38, 0.3)',
  position: 'relative',
  overflow: 'hidden',
  minHeight: '220px',
  display: 'flex',
  flexDirection: 'column'
}}>
  {/* Überschrift - groß und überlappend */}
  <div style={{
    position: 'absolute',
    top: '-5px',
    left: '12px',
    zIndex: 1
  }}>
    <h2 style={{
      fontSize: '4rem',
      fontWeight: '900',
      color: 'rgba(255, 255, 255, 0.1)',
      margin: '0',
      lineHeight: '0.8',
      letterSpacing: '-2px'
    }}>
      EVENTS
    </h2>
  </div>
  
  {/* Content */}
  <div style={{
    position: 'relative',
    zIndex: 2,
    padding: '70px 24px 24px 24px',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center'
  }}>
    <IonGrid style={{ padding: '0', margin: '0 4px' }}>
      <IonRow>
        <IonCol size="4" style={{ padding: '0 4px' }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '12px',
            padding: '16px 12px',
            color: 'white',
            textAlign: 'center'
          }}>
            <IonIcon 
              icon={calendar} 
              style={{ 
                fontSize: '1.5rem', 
                color: 'rgba(255, 255, 255, 0.9)', 
                marginBottom: '8px', 
                display: 'block',
                margin: '0 auto 8px auto'
              }} 
            />
            <div style={{ fontSize: '1.3rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: '1.5rem' }}>{count}</span>
            </div>
            <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
              Label
            </div>
          </div>
        </IonCol>
        {/* Weitere Cols... */}
      </IonRow>
    </IonGrid>
  </div>
</div>
```

### **Design-Spezifikationen:**
- **Gradient**: `linear-gradient(135deg, #dc2626 0%, #991b1b 100%)`
- **Border-Radius**: `24px`
- **Box-Shadow**: `0 20px 40px rgba(220, 38, 38, 0.3)`
- **Margin**: `16px` (Standard für alle Seiten)
- **Min-Height**: `220px`
- **Große Überschrift**: 
  - `fontSize: '4rem'`
  - `fontWeight: '900'`
  - `color: 'rgba(255, 255, 255, 0.1)'`
  - `letterSpacing: '-2px'`
- **Content-Padding**: `70px 24px 24px 24px`

### **Karten-Statistiken:**
- **Background**: `rgba(255, 255, 255, 0.2)`
- **Border-Radius**: `12px`
- **Padding**: `16px 12px`
- **Icon-Style**: `fontSize: '1.5rem'`, `margin: '0 auto 8px auto'`
- **Zahlen**: `fontSize: '1.5rem'`, `fontWeight: '800'`
- **Labels**: `fontSize: '0.8rem'`, `opacity: 0.9`

---

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
| **Abmeldungen** | Rot | `#e74c3c` | `close` | Abmelde-Vorgänge |
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

## 🔴 Spezielle Button-Patterns

### **Abmelde-Buttons (UnregisterModal):**
```tsx
{/* Button-Bereich mit speziellem Abmelde-Styling */}
<div style={{ margin: '0 16px 48px 16px' }}>
  <div style={{ display: 'flex', gap: '12px' }}>
    <IonButton 
      expand="block" 
      fill="outline" 
      color="medium"
      onClick={handleClose}
      style={{ flex: '1', height: '44px', borderRadius: '8px' }}
    >
      <IonIcon icon={close} slot="start" />
      Abbrechen
    </IonButton>
    <IonButton 
      expand="block" 
      color="danger"
      onClick={handleSubmit}
      disabled={!reason.trim()}
      style={{ flex: '1', height: '44px', borderRadius: '8px' }}
    >
      <IonIcon icon={checkmark} slot="start" />
      Abmelden
    </IonButton>
  </div>
</div>
```

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
- [ ] Spezielle Button-Patterns für Abmeldungen verwenden

## 🔄 Wartung

Wenn dieses Design geändert wird, muss dieser Guide entsprechend aktualisiert werden. Bei Inkonsistenzen in bestehenden Modals auf diesen Guide verweisen.

---
**Erstellt**: Juli 2025 auf Basis von EventModal.tsx  
**Status**: Aktiv - Verbindlich für alle neuen und überarbeiteten Modals