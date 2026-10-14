import React from 'react';
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
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonItemGroup,
  IonItem,
  IonInput,
  IonSegment,
  IonSegmentButton,
  IonPopover
} from '@ionic/react';
import {
  ICON_ABSAGE,
  ICON_BUCH,
  ICON_ENTFERNEN_GEFUELLT,
  ICON_FILTER,
  ICON_GRUPPE,
  ICON_KREIS_LEER,
  ICON_MAIL,
  ICON_SCHLIESSEN,
  ICON_SUCHE_GEFUELLT,
  ICON_TERMIN,
  ICON_ZUSAGE_GEFUELLT,
} from '../../shared/icons';
import EmptyState from '../../shared/EmptyState';
import { datumKurz, uhrzeit } from '../../../utils/dateUtils';
import { LEERE_ZEILE, matrixDatum, useAnwesenheitsMatrix, type MatrixEvent, type MatrixJahrgang } from './useAnwesenheitsMatrix';

// Laden, Suche, Umschalten, Zellen und Summe stehen in useAnwesenheitsMatrix --
// dieselbe Logik wie im Dialog der Web-Fassung (web/leitung/WebAnwesenheitDialog).

interface AttendanceMatrixModalProps {
  jahrgaenge: MatrixJahrgang[];
  initialJahrgangId?: number;
  onClose: () => void;
}

const AttendanceMatrixModal: React.FC<AttendanceMatrixModalProps> = ({
  jahrgaenge,
  initialJahrgangId,
  onClose
}) => {
  const {
    jahrgangId, setJahrgangId, loading, data, searchTerm, setSearchTerm, viewMode, setViewMode,
    sprueche, spruecheLoading, sending, handleSendEmail, filteredSprueche, filteredKonfis,
    getCellStatus, zellHinweis, konfiStats,
  } = useAnwesenheitsMatrix({ jahrgaenge, initialJahrgangId });
  // Popover: Tipp auf ein Datum im Tabellenkopf zeigt den Event-Titel
  const [eventPopover, setEventPopover] = React.useState<{ anchor: Event; event: MatrixEvent } | null>(null);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton className="app-modal-close-btn" onClick={onClose} aria-label="Schließen">
              <IonIcon icon={ICON_SCHLIESSEN} slot="icon-only" />
            </IonButton>
          </IonButtons>
          <IonTitle>{viewMode === 'sprueche' ? 'Konfisprüche' : 'Anwesenheit'}</IonTitle>
          <IonButtons slot="end">
            <IonButton
              onClick={handleSendEmail}
              disabled={sending || !jahrgangId}
              title="Per E-Mail an dich senden"
              aria-label="Per E-Mail an dich senden"
            >
              {sending
                ? <IonSpinner name="crescent" />
                : <IonIcon icon={ICON_MAIL} slot="icon-only" />}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background" fullscreen>
        {/* Suche & Filter */}
        <IonList inset={true} className="app-segment-wrapper">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--events">
              <IonIcon icon={ICON_FILTER} />
            </div>
            <IonLabel>Suche & Filter</IonLabel>
          </IonListHeader>
          <IonItemGroup>
            {/* Suchfeld */}
            <IonItem>
              <IonIcon icon={ICON_SUCHE_GEFUELLT} slot="start" style={{ color: 'var(--app-text-system)', fontSize: 'var(--app-text-standard)' }} />
              <IonInput aria-label="Konfi suchen"
                value={searchTerm}
                onIonInput={(e) => setSearchTerm(e.detail.value!)}
                placeholder="Konfi suchen..."
              />
            </IonItem>
            {/* Jahrgang Filter */}
            <IonItem>
              <IonIcon icon={ICON_TERMIN} slot="start" style={{ color: 'var(--app-text-system)', fontSize: 'var(--app-text-standard)' }} />
              <IonSelect aria-label="Jahrgang"
                value={jahrgangId}
                onIonChange={(e) => setJahrgangId(e.detail.value)}
                interface="popover"
                interfaceOptions={{ arrow: false }}
                placeholder="Jahrgang"
                style={{ width: '100%' }}
              >
                {jahrgaenge.map(j => (
                  <IonSelectOption key={j.id} value={j.id}>{j.name}</IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
          </IonItemGroup>
        </IonList>

        {/* Umschaltung Anwesenheit / Konfispruch */}
        <div className="app-segment-wrapper">
          <IonSegment
            value={viewMode}
            onIonChange={(e) => setViewMode(e.detail.value as typeof viewMode)}
          >
            <IonSegmentButton value="anwesenheit">
              <IonLabel>Anwesenheit</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="sprueche">
              <IonLabel>Konfispruch</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </div>

        {/* Konfispruch-Ansicht: Liste Konfi -> gewaehlter Spruch */}
        {viewMode === 'sprueche' ? (
          spruecheLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--app-abstand-extraweit)' }}>
              <IonSpinner name="crescent" />
            </div>
          ) : !sprueche || filteredSprueche.length === 0 ? (
            <EmptyState
              icon={ICON_BUCH}
              title="Keine Konfisprüche"
              message="Für diesen Jahrgang gibt es noch keine Konfis oder keine Treffer."
            />
          ) : (
            <IonList inset={true} className="app-segment-wrapper">
              <IonListHeader>
                <div className="app-section-icon app-section-icon--events">
                  <IonIcon icon={ICON_BUCH} />
                </div>
                <IonLabel>
                  {filteredSprueche.length} Konfi{filteredSprueche.length === 1 ? '' : 's'}
                </IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent style={{ padding: '0', overflowX: 'auto' }}>
                  <table className="attendance-matrix attendance-matrix--sprueche">
                    <thead>
                      <tr>
                        <th className="attendance-matrix__th-konfi">Konfi</th>
                        <th className="attendance-matrix__th-cell">Konfirmation</th>
                        <th className="attendance-matrix__th-cell">Buch / Stelle</th>
                        <th className="attendance-matrix__th-cell">Konfispruch</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSprueche.map(s => (
                        <tr key={s.user_id}>
                          <td className="attendance-matrix__td-konfi">{s.display_name}</td>
                          <td className="attendance-matrix__td-cell">
                            {s.konfirmation_date
                              ? `${datumKurz(s.konfirmation_date)}, ${uhrzeit(s.konfirmation_date)} Uhr`
                              : <span style={{ color: 'var(--app-text-muted)', fontStyle: 'italic' }}>nicht gebucht</span>}
                          </td>
                          <td className="attendance-matrix__td-cell">
                            {s.konfspruch?.reference || <span style={{ color: 'var(--app-text-muted)' }}>—</span>}
                          </td>
                          <td className="attendance-matrix__td-cell">
                            {s.konfspruch?.text
                              ? s.konfspruch.text
                              : <span style={{ color: 'var(--app-text-muted)', fontStyle: 'italic' }}>{s.konfspruch ? '(Übersetzung fehlt)' : 'noch keiner'}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </IonCardContent>
              </IonCard>
            </IonList>
          )
        ) : loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--app-abstand-extraweit)' }}>
            <IonSpinner name="crescent" />
          </div>
        ) : !data ? (
          <EmptyState
            icon={ICON_TERMIN}
            title="Keine Daten"
            message="Wähle einen Jahrgang."
          />
        ) : data.events.length === 0 ? (
          <EmptyState
            icon={ICON_TERMIN}
            title="Keine Pflicht-Events"
            message="Für diesen Jahrgang gibt es keine Pflicht-Events."
          />
        ) : data.konfis.length === 0 ? (
          <EmptyState
            icon={ICON_GRUPPE}
            title="Keine Konfis"
            message="Dieser Jahrgang hat noch keine Konfis."
          />
        ) : (
          <IonList inset={true} className="app-segment-wrapper">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--events">
                <IonIcon icon={ICON_TERMIN} />
              </div>
              <IonLabel>
                {data.events.length} Pflicht-Event{data.events.length === 1 ? '' : 's'} · {filteredKonfis.length} Konfi{filteredKonfis.length === 1 ? '' : 's'}
              </IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent style={{ padding: '0', overflowX: 'auto' }}>
                <table className="attendance-matrix">
                  <thead>
                    <tr>
                      <th className="attendance-matrix__th-konfi">Konfi</th>
                      {data.events.map(e => (
                        <th
                          key={e.id}
                          className="attendance-matrix__th-event"
                          title={e.name}
                          onClick={(ev) => setEventPopover({ anchor: ev.nativeEvent, event: e })}
                        >
                          <div className="attendance-matrix__event-date">{matrixDatum(e.event_date)}</div>
                        </th>
                      ))}
                      <th className="attendance-matrix__th-summary">Σ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredKonfis.map(k => {
                      const stats = konfiStats.get(k.user_id) || LEERE_ZEILE;
                      return (
                        <tr key={k.user_id}>
                          <td className="attendance-matrix__td-konfi">{k.display_name}</td>
                          {data.events.map(e => {
                            const s = getCellStatus(k.user_id, e.id);
                            // Grund und Notiz als Tooltip an der Zelle: Die
                            // Matrix ist die Uebersicht, in der die Kolleginnen
                            // nachsehen -- ohne das waere nur das graue Zeichen
                            // da und die Frage "warum?" unbeantwortet.
                            const hinweis = zellHinweis(k.user_id, e.id);
                            return (
                              <td key={e.id} className="attendance-matrix__td-cell" title={hinweis || undefined}>
                                <span className={`attendance-matrix__dot attendance-matrix__dot--${s}`}>
                                  <IonIcon
                                    icon={
                                      s === 'present' ? ICON_ZUSAGE_GEFUELLT
                                      : s === 'absent' ? ICON_ABSAGE
                                      : s === 'opted_out' || s === 'excused' ? ICON_ENTFERNEN_GEFUELLT
                                      : ICON_KREIS_LEER
                                    }
                                  />
                                </span>
                              </td>
                            );
                          })}
                          <td className="attendance-matrix__td-summary">
                            <span className="attendance-matrix__summary-text">
                              {/* Nenner ohne abgemeldete Termine (Befund 4, 25.08.2026) */}
                              {stats.present}/{stats.nenner}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* Legende */}
        {viewMode === 'anwesenheit' && data && data.events.length > 0 && data.konfis.length > 0 && (
          <IonList inset={true} className="app-segment-wrapper">
            <IonCard className="app-card">
              <IonCardContent>
                <div className="attendance-matrix__legend">
                  <div className="attendance-matrix__legend-item">
                    <span className="attendance-matrix__dot attendance-matrix__dot--present">
                      <IonIcon icon={ICON_ZUSAGE_GEFUELLT} />
                    </span>
                    <span>Anwesend</span>
                  </div>
                  <div className="attendance-matrix__legend-item">
                    <span className="attendance-matrix__dot attendance-matrix__dot--absent">
                      <IonIcon icon={ICON_ABSAGE} />
                    </span>
                    <span>Fehlt</span>
                  </div>
                  <div className="attendance-matrix__legend-item">
                    <span className="attendance-matrix__dot attendance-matrix__dot--opted_out">
                      <IonIcon icon={ICON_ENTFERNEN_GEFUELLT} />
                    </span>
                    <span>Abgemeldet</span>
                  </div>
                  {/* Zweiter Abmelde-Weg: die Leitung traegt nach, was
                      ausserhalb der App gemeldet wurde. Gleiches Zeichen,
                      gleiche Wirkung auf den Nenner — aber eine andere
                      Herkunft, deshalb ein eigener Eintrag. */}
                  <div className="attendance-matrix__legend-item">
                    <span className="attendance-matrix__dot attendance-matrix__dot--excused">
                      <IonIcon icon={ICON_ENTFERNEN_GEFUELLT} />
                    </span>
                    <span>Abgemeldet (nachgetragen)</span>
                  </div>
                  <div className="attendance-matrix__legend-item">
                    <span className="attendance-matrix__dot attendance-matrix__dot--open">
                      <IonIcon icon={ICON_KREIS_LEER} />
                    </span>
                    <span>Offen</span>
                  </div>
                </div>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        <IonPopover
          isOpen={eventPopover !== null}
          event={eventPopover?.anchor}
          onDidDismiss={() => setEventPopover(null)}
        >
          <div style={{ padding: 'var(--app-abstand-schmal) var(--app-abstand-mittelweit)' }}>
            <div style={{ fontWeight: 'var(--app-schrift-halbfett)', fontSize: 'var(--app-text-basis)' }}>{eventPopover?.event.name}</div>
            <div style={{ color: 'var(--app-text-secondary)', fontSize: 'var(--app-text-hinweis)', marginTop: 'var(--app-abstand-winzig)' }}>
              {eventPopover
                ? datumKurz(eventPopover.event.event_date)
                : ''}
            </div>
          </div>
        </IonPopover>

        <div className="ion-padding-bottom" />
      </IonContent>
    </IonPage>
  );
};

export default AttendanceMatrixModal;
