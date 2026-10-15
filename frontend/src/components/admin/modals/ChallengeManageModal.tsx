import React from 'react';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonPage,
  IonButtons,
  IonButton,
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonToggle,
  IonCard,
  IonCardContent,
  IonIcon,
  IonText,
  IonSpinner,
  IonList,
  IonListHeader,
  IonAccordion,
  IonAccordionGroup,
  IonDatetime,
  IonDatetimeButton,
  IonModal
} from '@ionic/react';
import {
  ICON_ABZEICHEN,
  ICON_AUFKLAPPEN,
  ICON_CHALLENGE_GEFUELLT,
  ICON_GALERIE,
  ICON_GRUPPE,
  ICON_HAKEN,
  ICON_JAHRGANG,
  ICON_SCHLIESSEN,
  ICON_SICHTBAR,
  ICON_TERMIN,
} from '../../shared/icons';
import type { AdminChallenge } from '../../../types/challenges';
import { ICON_CHOICES, getIconFromString } from '../../../utils/badgeIcons';
import { tastaturKlick } from '../../../utils/tastatur';
import {
  AUDIENCE_OPTIONS,
  CHALLENGE_GRENZEN,
  MEDIA_OPTIONS,
  VISIBILITY_OPTIONS,
  useChallengeManageFormular,
} from './useChallengeManageFormular';

// Icon-Auswahl: gemeinsamer Vorrat aus utils/badgeIcons, damit
// Challenge-Stempel, Abzeichen und Zertifikate dieselbe Bildsprache haben.
// Rueckfall bleibt die Flagge (frueher lokal in CHALLENGE_ICONS).
export const getChallengeIcon = (iconName?: string): string => getIconFromString(iconName, ICON_CHALLENGE_GEFUELLT);

// Das Formular der App. Laden, Vorbelegung, Sperren nach dem Start, Prüfung
// und Speichern stehen im Hook useChallengeManageFormular, den auch der
// Dialog der Web-Fassung (shared/web/challenges/WebChallengeDialog) liest.

interface ChallengeManageModalProps {
  challenge?: AdminChallenge | null;
  onClose: () => void;
  onSuccess: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

const ChallengeManageModal: React.FC<ChallengeManageModalProps> = ({
  challenge,
  onClose,
  onSuccess,
  onDirtyChange
}) => {
  const {
    formData,
    setFormData,
    jahrgaenge,
    loading,
    isSubmitting,
    initialLoading,
    isEditMode,
    isStarted,
    isTeamOnly,
    isFormValid,
    waehleZielgruppe,
    waehleSichtbarkeit,
    toggleMedia,
    toggleJahrgang,
    handleSave,
  } = useChallengeManageFormular({ challenge, onSuccess, onDirtyChange });

  const selectedIconMeta = ICON_CHOICES[formData.badge_icon];

  const iconGroups = Object.entries(ICON_CHOICES).reduce<
    { category: string; icons: { key: string; data: { icon: string; name: string; category: string } }[] }[]
  >((acc, [key, data]) => {
    const group = acc.find((g) => g.category === data.category);
    if (group) group.icons.push({ key, data });
    else acc.push({ category: data.category, icons: [{ key, data }] });
    return acc;
  }, []);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{isEditMode ? 'Challenge bearbeiten' : 'Neue Challenge'}</IonTitle>
          <IonButtons slot="start">
            {/* NICHT an loading haengen: Bleibt der Ladezustand haengen,
                waere das Modal sonst nur noch per Swipe zu verlassen.
                Die Rueckfrage bei ungespeicherten Aenderungen laeuft
                ueber canDismiss der Seite. */}
            <IonButton aria-label="Schließen" onClick={onClose} className="app-modal-close-btn">
              <IonIcon icon={ICON_SCHLIESSEN} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            {/* Der Haken hat einen Namen fuer Vorlesehilfen -- derselbe wie
                der Knopf im Dialog der Web-Fassung (15.10.2026). */}
            <IonButton
              aria-label={isEditMode ? 'Speichern' : 'Challenge anlegen'}
              onClick={() => handleSave()}
              disabled={loading || isSubmitting || !isFormValid}
              className="app-modal-submit-btn app-modal-submit-btn--challenges"
            >
              {loading ? <IonSpinner name="crescent" /> : <IonIcon icon={ICON_HAKEN} />}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        {initialLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--app-abstand-block)' }}>
            <IonSpinner name="crescent" />
          </div>
        ) : (
          <>
            {/* SEKTION: Die Challenge */}
            <IonList inset={true} className="app-modal-section">
              <IonListHeader>
                <div className="app-section-icon app-section-icon--challenges">
                  <IonIcon icon={ICON_CHALLENGE_GEFUELLT} />
                </div>
                <IonLabel>Die Challenge</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent>
                  <IonList>
                    <IonItem lines="inset">
                      <IonLabel position="stacked">Titel *</IonLabel>
                      <IonInput aria-label="Titel" aria-required="true"
                        value={formData.title}
                        onIonInput={(e) => setFormData({ ...formData, title: e.detail.value! })}
                        placeholder="Worum geht es?"
                        clearInput={true}
                        disabled={loading}
                        maxlength={CHALLENGE_GRENZEN.titel}
                      />
                    </IonItem>

                    <IonItem lines="inset">
                      <IonLabel position="stacked">Beschreibung *</IonLabel>
                      <IonTextarea aria-label="Beschreibung" aria-required="true"
                        value={formData.description}
                        onIonInput={(e) => setFormData({ ...formData, description: e.detail.value! })}
                        placeholder="Was sollen die Konfis tun?"
                        rows={5}
                        autoGrow={true}
                        disabled={loading}
                      />
                    </IonItem>
                    <IonItem lines="none">
                      <IonLabel position="stacked">Gestellt von (optional)</IonLabel>
                      <IonInput aria-label="Gestellt von (optional)"
                        value={formData.author_freetext}
                        onIonInput={(e) => setFormData({ ...formData, author_freetext: e.detail.value! })}
                        placeholder="z.B. Pastor Simon, Konfi-Team Hennstedt"
                        clearInput={true}
                        disabled={loading}
                        maxlength={CHALLENGE_GRENZEN.urheber}
                      />
                    </IonItem>
                  </IonList>
                </IonCardContent>
              </IonCard>
            </IonList>

            {/* Der Hinweis, was mit den Beitraegen passiert, steht im Handbuch
                (Kapitel Challenges) — nicht mehr als Kasten im Formular. */}

            {/* SEKTION: Wer macht mit? (Teilnahme-Kreis) */}
            <IonList inset={true} className="app-modal-section">
              <IonListHeader>
                <div className="app-section-icon app-section-icon--challenges">
                  <IonIcon icon={ICON_GRUPPE} />
                </div>
                <IonLabel>Wer macht mit?</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--app-abstand-eng)' }}>
                    {AUDIENCE_OPTIONS.map((option) => (
                      <div role="button" tabIndex={0} onKeyDown={tastaturKlick} aria-pressed={formData.audience === option.value}
                        key={option.value}
                        className={`app-list-item app-list-item--challenges${formData.audience === option.value ? ' app-list-item--selected' : ''}`}
                        onClick={() => waehleZielgruppe(option.value)}
                        style={{
                          cursor: loading || isStarted ? 'default' : 'pointer',
                          opacity: isStarted && formData.audience !== option.value ? 0.4 : loading ? 0.6 : 1,
                          marginBottom: '0'
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="app-list-item__title">{option.label}</div>
                          <div className="app-list-item__subtitle" style={{ whiteSpace: 'normal' }}>
                            {option.hint}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </IonCardContent>
              </IonCard>
            </IonList>

            {/* SEKTION: Medienarten */}
            <IonList inset={true} className="app-modal-section">
              <IonListHeader>
                <div className="app-section-icon app-section-icon--challenges">
                  <IonIcon icon={ICON_GALERIE} />
                </div>
                <IonLabel>Erlaubte Medienarten</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent>
                  <IonItem lines="none" style={{ '--background': 'transparent', paddingBottom: 'var(--app-abstand-eng)' }}>
                    <IonLabel style={{ fontSize: 'var(--app-text-basis)', fontWeight: 'var(--app-schrift-mittel)', color: formData.allowed_media.length === 0 ? 'var(--app-color-danger)' : 'var(--app-text-secondary)' }}>
                      Mehrere möglich *
                      {formData.allowed_media.length > 0 && (
                        <span style={{ marginLeft: 'var(--app-abstand-eng)', fontSize: 'var(--app-text-hinweis)', color: 'var(--app-text-challenges)', fontWeight: 'var(--app-schrift-normal)' }}>
                          ({formData.allowed_media.length} ausgewählt)
                        </span>
                      )}
                    </IonLabel>
                  </IonItem>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--app-abstand-eng)' }}>
                    {MEDIA_OPTIONS.map((option) => {
                      const isSelected = formData.allowed_media.includes(option.value);
                      return (
                        <div role="button" tabIndex={0} onKeyDown={tastaturKlick} aria-pressed={isSelected}
                          key={option.value}
                          className={`app-list-item app-list-item--challenges${isSelected ? ' app-list-item--selected' : ''}`}
                          onClick={() => toggleMedia(option.value)}
                          style={{
                            cursor: loading || isStarted ? 'default' : 'pointer',
                            opacity: isStarted && !isSelected ? 0.4 : loading ? 0.6 : 1,
                            marginBottom: '0'
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="app-list-item__title">{option.label}</div>
                            <div className="app-list-item__subtitle" style={{ whiteSpace: 'normal' }}>
                              {option.hint}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </IonCardContent>
              </IonCard>
            </IonList>

            {/* SEKTION: Sichtbarkeit */}
            <IonList inset={true} className="app-modal-section">
              <IonListHeader>
                <div className="app-section-icon app-section-icon--challenges">
                  <IonIcon icon={ICON_SICHTBAR} />
                </div>
                <IonLabel>Sichtbarkeit der Beiträge</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent>
                  {/* Die Erklärung, warum diese Felder nach dem Start gesperrt
                      sind, steht im Handbuch (Kapitel Challenges, "Was nach dem
                      Start gesperrt ist") — nicht mehr als Hinweis-Kasten hier
                      (Nutzerentscheid 24.08.2026). */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--app-abstand-eng)' }}>
                    {VISIBILITY_OPTIONS.map((option) => (
                      <div role="button" tabIndex={0} onKeyDown={tastaturKlick} aria-pressed={formData.visibility === option.value}
                        key={option.value}
                        className={`app-list-item app-list-item--challenges${formData.visibility === option.value ? ' app-list-item--selected' : ''}`}
                        onClick={() => waehleSichtbarkeit(option.value)}
                        style={{
                          cursor: loading || isStarted ? 'default' : 'pointer',
                          opacity: isStarted && formData.visibility !== option.value ? 0.4 : loading ? 0.6 : 1,
                          marginBottom: '0'
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="app-list-item__title">{option.label}</div>
                          <div className="app-list-item__subtitle" style={{ whiteSpace: 'normal' }}>
                            {option.hint}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <IonItem lines="none" style={{ marginTop: 'var(--app-abstand-basis)' }}>
                    <IonLabel>
                      <h3 style={{ color: 'var(--app-text-primary)', margin: '0 0 var(--app-abstand-mini) 0', fontWeight: 'var(--app-schrift-halbfett)' }}>
                        Beiträge erst nach Freigabe zeigen
                      </h3>
                      <p style={{ color: 'var(--app-text-secondary)', margin: '0', fontSize: 'var(--app-text-sekundaer)', whiteSpace: 'normal' }}>
                        Ist das aus, erscheinen Beiträge sofort in der Galerie. Ausblenden geht
                        immer noch nachträglich.
                      </p>
                    </IonLabel>
                    <IonToggle aria-label="Beiträge erst nach Freigabe zeigen"
                      slot="end"
                      className="app-toggle--challenges"
                      checked={formData.moderated}
                      disabled={loading || isStarted}
                      onIonChange={(e) => setFormData({ ...formData, moderated: e.detail.checked })}
                    />
                  </IonItem>

                  <IonItem lines="none">
                    <IonLabel>
                      <h3 style={{ color: 'var(--app-text-primary)', margin: '0 0 var(--app-abstand-mini) 0', fontWeight: 'var(--app-schrift-halbfett)' }}>
                        Mehrere Beiträge erlauben
                      </h3>
                      <p style={{ color: 'var(--app-text-secondary)', margin: '0', fontSize: 'var(--app-text-sekundaer)', whiteSpace: 'normal' }}>
                        Konfis können mehr als einen Beitrag zu dieser Challenge einreichen.
                      </p>
                    </IonLabel>
                    <IonToggle aria-label="Mehrere Beiträge erlauben"
                      slot="end"
                      className="app-toggle--challenges"
                      checked={formData.allow_multiple}
                      disabled={loading}
                      onIonChange={(e) => setFormData({ ...formData, allow_multiple: e.detail.checked })}
                    />
                  </IonItem>
                </IonCardContent>
              </IonCard>
            </IonList>

            {/* SEKTION: Stempel */}
            <IonList inset={true} className="app-modal-section">
              <IonListHeader>
                <div className="app-section-icon app-section-icon--challenges">
                  <IonIcon icon={ICON_ABZEICHEN} />
                </div>
                <IonLabel>Stempel</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent>
                  <IonList>
                    <IonItem lines="inset">
                      <IonLabel position="stacked">Name des Stempels *</IonLabel>
                      <IonInput aria-label="Name des Stempels" aria-required="true"
                        value={formData.badge_name}
                        onIonInput={(e) => setFormData({ ...formData, badge_name: e.detail.value! })}
                        placeholder="z.B. Hingeschaut"
                        clearInput={true}
                        disabled={loading}
                        maxlength={CHALLENGE_GRENZEN.stempelName}
                      />
                    </IonItem>
                  </IonList>

                  <div style={{ marginTop: 'var(--app-abstand-basis)' }}>
                    <IonAccordionGroup>
                      <IonAccordion value="icon-picker" toggleIcon={ICON_AUFKLAPPEN} toggleIconSlot="end">
                        <IonItem slot="header" lines="none">
                          <IonLabel>
                            <h3 style={{ fontSize: 'var(--app-text-basis)', fontWeight: 'var(--app-schrift-mittel)', color: 'var(--app-text-secondary)', margin: '0 0 var(--app-abstand-mini) 0' }}>
                              Icon *
                            </h3>
                            {selectedIconMeta && (
                              <p style={{ fontSize: 'var(--app-text-sekundaer)', color: 'var(--app-text-primary)', margin: '0', fontWeight: 'var(--app-schrift-mittel)' }}>
                                {selectedIconMeta.name} ({selectedIconMeta.category})
                              </p>
                            )}
                          </IonLabel>
                        </IonItem>
                        <div slot="content" style={{ padding: 'var(--app-abstand-basis)' }}>
                          {iconGroups.map((group) => (
                            <div key={group.category} style={{ marginBottom: 'var(--app-abstand-basis)' }}>
                              <IonText style={{ fontSize: 'var(--app-text-sekundaer)', fontWeight: 'var(--app-schrift-halbfett)', color: 'var(--app-text-secondary)', marginBottom: 'var(--app-abstand-eng)', display: 'block' }}>
                                {group.category}
                              </IonText>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))', gap: 'var(--app-abstand-eng)' }}>
                                {group.icons.map(({ key, data }) => (
                                  <div role="button" tabIndex={0} onKeyDown={tastaturKlick} aria-label={data.name} aria-pressed={formData.badge_icon === key}
                                    key={key}
                                    onClick={() => !loading && setFormData({ ...formData, badge_icon: key })}
                                    style={{
                                      width: '100%',
                                      aspectRatio: '1',
                                      backgroundColor: formData.badge_icon === key ? 'var(--app-color-challenges)' : 'var(--app-surface-soft)',
                                      borderRadius: 'var(--app-radius-karte)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer',
                                      border: '1px solid var(--app-border)',
                                      boxShadow: 'var(--app-schatten-flach)',
                                      transition: 'all 0.2s'
                                    }}
                                  >
                                    <IonIcon
                                      icon={data.icon}
                                      style={{
                                        fontSize: 'var(--app-text-ueberschrift)',
                                        color: formData.badge_icon === key ? 'white' : 'var(--app-text-secondary)'
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
                  {/* Wie der Stempel funktioniert, erklärt das Handbuch
                      (Kapitel Challenges, "Der Stempel") — der Hinweis-Kasten
                      hier ist ersatzlos gestrichen (Nutzerentscheid 24.08.2026). */}
                </IonCardContent>
              </IonCard>
            </IonList>

            {/* SEKTION: Jahrgaenge — bei 'nur_team' entfaellt sie (org-weit) */}
            {!isTeamOnly && (
            <IonList inset={true} className="app-modal-section">
              <IonListHeader>
                <div className="app-section-icon app-section-icon--challenges">
                  <IonIcon icon={ICON_JAHRGANG} />
                </div>
                <IonLabel>Zielgruppe</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent>
                  <IonItem lines="none" style={{ '--background': 'transparent', paddingBottom: 'var(--app-abstand-eng)' }}>
                    <IonLabel style={{ fontSize: 'var(--app-text-basis)', fontWeight: 'var(--app-schrift-mittel)', color: formData.jahrgang_ids.length === 0 ? 'var(--app-color-danger)' : 'var(--app-text-secondary)' }}>
                      Jahrgänge (mehrere möglich) *
                      {formData.jahrgang_ids.length > 0 && (
                        <span style={{ marginLeft: 'var(--app-abstand-eng)', fontSize: 'var(--app-text-hinweis)', color: 'var(--app-text-jahrgang)', fontWeight: 'var(--app-schrift-normal)' }}>
                          ({formData.jahrgang_ids.length} ausgewählt)
                        </span>
                      )}
                    </IonLabel>
                  </IonItem>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--app-abstand-eng)' }}>
                    {jahrgaenge.map((jahrgang) => {
                      const isSelected = formData.jahrgang_ids.includes(jahrgang.id);
                      return (
                        <div role="button" tabIndex={0} onKeyDown={tastaturKlick} aria-pressed={isSelected}
                          key={jahrgang.id}
                          className={`app-list-item app-list-item--jahrgang${isSelected ? ' app-list-item--selected' : ''}`}
                          onClick={() => toggleJahrgang(jahrgang.id)}
                          style={{
                            cursor: loading ? 'default' : 'pointer',
                            opacity: loading ? 0.6 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            marginBottom: '0'
                          }}
                        >
                          <span style={{ fontWeight: 'var(--app-schrift-mittel)', color: 'var(--app-text-primary)' }}>{jahrgang.name}</span>
                        </div>
                      );
                    })}
                    {jahrgaenge.length === 0 && (
                      <div style={{ padding: 'var(--app-abstand-eng)', color: 'var(--app-text-muted)', fontSize: 'var(--app-text-sekundaer)' }}>
                        Keine Jahrgänge verfügbar
                      </div>
                    )}
                  </div>
                </IonCardContent>
              </IonCard>
            </IonList>
            )}

            {/* SEKTION: Zeitraum */}
            <IonList inset={true} className="app-modal-section">
              <IonListHeader>
                <div className="app-section-icon app-section-icon--challenges">
                  <IonIcon icon={ICON_TERMIN} />
                </div>
                {/* Beim Entwurf gibt es keinen Zeitraum zu sehen — dann
                    trägt der Abschnitt den Namen dessen, was er zeigt. */}
                <IonLabel>{formData.is_draft ? 'Entwurf' : 'Zeitraum'}</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent>
                  {/* Entwurf ist Entwurf — kein Datum (Nutzerentscheid
                      24.08.2026): solange der Entwurf-Schalter an ist, werden
                      Start und Ende weder angezeigt noch verlangt. Bereits
                      eingetragene Werte bleiben im Formular-State erhalten
                      und tauchen beim Einplanen wieder auf — beim Hin- und
                      Herschalten geht nichts verloren. */}
                  {/* Erklärende Hinweise zum Zeitraum stehen im Handbuch
                      (Kapitel Challenges) — hier nur noch die Felder selbst;
                      "(gesperrt)" am Label sagt das Nötigste
                      (Nutzerentscheid 24.08.2026). */}
                  {!formData.is_draft && (
                    <IonList>
                      <IonItem lines="inset">
                        <IonLabel>Start{isStarted ? ' (gesperrt)' : ' *'}</IonLabel>
                        <IonDatetimeButton datetime="challenge-start-picker" disabled={loading || isStarted} slot="end" />
                      </IonItem>
                      <IonItem lines="none">
                        <IonLabel>Ende *</IonLabel>
                        <IonDatetimeButton datetime="challenge-end-picker" disabled={loading} slot="end" />
                      </IonItem>
                    </IonList>
                  )}

                  {/* Entwurf-Haken statt eigener Footer-Buttons: gespeichert wird
                      ausschliesslich ueber den Bestätigen-Button oben rechts. */}
                  {!isStarted && (
                    <IonItem lines="none" style={{ marginTop: 'var(--app-abstand-eng)' }}>
                      <IonLabel>
                        <h3 style={{ color: 'var(--app-text-primary)', margin: '0 0 var(--app-abstand-mini) 0', fontWeight: 'var(--app-schrift-halbfett)' }}>
                          Als Entwurf speichern
                        </h3>
                        <p style={{ color: 'var(--app-text-secondary)', margin: '0', fontSize: 'var(--app-text-sekundaer)', whiteSpace: 'normal' }}>
                          Entwürfe sehen nur du und dein Team.
                        </p>
                      </IonLabel>
                      <IonToggle aria-label="Als Entwurf speichern"
                        slot="end"
                        className="app-toggle--challenges"
                        checked={formData.is_draft}
                        disabled={loading}
                        onIonChange={(e) => setFormData({ ...formData, is_draft: e.detail.checked })}
                      />
                    </IonItem>
                  )}
                </IonCardContent>
              </IonCard>
            </IonList>

            <div className="ion-padding-bottom" />
          </>
        )}
      </IonContent>

      {/* DateTime-Modals — wie im Event-Modal direkt unter IonPage, nicht im Content */}
      <IonModal aria-label="Start wählen" keepContentsMounted={true}>
        <IonDatetime
          aria-label="Start"
          id="challenge-start-picker"
          value={formData.starts_at}
          presentation="date-time"
          minuteValues="0,15,30,45"
          firstDayOfWeek={1}
          onIonChange={(e) => setFormData({ ...formData, starts_at: e.detail.value as string })}
          style={{ '--background': 'var(--app-surface-soft)', '--border-radius': 'var(--app-radius-karte)', '--box-shadow': 'var(--app-schatten-schwebend-weich)' }}
        />
      </IonModal>
      <IonModal aria-label="Ende wählen" keepContentsMounted={true}>
        <IonDatetime
          aria-label="Ende"
          id="challenge-end-picker"
          value={formData.ends_at}
          presentation="date-time"
          minuteValues="0,15,30,45"
          firstDayOfWeek={1}
          onIonChange={(e) => setFormData({ ...formData, ends_at: e.detail.value as string })}
          style={{ '--background': 'var(--app-surface-soft)', '--border-radius': 'var(--app-radius-karte)', '--box-shadow': 'var(--app-schatten-schwebend-weich)' }}
        />
      </IonModal>
    </IonPage>
  );
};

export default ChallengeManageModal;
