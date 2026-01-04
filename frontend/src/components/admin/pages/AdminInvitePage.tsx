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
  IonSelect,
  IonSelectOption,
  IonButton,
  IonButtons,
  IonIcon,
  IonSpinner,
  IonText
} from '@ionic/react';
import {
  arrowBack,
  qrCodeOutline,
  school,
  refreshOutline,
  copyOutline,
  shareOutline
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import api from '../../../services/api';
import QRCode from 'qrcode';

interface Jahrgang {
  id: number;
  name: string;
}

const AdminInvitePage: React.FC = () => {
  const { pageRef } = useModalPage('admin-invite');
  const { setSuccess, setError } = useApp();
  const [loading, setLoading] = useState(true);
  const [jahrgaenge, setJahrgaenge] = useState<Jahrgang[]>([]);
  const [selectedJahrgang, setSelectedJahrgang] = useState<number | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);

  useEffect(() => {
    loadJahrgaenge();
  }, []);

  const loadJahrgaenge = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/jahrgaenge');
      setJahrgaenge(response.data);
      if (response.data.length > 0) {
        setSelectedJahrgang(response.data[0].id);
      }
    } catch (error: any) {
      setError('Fehler beim Laden der Jahrgänge');
    } finally {
      setLoading(false);
    }
  };

  const generateInviteCode = async () => {
    if (!selectedJahrgang) {
      setError('Bitte wähle einen Jahrgang aus');
      return;
    }

    try {
      setGeneratingCode(true);
      const response = await api.post('/auth/invite-code', {
        jahrgang_id: selectedJahrgang
      });

      const code = response.data.invite_code;
      setInviteCode(code);

      // Generate QR Code
      const registrationUrl = `${window.location.origin}/register?code=${code}`;
      const qrDataUrl = await QRCode.toDataURL(registrationUrl, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
      setQrCodeDataUrl(qrDataUrl);

      setSuccess('Einladungscode generiert');
    } catch (error: any) {
      setError(error.response?.data?.error || 'Fehler beim Generieren des Codes');
    } finally {
      setGeneratingCode(false);
    }
  };

  const copyInviteLink = async () => {
    if (!inviteCode) return;

    const registrationUrl = `${window.location.origin}/register?code=${inviteCode}`;
    try {
      await navigator.clipboard.writeText(registrationUrl);
      setSuccess('Link kopiert');
    } catch (error) {
      setError('Fehler beim Kopieren');
    }
  };

  const shareInvite = async () => {
    if (!inviteCode) return;

    const registrationUrl = `${window.location.origin}/register?code=${inviteCode}`;
    const jahrgangName = jahrgaenge.find(j => j.id === selectedJahrgang)?.name || 'Konfi';

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Konfi Quest - Einladung',
          text: `Registriere dich für ${jahrgangName} bei Konfi Quest!`,
          url: registrationUrl
        });
      } catch (error) {
        // User cancelled share
      }
    } else {
      copyInviteLink();
    }
  };

  return (
    <IonPage ref={pageRef}>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={() => window.history.back()}>
              <IonIcon icon={arrowBack} />
            </IonButton>
          </IonButtons>
          <IonTitle>Konfis einladen</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar style={{ '--background': 'transparent', '--color': 'black' }}>
            <IonTitle size="large" style={{ color: 'black' }}>Konfis einladen</IonTitle>
          </IonToolbar>
        </IonHeader>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
            <IonSpinner name="crescent" />
          </div>
        ) : (
          <>
            {/* Jahrgang Auswahl */}
            <IonList inset={true} style={{ margin: '16px' }}>
              <IonListHeader>
                <div className="app-section-icon app-section-icon--jahrgang">
                  <IonIcon icon={school} />
                </div>
                <IonLabel>Jahrgang auswählen</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent>
                  <IonList style={{ background: 'transparent', padding: '0' }}>
                    <IonItem lines="none" style={{ '--background': 'transparent' }}>
                      <IonLabel position="stacked">Jahrgang *</IonLabel>
                      <IonSelect
                        value={selectedJahrgang}
                        onIonChange={(e) => {
                          setSelectedJahrgang(e.detail.value);
                          setInviteCode(null);
                          setQrCodeDataUrl(null);
                        }}
                        placeholder="Jahrgang wählen"
                        interface="popover"
                      >
                        {jahrgaenge.map((jahrgang) => (
                          <IonSelectOption key={jahrgang.id} value={jahrgang.id}>
                            {jahrgang.name}
                          </IonSelectOption>
                        ))}
                      </IonSelect>
                    </IonItem>
                  </IonList>
                  <IonButton
                    expand="block"
                    onClick={generateInviteCode}
                    disabled={generatingCode || !selectedJahrgang}
                    style={{ marginTop: '16px' }}
                  >
                    {generatingCode ? (
                      <IonSpinner name="crescent" />
                    ) : (
                      <>
                        <IonIcon icon={refreshOutline} slot="start" />
                        {inviteCode ? 'Neuen Code generieren' : 'Einladungscode generieren'}
                      </>
                    )}
                  </IonButton>
                </IonCardContent>
              </IonCard>
            </IonList>

            {/* QR Code Anzeige */}
            {qrCodeDataUrl && inviteCode && (
              <IonList inset={true} style={{ margin: '16px' }}>
                <IonListHeader>
                  <div className="app-section-icon app-section-icon--jahrgang">
                    <IonIcon icon={qrCodeOutline} />
                  </div>
                  <IonLabel>QR-Code</IonLabel>
                </IonListHeader>
                <IonCard className="app-card">
                  <IonCardContent style={{ padding: '24px', textAlign: 'center' }}>
                    <img
                      src={qrCodeDataUrl}
                      alt="QR Code für Registrierung"
                      style={{
                        width: '200px',
                        height: '200px',
                        margin: '0 auto 16px auto',
                        display: 'block',
                        borderRadius: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}
                    />
                    <p style={{
                      fontSize: '0.9rem',
                      color: '#666',
                      margin: '0 0 8px 0'
                    }}>
                      Konfis scannen diesen Code, um sich selbst zu registrieren.
                    </p>
                    <div style={{
                      background: '#f5f5f5',
                      borderRadius: '8px',
                      padding: '12px',
                      marginBottom: '16px'
                    }}>
                      <IonText color="medium">
                        <small>Einladungscode:</small>
                      </IonText>
                      <div style={{
                        fontFamily: 'monospace',
                        fontSize: '1.2rem',
                        fontWeight: '600',
                        color: '#007aff',
                        letterSpacing: '2px'
                      }}>
                        {inviteCode}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <IonButton
                        expand="block"
                        fill="outline"
                        onClick={copyInviteLink}
                        style={{ flex: 1 }}
                      >
                        <IonIcon icon={copyOutline} slot="start" />
                        Link kopieren
                      </IonButton>
                      <IonButton
                        expand="block"
                        onClick={shareInvite}
                        style={{ flex: 1 }}
                      >
                        <IonIcon icon={shareOutline} slot="start" />
                        Teilen
                      </IonButton>
                    </div>
                  </IonCardContent>
                </IonCard>
              </IonList>
            )}

            {/* Info */}
            <IonList inset={true} style={{ margin: '16px' }}>
              <IonCard className="app-card" style={{ background: 'rgba(0, 122, 255, 0.08)', border: '1px solid rgba(0, 122, 255, 0.2)' }}>
                <IonCardContent style={{ padding: '16px' }}>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#007aff', lineHeight: '1.5' }}>
                    Einladungscodes sind 7 Tage gültig. Konfis können sich mit dem Code selbst einen Account erstellen und werden automatisch dem gewählten Jahrgang zugeordnet.
                  </p>
                </IonCardContent>
              </IonCard>
            </IonList>
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default AdminInvitePage;
