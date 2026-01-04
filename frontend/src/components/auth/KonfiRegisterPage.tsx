import React, { useState, useEffect } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonListHeader,
  IonCard,
  IonCardContent,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonIcon,
  IonSpinner,
  IonText
} from '@ionic/react';
import {
  personOutline,
  keyOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  schoolOutline,
  businessOutline
} from 'ionicons/icons';
import { useLocation, useHistory } from 'react-router-dom';
import api from '../../services/api';

const KonfiRegisterPage: React.FC = () => {
  const location = useLocation();
  const history = useHistory();

  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [inviteCode, setInviteCode] = useState<string>('');
  const [inviteInfo, setInviteInfo] = useState<{
    jahrgang_name: string;
    organization_name: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    display_name: '',
    username: '',
    password: '',
    password_confirm: ''
  });

  useEffect(() => {
    // Get code from URL parameter
    const params = new URLSearchParams(location.search);
    const code = params.get('code');

    if (code) {
      setInviteCode(code);
      validateCode(code);
    } else {
      setValidating(false);
      setLoading(false);
      setError('Kein Einladungscode angegeben');
    }
  }, [location]);

  const validateCode = async (code: string) => {
    try {
      setValidating(true);
      const response = await api.get(`/auth/validate-invite/${code}`);
      setInviteInfo({
        jahrgang_name: response.data.jahrgang_name,
        organization_name: response.data.organization_name
      });
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ungültiger Einladungscode');
      setInviteInfo(null);
    } finally {
      setValidating(false);
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.display_name.trim()) {
      setError('Bitte gib deinen Namen ein');
      return;
    }
    if (formData.username.length < 3) {
      setError('Benutzername muss mindestens 3 Zeichen lang sein');
      return;
    }
    if (formData.password.length < 6) {
      setError('Passwort muss mindestens 6 Zeichen lang sein');
      return;
    }
    if (formData.password !== formData.password_confirm) {
      setError('Passwörter stimmen nicht überein');
      return;
    }

    try {
      setRegistering(true);
      setError(null);

      await api.post('/auth/register-konfi', {
        invite_code: inviteCode,
        display_name: formData.display_name.trim(),
        username: formData.username.toLowerCase().trim(),
        password: formData.password
      });

      setSuccess(true);

      // Redirect to login after 3 seconds
      setTimeout(() => {
        history.push('/login');
      }, 3000);

    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler bei der Registrierung');
    } finally {
      setRegistering(false);
    }
  };

  if (loading) {
    return (
      <IonPage>
        <IonContent className="app-gradient-background">
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <IonSpinner name="crescent" />
          </div>
        </IonContent>
      </IonPage>
    );
  }

  if (success) {
    return (
      <IonPage>
        <IonContent className="app-gradient-background">
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            padding: '24px',
            textAlign: 'center'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #34c759 0%, #30d158 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '24px',
              boxShadow: '0 8px 24px rgba(52, 199, 89, 0.3)'
            }}>
              <IonIcon icon={checkmarkCircleOutline} style={{ fontSize: '3rem', color: 'white' }} />
            </div>
            <h1 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', fontWeight: '600', color: '#333' }}>
              Registrierung erfolgreich!
            </h1>
            <p style={{ margin: '0 0 24px 0', color: '#666' }}>
              Du wirst gleich zur Anmeldung weitergeleitet...
            </p>
            <IonSpinner name="dots" color="primary" />
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Registrierung</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar style={{ '--background': 'transparent', '--color': 'black' }}>
            <IonTitle size="large" style={{ color: 'black' }}>Registrierung</IonTitle>
          </IonToolbar>
        </IonHeader>

        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #007aff 0%, #5856d6 100%)',
          borderRadius: '24px',
          padding: '24px',
          margin: '16px',
          color: 'white',
          textAlign: 'center'
        }}>
          <IonIcon icon={schoolOutline} style={{ fontSize: '3rem', marginBottom: '12px' }} />
          <h2 style={{ margin: '0 0 8px 0', fontSize: '1.3rem', fontWeight: '600' }}>
            Willkommen bei Konfi Quest!
          </h2>
          <p style={{ margin: 0, opacity: 0.9, fontSize: '0.9rem' }}>
            Erstelle deinen Account, um loszulegen
          </p>
        </div>

        {/* Error Message */}
        {error && !inviteInfo && (
          <IonList inset={true} style={{ margin: '16px' }}>
            <IonCard className="app-card" style={{ background: 'rgba(220, 53, 69, 0.1)', border: '1px solid rgba(220, 53, 69, 0.3)' }}>
              <IonCardContent style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <IonIcon icon={alertCircleOutline} style={{ fontSize: '1.5rem', color: '#dc3545' }} />
                <IonText color="danger">
                  <p style={{ margin: 0 }}>{error}</p>
                </IonText>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* Invite Info */}
        {inviteInfo && (
          <>
            <IonList inset={true} style={{ margin: '16px' }}>
              <IonListHeader>
                <div className="app-section-icon app-section-icon--jahrgang">
                  <IonIcon icon={businessOutline} />
                </div>
                <IonLabel>Einladung für</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="app-icon-circle app-icon-circle--lg app-icon-circle--jahrgang">
                      <IonIcon icon={schoolOutline} />
                    </div>
                    <div>
                      <h3 style={{ margin: '0 0 4px 0', fontWeight: '600', color: '#333' }}>
                        {inviteInfo.jahrgang_name}
                      </h3>
                      <p style={{ margin: 0, color: '#666', fontSize: '0.85rem' }}>
                        {inviteInfo.organization_name}
                      </p>
                    </div>
                  </div>
                </IonCardContent>
              </IonCard>
            </IonList>

            {/* Registration Form */}
            <IonList inset={true} style={{ margin: '16px' }}>
              <IonListHeader>
                <div className="app-section-icon app-section-icon--primary">
                  <IonIcon icon={personOutline} />
                </div>
                <IonLabel>Deine Daten</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent>
                  <IonList style={{ background: 'transparent', padding: '0' }}>
                    <IonItem lines="full" style={{ '--background': 'transparent' }}>
                      <IonLabel position="stacked">Name *</IonLabel>
                      <IonInput
                        value={formData.display_name}
                        onIonInput={(e) => setFormData({ ...formData, display_name: e.detail.value! })}
                        placeholder="Dein vollständiger Name"
                        disabled={registering}
                      />
                    </IonItem>
                    <IonItem lines="full" style={{ '--background': 'transparent' }}>
                      <IonLabel position="stacked">Benutzername *</IonLabel>
                      <IonInput
                        value={formData.username}
                        onIonInput={(e) => setFormData({ ...formData, username: e.detail.value! })}
                        placeholder="z.B. max123"
                        disabled={registering}
                        autocapitalize="off"
                      />
                    </IonItem>
                    <IonItem lines="full" style={{ '--background': 'transparent' }}>
                      <IonLabel position="stacked">Passwort *</IonLabel>
                      <IonInput
                        type="password"
                        value={formData.password}
                        onIonInput={(e) => setFormData({ ...formData, password: e.detail.value! })}
                        placeholder="Mindestens 6 Zeichen"
                        disabled={registering}
                      />
                    </IonItem>
                    <IonItem lines="none" style={{ '--background': 'transparent' }}>
                      <IonLabel position="stacked">Passwort bestätigen *</IonLabel>
                      <IonInput
                        type="password"
                        value={formData.password_confirm}
                        onIonInput={(e) => setFormData({ ...formData, password_confirm: e.detail.value! })}
                        placeholder="Passwort wiederholen"
                        disabled={registering}
                      />
                    </IonItem>
                  </IonList>

                  {/* Form Error */}
                  {error && inviteInfo && (
                    <div style={{
                      background: 'rgba(220, 53, 69, 0.1)',
                      border: '1px solid rgba(220, 53, 69, 0.3)',
                      borderRadius: '8px',
                      padding: '12px',
                      marginTop: '16px'
                    }}>
                      <IonText color="danger">
                        <p style={{ margin: 0, fontSize: '0.9rem' }}>{error}</p>
                      </IonText>
                    </div>
                  )}

                  <IonButton
                    expand="block"
                    onClick={handleSubmit}
                    disabled={registering}
                    style={{ marginTop: '16px' }}
                  >
                    {registering ? (
                      <IonSpinner name="crescent" />
                    ) : (
                      'Registrieren'
                    )}
                  </IonButton>
                </IonCardContent>
              </IonCard>
            </IonList>

            {/* Already have account */}
            <div style={{ textAlign: 'center', padding: '16px' }}>
              <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
                Schon einen Account?{' '}
                <span
                  onClick={() => history.push('/login')}
                  style={{ color: '#007aff', cursor: 'pointer', fontWeight: '500' }}
                >
                  Anmelden
                </span>
              </p>
            </div>
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default KonfiRegisterPage;
