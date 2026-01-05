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
import { mailOutline, arrowBack, checkmarkCircle, alertCircle } from 'ionicons/icons';
import api from '../../services/api';

const ForgotPasswordPage: React.FC = () => {
  const history = useHistory();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    try {
      await api.post('/auth/request-password-reset', { email: email.trim() });
      setSent(true);
    } catch (err: any) {
      // Auch bei Fehlern zeigen wir Erfolg an (Sicherheit)
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <IonPage>
      <IonContent style={{
        '--background': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          padding: '20px'
        }}>

          {/* Header */}
          <div style={{
            textAlign: 'center',
            marginBottom: '40px',
            color: 'white'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px auto'
            }}>
              <IonIcon icon={mailOutline} style={{ fontSize: '2.5rem', color: 'white' }} />
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
          <IonCard style={{
            width: '100%',
            maxWidth: '400px',
            borderRadius: '20px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
            overflow: 'hidden'
          }}>
            <IonCardContent style={{ padding: '32px' }}>

              {sent ? (
                // Erfolgsmeldung
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 20px auto',
                    boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)'
                  }}>
                    <IonIcon icon={checkmarkCircle} style={{ fontSize: '2rem', color: 'white' }} />
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
                    style={{
                      '--background': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      '--border-radius': '12px',
                      height: '48px',
                      fontWeight: '600'
                    }}
                  >
                    Zurück zum Login
                  </IonButton>
                </div>
              ) : (
                // Formular
                <>
                  <IonItem lines="none" style={{
                    '--background': '#f8f9fa',
                    '--border-radius': '12px',
                    marginBottom: '16px'
                  }}>
                    <IonIcon icon={mailOutline} slot="start" color="medium" />
                    <IonLabel position="stacked" style={{ color: '#667eea', fontWeight: '500' }}>
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

                  {error && (
                    <div style={{
                      marginBottom: '16px',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      background: '#fee2e2',
                      border: '1px solid #f87171',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}>
                      <IonIcon icon={alertCircle} style={{ fontSize: '1.2rem', color: '#dc2626' }} />
                      <span style={{ fontSize: '0.85rem', color: '#991b1b' }}>{error}</span>
                    </div>
                  )}

                  <IonButton
                    expand="full"
                    onClick={handleSubmit}
                    disabled={loading}
                    style={{
                      '--background': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      '--border-radius': '12px',
                      height: '48px',
                      fontWeight: '600',
                      marginBottom: '16px'
                    }}
                  >
                    {loading ? (
                      <IonSpinner name="crescent" style={{ '--color': 'white' }} />
                    ) : (
                      'Link senden'
                    )}
                  </IonButton>

                  <div style={{ textAlign: 'center' }}>
                    <span
                      onClick={() => history.push('/login')}
                      style={{
                        color: '#667eea',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
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
