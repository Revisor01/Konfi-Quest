import React from 'react';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonIcon,
  IonPage,
  IonSpinner,
  IonCard,
  IonCardContent,
  IonList,
  IonListHeader,
  IonAccordion,
  IonAccordionGroup,
  IonRange
} from '@ionic/react';
import { ICON_AUFKLAPPEN, ICON_BEARBEITEN_GEFUELLT, ICON_HAKEN, ICON_SCHLIESSEN } from '../../shared/icons';
import { ICON_CHOICES as LEVEL_ICONS, getIconFromString } from '../../../utils/badgeIcons';
import { tastaturKlick } from '../../../utils/tastatur';
import { useLevelFormular, type LevelFormularDaten } from '../useLevelFormular';

// Laden, Pruefen und Speichern stehen in useLevelFormular (11.10.2026) --
// dieselbe Logik wie im Dialog der Web-Fassung (web/leitung/WebLevelDialog).

interface LevelManagementModalProps {
  level?: LevelFormularDaten;
  onClose: () => void;
  onSuccess: () => void;
  dismiss?: () => void;
}

const LevelManagementModal: React.FC<LevelManagementModalProps> = ({ level, onClose, onSuccess, dismiss }) => {
  const handleClose = () => {
    if (dismiss) {
      dismiss();
    } else {
      onClose();
    }
  };
  const { formData, aendern, loading, isSubmitting, isFormValid, speichern: handleSubmit } = useLevelFormular(level, {
    onFertig: () => {
      onSuccess();
      handleClose();
    },
  });

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{level ? 'Level bearbeiten' : 'Neues Level'}</IonTitle>
          <IonButtons slot="start">
            <IonButton aria-label="Schließen"
              onClick={handleClose}
              disabled={loading}
              className="app-modal-close-btn"
            >
              <IonIcon icon={ICON_SCHLIESSEN} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton aria-label="Level speichern"
              onClick={handleSubmit}
              disabled={!isFormValid || loading || isSubmitting}
              className="app-modal-submit-btn app-modal-submit-btn--level"
            >
              {loading ? (
                <IonSpinner name="crescent" />
              ) : (
                <IonIcon icon={ICON_HAKEN} />
              )}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        {/* SEKTION: Grunddaten */}
        <IonList inset={true} className="app-modal-section">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--level">
              <IonIcon icon={ICON_BEARBEITEN_GEFUELLT} />
            </div>
            <IonLabel>Level Details</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent>
              <IonList style={{ background: 'transparent', padding: '0' }}>
                <IonItem lines="full" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">Titel *</IonLabel>
                  <IonInput aria-label="Titel" aria-required="true"
                    value={formData.title}
                    onIonInput={(e) => aendern({ title: e.detail.value! })}
                    placeholder="z.B. Anfänger, Bronze, Meister"
                    disabled={loading}
                    clearInput={true}
                  />
                </IonItem>

                <IonItem lines="full" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked" style={{ marginBottom: 'var(--app-abstand-eng)' }}>Benötigte Punkte * <span style={{ fontWeight: 'var(--app-schrift-fett)', color: 'var(--ion-color-primary)' }}>{formData.points_required}</span></IonLabel>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--app-abstand-eng)', width: '100%' }}>
                    <span style={{ fontSize: 'var(--app-text-klein)', color: 'var(--app-text-system)', minWidth: '24px', textAlign: 'center' }}>1</span>
                    <IonRange aria-label="Benötigte Punkte" aria-required="true"
                      min={1} max={40} step={1}
                      pin={true} pinFormatter={(value: number) => `${value}`}
                      value={formData.points_required}
                      onIonChange={(e) => aendern({ points_required: e.detail.value as number })}
                      disabled={loading}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontSize: 'var(--app-text-klein)', color: 'var(--app-text-system)', minWidth: '24px', textAlign: 'center' }}>40</span>
                  </div>
                </IonItem>

                <IonItem lines="full" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">Beschreibung</IonLabel>
                  <IonTextarea aria-label="Beschreibung"
                    value={formData.description}
                    onIonInput={(e) => aendern({ description: e.detail.value! })}
                    placeholder="Optionale Beschreibung..."
                    rows={3}
                    disabled={loading}
                  />
                </IonItem>

              {/* Icon Picker */}
              <div style={{ marginTop: 'var(--app-abstand-basis)' }}>
                <IonAccordionGroup>
                  <IonAccordion value="icon-picker" toggleIcon={ICON_AUFKLAPPEN} toggleIconSlot="end">
                    <IonItem slot="header" lines="none" style={{ '--background': 'transparent' }}>
                      <div className="app-icon-circle app-icon-circle--lg" style={{
                        backgroundColor: formData.color,
                        borderRadius: 'var(--app-radius-karte)',
                        width: '50px',
                        height: '50px',
                        boxShadow: 'var(--app-schatten-karte-stark)',
                        marginRight: 'var(--app-abstand-mittel)'
                      }}>
                        <IonIcon
                          icon={getIconFromString(formData.icon || 'trophy')}
                          style={{ fontSize: 'var(--app-anzeige-basis)', color: 'white' }}
                        />
                      </div>
                      <IonLabel>
                        <h3 className="app-list-item__subtitle" style={{ margin: '0 0 var(--app-abstand-mini) 0' }}>
                          Icon *
                        </h3>
                        {formData.icon && LEVEL_ICONS[formData.icon as keyof typeof LEVEL_ICONS] && (
                          <p className="app-list-item__title" style={{ margin: '0' }}>
                            {LEVEL_ICONS[formData.icon as keyof typeof LEVEL_ICONS].name} ({LEVEL_ICONS[formData.icon as keyof typeof LEVEL_ICONS].category})
                          </p>
                        )}
                      </IonLabel>
                    </IonItem>
                    <div slot="content" style={{ padding: 'var(--app-abstand-basis)' }}>
                      {Object.entries(LEVEL_ICONS).reduce<{ category: string; icons: { key: string; data: typeof LEVEL_ICONS[keyof typeof LEVEL_ICONS] }[] }[]>((acc, [key, data]) => {
                        const categoryIndex = acc.findIndex((group) => group.category === data.category);
                        if (categoryIndex === -1) {
                          acc.push({ category: data.category, icons: [{ key, data }] });
                        } else {
                          acc[categoryIndex].icons.push({ key, data });
                        }
                        return acc;
                      }, []).map((group) => (
                        <div key={group.category} style={{ marginBottom: 'var(--app-abstand-basis)' }}>
                          <span className="app-list-item__subtitle" style={{ fontWeight: 'var(--app-schrift-halbfett)', marginBottom: 'var(--app-abstand-eng)', display: 'block' }}>
                            {group.category}
                          </span>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))', gap: 'var(--app-abstand-eng)' }}>
                            {group.icons.map(({ key, data }) => (
                              <div role="button" tabIndex={0} onKeyDown={tastaturKlick} aria-label={data.name} aria-pressed={formData.icon === key}
                                key={key}
                                onClick={() => aendern({ icon: key })}
                                style={{
                                  width: '100%',
                                  aspectRatio: '1',
                                  backgroundColor: formData.icon === key ? formData.color : 'var(--app-surface-soft)',
                                  borderRadius: 'var(--app-radius-karte)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  border: formData.icon === key ? '2px solid ' + formData.color : '1px solid var(--app-border)',
                                  boxShadow: formData.icon === key ? 'var(--app-schatten-karte-stark)' : 'var(--app-schatten-flach)',
                                  transition: 'all 0.2s'
                                }}
                              >
                                <IonIcon
                                  icon={data.icon}
                                  style={{
                                    fontSize: 'var(--app-text-ueberschrift)',
                                    color: formData.icon === key ? 'white' : 'var(--app-text-secondary)'
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </IonAccordion>
                </IonAccordionGroup>
              </div>

              {/* Color Picker */}
              <IonItem lines="none" style={{ '--background': 'transparent', marginTop: 'var(--app-abstand-basis)' }}>
                <IonLabel position="stacked">Level-Farbe</IonLabel>
                <div style={{ marginTop: 'var(--app-abstand-eng)', width: '100%' }}>
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => aendern({ color: e.target.value })}
                    disabled={loading}
                    style={{
                      width: '100%',
                      height: '60px',
                      border: '2px solid var(--app-border)',
                      borderRadius: 'var(--app-radius-karte)',
                      cursor: 'pointer'
                    }}
                  />
                </div>
              </IonItem>
            </IonList>
          </IonCardContent>
        </IonCard>
      </IonList>
      {/* Abstand unten */}
      <div style={{ height: '32px' }} />
      </IonContent>
    </IonPage>
  );
};

export default LevelManagementModal;
