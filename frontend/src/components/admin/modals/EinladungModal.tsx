import React, { useEffect, useState } from 'react';
import {
  IonButton, IonButtons, IonCard, IonCardContent, IonContent, IonHeader, IonIcon,
  IonInput, IonItem, IonLabel, IonList, IonListHeader, IonNote, IonPage,
  IonTitle, IonToolbar
} from '@ionic/react';
import api from '../../../services/api';
import { useApp } from '../../../contexts/AppContext';
import { useActionGuard } from '../../../hooks/useActionGuard';
import { fehlerText } from '../../../utils/fehler';
import { ICON_SCHLIESSEN, ICON_GEMEINDE_GEFUELLT, ICON_PERSON, ICON_SCHILD } from '../../shared/icons';
import { tastaturKlick } from '../../../utils/tastatur';

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

  // Wort fuer Wort dieselben Texte und Farben wie beim Anlegen einer
  // Benutzer:in (Simon, 26.09.2026: "soll es genau so aussehen, wie es in
  // 'Neue Benutzerin hinzufuegen' aussieht, damit die Leute wissen, was die
  // Rolle ist"). Zwei Dialoge, die dieselbe Entscheidung verlangen, muessen
  // sie gleich erklaeren -- sonst heisst dieselbe Rolle hier anders als dort.
  const rolleToken = (name: string) =>
    name === 'teamer' ? 'teamer' : (name === 'org_admin' || name === 'admin') ? 'users' : 'neutral';
  const rolleFarbe = (name: string) => `var(--app-color-${rolleToken(name)})`;
  const rolleTint = (name: string) => `rgba(var(--app-color-${rolleToken(name)}-rgb), 0.08)`;
  const rolleName = (name: string) =>
    name === 'org_admin' ? 'Org-Admin' : name === 'admin' ? 'Admin' : name === 'teamer' ? 'Teamer:in' : name;
  const rolleBeschreibung = (name: string) => {
    switch (name) {
      case 'org_admin': return 'Voller Zugriff auf Konfis, Aktivitäten, Badges und Events – über alle Jahrgänge. Verwaltet zusätzlich die Benutzer:innen und deren Jahrgangs-Zuordnung.';
      case 'admin': return 'Voller Zugriff auf Konfis, Aktivitäten, Badges und Events – nur für die zugewiesenen Jahrgänge.';
      case 'teamer': return 'Eigenes Dashboard mit eigenen Badges, Team-Material und Team-Chat. Kann sich zu Events anmelden, bei denen das Team gebraucht wird. Vergibt keine Punkte und genehmigt keine Aktivitäten.';
      default: return '';
    }
  };

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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--app-abstand-eng)' }}>
                {rollen.map((r) => {
                  const gewaehlt = rolleId === r.id;
                  return (
                    <div role="button" tabIndex={0} onKeyDown={tastaturKlick}
                      key={r.id}
                      className="app-list-item"
                      onClick={() => !isSubmitting && setRolleId(r.id)}
                      style={{
                        cursor: isSubmitting ? 'default' : 'pointer',
                        opacity: isSubmitting ? 0.6 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '0',
                        borderLeftColor: rolleFarbe(r.name),
                        background: gewaehlt ? rolleTint(r.name) : undefined
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--app-abstand-mittel)' }}>
                        <div className="app-icon-circle" style={{ backgroundColor: rolleFarbe(r.name), width: '32px', height: '32px' }}>
                          <IonIcon icon={ICON_SCHILD} style={{ fontSize: 'var(--app-text-basis)' }} />
                        </div>
                        <div>
                          <span style={{ fontWeight: 'var(--app-schrift-mittel)', color: 'var(--app-text-primary)', display: 'block' }}>
                            {rolleName(r.name)}
                          </span>
                          {rolleBeschreibung(r.name) && (
                            <span style={{ fontSize: 'var(--app-text-klein)', color: 'var(--app-text-system)', display: 'block', marginTop: 'var(--app-abstand-winzig)', lineHeight: 1.35 }}>
                              {rolleBeschreibung(r.name)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
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
