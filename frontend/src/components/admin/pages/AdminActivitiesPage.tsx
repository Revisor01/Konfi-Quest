import { ICON_HINZUFUEGEN_GEFUELLT } from '../../shared/icons';
import AppKopfzeile, { AppKopfzeileGross } from '../../shared/AppKopfzeile';
import React from 'react';
import {
  IonPage,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonButton,
  IonIcon
} from '@ionic/react';
import { useModalPage } from '../../../contexts/ModalContext';
import ActivitiesView from '../ActivitiesView';
import LoadingSpinner from '../../common/LoadingSpinner';
import { triggerPullHaptic } from '../../../utils/haptics';
import { useAktivitaetenVerwaltung } from '../useAktivitaetenVerwaltung';

const AdminActivitiesPage: React.FC = () => {
  const { pageRef, presentingElement } = useModalPage('admin-activities');

  // Laden, Anlegen/Ändern (Modal) und Löschen (Rückfrage) stehen in
  // useAktivitaetenVerwaltung.
  const verwaltung = useAktivitaetenVerwaltung(() => presentingElement || pageRef.current || undefined);
  const {
    aktivitaeten: activities,
    loading,
    refresh: refreshActivities,
    rolle: selectedRole,
    setRolle: setSelectedRole,
    loeschen: handleDeleteActivity,
    bearbeiten: handleSelectActivity,
    anlegen: presentActivityModal,
    darfAnlegen: canCreate,
    darfBearbeiten: canEdit,
    darfLoeschen: canDelete
  } = verwaltung;

  const handleRoleChange = (role: 'konfi' | 'teamer') => {
    setSelectedRole(role);
    // useOfflineQuery reagiert automatisch auf selectedRole-Änderung im cacheKey
  };

  return (
    <IonPage ref={pageRef}>
      <AppKopfzeile
        titel="Aktivitäten"
        onZurueck={() => window.history.back()}
        gemeindeUmschalter={false}
        rechts={canCreate ? (
          <IonButton aria-label="Neue Aktivität anlegen" onClick={presentActivityModal}>
            <IonIcon icon={ICON_HINZUFUEGEN_GEFUELLT} />
          </IonButton>
        ) : undefined}
      />
      <IonContent className="app-gradient-background" fullscreen>
        <AppKopfzeileGross titel="Aktivitäten" />

        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          refreshActivities();
          e.detail.complete();
        }} onIonPull={triggerPullHaptic}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>

        {loading ? (
          <LoadingSpinner message="Aktivitäten werden geladen..." />
        ) : (
          <ActivitiesView
            activities={activities || []}
            onSelectActivity={handleSelectActivity}
            onDeleteActivity={handleDeleteActivity}
            canEdit={canEdit}
            canDelete={canDelete}
            targetRole={selectedRole}
            onRoleChange={handleRoleChange}
          />
        )}
      </IonContent>
    </IonPage>
  );
};

export default AdminActivitiesPage;
