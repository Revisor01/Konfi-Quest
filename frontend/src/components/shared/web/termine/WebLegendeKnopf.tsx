// "Legende": oeffnet die Farb- und Zeichenlegende der Events (EventLegendModal,
// dieselbe wie in der App) -- die Eck-Badges der Karten und Zeilen erklaeren
// sich dort.

import React from 'react';
import { IonIcon, useIonModal } from '@ionic/react';
import { ICON_INFO } from '../../icons';
import EventLegendModal, { type EventLegendVariant } from '../../EventLegendModal';
import WebKnopf from '../../../web/WebKnopf';

const WebLegendeKnopf: React.FC<{ variante: EventLegendVariant; presentingElement?: HTMLElement | null }> = ({ variante, presentingElement }) => {
  const [oeffnen, schliessen] = useIonModal(EventLegendModal, {
    variant: variante,
    onClose: () => schliessen(),
  });
  return (
    <WebKnopf onClick={() => oeffnen({ presentingElement: presentingElement || undefined })} title="Was die Farben und Zeichen bedeuten">
      <IonIcon icon={ICON_INFO} aria-hidden="true" />
      Legende
    </WebKnopf>
  );
};

export default WebLegendeKnopf;
