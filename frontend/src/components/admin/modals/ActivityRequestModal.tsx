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
  IonTextarea,
  IonIcon,
  IonSpinner,
  IonList,
  IonListHeader,
  IonCard,
  IonCardContent,
} from '@ionic/react';
import {
  ICON_ABSAGE,
  ICON_HAKEN,
  ICON_KAMERA_GEFUELLT,
  ICON_LOESCHEN_GEFUELLT,
  ICON_SCHLIESSEN,
  ICON_TEXTDOKUMENT_GEFUELLT,
  ICON_ZUSAGE_GEFUELLT,
} from '../../shared/icons';
import NachweisFoto from '../../shared/NachweisFoto';
import { datumKurz, datumUhrzeit } from '../../../utils/dateUtils';
import { punkteText } from '../../../utils/punkteText';
import { useAntragPruefen } from './useAntragPruefen';
// triggerRefresh nicht direkt nutzen — Modal rendert via useIonModal außerhalb des Provider-Trees
// Stattdessen onSuccess Callback nutzen, Parent-Page hat useLiveRefresh.
// Laden, Foto löschen und Entscheiden stehen in useAntragPruefen -- dieselbe
// Logik wie im Dialog der Web-Fassung (web/termine/WebAntragPruefenDialog).

interface ActivityRequestModalProps {
  requestId?: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

const ActivityRequestModal: React.FC<ActivityRequestModalProps> = ({
  requestId,
  onClose,
  onSuccess
}) => {
  const {
    request,
    loading,
    adminComment,
    setAdminComment,
    selectedAction,
    setSelectedAction,
    deletingPhoto,
    handleDeletePhoto,
    handleSubmit,
    isSubmitting,
    isPending,
    isApproved,
    darfEntscheiden,
  } = useAntragPruefen({ requestId, onSuccess, onClose });

  const formatDate = (dateString: string) => {
    return datumKurz(dateString);
  };

  const formatDateTime = (dateString: string) => {
    return datumUhrzeit(dateString);
  };

  if (!request) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Aktivität laden...</IonTitle>
            <IonButtons slot="start">
              <IonButton aria-label="Schließen" onClick={onClose} className="app-modal-close-btn">
                <IonIcon icon={ICON_SCHLIESSEN} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div style={{ padding: 'var(--app-abstand-riesig) var(--app-abstand-gross)', textAlign: 'center' }}>
            <IonSpinner name="crescent" />
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Aktivität prüfen</IonTitle>
          <IonButtons slot="start">
            <IonButton aria-label="Schließen" onClick={onClose} disabled={isSubmitting} className="app-modal-close-btn">
              <IonIcon icon={ICON_SCHLIESSEN} />
            </IonButton>
          </IonButtons>
          {isPending && darfEntscheiden && selectedAction && (
            <IonButtons slot="end">
              <IonButton aria-label="Entscheidung speichern" onClick={() => { void handleSubmit(); }} disabled={isSubmitting || (selectedAction === 'reject' && !adminComment.trim())} className="app-modal-submit-btn app-modal-submit-btn--activities">
                {isSubmitting ? <IonSpinner name="crescent" /> : <IonIcon icon={ICON_HAKEN} />}
              </IonButton>
            </IonButtons>
          )}
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        {/* SEKTION: Daten zur Aktivität */}
        <IonList inset={true} className="app-modal-section">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--requests">
              <IonIcon icon={ICON_TEXTDOKUMENT_GEFUELLT} />
            </div>
            <IonLabel>Daten zur Aktivität</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent>
              <IonList>
                {/* Konfi */}
                <IonItem lines="inset">
                  <IonLabel>
                    <p>Konfi</p>
                    <h2>
                      {request.konfi_name}
                      {request.jahrgang_name && (
                        <span style={{ color: 'var(--app-text-secondary)', fontWeight: 'var(--app-schrift-normal)', marginLeft: 'var(--app-abstand-eng)' }}>
                          ({request.jahrgang_name})
                        </span>
                      )}
                    </h2>
                  </IonLabel>
                </IonItem>

                {/* Aktivität — bei Teamer-Antraegen kein Punkte-Typ (reiner Nachweis) */}
                <IonItem lines="inset">
                  <IonLabel>
                    <p>{request.activity_target_role === 'teamer'
                      ? 'Aktivität (Team)'
                      : `Aktivität (${request.activity_type === 'gottesdienst' ? 'Gottesdienst' : 'Gemeinde'})`}</p>
                    <h2>{request.activity_name}</h2>
                  </IonLabel>
                </IonItem>

                {/* Punkte — nur fuer Konfi-Antraege; Teamer-Aktivitaeten geben keine Punkte */}
                {request.activity_target_role !== 'teamer' && request.activity_points && (
                  <IonItem lines="inset">
                    <IonLabel>
                      <p>Punkte</p>
                      <h2>{punkteText(request.activity_points)}</h2>
                    </IonLabel>
                  </IonItem>
                )}

                {/* Teilnahmedatum */}
                <IonItem lines="inset">
                  <IonLabel>
                    <p>Teilnahmedatum</p>
                    <h2>{formatDate(request.requested_date)}</h2>
                  </IonLabel>
                </IonItem>

                {/* Eingereicht */}
                <IonItem lines="inset">
                  <IonLabel>
                    <p>Eingereicht</p>
                    <h2>{formatDateTime(request.created_at)}</h2>
                  </IonLabel>
                </IonItem>

                {/* Kommentar */}
                {request.comment && (
                  <IonItem lines="none">
                    <IonLabel className="ion-text-wrap">
                      <p>Kommentar vom Konfi</p>
                      <h2 style={{ whiteSpace: 'pre-wrap' }}>{request.comment}</h2>
                    </IonLabel>
                  </IonItem>
                )}
              </IonList>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* SEKTION: Foto - sobald ein Foto vorhanden ist (auch verbucht/abgelehnt) */}
        {request.photo_filename && (
          <IonList inset={true} className="app-modal-section">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--requests">
                <IonIcon icon={ICON_KAMERA_GEFUELLT} />
              </div>
              <IonLabel>Nachweis-Foto</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent style={{ padding: 'var(--app-abstand-basis)' }}>
                {/* Vorher: bei einem Ladefehler stand "Lade Foto..." für
                    immer da. Jetzt Fortschritt, Fehler mit "Erneut
                    versuchen", ohne Netz die graue Zeile. */}
                <NachweisFoto key={request.id} antragId={request.id} leitung />

                <IonButton
                  expand="block"
                  fill="outline"
                  onClick={handleDeletePhoto}
                  disabled={deletingPhoto}
                  style={{
                    marginTop: 'var(--app-abstand-basis)',
                    '--border-color': 'var(--app-color-danger)',
                    '--color': 'var(--app-color-danger)',
                    '--border-width': '2px',
                    fontWeight: 'var(--app-schrift-halbfett)'
                  }}
                >
                  <IonIcon icon={ICON_LOESCHEN_GEFUELLT} slot="start" />
                  {deletingPhoto ? 'Lösche...' : 'Foto löschen'}
                </IonButton>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* SEKTION: Bearbeitungsstatus für approved/rejected */}
        {!isPending && (
          <IonList inset={true} className="app-modal-section">
            <IonListHeader>
              <div
                className="app-section-icon"
                style={{ backgroundColor: isApproved ? 'var(--app-color-success-strong)' : 'var(--app-color-danger)' }}
              >
                <IonIcon icon={isApproved ? ICON_ZUSAGE_GEFUELLT : ICON_ABSAGE} />
              </div>
              <IonLabel>Bearbeitungsstatus</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent>
                <IonList>
                  <IonItem lines="inset">
                    <IonLabel className="ion-text-wrap">
                      <p>Status</p>
                      <h2 style={{ color: isApproved ? 'var(--app-color-success-strong)' : 'var(--app-color-danger)' }}>
                        {isApproved ? 'Verbucht' : 'Abgelehnt'} {request.approved_by_name ? `von ${request.approved_by_name}` : ''} am {formatDateTime(request.updated_at)}
                      </h2>
                    </IonLabel>
                  </IonItem>

                  {/* Begründung */}
                  {request.admin_comment && (
                    <IonItem lines="none">
                      <IonLabel className="ion-text-wrap">
                        <p>{isApproved ? 'Kommentar' : 'Begründung'}</p>
                        <h2 style={{ color: isApproved ? 'var(--app-text-primary)' : 'var(--app-color-danger)', whiteSpace: 'pre-wrap' }}>
                          {request.admin_comment}
                        </h2>
                      </IonLabel>
                    </IonItem>
                  )}
                </IonList>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* SEKTION: Aktion - NUR bei pending */}
        {isPending && (
          <IonList inset={true} className="app-modal-section">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--requests">
                <IonIcon icon={ICON_ZUSAGE_GEFUELLT} />
              </div>
              <IonLabel>Entscheidung</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              {!darfEntscheiden ? (
                <IonCardContent className="app-info-box app-info-box--blue">
                  Über diesen Antrag entscheidet jemand anderes. Das Recht vergibt die Gemeindeleitung.
                </IonCardContent>
              ) : (
              <IonCardContent style={{ padding: 'var(--app-abstand-basis)' }}>
                <div style={{ display: 'flex', gap: 'var(--app-abstand-mittel)' }}>
                  <IonButton
                    fill="outline"
                    onClick={() => !loading && setSelectedAction('approve')}
                    disabled={loading}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      '--border-color': 'var(--app-color-success-strong)',
                      '--color': selectedAction === 'approve' ? 'white' : 'var(--app-color-success-strong)',
                      '--background': selectedAction === 'approve' ? 'var(--app-color-success-strong)' : 'transparent',
                      '--border-width': '2px',
                      '--border-radius': 'var(--app-radius-karte)',
                      fontWeight: 'var(--app-schrift-halbfett)'
                    }}
                  >
                    <IonIcon icon={ICON_ZUSAGE_GEFUELLT} slot="start" />
                    Genehmigen
                  </IonButton>
                  <IonButton
                    fill="outline"
                    onClick={() => !loading && setSelectedAction('reject')}
                    disabled={loading}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      '--border-color': 'var(--app-color-danger)',
                      '--color': selectedAction === 'reject' ? 'white' : 'var(--app-color-danger)',
                      '--background': selectedAction === 'reject' ? 'var(--app-color-danger)' : 'transparent',
                      '--border-width': '2px',
                      '--border-radius': 'var(--app-radius-karte)',
                      fontWeight: 'var(--app-schrift-halbfett)'
                    }}
                  >
                    <IonIcon icon={ICON_ABSAGE} slot="start" />
                    Ablehnen
                  </IonButton>
                </div>

                {/* Ablehnungsgrund - nur wenn Ablehnen gewählt */}
                {selectedAction === 'reject' && (
                  <div style={{ marginTop: 'var(--app-abstand-basis)' }}>
                    <IonLabel style={{ fontSize: 'var(--app-text-sekundaer)', color: 'var(--app-text-secondary)', marginBottom: 'var(--app-abstand-eng)', display: 'block' }}>
                      Grund für die Ablehnung *
                    </IonLabel>
                    <IonTextarea aria-label="Grund für die Ablehnung"
                      value={adminComment}
                      onIonInput={(e) => setAdminComment(e.detail.value!)}
                      placeholder="Bitte gib einen Grund für die Ablehnung an..."
                      rows={3}
                      disabled={loading}
                      style={{
                        width: '100%',
                        background: 'var(--app-surface-muted)',
                        borderRadius: 'var(--app-radius-klein)',
                        padding: 'var(--app-abstand-eng)',
                        '--padding-start': 'var(--app-abstand-mittel)',
                        '--padding-end': 'var(--app-abstand-mittel)'
                      }}
                    />
                  </div>
                )}
              </IonCardContent>
              )}
            </IonCard>
          </IonList>
        )}
      </IonContent>
    </IonPage>
  );
};

export default ActivityRequestModal;
