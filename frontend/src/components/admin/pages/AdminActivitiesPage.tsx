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
import { useBreitesLayout } from '../../../navigation/breitesLayout';
import WebAktivitaetenSeite from '../web/termine/WebAktivitaetenSeite';

const AdminActivitiesPage: React.FC = () => {
  const { pageRef, presentingElement } = useModalPage('admin-activities');
  // Im Browser ab 992 px zeigt die Seite ihre Web-Fassung (siehe unten).
  const breit = useBreitesLayout();

  // Laden, Anlegen/Ändern (Modal) und Löschen (Rückfrage) stehen in
  // useAktivitaetenVerwaltung -- dieselben für App und Web-Fassung.
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

  // Zwei Gesichter, eine Seite: im Browser ab 992 px dieselben Aktivitäten als
  // Tabelle unter den Reitern von Mitmachen, sonst die Darstellung der App.
  if (breit) {
    return <WebAktivitaetenSeite pageRef={pageRef} verwaltung={verwaltung} />;
  }

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
