// Die Aktionen auf einer Gemeinde der Verwaltung -- fuer beide Gesichter der
// Seite /admin/organizations (App: Liste mit Wischaktionen, Web: Tabelle der
// Support-Ansicht): das Formular "Gemeinde" oeffnen (neu oder bearbeiten),
// direkt in eine Gemeinde springen (?gemeinde=<id>) und eine Gemeinde loeschen.
//
// EINE Stelle, damit beide Gesichter dasselbe tun. Bis 03.10.2026 stand das
// alles in AdminOrganizationsPage.

import { useEffect, useState } from 'react';
import { useIonAlert, useIonModal } from '@ionic/react';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import { useAppLocation } from '../../../navigation/useAppLocation';
import { fehlerText } from '../../../utils/fehler';
import { offlineBlockiert } from '../../../utils/offlineAktion';
import api from '../../../services/api';
import OrganizationManagementModal from '../modals/OrganizationManagementModal';

/** Antwort von DELETE /organizations/:id; die Zahlen seit dem 29.09.2026. */
interface GemeindeGeloeschtAntwort {
  konten_geloescht?: number;
  konten_umgezogen?: number;
}

const konten = (anzahl: number) => `${anzahl} ${anzahl === 1 ? 'Konto' : 'Konten'}`;

/** Die Meldung nach dem Löschen: mit den Zahlen der Konten, wenn der Server sie schickt. */
const gemeindeGeloeschtMeldung = (name: string, antwort?: GemeindeGeloeschtAntwort | null): string => {
  const geloescht = antwort?.konten_geloescht;
  const umgezogen = antwort?.konten_umgezogen;
  if (typeof geloescht !== 'number' || typeof umgezogen !== 'number') return `Gemeinde "${name}" gelöscht`;
  return `Gemeinde "${name}" gelöscht: ${konten(geloescht)} gelöscht, ${konten(umgezogen)} in eine andere Gemeinde umgezogen`;
};

/** Was zum Loeschen einer Gemeinde gebraucht wird. */
export interface GemeindeZumLoeschen {
  id: number;
  name: string;
  display_name: string;
}

/**
 * @param onAktualisiert  Die Liste neu laden (nach Speichern und Loeschen).
 */
export function useGemeindeAktionen(onAktualisiert: () => unknown) {
  const { setError, setSuccess, isOnline, refreshUser } = useApp();
  const { pageRef, presentingElement } = useModalPage('admin-organizations');
  const [modalOrganizationId, setModalOrganizationId] = useState<number | null>(null);
  // Gleich ins Formular statt in die Ansicht (Web-Fassung: "Bearbeiten" in der Tabelle).
  const [direktBearbeiten, setDirektBearbeiten] = useState(false);
  const [presentAlert] = useIonAlert();

  // Modal mit useIonModal Hook
  const [presentOrganizationModalHook, dismissOrganizationModalHook] = useIonModal(OrganizationManagementModal, {
    organizationId: modalOrganizationId,
    direktBearbeiten,
    onClose: () => {
      dismissOrganizationModalHook();
      setModalOrganizationId(null);
    },
    onSuccess: () => {
      dismissOrganizationModalHook();
      // User-State neu laden -> Trial-Banner erscheint/verschwindet sofort
      // (ohne Logout/Neustart). Bedingungslos: ein /me-Call ist guenstig, und
      // der Vergleich auf die eigene Org war fehleranfaellig (modalOrganizationId
      // wurde teils schon zurückgesetzt). super_admin ohne Org schadet es nicht.
      refreshUser();
      setModalOrganizationId(null);
      setDirektBearbeiten(false);
      onAktualisiert();
    },
  });

  // Seit dem 29.09.2026 loescht DELETE /organizations/:id nur die Konten, die
  // allein zu dieser Gemeinde gehoeren; wer auch in einer anderen Mitglied
  // ist, zieht dorthin um bzw. bleibt dort (backend/routes/organizations.js).
  // Abfrage und Meldung sagen das -- die Zahlen kommen aus der Antwort
  // (konten_geloescht, konten_umgezogen; ein aelterer Server schickt sie nicht).
  const loeschen = (organization: GemeindeZumLoeschen) => {
    if (offlineBlockiert(isOnline, setError)) return;
    presentAlert({
      header: 'Gemeinde löschen',
      message: `Gemeinde "${organization.display_name}" (${organization.name}) wirklich löschen?\n\n`
        + 'Alle Daten der Gemeinde werden gelöscht, dazu jedes Konto, das nur zu ihr gehört. '
        + 'Wer auch zu einer anderen Gemeinde gehört, behält sein Konto und bleibt dort.\n\n'
        + 'Das lässt sich nicht rückgängig machen.',
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: async () => {
            try {
              const res = await api.delete(`/organizations/${organization.id}`);
              setSuccess(gemeindeGeloeschtMeldung(organization.display_name, res?.data));
              await onAktualisiert();
            } catch (err) {
              setError(fehlerText(err, 'Fehler beim Löschen der Gemeinde'));
            }
          },
        },
      ],
    });
  };

  /** Eine Gemeinde oeffnen: in der Ansicht (Vorgabe) oder mit `direkt` gleich im Formular. */
  const bearbeiten = (organizationId: number, optionen: { direkt?: boolean } = {}) => {
    setModalOrganizationId(organizationId);
    setDirektBearbeiten(optionen.direkt === true);
    presentOrganizationModalHook({ presentingElement });
  };

  // Direkt in eine Gemeinde: /admin/organizations?gemeinde=<id> oeffnet sie
  // (aus der Support-Ansicht -- Kennzahlen je Gemeinde, "Gemeinde oeffnen"
  // nach dem Anlegen aus einer Anfrage); mit &bearbeiten=1 gleich im Formular.
  // Nur beim Aufruf mit dieser Adresse, nicht bei jedem neuen Modal-Haken --
  // deshalb haengt der Effekt allein an der Abfrage.
  const { search } = useAppLocation();
  useEffect(() => {
    const abfrage = new URLSearchParams(search);
    const id = Number(abfrage.get('gemeinde'));
    if (!Number.isInteger(id) || id <= 0) return;
    setModalOrganizationId(id);
    // Mit &bearbeiten=1 (Link "Bearbeiten" im Schriftwechsel einer Gemeinde) gleich im Formular.
    setDirektBearbeiten(abfrage.get('bearbeiten') === '1');
    presentOrganizationModalHook({ presentingElement });
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const neu = () => {
    setModalOrganizationId(null);
    setDirektBearbeiten(false);
    presentOrganizationModalHook({ presentingElement });
  };

  return { pageRef, bearbeiten, neu, loeschen };
}
