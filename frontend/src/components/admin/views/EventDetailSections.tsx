import React from 'react';
import {
  IonCard,
  IonCardContent,
  IonLabel,
  IonList,
  IonListHeader,
  IonItem,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonIcon,
  IonButton
} from '@ionic/react';
import {
  calendar,
  location,
  people,
  time,
  trophy,
  informationCircle,
  shieldCheckmark,
  bagHandle,
  listOutline,
  home,
  pricetag,
  closeCircle,
  checkmarkCircle,
  chatbubbles,
  ban,
  returnUpBack,
  trash,
  document as documentIcon,
  attachOutline,
  cloudOfflineOutline
} from 'ionicons/icons';

// ---- Shared Types (re-export from main file's interfaces) ----

export interface Category {
  id: number;
  name: string;
}

export interface Jahrgang {
  id: number;
  name: string;
}

export interface EventData {
  id: number;
  name: string;
  description?: string;
  event_date: string;
  event_end_time?: string;
  location?: string;
  location_maps_url?: string;
  points: number;
  point_type?: 'gottesdienst' | 'gemeinde';
  categories?: Category[];
  jahrgaenge?: Jahrgang[];
  type: string;
  max_participants: number;
  registration_opens_at?: string;
  registration_closes_at?: string;
  registered_count: number;
  registration_status: 'upcoming' | 'open' | 'closed';
  available_spots: number;
  participants: any[];
  timeslots?: Array<{ id: number; start_time: string; end_time: string; max_participants: number; registered_count: number }>;
  has_timeslots?: boolean;
  mandatory?: boolean;
  bring_items?: string;
  teamer_needed?: boolean;
  teamer_only?: boolean;
  is_series?: boolean;
  series_id?: string;
  series_events?: EventData[];
  created_at: string;
  chat_room_id?: number | null;
  cancelled?: boolean;
  waitlist_enabled?: boolean;
  max_waitlist_size?: number;
}

export interface Participant {
  id: number;
  user_id?: number;
  participant_name: string;
  jahrgang_name?: string;
  role_name?: string;
  created_at: string;
  status?: 'confirmed' | 'waitlist' | 'pending' | 'opted_out';
  attendance_status?: 'present' | 'absent' | null;
  timeslot_start_time?: string;
  timeslot_end_time?: string;
  opt_out_reason?: string;
  opt_out_date?: string;
}

export interface Unregistration {
  id: number;
  user_id: number;
  konfi_name: string;
  reason?: string;
  unregistered_at: string;
}

// ---- EventInfoCard ----

interface EventInfoCardProps {
  eventData: EventData;
  participants: Participant[];
  formatDate: (dateString: string) => string;
  formatTime: (dateString: string) => string;
}

export const EventInfoCard = React.memo<EventInfoCardProps>(({
  eventData,
  participants,
  formatDate,
  formatTime
}) => (
  <IonList className="app-section-inset" inset={true}>
    <IonListHeader>
      <div className="app-section-icon app-section-icon--events">
        <IonIcon icon={calendar} />
      </div>
      <IonLabel>Details</IonLabel>
    </IonListHeader>
    <IonCard className="app-card">
      <IonCardContent className="app-card-content">
        {/* Datum */}
        <div className="app-info-row">
          <IonIcon icon={calendar} className="app-info-row__icon app-icon-color--events" />
          <div>
            <div className="app-info-row__content app-list-item__title">
              {formatDate(eventData.event_date || '')}
            </div>
            <div className="app-info-row__sublabel">
              {formatTime(eventData.event_date || '')}
              {eventData.event_end_time && ` - ${formatTime(eventData.event_end_time)}`}
            </div>
          </div>
        </div>

        {/* Zeitslots anzeigen wenn vorhanden */}
        {eventData.has_timeslots && eventData.timeslots && eventData.timeslots.length > 0 && (
          <div className="app-info-row app-info-row--top">
            <IonIcon icon={time} className="app-info-row__icon app-icon-color--events app-event-detail__icon--align-top" />
            <div className="app-event-detail__timeslot-list">
              <div className="app-list-item__title">Zeitfenster:</div>
              {eventData.timeslots.map((slot, idx) => (
                <div key={slot.id || idx} className="app-info-row__sublabel app-event-detail__timeslot-entry">
                  {formatTime(slot.start_time)} - {formatTime(slot.end_time)} ({slot.registered_count || 0}/{slot.max_participants} TN)
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TN gesamt - Konfis und Teamer getrennt */}
        {(() => {
          const konfiOnly = participants.filter(p => p.role_name !== 'teamer');
          const teamerOnly = participants.filter(p => p.role_name === 'teamer');
          const konfiPresent = konfiOnly.filter(p => p.attendance_status === 'present').length;
          const konfiConfirmed = konfiOnly.filter(p => p.status === 'confirmed').length;
          return (
            <>
              <div className="app-info-row">
                <IonIcon icon={people} className="app-info-row__icon app-icon-color--participants" />
                <div className="app-info-row__content">
                  {eventData.mandatory
                    ? `${konfiPresent}/${konfiOnly.length} Konfis`
                    : `${konfiConfirmed} / ${(eventData.max_participants || 0) > 0 ? eventData.max_participants : '\u221E'} Konfis`
                  }
                </div>
              </div>
              {teamerOnly.length > 0 && (
                <div className="app-info-row">
                  <IonIcon icon={people} className="app-info-row__icon" style={{ color: '#5b21b6' }} />
                  <div className="app-info-row__content">
                    {teamerOnly.length} Team
                  </div>
                </div>
              )}
            </>
          );
        })()}

        {/* Warteliste */}
        {(eventData as any)?.waitlist_enabled && (
          <div className="app-info-row">
            <IonIcon icon={listOutline} className="app-info-row__icon app-icon-color--warning" />
            <div className="app-info-row__content">
              {participants.filter(p => p.status === 'waitlist').length} / {(eventData as any)?.max_waitlist_size || 10} auf Warteliste
            </div>
          </div>
        )}

        {/* Punkte - bei Pflicht-Events ausblenden */}
        {!eventData.mandatory && (
        <div className="app-info-row">
          <IonIcon icon={trophy} className="app-info-row__icon app-icon-color--badges" />
          <div className="app-info-row__content">
            {eventData.points || 0} Punkte
          </div>
        </div>
        )}

        {/* Typ - bei Pflicht-Events ausblenden */}
        {!eventData.mandatory && (
        <div className="app-info-row">
          <IonIcon
            icon={eventData.point_type === 'gottesdienst' ? home : people}
            className="app-info-row__icon"
            style={{ color: eventData.point_type === 'gottesdienst' ? '#007aff' : '#2dd36f' }}
          />
          <div className="app-info-row__content">
            {eventData.point_type === 'gottesdienst' ? 'Gottesdienst' : 'Gemeinde'}
          </div>
        </div>
        )}

        {/* Kategorien */}
        {eventData.categories && eventData.categories.length > 0 && (
          <div className="app-info-row">
            <IonIcon icon={pricetag} className="app-info-row__icon app-icon-color--category" />
            <div className="app-info-row__content">
              {eventData.categories.map(c => c.name).join(', ')}
            </div>
          </div>
        )}

        {/* Ort */}
        {eventData.location && (
          <div className="app-info-row">
            <IonIcon icon={location} className="app-info-row__icon app-icon-color--events" />
            <div
              className="app-info-row__content app-event-detail__location-link"
              onClick={() => {
                if (eventData.location_maps_url) {
                  window.open(eventData.location_maps_url, '_blank');
                } else if (eventData.location) {
                  const mapsUrl = `https://maps.apple.com/?q=${encodeURIComponent(eventData.location)}`;
                  window.open(mapsUrl, '_blank');
                }
              }}
            >
              {eventData.location}
            </div>
          </div>
        )}

        {/* Pflicht-Badge */}
        {eventData.mandatory && (
          <div className="app-info-row">
            <IonIcon icon={shieldCheckmark} className="app-info-row__icon" style={{ color: '#dc2626' }} />
            <div className="app-info-row__content">
              Pflicht-Event
            </div>
          </div>
        )}

        {/* Teamer-Zugang Badge */}
        {(eventData.teamer_only || (eventData.teamer_needed && participants.filter(p => p.role_name === 'teamer' && p.status === 'confirmed').length === 0)) && (
          <div className="app-info-row">
            <IonIcon icon={people} className="app-info-row__icon" style={{ color: '#5b21b6' }} />
            <div className="app-info-row__content">
              {eventData.teamer_only ? 'Nur Team' : 'Team gesucht'}
            </div>
          </div>
        )}

        {/* Was mitbringen */}
        {eventData.bring_items && (
          <div className="app-info-row">
            <IonIcon icon={bagHandle} className="app-info-row__icon" style={{ color: '#8b5cf6' }} />
            <div className="app-info-row__content">
              {eventData.bring_items}
            </div>
          </div>
        )}

        {/* Anmeldezeitraum */}
        {!eventData.mandatory && (
        <div className="app-info-row app-info-row--top">
          <IonIcon icon={time} className="app-info-row__icon app-icon-color--events app-event-detail__icon--align-top-sm" />
          <div className="app-info-row__content">
            {eventData.registration_opens_at ? (
              <>
                <div>von {new Date(eventData.registration_opens_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })} - {formatTime(eventData.registration_opens_at)}</div>
                {eventData.registration_closes_at && (
                  <div className="app-info-row__sublabel">bis {new Date(eventData.registration_closes_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })} - {formatTime(eventData.registration_closes_at)}</div>
                )}
              </>
            ) : (
              'Sofort möglich'
            )}
          </div>
        </div>
        )}

        {/* Jahrgang */}
        {eventData.jahrgaenge && eventData.jahrgaenge.length > 0 && (
          <div className="app-info-row">
            <IonIcon icon={people} className="app-info-row__icon app-icon-color--jahrgang" />
            <div className="app-info-row__content">
              {eventData.jahrgaenge.map(j => j.name).join(', ')}
            </div>
          </div>
        )}

      </IonCardContent>
    </IonCard>
  </IonList>
));

// ---- DescriptionSection ----

interface DescriptionSectionProps {
  description: string;
}

export const DescriptionSection = React.memo<DescriptionSectionProps>(({ description }) => (
  <IonList className="app-section-inset" inset={true}>
    <IonListHeader>
      <div className="app-section-icon app-section-icon--events">
        <IonIcon icon={informationCircle} />
      </div>
      <IonLabel>Beschreibung</IonLabel>
    </IonListHeader>
    <IonCard className="app-card">
      <IonCardContent className="app-card-content">
        <p className="app-description-text">
          {description}
        </p>
      </IonCardContent>
    </IonCard>
  </IonList>
));

// ---- SeriesEventsSection ----

interface SeriesEventsSectionProps {
  seriesEvents: EventData[];
  formatDate: (dateString: string) => string;
  formatTime: (dateString: string) => string;
  onNavigate: (eventId: number) => void;
}

export const SeriesEventsSection = React.memo<SeriesEventsSectionProps>(({
  seriesEvents,
  formatDate,
  formatTime,
  onNavigate
}) => (
  <IonList className="app-section-inset" inset={true}>
    <IonListHeader>
      <div className="app-section-icon app-section-icon--info">
        <IonIcon icon={calendar} />
      </div>
      <IonLabel>Weitere Termine dieser Serie</IonLabel>
    </IonListHeader>
    <IonCard className="app-card">
      <IonCardContent className="app-card-content">
        {seriesEvents.map((seriesEvent) => {
          const isFull = (seriesEvent.registered_count || 0) >= seriesEvent.max_participants;
          return (
            <div
              key={seriesEvent.id}
              className={`app-list-item ${isFull ? 'app-list-item--danger' : 'app-list-item--success'} app-event-detail__series-link`}
              onClick={() => onNavigate(seriesEvent.id)}
            >
              <div className="app-corner-badges">
                <div className={`app-corner-badge ${isFull ? 'app-corner-badge--danger' : 'app-corner-badge--success'}`}>
                  {isFull ? 'Voll' : 'Frei'}
                </div>
              </div>
              <div className="app-list-item__row">
                <div className="app-list-item__main">
                  <div className={`app-icon-circle ${isFull ? 'app-icon-circle--danger' : 'app-icon-circle--success'}`}>
                    <IonIcon icon={calendar} />
                  </div>
                  <div className="app-list-item__content">
                    <div className="app-list-item__title app-list-item__title--badge-space-md">
                      {seriesEvent.name}
                    </div>
                    <div className="app-list-item__subtitle">
                      {formatDate(seriesEvent.event_date)} {formatTime(seriesEvent.event_date)} | {seriesEvent.registered_count || 0}/{seriesEvent.max_participants} TN
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </IonCardContent>
    </IonCard>
  </IonList>
));

// ---- UnregistrationsSection ----

interface UnregistrationsSectionProps {
  unregistrations: Unregistration[];
}

export const UnregistrationsSection = React.memo<UnregistrationsSectionProps>(({ unregistrations }) => (
  <IonList className="app-section-inset" inset={true}>
    <IonListHeader>
      <div className="app-section-icon app-section-icon--danger">
        <IonIcon icon={closeCircle} />
      </div>
      <IonLabel>Abmeldungen ({unregistrations.length})</IonLabel>
    </IonListHeader>
    <IonCard className="app-card">
      <IonCardContent className="app-card-content">
        {unregistrations.map((unreg) => (
          <div key={unreg.id} className="app-list-item app-list-item--danger">
            <div className="app-list-item__row">
              <div className="app-list-item__main">
                <IonIcon icon={closeCircle} className="app-icon-color--danger app-event-detail__icon-lg" />
                <div className="app-list-item__content">
                  <div className="app-list-item__title">
                    {unreg.konfi_name}
                  </div>
                  <div className="app-list-item__subtitle">
                    Abgemeldet am {new Date(unreg.unregistered_at).toLocaleString('de-DE', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              </div>
            </div>
            {unreg.reason && (
              <div className="app-reason-box app-reason-box--danger app-event-detail__reason-indent">
                <span className="app-reason-box__label">Grund:</span> {unreg.reason}
              </div>
            )}
          </div>
        ))}
      </IonCardContent>
    </IonCard>
  </IonList>
));

// ---- EventMaterialSection ----

interface EventMaterialSectionProps {
  eventMaterials: any[];
  onMaterialClick: (materialId: number) => void;
}

export const EventMaterialSection = React.memo<EventMaterialSectionProps>(({
  eventMaterials,
  onMaterialClick
}) => (
  <IonList className="app-section-inset" inset={true}>
    <IonListHeader>
      <div className="app-section-icon app-section-icon--events">
        <IonIcon icon={documentIcon} />
      </div>
      <IonLabel>Material ({eventMaterials.length})</IonLabel>
    </IonListHeader>
    <IonCard className="app-card">
      <IonCardContent className="app-card-content">
        {eventMaterials.map((mat: any) => (
          <div
            key={mat.id}
            className="app-list-item"
            style={{
              borderLeftColor: '#d97706',
              cursor: 'pointer',
              marginBottom: '8px'
            }}
            onClick={() => onMaterialClick(mat.id)}
          >
            <div className="app-list-item__row">
              <div className="app-list-item__main">
                <div className="app-icon-circle" style={{ backgroundColor: '#d97706' }}>
                  <IonIcon icon={documentIcon} />
                </div>
                <div className="app-list-item__content">
                  <div className="app-list-item__title">{mat.title}</div>
                  <div className="app-list-item__meta">
                    <span className="app-list-item__meta-item">
                      <IonIcon icon={attachOutline} style={{ color: '#d97706' }} />
                      {mat.file_count || 0} {(mat.file_count || 0) === 1 ? 'Datei' : 'Dateien'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </IonCardContent>
    </IonCard>
  </IonList>
));

// ---- EventActionsSection ----

interface EventActionsSectionProps {
  eventData: EventData;
  isCancelled: boolean;
  isOnline: boolean;
  handleNavigateToChat: () => void;
  handleCreateEventChat: () => void;
  handleCancelEvent: () => void;
}

export const EventActionsSection = React.memo<EventActionsSectionProps>(({
  eventData,
  isCancelled,
  isOnline,
  handleNavigateToChat,
  handleCreateEventChat,
  handleCancelEvent
}) => {
  if (!eventData || isCancelled) return null;
  return (
    <>
      {/* Event-Chat */}
      <IonList className="app-section-inset" inset={true}>
        <IonCard className="app-card">
          <IonCardContent className="app-card-content">
            {eventData.chat_room_id ? (
              <IonButton
                expand="block"
                fill="outline"
                onClick={handleNavigateToChat}
              >
                <IonIcon icon={chatbubbles} className="app-event-detail__icon-gap" />
                Zum Chat
              </IonButton>
            ) : (
              <IonButton
                expand="block"
                fill="outline"
                disabled={!isOnline}
                onClick={handleCreateEventChat}
              >
                <IonIcon icon={chatbubbles} className="app-event-detail__icon-gap" />
                {!isOnline ? <><IonIcon icon={cloudOfflineOutline} style={{ marginRight: 4 }} /> Du bist offline</> : 'Chat erstellen'}
              </IonButton>
            )}
          </IonCardContent>
        </IonCard>
      </IonList>

      {/* Event absagen */}
      <IonList className="app-section-inset" inset={true}>
        <IonCard className="app-card">
          <IonCardContent className="app-card-content">
            <IonButton
              expand="block"
              fill="outline"
              color="danger"
              disabled={!isOnline}
              onClick={handleCancelEvent}
            >
              <IonIcon icon={ban} className="app-event-detail__icon-gap" />
              {!isOnline ? <><IonIcon icon={cloudOfflineOutline} style={{ marginRight: 4 }} /> Du bist offline</> : 'Event absagen'}
            </IonButton>
          </IonCardContent>
        </IonCard>
      </IonList>
    </>
  );
});

// ---- TimeslotsSection ----

interface TimeslotsSectionProps {
  timeslots: Array<{ id: number; start_time: string; end_time: string; max_participants: number; registered_count: number }>;
  participants: Participant[];
  eventMandatory?: boolean;
  formatTime: (dateString: string) => string;
  showAttendanceActionSheet: (participant: Participant) => void;
  handleDemoteParticipant: (participant: Participant) => void;
  handleRemoveParticipant: (participant: Participant) => void;
}

export const TimeslotsSection = React.memo<TimeslotsSectionProps>(({
  timeslots,
  participants,
  eventMandatory,
  formatTime,
  showAttendanceActionSheet,
  handleDemoteParticipant,
  handleRemoveParticipant
}) => (
  <IonList className="app-section-inset" inset={true}>
    <IonListHeader>
      <div className="app-section-icon app-section-icon--events">
        <IonIcon icon={time} />
      </div>
      <IonLabel>Zeitslots ({timeslots.length})</IonLabel>
    </IonListHeader>
    <IonCard className="app-card">
      <IonCardContent className="app-card-content">
        {timeslots.map((timeslot) => {
          const slotStartFormatted = formatTime(timeslot.start_time);
          const slotEndFormatted = formatTime(timeslot.end_time);
          const slotParticipants = participants.filter(p => {
            if (p.status !== 'confirmed') return false;
            if ((p as any).timeslot_id && (timeslot as any).id) return (p as any).timeslot_id === (timeslot as any).id;
            if (p.timeslot_start_time && p.timeslot_end_time) {
              return formatTime(p.timeslot_start_time) === slotStartFormatted &&
                     formatTime(p.timeslot_end_time) === slotEndFormatted;
            }
            return false;
          });
          const isFull = (timeslot.registered_count || 0) >= timeslot.max_participants;

          return (
            <div key={timeslot.id} className="app-event-detail__slot-group">
              <div className={`app-list-item ${isFull ? 'app-list-item--danger' : 'app-list-item--success'}`}>
                <div className="app-corner-badges">
                  <div className={`app-corner-badge ${isFull ? 'app-corner-badge--danger' : 'app-corner-badge--success'}`}>
                    {isFull ? 'Voll' : 'Frei'}
                  </div>
                </div>
                <div className="app-list-item__row">
                  <div className="app-list-item__main">
                    <div className={`app-icon-circle ${isFull ? 'app-icon-circle--danger' : 'app-icon-circle--success'}`}>
                      <IonIcon icon={time} />
                    </div>
                    <div className="app-list-item__content">
                      <div className="app-list-item__title app-list-item__title--badge-space">
                        {slotStartFormatted} - {slotEndFormatted}
                      </div>
                      <div className="app-list-item__subtitle">
                        {timeslot.registered_count || 0}/{timeslot.max_participants} Teilnehmer
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {slotParticipants.length > 0 && (
                <div className="app-event-detail__slot-participants">
                  {slotParticipants.map((participant) => {
                    const statusText = participant.attendance_status === 'present' ? 'Anwesend' :
                                       participant.attendance_status === 'absent' ? 'Abwesend' : 'Gebucht';
                    const cornerBadgeClass = participant.attendance_status === 'present' ? 'app-corner-badge--success' :
                                             participant.attendance_status === 'absent' ? 'app-corner-badge--danger' : 'app-corner-badge--info';
                    return (
                      <IonItemSliding key={participant.id} className="app-event-detail__sliding-item">
                        <IonItem className="app-item-transparent" button detail={false} lines="none"
                          onClick={() => showAttendanceActionSheet(participant)}>
                          <div className="app-list-item app-list-item--booked app-event-detail__list-item-flush">
                            <div className="app-corner-badges">
                              <div className={`app-corner-badge ${cornerBadgeClass}`}>{statusText}</div>
                            </div>
                            <div className="app-list-item__row">
                              <div className="app-list-item__main">
                                <div className={`app-icon-circle ${
                                  participant.attendance_status === 'present' ? 'app-icon-circle--success' :
                                  participant.attendance_status === 'absent' ? 'app-icon-circle--danger' : 'app-icon-circle--info'
                                }`}>
                                  <IonIcon icon={participant.attendance_status === 'present' ? checkmarkCircle :
                                        participant.attendance_status === 'absent' ? closeCircle : people} />
                                </div>
                                <div className="app-list-item__content">
                                  <div className="app-list-item__title app-list-item__title--badge-space-lg">{participant.participant_name}</div>
                                  <div className="app-list-item__subtitle">{participant.jahrgang_name || ''}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </IonItem>
                        {!eventMandatory && (
                        <IonItemOptions className="app-swipe-actions" side="end">
                          <IonItemOption className="app-swipe-action" onClick={() => handleDemoteParticipant(participant)}>
                            <div className="app-icon-circle app-icon-circle--lg app-icon-circle--warning">
                              <IonIcon icon={returnUpBack} />
                            </div>
                          </IonItemOption>
                          <IonItemOption className="app-swipe-action" onClick={() => handleRemoveParticipant(participant)}>
                            <div className="app-icon-circle app-icon-circle--lg app-icon-circle--danger">
                              <IonIcon icon={trash} />
                            </div>
                          </IonItemOption>
                        </IonItemOptions>
                        )}
                      </IonItemSliding>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </IonCardContent>
    </IonCard>
  </IonList>
));
