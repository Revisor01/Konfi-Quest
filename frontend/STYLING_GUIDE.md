# Konfi-Quest UI Styling Guide

## Grundprinzipien

- **Farben**: Tuerkis (#06b6d4) als Primaerfarbe, Orange (#f97316) als Sekundaerfarbe
- **Keine Unicode-Emojis** - nur IonIcons
- **Deutsche Umlaute** verwenden (ue, oe, ae verboten)

---

## 1. Seiten-Header (Dashboard-Style)

Grosser farbiger Header-Block mit Statistiken:

```tsx
<div style={{
  background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
  borderRadius: '24px',
  padding: '0',
  margin: '16px',
  boxShadow: '0 20px 40px rgba(6, 182, 212, 0.3)',
  position: 'relative',
  overflow: 'hidden',
  minHeight: '220px',
  display: 'flex',
  flexDirection: 'column'
}}>
  {/* Grosse Hintergrund-Ueberschrift */}
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
      TITEL
    </h2>
  </div>

  {/* Content mit Statistik-Karten */}
  <div style={{
    position: 'relative',
    zIndex: 2,
    padding: '70px 24px 24px 24px',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center'
  }}>
    <IonGrid>
      <IonRow>
        <IonCol size="4">
          {/* Statistik-Karte */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '12px',
            padding: '16px 12px',
            color: 'white',
            textAlign: 'center'
          }}>
            <IonIcon icon={...} style={{ fontSize: '1.5rem', color: 'rgba(255, 255, 255, 0.9)' }} />
            <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>42</div>
            <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>Label</div>
          </div>
        </IonCol>
      </IonRow>
    </IonGrid>
  </div>
</div>
```

---

## 2. Listen mit IonListHeader

Fuer Suche, Filter und Kategorien:

```tsx
<IonList inset={true} style={{ margin: '16px' }}>
  <IonListHeader>
    <div style={{
      width: '24px',
      height: '24px',
      backgroundColor: '#06b6d4',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: '8px'
    }}>
      <IonIcon icon={filterOutline} style={{ color: 'white', fontSize: '0.8rem' }} />
    </div>
    <IonLabel>Suche & Filter</IonLabel>
  </IonListHeader>
  <IonItemGroup>
    {/* Items hier */}
  </IonItemGroup>
</IonList>
```

---

## 3. IonCard unter IonListHeader

Wenn eine Card eine Ueberschrift braucht, kommt die als IonListHeader UEBER die Card:

```tsx
<IonList inset={true} style={{ margin: '16px' }}>
  <IonListHeader>
    <div style={{
      width: '24px',
      height: '24px',
      backgroundColor: '#06b6d4',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: '8px'
    }}>
      <IonIcon icon={peopleOutline} style={{ color: 'white', fontSize: '0.8rem' }} />
    </div>
    <IonLabel>Personen (12)</IonLabel>
  </IonListHeader>
  <IonCard style={{ margin: '0' }}>
    <IonCardContent style={{ padding: '16px' }}>
      {/* Card-Inhalt */}
    </IonCardContent>
  </IonCard>
</IonList>
```

---

## 4. Listen-Items mit farbigem Rand

Fuer Personen, Chats, Events etc.:

```tsx
<div style={{
  borderTop: '1px solid rgba(0,0,0,0.06)',
  borderRight: '1px solid rgba(0,0,0,0.06)',
  borderBottom: '1px solid rgba(0,0,0,0.06)',
  borderLeft: '3px solid #06b6d4', // tuerkis fuer Admins/Gruppen, #f97316 fuer Konfis/Direkt
  borderRadius: '10px',
  padding: '10px 12px',
  marginBottom: '8px',
  background: 'white',
  boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
}}>
  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
    {/* Icon/Avatar */}
    <div style={{
      width: '40px',
      height: '40px',
      backgroundColor: '#06b6d4',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <IonIcon icon={person} style={{ fontSize: '1.2rem', color: 'white' }} />
    </div>

    {/* Content */}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        fontWeight: '600',
        fontSize: '0.95rem',
        color: '#333',
        marginBottom: '4px'
      }}>
        Titel
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Chip/Badge */}
        <span style={{
          fontSize: '0.7rem',
          fontWeight: '600',
          padding: '2px 8px',
          borderRadius: '10px',
          backgroundColor: '#06b6d420',
          color: '#06b6d4'
        }}>
          Label
        </span>
        {/* Sekundaerer Text */}
        <span style={{ fontSize: '0.75rem', color: '#666' }}>
          Info
        </span>
      </div>
    </div>
  </div>
</div>
```

---

## 5. Filter mit Label und Select

Label links, Select rechts:

```tsx
<IonItem
  button={false}
  style={{
    '--background-activated': 'transparent',
    '--background-focused': 'transparent',
    '--background-hover': 'transparent',
    '--ripple-color': 'transparent'
  }}
>
  <IonLabel>Typ</IonLabel>
  <IonSelect
    slot="end"
    value={filterValue}
    onIonChange={(e) => setFilterValue(e.detail.value!)}
    interface="popover"
    fill="solid"
  >
    <IonSelectOption value="alle">Alle</IonSelectOption>
    {/* weitere Optionen */}
  </IonSelect>
</IonItem>
```

---

## 6. Suchfeld

```tsx
<IonItem>
  <IonIcon
    icon={search}
    slot="start"
    style={{ color: '#8e8e93', fontSize: '1rem' }}
  />
  <IonInput
    value={searchText}
    onIonInput={(e) => setSearchText(e.detail.value!)}
    placeholder="Suchen..."
  />
</IonItem>
```

---

## 7. Farb-Schema

| Element | Farbe | Hex |
|---------|-------|-----|
| Primaer (Tuerkis) | Admin, Gruppen, System | #06b6d4 |
| Sekundaer (Orange) | Konfis, Direkt | #f97316 |
| Fehler/Loeschen | Rot | #dc3545 |
| Text primaer | Dunkelgrau | #333 |
| Text sekundaer | Grau | #666 |
| Hintergrund | Gradient | app-gradient-background |

---

## 8. Modale

- Immer mit `useIonModal` Hook (NIEMALS `<IonModal isOpen>`)
- `IonPage` als Wrapper
- Standard IonHeader mit IonToolbar
- IonContent mit `className="app-gradient-background"`
- Padding: `16px` um den Content

```tsx
const [presentModal, dismissModal] = useIonModal(MyModal, {
  onClose: () => dismissModal(),
  onSuccess: () => {
    dismissModal();
    loadData();
  }
});

// Oeffnen
presentModal({ presentingElement: pageRef.current || undefined });
```

---

## Referenz-Komponente

`ChatOverview.tsx` ist die Referenz fuer das vollstaendige Seiten-Layout.
