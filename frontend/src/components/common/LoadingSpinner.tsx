import React from 'react';
import {
  IonPage,
  IonContent,
  IonSpinner,
  IonIcon
} from '@ionic/react';
import { trophy, star, sparkles } from 'ionicons/icons';

interface LoadingSpinnerProps {
  fullScreen?: boolean;
  message?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  fullScreen = false, 
  message = 'Quest wird geladen...' 
}) => {
  if (fullScreen) {
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
            height: '100vh',
            color: 'white',
            textAlign: 'center'
          }}>
            
            {/* Animated Icons */}
            <div style={{
              fontSize: '3rem',
              marginBottom: '24px',
              display: 'flex',
              gap: '16px',
              justifyContent: 'center'
            }}>
              <IonIcon 
                icon={trophy} 
                style={{ 
                  color: '#FFD700',
                  animation: 'bounce 2s infinite 0s'
                }} 
              />
              <IonIcon 
                icon={star} 
                style={{ 
                  color: '#FF6B6B',
                  animation: 'bounce 2s infinite 0.5s'
                }} 
              />
              <IonIcon 
                icon={sparkles} 
                style={{ 
                  color: '#4ECDC4',
                  animation: 'bounce 2s infinite 1s'
                }} 
              />
            </div>

            {/* App Title */}
            <h1 style={{
              fontSize: '2rem',
              fontWeight: '700',
              margin: '0 0 16px 0',
              textShadow: '0 2px 4px rgba(0,0,0,0.3)'
            }}>
              Konfi Quest
            </h1>

            {/* Loading Message */}
            <p style={{
              fontSize: '1.1rem',
              opacity: 0.9,
              margin: '0 0 32px 0',
              textShadow: '0 1px 2px rgba(0,0,0,0.3)'
            }}>
              {message}
            </p>

            {/* Spinner */}
            <IonSpinner 
              name="crescent" 
              style={{ 
                '--color': 'white',
                transform: 'scale(1.5)'
              }} 
            />

            {/* Progress Dots */}
            <div style={{
              display: 'flex',
              gap: '8px',
              marginTop: '32px'
            }}>
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255,255,255,0.6)',
                    animation: `pulse 1.5s infinite ${i * 0.2}s`
                  }}
                />
              ))}
            </div>
          </div>

          <style>{`
            @keyframes bounce {
              0%, 20%, 50%, 80%, 100% {
                transform: translateY(0);
              }
              40% {
                transform: translateY(-10px);
              }
              60% {
                transform: translateY(-5px);
              }
            }

            @keyframes pulse {
              0%, 100% {
                opacity: 0.4;
                transform: scale(1);
              }
              50% {
                opacity: 1;
                transform: scale(1.2);
              }
            }
          `}</style>
        </IonContent>
      </IonPage>
    );
  }

  // Inline loading spinner
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '20px'
    }}>
      <IonSpinner name="crescent" color="primary" />
      {message && (
        <p style={{
          marginTop: '16px',
          color: 'var(--ion-color-medium)',
          textAlign: 'center'
        }}>
          {message}
        </p>
      )}
    </div>
  );
};

export default LoadingSpinner;