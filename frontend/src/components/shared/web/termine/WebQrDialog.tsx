// „QR-Code zum Einchecken" als Fenster der Web-Fassung (Simon, 15.10.2026,
// Seiten-Inventar: im Browser ab 992 px jedes Fenster kompakt). Geöffnet von
// der Seite eines Events bei der Leitung (EventDetailView) und beim Team
// (TeamerEventsPage), jeweils im breiten Layout; unter 992 px und in den Apps
// bleibt das Modal der App (shared/QRDisplayModal.tsx).
//
// Dieselbe Logik wie in der App (useQrAnzeige): derselbe Code
// (POST /events/:id/generate-qr), derselbe Zähler (alle 10 Sekunden
// GET /events/:id/attendance-count), derselbe Satz für die Konfis, dasselbe
// Drucken. Der Code steht groß -- der Bildschirm im Gemeindehaus ist der
// Ort, an dem gescannt wird. Scheitert der Code, steht die Meldung im
// Fenster, mit „Erneut versuchen".

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_DRUCKEN } from '../../icons';
import { datumLang, uhrzeit } from '../../../../utils/dateUtils';
import { useQrAnzeige } from '../../useQrAnzeige';
import WebDialog from '../../../web/WebDialog';
import WebHinweis from '../../../web/WebHinweis';
import WebKnopf from '../../../web/WebKnopf';
import '../../../../theme/web/termine.css';

export interface WebQrDialogProps {
  eventId: number;
  eventName: string;
  eventDate: string;
  onSchliessen: () => void;
}

const WebQrDialog: React.FC<WebQrDialogProps> = ({ eventId, eventName, eventDate, onSchliessen }) => {
  const qr = useQrAnzeige(eventId);
  return (
    <WebDialog
      titel="QR-Code zum Einchecken"
      breit
      onSchliessen={onSchliessen}
      aktionen={(
        <>
          <WebKnopf onClick={qr.handlePrint} disabled={!qr.qrDataUrl}>
            <IonIcon icon={ICON_DRUCKEN} aria-hidden="true" />
            Drucken
          </WebKnopf>
          <WebKnopf art="primaer" onClick={onSchliessen}>Schließen</WebKnopf>
        </>
      )}
    >
      <div className="web-einchecken">
        <p className="web-einchecken__name">{eventName}</p>
        {eventDate && <p className="web-einchecken__datum">{datumLang(eventDate)} - {uhrzeit(eventDate)}</p>}
        {qr.loading ? (
          <p className="web-einchecken__hinweis" role="status">Der QR-Code wird erstellt.</p>
        ) : qr.error ? (
          <div className="web-einchecken__fehler">
            <WebHinweis art="fehler" rolle="alert">{qr.error}</WebHinweis>
            <WebKnopf onClick={() => { void qr.loadQR(); }} disabled={!qr.isOnline}>
              {qr.isOnline ? 'Erneut versuchen' : 'Du bist offline'}
            </WebKnopf>
          </div>
        ) : (
          <>
            {qr.qrDataUrl && <img src={qr.qrDataUrl} alt="QR-Code zum Einchecken" className="web-einchecken__bild" />}
            <p className="web-einchecken__zaehler" aria-live="polite">{qr.checkedIn} / {qr.total} eingecheckt</p>
            <p className="web-einchecken__hinweis">Konfis scannen diesen QR-Code mit der App zum Einchecken</p>
          </>
        )}
      </div>
    </WebDialog>
  );
};

export default WebQrDialog;
