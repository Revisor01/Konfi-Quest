import React, { useState } from 'react';
import {
  IonIcon,
  IonItem,
  IonLabel,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonSegment,
  IonSegmentButton
} from '@ionic/react';
import {
  ICON_ABSAGE,
  ICON_ANTWORTEN,
  ICON_GEMEINDE_GEFUELLT,
  ICON_GOTTESDIENST_GEFUELLT,
  ICON_GRUPPE_GEFUELLT,
  ICON_POKAL_GEFUELLT,
  ICON_TERMIN_GEFUELLT,
  ICON_TEXTDOKUMENT,
  ICON_WARTEND_GEFUELLT,
  ICON_ZUSAGE_GEFUELLT,
} from '../shared/icons';
import { SectionHeader, ListSection, StatusBadge } from '../shared';
import { closeOpenSlidingItems } from '../../utils/slidingItems';
import { datumKurz } from '../../utils/dateUtils';
import SegmentZahl from '../shared/SegmentZahl';
import WeitereEintraege from '../shared/WeitereEintraege';
import { useSchrittweiseListe } from '../../hooks/useSchrittweiseListe';
import { inFassung, leerVon, wahlVon } from '../../seiten/beschreibung';
import {
  LEITUNG_ANTRAEGE_LEER_TITEL,
  LEITUNG_ANTRAEGE_TITEL,
  LEITUNG_ANTRAEGE_UNTERTITEL,
  LEITUNG_ANTRAG_STATUS,
  OHNE_JAHRGANG,
} from '../../seiten/mitmachenLeitung';
import type { AntragFilter } from './web/termine/typen';

interface ActivityRequest {
  id: number;
  konfi_id: number;
  konfi_name: string;
  jahrgang_name?: string;
  activity_id: number;
  activity_name: string;
  activity_type?: string;
  activity_points?: number;
  requested_date: string;
  comment?: string;
  photo_filename?: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_comment?: string;
  approved_by?: number;
  approved_by_name?: string;
  activity_target_role?: 'konfi' | 'teamer';
  created_at: string;
  updated_at: string;
  /**
   * Darf die angemeldete Leitung über diesen Antrag entscheiden
   * (genehmigen, ablehnen, zurücksetzen)? Recht „Anträge entscheiden" je
   * Jahrgang (09.10.2026). Fehlt bei älteren Servern -- dann wie bisher.
   */
  darf_entscheiden?: boolean;
}

interface ActivityRequestsViewProps {
  requests: ActivityRequest[];
  onSelectRequest: (request: ActivityRequest) => void;
  onResetRequest: (request: ActivityRequest) => void;
  // Zusaetzlicher Inhalt DIREKT UNTER dem SectionHeader (z.B. das Events|Aktivitäten-
  // Hauptsegment der Page, analog zum Konfi-Pattern in KonfiEventsPage).
  headerSlot?: React.ReactNode;
  // true, wenn der Server die (bis auf Teamer-Meldungen) leere Liste mit dem
  // Header X-Kein-Jahrgang-Zugewiesen begruendet hat (Admin ohne
  // Jahrgangs-Zuweisung, Entscheidung 31.08.2026). Dann erklaert der
  // Leerzustand den Grund — dasselbe Muster wie in KonfisView.
  ohneJahrgang?: boolean;
  /**
   * Offene Antraege (BadgeContext.pendingRequestsCount): orange Zahl im
   * Reiter-Knopf "Offen" (28.09.2026, zur Ansicht). Dieselbe Quelle wie der
   * Events-Reiter; der Server zaehlt nur fuer die Leitung.
   */
  offeneAntraege?: number;
}

const ActivityRequestsView: React.FC<ActivityRequestsViewProps> = ({
  requests: requestsRaw,
  onSelectRequest,
  onResetRequest,
  headerSlot,
  ohneJahrgang = false,
  offeneAntraege = 0
}) => {
  // Defensive: bei kaputten/gecachten Responses (Object statt Array) auf [] fallen
  const requests: ActivityRequest[] = Array.isArray(requestsRaw) ? requestsRaw : [];

  // Die Stände aus der gemeinsamen Beschreibung (seiten/mitmachenLeitung.ts);
  // „Alle" gibt es nur im Browser.
  const [statusFilter, setStatusFilter] = useState<AntragFilter>('offen');

  const filteredAndSortedRequests = requests
    .filter((r) => wahlVon(LEITUNG_ANTRAG_STATUS, statusFilter).passt?.(r) ?? true)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Schrittweise rendern (Leitung BF-14): "Verbucht" waechst ueber das Jahr
  // auf hunderte Zeilen; 416 davon kosteten gedrosselt 10,5 s, jetzt 1,1 s. Zaehler und
  // Filter laufen weiter ueber alle (hooks/useSchrittweiseListe.ts).
  const { sichtbar: sichtbareAntraege, weitere: weitereAntraege, mehrZeigen: mehrAntraege } =
    useSchrittweiseListe(filteredAndSortedRequests, statusFilter);

  const anzahl = (schluessel: AntragFilter): number =>
    requests.filter((r) => wahlVon(LEITUNG_ANTRAG_STATUS, schluessel).passt?.(r) ?? true).length;
  const reiter = inFassung(LEITUNG_ANTRAG_STATUS, 'app');

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    return datumKurz(d);
  };

  const getTypeIcon = (type: string) => {
    return type === 'gottesdienst' ? ICON_GOTTESDIENST_GEFUELLT : ICON_GEMEINDE_GEFUELLT;
  };

  const getTypeColor = (type: string) => {
    return type === 'gottesdienst' ? 'var(--app-color-info)' : 'var(--app-color-gemeinde)';
  };

  return (
    <>
      <SectionHeader
        title={LEITUNG_ANTRAEGE_TITEL}
        subtitle={LEITUNG_ANTRAEGE_UNTERTITEL}
        icon={ICON_TEXTDOKUMENT}
        preset="activities"
        // Die Kacheln entsprechen den Reitern und schalten dorthin.
        stats={reiter.map((r) => ({
          value: anzahl(r.schluessel),
          label: r.label,
          onClick: () => setStatusFilter(r.schluessel),
          active: statusFilter === r.schluessel,
        }))}
      />

      {headerSlot}

      {/* Tab Filter - wie bei Events */}
      <div style={{ margin: 'var(--app-abstand-basis) var(--app-abstand-basis) var(--app-abstand-eng) var(--app-abstand-basis)' }}>
        <IonSegment
          value={statusFilter}
          onIonChange={(e) => setStatusFilter(e.detail.value as AntragFilter)}
        >
          {reiter.map((r) => (
            <IonSegmentButton key={r.schluessel} value={r.schluessel}>
              <IonLabel>
                {r.kurz ?? r.label}
                {r.zahlText && <SegmentZahl anzahl={offeneAntraege} label={r.zahlText(offeneAntraege)} />}
              </IonLabel>
            </IonSegmentButton>
          ))}
        </IonSegment>
      </div>
      {/* Aktivitäten-Liste */}
      <ListSection
        icon={ICON_TEXTDOKUMENT}
        title="Aktivitäten"
        count={filteredAndSortedRequests.length}
        iconColorClass="success"
        isEmpty={filteredAndSortedRequests.length === 0}
        emptyIcon={ICON_TEXTDOKUMENT}
        // „Kein Jahrgang zugewiesen" nur, wenn die Liste ganz leer ist: Team-Meldungen
        // bleiben sichtbar, ein leerer Reiter hat dann seinen eigenen Grund (wie im Browser).
        emptyTitle={ohneJahrgang && requests.length === 0 ? OHNE_JAHRGANG.titel : LEITUNG_ANTRAEGE_LEER_TITEL}
        emptyMessage={
          ohneJahrgang && requests.length === 0
            // Der Server hat Konfi-Antraege wegen fehlender Jahrgangs-Zuweisung
            // ausgeblendet (Header X-Kein-Jahrgang-Zugewiesen) — das ist kein
            // Fehler, sondern Simons Regel vom 31.08.2026. Teamer-Meldungen
            // bleiben sichtbar, deshalb spricht der Text nur von Konfis.
            ? OHNE_JAHRGANG.text
            : leerVon(LEITUNG_ANTRAG_STATUS, statusFilter)
        }
        emptyIconColor="var(--app-color-success-strong)"
      >
        {sichtbareAntraege.map((request, index) => {
                  const isPending = request.status === 'pending';
                  const isApproved = request.status === 'approved';
                  const isRejected = request.status === 'rejected';

                  // Status-Farbe und Text
                  const statusColor = isPending ? 'var(--app-color-warning)' : isApproved ? 'var(--app-color-success-strong)' : 'var(--app-color-danger)';
                  // "Verbucht" statt "Genehmigt" (Entscheidung 28.08.2026): Es
                  // beschreibt, was passiert ist — die Punkte sind gutgeschrieben —
                  // statt einen Verwaltungsakt. Dasselbe Wort steht bei den Terminen
                  // im Verbuchen-Tab und im Handbuch.
                  const statusText = isPending ? 'Offen' : isApproved ? 'Verbucht' : 'Abgelehnt';

                  return (
                    <IonItemSliding key={request.id} style={{ marginBottom: index < sichtbareAntraege.length - 1 ? 'var(--app-abstand-eng)' : '0' }}>
                      <IonItem
                        button
                        onClick={() => onSelectRequest(request)}
                        detail={false}
                        lines="none"
                        style={{
                          '--background': 'transparent',
                          '--padding-start': '0',
                          '--padding-end': '0',
                          '--inner-padding-end': '0',
                          '--inner-border-width': '0',
                          '--border-style': 'none',
                          '--min-height': 'auto'
                        }}
                      >
                        <div
                          className="app-list-item app-list-item--success"
                          style={{
                            width: '100%',
                            borderLeftColor: statusColor,
                            opacity: (isApproved || isRejected) ? 0.7 : 1,
                            position: 'relative',
                            overflow: 'hidden'
                          }}
                        >
                          {/* Eselsohr-Style Corner Badges - Team links innen, Status in der Ecke */}
                          <div className="app-corner-badges">
                            {request.activity_target_role === 'teamer' && (
                              <>
                                <div
                                  className="app-corner-badge"
                                  style={{ backgroundColor: 'var(--app-color-teamer)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--app-abstand-mini) var(--app-abstand-eng)' }}
                                  title="Team-Aktivität"
                                  role="img"
                                  aria-label="Team-Aktivität"
                                >
                                  <IonIcon icon={ICON_GRUPPE_GEFUELLT} style={{ color: 'white', fontSize: 'var(--app-text-sekundaer)' }} />
                                </div>
                                <div className="app-corner-badges__separator" />
                              </>
                            )}
                            <StatusBadge statusText={statusText} statusColor={statusColor} />
                          </div>
                          <div className="app-list-item__row">
                            <div className="app-list-item__main">
                              {/* Status Icon */}
                              <div
                                className="app-icon-circle app-icon-circle--lg"
                                style={{ backgroundColor: statusColor }}
                              >
                                <IonIcon icon={isPending ? ICON_WARTEND_GEFUELLT : isApproved ? ICON_ZUSAGE_GEFUELLT : ICON_ABSAGE} />
                              </div>

                              {/* Content */}
                              <div className="app-list-item__content">
                                {/* Zeile 1: Konfi-Name */}
                                <div
                                  className="app-list-item__title"
                                  style={{
                                    color: (isApproved || isRejected) ? 'var(--app-text-muted)' : undefined,
                                    paddingRight: 'var(--app-freiraum-aktion-l)'
                                  }}
                                >
                                  {request.konfi_name}
                                </div>

                                {/* Zeile 2: Aktivitätsname */}
                                <div className="app-list-item__subtitle" style={{
                                  color: (isApproved || isRejected) ? 'var(--app-text-muted)' : 'var(--app-text-secondary)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {request.activity_name}
                                </div>

                                {/* Zeile 3: Meta-Infos */}
                                <div className="app-list-item__meta">
                                  <span className="app-list-item__meta-item">
                                    <IonIcon icon={ICON_TERMIN_GEFUELLT} style={{ color: (isApproved || isRejected) ? 'var(--app-text-muted)' : 'var(--app-color-success-strong)' }} />
                                    {formatDate(request.requested_date)}
                                  </span>
                                  {/* Teamer-Antraege sind reiner Nachweis -> KEINE Punkte und KEIN
                                      Punkte-Typ (GD/Gem.) anzeigen; stattdessen "Team"-Kennzeichnung. */}
                                  {request.activity_target_role === 'teamer' ? (
                                    <span className="app-list-item__meta-item">
                                      <IonIcon icon={ICON_GRUPPE_GEFUELLT} style={{ color: (isApproved || isRejected) ? 'var(--app-text-muted)' : 'var(--app-text-teamer)' }} />
                                      Team
                                    </span>
                                  ) : (
                                    <>
                                      {request.activity_points && (
                                        <span className="app-list-item__meta-item">
                                          <IonIcon icon={ICON_POKAL_GEFUELLT} style={{ color: (isApproved || isRejected) ? 'var(--app-text-muted)' : 'var(--app-color-warning)' }} />
                                          {request.activity_points}P
                                        </span>
                                      )}
                                      <span className="app-list-item__meta-item">
                                        <IonIcon
                                          icon={getTypeIcon(request.activity_type || 'gemeinde')}
                                          style={{ color: (isApproved || isRejected) ? 'var(--app-text-muted)' : getTypeColor(request.activity_type || 'gemeinde') }}
                                        />
                                        {request.activity_type === 'gottesdienst' ? 'GD' : 'Gem.'}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </IonItem>

                      {/* Swipe Actions: Admins loeschen Antraege NICHT (nur ablehnen ueber
                          die Detail-Ansicht). Loeschen duerfen nur Konfi/Teamer ihre eigenen. */}
                      {/* Ohne das Recht "Anträge entscheiden" kein Zurücksetzen
                          (der Server antwortet 403); die Zeile bleibt lesbar. */}
                      {!isPending && request.darf_entscheiden !== false && (
                        <IonItemOptions side="end" className="app-swipe-actions">
                          {/* Reset-Button für approved/rejected */}
                          <IonItemOption
                            onClick={() => { closeOpenSlidingItems(); onResetRequest(request); }}
                            aria-label="Aktivität zurücksetzen"
                            className="app-swipe-action"
                          >
                            <div className="app-icon-circle app-icon-circle--lg app-icon-circle--warning">
                              <IonIcon icon={ICON_ANTWORTEN} />
                            </div>
                          </IonItemOption>
                        </IonItemOptions>
                      )}
                    </IonItemSliding>
                  );
                })}
      </ListSection>
      <WeitereEintraege weitere={weitereAntraege} onMehr={mehrAntraege} bezeichnung="Aktivitäten" />
    </>
  );
};

export default ActivityRequestsView;
