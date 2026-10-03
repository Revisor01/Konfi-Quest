// Punkte vergeben aus der Konfi-Liste der Web-Fassung: dieselben Fenster wie in
// der Detailansicht (ActivityModal fuer eine Aktivitaet, BonusModal fuer
// Bonuspunkte), vorbelegt mit der gewaehlten Konfi und den Punktearten ihres
// Jahrgangs -- eine abgeschaltete Art bietet das Fenster nicht an.

import { useState } from 'react';
import { useIonModal } from '@ionic/react';
import ActivityModal from '../../modals/ActivityModal';
import BonusModal from '../../modals/BonusModal';
import { useLiveUpdate } from '../../../../contexts/LiveUpdateContext';
import type { KonfiListenEintrag } from '../../../../utils/konfiListe';

export type PunkteVergebenArt = 'aktivitaet' | 'bonus';

export interface PunkteVergeben {
  oeffnen: (konfi: KonfiListenEintrag, art: PunkteVergebenArt) => void;
}

export function usePunkteVergeben(optionen: {
  presentingElement?: HTMLElement | null;
  /** Nach dem Speichern: die Liste neu laden. */
  onGespeichert: () => void | Promise<void>;
}): PunkteVergeben {
  const { presentingElement, onGespeichert } = optionen;
  const { triggerRefresh } = useLiveUpdate();
  const [konfi, setKonfi] = useState<KonfiListenEintrag | null>(null);
  const flags = konfi
    ? { gottesdienst_enabled: konfi.gottesdienst_enabled, gemeinde_enabled: konfi.gemeinde_enabled }
    : undefined;

  const [presentAktivitaet, dismissAktivitaet] = useIonModal(ActivityModal, {
    konfiId: konfi?.id ?? 0,
    targetRole: 'konfi',
    punkteartFlags: flags,
    onClose: () => dismissAktivitaet(),
    onSave: async () => {
      await onGespeichert();
      triggerRefresh('konfis');
      dismissAktivitaet();
    },
  });

  const [presentBonus, dismissBonus] = useIonModal(BonusModal, {
    konfiId: konfi?.id ?? 0,
    punkteartFlags: flags,
    onClose: () => dismissBonus(),
    onSave: async () => {
      await onGespeichert();
      triggerRefresh('konfis');
      dismissBonus();
    },
  });

  const oeffnen = (ziel: KonfiListenEintrag, art: PunkteVergebenArt) => {
    setKonfi(ziel);
    const optionenFenster = { presentingElement: presentingElement || undefined };
    if (art === 'aktivitaet') presentAktivitaet(optionenFenster);
    else presentBonus(optionenFenster);
  };

  return { oeffnen };
}
