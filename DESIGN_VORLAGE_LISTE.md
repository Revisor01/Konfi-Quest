# Listendesign Vorlage - Karten mit farbigem Rand

Diese Vorlage zeigt das Design der abgesetzten Karten mit farbigem linken Rand.

## Struktur

```tsx
<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
  {items.map((item) => {
    const color = getItemColor(item); // z.B. '#3b82f6', '#22c55e', '#f59e0b', '#dc2626'
    return (
      <IonCard
        key={item.id}
        style={{
          borderRadius: '12px',
          background: 'white',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          border: '1px solid #e0e0e0',
          borderLeft: `4px solid ${color}`,
          margin: '0'
        }}
      >
        <IonCardContent style={{ padding: '12px 16px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            {/* Icon (optional) */}
            <div style={{
              width: '40px',
              height: '40px',
              backgroundColor: color,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <IonIcon
                icon={getItemIcon(item)}
                style={{ fontSize: '1.2rem', color: 'white' }}
              />
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontWeight: '600',
                fontSize: '0.95rem',
                color: '#333',
                marginBottom: '4px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {item.title}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {/* Badge/Tag */}
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: '600',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  backgroundColor: `${color}20`,
                  color: color
                }}>
                  {item.category}
                </span>
                {/* Meta Info */}
                <span style={{
                  fontSize: '0.75rem',
                  color: '#666',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <IonIcon icon={calendarOutline} style={{ fontSize: '0.75rem' }} />
                  {formatDate(item.date)}
                </span>
              </div>
            </div>

            {/* Trailing Element (optional, z.B. Punkte, Chevron) */}
            <div style={{
              fontWeight: '700',
              fontSize: '1.1rem',
              color: color,
              flexShrink: 0
            }}>
              +{item.value}
            </div>
          </div>
        </IonCardContent>
      </IonCard>
    );
  })}
</div>
```

## Farben

- Blau (Gottesdienst): `#3b82f6`
- Gruen (Gemeinde): `#22c55e`
- Orange (Bonus): `#f59e0b`
- Rot (Event): `#dc2626`
- Lila (Standard): `#8b5cf6`

## Wichtige Eigenschaften

- **gap: '8px'** - Abstand zwischen den Karten
- **borderRadius: '12px'** - Abgerundete Ecken
- **borderLeft: '4px solid ${color}'** - Farbiger linker Rand
- **boxShadow: '0 2px 8px rgba(0,0,0,0.06)'** - Leichter Schatten
- **border: '1px solid #e0e0e0'** - Dezenter Rahmen
- **margin: '0'** - Kein Margin (gap regelt Abstand)
