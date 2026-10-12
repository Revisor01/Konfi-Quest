import React from 'react';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonItem, IonLabel, IonDatetime, IonIcon, IonSpinner, IonList, IonListHeader, IonToggle, IonCard, IonCardContent, IonModal, IonDatetimeButton, IonRange } from '@ionic/react';
import {
  ICON_HAKEN,
  ICON_HINZUFUEGEN_GEFUELLT,
  ICON_LOESCHEN_GEFUELLT,
  ICON_SCHLIESSEN,
  ICON_TERMIN_GEFUELLT,
  ICON_UHRZEIT_GEFUELLT,
} from '../../shared/icons';
import { Event, Timeslot } from '../../../types/event';
import {
  BasicInfoSection, CheckinSection,
  PointsParticipantsSection, CategoriesTargetSection,
  TeamerSection, SeriesSection
} from './EventFormSections';
import { useEventFormular } from './useEventFormular';

interface EventModalProps {
  event?: Event | null;
  // Zeitfenster einer Kopie. Ein bestehender Termin laedt seine selbst nach;
  // eine Kopie hat keine id, unter der das ginge (siehe useEventFormular).
  vorbelegteTimeslots?: Timeslot[];
  onClose: () => void;
  onSuccess: () => void;
  dismiss?: () => void;
  // Meldet den "ungespeicherte Änderungen"-Stand nach aussen, damit die
  // praesentierende Seite über canDismiss auch Swipe/Backdrop-Schliessen abfangen kann.
  onDirtyChange?: (dirty: boolean) => void;
}

// anmeldeschlussVorschlag ist am 17.09.2026 nach utils/terminVorbelegung.ts
// gewandert: "Termin kopieren" braucht dieselbe Regel, und zwei Kopien waeren
// genau der Fehler, der im Backend gerade erst behoben wurde. Der Re-Export
// haelt den bisherigen Importpfad gueltig.
import { anmeldeschlussVorschlag } from '../../../utils/terminVorbelegung';
export { anmeldeschlussVorschlag };

// Laden, Vorbelegung, Pruefen und Speichern stehen seit 11.10.2026 im Hook
// useEventFormular -- dieselbe Logik zeigt die Web-Fassung als Dialog
// (admin/web/termine/WebEventDialog). Hier steht nur noch die Darstellung
// der App.
const EventModal: React.FC<EventModalProps> = ({ event, vorbelegteTimeslots, onClose, onSuccess, dismiss, onDirtyChange }) => {
  const doClose = () => { if (dismiss) dismiss(); else onClose(); };

  const {
    formData, setFormData, timeslots, addTimeslot, removeTimeslot, updateTimeslot,
    teamerAccess, setTeamerAccess, categories, jahrgaenge, loading, isSubmitting, isFormValid,
    datePickerMax, datumWechseln, anmeldungAbSofort, zeitfensterAktivieren, handleSubmit,
  } = useEventFormular({ event, vorbelegteTimeslots, onSuccess, schliessen: doClose, onDirtyChange });

  // Schliessen anstossen. Die "ungespeicherte Änderungen"-Nachfrage läuft
  // zentral über canDismiss der praesentierenden Seite (faengt X-Button, Swipe
  // UND Backdrop einheitlich ab) — daher hier keine zweite Abfrage.
  const handleClose = () => { doClose(); };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{event ? 'Event bearbeiten' : 'Neues Event'}</IonTitle>
          <IonButtons slot="start">
            {/* NICHT an loading haengen: Bleibt der Ladezustand haengen,
                waere das Modal sonst nur noch per Swipe zu verlassen.
                Die Rueckfrage bei ungespeicherten Aenderungen laeuft
                ueber canDismiss der Seite. */}
            <IonButton aria-label="Schließen" onClick={handleClose} className="app-modal-close-btn">
              <IonIcon icon={ICON_SCHLIESSEN} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton aria-label="Event speichern" onClick={handleSubmit} disabled={!isFormValid || loading || isSubmitting}
              className="app-modal-submit-btn app-modal-submit-btn--events">
              {loading ? <IonSpinner name="crescent" /> : <IonIcon icon={ICON_HAKEN} />}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        {/* Reihenfolge (User-Entscheid 08.08.): Grunddaten -> Kategorien &
            Zielgruppe -> Datum & Zeit (+ Serie) -> Zeitfenster -> Konfis
            (Plaetze + Warteliste + Punkte) -> Teamer:innen (Zugang +
            Kontingent) -> QR-Check-in. */}

        {/* EVENT GRUNDDATEN — inkl. "Fuer wen ist das Event?": diese Auswahl
            steuert, welche Abschnitte weiter unten erscheinen. */}
        <BasicInfoSection formData={formData} setFormData={setFormData}
          teamerAccess={teamerAccess} setTeamerAccess={setTeamerAccess} loading={loading} />

        {/* KATEGORIEN & ZIELGRUPPE */}
        <CategoriesTargetSection formData={formData} setFormData={setFormData}
          categories={categories} jahrgaenge={jahrgaenge} teamerAccess={teamerAccess} loading={loading} />

        {/* DATUM & ZEIT */}
        <IonList inset={true} className="app-modal-section">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--events"><IonIcon icon={ICON_TERMIN_GEFUELLT} /></div>
            <IonLabel>Datum & Zeit</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
          <IonCardContent>
            <IonList>
              <IonItem lines="none" className="app-datumsfeld">
                <IonLabel position="stacked">Datum & Uhrzeit *</IonLabel>
                <IonDatetimeButton datetime="event-date-picker" />
              </IonItem>
              <IonItem lines="none" className="app-datumsfeld">
                <IonLabel position="stacked">Endzeit (optional)</IonLabel>
                <IonDatetimeButton datetime="end-time-picker" />
              </IonItem>
              {/* Anmeldefenster gilt NUR fuer Konfis: Teamer:innen duerfen sich
                  jederzeit anmelden, sie begrenzt allein ihr Kontingent. Bei
                  reinen Teamer-Events waeren die Felder daher wirkungslos —
                  sie zu zeigen hat vorgegaukelt, sie wuerden greifen. */}
              {!formData.mandatory && teamerAccess !== 'teamer_only' && (
                <>
                  {/* Eigener, sichtbar abgesetzter Block: die Anmeldung ist eine
                      andere Sache als der Termin selbst. Vorher stand der
                      "ab sofort"-Schalter beziehungslos zwischen den
                      Datums-Buttons (User-Hinweis 10.08.). Trennlinie +
                      Ueberschrift wie im UserManagementModal. */}
                  <div
                    style={{
                      marginTop: 'var(--app-abstand-eng)',
                      paddingTop: 'var(--app-abstand-mittelweit)',
                      borderTop: '1px solid rgba(0,0,0,0.06)'
                    }}
                  >
                    <h3
                      style={{
                        fontWeight: 'var(--app-schrift-halbfett)', margin: '0 0 var(--app-abstand-winzig) var(--app-abstand-basis)',
                        fontSize: 'var(--app-text-betont)', color: 'var(--app-text-ios)'
                      }}
                    >
                      Anmeldung
                    </h3>
                    <p style={{ color: 'var(--app-text-system)', margin: '0 var(--app-abstand-basis) var(--app-abstand-mini) var(--app-abstand-basis)', fontSize: 'var(--app-text-hinweis)', lineHeight: 1.4 }}>
                      {formData.registration_opens_at
                        ? 'Konfis können sich ab dem gewählten Zeitpunkt anmelden.'
                        : 'Konfis können sich sofort anmelden.'}
                    </p>

                    {/* "Ab sofort" = registration_opens_at NULL. Beide Detail-
                        Ansichten zeigen dafuer "Sofort möglich". */}
                    <IonItem lines="none">
                      <IonLabel>Anmeldung ab sofort</IonLabel>
                      <IonToggle aria-label="Anmeldung ab sofort"
                        slot="end"
                        className="app-toggle--events"
                        checked={!formData.registration_opens_at}
                        disabled={loading}
                        // Aus: zurück auf einen sinnvollen Startwert, jetzt (eventFormularRegeln).
                        onIonChange={(e) => anmeldungAbSofort(e.detail.checked)}
                      />
                    </IonItem>
                    {!!formData.registration_opens_at && (
                      <IonItem lines="none" className="app-datumsfeld">
                        <IonLabel position="stacked">Anmeldung ab</IonLabel>
                        <IonDatetimeButton datetime="registration-opens-picker" />
                      </IonItem>
                    )}
                    <IonItem lines="none" className="app-datumsfeld">
                      <IonLabel position="stacked">Anmeldeschluss</IonLabel>
                      <IonDatetimeButton datetime="registration-closes-picker" />
                    </IonItem>
                  </div>
                </>
              )}
            </IonList>
          </IonCardContent>
          </IonCard>
        </IonList>

        {/* SERIEN-EVENT — direkt bei Datum & Zeit (nur beim Anlegen) */}
        {!event && (
          <SeriesSection formData={formData} setFormData={setFormData} loading={loading} />
        )}

        {/* ZEITFENSTER — nicht bei Pflicht-Events und nicht bei Konfirmationen
            (beide haben feste Termine fuer den ganzen Jahrgang) */}
        {!formData.mandatory && !formData.is_konfirmation && teamerAccess !== 'teamer_only' && (<>
        <IonList inset={true} className="app-modal-section">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--events"><IonIcon icon={ICON_UHRZEIT_GEFUELLT} /></div>
            <IonLabel>Zeitfenster (optional)</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
          <IonCardContent>
            <IonList>
              <IonItem lines="none">
                <IonLabel>Zeitfenster aktivieren</IonLabel>
                <IonToggle aria-label="Zeitfenster aktivieren" slot="end" className="app-toggle--events" checked={formData.has_timeslots}
                  onIonChange={(e) => zeitfensterAktivieren(e.detail.checked)} disabled={loading} />
              </IonItem>
              {formData.has_timeslots && (
                <div className="app-modal-knopf-in-karte" style={{ padding: '0 var(--app-abstand-basis)' }}>
                  <IonButton
                    expand="block"
                    fill="outline"
                    onClick={addTimeslot}
                    disabled={loading}
                  >
                    <IonIcon icon={ICON_HINZUFUEGEN_GEFUELLT} slot="start" />
                    Zeitfenster hinzufügen
                  </IonButton>
                </div>
              )}
            </IonList>
          </IonCardContent>
          </IonCard>
        </IonList>

        {formData.has_timeslots && timeslots.map((timeslot, index) => (
          <IonList key={index} inset={true} className="app-modal-section">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--events">
                <span style={{ fontSize: 'var(--app-text-meta)', fontWeight: 'var(--app-schrift-fett)', color: 'white' }}>{index + 1}</span>
              </div>
              <IonLabel style={{ flex: 1 }}>Zeitfenster {index + 1}</IonLabel>
              <IonButton aria-label="Zeitfenster entfernen" fill="clear" color="danger" onClick={() => removeTimeslot(index)} disabled={loading} size="small">
                <IonIcon icon={ICON_LOESCHEN_GEFUELLT} />
              </IonButton>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent>
                <IonList>
                  <IonItem lines="none" className="app-datumsfeld">
                    <IonLabel position="stacked">Startzeit</IonLabel>
                    <IonDatetimeButton datetime={`timeslot-start-${index}`} />
                  </IonItem>
                  <IonItem lines="none" className="app-datumsfeld">
                    <IonLabel position="stacked">Endzeit</IonLabel>
                    <IonDatetimeButton datetime={`timeslot-end-${index}`} />
                  </IonItem>
                  <IonModal aria-label="Startzeit wählen" keepContentsMounted={true}>
                    <IonDatetime aria-label="Startzeit" id={`timeslot-start-${index}`} presentation="time" value={timeslot.start_time}
                      onIonChange={(e) => { const v = e.detail.value as string; if (v) updateTimeslot(index, 'start_time', v); }}
                      minuteValues="0,15,30,45" disabled={loading} />
                  </IonModal>
                  <IonModal aria-label="Endzeit wählen" keepContentsMounted={true}>
                    <IonDatetime aria-label="Endzeit" id={`timeslot-end-${index}`} presentation="time" value={timeslot.end_time}
                      onIonChange={(e) => { const v = e.detail.value as string; if (v) updateTimeslot(index, 'end_time', v); }}
                      minuteValues="0,15,30,45" disabled={loading} />
                  </IonModal>
                  <IonItem lines="none">
                    <IonLabel>Unbegrenzte Teilnehmer:innen</IonLabel>
                    <IonToggle aria-label="Unbegrenzte Teilnehmer:innen" slot="end" className="app-toggle--events" checked={timeslot.max_participants === 0}
                      onIonChange={(e) => updateTimeslot(index, 'max_participants', e.detail.checked ? 0 : 5)}
                      disabled={loading} />
                  </IonItem>
                  {timeslot.max_participants !== 0 && (
                    <IonItem lines="none">
                      <IonLabel position="stacked" style={{ marginBottom: 'var(--app-abstand-eng)' }}>Max. Teilnehmer:innen pro Slot</IonLabel>
                      <div className="app-range-row">
                        <span className="app-range-row__min">1</span>
                        <IonRange aria-label="Max. Teilnehmer:innen pro Slot"
                          className="app-range app-range--events"
                          /* 1-20 (24.09.2026, Simons Vorgabe). In Produktion
                             gemessen: 6 Zeitfenster, hoechster Wert 4 — keins
                             ueber 20, ein Schutz fuer Bestandswerte ist hier
                             also nicht noetig (anders als beim Teilnehmer-Regler). */
                          min={1} max={20} step={1}
                          ticks={true} snaps={true}
                          pin={true} pinFormatter={(value: number) => `${value}`}
                          value={timeslot.max_participants}
                          onIonChange={(e) => updateTimeslot(index, 'max_participants', e.detail.value as number)}
                          disabled={loading}
                        />
                        <span className="app-range-row__value">{timeslot.max_participants}</span>
                      </div>
                    </IonItem>
                  )}
                </IonList>
              </IonCardContent>
            </IonCard>
          </IonList>
        ))}
        </>)}

        {/* KONFIS — Plaetze, Warteliste und Punkte in einer Karte */}
        {!formData.mandatory && teamerAccess !== 'teamer_only' && (
          <PointsParticipantsSection formData={formData} setFormData={setFormData} loading={loading} jahrgaenge={jahrgaenge} />
        )}

        {/* TEAMER:INNEN — Plaetze/Warteliste, nur wenn Teamer:innen teilnehmen */}
        {teamerAccess !== 'normal' && (
          <TeamerSection formData={formData} setFormData={setFormData} loading={loading} />
        )}

        {/* QR CHECK-IN FENSTER */}
        <CheckinSection formData={formData} setFormData={setFormData} loading={loading} />
      </IonContent>

      {/* DateTime Modals */}
      <IonModal aria-label="Datum und Uhrzeit wählen" keepContentsMounted={true}>
        <IonDatetime aria-label="Datum & Uhrzeit" id="event-date-picker" value={formData.event_date}
          max={datePickerMax}
          // Das Ende wandert MIT, die Dauer bleibt (Befund 17.09.2026); den
          // Anmeldeschluss zieht nur das Neuanlegen mit -- beides in
          // eventFormularRegeln.ts (nachDatumswechsel), eine Regel fuer App und Web.
          onIonChange={(e) => datumWechseln(e.detail.value as string)}
          presentation="date-time" minuteValues="0,15,30,45" firstDayOfWeek={1}
          style={{ '--background': 'var(--app-surface-soft)', '--border-radius': 'var(--app-radius-karte)', '--box-shadow': 'var(--app-schatten-schwebend-weich)' }} />
      </IonModal>
      <IonModal aria-label="Endzeit wählen" keepContentsMounted={true}>
        <IonDatetime aria-label="Endzeit (optional)" id="end-time-picker" value={formData.event_end_time || formData.event_date}
          min={formData.event_date || undefined}
          max={datePickerMax}
          onIonChange={(e) => setFormData({ ...formData, event_end_time: e.detail.value as string })}
          presentation="date-time" minuteValues="0,15,30,45" firstDayOfWeek={1}
          style={{ '--background': 'var(--app-surface-soft)', '--border-radius': 'var(--app-radius-karte)', '--box-shadow': 'var(--app-schatten-schwebend-weich)' }} />
      </IonModal>
      <IonModal aria-label="Anmeldung ab: Datum wählen" keepContentsMounted={true}>
        <IonDatetime aria-label="Anmeldung ab" id="registration-opens-picker" value={formData.registration_opens_at}
          max={datePickerMax}
          onIonChange={(e) => setFormData({ ...formData, registration_opens_at: e.detail.value as string })}
          presentation="date-time" minuteValues="0,15,30,45" firstDayOfWeek={1}
          style={{ '--background': 'var(--app-surface-soft)', '--border-radius': 'var(--app-radius-karte)', '--box-shadow': 'var(--app-schatten-schwebend-weich)' }} />
      </IonModal>
      <IonModal aria-label="Anmeldeschluss wählen" keepContentsMounted={true}>
        <IonDatetime aria-label="Anmeldeschluss" id="registration-closes-picker" value={formData.registration_closes_at}
          max={datePickerMax}
          onIonChange={(e) => setFormData({ ...formData, registration_closes_at: e.detail.value as string })}
          presentation="date-time" minuteValues="0,15,30,45" firstDayOfWeek={1}
          style={{ '--background': 'var(--app-surface-soft)', '--border-radius': 'var(--app-radius-karte)', '--box-shadow': 'var(--app-schatten-schwebend-weich)' }} />
      </IonModal>
    </IonPage>
  );
};

export default EventModal;
