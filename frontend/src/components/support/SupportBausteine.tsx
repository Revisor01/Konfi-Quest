// Bausteine der Support-Ansicht (Web-Version, 03.10.2026): der Schutz "nur
// Super-Admin", der Zurueck-Weg, Abschnitte, Kennzahl-Kacheln und die
// Fehlerkarte -- an einer Stelle, damit die fuenf Seiten gleich aussehen und
// sich gleich verhalten.

import React from 'react';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonPage,
} from '@ionic/react';
import AppKopfzeile, { AppKopfzeileGross } from '../shared/AppKopfzeile';
import EmptyState from '../shared/EmptyState';
import { ICON_AKTUALISIEREN, ICON_SPERRE, ICON_WARNHINWEIS } from '../shared/icons';
import { useApp } from '../../contexts/AppContext';
import { istSuperAdmin } from '../../utils/superAdmin';

/**
 * Zeigt die Seite nur Konten mit Super-Admin-Recht. Alle anderen sehen einen
 * Hinweis -- und die Seite selbst wird gar nicht erst montiert, ruft also
 * auch keine Route auf. Die Routen liegen im Baum der Leitung, weil Simons
 * Konto (Gemeindeleitung mit Merkmal) sie dort braucht; erreichbar sind sie
 * fuer andere Leitungen nur ueber eine eingetippte Adresse.
 */
export const NurSupport: React.FC<{ titel: string; children: React.ReactNode }> = ({ titel, children }) => {
  const { user } = useApp();
  if (istSuperAdmin(user)) return <>{children}</>;
  return (
    <IonPage>
      <AppKopfzeile titel={titel} gemeindeUmschalter={false} />
      <IonContent className="app-gradient-background" fullscreen>
        <AppKopfzeileGross titel={titel} />
        <EmptyState
          icon={ICON_SPERRE}
          title="Nur für den Support"
          message="Diese Seite gehört zur Support-Ansicht. Sie steht nur Konten mit Super-Admin-Recht offen."
        />
      </IonContent>
    </IonPage>
  );
};

/** Ein Abschnitt im Stil der App: Ueberschrift mit Symbol, darunter eine Karte. */
export const Abschnitt: React.FC<{
  icon: string;
  titel: string;
  /** Farbklasse des Symbols (app-section-icon--…). */
  farbe?: string;
  rechts?: React.ReactNode;
  children: React.ReactNode;
}> = ({ icon, titel, farbe = 'users', rechts, children }) => (
  <IonList inset={true} className="app-segment-wrapper">
    <IonListHeader>
      <div className={`app-section-icon app-section-icon--${farbe}`}>
        <IonIcon icon={icon} />
      </div>
      <IonLabel>{titel}</IonLabel>
      {rechts}
    </IonListHeader>
    <IonCard className="app-card">
      <IonCardContent style={{ padding: 'var(--app-abstand-mittel)' }}>
        {children}
      </IonCardContent>
    </IonCard>
  </IonList>
);

/** Kennzahl-Kachel (wie im Betriebs-Ueberblick). */
export const Kennzahl: React.FC<{ icon: string; label: string; wert: string; farbe: string; zusatz?: string }> = ({
  icon, label, wert, farbe, zusatz,
}) => (
  <div
    role="group"
    aria-label={`${label}: ${wert}`}
    style={{
      flex: '1 1 140px', minWidth: 0, background: 'var(--app-surface-card)',
      borderRadius: 'var(--app-radius-weich)', padding: 'var(--app-abstand-mittelweit)',
      boxShadow: 'var(--app-schatten-fein)',
    }}
  >
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--app-abstand-kompakt)', color: 'var(--app-text-system)',
      fontSize: 'var(--app-text-klein)', fontWeight: 'var(--app-schrift-halbfett)', textTransform: 'uppercase',
    }}>
      <IonIcon icon={icon} style={{ color: farbe, fontSize: 'var(--app-text-standard)' }} aria-hidden="true" />
      {label}
    </div>
    <div style={{
      fontSize: 'var(--app-text-ueberschrift-gross)', fontWeight: 'var(--app-schrift-fett)',
      color: 'var(--app-text-emphasis)', marginTop: 'var(--app-abstand-mini)', lineHeight: 1.1,
    }}>{wert}</div>
    {zusatz && (
      <div style={{ fontSize: 'var(--app-text-meta)', color: 'var(--app-text-system)', marginTop: 'var(--app-abstand-winzig)' }}>
        {zusatz}
      </div>
    )}
  </div>
);

/** Reihe von Kennzahl-Kacheln, bricht auf schmalen Bildschirmen um. */
export const KennzahlReihe: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    display: 'flex', flexWrap: 'wrap', gap: 'var(--app-abstand-kompakt)',
    margin: '0 var(--app-abstand-basis) var(--app-abstand-basis)',
  }}>
    {children}
  </div>
);

/** Karte "konnte nicht geladen werden" mit erneutem Versuch. */
export const Ladefehler: React.FC<{ text: string; onErneut: () => void }> = ({ text, onErneut }) => (
  <div role="alert" className="app-card" style={{ margin: 'var(--app-abstand-basis)', padding: 'var(--app-abstand-basis)', textAlign: 'center' }}>
    <IonIcon icon={ICON_WARNHINWEIS} style={{ fontSize: 'var(--app-text-titel-gross)', color: 'var(--app-text-fehler)' }} aria-hidden="true" />
    <p style={{ margin: 'var(--app-abstand-kompakt) 0', color: 'var(--app-text-body)' }}>{text}</p>
    <IonButton fill="outline" onClick={onErneut}>
      <IonIcon icon={ICON_AKTUALISIEREN} slot="start" />
      Erneut versuchen
    </IonButton>
  </div>
);

/** Kleine farbige Marke (Status einer Anfrage, eines Kontos). */
export const Marke: React.FC<{ text: string; farbe: string }> = ({ text, farbe }) => (
  <span style={{
    display: 'inline-block', padding: 'var(--app-abstand-winzig) var(--app-abstand-eng)',
    borderRadius: 'var(--app-radius-gross)', background: farbe, color: 'white',
    fontSize: 'var(--app-text-meta)', fontWeight: 'var(--app-schrift-halbfett)', whiteSpace: 'nowrap',
  }}>{text}</span>
);

/**
 * Ein Eingabefeld mit sichtbarer Beschriftung. Der Name fuer Vorleseprogramme
 * ist die Beschriftung selbst; Pflichtfelder tragen den Stern und
 * aria-required.
 */
export const Feld: React.FC<{
  label: string;
  wert: string;
  onWert: (wert: string) => void;
  pflicht?: boolean;
  typ?: 'text' | 'email' | 'tel' | 'number' | 'password';
  autocomplete?: 'off' | 'name' | 'email' | 'tel' | 'username' | 'new-password';
  hinweis?: string;
  deaktiviert?: boolean;
}> = ({ label, wert, onWert, pflicht = false, typ = 'text', autocomplete = 'off', hinweis, deaktiviert = false }) => (
  <IonItem lines="full" style={{ '--background': 'transparent' }}>
    <IonLabel position="stacked">{label}{pflicht ? ' *' : ''}</IonLabel>
    <IonInput
      aria-label={label}
      aria-required={pflicht ? 'true' : undefined}
      type={typ}
      autocomplete={autocomplete}
      value={wert}
      disabled={deaktiviert}
      helperText={hinweis}
      onIonInput={(e) => onWert(String(e.detail.value ?? ''))}
    />
  </IonItem>
);
