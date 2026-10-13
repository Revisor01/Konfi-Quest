import { fehlerText } from '../../../utils/fehler';
import React, { useState, useCallback } from 'react';
import {
  IonPage,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonButton,
  IonIcon,
  useIonModal,
  useIonAlert,
  useIonRouter
} from '@ionic/react';
// useIonRouter: Ionic 8 API - bei Ionic v9 ggf. auf useNavigate migrieren
import { ICON_CHECKBOX, ICON_HINZUFUEGEN_GEFUELLT } from '../../shared/icons';
import { useApp } from '../../../contexts/AppContext';
import { offlineBlockiert } from '../../../utils/offlineAktion';
import { konfiLoeschHinweis, teamKontoLoeschHinweis } from '../../../utils/kontoLoeschen';
import { useModalPage } from '../../../contexts/ModalContext';
import { useLiveRefresh } from '../../../contexts/LiveUpdateContext';
import api from '../../../services/api';
import { useOfflineQuery } from '../../../hooks/useOfflineQuery';
import { CACHE_TTL } from '../../../services/offlineCache';
import KonfisView from '../KonfisView';
import WebKonfis from '../web/leitung/WebKonfis';
import WebBenutzerDialog from '../web/leitung/WebBenutzerDialog';
import { useBreitesLayout } from '../../../navigation/breitesLayout';
import LoadingSpinner from '../../common/LoadingSpinner';
import KonfiModal from '../modals/KonfiModal';
import UserManagementModal from '../modals/UserManagementModal';
import AttendanceMatrixModal from '../modals/AttendanceMatrixModal';
import { triggerPullHaptic } from '../../../utils/haptics';
import AppKopfzeile, { AppKopfzeileGross } from '../../shared/AppKopfzeile';
import AdminOnboardingModal from '../modals/AdminOnboardingModal';
import AdminUpdate230WalkthroughModal from '../modals/AdminUpdate230WalkthroughModal';
import { useOnboardingWithUpdateOnce } from '../../../hooks/useOnboardingOnce';
import NeuerungenBanner from '../../shared/NeuerungenBanner';
import MitmachenErklaerungModal from '../../shared/MitmachenErklaerungModal';
import type { KonfiFormDaten } from '../../../types/user';
import {
  EINMALPASSWORT_TITEL,
  KEINE_ANTWORT_TITEL,
  KONFI_NAME_VERGEBEN,
  LIMIT_RUECKFRAGE_TITEL,
  TARIF_GRENZE_TITEL,
  einmalpasswortText,
  konfiAnlegen,
} from '../useKonfiFormular';
import type { TeamerListenEintrag } from '../../../types/user';

interface Konfi {
  id: number;
  name: string;
  username?: string;
  jahrgang?: string;
  jahrgang_name?: string; // Backend liefert jahrgang_name
  // Backend liefert diese Felder:
  gottesdienst_points?: number;
  gemeinde_points?: number;
  // Legacy support für alte Struktur:
  points?: {
    gottesdienst: number;
    gemeinde: number;
  };
  badgeCount?: number;
  activities_count?: number;
}

interface Jahrgang {
  id: number;
  name: string;
}

interface Settings {
  target_gottesdienst?: string;
  target_gemeinde?: string;
}


interface AdminKonfisPageProps {
  // Im iPad-Split-View setzt der Master die Auswahl als State (statt zu
  // navigieren). Fehlt der Callback (iPhone/Portrait), wird wie bisher
  // per Route auf die Detail-Seite navigiert.
  onSelectKonfi?: (konfiId: number) => void;
  // Aktuell ausgewaehlter Konfi (für Highlighting im Split-View).
  selectedKonfiId?: number | null;
}

const AdminKonfisPage: React.FC<AdminKonfisPageProps> = ({ onSelectKonfi, selectedKonfiId }) => {
  const { setSuccess, setError, user, isOnline } = useApp();
  const router = useIonRouter();
  const { pageRef, presentingElement } = useModalPage('admin-konfis');
  // Im Browser ab 992 px eine eigene Web-Fassung (web/leitung/WebKonfis.tsx);
  // Daten, Fenster und Rueckfragen dieser Seite bleiben dieselben.
  const breit = useBreitesLayout();
  // Onboarding-Tour einmal pro Admin-Account (beim ersten Betreten der Konfis-Seite,
  // der Landing-Page für Admins/Org-Admins) — bzw. für Bestandsnutzer die
  // Änderungsanzeige nach einem Update. Nie beides gleichzeitig, dafür sorgt
  // der Hook; die Anzeige meldet sich genau einmal je Minor-Version von
  // selbst und bleibt dauerhaft über "Was ist neu?" unter "Mehr" erreichbar.
  const {
    showOnboarding, closeOnboarding,
    showNeuerungen, schliesseNeuerungen,
    showUpdateHinweis, markUpdateHinweisGesehen,
    showMitmachenHinweis, markMitmachenHinweisGesehen
  } = useOnboardingWithUpdateOnce('admin_onboarding_seen', user?.id);
  const [showUpdateWalkthrough, setShowUpdateWalkthrough] = useState(false);
  const [showMitmachenErklaerung, setShowMitmachenErklaerung] = useState(false);
  
  // Befund aus dem Rollen-Bericht (26.08.2026): Ein Admin ohne
  // Jahrgangs-Zuweisung sah eine leere Liste mit dem Text "Noch keine Konfis
  // angelegt" -- obwohl es Konfis gibt und nur die Zuweisung fehlt. Wer frisch
  // angelegt wurde, hielt die App fuer kaputt.
  //
  // Das Verhalten bleibt (Simons Entscheidung 26.08.), nur der Grund wird
  // sichtbar. Der Server meldet ihn per Header
  // (konfi-management.js), damit die Antwort ein Array bleibt.
  const [ohneJahrgang, setOhneJahrgang] = useState(false);

  // Offline-Query: Konfis
  const { data: konfis, loading: konfisLoading, refresh: refreshKonfis, refreshLive: refreshKonfisLive } = useOfflineQuery<Konfi[]>(
    'admin:konfis:' + user?.organization_id,
    async () => {
      const res = await api.get('/admin/konfis');
      setOhneJahrgang(res.headers?.['x-kein-jahrgang-zugewiesen'] === 'true');
      return res.data;
    },
    { ttl: CACHE_TTL.KONFIS }
  );

  // Offline-Query: Jahrgänge
  const { data: jahrgaenge, refreshLive: refreshJahrgaengeLive } = useOfflineQuery<Jahrgang[]>(
    'admin:jahrgaenge:' + user?.organization_id,
    async () => { const res = await api.get('/admin/jahrgaenge'); return res.data; },
    { ttl: CACHE_TTL.STAMMDATEN }
  );

  // Offline-Query: Settings
  const { refreshLive: refreshSettingsLive } = useOfflineQuery<Settings>(
    'admin:settings:' + user?.organization_id,
    async () => { const res = await api.get('/settings'); return res.data; },
    { ttl: CACHE_TTL.SETTINGS }
  );

  const loading = konfisLoading;

  // Alert Hook für Bestätigungsdialoge
  const [presentAlert] = useIonAlert();

  // Modal mit useIonModal Hook - löst Tab-Navigation Problem
  const [presentKonfiModalHook, dismissKonfiModalHook] = useIonModal(KonfiModal, {
    jahrgaenge: jahrgaenge || [],
    onClose: () => dismissKonfiModalHook(),
    onSave: (konfiData: KonfiFormDaten) => {
      handleAddKonfi(konfiData);
      dismissKonfiModalHook();
    },
    dismiss: () => dismissKonfiModalHook()
  });

  // Anwesenheits-Matrix Modal
  const [presentMatrixModal, dismissMatrixModal] = useIonModal(AttendanceMatrixModal, {
    jahrgaenge: jahrgaenge || [],
    onClose: () => dismissMatrixModal()
  });

  // Welche Liste zeigt die Ansicht gerade? Der Plus-Button in der Kopfzeile
  // legt danach eine Konfi ODER eine Teamer:in an — vorher oeffnete er im
  // Teamer-Modus faelschlich das Konfi-Formular (Nutzerhinweis 22.08.2026).
  const [viewMode, setViewMode] = useState<'konfis' | 'teamer'>('konfis');

  // Der Titel folgt dem Segment -- wie "Events | Aktivitäten" im
  // Mitmachen-Reiter (AdminEventsPage). Hier stand bis zum 29.09.2026
  // "Konfirmand:innen": Auf Android (md, Titel links neben den Knöpfen) passte
  // das neben Anwesenheit, Neu und Glocke nicht -- bei 360 px "Konfirmand…",
  // 161 px Text auf 128 px Platz, bei 412 px auf Kante (gemessen mit
  // Android-Kennung in Chromium). "Konfis" heißt auch der Reiter.
  const seitenTitel = viewMode === 'teamer' ? 'Team' : 'Konfis';

  // Teamer:innen laufen über dasselbe Formular wie in der Benutzerverwaltung
  // (Rollenauswahl inklusive) — kein zweites Formular, das auseinanderlaufen kann.
  // festeRolle: Der Button heißt "Neue Teamer:in anlegen" — dann soll der
  // Dialog auch genau das tun. Vorher kam die volle Rollenauswahl inklusive
  // Admin, und ein so angelegter Admin tauchte in der Teamer-Liste nicht auf
  // (Nutzerhinweis 22.08.2026). Admins legt man in der Nutzerverwaltung an.
  const [presentTeamerModalHook, dismissTeamerModalHook] = useIonModal(UserManagementModal, {
    userId: null,
    festeRolle: 'teamer',
    onClose: () => dismissTeamerModalHook(),
    onSuccess: () => {
      dismissTeamerModalHook();
      refreshKonfis();
    }
  });
  // Im Browser ab 992 px dasselbe Formular als eigener Dialog
  // (web/leitung/WebBenutzerDialog.tsx, dieselbe Logik useBenutzerFormular).
  // Nach dem Anlegen laedt die Team-Liste der Web-Fassung neu (teamStand).
  const [teamerDialogOffen, setTeamerDialogOffen] = useState(false);
  const [teamStand, setTeamStand] = useState(0);

  // Memoized refresh function for live updates
  const refreshAll = useCallback(() => {
    refreshKonfisLive();
    refreshJahrgaengeLive();
    refreshSettingsLive();
  }, [refreshKonfisLive, refreshJahrgaengeLive, refreshSettingsLive]);

  // Subscribe to live updates for konfis
  useLiveRefresh('konfis', refreshAll);

  const handleDeleteKonfi = async (konfi: Konfi) => {
    if (offlineBlockiert(isOnline, setError)) return;
    presentAlert({
      header: 'Konfi wirklich löschen?',
      // Was wirklich verschwindet (Audit 26.09.2026, Leitung BF-10): ein
      // Wortlaut fuer alle Konto-Loeschdialoge (utils/kontoLoeschen.ts).
      message: konfiLoeschHinweis(konfi.name),
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Endgültig löschen',
          role: 'destructive',
          handler: async () => {
            try {
              await api.delete(`/admin/konfis/${konfi.id}`);
              await refreshKonfis();
            } catch {
              setError('Fehler beim Löschen');
            }
          }
        }
      ]
    });
  };

  // Gibt ein Promise zurück, das erst nach abgeschlossenem Delete (oder Abbruch)
  // resolved — so kann KonfisView danach die lokale Teamer-Liste neu laden.
  const handleDeleteTeamer = (teamer: TeamerListenEintrag): Promise<void> => {
    if (offlineBlockiert(isOnline, setError)) return Promise.resolve();
    const name = teamer.display_name || teamer.name;
    return new Promise<void>((resolve) => {
      presentAlert({
        header: 'Teamer:in löschen',
        // Derselbe Weg wie unter "Benutzer:innen" (DELETE /users/:id): Wer
        // auch in einer anderen Gemeinde Mitglied ist, wird nur aus dieser
        // entfernt, das Konto bleibt dort (Simon, 27.09.2026). Diese Liste
        // (GET /admin/konfis/teamer, auch fuer Teamer:innen lesbar) sagt
        // nicht, wer das ist -- deshalb nennt die Abfrage beide Ausgaenge,
        // und die Erfolgsmeldung richtet sich nach der Antwort (konto_bleibt).
        message: `Teamer:in "${name}" wirklich löschen?\n\n${teamKontoLoeschHinweis()}\n\nArbeitet die Person auch in einer anderen Gemeinde mit, wird sie nur aus deiner Gemeinde entfernt; ihr Konto bleibt dort bestehen.`,
        buttons: [
          { text: 'Abbrechen', role: 'cancel', handler: () => resolve() },
          {
            text: 'Löschen',
            role: 'destructive',
            handler: async () => {
              try {
                const res = await api.delete(`/users/${teamer.id}`);
                await refreshKonfis();
                setSuccess(res?.data?.konto_bleibt === true
                  ? `Teamer:in "${name}" aus deiner Gemeinde entfernt; das Konto bleibt in einer anderen Gemeinde bestehen`
                  : `Teamer:in "${name}" gelöscht`);
              } catch (err) {
                setError(fehlerText(err, 'Fehler beim Löschen'));
              } finally {
                resolve();
              }
            }
          }
        ]
      });
    });
  };

  const handleSelectKonfi = (konfi: Konfi) => {
    // Split-View (iPad): Auswahl an den Wrapper melden, KEINE Navigation.
    // Sonst (iPhone/Portrait): wie bisher zur Detail-Route navigieren.
    if (onSelectKonfi) {
      onSelectKonfi(konfi.id);
    } else {
      router.push(`/admin/konfis/${konfi.id}`);
    }
  };

  const presentKonfiModal = () => {
    presentKonfiModalHook({
      presentingElement: presentingElement
    });
  };

  // Erfolgsbehandlung nach erfolgreichem Anlegen (auch nach Grace-Bestätigung wiederverwendet)
  //
  // Den Jahrgangs-Chat pflegt der Server beim Anlegen selbst
  // (konfi-management.js, syncJahrgangChat in der Transaktion). Hier stand
  // bis 28.09.2026 vor dem Passwort-Dialog ein Aufruf GET
  // /admin/jahrgaenge/:id -- eine Route, die es nicht gibt: ein 404 je
  // Anlage, danach wurde der Fehler geschluckt (Audit Screens Leitung BF-06).
  const handleKonfiCreated = async (tempPassword: string | undefined, konfiData: KonfiFormDaten) => {
    if (tempPassword) {
      presentAlert({
        header: EINMALPASSWORT_TITEL,
        subHeader: tempPassword,
        message: einmalpasswortText(konfiData.name),
        buttons: [
          {
            text: 'Kopieren',
            handler: () => {
              navigator.clipboard.writeText(tempPassword);
              setSuccess('Passwort kopiert');
              return false;
            }
          },
          { text: 'Fertig', role: 'cancel' }
        ]
      });
    }

    // Sofortige Aktualisierung
    await refreshKonfis();
  };

  // Grace-Bestätigungsdialog: legt den Konfi nach "Trotzdem anlegen" mit confirm-Flag erneut an
  const presentGraceDialog = (konfiData: KonfiFormDaten, text: string) => {
    presentAlert({
      header: LIMIT_RUECKFRAGE_TITEL,
      message: text,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Trotzdem anlegen',
          // Derselbe Weg wie der erste Versuch -- mit derselben Kennung
          // (client_id), damit auch hier "Erneut versuchen" greift.
          handler: () => { handleAddKonfi({ ...konfiData, confirm: true }); }
        }
      ]
    });
  };

  // Anlegen und Einordnen der Antwort stehen in useKonfiFormular
  // (konfiAnlegen) -- dieselben wie im Dialog des Browsers (WebKonfiDialog).
  // Die App zeigt das Ergebnis nach dem Schliessen des Modals hier an.
  const handleAddKonfi = async (konfiData: KonfiFormDaten) => {
    const ergebnis = await konfiAnlegen(konfiData);
    switch (ergebnis.art) {
      case 'angelegt':
        await handleKonfiCreated(ergebnis.passwort, konfiData);
        break;
      case 'limit-rueckfrage':
        // 409 Grace: Bestätigungsdialog mit Tarif-Hinweis und "Trotzdem anlegen"
        presentGraceDialog(konfiData, ergebnis.text);
        break;
      case 'tarif-grenze':
        // 403 Hard-Block: nur Hinweis, kein Override
        presentAlert({
          header: TARIF_GRENZE_TITEL,
          message: ergebnis.text,
          buttons: [{ text: 'Verstanden', role: 'cancel' }]
        });
        break;
      case 'name-vergeben':
        // Username-Kollision (unverändert)
        setError(KONFI_NAME_VERGEBEN);
        break;
      case 'keine-antwort':
        // Keine Antwort, Zeitlimit oder Serverfehler: Ob das Konto steht, ist
        // offen. Ein zweiter Versuch mit derselben Kennung legt kein zweites
        // an, sondern liefert dasselbe Konto mit neuem Einmalpasswort.
        presentAlert({
          header: KEINE_ANTWORT_TITEL,
          message: ergebnis.text,
          buttons: [
            { text: 'Abbrechen', role: 'cancel' },
            { text: 'Erneut versuchen', handler: () => { handleAddKonfi(konfiData); } }
          ]
        });
        break;
      default:
        // Auch 409 bereits_angelegt: kein neues Passwort, kein zweites Konto;
        // der Text des Servers sagt, wo es weitergeht.
        setError(ergebnis.text);
    }
  };

  // Tour, Aenderungsanzeige und Erklaerung: Vollbild-Ueberlagerungen, in der
  // App wie in der Web-Fassung dieselben.
  const ueberlagerungen = (
    <>
      {showOnboarding && (
        <AdminOnboardingModal
          onClose={closeOnboarding}
          displayName={(user?.display_name || '').split(' ')[0]}
        />
      )}

      {/* Änderungsanzeige nach einem Update — meldet sich VON SELBST, genau
          einmal je Minor-Version (useOnboardingWithUpdateOnce). Sie und die
          Onboarding-Tour schließen sich gegenseitig aus; die Neuigkeiten-
          Karte bleibt weg, solange sie offen ist. */}
      {showNeuerungen && (
        <AdminUpdate230WalkthroughModal onClose={schliesseNeuerungen} />
      )}

      {/* Derselbe Walkthrough — hier über die Neuigkeiten-Karte geöffnet. */}
      {showUpdateWalkthrough && (
        <AdminUpdate230WalkthroughModal onClose={() => setShowUpdateWalkthrough(false)} />
      )}

      {showMitmachenErklaerung && (
        <MitmachenErklaerungModal
          rolle="admin"
          onClose={() => setShowMitmachenErklaerung(false)}
        />
      )}
    </>
  );

  if (breit) {
    return (
      <WebKonfis
        konfis={konfis || []}
        jahrgaenge={jahrgaenge || []}
        laedt={loading}
        ohneJahrgang={ohneJahrgang}
        pageRef={pageRef}
        onKonfiAnlegen={presentKonfiModal}
        onTeamAnlegen={() => setTeamerDialogOffen(true)}
        teamStand={teamStand}
        onMatrix={() => presentMatrixModal({ presentingElement: presentingElement, cssClass: 'app-modal-breit' })}
        onKonfiLoeschen={handleDeleteKonfi}
        onTeamerLoeschen={handleDeleteTeamer}
        banner={(
          <NeuerungenBanner
            style={{ margin: 0 }}
            updateSichtbar={showUpdateHinweis}
            mitmachenSichtbar={showMitmachenHinweis}
            onUpdateOeffnen={() => { markUpdateHinweisGesehen(); setShowUpdateWalkthrough(true); }}
            onUpdateAusblenden={markUpdateHinweisGesehen}
            onMitmachenOeffnen={() => { markMitmachenHinweisGesehen(); setShowMitmachenErklaerung(true); }}
            onMitmachenAusblenden={markMitmachenHinweisGesehen}
          />
        )}
        overlays={(
          <>
            {ueberlagerungen}
            {teamerDialogOffen && (
              <WebBenutzerDialog
                userId={null}
                festeRolle="teamer"
                onSchliessen={() => setTeamerDialogOffen(false)}
                onGespeichert={() => {
                  setTeamerDialogOffen(false);
                  refreshKonfis();
                  setTeamStand((n) => n + 1);
                }}
              />
            )}
          </>
        )}
      />
    );
  }

  return (
    <IonPage ref={pageRef}>
      {/* Der Gemeinde-Umschalter stand bis 25.09.2026 NUR hier; jetzt bringt
          ihn die gemeinsame Kopfzeile auf jede Seite mit (Audit-Befund C3). */}
      <AppKopfzeile
        titel={seitenTitel}
        rechts={['org_admin', 'admin'].includes(user?.role_name || '') ? (
          <>
            <IonButton aria-label="Anwesenheit und Konfisprüche anzeigen" onClick={() => presentMatrixModal({ presentingElement: presentingElement })}>
              <IonIcon icon={ICON_CHECKBOX} />
            </IonButton>
            <IonButton
              aria-label={viewMode === 'teamer' ? 'Neue Teamer:in anlegen' : 'Neuen Konfi anlegen'}
              onClick={() => viewMode === 'teamer'
                ? presentTeamerModalHook({ presentingElement: presentingElement })
                : presentKonfiModal()}
            >
              <IonIcon icon={ICON_HINZUFUEGEN_GEFUELLT} />
            </IonButton>
          </>
        ) : undefined}
      />
      <IonContent className="app-gradient-background" fullscreen>
        <AppKopfzeileGross titel={seitenTitel} />
        
        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          refreshAll();
          e.detail.complete();
        }} onIonPull={triggerPullHaptic}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>

        {/* Beide Neuerungs-Karten: einmalig nach dem Update, X blendet dauerhaft
            aus. Die Leitung hatte hier bislang nur die "Was ist neu"-Karte --
            die Mitmachen-Karte gab es fuer sie nur unter "Mehr". */}
        <NeuerungenBanner
          style={{ margin: 'var(--app-abstand-eng) var(--app-abstand-basis) var(--app-abstand-mittel)' }}
          updateSichtbar={showUpdateHinweis}
          mitmachenSichtbar={showMitmachenHinweis}
          onUpdateOeffnen={() => { markUpdateHinweisGesehen(); setShowUpdateWalkthrough(true); }}
          onUpdateAusblenden={markUpdateHinweisGesehen}
          onMitmachenOeffnen={() => { markMitmachenHinweisGesehen(); setShowMitmachenErklaerung(true); }}
          onMitmachenAusblenden={markMitmachenHinweisGesehen}
        />

        {loading ? (
          <LoadingSpinner message="Konfis werden geladen..." />
        ) : (
          <KonfisView 
            konfis={konfis || []}
            jahrgaenge={jahrgaenge || []}
            onViewModeChange={setViewMode}
            onSelectKonfi={handleSelectKonfi}
            onDeleteKonfi={handleDeleteKonfi}
            onDeleteTeamer={handleDeleteTeamer}
            selectedKonfiId={selectedKonfiId}
            ohneJahrgang={ohneJahrgang}
          />
        )}
      </IonContent>

      {ueberlagerungen}
    </IonPage>
  );
};

export default AdminKonfisPage;