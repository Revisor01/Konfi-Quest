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
import { key, person, trophy, star, sparkles, alertCircle, closeCircle, eye, eyeOff, refreshOutline } from 'ionicons/icons';
import { useApp } from '../../contexts/AppContext';
import { loginWithAutoDetection } from '../../services/auth';

const LoginView: React.FC = () => {
  const { setSuccess, setUser } = useApp();
  const history = useHistory();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [shakeError, setShakeError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isNetworkError, setIsNetworkError] = useState(false);

  const triggerShake = () => {
    setShakeError(true);
    setTimeout(() => setShakeError(false), 600);
  };

  const handleLogin = async () => {
    setLoginError(null);
    setIsNetworkError(false);

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
      } else if (user.type === 'teamer') {
        history.replace('/teamer/dashboard');
      } else {
        history.replace('/konfi/dashboard');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message;
      let displayError: string;

      // Netzwerkfehler erkennen
      if (!err.response || err.code === 'ERR_NETWORK') {
        displayError = 'Keine Verbindung zum Server. Bitte pr\u00fcfe deine Internetverbindung.';
        setIsNetworkError(true);
      } else if (err.rateLimitMessage) {
        displayError = err.rateLimitMessage;
      } else if (errorMessage.includes('password') || errorMessage.includes('Passwort') || errorMessage.includes('Invalid credentials') || errorMessage.includes('Ung\u00fcltige Anmeldedaten')) {
        displayError = 'Falsches Passwort. Bitte versuche es erneut.';
      } else if (errorMessage.includes('not found') || errorMessage.includes('nicht gefunden') || errorMessage.includes('User not found')) {
        displayError = 'Nutzername nicht gefunden. Bitte \u00fcberpr\u00fcfe deine Eingabe.';
      } else if (errorMessage.includes('network') || errorMessage.includes('Network')) {
        displayError = 'Keine Verbindung zum Server. Bitte pr\u00fcfe deine Internetverbindung.';
        setIsNetworkError(true);
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
      <IonContent className="app-auth-background">
        <div className="app-auth-container">

          {/* Hero Section */}
          <div className="app-auth-hero" style={{ marginTop: '60px' }}>
            <div className="app-auth-hero__icons">
              <IonIcon icon={trophy} style={{ color: '#FFD700' }} />
              <IonIcon icon={star} style={{ color: '#FF6B6B' }} />
              <IonIcon icon={sparkles} style={{ color: '#4ECDC4' }} />
            </div>

            <h1 className="app-auth-hero__title">
              KONFI QUEST
            </h1>

            <p className="app-auth-hero__subtitle">
              Dein Abenteuer in der Gemeinde
            </p>
          </div>

          {/* Login Card */}
          <IonCard className={`app-auth-card app-auth-card--narrow ${loginError ? 'app-auth-card--error' : ''} ${shakeError ? 'app-auth-card--shaking' : ''}`}
            style={{ transition: 'box-shadow 0.3s ease, border 0.3s ease' }}
          >
            <IonCardContent className="app-auth-card__content">

              <div className="app-auth-card__heading">
                <h2>Willkommen!</h2>
                <p>Melde dich an um deine Quest zu starten</p>
              </div>

              <IonItem lines="none" className="app-auth-input">
                <IonIcon icon={person} slot="start" color="medium" />
                <IonLabel position="stacked" className="app-auth-input__label">
                  Benutzername
                </IonLabel>
                <IonInput
                  value={username}
                  onIonInput={(e) => setUsername(e.detail.value!)}
                  placeholder="Dein Nutzername"
                  className="app-auth-input__value"
                />
              </IonItem>

              <IonItem lines="none" className="app-auth-input" style={{ marginBottom: '24px' }}>
                <IonIcon icon={key} slot="start" color="medium" />
                <IonLabel position="stacked" className="app-auth-input__label">
                  Passwort
                </IonLabel>
                <IonInput
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onIonInput={(e) => setPassword(e.detail.value!)}
                  placeholder="Dein Passwort"
                  className="app-auth-input__value"
                />
                <IonIcon
                  icon={showPassword ? eyeOff : eye}
                  slot="end"
                  onClick={() => setShowPassword(!showPassword)}
                  className="app-auth-input__toggle"
                />
              </IonItem>

              <IonButton
                expand="full"
                onClick={handleLogin}
                disabled={loading}
                className="app-auth-button"
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

              {/* Passwort vergessen Link - immer an fester Position direkt unter Button */}
              <div className="app-auth-footer">
                <span
                  onClick={() => history.push('/forgot-password')}
                  className="app-auth-link app-auth-link--muted"
                  style={{ cursor: 'pointer' }}
                >
                  Passwort vergessen?
                </span>
              </div>

              {/* Fehlermeldung */}
              {loginError && (
                <div className="app-auth-error app-auth-error--with-badge" style={{ gap: '12px' }}>
                  <div className="app-auth-error__badge">
                    <IonIcon icon={alertCircle} className="app-auth-error__badge-icon" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="app-auth-error__title">
                      Anmeldung fehlgeschlagen
                    </div>
                    <div className="app-auth-error__detail">
                      {loginError}
                    </div>
                  </div>
                  <IonIcon
                    icon={closeCircle}
                    onClick={() => { setLoginError(null); setIsNetworkError(false); }}
                    className="app-auth-error__close"
                    style={{ opacity: 0.7 }}
                  />
                </div>
              )}

              {isNetworkError && (
                <IonButton
                  expand="full"
                  className="app-auth-retry-button"
                  onClick={handleLogin}
                >
                  <IonIcon icon={refreshOutline} slot="start" />
                  Erneut versuchen
                </IonButton>
              )}

              {/* Register-Link mit Trennlinie */}
              <div className="app-auth-footer app-auth-footer--separator">
                <span
                  onClick={() => history.push('/register')}
                  className="app-auth-link"
                  style={{ fontSize: '0.85rem' }}
                >
                  Noch keinen Account? <strong>Mit Einladungscode registrieren</strong>
                </span>
              </div>
            </IonCardContent>
          </IonCard>

        </div>
      </IonContent>
    </IonPage>
  );
};

export default LoginView;
