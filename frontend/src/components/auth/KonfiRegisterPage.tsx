import React, { useState, useEffect } from 'react';
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
  IonText
} from '@ionic/react';
import {
  person,
  key,
  mail,
  trophy,
  star,
  sparkles,
  alertCircle,
  closeCircle,
  eye,
  eyeOff,
  checkmarkCircle,
  school,
  arrowBack
} from 'ionicons/icons';
import { useLocation, useHistory } from 'react-router-dom';
import api from '../../services/api';

interface PasswordCheck {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}

const KonfiRegisterPage: React.FC = () => {
  const location = useLocation();
  const history = useHistory();

  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [shakeError, setShakeError] = useState(false);

  const [inviteCode, setInviteCode] = useState<string>('');
  const [manualCode, setManualCode] = useState<string>('');
  const [inviteInfo, setInviteInfo] = useState<{
    jahrgang_name: string;
    organization_name: string;
  } | null>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    display_name: '',
    username: '',
    email: '',
    password: '',
    password_confirm: ''
  });

  // Passwort-Checks
  const [passwordChecks, setPasswordChecks] = useState<PasswordCheck>({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecial: false
  });

  const triggerShake = () => {
    setShakeError(true);
    setTimeout(() => setShakeError(false), 600);
  };

  useEffect(() => {
    // Get code from URL parameter
    const params = new URLSearchParams(location.search);
    const code = params.get('code');

    if (code) {
      setInviteCode(code);
      setManualCode(code);
      validateCode(code);
    } else {
      setLoading(false);
    }
  }, [location]);

  // Passwort-Check bei jeder Änderung
  useEffect(() => {
    const pw = formData.password;
    setPasswordChecks({
      minLength: pw.length >= 8,
      hasUppercase: /[A-Z]/.test(pw),
      hasLowercase: /[a-z]/.test(pw),
      hasNumber: /[0-9]/.test(pw),
      hasSpecial: /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/~`]/.test(pw)
    });
  }, [formData.password]);

  const validateCode = async (code: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/auth/validate-invite/${code}`);
      setInviteInfo({
        jahrgang_name: response.data.jahrgang_name,
        organization_name: response.data.organization_name
      });
      setInviteCode(code);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ungültiger Einladungscode');
      setInviteInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const handleManualCodeSubmit = () => {
    if (manualCode.trim().length >= 6) {
      validateCode(manualCode.trim());
    }
  };

  const isPasswordValid = Object.values(passwordChecks).every(Boolean);

  const handleSubmit = async () => {
    setError(null);

    // Validation
    if (!formData.display_name.trim()) {
      setError('Bitte gib deinen Namen ein');
      triggerShake();
      return;
    }
    if (formData.username.length < 3) {
      setError('Benutzername muss mindestens 3 Zeichen lang sein');
      triggerShake();
      return;
    }
    if (!isPasswordValid) {
      setError('Passwort erfüllt nicht alle Anforderungen');
      triggerShake();
      return;
    }
    if (formData.password !== formData.password_confirm) {
      setError('Passwörter stimmen nicht überein');
      triggerShake();
      return;
    }

    try {
      setRegistering(true);
      setError(null);

      await api.post('/auth/register-konfi', {
        invite_code: inviteCode,
        display_name: formData.display_name.trim(),
        username: formData.username.toLowerCase().trim(),
        password: formData.password,
        email: formData.email.trim() || undefined
      });

      setSuccess(true);

      // Redirect to login after 3 seconds
      setTimeout(() => {
        history.push('/login');
      }, 3000);

    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler bei der Registrierung');
      triggerShake();
    } finally {
      setRegistering(false);
    }
  };

  // Success Screen
  if (success) {
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
            padding: '20px',
            textAlign: 'center'
          }}>
            <div style={{
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #34c759 0%, #30d158 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '24px',
              boxShadow: '0 8px 24px rgba(52, 199, 89, 0.4)'
            }}>
              <IonIcon icon={checkmarkCircle} style={{ fontSize: '3.5rem', color: 'white' }} />
            </div>
            <h1 style={{
              margin: '0 0 12px 0',
              fontSize: '2rem',
              fontWeight: '600',
              color: 'white',
              textShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}>
              Registrierung erfolgreich!
            </h1>
            <p style={{
              margin: '0 0 24px 0',
              color: 'rgba(255,255,255,0.9)',
              fontSize: '1.1rem'
            }}>
              Du wirst gleich zur Anmeldung weitergeleitet...
            </p>
            <IonSpinner name="dots" style={{ '--color': 'white' }} />
          </div>
        </IonContent>
      </IonPage>
    );
  }

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
            marginBottom: '30px',
            marginTop: '40px',
            color: 'white'
          }}>
            <div style={{
              fontSize: '3.5rem',
              marginBottom: '12px',
              display: 'flex',
              gap: '8px',
              justifyContent: 'center'
            }}>
              <IonIcon icon={trophy} style={{ color: '#FFD700' }} />
              <IonIcon icon={star} style={{ color: '#FF6B6B' }} />
              <IonIcon icon={sparkles} style={{ color: '#4ECDC4' }} />
            </div>

            <h1 style={{
              fontSize: '3rem',
              fontFamily: "'Bebas Neue', sans-serif",
              fontWeight: '400',
              margin: '0 0 8px 0',
              textShadow: '0 2px 4px rgba(0,0,0,0.3)',
              letterSpacing: '2px'
            }}>
              KONFI QUEST
            </h1>

            <p style={{
              fontSize: '1rem',
              opacity: 0.9,
              margin: '0',
              textShadow: '0 1px 2px rgba(0,0,0,0.3)'
            }}>
              Erstelle deinen Account
            </p>
          </div>

          {/* Main Card */}
          <IonCard style={{
            width: '100%',
            maxWidth: '420px',
            borderRadius: '20px',
            boxShadow: error ? '0 20px 40px rgba(220,53,69,0.2)' : '0 20px 40px rgba(0,0,0,0.1)',
            overflow: 'hidden',
            animation: shakeError ? 'shake 0.6s ease-in-out' : 'none',
            border: error ? '2px solid rgba(220,53,69,0.3)' : 'none',
            transition: 'box-shadow 0.3s ease, border 0.3s ease'
          }}>
            <IonCardContent style={{ padding: '24px' }}>

              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
                  <IonSpinner name="crescent" />
                </div>
              ) : !inviteInfo ? (
                /* Code Eingabe wenn kein gültiger Code */
                <>
                  <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '1.3rem', fontWeight: '600', margin: '0', color: '#2c3e50' }}>
                      Einladungscode eingeben
                    </h2>
                    <p style={{ color: '#7f8c8d', margin: '8px 0 0 0', fontSize: '0.85rem' }}>
                      Du hast einen Code von deiner Gemeinde erhalten
                    </p>
                  </div>

                  <IonItem lines="none" style={{
                    '--background': '#f8f9fa',
                    '--border-radius': '12px',
                    marginBottom: '16px'
                  }}>
                    <IonIcon icon={key} slot="start" color="medium" />
                    <IonLabel position="stacked" style={{ color: '#667eea', fontWeight: '500' }}>
                      Einladungscode
                    </IonLabel>
                    <IonInput
                      value={manualCode}
                      onIonInput={(e) => setManualCode(e.detail.value!.toUpperCase())}
                      placeholder="z.B. ABC12345"
                      style={{ '--color': '#2c3e50', textTransform: 'uppercase', letterSpacing: '2px' }}
                    />
                  </IonItem>

                  {error && (
                    <div style={{
                      marginBottom: '16px',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
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
                    onClick={handleManualCodeSubmit}
                    disabled={manualCode.trim().length < 6}
                    style={{
                      '--background': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      '--color': 'white',
                      '--border-radius': '12px',
                      height: '48px',
                      fontSize: '1rem',
                      fontWeight: '600',
                      margin: '0 0 16px 0'
                    }}
                  >
                    Code prüfen
                  </IonButton>

                  <div style={{ textAlign: 'center' }}>
                    <span
                      onClick={() => history.push('/login')}
                      style={{ color: '#667eea', cursor: 'pointer', fontSize: '0.9rem' }}
                    >
                      <IonIcon icon={arrowBack} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                      Zurück zur Anmeldung
                    </span>
                  </div>
                </>
              ) : (
                /* Registrierungsformular */
                <>
                  {/* Einladungs-Info */}
                  <div style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '20px',
                    color: 'white',
                    textAlign: 'center'
                  }}>
                    <IonIcon icon={school} style={{ fontSize: '2rem', marginBottom: '8px' }} />
                    <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>
                      {inviteInfo.jahrgang_name}
                    </div>
                    <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>
                      {inviteInfo.organization_name}
                    </div>
                  </div>

                  {/* Name */}
                  <IonItem lines="none" style={{
                    '--background': '#f8f9fa',
                    '--border-radius': '12px',
                    marginBottom: '12px'
                  }}>
                    <IonIcon icon={person} slot="start" color="medium" />
                    <IonLabel position="stacked" style={{ color: '#667eea', fontWeight: '500' }}>
                      Dein Name *
                    </IonLabel>
                    <IonInput
                      value={formData.display_name}
                      onIonInput={(e) => setFormData({ ...formData, display_name: e.detail.value! })}
                      placeholder="Vor- und Nachname"
                      disabled={registering}
                      style={{ '--color': '#2c3e50' }}
                    />
                  </IonItem>

                  {/* Benutzername */}
                  <IonItem lines="none" style={{
                    '--background': '#f8f9fa',
                    '--border-radius': '12px',
                    marginBottom: '12px'
                  }}>
                    <IonIcon icon={person} slot="start" color="medium" />
                    <IonLabel position="stacked" style={{ color: '#667eea', fontWeight: '500' }}>
                      Benutzername *
                    </IonLabel>
                    <IonInput
                      value={formData.username}
                      onIonInput={(e) => setFormData({ ...formData, username: e.detail.value! })}
                      placeholder="z.B. max123"
                      disabled={registering}
                      autocapitalize="off"
                      style={{ '--color': '#2c3e50' }}
                    />
                  </IonItem>

                  {/* E-Mail (optional) */}
                  <IonItem lines="none" style={{
                    '--background': '#f8f9fa',
                    '--border-radius': '12px',
                    marginBottom: '12px'
                  }}>
                    <IonIcon icon={mail} slot="start" color="medium" />
                    <IonLabel position="stacked" style={{ color: '#667eea', fontWeight: '500' }}>
                      E-Mail (optional)
                    </IonLabel>
                    <IonInput
                      type="email"
                      value={formData.email}
                      onIonInput={(e) => setFormData({ ...formData, email: e.detail.value! })}
                      placeholder="deine@email.de"
                      disabled={registering}
                      style={{ '--color': '#2c3e50' }}
                    />
                  </IonItem>

                  {/* Passwort */}
                  <IonItem lines="none" style={{
                    '--background': '#f8f9fa',
                    '--border-radius': '12px',
                    marginBottom: '8px'
                  }}>
                    <IonIcon icon={key} slot="start" color="medium" />
                    <IonLabel position="stacked" style={{ color: '#667eea', fontWeight: '500' }}>
                      Passwort *
                    </IonLabel>
                    <IonInput
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onIonInput={(e) => setFormData({ ...formData, password: e.detail.value! })}
                      placeholder="Sicheres Passwort"
                      disabled={registering}
                      style={{ '--color': '#2c3e50' }}
                    />
                    <IonIcon
                      icon={showPassword ? eyeOff : eye}
                      slot="end"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ cursor: 'pointer', fontSize: '1.2rem', color: '#667eea', marginTop: '20px' }}
                    />
                  </IonItem>

                  {/* Passwort-Anforderungen - ausblenden wenn alle erfüllt */}
                  {!isPasswordValid && formData.password.length > 0 && (
                    <div style={{
                      background: '#f8f9fa',
                      borderRadius: '10px',
                      padding: '12px',
                      marginBottom: '12px',
                      fontSize: '0.8rem'
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

                  {/* Passwort bestätigen */}
                  <IonItem lines="none" style={{
                    '--background': '#f8f9fa',
                    '--border-radius': '12px',
                    marginBottom: '16px'
                  }}>
                    <IonIcon icon={key} slot="start" color="medium" />
                    <IonLabel position="stacked" style={{ color: '#667eea', fontWeight: '500' }}>
                      Passwort bestätigen *
                    </IonLabel>
                    <IonInput
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={formData.password_confirm}
                      onIonInput={(e) => setFormData({ ...formData, password_confirm: e.detail.value! })}
                      placeholder="Passwort wiederholen"
                      disabled={registering}
                      style={{ '--color': '#2c3e50' }}
                    />
                    <IonIcon
                      icon={showConfirmPassword ? eyeOff : eye}
                      slot="end"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={{ cursor: 'pointer', fontSize: '1.2rem', color: '#667eea', marginTop: '20px' }}
                    />
                  </IonItem>

                  {/* Passwörter stimmen nicht überein */}
                  {formData.password && formData.password_confirm && formData.password !== formData.password_confirm && (
                    <div style={{
                      marginBottom: '12px',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: '#fee2e2',
                      border: '1px solid #f87171',
                      fontSize: '0.85rem',
                      color: '#991b1b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <IonIcon icon={alertCircle} />
                      Passwörter stimmen nicht überein
                    </div>
                  )}

                  {/* Fehler */}
                  {error && (
                    <div style={{
                      marginBottom: '16px',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
                      border: '1px solid #f87171',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}>
                      <IonIcon icon={alertCircle} style={{ fontSize: '1.2rem', color: '#dc2626', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.85rem', color: '#991b1b', flex: 1 }}>{error}</span>
                      <IonIcon
                        icon={closeCircle}
                        onClick={() => setError(null)}
                        style={{ fontSize: '1.1rem', color: '#b91c1c', cursor: 'pointer' }}
                      />
                    </div>
                  )}

                  <IonButton
                    expand="full"
                    onClick={handleSubmit}
                    disabled={registering || !isPasswordValid}
                    style={{
                      '--background': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      '--color': 'white',
                      '--border-radius': '12px',
                      height: '48px',
                      fontSize: '1rem',
                      fontWeight: '600',
                      margin: '0 0 16px 0'
                    }}
                  >
                    {registering ? (
                      <IonSpinner name="crescent" style={{ '--color': 'white' }} />
                    ) : (
                      <>
                        <IonIcon icon={sparkles} slot="start" />
                        Registrieren
                      </>
                    )}
                  </IonButton>

                  <div style={{ textAlign: 'center' }}>
                    <span style={{ color: '#7f8c8d', fontSize: '0.9rem' }}>
                      Schon einen Account?{' '}
                      <span
                        onClick={() => history.push('/login')}
                        style={{ color: '#667eea', cursor: 'pointer', fontWeight: '500' }}
                      >
                        Anmelden
                      </span>
                    </span>
                  </div>
                </>
              )}
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

// Password Check Item Component
const PasswordCheckItem: React.FC<{ label: string; checked: boolean }> = ({ label, checked }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: checked ? '#10b981' : '#9ca3af'
  }}>
    <IonIcon
      icon={checked ? checkmarkCircle : alertCircle}
      style={{ fontSize: '0.9rem' }}
    />
    <span>{label}</span>
  </div>
);

export default KonfiRegisterPage;
