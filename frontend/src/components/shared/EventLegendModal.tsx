import React from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButton,
  IonButtons, IonIcon,
} from '@ionic/react';
import { ICON_SCHLIESSEN, ICON_TERMIN_GEFUELLT } from './icons';
import { legendeFuer, type EventLegendVariant, type LegendEntry } from './eventLegende';

// Die Einträge stehen in eventLegende.ts -- eine Stelle für dieses Modal und
// das Fenster des Browsers ab 992 px (web/termine/WebLegendeDialog.tsx; Simon,
// 15.10.2026). Hier steht nur die Darstellung der App.
export type { EventLegendVariant } from './eventLegende';

export interface EventLegendModalProps {
  onClose: () => void;
  // Steuert, welche Eintraege gezeigt werden (rollenabhaengig).
  variant: EventLegendVariant;
}

const renderRow = (entry: LegendEntry, i: number) => (
  <div
    key={i}
    style={{
      display: 'flex', alignItems: 'center', gap: 'var(--app-abstand-mittelweit)',
      background: 'var(--app-surface-card)', borderRadius: 'var(--app-radius-weich)',
      padding: 'var(--app-abstand-mittel) var(--app-abstand-mittelweit)', boxShadow: 'var(--app-schatten-hauch)'
    }}
  >
    <div
      style={{
        width: '40px', height: '40px', flexShrink: 0, borderRadius: 'var(--app-radius-kreis)',
        background: entry.color, display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}
    >
      <IonIcon icon={entry.icon} style={{ color: 'white', fontSize: 'var(--app-text-untertitel)' }} />
    </div>
    <div>
      <div style={{ fontSize: 'var(--app-text-standard)', fontWeight: 'var(--app-schrift-fett)', color: 'var(--app-text-emphasis)', marginBottom: 'var(--app-abstand-winzig)' }}>
        {entry.label}
      </div>
      <div style={{ fontSize: 'var(--app-text-basis)', lineHeight: 1.45, color: 'var(--app-text-body)' }}>
        {entry.description}
      </div>
    </div>
  </div>
);

// Erklärt Farben + Icons der Event-Liste. Wird über das (i)-Symbol im
// Events-Header geöffnet.
const EventLegendModal: React.FC<EventLegendModalProps> = ({ onClose, variant }) => {
  const { eintraege: entries, markierungen: markers } = legendeFuer(variant);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton className="app-modal-close-btn" onClick={onClose} aria-label="Schließen">
              <IonIcon icon={ICON_SCHLIESSEN} slot="icon-only" />
            </IonButton>
          </IonButtons>
          <IonTitle>Farben & Symbole</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="app-gradient-background">
        <div style={{ padding: 'var(--app-abstand-weit) var(--app-abstand-gross)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div
            style={{
              width: '88px', height: '88px', borderRadius: 'var(--app-radius-modal)',
              background: 'var(--app-color-events)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 'var(--app-abstand-gross)', boxShadow: 'var(--app-schatten-hoch)'
            }}
          >
            <IonIcon icon={ICON_TERMIN_GEFUELLT} style={{ fontSize: 'var(--app-anzeige-gross)', color: 'white' }} />
          </div>
          <h1 style={{ fontSize: 'var(--app-text-titel-gross)', fontWeight: 'var(--app-schrift-extrafett)', margin: '0 0 var(--app-abstand-eng)', textAlign: 'center', color: 'var(--app-text-emphasis)' }}>
            Farben & Symbole
          </h1>
          <p style={{ fontSize: 'var(--app-text-standard)', lineHeight: 1.6, color: 'var(--app-text-primary)', margin: '0 0 var(--app-abstand-gross)', textAlign: 'center', maxWidth: '520px' }}>
            Farbe und Symbol an jedem Event zeigen seinen Status:
          </p>
          <div style={{ maxWidth: '520px', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--app-abstand-schmal)' }}>
            {entries.map(renderRow)}
          </div>

          {markers.length > 0 && (
            <>
              <h2 style={{ fontSize: 'var(--app-text-gross)', fontWeight: 'var(--app-schrift-extrafett)', margin: 'var(--app-abstand-sehrweit) 0 var(--app-abstand-kompakt)', textAlign: 'center', color: 'var(--app-text-emphasis)' }}>
                Zusätzliche Markierungen
              </h2>
              <p style={{ fontSize: 'var(--app-text-betont)', lineHeight: 1.5, color: 'var(--app-text-primary)', margin: '0 0 var(--app-abstand-basis)', textAlign: 'center', maxWidth: '520px' }}>
                Diese kleinen Symbole erscheinen oben rechts am Event:
              </p>
              <div style={{ maxWidth: '520px', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--app-abstand-schmal)' }}>
                {markers.map(renderRow)}
              </div>
            </>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default EventLegendModal;
