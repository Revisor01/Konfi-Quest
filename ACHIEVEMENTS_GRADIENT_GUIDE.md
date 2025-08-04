# 🏆 Achievements Gradient Styling Guide

## Container Layout
```css
background: linear-gradient(135deg, #ff9500 0%, #ff6b35 100%)
borderRadius: 24px
minHeight: 220px
boxShadow: 0 20px 40px rgba(255, 149, 0, 0.3)
```

## Grid System
```css
IonGrid: margin: '0 8px', padding: '0'
IonRow: size="4" (alle gleich breit)
IonCol: padding: '0 4px'
```

## Button-Style Container
```css
background: rgba(255, 255, 255, 0.2)
borderRadius: 12px
padding: 16px 12px
textAlign: center
```

## Icon System
```css
fontSize: 1.5rem
color: rgba(255, 255, 255, 0.9)
marginBottom: 8px
display: block, margin: 0 auto 8px auto
```

## Typografie Hierarchie
**Erreichte Zahl (groß/fett):**
```css
fontSize: 1.5rem
fontWeight: 800
```

**Gesamt Zahl (klein/transparent):**
```css
fontSize: 0.9rem
fontWeight: 500
opacity: 0.8
```

**Label:**
```css
fontSize: 0.8rem
opacity: 0.9
```

**Wichtig:** `whiteSpace: 'nowrap'` für alle Zahlen!

---

# 📋 Nächste Schritte: Page/View Struktur

## Aktueller Zustand
- ❌ KonfiBadgesPage: Alles direkt implementiert
- ❌ KonfiEventsPage: Alles direkt implementiert  
- ❌ Keine Views vorhanden

## Ziel: Admin-Struktur übernehmen
```
/components/konfi/
├── pages/     → IonPage Container (State, Navigation)
├── views/     → UI-Komponenten (wiederverwendbar)
└── modals/    → Modal-Dialoge
```

## To-Do:
1. **Views-Ordner erstellen**
2. **BadgesView extrahieren** aus KonfiBadgesPage
3. **EventsView extrahieren** aus KonfiEventsPage  
4. **Pages refaktorieren** zu Page/View Pattern
5. **Events korrekt anzeigen** (alle Events, nicht nur registered)