import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
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
  IonIcon,
  useIonRouter
} from '@ionic/react';
// useIonRouter: Ionic 8 API - bei Ionic v9 ggf. auf useNavigate migrieren
import { lockClosedOutline, eye, eyeOff, checkmarkCircle, alertCircle, closeCircle, arrowBack } from 'ionicons/icons';
import api from '../../services/api';

const PasswordCheckItem: React.FC<{ label: string; checked: boolean }> = ({ label, checked }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: checked ? '#10b981' : '#9ca3af'
  }}>
    <IonIcon
      icon={checked ? checkmarkCircle : closeCircle}
      style={{ fontSize: '0.9rem' }}
    />
    <span style={{ fontSize: '0.75rem' }}>{label}</span>
  </div>
);

const ResetPasswordPage: React.FC = () => {
  const router = useIonRouter();
  const location = useLocation();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Token aus URL extrahieren
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tokenParam = params.get('token');
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      setError('Ungültiger Reset-Link. Bitte fordere einen neuen an.');
    }
  }, [location]);

  // Passwort-Validierung
  const passwordChecks = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/~`]/.test(password)
  };

  const isPasswordValid = Object.values(passwordChecks).every(Boolean);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async () => {
    if (!token) {
      setError('Ungültiger Reset-Link');
      return;
    }

    if (!isPasswordValid) {
      setError('Das Passwort erfüllt nicht alle Anforderungen');
      return;
    }

    if (!passwordsMatch) {
      setError('Die Passwörter stimmen nicht überein');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.post('/auth/reset-password', {
        token,
        newPassword: password
      });
      setSuccess(true);
    } catch (err: any) {
      const message = err.response?.data?.error || 'Fehler beim Zurücksetzen des Passworts';
      if (message.includes('abgelaufen') || message.includes('expired') || message.includes('ungültig')) {
        setError('Dieser Link ist abgelaufen oder ungültig. Bitte fordere einen neuen an.');
      } else {
        setError(message);
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
              <IonIcon icon={lockClosedOutline} className="app-auth-hero__circle-icon" />
            </div>

            <h1 style={{
              fontSize: '1.8rem',
              fontWeight: '600',
              margin: '0 0 8px 0',
              textShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}>
              Neues Passwort setzen
            </h1>

            <p style={{
              fontSize: '1rem',
              opacity: 0.9,
              margin: '0'
            }}>
              Wähle ein sicheres Passwort für dein Konto
            </p>
          </div>

          {/* Card */}
          <IonCard className="app-auth-card app-auth-card--narrow">
            <IonCardContent className="app-auth-card__content">

              {success ? (
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
                    Passwort geändert!
                  </h2>

                  <p style={{
                    color: '#7f8c8d',
                    fontSize: '0.9rem',
                    margin: '0 0 24px 0',
                    lineHeight: '1.5'
                  }}>
                    Dein Passwort wurde erfolgreich geändert. Du kannst dich jetzt mit deinem neuen Passwort anmelden.
                  </p>

                  <IonButton
                    expand="full"
                    onClick={() => router.push('/login')}
                    className="app-auth-button"
                  >
                    Zum Login
                  </IonButton>
                </div>
              ) : !token ? (
                // Kein Token - spezielles Rot-Design (Inline-Styles beibehalten)
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 20px auto',
                    boxShadow: '0 8px 24px rgba(239, 68, 68, 0.3)'
                  }}>
                    <IonIcon icon={alertCircle} style={{ fontSize: '2rem', color: 'white' }} />
                  </div>

                  <h2 style={{
                    fontSize: '1.3rem',
                    fontWeight: '600',
                    margin: '0 0 12px 0',
                    color: '#2c3e50'
                  }}>
                    Ungültiger Link
                  </h2>

                  <p style={{
                    color: '#7f8c8d',
                    fontSize: '0.9rem',
                    margin: '0 0 24px 0',
                    lineHeight: '1.5'
                  }}>
                    Dieser Link ist ungültig oder abgelaufen. Bitte fordere einen neuen Reset-Link an.
                  </p>

                  <IonButton
                    expand="full"
                    onClick={() => router.push('/forgot-password')}
                    className="app-auth-button"
                  >
                    Neuen Link anfordern
                  </IonButton>
                </div>
              ) : (
                // Formular
                <>
                  <IonItem lines="none" className="app-auth-input app-auth-input--compact">
                    <IonIcon icon={lockClosedOutline} slot="start" color="medium" />
                    <IonLabel position="stacked" className="app-auth-input__label">
                      Neues Passwort
                    </IonLabel>
                    <IonInput
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onIonInput={(e) => setPassword(e.detail.value!)}
                      placeholder="Neues Passwort"
                      style={{ '--color': '#2c3e50' }}
                    />
                    <IonIcon
                      icon={showPassword ? eyeOff : eye}
                      slot="end"
                      onClick={() => setShowPassword(!showPassword)}
                      className="app-auth-input__toggle"
                    />
                  </IonItem>

                  {/* Passwort-Anforderungen */}
                  {password.length > 0 && !isPasswordValid && (
                    <div className="app-auth-password-checks">
                      <div className="app-auth-password-checks__grid">
                        <PasswordCheckItem label="Mind. 8 Zeichen" checked={passwordChecks.minLength} />
                        <PasswordCheckItem label="Großbuchstabe" checked={passwordChecks.hasUppercase} />
                        <PasswordCheckItem label="Kleinbuchstabe" checked={passwordChecks.hasLowercase} />
                        <PasswordCheckItem label="Zahl" checked={passwordChecks.hasNumber} />
                        <PasswordCheckItem label="Sonderzeichen" checked={passwordChecks.hasSpecial} />
                      </div>
                    </div>
                  )}

                  <IonItem lines="none" className="app-auth-input">
                    <IonIcon icon={lockClosedOutline} slot="start" color="medium" />
                    <IonLabel position="stacked" className="app-auth-input__label">
                      Passwort bestätigen
                    </IonLabel>
                    <IonInput
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onIonInput={(e) => setConfirmPassword(e.detail.value!)}
                      placeholder="Passwort wiederholen"
                      style={{ '--color': '#2c3e50' }}
                    />
                    <IonIcon
                      icon={showConfirmPassword ? eyeOff : eye}
                      slot="end"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="app-auth-input__toggle"
                    />
                  </IonItem>

                  {/* Passwörter stimmen nicht überein */}
                  {confirmPassword.length > 0 && !passwordsMatch && (
                    <div className="app-auth-password-match-error">
                      <IonIcon icon={alertCircle} style={{ fontSize: '1rem', color: '#dc2626' }} />
                      <span style={{ fontSize: '0.8rem', color: '#991b1b' }}>
                        Die Passwörter stimmen nicht überein
                      </span>
                    </div>
                  )}

                  {error && (
                    <div className="app-auth-error">
                      <IonIcon icon={alertCircle} className="app-auth-error__icon" />
                      <span className="app-auth-error__text">{error}</span>
                    </div>
                  )}

                  <IonButton
                    expand="full"
                    onClick={handleSubmit}
                    disabled={loading || !isPasswordValid || !passwordsMatch}
                    className="app-auth-button"
                  >
                    {loading ? (
                      <IonSpinner name="crescent" style={{ '--color': 'white' }} />
                    ) : (
                      'Passwort ändern'
                    )}
                  </IonButton>

                  <div className="app-auth-footer">
                    <span onClick={() => router.push('/login')} className="app-auth-link">
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

export default ResetPasswordPage;
