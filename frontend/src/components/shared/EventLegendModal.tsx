import React from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButton,
  IonButtons, IonIcon,
} from '@ionic/react';
import { closeOutline, calendar } from 'ionicons/icons';

export type EventLegendVariant = 'konfi' | 'teamer' | 'admin';

export interface EventLegendModalProps {
  onClose: () => void;
  // Steuert, welche Farb-Einträge gezeigt werden (z.B. Rosa nur für Teamer,
  // Orange/Warteliste nicht für Teamer).
  variant: EventLegendVariant;
}

interface LegendEntry {
  color: string;
  label: string;
  description: string;
  // In welchen Varianten dieser Eintrag erscheint.
  variants: EventLegendVariant[];
}

// Farbcode-Legende für Events. Farben müssen mit den getStatusColor-Funktionen
// in den jeweiligen EventsViews übereinstimmen (gleiche --app-color-Tokens).
const ENTRIES: LegendEntry[] = [
  {
    color: 'var(--app-color-success)',
    label: 'Anmeldung möglich',
    description: 'Du kannst dich für dieses Event anmelden.',
    variants: ['konfi', 'teamer', 'admin'],
  },
  {
    color: 'var(--app-color-teamer)',
    label: 'Anmeldung möglich (Team)',
    description: 'Dieses Event sucht Teamer:innen oder ist nur für das Team.',
    variants: ['teamer'],
  },
  {
    color: 'var(--app-color-info)',
    label: 'Angemeldet',
    description: 'Du bist für dieses Event angemeldet.',
    variants: ['konfi', 'teamer', 'admin'],
  },
  {
    color: 'var(--app-color-konfis)',
    label: 'Konfirmation',
    description: 'Ein Konfirmations-Termin.',
    variants: ['konfi', 'teamer', 'admin'],
  },
  {
    color: 'var(--app-color-bonus)',
    label: 'Warteliste',
    description: 'Das Event ist voll, du stehst auf der Warteliste.',
    variants: ['konfi', 'admin'],
  },
  {
    color: 'var(--app-color-danger)',
    label: 'Absage / Abmeldung',
    description: 'Abgesagt, abgemeldet oder nicht anwesend gewesen.',
    variants: ['konfi', 'teamer', 'admin'],
  },
  {
    color: '#6c757d',
    label: 'Vergangen',
    description: 'Dieses Event liegt in der Vergangenheit.',
    variants: ['konfi', 'teamer', 'admin'],
  },
];

// Erklärt die Farbcodierung der Event-Statusbalken. Wird über das (i)-Symbol
// im Events-Header geöffnet.
const EventLegendModal: React.FC<EventLegendModalProps> = ({ onClose, variant }) => {
  const entries = ENTRIES.filter((e) => e.variants.includes(variant));

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton className="app-modal-close-btn" onClick={onClose}>
              <IonIcon icon={closeOutline} slot="icon-only" />
            </IonButton>
          </IonButtons>
          <IonTitle>Farben erklärt</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="app-gradient-background">
        <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div
            style={{
              width: '88px', height: '88px', borderRadius: '24px',
              background: 'var(--app-color-events)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '20px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
            }}
          >
            <IonIcon icon={calendar} style={{ fontSize: '2.6rem', color: '#fff' }} />
          </div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 8px', textAlign: 'center', color: '#1a1a1a' }}>
            Farben erklärt
          </h1>
          <p style={{ fontSize: '1rem', lineHeight: 1.6, color: '#3a3a3a', margin: '0 0 20px', textAlign: 'center', maxWidth: '520px' }}>
            Der farbige Balken links an jedem Event zeigt seinen Status:
          </p>
          <div style={{ maxWidth: '520px', width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {entries.map((entry, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: '14px',
                  background: 'rgba(255,255,255,0.7)', borderRadius: '14px',
                  padding: '14px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                }}
              >
                <div
                  style={{
                    width: '14px', flexShrink: 0, alignSelf: 'stretch', minHeight: '40px',
                    borderRadius: '7px', background: entry.color, marginTop: '2px'
                  }}
                />
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1a1a1a', marginBottom: '2px' }}>
                    {entry.label}
                  </div>
                  <div style={{ fontSize: '0.9rem', lineHeight: 1.45, color: '#4a4a4a' }}>
                    {entry.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default EventLegendModal;
