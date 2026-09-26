import React, { useEffect, useState } from 'react';
import {
  IonButton, IonButtons, IonCard, IonCardContent, IonContent, IonHeader, IonIcon,
  IonInput, IonItem, IonLabel, IonList, IonListHeader, IonNote, IonPage,
  IonSelect, IonSelectOption, IonTitle, IonToolbar
} from '@ionic/react';
import api from '../../../services/api';
import { useApp } from '../../../contexts/AppContext';
import { useActionGuard } from '../../../hooks/useActionGuard';
import { fehlerText } from '../../../utils/fehler';
import { ICON_SCHLIESSEN, ICON_GEMEINDE_GEFUELLT, ICON_PERSON } from '../../shared/icons';

/**
 * Eine bestehende Person in diese Gemeinde einladen (26.09.2026).
 *
 * SIMONS ENTWURF: "Der ORG Admin kennt den User Namen des anderen. Gibt das in
 * der Benutzer Oberflaeche ein. Der User bekommt ne Einladung und bestaetigt."
 *
 * KEINE SUCHLISTE: Gesucht wird exakt nach Benutzername oder E-Mail. Ein
 * Suchfeld ueber den ganzen Bestand haette jeder Gemeindeleitung erlaubt, die
 * Nutzenden aller anderen Gemeinden zu durchblaettern.
 *
 * KONFI STEHT NICHT ZUR WAHL (Simon: "Konfi ist nie moeglich. Ist logisch.")
 * -- Konfis gehoeren zu einem Jahrgang und kommen ueber einen Einladungscode.
 * Der Server weist die Rolle zusaetzlich ab.
 */

interface Rolle {
  id: number;
  name: string;
  display_name: string;
}

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

const EinladungModal: React.FC<Props> = ({ onClose, onSuccess }) => {
  const { setError, setSuccess, isOnline } = useApp();
  const { isSubmitting, guard } = useActionGuard();
  const [kennung, setKennung] = useState('');
  const [rolleId, setRolleId] = useState<number | null>(null);
  const [rollen, setRollen] = useState<Rolle[]>([]);

  useEffect(() => {
    let abgemeldet = false;
    api.get('/roles')
      .then((res) => {
        if (abgemeldet) return;
        const alle: Rolle[] = Array.isArray(res.data) ? res.data : [];
        // Konfi faellt raus -- siehe Kopfkommentar.
        setRollen(alle.filter((r) => r.name !== 'konfi' && r.name !== 'super_admin'));
      })
      .catch(() => { if (!abgemeldet) setRollen([]); });
    return () => { abgemeldet = true; };
  }, []);

  const istGueltig = kennung.trim().length > 0 && rolleId !== null;

  const einladen = () => guard(async () => {
    if (!istGueltig) return;
    try {
      const res = await api.post('/einladungen', { kennung: kennung.trim(), role_id: rolleId });
      setSuccess(`${res.data.display_name} wurde eingeladen und entscheidet jetzt selbst.`);
      onSuccess();
    } catch (err) {
      setError(fehlerText(err, 'Die Einladung konnte nicht gesendet werden'));
    }
  });

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Einladen</IonTitle>
          <IonButtons slot="start">
            <IonButton onClick={onClose} aria-label="Schließen">
              <IonIcon icon={ICON_SCHLIESSEN} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton
              aria-label="Einladung senden"
              onClick={einladen}
              disabled={!istGueltig || isSubmitting || !isOnline}
              className="app-modal-submit-btn app-modal-submit-btn--settings"
            >
              Senden
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background" fullscreen>
        <IonList inset={true} className="app-segment-wrapper">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--users">
              <IonIcon icon={ICON_PERSON} />
            </div>
            <IonLabel>Wen einladen?</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent>
              <IonItem lines="none" className="app-dashboard-settings-item">
                <IonInput
                  label="Benutzername oder E-Mail"
                  labelPlacement="stacked"
                  placeholder="z. B. anna.beispiel"
                  autocapitalize="off"
                  value={kennung}
                  onIonInput={(e) => setKennung(e.detail.value || '')}
                />
              </IonItem>
              <IonNote className="app-hinweis-text">
                Die Person braucht bereits ein Konto. Sie behält Benutzername und
                Passwort und entscheidet selbst, ob sie die Einladung annimmt.
              </IonNote>
            </IonCardContent>
          </IonCard>
        </IonList>

        <IonList inset={true} className="app-segment-wrapper">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--users">
              <IonIcon icon={ICON_GEMEINDE_GEFUELLT} />
            </div>
            <IonLabel>Welche Rolle?</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent>
              <IonItem lines="none" className="app-dashboard-settings-item">
                <IonSelect
                  label="Rolle in dieser Gemeinde"
                  labelPlacement="stacked"
                  placeholder="Rolle wählen"
                  value={rolleId}
                  onIonChange={(e) => setRolleId(e.detail.value)}
                >
                  {rollen.map((r) => (
                    <IonSelectOption key={r.id} value={r.id}>
                      {r.display_name || r.name}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
              <IonNote className="app-hinweis-text">
                Die Rolle gilt nur in dieser Gemeinde. In ihrer eigenen Gemeinde
                bleibt alles, wie es ist. Konfis werden über einen
                Einladungscode aufgenommen, nicht über eine Einladung.
              </IonNote>
            </IonCardContent>
          </IonCard>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default EinladungModal;
