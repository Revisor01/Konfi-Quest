import React, { useState, useEffect, useRef } from 'react';
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
  arrowBack,
  refreshOutline
} from 'ionicons/icons';
import { useLocation, useHistory } from 'react-router-dom';
import api from '../../services/api';
import { useApp } from '../../contexts/AppContext';

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
  const { setUser, setSuccess: setAppSuccess } = useApp();

  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [shakeError, setShakeError] = useState(false);
  const [isNetworkError, setIsNetworkError] = useState(false);

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

  // Username-Verfuegbarkeitspruefung
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const usernameCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const checkUsername = async (name: string) => {
    if (name.length < 3) { setUsernameStatus('idle'); return; }
    setUsernameStatus('checking');
    try {
      const res = await api.get(`/auth/check-username/${encodeURIComponent(name.toLowerCase().trim())}`);
      setUsernameStatus(res.data.available ? 'available' : 'taken');
    } catch {
      setUsernameStatus('idle');
    }
  };

  const handleUsernameInput = (value: string) => {
    setFormData(prev => ({ ...prev, username: value }));
    // Timer clearen und neuen setzen (300ms Debounce)
    if (usernameCheckTimer.current) {
      clearTimeout(usernameCheckTimer.current);
    }
    if (value.length >= 3) {
      usernameCheckTimer.current = setTimeout(() => {
        checkUsername(value);
      }, 300);
    } else {
      setUsernameStatus('idle');
    }
  };

  const handleUsernameBlur = () => {
    // Sofort pruefen falls noch nicht geprueft
    if (formData.username.length >= 3 && usernameStatus === 'idle') {
      if (usernameCheckTimer.current) {
        clearTimeout(usernameCheckTimer.current);
      }
      checkUsername(formData.username);
    }
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

  // Passwort-Check bei jeder Aenderung
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
      setIsNetworkError(false);
      const response = await api.get(`/auth/validate-invite/${code}`);
      setInviteInfo({
        jahrgang_name: response.data.jahrgang_name,
        organization_name: response.data.organization_name
      });
      setInviteCode(code);
    } catch (err: any) {
      // Netzwerkfehler erkennen
      if (!err.response || err.code === 'ERR_NETWORK') {
        setIsNetworkError(true);
        setError('Verbindung fehlgeschlagen. Bitte pr\u00fcfe deine Internetverbindung.');
      } else {
        // Differenzierte Fehlermeldungen
        const errorCode = err.response?.data?.error_code;
        if (errorCode === 'not_found') {
          setError('Dieser Einladungscode existiert nicht. Bitte pr\u00fcfe deine Eingabe.');
        } else if (errorCode === 'expired') {
          setError('Dieser Einladungscode ist abgelaufen. Bitte frage deinen Konfi-Leiter nach einem neuen Code.');
        } else {
          setError(err.response?.data?.error || 'Fehler bei der Code-Validierung');
        }
      }
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
    setIsNetworkError(false);

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
      setError('Passwort erf\u00fcllt nicht alle Anforderungen');
      triggerShake();
      return;
    }
    if (formData.password !== formData.password_confirm) {
      setError('Passw\u00f6rter stimmen nicht \u00fcberein');
      triggerShake();
      return;
    }

    try {
      setRegistering(true);
      setError(null);

      const response = await api.post('/auth/register-konfi', {
        invite_code: inviteCode,
        display_name: formData.display_name.trim(),
        username: formData.username.toLowerCase().trim(),
        password: formData.password,
        email: formData.email.trim() || undefined
      });

      setSuccess(true);

      // Auto-Login nach Registrierung
      const { token, user } = response.data;
      if (token && user) {
        localStorage.setItem('konfi_token', token);
        localStorage.setItem('konfi_user', JSON.stringify(user));
        setUser(user);
        setAppSuccess('Willkommen bei Konfi Quest!');
        // Kurz warten fuer visuelles Feedback, dann zum Dashboard
        setTimeout(() => {
          history.replace('/konfi/dashboard');
        }, 1500);
      }

    } catch (err: any) {
      // Netzwerkfehler erkennen
      if (!err.response || err.code === 'ERR_NETWORK') {
        setIsNetworkError(true);
        setError('Verbindung fehlgeschlagen. Bitte pr\u00fcfe deine Internetverbindung.');
      } else {
        setError(err.response?.data?.error || 'Fehler bei der Registrierung');
      }
      triggerShake();
    } finally {
      setRegistering(false);
    }
  };

  // Success Screen
  if (success) {
    return (
      <IonPage>
        <IonContent className="app-auth-background">
          <div className="app-auth-container" style={{ textAlign: 'center' }}>
            <div className="app-auth-success-circle">
              <IonIcon icon={checkmarkCircle} className="app-auth-success-circle__icon" />
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
              Du wirst zum Dashboard weitergeleitet...
            </p>
            <IonSpinner name="dots" style={{ '--color': 'white' }} />
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonContent className="app-auth-background">
        <div className="app-auth-container">

          {/* Hero Section */}
          <div className="app-auth-hero" style={{ marginTop: '40px' }}>
            <div className="app-auth-hero__icons app-auth-hero__icons--small">
              <IonIcon icon={trophy} style={{ color: '#FFD700' }} />
              <IonIcon icon={star} style={{ color: '#FF6B6B' }} />
              <IonIcon icon={sparkles} style={{ color: '#4ECDC4' }} />
            </div>

            <h1 className="app-auth-hero__title app-auth-hero__title--small">
              KONFI QUEST
            </h1>

            <p className="app-auth-hero__subtitle app-auth-hero__subtitle--small">
              Erstelle deinen Account
            </p>
          </div>

          {/* Main Card */}
          <IonCard className={`app-auth-card ${error ? 'app-auth-card--error' : ''} ${shakeError ? 'app-auth-card--shaking' : ''}`}
            style={{ transition: 'box-shadow 0.3s ease, border 0.3s ease' }}
          >
            <IonCardContent className="app-auth-card__content--compact">

              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
                  <IonSpinner name="crescent" />
                </div>
              ) : !inviteInfo ? (
                /* Code Eingabe wenn kein gueltiger Code */
                <>
                  <div className="app-auth-card__heading" style={{ marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '1.3rem' }}>Einladungscode eingeben</h2>
                    <p style={{ fontSize: '0.85rem' }}>Du hast einen Code von deiner Gemeinde erhalten</p>
                  </div>

                  <IonItem lines="none" className="app-auth-input">
                    <IonIcon icon={key} slot="start" color="medium" />
                    <IonLabel position="stacked" className="app-auth-input__label">
                      Einladungscode
                    </IonLabel>
                    <IonInput
                      value={manualCode}
                      onIonInput={(e) => setManualCode(e.detail.value!.toUpperCase())}
                      placeholder="z.B. ABC12345"
                      className="app-auth-input__value"
                      style={{ textTransform: 'uppercase', letterSpacing: '2px' }}
                    />
                  </IonItem>

                  {error && (
                    <div className="app-auth-error">
                      <IonIcon icon={alertCircle} className="app-auth-error__icon" />
                      <span className="app-auth-error__text">{error}</span>
                    </div>
                  )}

                  {isNetworkError && (
                    <IonButton
                      expand="full"
                      className="app-auth-retry-button"
                      onClick={() => validateCode(manualCode.trim() || inviteCode)}
                    >
                      <IonIcon icon={refreshOutline} slot="start" />
                      Erneut versuchen
                    </IonButton>
                  )}

                  <IonButton
                    expand="full"
                    onClick={handleManualCodeSubmit}
                    disabled={manualCode.trim().length < 6}
                    className="app-auth-button"
                    style={{ marginBottom: '16px' }}
                  >
                    Code pr\u00fcfen
                  </IonButton>

                  <div className="app-auth-footer">
                    <span
                      onClick={() => history.push('/login')}
                      className="app-auth-link"
                    >
                      <IonIcon icon={arrowBack} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                      Zur\u00fcck zur Anmeldung
                    </span>
                  </div>
                </>
              ) : (
                /* Registrierungsformular */
                <>
                  {/* Einladungs-Info */}
                  <div className="app-auth-invite-info">
                    <IonIcon icon={school} className="app-auth-invite-info__icon" />
                    <div className="app-auth-invite-info__title">
                      {inviteInfo.jahrgang_name}
                    </div>
                    <div className="app-auth-invite-info__subtitle">
                      {inviteInfo.organization_name}
                    </div>
                  </div>

                  {/* Name */}
                  <IonItem lines="none" className="app-auth-input app-auth-input--compact">
                    <IonIcon icon={person} slot="start" color="medium" />
                    <IonLabel position="stacked" className="app-auth-input__label">
                      Dein Name *
                    </IonLabel>
                    <IonInput
                      value={formData.display_name}
                      onIonInput={(e) => setFormData({ ...formData, display_name: e.detail.value! })}
                      placeholder="Vor- und Nachname"
                      disabled={registering}
                      className="app-auth-input__value"
                    />
                  </IonItem>

                  {/* Benutzername */}
                  <IonItem lines="none" className="app-auth-input app-auth-input--compact">
                    <IonIcon icon={person} slot="start" color="medium" />
                    <IonLabel position="stacked" className="app-auth-input__label">
                      Benutzername *
                    </IonLabel>
                    <IonInput
                      value={formData.username}
                      onIonInput={(e) => handleUsernameInput(e.detail.value!)}
                      onIonBlur={handleUsernameBlur}
                      placeholder="z.B. max123"
                      disabled={registering}
                      autocapitalize="off"
                      className="app-auth-input__value"
                    />
                  </IonItem>

                  {/* Username-Verfuegbarkeits-Status */}
                  {usernameStatus === 'checking' && (
                    <div className="app-auth-username-status app-auth-username-status--checking">
                      <IonSpinner name="dots" style={{ width: '16px', height: '16px' }} />
                      <span>Wird gepr\u00fcft...</span>
                    </div>
                  )}
                  {usernameStatus === 'available' && (
                    <div className="app-auth-username-status app-auth-username-status--available">
                      <IonIcon icon={checkmarkCircle} />
                      <span>Benutzername verf\u00fcgbar</span>
                    </div>
                  )}
                  {usernameStatus === 'taken' && (
                    <div className="app-auth-username-status app-auth-username-status--taken">
                      <IonIcon icon={alertCircle} />
                      <span>Benutzername bereits vergeben</span>
                    </div>
                  )}

                  {/* E-Mail (optional) */}
                  <IonItem lines="none" className="app-auth-input app-auth-input--compact">
                    <IonIcon icon={mail} slot="start" color="medium" />
                    <IonLabel position="stacked" className="app-auth-input__label">
                      E-Mail (optional)
                    </IonLabel>
                    <IonInput
                      type="email"
                      value={formData.email}
                      onIonInput={(e) => setFormData({ ...formData, email: e.detail.value! })}
                      placeholder="deine@email.de"
                      disabled={registering}
                      className="app-auth-input__value"
                    />
                  </IonItem>

                  {/* Passwort */}
                  <IonItem lines="none" className="app-auth-input app-auth-input--compact" style={{ marginBottom: '8px' }}>
                    <IonIcon icon={key} slot="start" color="medium" />
                    <IonLabel position="stacked" className="app-auth-input__label">
                      Passwort *
                    </IonLabel>
                    <IonInput
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onIonInput={(e) => setFormData({ ...formData, password: e.detail.value! })}
                      placeholder="Sicheres Passwort"
                      disabled={registering}
                      className="app-auth-input__value"
                    />
                    <IonIcon
                      icon={showPassword ? eyeOff : eye}
                      slot="end"
                      onClick={() => setShowPassword(!showPassword)}
                      className="app-auth-input__toggle"
                    />
                  </IonItem>

                  {/* Passwort-Anforderungen - ausblenden wenn alle erfuellt */}
                  {!isPasswordValid && formData.password.length > 0 && (
                    <div className="app-auth-password-checks">
                      <div className="app-auth-password-checks__grid">
                        <PasswordCheckItem label="Mind. 8 Zeichen" checked={passwordChecks.minLength} />
                        <PasswordCheckItem label="Gro\u00dfbuchstabe" checked={passwordChecks.hasUppercase} />
                        <PasswordCheckItem label="Kleinbuchstabe" checked={passwordChecks.hasLowercase} />
                        <PasswordCheckItem label="Zahl" checked={passwordChecks.hasNumber} />
                        <PasswordCheckItem label="Sonderzeichen" checked={passwordChecks.hasSpecial} />
                      </div>
                    </div>
                  )}

                  {/* Passwort bestaetigen */}
                  <IonItem lines="none" className="app-auth-input" style={{ marginBottom: '16px' }}>
                    <IonIcon icon={key} slot="start" color="medium" />
                    <IonLabel position="stacked" className="app-auth-input__label">
                      Passwort best\u00e4tigen *
                    </IonLabel>
                    <IonInput
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={formData.password_confirm}
                      onIonInput={(e) => setFormData({ ...formData, password_confirm: e.detail.value! })}
                      placeholder="Passwort wiederholen"
                      disabled={registering}
                      className="app-auth-input__value"
                    />
                    <IonIcon
                      icon={showConfirmPassword ? eyeOff : eye}
                      slot="end"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="app-auth-input__toggle"
                    />
                  </IonItem>

                  {/* Passwoerter stimmen nicht ueberein */}
                  {formData.password && formData.password_confirm && formData.password !== formData.password_confirm && (
                    <div className="app-auth-password-match-error">
                      <IonIcon icon={alertCircle} />
                      Passw\u00f6rter stimmen nicht \u00fcberein
                    </div>
                  )}

                  {/* Fehler */}
                  {error && (
                    <div className="app-auth-error">
                      <IonIcon icon={alertCircle} className="app-auth-error__icon" />
                      <span className="app-auth-error__text">{error}</span>
                      <IonIcon
                        icon={closeCircle}
                        onClick={() => { setError(null); setIsNetworkError(false); }}
                        className="app-auth-error__close"
                      />
                    </div>
                  )}

                  {isNetworkError && (
                    <IonButton
                      expand="full"
                      className="app-auth-retry-button"
                      onClick={handleSubmit}
                    >
                      <IonIcon icon={refreshOutline} slot="start" />
                      Erneut versuchen
                    </IonButton>
                  )}

                  <IonButton
                    expand="full"
                    onClick={handleSubmit}
                    disabled={registering || !isPasswordValid || usernameStatus === 'taken'}
                    className="app-auth-button"
                    style={{ marginBottom: '16px' }}
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

                  <div className="app-auth-footer">
                    <span style={{ color: '#7f8c8d', fontSize: '0.9rem' }}>
                      Schon einen Account?{' '}
                      <span
                        onClick={() => history.push('/login')}
                        className="app-auth-link app-auth-link--strong"
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
