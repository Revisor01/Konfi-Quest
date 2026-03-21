import React from 'react';
import {
  IonPage,
  IonContent,
  IonButton,
  IonIcon
} from '@ionic/react';
import { alertCircleOutline } from 'ionicons/icons';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary hat einen Fehler gefangen:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <IonPage>
          <IonContent className="ion-padding">
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              textAlign: 'center',
              gap: '16px'
            }}>
              <IonIcon
                icon={alertCircleOutline}
                style={{ fontSize: '64px', color: 'var(--ion-color-danger)' }}
              />
              <h2 style={{ margin: '0', fontSize: '1.4rem' }}>
                Etwas ist schiefgelaufen
              </h2>
              <p style={{ margin: '0', color: 'var(--ion-color-medium)', fontSize: '0.95rem' }}>
                Ein unerwarteter Fehler ist aufgetreten.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                <IonButton onClick={() => window.location.reload()}>
                  Seite neu laden
                </IonButton>
                <IonButton
                  fill="outline"
                  onClick={() => {
                    this.setState({ hasError: false, error: null });
                    window.location.href = '/';
                  }}
                >
                  Zur Startseite
                </IonButton>
              </div>
            </div>
          </IonContent>
        </IonPage>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
