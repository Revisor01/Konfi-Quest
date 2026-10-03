// Die Aktivitaeten der Leitung verwalten: laden, anlegen und aendern (Modal),
// loeschen (Rueckfrage) -- die Logik der Seite /admin/activities, damit die
// App-Darstellung (AdminActivitiesPage) und die Web-Fassung (Reiter
// "Aktivitaeten" unter Mitmachen) dieselbe benutzen.
//
// Aus AdminActivitiesPage herausgezogen (03.10.2026, Web-Fassung aller
// Bereiche, docs/planung/web-alle-bereiche.md): Verhalten und Texte
// unveraendert.

import { useState } from 'react';
import { useIonAlert, useIonModal } from '@ionic/react';
import { useApp } from '../../contexts/AppContext';
import { useLiveRefresh } from '../../contexts/LiveUpdateContext';
import { useOfflineQuery } from '../../hooks/useOfflineQuery';
import { CACHE_TTL } from '../../services/offlineCache';
import api from '../../services/api';
import { fehlerText } from '../../utils/fehler';
import { offlineBlockiert } from '../../utils/offlineAktion';
import ActivityManagementModal from './modals/ActivityManagementModal';

export interface Aktivitaet {
  id: number;
  name: string;
  description?: string;
  points: number;
  type: 'gottesdienst' | 'gemeinde' | null;
  target_role?: 'konfi' | 'teamer';
  category?: string;
  created_at: string;
}

export type AktivitaetenRolle = 'konfi' | 'teamer';

/**
 * @param praesentierend  Das Element, ueber dem das Modal aufklappt -- wird erst beim Oeffnen gelesen.
 */
export function useAktivitaetenVerwaltung(praesentierend: () => HTMLElement | undefined) {
  const { user, setError, isOnline } = useApp();
  const [rolle, setRolle] = useState<AktivitaetenRolle>('konfi');

  // Der Schluessel enthaelt die Rolle: useOfflineQuery laedt bei Wechsel die andere Liste.
  const { data: aktivitaeten, loading, refresh, refreshLive } = useOfflineQuery<Aktivitaet[]>(
    `admin:activities:${user?.organization_id}:${rolle}`,
    async () => { const res = await api.get(`/admin/activities?target_role=${rolle}`); return res.data; },
    { ttl: CACHE_TTL.STAMMDATEN }
  );

  const [gewaehlt, setGewaehlt] = useState<Aktivitaet | null>(null);
  const [presentAlert] = useIonAlert();

  const [presentModal, dismissModal] = useIonModal(ActivityManagementModal, {
    activity: gewaehlt,
    activityId: gewaehlt?.id || null,
    targetRole: rolle,
    onClose: () => dismissModal(),
    onSuccess: () => {
      dismissModal();
      refresh();
    }
  });

  useLiveRefresh('activities', refreshLive);

  const loeschen = async (aktivitaet: Aktivitaet) => {
    if (offlineBlockiert(isOnline, setError)) return;
    presentAlert({
      header: 'Aktivität löschen',
      message: `Aktivität "${aktivitaet.name}" wirklich löschen?`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: async () => {
            try {
              await api.delete(`/admin/activities/${aktivitaet.id}`);
              await refresh();
            } catch (err) {
              const errorMessage = fehlerText(err, 'Fehler beim Löschen der Aktivität');
              setError(errorMessage, { ort: 'aktivitaet-loeschen-verwaltung', fehler: err });
            }
          }
        }
      ]
    });
  };

  const bearbeiten = (aktivitaet: Aktivitaet) => {
    setGewaehlt(aktivitaet);
    presentModal({ presentingElement: praesentierend() });
  };

  const anlegen = () => {
    setGewaehlt(null);
    presentModal({ presentingElement: praesentierend() });
  };

  // Rollen-basierte Berechtigungen (org_admin und admin duerfen alles)
  const istLeitung = ['org_admin', 'admin'].includes(user?.role_name || '');

  return {
    aktivitaeten,
    loading,
    refresh,
    rolle,
    setRolle,
    loeschen,
    bearbeiten,
    anlegen,
    darfAnlegen: istLeitung,
    darfBearbeiten: istLeitung,
    darfLoeschen: istLeitung,
  };
}
