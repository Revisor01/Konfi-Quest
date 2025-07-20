import React, { useState } from 'react';
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
import { key, person, trophy, star, sparkles, gameController } from 'ionicons/icons';
import { useApp } from '../../contexts/AppContext';
import { loginWithAutoDetection } from '../../services/auth';

const LoginView: React.FC = () => {
  const { setError, setSuccess, setUser } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      setError('Bitte Benutzername und Passwort eingeben');
      return;
    }

    setLoading(true);
    try {
      const user = await loginWithAutoDetection(username, password);
      setSuccess('Erfolgreich angemeldet');
      // Don't reload, let App.tsx handle the routing based on user type
      setUser(user);
    } catch (err: any) {
      setError('Ungültige Anmeldedaten: ' + (err.response?.data?.error || err.message));
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
              fontSize: '2.5rem',
              fontWeight: '700',
              margin: '0 0 8px 0',
              textShadow: '0 2px 4px rgba(0,0,0,0.3)'
            }}>
              Konfi Quest
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
            boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
            overflow: 'hidden'
          }}>
            <IonCardContent style={{ padding: '32px' }}>
              
              <div style={{
                textAlign: 'center',
                marginBottom: '32px'
              }}>
                <IonIcon 
                  icon={gameController} 
                  style={{
                    fontSize: '3rem',
                    color: '#667eea',
                    marginBottom: '16px'
                  }}
                />
                <h2 style={{
                  fontSize: '1.5rem',
                  fontWeight: '600',
                  margin: '0',
                  color: '#2c3e50'
                }}>
                  Willkommen zurück!
                </h2>
                <p style={{
                  color: '#7f8c8d',
                  margin: '8px 0 0 0',
                  fontSize: '0.9rem'
                }}>
                  Melde dich an um deine Quest fortzusetzen
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
                  placeholder="admin oder dein Konfi-Name"
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
                  type="password"
                  value={password}
                  onIonInput={(e) => setPassword(e.detail.value!)}
                  placeholder="Dein Passwort"
                  style={{ '--color': '#2c3e50' }}
                />
              </IonItem>
              
              <IonButton
                expand="full"
                onClick={handleLogin}
                disabled={loading || !username || !password}
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

              <div style={{
                textAlign: 'center',
                marginTop: '24px',
                fontSize: '0.85rem',
                color: '#95a5a6'
              }}>
                <p style={{ margin: '0' }}>
                  🏆 Sammle Punkte • ⭐ Erreiche Badges • 🎮 Erlebe Abenteuer
                </p>
              </div>
            </IonCardContent>
          </IonCard>

        </div>
      </IonContent>
    </IonPage>
  );
};

export default LoginView;