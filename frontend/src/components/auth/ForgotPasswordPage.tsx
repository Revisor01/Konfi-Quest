import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonPage,
  IonContent,
  IonCard,
  IonCardContent,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonSpinner,
  IonIcon
} from '@ionic/react';
import { mailOutline, arrowBack, checkmarkCircle, alertCircle, informationCircleOutline, refreshOutline, cloudOfflineOutline } from 'ionicons/icons';
import api from '../../services/api';
import { useApp } from '../../contexts/AppContext';

const ForgotPasswordPage: React.FC = () => {
  const { isOnline } = useApp();
  const history = useHistory();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isNetworkError, setIsNetworkError] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('Bitte gib deine E-Mail-Adresse ein');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Bitte gib eine gültige E-Mail-Adresse ein');
      return;
    }

    setLoading(true);
    setError(null);
    setIsNetworkError(false);

    try {
      await api.post('/auth/request-password-reset', { email: email.trim() });
      setSent(true);
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 500) {
        setError('E-Mail konnte nicht gesendet werden. Bitte versuche es später erneut.');
      } else if (!err.response) {
        setError('Verbindung fehlgeschlagen. Bitte prüfe deine Internetverbindung.');
        setIsNetworkError(true);
      } else {
        // Für alle anderen Fälle (inkl. 200 bei unbekannter E-Mail)
        // zeigen wir weiterhin "gesendet" an (Privacy)
        setSent(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <IonPage>
      <IonContent className="app-auth-background">
        <div className="app-auth-container">

          {/* Header */}
          <div className="app-auth-hero">
            <div className="app-auth-hero__circle">
              <IonIcon icon={mailOutline} className="app-auth-hero__circle-icon" />
            </div>

            <h1 style={{
              fontSize: '1.8rem',
              fontWeight: '600',
              margin: '0 0 8px 0',
              textShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}>
              Passwort vergessen?
            </h1>

            <p style={{
              fontSize: '1rem',
              opacity: 0.9,
              margin: '0',
              maxWidth: '300px'
            }}>
              Kein Problem! Wir senden dir einen Link zum Zurücksetzen.
            </p>
          </div>

          {/* Card */}
          <IonCard className="app-auth-card app-auth-card--narrow">
            <IonCardContent className="app-auth-card__content">

              {sent ? (
                // Erfolgsmeldung
                <div style={{ textAlign: 'center' }}>
                  <div className="app-auth-success-circle--small">
                    <IonIcon icon={checkmarkCircle} className="app-auth-success-circle__icon--small" />
                  </div>

                  <h2 style={{
                    fontSize: '1.3rem',
                    fontWeight: '600',
                    margin: '0 0 12px 0',
                    color: '#2c3e50'
                  }}>
                    E-Mail gesendet!
                  </h2>

                  <p style={{
                    color: '#7f8c8d',
                    fontSize: '0.9rem',
                    margin: '0 0 24px 0',
                    lineHeight: '1.5'
                  }}>
                    Falls ein Konto mit dieser E-Mail-Adresse existiert, erhältst du in Kürze eine E-Mail mit einem Link zum Zurücksetzen deines Passworts.
                  </p>

                  <IonButton
                    expand="full"
                    onClick={() => history.push('/login')}
                    className="app-auth-button"
                  >
                    Zurück zum Login
                  </IonButton>
                </div>
              ) : (
                // Formular
                <>
                  <IonItem lines="none" className="app-auth-input">
                    <IonIcon icon={mailOutline} slot="start" color="medium" />
                    <IonLabel position="stacked" className="app-auth-input__label">
                      E-Mail-Adresse
                    </IonLabel>
                    <IonInput
                      type="email"
                      value={email}
                      onIonInput={(e) => setEmail(e.detail.value!)}
                      placeholder="deine@email.de"
                      style={{ '--color': '#2c3e50' }}
                    />
                  </IonItem>

                  {/* Konfi-Hinweis */}
                  <div className="app-auth-konfi-hint">
                    <IonIcon icon={informationCircleOutline} />
                    <span>Keine E-Mail-Adresse hinterlegt? Frag deinen Konfi-Leiter -- er kann dein Passwort direkt zurücksetzen.</span>
                  </div>

                  {error && (
                    <div className="app-auth-error">
                      <IonIcon icon={alertCircle} className="app-auth-error__icon" />
                      <span className="app-auth-error__text">{error}</span>
                    </div>
                  )}

                  {isNetworkError && (
                    <IonButton
                      expand="full"
                      fill="outline"
                      onClick={() => handleSubmit()}
                      style={{ marginBottom: '12px', '--border-radius': '8px', height: '36px', fontSize: '0.85rem' }}
                    >
                      <IonIcon icon={refreshOutline} slot="start" />
                      Erneut versuchen
                    </IonButton>
                  )}

                  <IonButton
                    expand="full"
                    onClick={handleSubmit}
                    disabled={loading || !isOnline}
                    className="app-auth-button"
                    style={{ marginBottom: '16px' }}
                  >
                    {loading ? (
                      <IonSpinner name="crescent" style={{ '--color': 'white' }} />
                    ) : !isOnline ? (
                      <><IonIcon icon={cloudOfflineOutline} style={{ marginRight: 4 }} /> Du bist offline</>
                    ) : (
                      'Link senden'
                    )}
                  </IonButton>

                  <div className="app-auth-footer">
                    <span
                      onClick={() => history.push('/login')}
                      className="app-auth-link"
                    >
                      <IonIcon icon={arrowBack} />
                      Zurück zum Login
                    </span>
                  </div>
                </>
              )}
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default ForgotPasswordPage;
