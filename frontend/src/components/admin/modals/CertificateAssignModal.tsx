import React, { useState } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonIcon,
  IonList,
  IonListHeader,
  IonLabel,
  IonCard,
  IonCardContent,
  IonItem,
  IonRadioGroup,
  IonRadio,
  IonInput,
  IonDatetimeButton,
  IonDatetime,
  IonModal,
  IonSpinner
} from '@ionic/react';
import {
  closeOutline,
  checkmarkOutline,
  ribbonOutline,
  ribbon,
  trophy,
  medal,
  star,
  checkmarkCircle,
  diamond,
  shield,
  flame,
  flash,
  rocket,
  sparkles,
  thumbsUp,
  heart,
  people,
  personAdd,
  chatbubbles,
  gift,
  book,
  school,
  construct,
  brush,
  colorPalette,
  sunny,
  moon,
  leaf,
  rose,
  calendar,
  today,
  time,
  timer,
  stopwatch,
  restaurant,
  fitness,
  bicycle,
  car,
  airplane,
  boat,
  camera,
  image,
  musicalNote,
  balloon,
  home,
  business,
  location,
  navigate,
  compass,
  pin,
  flag,
  informationCircle,
  helpCircle,
  alertCircle,
  hammer
} from 'ionicons/icons';
import api from '../../../services/api';
import { useApp } from '../../../contexts/AppContext';
import { useActionGuard } from '../../../hooks/useActionGuard';

const CERT_ICONS: Record<string, { icon: any; name: string; category: string }> = {
  ribbon: { icon: ribbon, name: 'Band', category: 'Erfolg' },
  trophy: { icon: trophy, name: 'Pokal', category: 'Erfolg' },
  medal: { icon: medal, name: 'Medaille', category: 'Erfolg' },
  star: { icon: star, name: 'Stern', category: 'Erfolg' },
  checkmarkCircle: { icon: checkmarkCircle, name: 'Bestanden', category: 'Erfolg' },
  diamond: { icon: diamond, name: 'Diamant', category: 'Erfolg' },
  shield: { icon: shield, name: 'Schild', category: 'Erfolg' },
  flame: { icon: flame, name: 'Flamme', category: 'Engagement' },
  flash: { icon: flash, name: 'Blitz', category: 'Engagement' },
  rocket: { icon: rocket, name: 'Rakete', category: 'Engagement' },
  sparkles: { icon: sparkles, name: 'Funken', category: 'Engagement' },
  thumbsUp: { icon: thumbsUp, name: 'Daumen hoch', category: 'Engagement' },
  heart: { icon: heart, name: 'Herz', category: 'Gemeinschaft' },
  people: { icon: people, name: 'Gruppe', category: 'Gemeinschaft' },
  personAdd: { icon: personAdd, name: 'Neue Person', category: 'Gemeinschaft' },
  chatbubbles: { icon: chatbubbles, name: 'Chat', category: 'Gemeinschaft' },
  gift: { icon: gift, name: 'Geschenk', category: 'Gemeinschaft' },
  book: { icon: book, name: 'Buch', category: 'Lernen' },
  school: { icon: school, name: 'Schule', category: 'Lernen' },
  construct: { icon: construct, name: 'Werkzeug', category: 'Lernen' },
  brush: { icon: brush, name: 'Pinsel', category: 'Lernen' },
  colorPalette: { icon: colorPalette, name: 'Farbpalette', category: 'Lernen' },
  sunny: { icon: sunny, name: 'Sonne', category: 'Natur' },
  moon: { icon: moon, name: 'Mond', category: 'Natur' },
  leaf: { icon: leaf, name: 'Blatt', category: 'Natur' },
  rose: { icon: rose, name: 'Rose', category: 'Natur' },
  calendar: { icon: calendar, name: 'Kalender', category: 'Zeit' },
  today: { icon: today, name: 'Heute', category: 'Zeit' },
  time: { icon: time, name: 'Uhr', category: 'Zeit' },
  timer: { icon: timer, name: 'Timer', category: 'Zeit' },
  stopwatch: { icon: stopwatch, name: 'Stoppuhr', category: 'Zeit' },
  restaurant: { icon: restaurant, name: 'Restaurant', category: 'Aktivitäten' },
  fitness: { icon: fitness, name: 'Fitness', category: 'Aktivitäten' },
  bicycle: { icon: bicycle, name: 'Fahrrad', category: 'Aktivitäten' },
  car: { icon: car, name: 'Auto', category: 'Aktivitäten' },
  airplane: { icon: airplane, name: 'Flugzeug', category: 'Aktivitäten' },
  boat: { icon: boat, name: 'Boot', category: 'Aktivitäten' },
  camera: { icon: camera, name: 'Kamera', category: 'Aktivitäten' },
  image: { icon: image, name: 'Bild', category: 'Aktivitäten' },
  musicalNote: { icon: musicalNote, name: 'Musik', category: 'Aktivitäten' },
  balloon: { icon: balloon, name: 'Ballon', category: 'Aktivitäten' },
  home: { icon: home, name: 'Zuhause', category: 'Orte' },
  business: { icon: business, name: 'Gebäude', category: 'Orte' },
  location: { icon: location, name: 'Standort', category: 'Orte' },
  navigate: { icon: navigate, name: 'Navigation', category: 'Orte' },
  compass: { icon: compass, name: 'Kompass', category: 'Orte' },
  pin: { icon: pin, name: 'Pin', category: 'Orte' },
  flag: { icon: flag, name: 'Flagge', category: 'Orte' },
  informationCircle: { icon: informationCircle, name: 'Info', category: 'Sonstiges' },
  helpCircle: { icon: helpCircle, name: 'Hilfe', category: 'Sonstiges' },
  alertCircle: { icon: alertCircle, name: 'Warnung', category: 'Sonstiges' },
  hammer: { icon: hammer, name: 'Hammer', category: 'Sonstiges' }
};

interface CertificateAssignModalProps {
  konfiId: number;
  availableTypes: Array<{ id: number; name: string; icon?: string }>;
  onClose: () => void;
  onSuccess: () => void;
}

const CertificateAssignModal: React.FC<CertificateAssignModalProps> = ({
  konfiId,
  availableTypes,
  onClose,
  onSuccess
}) => {
  const { setSuccess, setError } = useApp();
  const { isSubmitting, guard } = useActionGuard();

  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(
    availableTypes.length > 0 ? availableTypes[0].id : null
  );
  const [issuedDate, setIssuedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [durationMonths, setDurationMonths] = useState<string>('');

  const selectedType = availableTypes.find(t => t.id === selectedTypeId);
  const selectedIconKey = selectedType?.icon || '';
  const selectedIconData = CERT_ICONS[selectedIconKey];

  const handleSave = async () => {
    if (!selectedTypeId) {
      setError('Bitte wähle einen Zertifikat-Typ aus');
      return;
    }

    await guard(async () => {
      let expiryDate: string | null = null;
      if (durationMonths && parseInt(durationMonths) > 0) {
        const start = new Date(issuedDate);
        start.setMonth(start.getMonth() + parseInt(durationMonths));
        expiryDate = start.toISOString().split('T')[0];
      }

      try {
        await api.post(`/teamer/${konfiId}/certificates`, {
          certificate_type_id: selectedTypeId,
          issued_date: issuedDate,
          expiry_date: expiryDate
        });
        setSuccess('Zertifikat zugewiesen');
        onSuccess();
      } catch (err: any) {
        setError(err.response?.data?.error || 'Fehler beim Zuweisen');
      }
    });
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={onClose} disabled={isSubmitting}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
          <IonTitle>Zertifikat zuweisen</IonTitle>
          <IonButtons slot="end">
            <IonButton
              onClick={handleSave}
              disabled={!selectedTypeId || isSubmitting}
            >
              {isSubmitting ? (
                <IonSpinner name="crescent" />
              ) : (
                <IonIcon icon={checkmarkOutline} />
              )}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        {/* Sektion 1: Zertifikat-Typ */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--purple">
              <IonIcon icon={ribbonOutline} />
            </div>
            <IonLabel>Zertifikat-Typ</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent>
              <IonRadioGroup
                value={selectedTypeId != null ? String(selectedTypeId) : undefined}
                onIonChange={(e) => setSelectedTypeId(parseInt(e.detail.value))}
              >
                {availableTypes.map((ct) => {
                  const iconData = ct.icon ? CERT_ICONS[ct.icon] : null;
                  return (
                    <IonItem key={ct.id} lines="full" style={{ '--background': 'transparent' }}>
                      {iconData ? (
                        <IonIcon
                          icon={iconData.icon}
                          slot="start"
                          style={{ color: '#5b21b6', fontSize: '1.2rem', marginRight: '8px' }}
                        />
                      ) : (
                        <IonIcon
                          icon={ribbonOutline}
                          slot="start"
                          style={{ color: '#5b21b6', fontSize: '1.2rem', marginRight: '8px' }}
                        />
                      )}
                      <IonLabel>{ct.name}</IonLabel>
                      <IonRadio value={String(ct.id)} />
                    </IonItem>
                  );
                })}
              </IonRadioGroup>

              {/* Vorschau des gewählten Typs */}
              {selectedType && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  marginTop: '8px',
                  backgroundColor: 'rgba(91, 33, 182, 0.08)',
                  borderRadius: '8px'
                }}>
                  <IonIcon
                    icon={selectedIconData?.icon || ribbonOutline}
                    style={{ fontSize: '32px', color: '#5b21b6' }}
                  />
                  <span style={{ fontWeight: '600', fontSize: '1rem', color: '#1f2937' }}>
                    {selectedType.name}
                  </span>
                </div>
              )}
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Sektion 2: Zeitraum */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--purple">
              <IonIcon icon={calendar} />
            </div>
            <IonLabel>Zeitraum</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent>
              <IonItem lines="full" style={{ '--background': 'transparent' }}>
                <IonLabel>Teamer seit</IonLabel>
                <IonDatetimeButton datetime="cert-start-date" />
                <IonModal keepContentsMounted={true}>
                  <IonDatetime
                    id="cert-start-date"
                    presentation="date"
                    value={issuedDate}
                    onIonChange={(e) => {
                      const val = e.detail.value;
                      if (typeof val === 'string') {
                        setIssuedDate(val.split('T')[0]);
                      }
                    }}
                    locale="de-DE"
                  />
                </IonModal>
              </IonItem>
              <IonItem lines="none" style={{ '--background': 'transparent' }}>
                <IonInput
                  label="Laufzeit (Monate)"
                  labelPlacement="stacked"
                  type="number"
                  min={1}
                  placeholder="z.B. 12"
                  value={durationMonths}
                  onIonInput={(e) => setDurationMonths(e.detail.value || '')}
                />
              </IonItem>
            </IonCardContent>
          </IonCard>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default CertificateAssignModal;
