import React, { useState, useEffect } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
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
import { lockClosedOutline, eye, eyeOff, checkmarkCircle, alertCircle, closeCircle } from 'ionicons/icons';
import api from '../../services/api';

const ResetPasswordPage: React.FC = () => {
  const history = useHistory();
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
              <IonIcon icon={lockClosedOutline} style={{ fontSize: '2.5rem', color: 'white' }} />
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
          <IonCard style={{
            width: '100%',
            maxWidth: '400px',
            borderRadius: '20px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
            overflow: 'hidden'
          }}>
            <IonCardContent style={{ padding: '32px' }}>

              {success ? (
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
                    onClick={() => history.push('/login')}
                    style={{
                      '--background': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      '--border-radius': '12px',
                      height: '48px',
                      fontWeight: '600'
                    }}
                  >
                    Zum Login
                  </IonButton>
                </div>
              ) : !token ? (
                // Kein Token
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
                    onClick={() => history.push('/forgot-password')}
                    style={{
                      '--background': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      '--border-radius': '12px',
                      height: '48px',
                      fontWeight: '600'
                    }}
                  >
                    Neuen Link anfordern
                  </IonButton>
                </div>
              ) : (
                // Formular
                <>
                  <IonItem lines="none" style={{
                    '--background': '#f8f9fa',
                    '--border-radius': '12px',
                    marginBottom: '12px'
                  }}>
                    <IonIcon icon={lockClosedOutline} slot="start" color="medium" />
                    <IonLabel position="stacked" style={{ color: '#667eea', fontWeight: '500' }}>
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
                      style={{
                        cursor: 'pointer',
                        fontSize: '1.3rem',
                        color: '#667eea',
                        padding: '8px',
                        marginTop: '20px'
                      }}
                    />
                  </IonItem>

                  {/* Passwort-Anforderungen */}
                  {password.length > 0 && !isPasswordValid && (
                    <div style={{
                      background: '#f8f9fa',
                      borderRadius: '10px',
                      padding: '12px',
                      marginBottom: '12px'
                    }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <PasswordCheckItem label="Mind. 8 Zeichen" checked={passwordChecks.minLength} />
                        <PasswordCheckItem label="Großbuchstabe" checked={passwordChecks.hasUppercase} />
                        <PasswordCheckItem label="Kleinbuchstabe" checked={passwordChecks.hasLowercase} />
                        <PasswordCheckItem label="Zahl" checked={passwordChecks.hasNumber} />
                        <PasswordCheckItem label="Sonderzeichen" checked={passwordChecks.hasSpecial} />
                      </div>
                    </div>
                  )}

                  <IonItem lines="none" style={{
                    '--background': '#f8f9fa',
                    '--border-radius': '12px',
                    marginBottom: '16px'
                  }}>
                    <IonIcon icon={lockClosedOutline} slot="start" color="medium" />
                    <IonLabel position="stacked" style={{ color: '#667eea', fontWeight: '500' }}>
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
                      style={{
                        cursor: 'pointer',
                        fontSize: '1.3rem',
                        color: '#667eea',
                        padding: '8px',
                        marginTop: '20px'
                      }}
                    />
                  </IonItem>

                  {/* Passwörter stimmen nicht überein */}
                  {confirmPassword.length > 0 && !passwordsMatch && (
                    <div style={{
                      marginBottom: '16px',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: '#fee2e2',
                      border: '1px solid #fecaca',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <IonIcon icon={alertCircle} style={{ fontSize: '1rem', color: '#dc2626' }} />
                      <span style={{ fontSize: '0.8rem', color: '#991b1b' }}>
                        Die Passwörter stimmen nicht überein
                      </span>
                    </div>
                  )}

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
                    disabled={loading || !isPasswordValid || !passwordsMatch}
                    style={{
                      '--background': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      '--border-radius': '12px',
                      height: '48px',
                      fontWeight: '600'
                    }}
                  >
                    {loading ? (
                      <IonSpinner name="crescent" style={{ '--color': 'white' }} />
                    ) : (
                      'Passwort ändern'
                    )}
                  </IonButton>
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
