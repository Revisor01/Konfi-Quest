# Modal Design Pattern - Konfi Quest

Diese Anleitung zeigt das standardisierte Design Pattern für alle Modals im Konfi Quest System, basierend auf dem EventModal.

## Header & Toolbar

```tsx
<IonHeader>
  <IonToolbar>
    <IonTitle>
      {item ? 'Item bearbeiten' : 'Neues Item'}
    </IonTitle>
    <IonButtons slot="start">
      <IonButton
        onClick={handleClose}
        disabled={loading}
        style={{
          '--background': '#f8f9fa',
          '--background-hover': '#e9ecef',
          '--color': '#6c757d',
          '--border-radius': '8px'
        }}
      >
        <IonIcon icon={closeOutline} />
      </IonButton>
    </IonButtons>
    <IonButtons slot="end">
      <IonButton
        onClick={handleSubmit}
        disabled={!isFormValid || loading}
        color="primary"
        style={{
          '--background': '#eb445a',
          '--background-hover': '#d73847',
          '--color': 'white',
          '--border-radius': '8px'
        }}
      >
        {loading ? (
          <IonSpinner name="crescent" />
        ) : (
          <IonIcon icon={checkmarkOutline} />
        )}
      </IonButton>
    </IonButtons>
  </IonToolbar>
</IonHeader>
```

## Content - Sektionen mit Icon Header

Jede Sektion beginnt mit einem Icon-Header und wird durch eine IonCard abgesetzt:

```tsx
<IonContent style={{ '--padding-top': '16px' }}>
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
      <IonIcon icon={create} style={{ fontSize: '1rem', color: 'white' }} />
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

  {/* SEKTION CARD */}
  <IonCard style={{
    margin: '0 16px 16px 16px',
    borderRadius: '12px',
    background: 'white',
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
    border: '1px solid #e0e0e0'
  }}>
    <IonCardContent style={{ padding: '16px' }}>
      <IonList style={{ background: 'transparent' }}>
        {/* Formularfelder hier */}
      </IonList>
    </IonCardContent>
  </IonCard>
</IonContent>
```

## Formularfelder

### Standard Text Input

```tsx
<IonItem lines="none" style={{ '--background': 'transparent', marginBottom: '8px' }}>
  <IonLabel position="stacked">Feldname *</IonLabel>
  <IonInput
    value={formData.name}
    onIonInput={(e) => setFormData({ ...formData, name: e.detail.value! })}
    placeholder="Platzhaltertext"
    disabled={loading}
    clearInput={true}
  />
</IonItem>
```

### Textarea

```tsx
<IonItem lines="none" style={{ '--background': 'transparent', marginBottom: '8px' }}>
  <IonLabel position="stacked">Beschreibung</IonLabel>
  <IonTextarea
    value={formData.description}
    onIonInput={(e) => setFormData({ ...formData, description: e.detail.value! })}
    placeholder="Beschreibung..."
    rows={3}
    disabled={loading}
  />
</IonItem>
```

### Numerisches Input mit Stepper-Buttons

Für bessere mobile UX bei Zahleneingaben:

```tsx
<IonItem lines="none" style={{ '--background': 'transparent', marginBottom: '12px' }}>
  <IonLabel position="stacked" style={{ marginBottom: '8px' }}>Anzahl *</IonLabel>
  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
    <IonButton
      fill="outline"
      size="small"
      disabled={loading || formData.count <= 0}
      onClick={() => setFormData({ ...formData, count: Math.max(0, formData.count - 1) })}
      style={{ '--border-radius': '8px', minWidth: '40px', height: '40px' }}
    >
      <IonIcon icon={removeOutline} />
    </IonButton>
    <IonInput
      type="text"
      inputMode="numeric"
      value={formData.count.toString()}
      onIonInput={(e) => {
        const value = e.detail.value!;
        if (value === '') {
          setFormData({ ...formData, count: 0 });
        } else {
          const num = parseInt(value);
          if (!isNaN(num) && num >= 0 && num <= 999) {
            setFormData({ ...formData, count: num });
          }
        }
      }}
      placeholder="0"
      disabled={loading}
      style={{ textAlign: 'center', flex: 1 }}
    />
    <IonButton
      fill="outline"
      size="small"
      disabled={loading || formData.count >= 999}
      onClick={() => setFormData({ ...formData, count: Math.min(999, formData.count + 1) })}
      style={{ '--border-radius': '8px', minWidth: '40px', height: '40px' }}
    >
      <IonIcon icon={addOutline} />
    </IonButton>
  </div>
</IonItem>
```

### Select / Dropdown

```tsx
<IonItem lines="none" style={{ '--background': 'transparent', marginBottom: '12px' }}>
  <IonLabel position="stacked">Kategorie</IonLabel>
  <IonSelect
    value={formData.category}
    onIonChange={(e) => setFormData({ ...formData, category: e.detail.value })}
    placeholder="Kategorie wählen"
    disabled={loading}
    interface="action-sheet"
    interfaceOptions={{
      header: 'Kategorie auswählen'
    }}
  >
    <IonSelectOption value="option1">Option 1</IonSelectOption>
    <IonSelectOption value="option2">Option 2</IonSelectOption>
  </IonSelect>
</IonItem>
```

### Checkbox (ohne Chevron) - Graues Listen-Format

**WICHTIG:** Checkboxen IMMER im grauen Listen-Format für Konsistenz:

```tsx
<IonList lines="none" style={{ background: 'transparent', padding: '8px 0' }}>
  {items.map((item) => (
    <IonItem
      key={item.id}
      lines="none"
      button
      detail={false}  {/* WICHTIG: entfernt Chevron */}
      onClick={() => {
        if (!loading) {
          setFormData(prev => ({
            ...prev,
            selected_ids: prev.selected_ids.includes(item.id)
              ? prev.selected_ids.filter(id => id !== item.id)
              : [...prev.selected_ids, item.id]
          }));
        }
      }}
      disabled={loading}
      style={{
        '--min-height': '56px',
        '--padding-start': '16px',
        '--background': '#fbfbfb',
        '--border-radius': '12px',
        margin: '6px 0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        border: '1px solid #e0e0e0',
        borderRadius: '12px'
      }}
    >
      <IonCheckbox
        slot="start"
        checked={formData.selected_ids.includes(item.id)}
        disabled={loading}
        style={{ marginRight: '12px' }}
      />
      <IonLabel>{item.name}</IonLabel>
    </IonItem>
  ))}
</IonList>
```

### Toggle (rechtsbündig)

```tsx
<IonItem lines="none" style={{ '--background': 'transparent', marginBottom: '12px' }}>
  <IonLabel>Feature aktivieren</IonLabel>
  <IonToggle
    slot="end"  {/* WICHTIG: rechtsbündig */}
    checked={formData.enabled}
    onIonChange={(e) => setFormData({ ...formData, enabled: e.detail.checked })}
    disabled={loading}
  />
</IonItem>
```

### Datum & Zeit (IonDatetime)

```tsx
<IonItem lines="none" style={{ '--background': 'transparent', marginBottom: '12px' }}>
  <IonLabel position="stacked">Datum & Uhrzeit *</IonLabel>
  <IonDatetimeButton datetime="date-picker" />
</IonItem>

{/* Am Ende des Modals, außerhalb sichtbarer Bereiche */}
<IonModal keepContentsMounted={true}>
  <IonDatetime
    id="date-picker"
    value={formData.date}
    onIonChange={(e) => setFormData({ ...formData, date: e.detail.value as string })}
    presentation="date-time"
    locale="de-DE"
  />
</IonModal>
```

## Abstände zwischen Sektionen

- Erste Sektion: `margin: '16px 16px 12px 16px'` (Header)
- Card: `margin: '0 16px 16px 16px'`
- Weitere Sektionen: `margin: '24px 16px 12px 16px'` (Header) - mehr Abstand oben

## Farben

- **Primary Red**: `#eb445a` (Buttons, Icons)
- **White Card**: `white` mit `boxShadow: '0 2px 12px rgba(0,0,0,0.08)'`
- **Border**: `1px solid #e0e0e0`
- **Background**: `transparent` für Items in Cards
- **Icon Shadow**: `0 2px 8px rgba(235, 68, 90, 0.3)`
- **Graue Listen-Items**: `#fbfbfb` mit `boxShadow: '0 2px 8px rgba(0,0,0,0.06)'` und `border: 1px solid #e0e0e0`

## Validation

```tsx
const isFormValid = formData.name.trim().length > 0 && formData.date;
```

## Submit Handler Pattern

```tsx
const handleSubmit = async () => {
  if (!formData.name.trim()) return;

  setLoading(true);
  try {
    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      // weitere Felder...
    };

    if (item && item.id) {
      await api.put(`/items/${item.id}`, payload);
      setSuccess('Item aktualisiert');
    } else {
      await api.post('/items', payload);
      setSuccess('Item erstellt');
    }

    onSuccess();
    handleClose();
  } catch (error: any) {
    if (error.response?.data?.error) {
      setError(error.response.data.error);
    } else {
      setError('Fehler beim Speichern');
    }
  } finally {
    setLoading(false);
  }
};
```

## Wichtige Regeln

1. **Keine Unicode Emojis verwenden** - nur IonIcons
2. **Immer `useIonModal` Hook verwenden**, NIEMALS `<IonModal isOpen={state}>`
3. **Cards mit weißem Hintergrund** für visuelle Trennung
4. **Stepper-Buttons** bei allen numerischen Eingaben für bessere mobile UX
5. **Toggle rechtsbündig** mit `slot="end"`
6. **Checkboxen ohne Chevron** mit `detail={false}`
7. **Konsistente Abstände** zwischen Sektionen
8. **Loading State** bei Submit-Button anzeigen
9. **Validation** vor Submit durchführen
10. **Deutsche Fehlermeldungen** verwenden

## Beispiel für vollständiges Modal Template

Siehe `/frontend/src/components/admin/modals/EventModal.tsx` für vollständige Implementierung.
