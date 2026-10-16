// "Legende": oeffnet die Farb- und Zeichenlegende der Events -- die
// Eck-Badges der Karten und Zeilen erklaeren sich dort. Im Browser ab 992 px
// als Fenster der Web-Fassung (WebLegendeDialog; Simon, 15.10.2026), sonst
// das Modal der App (EventLegendModal). Beide zeigen dieselben Eintraege
// (eventLegende.ts).

import React, { useState } from 'react';
import { IonIcon, useIonModal } from '@ionic/react';
import { ICON_INFO } from '../../icons';
import EventLegendModal, { type EventLegendVariant } from '../../EventLegendModal';
import { useBreitesLayout } from '../../../../navigation/breitesLayout';
import WebKnopf from '../../../web/WebKnopf';
import WebLegendeDialog from './WebLegendeDialog';

const WebLegendeKnopf: React.FC<{ variante: EventLegendVariant; presentingElement?: HTMLElement | null }> = ({ variante, presentingElement }) => {
  const breit = useBreitesLayout();
  const [offen, setOffen] = useState(false);
  const [oeffnen, schliessen] = useIonModal(EventLegendModal, {
    variant: variante,
    onClose: () => schliessen(),
  });
  return (
    <>
      <WebKnopf
        onClick={() => (breit ? setOffen(true) : oeffnen({ presentingElement: presentingElement || undefined }))}
        title="Was die Farben und Zeichen bedeuten"
      >
        <IonIcon icon={ICON_INFO} aria-hidden="true" />
        Legende
      </WebKnopf>
      {offen && <WebLegendeDialog variante={variante} onSchliessen={() => setOffen(false)} />}
    </>
  );
};

export default WebLegendeKnopf;
