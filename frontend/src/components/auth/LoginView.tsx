import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonPage,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonSpinner,
  IonIcon,
  IonText,
  IonImg
} from '@ionic/react';
import { key, person, trophy, star, sparkles, alertCircle, closeCircle, eye, eyeOff } from 'ionicons/icons';
import { useApp } from '../../contexts/AppContext';
import { loginWithAutoDetection } from '../../services/auth';

const LoginView: React.FC = () => {
  const { setError, setSuccess, setUser } = useApp();
  const history = useHistory();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [shakeError, setShakeError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const triggerShake = () => {
    setShakeError(true);
    setTimeout(() => setShakeError(false), 600);
  };

  const handleLogin = async () => {
    setLoginError(null);

    if (!username || !password) {
      setLoginError('Bitte Benutzername und Passwort eingeben');
      triggerShake();
      return;
    }

    setLoading(true);
    try {
      const user = await loginWithAutoDetection(username, password);
      setSuccess('Erfolgreich angemeldet');
      setUser(user);

      // Explicit navigation based on user type
      if (user.type === 'admin') {
        history.replace('/admin/konfis');
      } else {
        history.replace('/konfi/dashboard');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message;
      let displayError: string;

      if (errorMessage.includes('password') || errorMessage.includes('Passwort') || errorMessage.includes('Invalid credentials')) {
        displayError = 'Falsches Passwort. Bitte versuche es erneut.';
      } else if (errorMessage.includes('not found') || errorMessage.includes('nicht gefunden') || errorMessage.includes('User not found')) {
        displayError = 'Nutzername nicht gefunden. Bitte überprüfe deine Eingabe.';
      } else if (errorMessage.includes('network') || errorMessage.includes('Network')) {
        displayError = 'Keine Verbindung zum Server. Bitte prüfe deine Internetverbindung.';
      } else {
        displayError = 'Anmeldung fehlgeschlagen. Bitte versuche es erneut.';
      }

      setLoginError(displayError);
      triggerShake();
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
          
          {/* Hero Section */}
          <div style={{
            textAlign: 'center',
            marginBottom: '40px',
            marginTop: '60px',
            color: 'white'
          }}>
            <div style={{
              fontSize: '4rem',
              marginBottom: '16px',
              display: 'flex',
              gap: '8px',
              justifyContent: 'center'
            }}>
              <IonIcon icon={trophy} style={{ color: '#FFD700' }} />
              <IonIcon icon={star} style={{ color: '#FF6B6B' }} />
              <IonIcon icon={sparkles} style={{ color: '#4ECDC4' }} />
            </div>
            
            <h1 style={{
              fontSize: '3.5rem',
              fontFamily: "'Bebas Neue', sans-serif",
              fontWeight: '400',
              margin: '0 0 8px 0',
              textShadow: '0 2px 4px rgba(0,0,0,0.3)',
              letterSpacing: '2px'
            }}>
              KONFI QUEST
            </h1>
            
            <p style={{
              fontSize: '1.1rem',
              opacity: 0.9,
              margin: '0',
              textShadow: '0 1px 2px rgba(0,0,0,0.3)'
            }}>
              Dein Abenteuer in der Gemeinde
            </p>
            
          </div>

          {/* Login Card */}
          <IonCard style={{
            width: '100%',
            maxWidth: '400px',
            borderRadius: '20px',
            boxShadow: loginError ? '0 20px 40px rgba(220,53,69,0.2)' : '0 20px 40px rgba(0,0,0,0.1)',
            overflow: 'hidden',
            animation: shakeError ? 'shake 0.6s ease-in-out' : 'none',
            border: loginError ? '2px solid rgba(220,53,69,0.3)' : 'none',
            transition: 'box-shadow 0.3s ease, border 0.3s ease'
          }}>
            <IonCardContent style={{ padding: '32px' }}>
              
              <div style={{
                textAlign: 'center',
                marginBottom: '32px'
              }}>
                <h2 style={{
                  fontSize: '1.5rem',
                  fontWeight: '600',
                  margin: '0',
                  color: '#2c3e50'
                }}>
                  Willkommen!
                </h2>
                <p style={{
                  color: '#7f8c8d',
                  margin: '8px 0 0 0',
                  fontSize: '0.9rem'
                }}>
                  Melde dich an um deine Quest zu starten
                </p>
              </div>

              <IonItem lines="none" style={{
                '--background': '#f8f9fa',
                '--border-radius': '12px',
                marginBottom: '16px'
              }}>
                <IonIcon icon={person} slot="start" color="medium" />
                <IonLabel position="stacked" style={{ color: '#667eea', fontWeight: '500' }}>
                  Benutzername
                </IonLabel>
                <IonInput
                  value={username}
                  onIonInput={(e) => setUsername(e.detail.value!)}
                  placeholder="Dein Nutzername"
                  style={{ '--color': '#2c3e50' }}
                />
              </IonItem>
              
              <IonItem lines="none" style={{
                '--background': '#f8f9fa',
                '--border-radius': '12px',
                marginBottom: '24px'
              }}>
                <IonIcon icon={key} slot="start" color="medium" />
                <IonLabel position="stacked" style={{ color: '#667eea', fontWeight: '500' }}>
                  Passwort
                </IonLabel>
                <IonInput
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onIonInput={(e) => setPassword(e.detail.value!)}
                  placeholder="Dein Passwort"
                  style={{ '--color': '#2c3e50' }}
                />
                <IonIcon
                  icon={showPassword ? eyeOff : eye}
                  slot="end"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    cursor: 'pointer',
                    fontSize: '1.3rem',
                    color: '#667eea',
                    padding: '8px',
                    marginTop: '20px'
                  }}
                />
              </IonItem>
              
              <IonButton
                expand="full"
                onClick={handleLogin}
                disabled={loading}
                style={{
                  '--background': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  '--color': 'white',
                  '--border-radius': '12px',
                  height: '48px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  margin: '0'
                }}
              >
                {loading ? (
                  <IonSpinner name="crescent" style={{ '--color': 'white' }} />
                ) : (
                  <>
                    <IonIcon icon={sparkles} slot="start" />
                    Quest starten
                  </>
                )}
              </IonButton>

              {/* Fehlermeldung direkt im Formular */}
              {loginError && (
                <div style={{
                  marginTop: '16px',
                  padding: '14px 16px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
                  border: '1px solid #f87171',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)'
                  }}>
                    <IonIcon icon={alertCircle} style={{ fontSize: '1.3rem', color: 'white' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      color: '#991b1b',
                      marginBottom: '2px'
                    }}>
                      Anmeldung fehlgeschlagen
                    </div>
                    <div style={{
                      fontSize: '0.8rem',
                      color: '#b91c1c'
                    }}>
                      {loginError}
                    </div>
                  </div>
                  <IonIcon
                    icon={closeCircle}
                    onClick={() => setLoginError(null)}
                    style={{
                      fontSize: '1.2rem',
                      color: '#b91c1c',
                      cursor: 'pointer',
                      opacity: 0.7
                    }}
                  />
                </div>
              )}

              {/* Passwort vergessen Link */}
              <div style={{
                textAlign: 'center',
                marginTop: '16px'
              }}>
                <span
                  onClick={() => history.push('/forgot-password')}
                  style={{
                    color: '#7f8c8d',
                    cursor: 'pointer',
                    fontSize: '0.8rem'
                  }}
                >
                  Passwort vergessen?
                </span>
              </div>

              <div style={{
                textAlign: 'center',
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: '1px solid #e5e7eb'
              }}>
                <span
                  onClick={() => history.push('/register')}
                  style={{
                    color: '#667eea',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  Noch keinen Account? <strong>Mit Einladungscode registrieren</strong>
                </span>
              </div>
            </IonCardContent>
          </IonCard>

        </div>

        {/* CSS Animation für Shake */}
        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
            20%, 40%, 60%, 80% { transform: translateX(5px); }
          }
        `}</style>
      </IonContent>
    </IonPage>
  );
};

export default LoginView;