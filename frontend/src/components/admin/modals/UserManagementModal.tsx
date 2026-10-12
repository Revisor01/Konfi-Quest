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
  IonToggle,
  IonCard,
  IonCardContent,
  IonIcon,
  IonList,
  IonListHeader,
  IonSpinner,
  useIonAlert
} from '@ionic/react';
import {
  ICON_HAKEN,
  ICON_JAHRGANG,
  ICON_OFFLINE,
  ICON_PERSON,
  ICON_SCHILD,
  ICON_SCHLIESSEN,
  ICON_ZUSAGE_GEFUELLT,
} from '../../shared/icons';
import { tastaturKlick } from '../../../utils/tastatur';
import { datumKurz } from '../../../utils/dateUtils';
import { rollenName, rollenFarbeVar, rollenTonVar } from '../../../utils/rollenNamen';
import { FREIGABE_RECHTE, alleRechte, rollenBeschreibung, useBenutzerFormular } from '../useBenutzerFormular';

// Laden, Vorbelegung, Rechte, Pruefen und Speichern stehen seit 11.10.2026 in
// useBenutzerFormular -- dieselbe Logik zeigt der Browser ab 992 px als
// eigenen Dialog (web/leitung/WebBenutzerDialog.tsx). Hier steht nur die
// Darstellung der App.

interface UserManagementModalProps {
  userId?: number | null;
  // Rolle fest vorgeben (Rollenname, z.B. 'teamer'). Dann entfaellt die
  // Rollenauswahl komplett und der Dialog fuehrt genau eine Sache aus.
  // Gedacht für den Plus-Button in der Konfi-Übersicht: der heißt dort
  // "Neue Teamer:in anlegen", zeigte aber die volle Rollenauswahl inklusive
  // Admin — und ein so angelegter Admin tauchte in der Teamer-Liste gar nicht
  // auf (Nutzerhinweis 22.08.2026). Ohne diese Prop bleibt alles wie bisher.
  festeRolle?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const UserManagementModal: React.FC<UserManagementModalProps> = ({
  userId,
  festeRolle,
  onClose,
  onSuccess
}) => {
  const {
    currentUser, isOnline, isSubmitting, loading, isDirty, isEditMode, nameAutomatisch, nurRolle,
    formData, setFormData, jahrgaenge, user, jahrgangAssignments, jahrgangRechte, rechteFelder, rechteVergeben,
    getAllowedRoles, isValid, handleSave, setzeRecht, handleJahrgangAssignment,
  } = useBenutzerFormular({ userId, festeRolle, onSuccess });
  const [presentAlert] = useIonAlert();

  const doClose = () => onClose();

  const handleClose = () => {
    if (isDirty) {
      presentAlert({
        header: 'Ungespeicherte Änderungen',
        message: 'Möchtest du die Änderungen verwerfen?',
        buttons: [
          { text: 'Abbrechen', role: 'cancel' },
          { text: 'Verwerfen', role: 'destructive', handler: () => doClose() }
        ]
      });
    } else {
      doClose();
    }
  };

  // Farbwelt des Dialogs: Wird er als "Neue Teamer:in" geoeffnet, nutzt er die
  // Teamer-Farbe (--app-color-teamer) statt der allgemeinen Nutzer-Farbe —
  // sonst passt er nicht zu der Ansicht, aus der er aufgerufen wird
  // (Nutzerhinweis 23.08.2026).
  const farbe = festeRolle === 'teamer' ? 'teamer' : 'users';

  // Rollenfarbe als Token (25.09.2026) -- seit 29.09.2026 aus EINER Stelle
  // (utils/rollenNamen: rollenFarbe), mit eigener Farbe fuer die Leitung.
  const getRoleColor = (roleName: string) => rollenFarbeVar(roleName);
  const getRoleTint = (roleName: string) => rollenTonVar(roleName);

  // Klare Beschreibung je Rolle (unabhaengig vom technischen DB-Text).
  const getRoleDescription = rollenBeschreibung;

  if (loading) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle>{isEditMode ? 'Benutzer bearbeiten' : (festeRolle === 'teamer' ? 'Neue Teamer:in' : 'Neuer Benutzer')}</IonTitle>
            <IonButtons slot="start">
              <IonButton aria-label="Schließen" onClick={handleClose} className="app-modal-close-btn">
                <IonIcon icon={ICON_SCHLIESSEN} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
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
          <IonTitle>{isEditMode ? 'Benutzer bearbeiten' : (festeRolle === 'teamer' ? 'Neue Teamer:in' : 'Neuer Benutzer')}</IonTitle>
          <IonButtons slot="start">
            <IonButton aria-label="Schließen" onClick={onClose} disabled={isSubmitting} className="app-modal-close-btn">
              <IonIcon icon={ICON_SCHLIESSEN} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton aria-label="Benutzer:in speichern" onClick={handleSave} disabled={!isValid || isSubmitting || !isOnline} className={`app-modal-submit-btn app-modal-submit-btn--${festeRolle === "teamer" ? "teamer" : "settings"}`}>
              {!isOnline ? <><IonIcon icon={ICON_OFFLINE} /> Du bist offline</> : isSubmitting ? <IonSpinner name="crescent" /> : <IonIcon icon={ICON_HAKEN} />}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        {/* SEKTION: Persönliche Daten */}
        <IonList inset={true} className="app-modal-section">
          <IonListHeader>
            <div className={`app-section-icon app-section-icon--${farbe}`}>
              <IonIcon icon={ICON_PERSON} />
            </div>
            <IonLabel>Persönliche Daten</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent>
              {nurRolle && (
                <p style={{ margin: '0 0 var(--app-abstand-basis) 0', color: 'var(--app-text-secondary)', fontSize: 'var(--app-text-hinweis)' }}>
                  Diese Person ist in einer anderen Gemeinde zuhause. Hier änderst du
                  ihre Rolle, ihre Funktionsbeschreibung und ihre Jahrgänge bei dir
                  und kannst sie bei dir sperren; Name, Benutzername und E-Mail
                  verwaltet ihre Stamm-Gemeinde. Ein neues Passwort gilt in allen
                  ihren Gemeinden.
                </p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <IonItem lines="full" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">Anzeigename *</IonLabel>
                  <IonInput aria-label="Anzeigename" aria-required="true"
                    value={formData.display_name}
                    onIonInput={(e) => setFormData({ ...formData, display_name: e.detail.value! })}
                    placeholder="Max Mustermann"
                    disabled={isSubmitting || nurRolle}
                  />
                </IonItem>

                {/* Benutzername: Beim Anlegen mit fester Rolle erzeugt ihn der
                    Server aus dem Anzeigenamen (wie bei Konfis). Beim
                    Bearbeiten bleibt er sichtbar und aenderbar. */}
                {!nameAutomatisch && (
                <IonItem lines="full" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">Benutzername *</IonLabel>
                  <IonInput aria-label="Benutzername" aria-required="true"
                    value={formData.username}
                    onIonInput={(e) => setFormData({ ...formData, username: e.detail.value! })}
                    placeholder="max.mustermann"
                    disabled={isSubmitting || nurRolle}
                  />
                </IonItem>
                )}

                <IonItem lines="full" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">Funktionsbeschreibung (optional)</IonLabel>
                  <IonInput aria-label="Funktionsbeschreibung (optional)"
                    value={formData.role_title}
                    onIonInput={(e) => setFormData({ ...formData, role_title: e.detail.value! })}
                    placeholder="z.B. Pastor, Diakonin, Jugendmitarbeiter"
                    disabled={isSubmitting}
                  />
                </IonItem>

                <IonItem lines="full" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">E-Mail (optional)</IonLabel>
                  <IonInput aria-label="E-Mail (optional)"
                    type="email"
                    value={formData.email}
                    onIonInput={(e) => setFormData({ ...formData, email: e.detail.value! })}
                    placeholder="max@example.com"
                    disabled={isSubmitting || nurRolle}
                  />
                </IonItem>

                <IonItem lines="none" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">
                    Passwort {!isEditMode && <span style={{ color: 'var(--app-color-danger)' }}>*</span>}
                  </IonLabel>
                  <IonInput aria-label="Passwort"
                    type="password"
                    value={formData.password}
                    onIonInput={(e) => setFormData({ ...formData, password: e.detail.value! })}
                    placeholder={isEditMode ? "Leer lassen um nicht zu ändern" : "Passwort eingeben"}
                    disabled={isSubmitting}
                  />
                </IonItem>
              </div>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* SEKTION: Rolle und Status.
            Faellt ganz weg, wenn beides entfaellt: Beim Anlegen einer
            Teamer:in ist die Rolle vorgegeben (festeRolle) UND der
            Aktiv-Schalter erscheint nur beim Bearbeiten — die Karte war dann
            leer (Nutzerhinweis 23.08.2026). */}
        {(!festeRolle || isEditMode) && (
        <IonList inset={true} className="app-modal-section">
          <IonListHeader>
            <div className={`app-section-icon app-section-icon--${farbe}`}>
              <IonIcon icon={ICON_SCHILD} />
            </div>
            <IonLabel>{festeRolle ? 'Status' : 'Rolle & Status'}</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: 'var(--app-abstand-basis) var(--app-abstand-basis) var(--app-abstand-eng) var(--app-abstand-basis)' }}>
              {/* Rolle - klickbare Liste. Entfaellt, wenn die Rolle von aussen
                  festgelegt ist (festeRolle): Der Dialog heisst dann bereits
                  nach der Rolle, eine Auswahl waere widerspruechlich. */}
              {!festeRolle && (
              <div style={{ marginBottom: 'var(--app-abstand-basis)' }}>
                <IonLabel style={{ fontSize: 'var(--app-text-sekundaer)', color: 'var(--app-text-secondary)', marginBottom: 'var(--app-abstand-eng)', display: 'block' }}>
                  Rolle *
                </IonLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--app-abstand-eng)' }}>
                  {getAllowedRoles().map(role => {
                    const isSelected = formData.role_id === role.id;
                    const roleColor = getRoleColor(role.name);

                    return (
                      <div role="button" tabIndex={0} onKeyDown={tastaturKlick}
                        key={role.id}
                        className="app-list-item"
                        onClick={() => !isSubmitting && setFormData({ ...formData, role_id: role.id })}
                        style={{
                          cursor: isSubmitting ? 'default' : 'pointer',
                          opacity: isSubmitting ? 0.6 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '0',
                          borderLeftColor: roleColor,
                          background: isSelected ? getRoleTint(role.name) : undefined
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--app-abstand-mittel)' }}>
                          <div
                            className="app-icon-circle"
                            style={{ backgroundColor: roleColor, width: '32px', height: '32px' }}
                          >
                            <IonIcon icon={ICON_SCHILD} style={{ fontSize: 'var(--app-text-basis)' }} />
                          </div>
                          <div>
                            <span style={{ fontWeight: 'var(--app-schrift-mittel)', color: 'var(--app-text-primary)', display: 'block' }}>
                              {rollenName(role.name)}
                            </span>
                            {getRoleDescription(role.name) && (
                              <span style={{ fontSize: 'var(--app-text-klein)', color: 'var(--app-text-system)', display: 'block', marginTop: 'var(--app-abstand-winzig)', lineHeight: 1.35 }}>
                                {getRoleDescription(role.name)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              )}

              {/* Konto aktiv — nur beim BEARBEITEN. Beim Anlegen ist der
                  Schalter sinnlos: Niemand legt ein Konto an, das sich nicht
                  anmelden kann (Nutzerhinweis 23.08.2026). Neue Konten sind
                  immer aktiv; deaktivieren geht danach unter Nutzende. */}
              {isEditMode && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--app-abstand-mittel) 0',
                borderTop: '1px solid rgba(0,0,0,0.06)'
              }}>
                <div>
                  <h3 style={{ fontWeight: 'var(--app-schrift-mittel)', margin: '0 0 var(--app-abstand-mini) 0', fontSize: 'var(--app-text-betont)' }}>Konto aktiv</h3>
                  <p style={{ color: 'var(--app-text-secondary)', margin: 0, fontSize: 'var(--app-text-hinweis)' }}>
                    {nurRolle ? 'Gilt nur für diese Gemeinde' : 'Benutzer kann sich anmelden'}
                  </p>
                </div>
                <IonToggle aria-label="Konto aktiv"
                  className={`app-toggle--${farbe}`}
                  checked={formData.is_active}
                  onIonChange={(e) => setFormData({ ...formData, is_active: e.detail.checked })}
                  disabled={isSubmitting}
                />
              </div>
              )}
            </IonCardContent>
          </IonCard>
        </IonList>
        )}

        {/* SEKTION: Jahrgang-Zuweisungen */}
        <IonList inset={true} className="app-modal-section">
          <IonListHeader>
            <div className={`app-section-icon app-section-icon--${farbe}`}>
              <IonIcon icon={ICON_JAHRGANG} />
            </div>
            <IonLabel>Jahrgang-Zuweisungen</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: 'var(--app-abstand-basis)' }}>
            {jahrgaenge.length === 0 ? (
              <IonItem lines="none" style={{ '--background': 'transparent' }}>
                <IonLabel style={{ textAlign: 'center' }}>
                  {/* Fuer einen Admin ohne eigene Jahrgaenge waere "keine
                      verfuegbar" irrefuehrend -- es GIBT welche, er darf sie
                      nur nicht vergeben. Derselbe Fehler wie frueher in der
                      Konfi-Liste ("Noch keine Konfis angelegt"), Befund aus
                      dem Rollen-Bericht vom 26.08.2026. */}
                  <p style={{ color: 'var(--app-text-muted)', margin: 0 }}>
                    {currentUser?.role_name === 'admin'
                      ? 'Dir ist kein Jahrgang zugewiesen. Zuweisen kann nur die Gemeindeleitung.'
                      : 'Keine Jahrgänge verfügbar'}
                  </p>
                </IonLabel>
              </IonItem>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {rechteVergeben && (
                  <p style={{ margin: '0 0 var(--app-abstand-basis) 0', color: 'var(--app-text-secondary)', fontSize: 'var(--app-text-hinweis)' }}>
                    Wer ein Recht nicht hat, sieht die Vorgänge weiter, kann sie
                    aber nicht entscheiden. Die Gemeindeleitung hat alle Rechte immer.
                  </p>
                )}
                {jahrgaenge.map((jahrgang, index) => {
                  const isAssigned = jahrgangAssignments[jahrgang.id] || false;
                  const rechte = alleRechte(jahrgangRechte[jahrgang.id]);

                  return (
                    <React.Fragment key={jahrgang.id}>
                    <div role="button" tabIndex={0} onKeyDown={tastaturKlick}
                      className={`app-list-item app-list-item--${farbe}`}
                      onClick={() => !isSubmitting && handleJahrgangAssignment(jahrgang.id, !isAssigned)}
                      style={{
                        cursor: isSubmitting ? 'default' : 'pointer',
                        opacity: isSubmitting ? 0.6 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: index < jahrgaenge.length - 1 ? 'var(--app-abstand-eng)' : '0',
                        background: isAssigned ? 'rgba(var(--app-color-users-rgb), 0.08)' : undefined
                      }}
                    >
                      <span style={{ fontWeight: 'var(--app-schrift-mittel)', color: 'var(--app-text-primary)' }}>{jahrgang.name}</span>
                    </div>
                    {/* Die Rechte stehen NEBEN der Zeile, nicht in ihr: Ein
                        Tipp auf einen Schalter darf den Jahrgang nicht abwaehlen. */}
                    {rechteVergeben && isAssigned && (
                      <div role="group" aria-label={`Rechte für ${jahrgang.name}`}
                        style={{ padding: '0 var(--app-abstand-basis)', marginBottom: index < jahrgaenge.length - 1 ? 'var(--app-abstand-eng)' : '0' }}>
                        {FREIGABE_RECHTE.filter(({ feld }) => rechteFelder.includes(feld)).map(({ feld, text }, i) => (
                          <div key={feld} style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: 'var(--app-abstand-schmal) 0',
                            borderTop: i > 0 ? '1px solid rgba(0,0,0,0.06)' : undefined
                          }}>
                            <span style={{ fontSize: 'var(--app-text-sekundaer)', color: 'var(--app-text-primary)' }}>{text}</span>
                            <IonToggle aria-label={`${text} (${jahrgang.name})`}
                              className={`app-toggle--${farbe}`}
                              checked={rechte[feld]}
                              onIonChange={(e) => setzeRecht(jahrgang.id, feld, e.detail.checked)}
                              disabled={isSubmitting}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </IonCardContent>
        </IonCard>

        </IonList>

        {/* Bestehende Zuweisungen im Edit-Modus - als eigene Sektion */}
        {isEditMode && user?.assigned_jahrgaenge && user.assigned_jahrgaenge.length > 0 && (
          <IonList inset={true} className="app-modal-section">
            <IonListHeader>
              <div className={`app-section-icon app-section-icon--${farbe}`}>
                <IonIcon icon={ICON_ZUSAGE_GEFUELLT} />
              </div>
              <IonLabel>Aktuelle Zuweisungen</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent style={{ padding: 'var(--app-abstand-basis)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--app-abstand-eng)' }}>
                  {user.assigned_jahrgaenge.map(assignment => (
                    <div
                      key={assignment.id}
                      className={`app-list-item app-list-item--${farbe}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--app-abstand-schmal)'
                      }}
                    >
                      <IonIcon icon={ICON_ZUSAGE_GEFUELLT} style={{ color: 'var(--app-text-users)', fontSize: 'var(--app-text-gross)', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: 'var(--app-schrift-mittel)', fontSize: 'var(--app-text-basis)', color: 'var(--app-text-primary)', display: 'block' }}>
                          {assignment.name}
                        </span>
                        <span style={{ fontSize: 'var(--app-text-klein)', color: 'var(--app-text-system)' }}>
                          {assignment.assigned_at && datumKurz(assignment.assigned_at)}
                          {assignment.assigned_by_name && ` von ${assignment.assigned_by_name}`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}
      </IonContent>
    </IonPage>
  );
};

export default UserManagementModal;
