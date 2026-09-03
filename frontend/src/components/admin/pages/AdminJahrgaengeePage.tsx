import { fehlerDaten, fehlerText } from '../../../utils/fehler';
import React, { useState, useEffect, useRef } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonButtons,
  IonButton,
  IonIcon,
  useIonModal,
  useIonAlert,
  IonCard,
  IonCardContent,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonInput,
  IonSpinner,
  IonToggle,
  IonRange
} from '@ionic/react';
import {
  add,
  school,
  checkmarkOutline,
  closeOutline,
  arrowBack,
  trash,
  schoolOutline,
  settingsOutline,
  sparklesOutline,
  checkmarkCircle,
  closeCircle,
  trophy,
  home,
  people
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { offlineBlockiert } from '../../../utils/offlineAktion';
import { useModalPage } from '../../../contexts/ModalContext';
import { useLiveRefresh } from '../../../contexts/LiveUpdateContext';
import api from '../../../services/api';
import { writeQueue } from '../../../services/writeQueue';
import { networkMonitor } from '../../../services/networkMonitor';
import { useOfflineQuery } from '../../../hooks/useOfflineQuery';
import { CACHE_TTL } from '../../../services/offlineCache';
import LoadingSpinner from '../../common/LoadingSpinner';
import { SectionHeader, ListSection } from '../../shared';
import { triggerPullHaptic } from '../../../utils/haptics';
import { safeUUID } from '../../../utils/uuid';
import { closeOpenSlidingItems } from '../../../utils/slidingItems';

// Ionic 9 gibt bei ref an IonItemSliding die React-Komponente zurueck, nicht
// mehr das DOM-Element. Gebraucht wird hier nur close() — das haben beide.
type SlidingRef = { close: () => Promise<void> };

interface Jahrgang {
  id: number;
  name: string;
  created_at: string;
  gottesdienst_enabled?: boolean;
  gemeinde_enabled?: boolean;
  target_gottesdienst?: number;
  target_gemeinde?: number;
  konfspruch_enabled?: boolean;
  wrapped_released_at?: string | null;
  konfi_count?: number;
  gottesdienst_points_total?: number;
  gemeinde_points_total?: number;
}

// Personen, die beim Anlegen direkt Zugriff auf den neuen Jahrgang bekommen
// koennen (Simons Entscheidung 01.09.2026: nur der Org-Admin legt Jahrgaenge
// an und weist dabei direkt zu). Angeboten werden Admins und Teamer:innen —
// Org-Admins sehen ohnehin alle Jahrgaenge, Konfis gehoeren zu einem Jahrgang
// statt ihm zugewiesen zu werden.
interface ZuweisbarePerson {
  id: number;
  display_name: string;
  role_name: string;
}

interface JahrgangModalProps {
  jahrgang?: Jahrgang | null;
  onClose: () => void;
  onSuccess: () => void;
  onRefresh?: () => void;
  dismiss?: () => void;
}

const JahrgangModal: React.FC<JahrgangModalProps> = ({
  jahrgang,
  onClose,
  onSuccess,
  onRefresh,
  dismiss
}) => {
  const handleClose = () => {
    if (dismiss) {
      dismiss();
    } else {
      onClose();
    }
  };
  const { user, setSuccess, setError } = useApp();
  const [loading, setLoading] = useState(false);

  // Direkt-Zuweisung beim Anlegen: Auswahl der Personen, die Zugriff auf den
  // neuen Jahrgang bekommen. Optional — niemand MUSS zugewiesen werden.
  // Nur im Anlege-Modus relevant (beim Bearbeiten laeuft die Zuweisung wie
  // gehabt ueber Mehr > Benutzer:innen).
  const [zuweisbare, setZuweisbare] = useState<ZuweisbarePerson[]>([]);
  const [ausgewaehlt, setAusgewaehlt] = useState<{ [id: number]: boolean }>({});
  const [presentAlert] = useIonAlert();
  // Lokaler Zustand des Wrapped-Releases, damit der Toggle nach generate/delete
  // sofort den neuen Stand zeigt (das Modal bleibt offen).

  const [formData, setFormData] = useState({
    name: '',
    gottesdienst_enabled: true,
    gemeinde_enabled: true,
    target_gottesdienst: 10,
    target_gemeinde: 10,
    konfspruch_enabled: true
  });

  useEffect(() => {
    if (jahrgang) {
      setFormData({
        name: jahrgang.name,
        gottesdienst_enabled: jahrgang.gottesdienst_enabled ?? true,
        gemeinde_enabled: jahrgang.gemeinde_enabled ?? true,
        target_gottesdienst: jahrgang.target_gottesdienst ?? 10,
        target_gemeinde: jahrgang.target_gemeinde ?? 10,
        konfspruch_enabled: jahrgang.konfspruch_enabled ?? true
      });
    } else {
      setFormData({
        name: '',
        gottesdienst_enabled: true,
        gemeinde_enabled: true,
        target_gottesdienst: 10,
        target_gemeinde: 10,
        konfspruch_enabled: true
      });
    }
    // Auswahl der Direkt-Zuweisung gehoert zum Anlege-Vorgang — beim Wechsel
    // des bearbeiteten Jahrgangs darf keine alte Auswahl haengen bleiben.
    setAusgewaehlt({});
  }, [jahrgang]);

  // Personenliste nur laden, wenn wirklich angelegt wird und der Aufrufer
  // org_admin ist — nur er darf anlegen und zuweisen. Fehler hier blockieren
  // das Anlegen nicht; die Zuweisung ist optional und geht auch spaeter.
  useEffect(() => {
    if (jahrgang || user?.role_name !== 'org_admin' || !networkMonitor.isOnline) return;
    let aktiv = true;
    (async () => {
      try {
        const res = await api.get('/users');
        if (!aktiv) return;
        const personen = (res.data as ZuweisbarePerson[]).filter(
          (p) => p.role_name === 'admin' || p.role_name === 'teamer'
        );
        setZuweisbare(personen);
      } catch {
        // still: Abschnitt bleibt leer, das Anlegen funktioniert trotzdem
      }
    })();
    return () => { aktiv = false; };
  }, [jahrgang, user?.role_name]);

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError('Name ist erforderlich');
      return;
    }

    const payload: Record<string, unknown> = {
      name: formData.name.trim(),
      gottesdienst_enabled: formData.gottesdienst_enabled,
      gemeinde_enabled: formData.gemeinde_enabled,
      target_gottesdienst: formData.target_gottesdienst,
      target_gemeinde: formData.target_gemeinde,
      konfspruch_enabled: formData.konfspruch_enabled
    };

    // Direkt-Zuweisung nur beim Anlegen und nur, wenn jemand ausgewaehlt ist —
    // ohne Auswahl bleibt das Feld weg und der Server verhaelt sich wie bisher.
    // view+edit wie bei der Zuweisung ueber die Benutzerverwaltung
    // (UserManagementModal schickt dort ebenfalls beide Rechte).
    const zugewieseneIds = Object.entries(ausgewaehlt)
      .filter(([, gewaehlt]) => gewaehlt)
      .map(([id]) => parseInt(id, 10));
    if (!jahrgang && zugewieseneIds.length > 0) {
      payload.user_assignments = zugewieseneIds.map((id) => ({
        user_id: id,
        can_view: true,
        can_edit: true
      }));
    }

    if (networkMonitor.isOnline) {
      setLoading(true);
      try {
        if (jahrgang) {
          await api.put(`/admin/jahrgaenge/${jahrgang.id}`, payload);
        } else {
          await api.post('/admin/jahrgaenge', payload);
        }

        onSuccess();
        handleClose();
      } catch (error) {
        setError(fehlerText(error, 'Fehler beim Speichern des Jahrgangs'));
      } finally {
        setLoading(false);
      }
    } else {
      await writeQueue.enqueue({
        method: jahrgang ? 'PUT' : 'POST',
        url: jahrgang ? `/admin/jahrgaenge/${jahrgang.id}` : '/admin/jahrgaenge',
        body: payload,
        maxRetries: 5,
        hasFileUpload: false,
        metadata: {
          type: 'admin',
          clientId: safeUUID(),
          label: jahrgang ? 'Jahrgang bearbeiten' : 'Jahrgang erstellen'
        }
      });
      setSuccess('Wird gespeichert sobald du wieder online bist');
      onSuccess();
      handleClose();
    }
  };

  // generateWrapped / deleteWrapped / handleWrappedToggle sind am
  // 03.09.2026 entfallen: Der Rueckblick wird nicht mehr ueber einen Schalter
  // im Jahrgang freigegeben, sondern unter Mehr > Jahresrueckblick verwaltet
  // (AdminWrappedPage) -- dort mit Namen, mehreren Ausgaben und gezieltem
  // Loeschen. Die Routen dahinter sind dieselben.


  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>
            {jahrgang ? 'Jahrgang bearbeiten' : 'Neuer Jahrgang'}
          </IonTitle>
          <IonButtons slot="start">
            <IonButton aria-label="Schließen" onClick={handleClose} disabled={loading}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton aria-label="Jahrgang speichern"
              onClick={handleSubmit}
              disabled={!formData.name.trim() || loading}
            >
              {loading ? (
                <IonSpinner name="crescent" />
              ) : (
                <IonIcon icon={checkmarkOutline} />
              )}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        {/* Jahrgang Details - iOS26 Pattern */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--jahrgang">
              <IonIcon icon={school} />
            </div>
            <IonLabel>Jahrgang Details</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent>
              <IonList style={{ background: 'transparent', padding: '0' }}>
                <IonItem lines="full" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">Name *</IonLabel>
                  <IonInput
                    value={formData.name}
                    onIonInput={(e) => setFormData({ ...formData, name: e.detail.value! })}
                    placeholder="z.B. Jahrgang 2024/2025"
                    disabled={loading}
                    clearInput={true}
                  />
                </IonItem>
              </IonList>
              <p style={{ fontSize: '0.8rem', color: 'var(--app-text-sub-color, #8e8e93)', margin: '8px 4px 0', lineHeight: 1.4 }}>
                Hier steuerst du diesen Jahrgang zentral: Punkteziele, die Freischaltung der Konfispruch-Auswahl und die Freigabe des Wrapped-Rückblicks.
              </p>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Punkte-Konfiguration */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--jahrgang">
              <IonIcon icon={settingsOutline} />
            </div>
            <IonLabel>Punkte-Konfiguration</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent>
              <IonList style={{ background: 'transparent', padding: '0' }}>
                <IonItem lines="full" style={{ '--background': 'transparent' }}>
                  <IonLabel>Gottesdienst-Punkte aktiviert</IonLabel>
                  <IonToggle
                    slot="end"
                    className="app-toggle--jahrgang"
                    checked={formData.gottesdienst_enabled}
                    onIonChange={(e) => setFormData({ ...formData, gottesdienst_enabled: e.detail.checked })}
                    disabled={loading || (!formData.gemeinde_enabled)}
                  />
                </IonItem>
                {!formData.gemeinde_enabled && formData.gottesdienst_enabled && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--app-color-badges)', marginTop: '4px', paddingLeft: '16px' }}>
                    Mindestens ein Punkt-Typ muss aktiv bleiben.{jahrgang?.konfi_count ? ` ${jahrgang.konfi_count} Konfis haben bereits Gottesdienst-Punkte.` : ''}
                  </div>
                )}
                {formData.gottesdienst_enabled && (
                  <IonItem lines="full" style={{ '--background': 'transparent' }}>
                    <IonLabel position="stacked">Ziel Gottesdienst <span style={{ fontWeight: 700, color: 'var(--ion-color-primary)' }}>{formData.target_gottesdienst}</span></IonLabel>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                      <span style={{ fontSize: '0.75rem', color: '#8e8e93', minWidth: '24px', textAlign: 'center' }}>1</span>
                      <IonRange
                        min={1} max={20} step={1}
                        pin={true} pinFormatter={(value: number) => `${value}`}
                        value={formData.target_gottesdienst}
                        onIonChange={(e) => setFormData({ ...formData, target_gottesdienst: e.detail.value as number })}
                        disabled={loading}
                        style={{ flex: 1 }}
                      />
                      <span style={{ fontSize: '0.75rem', color: '#8e8e93', minWidth: '24px', textAlign: 'center' }}>20</span>
                    </div>
                  </IonItem>
                )}
                <IonItem lines="full" style={{ '--background': 'transparent' }}>
                  <IonLabel>Gemeinde-Punkte aktiviert</IonLabel>
                  <IonToggle
                    slot="end"
                    className="app-toggle--jahrgang"
                    checked={formData.gemeinde_enabled}
                    onIonChange={(e) => setFormData({ ...formData, gemeinde_enabled: e.detail.checked })}
                    disabled={loading || (!formData.gottesdienst_enabled)}
                  />
                </IonItem>
                {!formData.gottesdienst_enabled && formData.gemeinde_enabled && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--app-color-badges)', marginTop: '4px', paddingLeft: '16px' }}>
                    Mindestens ein Punkt-Typ muss aktiv bleiben.{jahrgang?.konfi_count ? ` ${jahrgang.konfi_count} Konfis haben bereits Gemeinde-Punkte.` : ''}
                  </div>
                )}
                {formData.gemeinde_enabled && (
                  <IonItem lines="none" style={{ '--background': 'transparent' }}>
                    <IonLabel position="stacked">Ziel Gemeinde <span style={{ fontWeight: 700, color: 'var(--ion-color-primary)' }}>{formData.target_gemeinde}</span></IonLabel>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                      <span style={{ fontSize: '0.75rem', color: '#8e8e93', minWidth: '24px', textAlign: 'center' }}>1</span>
                      <IonRange
                        min={1} max={20} step={1}
                        pin={true} pinFormatter={(value: number) => `${value}`}
                        value={formData.target_gemeinde}
                        onIonChange={(e) => setFormData({ ...formData, target_gemeinde: e.detail.value as number })}
                        disabled={loading}
                        style={{ flex: 1 }}
                      />
                      <span style={{ fontSize: '0.75rem', color: '#8e8e93', minWidth: '24px', textAlign: 'center' }}>20</span>
                    </div>
                  </IonItem>
                )}
              </IonList>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Konfispruch & Wrapped */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--jahrgang">
              <IonIcon icon={sparklesOutline} />
            </div>
            <IonLabel>Konfispruch & Wrapped</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent>
              <IonList style={{ background: 'transparent', padding: '0' }}>
                <IonItem lines={jahrgang ? 'full' : 'none'} style={{ '--background': 'transparent' }}>
                  <IonLabel>
                    <h3 style={{ margin: 0 }}>Konfispruch-Auswahl</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--app-text-sub-color, #8e8e93)', whiteSpace: 'normal' }}>
                      Konfis dieses Jahrgangs können ihren Konfispruch wählen.
                    </p>
                  </IonLabel>
                  <IonToggle
                    slot="end"
                    className="app-toggle--jahrgang"
                    checked={formData.konfspruch_enabled}
                    onIonChange={(e) => setFormData({ ...formData, konfspruch_enabled: e.detail.checked })}
                    disabled={loading}
                  />
                </IonItem>
                {/* Der Wrapped-Schalter ist am 03.09.2026 hierher VERSCHWUNDEN
                    (Simon: "es ist immer noch im Jahrgang ein Switch drin, der
                    sollte da doch weg, eigene Sektion fuer alle Admins mit den
                    Regeln fuer Zugriffe").

                    Warum: Ein Schalter kann nur EINEN Zustand abbilden, an
                    oder aus. Seit es mehrere Ausgaben je Jahrgang gibt
                    ("Zwischenstand", "Dein Abschluss"), passt das nicht mehr --
                    er koennte weder benennen noch eine einzelne Ausgabe
                    loeschen. Das liegt jetzt unter Mehr > Jahresrueckblick
                    (AdminWrappedPage). */}
              </IonList>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Direkt-Zuweisung beim Anlegen (nur Org-Admin, nur im Anlege-Modus).
            Optional: Ohne Auswahl entsteht der Jahrgang wie bisher ohne
            Zuweisungen — nachtraeglich geht es weiter ueber die
            Benutzerverwaltung. */}
        {!jahrgang && user?.role_name === 'org_admin' && zuweisbare.length > 0 && (
          <IonList inset={true} style={{ margin: '16px' }}>
            <IonListHeader>
              <div className="app-section-icon app-section-icon--jahrgang">
                <IonIcon icon={people} />
              </div>
              <IonLabel>Zugriff für Admins & Teamer:innen</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent style={{ padding: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {zuweisbare.map((person, index) => {
                    const istGewaehlt = ausgewaehlt[person.id] || false;
                    return (
                      <div
                        key={person.id}
                        className="app-list-item app-list-item--jahrgang"
                        onClick={() => !loading && setAusgewaehlt(prev => ({ ...prev, [person.id]: !istGewaehlt }))}
                        style={{
                          cursor: loading ? 'default' : 'pointer',
                          opacity: loading ? 0.6 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: index < zuweisbare.length - 1 ? '8px' : '0',
                          background: istGewaehlt ? 'rgba(102, 126, 234, 0.08)' : undefined
                        }}
                      >
                        <span style={{ fontWeight: '500', color: '#333' }}>{person.display_name}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--app-text-sub-color, #8e8e93)' }}>
                            {person.role_name === 'admin' ? 'Admin' : 'Teamer:in'}
                          </span>
                          {istGewaehlt && <IonIcon icon={checkmarkCircle} style={{ color: '#34c759' }} />}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--app-text-sub-color, #8e8e93)', margin: '12px 4px 0', lineHeight: 1.4 }}>
                  Ausgewählte Personen sehen und bearbeiten den neuen Jahrgang sofort. Ohne Auswahl kannst du die Zuweisung später unter „Benutzer:innen" vergeben.
                </p>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}
      </IonContent>
    </IonPage>
  );
};

const AdminJahrgaengeePage: React.FC = () => {
  const { pageRef, presentingElement } = useModalPage('admin-jahrgaenge');
  const { user, setError, isOnline } = useApp();

  // Offline-Query: Jahrgänge
  const { data: jahrgaenge, loading, refresh: refreshJahrgaenge, refreshLive: refreshJahrgaengeLive } = useOfflineQuery<Jahrgang[]>(
    'admin:jahrgaenge-detail:' + user?.organization_id,
    async () => { const res = await api.get('/admin/jahrgaenge'); return res.data; },
    { ttl: CACHE_TTL.STAMMDATEN }
  );

  const [editJahrgang, setEditJahrgang] = useState<Jahrgang | null>(null);
  const slidingRefs = useRef<Map<number, SlidingRef>>(new Map());

  // Alert Hook für Bestätigungsdialoge
  const [presentAlert] = useIonAlert();

  // Modal mit useIonModal Hook
  const [presentJahrgangModalHook, dismissJahrgangModalHook] = useIonModal(JahrgangModal, {
    jahrgang: editJahrgang,
    onClose: () => dismissJahrgangModalHook(),
    onSuccess: () => {
      dismissJahrgangModalHook();
      refreshJahrgaenge();
    },
    // Wrapped-Toggle aktualisiert die Liste, ohne das Modal zu schliessen.
    onRefresh: () => refreshJahrgaenge()
  });

  // Subscribe to live updates for jahrgaenge
  useLiveRefresh('jahrgaenge', refreshJahrgaengeLive);

  const handleRefresh = async (event: CustomEvent) => {
    await refreshJahrgaenge();
    (event.target as HTMLIonRefresherElement).complete();
  };

  const handleDeleteWithSlideClose = async (jahrgang: Jahrgang, forceDelete = false) => {
    if (offlineBlockiert(isOnline, setError)) return;
    const performDelete = async () => {
      const slidingElement = slidingRefs.current.get(jahrgang.id);
      try {
        const url = forceDelete ? `/admin/jahrgaenge/${jahrgang.id}?force=true` : `/admin/jahrgaenge/${jahrgang.id}`;
        await api.delete(url);
        refreshJahrgaenge();
      } catch (error) {
        if (slidingElement) {
          await slidingElement.close();
        }

        if (fehlerDaten(error)?.canForceDelete) {
          // Org Admin kann trotzdem löschen
          presentAlert({
            header: 'Chat-Nachrichten vorhanden',
            message: `${fehlerText(error, 'Der Jahrgang enthält Chat-Nachrichten.')}\n\nAls Organisation-Admin können Sie dennoch löschen. Dadurch werden ALLE Chat-Nachrichten unwiderruflich gelöscht!`,
            buttons: [
              { text: 'Abbrechen', role: 'cancel' },
              {
                text: 'Dennoch löschen',
                role: 'destructive',
                handler: () => handleDeleteWithSlideClose(jahrgang, true)
              }
            ]
          });
        } else {
          setError(fehlerText(error, 'Fehler beim Löschen des Jahrgangs'));
        }
      }
    };

    if (forceDelete) {
      await performDelete();
    } else {
      presentAlert({
        header: 'Jahrgang löschen',
        message: `Jahrgang "${jahrgang.name}" wirklich löschen?\n\nDer Jahrgang und sein Chatverlauf werden unwiderruflich entfernt. Solange dem Jahrgang noch aktive Konfis zugeordnet sind, ist das Löschen nicht möglich. Zu Teamer:innen beförderte Konfis bleiben mit ihren Punkten und Abzeichen erhalten.`,
        buttons: [
          { text: 'Abbrechen', role: 'cancel' },
          {
            text: 'Löschen',
            role: 'destructive',
            handler: performDelete
          }
        ]
      });
    }
  };

  const openCreateModal = () => {
    setEditJahrgang(null);
    presentJahrgangModalHook({ presentingElement });
  };

  const openEditModal = (jahrgang: Jahrgang) => {
    setEditJahrgang(jahrgang);
    presentJahrgangModalHook({ presentingElement });
  };

  // Rollen-basierte Berechtigungen: Anlegen darf seit 01.09.2026 NUR der
  // org_admin (der Server antwortet einem admin mit 403) — der Knopf wird
  // dem Admin deshalb gar nicht mehr angeboten. Bearbeiten und Loeschen
  // bleiben fuer Admins moeglich, aber jahrgangsgebunden (Server prueft die
  // Zuweisung; die Liste zeigt ihm ohnehin nur seine eigenen Jahrgaenge).
  const isAdmin = ['org_admin', 'admin'].includes(user?.role_name || '');
  const canCreate = user?.role_name === 'org_admin';
  const canEdit = isAdmin;
  const canDelete = isAdmin;


  return (
    <IonPage ref={pageRef}>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton aria-label="Zurück" onClick={() => window.history.back()}>
              <IonIcon icon={arrowBack} />
            </IonButton>
          </IonButtons>
          <IonTitle>Jahrgänge</IonTitle>
          {canCreate && (
            <IonButtons slot="end">
              <IonButton aria-label="Neuen Jahrgang anlegen" onClick={openCreateModal}>
                <IonIcon icon={add} />
              </IonButton>
            </IonButtons>
          )}
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar className="app-condense-toolbar">
            <IonTitle size="large">Jahrgänge</IonTitle>
          </IonToolbar>
        </IonHeader>
        
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh} onIonPull={triggerPullHaptic}>
          <IonRefresherContent refreshingSpinner="crescent" />
        </IonRefresher>

        {loading ? (
          <LoadingSpinner message="Jahrgänge werden geladen..." />
        ) : (
          <>
            <SectionHeader
              title="Jahrgänge"
              subtitle="Konfirmand:innen verwalten"
              icon={school}
              preset="jahrgang"
              stats={[
                { value: (jahrgaenge || []).length, label: 'GESAMT' }
              ]}
            />

        {/* Jahrgaenge List */}
        <ListSection
          icon={schoolOutline}
          title="Jahrgänge"
          count={(jahrgaenge || []).length}
          iconColorClass="jahrgang"
          emptyIcon={school}
          emptyTitle="Keine Jahrgänge gefunden"
          emptyMessage="Noch keine Jahrgänge angelegt"
          emptyIconColor="#007aff"
        >
                  {(jahrgaenge || []).map((jahrgang, index) => (
                    <IonItemSliding
                      key={jahrgang.id}
                      ref={(el) => {
                        if (el) {
                          slidingRefs.current.set(jahrgang.id, el);
                        } else {
                          slidingRefs.current.delete(jahrgang.id);
                        }
                      }}
                      style={{ marginBottom: index < (jahrgaenge || []).length - 1 ? '8px' : '0' }}
                    >
                      <IonItem
                        button={canEdit}
                        onClick={canEdit ? () => openEditModal(jahrgang) : undefined}
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
                          className="app-list-item app-list-item--jahrgang"
                          style={{ width: '100%' }}
                        >
                          <div className="app-list-item__row">
                            <div className="app-list-item__main">
                              <div className="app-icon-circle app-icon-circle--lg app-icon-circle--jahrgang">
                                <IonIcon icon={school} />
                              </div>
                              <div className="app-list-item__content">
                                <div className="app-list-item__title">
                                  {jahrgang.name}
                                </div>
                                <div className="app-list-item__meta">
                                  {jahrgang.gottesdienst_enabled !== false && (
                                    <span className="app-list-item__meta-item">
                                      <IonIcon icon={home} className="app-icon-color--gottesdienst" />
                                      {`GD-Ziel ${jahrgang.target_gottesdienst ?? 10}`}
                                    </span>
                                  )}
                                  {jahrgang.gemeinde_enabled !== false && (
                                    <span className="app-list-item__meta-item">
                                      <IonIcon icon={people} className="app-icon-color--gemeinde" />
                                      {`Gem-Ziel ${jahrgang.target_gemeinde ?? 10}`}
                                    </span>
                                  )}
                                  <span className="app-list-item__meta-item">
                                    <IonIcon
                                      icon={jahrgang.konfspruch_enabled !== false ? checkmarkCircle : closeCircle}
                                      style={{ color: jahrgang.konfspruch_enabled !== false ? '#34c759' : '#8e8e93' }}
                                    />
                                    {jahrgang.konfspruch_enabled !== false ? 'Spruch frei' : 'Spruch gesperrt'}
                                  </span>
                                  <span className="app-list-item__meta-item">
                                    <IonIcon
                                      icon={trophy}
                                      style={{ color: jahrgang.wrapped_released_at ? '#ff9500' : '#8e8e93' }}
                                    />
                                    {jahrgang.wrapped_released_at
                                      ? `Wrapped gestartet am ${new Date(jahrgang.wrapped_released_at).toLocaleDateString('de-DE')}`
                                      : 'Wrapped nicht freigegeben'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </IonItem>

                      {canDelete && (
                        <IonItemOptions side="end" className="app-swipe-actions">
                          <IonItemOption
                            onClick={() => { closeOpenSlidingItems(); handleDeleteWithSlideClose(jahrgang); }}
                            aria-label="Jahrgang löschen"
                            className="app-swipe-action"
                          >
                            <div className="app-icon-circle app-icon-circle--lg app-icon-circle--danger">
                              <IonIcon icon={trash} />
                            </div>
                          </IonItemOption>
                        </IonItemOptions>
                      )}
                    </IonItemSliding>
                  ))}
        </ListSection>
          </>
        )}

      </IonContent>
    </IonPage>
  );
};

export default AdminJahrgaengeePage;