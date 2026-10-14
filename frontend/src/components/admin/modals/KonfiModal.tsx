import React from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonButtons,
  IonItem,
  IonLabel,
  IonInput,
  IonList,
  IonListHeader,
  IonIcon,
  IonCard,
  IonCardContent,
  IonSpinner
} from '@ionic/react';
import {
  ICON_HAKEN,
  ICON_HAKEN_GEFUELLT,
  ICON_INFO,
  ICON_JAHRGANG,
  ICON_OFFLINE,
  ICON_PERSON,
  ICON_SCHLIESSEN,
  ICON_WARNUNG,
} from '../../shared/icons';
import { useApp } from '../../../contexts/AppContext';
import type { KonfiFormDaten } from '../../../types/user';
import { tastaturKlick } from '../../../utils/tastatur';
import {
  ANLEGEN_HINWEIS,
  BEARBEITEN_HINWEIS,
  WECHSEL_BLEIBT,
  WECHSEL_FOLGEN,
  useKonfiFormular,
  type KonfiJahrgang,
  type KonfiZumBearbeiten,
} from '../useKonfiFormular';

// Felder, Prüfung, Kennung und die Warnungen beim Jahrgangswechsel stehen in
// useKonfiFormular -- dieselbe Logik wie im Dialog der Web-Fassung
// (web/leitung/WebKonfiDialog).

interface KonfiModalProps {
  jahrgaenge: KonfiJahrgang[];
  onClose: () => void;
  onSave: (konfiData: KonfiFormDaten) => void;
  dismiss?: () => void;
  /**
   * Gesetzt = BEARBEITEN, nicht gesetzt = ANLEGEN.
   *
   * Das Modal kann beides, statt zweimal fast dasselbe zu sein: Die Felder,
   * die Jahrgangs-Auswahl und die Prueflogik sind identisch, nur Ueberschrift,
   * Hinweis und die Warnungen unterscheiden sich. Zwei Dateien waeren genau
   * die Kopie, die in diesem Projekt regelmaessig auseinanderlaeuft.
   */
  konfi?: KonfiZumBearbeiten;
  /** Jahrgaenge, denen die angemeldete Person zugewiesen ist (nur `admin`). */
  eigeneJahrgangIds?: number[];
}

const KonfiModal: React.FC<KonfiModalProps> = ({ jahrgaenge, onClose, onSave, dismiss, konfi, eigeneJahrgangIds }) => {
  const { isOnline } = useApp();
  const {
    bearbeiten, name, setName, jahrgangId, setJahrgangId, isSubmitting, guard, isValid, daten,
    wechselt, wechselAchtung,
  } = useKonfiFormular({ jahrgaenge, konfi, eigeneJahrgangIds });

  const handleClose = () => {
    if (dismiss) {
      dismiss();
    } else {
      onClose();
    }
  };

  const handleSave = async () => {
    if (!isValid) return;

    await guard(async () => {
      await onSave(daten());
    });
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{bearbeiten ? 'Konfi bearbeiten' : 'Konfi erstellen'}</IonTitle>
          <IonButtons slot="start">
            <IonButton aria-label="Schließen" onClick={handleClose} disabled={isSubmitting} className="app-modal-close-btn">
              <IonIcon icon={ICON_SCHLIESSEN} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton aria-label={bearbeiten ? "Änderungen speichern" : "Konfi speichern"} onClick={handleSave} disabled={!isValid || isSubmitting || !isOnline} className="app-modal-submit-btn app-modal-submit-btn--konfi">
              {!isOnline ? <><IonIcon icon={ICON_OFFLINE} /> Du bist offline</> : isSubmitting ? <IonSpinner name="crescent" /> : <IonIcon icon={ICON_HAKEN} />}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        {/* Name Sektion - iOS26 Pattern */}
        <IonList inset={true} className="app-modal-section">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--purple">
              <IonIcon icon={ICON_PERSON} />
            </div>
            <IonLabel>Konfi Daten</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: 'var(--app-abstand-basis)' }}>
              <IonList style={{ background: 'transparent' }}>
                <IonItem lines="none" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">Name *</IonLabel>
                  <IonInput aria-label="Name" aria-required="true"
                    value={name}
                    onIonInput={(e) => setName(e.detail.value!)}
                    placeholder="Vor- und Nachname"
                    disabled={isSubmitting}
                    clearInput={true}
                  />
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Jahrgang - als antippbare Liste wie beim Anlegen von Teamer:innen.
            Anders als dort ist es eine EINFACH-Auswahl: Ein Konfi gehoert zu
            genau einem Jahrgang (jahrgang_id). */}
        <IonList inset={true} className="app-modal-section">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--purple">
              <IonIcon icon={ICON_JAHRGANG} />
            </div>
            <IonLabel>Jahrgang *</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: 'var(--app-abstand-basis)' }}>
              {jahrgaenge.length === 0 ? (
                <IonItem lines="none" style={{ '--background': 'transparent' }}>
                  <IonLabel style={{ textAlign: 'center' }}>
                    <p style={{ color: 'var(--app-text-muted)', margin: 0 }}>Keine Jahrgänge verfügbar</p>
                  </IonLabel>
                </IonItem>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {jahrgaenge.map((jg, index) => {
                    const isSelected = jahrgangId === jg.id;

                    return (
                      <div role="button" tabIndex={0} onKeyDown={tastaturKlick} aria-pressed={isSelected}
                        key={jg.id}
                        className={`app-list-item app-list-item--purple${isSelected ? ' app-list-item--selected' : ''}`}
                        onClick={() => !isSubmitting && setJahrgangId(jg.id)}
                        style={{
                          cursor: isSubmitting ? 'default' : 'pointer',
                          opacity: isSubmitting ? 0.6 : 1,
                          position: 'relative',
                          overflow: 'hidden',
                          marginBottom: index < jahrgaenge.length - 1 ? 'var(--app-abstand-eng)' : '0'
                        }}
                      >
                        {isSelected && (
                          <div className="app-corner-badges">
                            <div
                              className="app-corner-badge"
                              style={{ backgroundColor: 'var(--app-color-konfis)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--app-abstand-mini) var(--app-abstand-eng)' }}
                              title="Ausgewählt"
                              role="img"
                              aria-label="Ausgewählt"
                            >
                              <IonIcon icon={ICON_HAKEN_GEFUELLT} style={{ color: 'white', fontSize: 'var(--app-text-sekundaer)' }} />
                            </div>
                          </div>
                        )}
                        <div className="app-list-item__row">
                          <div className="app-list-item__main">
                            <div className="app-list-item__content">
                              <div className="app-list-item__title" style={{ paddingRight: isSelected ? 'var(--app-abstand-riesig)' : '0' }}>{jg.name}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Was ein Jahrgangswechsel ausloest. Erscheint nur, wenn wirklich
            gewechselt wird — beim Anlegen und beim reinen Namensfix nicht. */}
        {wechselt && (
          <IonList inset={true} className="app-modal-section">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--purple">
                <IonIcon icon={ICON_WARNUNG} />
              </div>
              <IonLabel>Was der Wechsel bewirkt</IonLabel>
            </IonListHeader>
            <IonCard className="app-card" style={{ background: 'rgba(var(--app-color-teamer-rgb), 0.08)', border: '1px solid rgba(var(--app-color-teamer-rgb), 0.2)' }}>
              <IonCardContent style={{ padding: 'var(--app-abstand-basis)' }}>
                <p style={{ margin: '0 0 var(--app-abstand-schmal)', fontSize: 'var(--app-text-basis)', lineHeight: '1.5' }}>
                  Es gelten die Regeln des neuen Jahrgangs:
                </p>
                <ul style={{ margin: 0, paddingLeft: 'var(--app-abstand-gross)', fontSize: 'var(--app-text-basis)', lineHeight: '1.6' }}>
                  {WECHSEL_FOLGEN.map((folge) => <li key={folge}>{folge}</li>)}
                </ul>
                <p style={{ margin: 'var(--app-abstand-schmal) 0 0', fontSize: 'var(--app-text-sekundaer)', lineHeight: '1.5', opacity: 0.85 }}>
                  {WECHSEL_BLEIBT}
                </p>

                {/* Punktearten abgeschaltet, eigene Zuweisung fehlt (useKonfiFormular). */}
                {wechselAchtung.map((satz) => (
                  <p key={satz} style={{ margin: 'var(--app-abstand-mittel) 0 0', fontSize: 'var(--app-text-basis)', lineHeight: '1.5', fontWeight: 'var(--app-schrift-halbfett)'}}>
                    {satz}
                  </p>
                ))}
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* Hinweis Sektion - iOS26 Pattern in Lila */}
        {!bearbeiten && (
          <IonList inset={true} className="app-modal-section">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--purple">
                <IonIcon icon={ICON_INFO} />
              </div>
              <IonLabel>Hinweis</IonLabel>
            </IonListHeader>
            <IonCard className="app-card" style={{ background: 'rgba(var(--app-color-konfis-rgb), 0.08)', border: '1px solid rgba(var(--app-color-konfis-rgb), 0.2)' }}>
              <IonCardContent style={{ padding: 'var(--app-abstand-basis)' }}>
                <p style={{ margin: 0, fontSize: 'var(--app-text-basis)', lineHeight: '1.5', color: 'var(--app-text-konfis)' }}>
                  {/* Das Passwort wird gehasht gespeichert und nur im Dialog
                      nach dem Anlegen gezeigt; die Detailansicht kann nur ein
                      neues erzeugen (Audit Screens Leitung BF-05). */}
                  {ANLEGEN_HINWEIS}
                </p>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* Beim Bearbeiten: Der Benutzername bleibt, was er ist. Das Backend
            generiert ihn bewusst NICHT neu — das ueberschrieb frueher still
            selbstgewaehlte Namen aus der Registrierung. */}
        {bearbeiten && (
          <IonList inset={true} className="app-modal-section">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--purple">
                <IonIcon icon={ICON_INFO} />
              </div>
              <IonLabel>Hinweis</IonLabel>
            </IonListHeader>
            <IonCard className="app-card" style={{ background: 'rgba(var(--app-color-konfis-rgb), 0.08)', border: '1px solid rgba(var(--app-color-konfis-rgb), 0.2)' }}>
              <IonCardContent style={{ padding: 'var(--app-abstand-basis)' }}>
                <p style={{ margin: 0, fontSize: 'var(--app-text-basis)', lineHeight: '1.5', color: 'var(--app-text-konfis)' }}>
                  {BEARBEITEN_HINWEIS}
                </p>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}
      </IonContent>
    </IonPage>
  );
};

export default KonfiModal;