import React from 'react';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonPage, IonButtons, IonButton, IonItem, IonLabel, IonInput, IonTextarea, IonToggle, IonCard, IonCardContent, IonIcon, IonText, IonSpinner, IonList, IonListHeader, IonAccordion, IonAccordionGroup, IonRange } from '@ionic/react';
import {
  ICON_ABZEICHEN_GEFUELLT,
  ICON_AKTUALISIEREN,
  ICON_AUFKLAPPEN,
  ICON_EINSTELLUNGEN_GEFUELLT,
  ICON_GEMEINDE_GEFUELLT,
  ICON_GOTTESDIENST_GEFUELLT,
  ICON_GRUPPE,
  ICON_GRUPPE_GEFUELLT,
  ICON_HAKEN,
  ICON_KATEGORIE_GEFUELLT,
  ICON_SCHLIESSEN,
} from '../../shared/icons';
import { ICON_CHOICES as BADGE_ICONS } from '../../../utils/badgeIcons';
import { getCriteriaColor as getCategoryColor, getCriteriaIcon } from '../../../utils/badgeCriteria';
import { tastaturKlick } from '../../../utils/tastatur';
import { aktivitaetArt, ohneEmoji, STANDARD_WOCHEN, WOCHEN_MAX, useBadgeFormular, type BadgeAktivitaet } from '../useBadgeFormular';

// Badge anlegen und bearbeiten in der App. Die Logik (Laden, Vorbelegung,
// Kriterien, Speichern mit Warteschlange, „Badge neu prüfen") steht seit
// 11.10.2026 in ../useBadgeFormular -- dieselbe wie im Dialog der Web-Fassung
// (../web/start/WebBadgeFormular). Hier nur die Darstellung der App.

interface BadgeManagementModalProps {
  badgeId?: number | null;
  targetRole?: 'konfi' | 'teamer';
  onClose: () => void;
  onSuccess: () => void;
  // Meldet den "ungespeicherte Änderungen"-Stand nach aussen, damit die
  // praesentierende Seite über canDismiss auch Swipe/Backdrop-Schliessen abfangen kann.
  onDirtyChange?: (dirty: boolean) => void;
  // Laedt nur die Badge-Liste neu, OHNE das Modal zu schliessen (anders als
  // onSuccess). Gebraucht nach "Abzeichen neu pruefen", damit earned_count
  // stimmt, waehrend der Admin im Modal bleibt.
  onRefreshList?: () => void;
}

const BadgeManagementModal: React.FC<BadgeManagementModalProps> = ({
  badgeId,
  targetRole = 'konfi',
  onClose,
  onSuccess,
  onDirtyChange,
  onRefreshList
}) => {
  const {
    isEditMode, darfPruefen, loading, initialDataLoading, isSubmitting, pruefLoading,
    formData, setFormData, extraCriteria, activities, categories, criteriaTypes, kriterienZurWahl, reglerMax,
    handleSave, handlePruefen, waehleZielgruppe, waehleKriterium, waehleAktivitaet, waehleKategorie,
    kategorieKombiUmschalten, aktivitaetKombiUmschalten, setzeWochen, valueLabel,
  } = useBadgeFormular({ badgeId, targetRole, onSuccess, onDirtyChange, onRefreshList });

  const doClose = () => onClose();

  // Schliessen anstossen. Die "ungespeicherte Änderungen"-Nachfrage läuft zentral
  // über canDismiss der praesentierenden Seite (faengt X-Button, Swipe UND Backdrop
  // einheitlich ab) -> hier keine zweite Abfrage.
  const handleClose = () => { doClose(); };

  // Gottesdienst/Gemeinde gibt es NUR bei Konfis — bei Teamer-Aktivitäten ist
  // `type` bedeutungslos und wuerde als Untertitel nur in die Irre fuehren
  // (User-Hinweis 11.08.). Deshalb dort neutral in der Teamer-Farbe.
  const isTeamerBadge = targetRole === 'teamer';
  // Dieselben Farben wie der linke Balken der Zeile (app-list-item--gottesdienst
  // / --gemeinde). Vorher standen hier #007aff (das ist die JAHRGANGS-Farbe) und
  // #2dd36f — dadurch hatten Balken und Icon-Kreis zwei verschiedene Toene.
  const activityColor = (activity: BadgeAktivitaet) =>
    isTeamerBadge ? 'var(--app-color-teamer)'
      : activity.type === 'gottesdienst'
        ? 'var(--app-color-gottesdienst)'
        : 'var(--app-color-gemeinde)';
  const activityIcon = (activity: BadgeAktivitaet) =>
    isTeamerBadge ? ICON_GRUPPE_GEFUELLT : activity.type === 'gottesdienst' ? ICON_GOTTESDIENST_GEFUELLT : ICON_GEMEINDE_GEFUELLT;
  const activitySubtitle = (activity: BadgeAktivitaet): string | null => aktivitaetArt(activity, targetRole);

  // Auswahl wird wie ueberall sonst über die Bereichsklasse dargestellt
  // (eingefaerbter Hintergrund), NICHT über ein Haekchen — siehe die
  // Kategorie- und Jahrgangs-Auswahl im Event-Formular (User-Hinweis 11.08.).
  const activityItemClass = (activity: BadgeAktivitaet, isSelected: boolean): string => {
    const bereich = isTeamerBadge
      ? 'app-list-item--teamer'
      : activity.type === 'gottesdienst'
        ? 'app-list-item--gottesdienst'
        : 'app-list-item--gemeinde';
    return `app-list-item ${bereich}${isSelected ? ' app-list-item--selected' : ''}`;
  };

  const renderCriteriaSpecificFields = () => {
    switch (formData.criteria_type) {
      case 'specific_activity': {
        const selectedActivity = activities.find(a => a.id === extraCriteria.activity_id);
        return (
          <div style={{ marginTop: 'var(--app-abstand-basis)' }}>
            <IonAccordionGroup>
              <IonAccordion value="activity-picker" toggleIcon={ICON_AUFKLAPPEN} toggleIconSlot="end">
                <IonItem slot="header" lines="none">
                  <IonLabel>
                    <h3 style={{ fontSize: 'var(--app-text-basis)', fontWeight: 'var(--app-schrift-mittel)', color: 'var(--app-text-secondary)', margin: '0 0 var(--app-abstand-mini) 0' }}>
                      Aktivität auswählen
                    </h3>
                    {selectedActivity && (
                      <p style={{ fontSize: 'var(--app-text-sekundaer)', color: 'var(--app-text-primary)', margin: '0', fontWeight: 'var(--app-schrift-mittel)' }}>
                        {selectedActivity.name}
                        {activitySubtitle(selectedActivity) && ` (${activitySubtitle(selectedActivity)})`}
                      </p>
                    )}
                  </IonLabel>
                </IonItem>
                <div slot="content" style={{ padding: 'var(--app-abstand-eng) 0' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--app-abstand-eng)' }}>
                    {activities.map(activity => {
                      const isSelected = extraCriteria.activity_id === activity.id;
                      return (
                        <div role="button" tabIndex={0} onKeyDown={tastaturKlick}
                          key={activity.id}
                          className={activityItemClass(activity, isSelected)}
                          onClick={() => waehleAktivitaet(activity.id)}
                          style={{
                            cursor: loading ? 'default' : 'pointer',
                            opacity: loading ? 0.6 : 1,
                            marginBottom: '0'
                          }}
                        >
                          <div className="app-list-item__row">
                            <div className="app-list-item__main">
                              <div className="app-icon-circle" style={{ backgroundColor: activityColor(activity) }}>
                                <IonIcon icon={activityIcon(activity)} />
                              </div>
                              <div className="app-list-item__content">
                                <div className="app-list-item__title">{activity.name}</div>
                                {activitySubtitle(activity) && (
                                  <div className="app-list-item__subtitle">
                                    {activitySubtitle(activity)}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </IonAccordion>
            </IonAccordionGroup>
          </div>
        );
      }

      case 'category_activities': {
        const selectedCategory = categories.find(c => c.name === extraCriteria.required_category);
        return (
          <div style={{ marginTop: 'var(--app-abstand-basis)' }}>
            <IonAccordionGroup>
              <IonAccordion value="category-picker" toggleIcon={ICON_AUFKLAPPEN} toggleIconSlot="end">
                <IonItem slot="header" lines="none">
                  <IonLabel>
                    <h3 style={{ fontSize: 'var(--app-text-basis)', fontWeight: 'var(--app-schrift-mittel)', color: 'var(--app-text-secondary)', margin: '0 0 var(--app-abstand-mini) 0' }}>
                      Kategorie auswählen
                    </h3>
                    {selectedCategory && (
                      <p style={{ fontSize: 'var(--app-text-sekundaer)', color: 'var(--app-text-primary)', margin: '0', fontWeight: 'var(--app-schrift-mittel)' }}>
                        {selectedCategory.name}
                      </p>
                    )}
                  </IonLabel>
                </IonItem>
                <div slot="content" style={{ padding: 'var(--app-abstand-eng) 0' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--app-abstand-eng)' }}>
                    {categories.map(category => {
                      const isSelected = extraCriteria.required_category === category.name;
                      return (
                        <div role="button" tabIndex={0} onKeyDown={tastaturKlick} aria-pressed={isSelected}
                          key={category.id}
                          className={`app-list-item app-list-item--categories${isSelected ? ' app-list-item--selected' : ''}`}
                          onClick={() => waehleKategorie(category.name)}
                          style={{
                            cursor: loading ? 'default' : 'pointer',
                            opacity: loading ? 0.6 : 1,
                            marginBottom: '0'
                          }}
                        >
                          <div className="app-list-item__row">
                            <div className="app-list-item__main">
                              <div className="app-icon-circle app-icon-circle--categories">
                                <IonIcon icon={ICON_KATEGORIE_GEFUELLT} />
                              </div>
                              <div className="app-list-item__content">
                                <div className="app-list-item__title">{category.name}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </IonAccordion>
            </IonAccordionGroup>
          </div>
        );
      }

      case 'category_combination': {
        // Mehrfachauswahl von Kategorien. Bewusst dieselbe Machart wie die
        // Aktivitaets-Kombination darunter, nur mit Kategorien: Das Kriterium
        // fragt "aus wie vielen VERSCHIEDENEN Kategorien war jemand dabei" —
        // dreimal dieselbe zaehlt nur einmal.
        const gewaehlteKategorien = extraCriteria.required_categories || [];
        return (
          <div style={{ marginTop: 'var(--app-abstand-basis)' }}>
            <IonAccordionGroup>
              <IonAccordion value="category-combination-picker" toggleIcon={ICON_AUFKLAPPEN} toggleIconSlot="end">
                <IonItem slot="header" lines="none">
                  <IonLabel>
                    <h3 style={{ fontSize: 'var(--app-text-basis)', fontWeight: 'var(--app-schrift-mittel)', color: 'var(--app-text-secondary)', margin: '0 0 var(--app-abstand-mini) 0' }}>
                      Kategorien kombinieren (mehrere auswählbar)
                    </h3>
                    {gewaehlteKategorien.length > 0 && (
                      <p style={{ fontSize: 'var(--app-text-sekundaer)', color: 'var(--app-text-primary)', margin: '0', fontWeight: 'var(--app-schrift-mittel)' }}>
                        {gewaehlteKategorien.join(', ')}
                      </p>
                    )}
                  </IonLabel>
                </IonItem>
                <div slot="content" style={{ padding: 'var(--app-abstand-eng) 0' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--app-abstand-eng)' }}>
                    {categories.map(category => {
                      const isSelected = gewaehlteKategorien.includes(category.name);
                      return (
                        <div role="button" tabIndex={0} onKeyDown={tastaturKlick} aria-pressed={isSelected}
                          key={category.id}
                          className={`app-list-item app-list-item--categories${isSelected ? ' app-list-item--selected' : ''}`}
                          // "4 aus 3" kann niemand erreichen: der Wert zieht
                          // beim Abwaehlen mit (useBadgeFormular).
                          onClick={() => kategorieKombiUmschalten(category.name)}
                          style={{
                            cursor: loading ? 'default' : 'pointer',
                            opacity: loading ? 0.6 : 1,
                            marginBottom: '0'
                          }}
                        >
                          <div className="app-list-item__row">
                            <div className="app-list-item__main">
                              <div className="app-icon-circle app-icon-circle--categories">
                                <IonIcon icon={ICON_KATEGORIE_GEFUELLT} />
                              </div>
                              <div className="app-list-item__content">
                                <div className="app-list-item__title">{category.name}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </IonAccordion>
            </IonAccordionGroup>
          </div>
        );
      }

      case 'time_based':
        return (
          <IonItem lines="none" style={{ '--background': 'transparent', marginTop: 'var(--app-abstand-basis)' }}>
            <IonLabel position="stacked" style={{ marginBottom: 'var(--app-abstand-eng)' }}>Zeitraum (Wochen) <span style={{ fontWeight: 'var(--app-schrift-fett)', color: 'var(--ion-color-primary)' }}>{extraCriteria.weeks || STANDARD_WOCHEN}</span></IonLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--app-abstand-eng)', width: '100%' }}>
              <span style={{ fontSize: 'var(--app-text-klein)', color: 'var(--app-text-system)', minWidth: '24px', textAlign: 'center' }}>1</span>
              <IonRange aria-label="Zeitraum (Wochen)"
                min={1} max={WOCHEN_MAX} step={1}
                pin={true} pinFormatter={(value: number) => `${value}`}
                value={extraCriteria.weeks || STANDARD_WOCHEN}
                onIonChange={(e) => setzeWochen(e.detail.value as number)}
                disabled={loading}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 'var(--app-text-klein)', color: 'var(--app-text-system)', minWidth: '24px', textAlign: 'center' }}>{WOCHEN_MAX}</span>
            </div>
          </IonItem>
        );

      case 'activity_combination': {
        const selectedActivities = activities.filter(a => (extraCriteria.activity_ids || []).includes(a.id));
        return (
          <div style={{ marginTop: 'var(--app-abstand-basis)' }}>
            <IonAccordionGroup>
              <IonAccordion value="activity-combination-picker" toggleIcon={ICON_AUFKLAPPEN} toggleIconSlot="end">
                <IonItem slot="header" lines="none">
                  <IonLabel>
                    <h3 style={{ fontSize: 'var(--app-text-basis)', fontWeight: 'var(--app-schrift-mittel)', color: 'var(--app-text-secondary)', margin: '0 0 var(--app-abstand-mini) 0' }}>
                      Aktivitäten kombinieren (mehrere auswählbar)
                    </h3>
                    {selectedActivities.length > 0 && (
                      <p style={{ fontSize: 'var(--app-text-sekundaer)', color: 'var(--app-text-primary)', margin: '0', fontWeight: 'var(--app-schrift-mittel)' }}>
                        {selectedActivities.map(a => a.name).join(', ')}
                      </p>
                    )}
                  </IonLabel>
                </IonItem>
                <div slot="content" style={{ padding: 'var(--app-abstand-eng) 0' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--app-abstand-eng)' }}>
                    {activities.map(activity => {
                      const activityIds = extraCriteria.activity_ids || [];
                      const isSelected = activityIds.includes(activity.id);

                      return (
                        <div role="button" tabIndex={0} onKeyDown={tastaturKlick}
                          key={activity.id}
                          className={activityItemClass(activity, isSelected)}
                          onClick={() => aktivitaetKombiUmschalten(activity.id)}
                          style={{
                            cursor: loading ? 'default' : 'pointer',
                            opacity: loading ? 0.6 : 1,
                            marginBottom: '0'
                          }}
                        >
                          <div className="app-list-item__row">
                            <div className="app-list-item__main">
                              <div className="app-icon-circle" style={{ backgroundColor: activityColor(activity) }}>
                                <IonIcon icon={activityIcon(activity)} />
                              </div>
                              <div className="app-list-item__content">
                                <div className="app-list-item__title">{activity.name}</div>
                                {activitySubtitle(activity) && (
                                  <div className="app-list-item__subtitle">
                                    {activitySubtitle(activity)}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </IonAccordion>
            </IonAccordionGroup>
          </div>
        );
      }

      default:
        return null;
    }
  };

  // Hoechstwert des Reglers (reglerMaximum in useBadgeFormular): Normalfall
  // 20, waechst mit einem bestehenden hoeheren Wert mit, damit Ionic ihn beim
  // ersten Anfassen nicht herunterklemmt.
  const getValueLabel = () => valueLabel;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{isEditMode ? 'Badge bearbeiten' : 'Neues Badge'}</IonTitle>
          <IonButtons slot="start">
            {/* NICHT an loading haengen: Schliessen muss immer moeglich sein.
                Bleibt loading haengen, waere das Modal sonst nur noch per
                Swipe zu verlassen. Die Rueckfrage bei ungespeicherten
                Aenderungen laeuft ohnehin ueber canDismiss der Seite. */}
            <IonButton aria-label="Schließen" onClick={handleClose} className="app-modal-close-btn">
              <IonIcon icon={ICON_SCHLIESSEN} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton aria-label="Badge speichern"
              onClick={handleSave}
              disabled={loading || isSubmitting || !formData.name.trim()}
              className="app-modal-submit-btn app-modal-submit-btn--badges"
            >
              {loading ? <IonSpinner name="crescent" /> : <IonIcon icon={ICON_HAKEN} />}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        {initialDataLoading && !isEditMode ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--app-abstand-block)' }}>
            <IonSpinner name="crescent" />
          </div>
        ) : loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--app-abstand-block)' }}>
            <IonSpinner name="crescent" />
          </div>
        ) : (
        <>
        {/* SEKTION: Zielgruppe (nur bei neuem Badge) */}
        {!isEditMode && (
        <IonList inset={true} className="app-modal-section">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--badges">
              <IonIcon icon={ICON_GRUPPE} />
            </div>
            <IonLabel>Zielgruppe</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--app-abstand-eng)' }}>
                {/* Jede Zielgruppe in IHRER Farbe (Konfi-Lila, Teamer-Pink)
                    statt beide in Orange — wie ueberall sonst in der App. */}
                <div role="button" tabIndex={0} onKeyDown={tastaturKlick}
                  className={`app-list-item app-list-item--purple${formData.target_role === 'konfi' ? ' app-list-item--selected' : ''}`}
                  onClick={() => waehleZielgruppe('konfi')}
                  style={{
                    cursor: loading ? 'default' : 'pointer',
                    marginBottom: '0'
                  }}
                >
                  <div className="app-list-item__row">
                    <div className="app-list-item__main">
                      <div className="app-icon-circle app-icon-circle--purple">
                        <IonIcon icon={ICON_GRUPPE_GEFUELLT} />
                      </div>
                      <div className="app-list-item__content">
                        <div className="app-list-item__title">Konfis</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div role="button" tabIndex={0} onKeyDown={tastaturKlick}
                  className={`app-list-item app-list-item--teamer${formData.target_role === 'teamer' ? ' app-list-item--selected' : ''}`}
                  onClick={() => waehleZielgruppe('teamer')}
                  style={{
                    cursor: loading ? 'default' : 'pointer',
                    marginBottom: '0'
                  }}
                >
                  <div className="app-list-item__row">
                    <div className="app-list-item__main">
                      <div className="app-icon-circle app-icon-circle--teamer">
                        <IonIcon icon={ICON_ABZEICHEN_GEFUELLT} />
                      </div>
                      <div className="app-list-item__content">
                        <div className="app-list-item__title">Team</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </IonCardContent>
          </IonCard>
        </IonList>
        )}

        {/* SEKTION: Badge-Informationen */}
        <IonList inset={true} className="app-modal-section">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--badges">
              <IonIcon icon={ICON_ABZEICHEN_GEFUELLT} />
            </div>
            <IonLabel>Badge-Informationen</IonLabel>
          </IonListHeader>
        <IonCard className="app-card">
          <IonCardContent>
            <IonList>
              <IonItem lines="inset">
                <IonLabel position="stacked">Name *</IonLabel>
                <IonInput aria-label="Name" aria-required="true"
                  value={formData.name}
                  onIonInput={(e) => setFormData({ ...formData, name: e.detail.value! })}
                  placeholder="Badge-Name eingeben"
                  required
                  clearInput={true}
                  disabled={loading}
                />
              </IonItem>

              <IonItem lines="inset">
                <IonLabel position="stacked">Beschreibung</IonLabel>
                <IonTextarea aria-label="Beschreibung"
                  value={formData.description}
                  onIonInput={(e) => setFormData({ ...formData, description: e.detail.value! })}
                  placeholder="Beschreibung des Badges..."
                  rows={3}
                  disabled={loading}
                />
              </IonItem>

              <div style={{ marginTop: 'var(--app-abstand-basis)' }}>
                <IonAccordionGroup>
                  <IonAccordion value="icon-picker" toggleIcon={ICON_AUFKLAPPEN} toggleIconSlot="end">
                    <IonItem slot="header" lines="none">
                      <IonLabel>
                        <h3 style={{ fontSize: 'var(--app-text-basis)', fontWeight: 'var(--app-schrift-mittel)', color: 'var(--app-text-secondary)', margin: '0 0 var(--app-abstand-mini) 0' }}>
                          Icon *
                        </h3>
                        {formData.icon && BADGE_ICONS[formData.icon as keyof typeof BADGE_ICONS] && (
                          <p style={{ fontSize: 'var(--app-text-sekundaer)', color: 'var(--app-text-primary)', margin: '0', fontWeight: 'var(--app-schrift-mittel)' }}>
                            {BADGE_ICONS[formData.icon as keyof typeof BADGE_ICONS].name} ({BADGE_ICONS[formData.icon as keyof typeof BADGE_ICONS].category})
                          </p>
                        )}
                      </IonLabel>
                    </IonItem>
                    <div slot="content" style={{ padding: 'var(--app-abstand-basis)' }}>
                      {Object.entries(BADGE_ICONS).reduce<{ category: string; icons: { key: string; data: typeof BADGE_ICONS[keyof typeof BADGE_ICONS] }[] }[]>((acc, [key, data]) => {
                        const categoryIndex = acc.findIndex((group) => group.category === data.category);
                        if (categoryIndex === -1) {
                          acc.push({ category: data.category, icons: [{ key, data }] });
                        } else {
                          acc[categoryIndex].icons.push({ key, data });
                        }
                        return acc;
                      }, []).map((group) => (
                        <div key={group.category} style={{ marginBottom: 'var(--app-abstand-basis)' }}>
                          <IonText style={{ fontSize: 'var(--app-text-sekundaer)', fontWeight: 'var(--app-schrift-halbfett)', color: 'var(--app-text-secondary)', marginBottom: 'var(--app-abstand-eng)', display: 'block' }}>
                            {group.category}
                          </IonText>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))', gap: 'var(--app-abstand-eng)' }}>
                            {group.icons.map(({ key, data }) => (
                              <div role="button" tabIndex={0} onKeyDown={tastaturKlick} aria-label={data.name} aria-pressed={formData.icon === key}
                                key={key}
                                onClick={() => setFormData({ ...formData, icon: key })}
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
                                  border: '1px solid rgba(0,0,0,0.06)',
                                  boxShadow: 'var(--app-schatten-flach)',
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

              <IonItem lines="none">
                <IonLabel position="stacked">Badge-Farbe</IonLabel>
                <div style={{ marginTop: 'var(--app-abstand-eng)', width: '100%' }}>
                  <div style={{ display: 'flex', gap: 'var(--app-abstand-eng)', alignItems: 'stretch' }}>
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      disabled={loading}
                      style={{
                        flex: 1,
                        height: '60px',
                        border: '2px solid rgba(0,0,0,0.12)',
                        borderRadius: 'var(--app-radius-karte)',
                        cursor: 'pointer'
                      }}
                    />
                    {formData.color !== getCategoryColor(formData.criteria_type) && (
                      <button
                        onClick={() => setFormData({ ...formData, color: getCategoryColor(formData.criteria_type) })}
                        disabled={loading}
                        style={{
                          padding: 'var(--app-abstand-eng) var(--app-abstand-mittel)',
                          borderRadius: 'var(--app-radius-karte)',
                          border: `2px solid ${getCategoryColor(formData.criteria_type)}`,
                          backgroundColor: 'transparent',
                          color: getCategoryColor(formData.criteria_type),
                          fontSize: 'var(--app-text-klein)',
                          fontWeight: 'var(--app-schrift-halbfett)',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--app-abstand-kompakt)'
                        }}
                      >
                        <div style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: 'var(--app-radius-kreis)',
                          backgroundColor: getCategoryColor(formData.criteria_type),
                          flexShrink: 0
                        }} />
                        Standard
                      </button>
                    )}
                  </div>
                </div>
              </IonItem>
            </IonList>
          </IonCardContent>
        </IonCard>
        </IonList>

        {/* SEKTION: Badge-Kriterien */}
        <IonList inset={true} className="app-modal-section">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--badges">
              <IonIcon icon={ICON_EINSTELLUNGEN_GEFUELLT} />
            </div>
            <IonLabel>Badge-Kriterien</IonLabel>
          </IonListHeader>
        <IonCard className="app-card">
          <IonCardContent>
            <IonAccordionGroup>
              <IonAccordion value="criteria-types" toggleIcon={ICON_AUFKLAPPEN} toggleIconSlot="end">
                <IonItem slot="header" lines="none">
                  <IonLabel>
                    <h3 style={{ fontSize: 'var(--app-text-basis)', fontWeight: 'var(--app-schrift-mittel)', color: 'var(--app-text-secondary)', margin: '0 0 var(--app-abstand-mini) 0' }}>
                      Kriterium-Typ
                    </h3>
                    {formData.criteria_type && criteriaTypes[formData.criteria_type] && (
                      <>
                        <p style={{ fontSize: 'var(--app-text-sekundaer)', color: 'var(--app-text-primary)', margin: '0 0 var(--app-abstand-winzig) 0', fontWeight: 'var(--app-schrift-mittel)' }}>
                          {ohneEmoji(criteriaTypes[formData.criteria_type].label)}
                        </p>
                        <p style={{ fontSize: 'var(--app-text-klein)', color: 'var(--app-text-muted)', margin: '0', whiteSpace: 'normal' }}>
                          {criteriaTypes[formData.criteria_type].description}
                        </p>
                      </>
                    )}
                  </IonLabel>
                </IonItem>
                <div slot="content" style={{ padding: 'var(--app-abstand-eng) 0' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--app-abstand-eng)' }}>
                    {/* Bei Teamer ohne Punkte-Kriterien, teamer_year nur bei
                        Teamer (kriteriumWaehlbar in useBadgeFormular). */}
                    {kriterienZurWahl.map(([value, type]) => {
                      const isSelected = formData.criteria_type === value;
                      const typColor = getCategoryColor(value);
                      // Remove emojis from label
                      const labelWithoutEmoji = ohneEmoji(type.label);

                      return (
                        <div role="button" tabIndex={0} onKeyDown={tastaturKlick}
                          key={value}
                          className="app-list-item"
                          onClick={() => waehleKriterium(value)}
                          style={{
                            cursor: loading ? 'default' : 'pointer',
                            opacity: loading ? 0.6 : 1,
                            marginBottom: '0',
                            // Jeder Kriterientyp hat seine eigene Farbe (dieselbe,
                            // die das fertige Badge trägt) — vorher war die
                            // ganze Liste pauschal orange.
                            borderLeftColor: typColor,
                            background: isSelected ? `${typColor}14` : undefined
                          }}
                        >
                          <div className="app-list-item__row">
                            <div className="app-list-item__main">
                              <div className="app-icon-circle" style={{ backgroundColor: typColor }}>
                                <IonIcon icon={getCriteriaIcon(value)} />
                              </div>
                              <div className="app-list-item__content">
                                <div className="app-list-item__title">{labelWithoutEmoji}</div>
                                <div className="app-list-item__subtitle" style={{ whiteSpace: 'normal' }}>
                                  {type.help}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </IonAccordion>
            </IonAccordionGroup>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <IonItem lines="none" style={{ '--background': 'transparent', marginBottom: 'var(--app-abstand-mittel)', marginTop: 'var(--app-abstand-basis)' }}>
                <IonLabel position="stacked" style={{ marginBottom: 'var(--app-abstand-eng)' }}>
                  {getValueLabel()} <span style={{ fontWeight: 'var(--app-schrift-fett)', color: 'var(--ion-color-primary)' }}>{formData.criteria_value}</span>
                </IonLabel>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--app-abstand-eng)', width: '100%' }}>
                  <span style={{ fontSize: 'var(--app-text-klein)', color: 'var(--app-text-system)', minWidth: '24px', textAlign: 'center' }}>1</span>
                  <IonRange aria-label={getValueLabel()}
                    min={1} max={reglerMax} step={1}
                    pin={true} pinFormatter={(value: number) => `${value}`}
                    value={formData.criteria_value}
                    onIonChange={(e) => setFormData({ ...formData, criteria_value: e.detail.value as number })}
                    disabled={loading}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: 'var(--app-text-klein)', color: 'var(--app-text-system)', minWidth: '24px', textAlign: 'center' }}>{reglerMax}</span>
                </div>
              </IonItem>

              {renderCriteriaSpecificFields()}
            </div>
          </IonCardContent>
        </IonCard>
        </IonList>

        {/* SEKTION: Badge-Status */}
        <IonList inset={true} className="app-modal-section">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--badges">
              <IonIcon icon={ICON_ABZEICHEN_GEFUELLT} />
            </div>
            <IonLabel>Badge-Status</IonLabel>
          </IonListHeader>
        <IonCard className="app-card">
          <IonCardContent>
            <IonList>
              <IonItem lines="inset">
                <IonLabel>
                  <h3 style={{ color: 'var(--app-text-primary)', margin: '0 0 var(--app-abstand-mini) 0', fontWeight: 'var(--app-schrift-halbfett)' }}>Aktiv</h3>
                  <p style={{ color: 'var(--app-text-secondary)', margin: '0', fontSize: 'var(--app-text-sekundaer)' }}>Badge kann verliehen werden</p>
                </IonLabel>
                <IonToggle aria-label="Aktiv"
                  slot="end"
                  className="app-toggle--badges"
                  checked={formData.is_active}
                  onIonChange={(e) => setFormData({ ...formData, is_active: e.detail.checked })}
                />
              </IonItem>

              <IonItem lines="none">
                <IonLabel>
                  <h3 style={{ color: 'var(--app-text-primary)', margin: '0 0 var(--app-abstand-mini) 0', fontWeight: 'var(--app-schrift-halbfett)' }}>Geheim</h3>
                  <p style={{ color: 'var(--app-text-secondary)', margin: '0', fontSize: 'var(--app-text-sekundaer)' }}>Badge ist für Konfis nicht sichtbar bis sie es erhalten</p>
                </IonLabel>
                <IonToggle aria-label="Geheim"
                  slot="end"
                  className="app-toggle--badges"
                  checked={formData.is_hidden}
                  onIonChange={(e) => setFormData({ ...formData, is_hidden: e.detail.checked })}
                />
              </IonItem>
            </IonList>

            {/* Nur bei bestehendem Badge (Route ist je Abzeichen) und nur fuer
                admin/org_admin (POST /admin/badges/:id/pruefen: requireAdmin).
                Fuer Sonderfaelle gedacht — Speichern loest die Pruefung
                inzwischen automatisch aus. */}
            {isEditMode && darfPruefen && (
              <IonButton
                expand="block"
                fill="outline"
                onClick={handlePruefen}
                disabled={pruefLoading || loading}
                style={{ marginTop: 'var(--app-abstand-mittel)' }}
              >
                {pruefLoading ? <IonSpinner name="crescent" /> : <IonIcon icon={ICON_AKTUALISIEREN} slot="start" />}
                Badge neu prüfen
              </IonButton>
            )}
          </IonCardContent>
        </IonCard>
        </IonList>

        </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default BadgeManagementModal;