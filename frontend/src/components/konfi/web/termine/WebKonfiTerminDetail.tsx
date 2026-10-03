// Ein Event bei Konfis in der Web-Fassung (/konfi/events/:id, 03.10.2026,
// docs/planung/web-alle-bereiche.md, Entscheidung 6): zweispaltig. Links die
// Kennzahlen, die Angaben und die Beschreibung; rechts "Bist du dabei?" mit
// Anmelden und Abmelden, das Einchecken per QR-Code und wer dabei ist.
//
// Die Ansicht (konfi/views/EventDetailView) laedt, besitzt die Funktionen
// (Anmelden mit Zeitfenster-Wahl und Konfirmations-Pruefung, Abmelden mit Grund,
// Einchecken) und reicht beides herein. Welcher Knopf wann dasteht, entscheidet
// konfiAnmeldeZustand (utils/termineWeb.ts) -- dieselbe Kette wie die Karte
// "Bist du dabei?" der App.

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_CHAT, ICON_QRCODE } from '../../../shared/icons';
import { istAbgesagt, zeitraumText } from '../../../shared/eventFormatting';
import {
  konfiAnmeldeZustand,
  konfiDetailStatus,
  konfiKennzahlen,
  terminAngaben,
  type AnmeldeAktion,
  type DetailZeitfenster,
} from '../../../../utils/termineWeb';
import type { Event } from '../../../../types/event';
import WebSeite from '../../../web/WebSeite';
import WebSpalten from '../../../web/WebSpalten';
import WebKarte from '../../../web/WebKarte';
import WebKachel from '../../../web/WebKachel';
import WebKnopf from '../../../web/WebKnopf';
import WebHinweis from '../../../web/WebHinweis';
import { WebFehler, WebLaden } from '../../../web/WebZustaende';
import { WebAbsage, WebAktionsKnopf, WebTerminAngaben, WebTerminMarken } from '../../../shared/web/termine/WebTerminBausteine';
import '../../../../theme/web/termine.css';

export interface KonfiDetailAktionen {
  /** Anmelden -- auch "Wieder anmelden" und die Warteliste: die Seite fragt bei Zeitfenstern nach. */
  anmelden: () => void;
  /** Abmelden mit Grund (Fenster der App) -- auch von der Warteliste. */
  abmelden: () => void;
  /** Abmelden vom Pflicht-Event (Fenster mit Grund, mindestens 5 Zeichen). */
  pflichtAbmelden: () => void;
  pflichtWiederAnmelden: () => void;
  einchecken: () => void;
  chat: () => void;
  neuLaden: () => void;
}

export interface WebKonfiTerminDetailProps {
  pageRef: React.Ref<HTMLElement>;
  laedt: boolean;
  eventData: Event | null;
  zeitfenster: readonly DetailZeitfenster[];
  teilnehmende: ReadonlyArray<{ id: number; display_name: string }>;
  hatKonfirmationGebucht: boolean;
  isOnline: boolean;
  /** Eine Anmeldung laeuft gerade (Sperre gegen den Doppeltipp). */
  anmeldungLaeuft: boolean;
  aktionen: KonfiDetailAktionen;
}

const ZURUECK = { href: '/konfi/events', text: 'Alle Events' };

const AKTION_ZU_FUNKTION: Record<AnmeldeAktion, keyof Pick<KonfiDetailAktionen, 'anmelden' | 'abmelden' | 'pflichtAbmelden' | 'pflichtWiederAnmelden'>> = {
  anmelden: 'anmelden',
  wiederAnmelden: 'anmelden',
  abmelden: 'abmelden',
  wartelisteAbmelden: 'abmelden',
  pflichtAbmelden: 'pflichtAbmelden',
  pflichtWiederAnmelden: 'pflichtWiederAnmelden',
};

const WebKonfiTerminDetail: React.FC<WebKonfiTerminDetailProps> = (p) => {
  const { eventData, aktionen, isOnline } = p;

  if (p.laedt) {
    return (
      <WebSeite bereich="Mitmachen" titel="Event" zurueck={ZURUECK} pageRef={p.pageRef}>
        <WebLaden karten={2} text="Das Event wird geladen." />
      </WebSeite>
    );
  }
  if (!eventData) {
    return (
      <WebSeite bereich="Mitmachen" titel="Event nicht gefunden" zurueck={ZURUECK} pageRef={p.pageRef}>
        <WebFehler text="Dieses Event gibt es nicht (mehr) oder du siehst es nicht." onErneut={aktionen.neuLaden} />
      </WebSeite>
    );
  }

  const abgesagt = istAbgesagt(eventData);
  const status = konfiDetailStatus(eventData);
  const zustand = konfiAnmeldeZustand(eventData, {
    online: isOnline,
    laeuft: p.anmeldungLaeuft,
    hatKonfirmationGebucht: p.hatKonfirmationGebucht,
  });
  const angaben = terminAngaben(eventData, { rolle: 'konfi', zeitfenster: p.zeitfenster });
  const kennzahlen = konfiKennzahlen(eventData);
  const einchecken = eventData.booking_status === 'confirmed' && !eventData.attendance_status;

  const haupt = (
    <>
      {abgesagt && <WebAbsage event={eventData} />}

      <div className="web-raster web-raster--kacheln">
        {kennzahlen.map((k) => <WebKachel key={k.label} label={k.label} wert={k.wert} />)}
      </div>

      <WebKarte titel="Angaben">
        {eventData.has_timeslots && p.zeitfenster.length === 0 && !isOnline && (
          <WebHinweis art="hinweis">Die Zeitfenster-Auswahl ist offline nicht verfügbar.</WebHinweis>
        )}
        <WebTerminAngaben angaben={angaben} />
      </WebKarte>

      {eventData.description && (
        <WebKarte titel="Beschreibung">
          <p className="web-beschreibung">{eventData.description}</p>
        </WebKarte>
      )}
    </>
  );

  const seite = (
    <>
      <WebKarte titel="Bist du dabei?">
        <div className="web-block-knoepfe">
          {zustand.hinweis && (
            <WebHinweis art={zustand.hinweis.art === 'info' ? 'hinweis' : zustand.hinweis.art}>{zustand.hinweis.text}</WebHinweis>
          )}
          {zustand.knopf && (
            <WebAktionsKnopf
              art={zustand.knopf.gefahr ? 'gefahr' : zustand.knopf.gruen ? 'erfolg' : 'warnung'}
              disabled={zustand.knopf.sperrt}
              onClick={aktionen[AKTION_ZU_FUNKTION[zustand.knopf.aktion]]}
            >
              {zustand.knopf.text}
            </WebAktionsKnopf>
          )}
          {zustand.gesperrt && <WebAktionsKnopf art="neutral" disabled>{zustand.gesperrt.text}</WebAktionsKnopf>}
          {eventData.attendance_status === 'present' && <WebHinweis art="erfolg">Anwesend</WebHinweis>}
          {einchecken && (
            <WebAktionsKnopf art="neutral" onClick={aktionen.einchecken}>
              <IonIcon icon={ICON_QRCODE} aria-hidden="true" />
              Einchecken
            </WebAktionsKnopf>
          )}
        </div>
      </WebKarte>

      {p.teilnehmende.length === 0 && !isOnline && (
        <WebHinweis art="hinweis">Die Teilnehmerliste ist offline nicht verfügbar.</WebHinweis>
      )}
      {p.teilnehmende.length > 0 && (
        <WebKarte titel={`Teilnehmer:innen (${p.teilnehmende.length})`} bund>
          <ul className="web-liste-schlicht">
            {p.teilnehmende.map((t) => (
              <li key={t.id} className="web-liste-schlicht__zeile">{t.display_name}</li>
            ))}
          </ul>
        </WebKarte>
      )}
    </>
  );

  return (
    <WebSeite
      bereich="Mitmachen"
      titel={eventData.name}
      untertitel={(
        <span className="web-pillreihe">
          <WebTerminMarken status={status} event={eventData} teamZeigen={false} />
          <span>{zeitraumText(eventData)}</span>
        </span>
      )}
      aktionen={eventData.chat_room_id ? (
        <WebKnopf onClick={aktionen.chat} aria-label="Event-Chat öffnen">
          <IonIcon icon={ICON_CHAT} aria-hidden="true" />
          Chat
        </WebKnopf>
      ) : undefined}
      zurueck={ZURUECK}
      pageRef={p.pageRef}
    >
      <WebSpalten haupt={haupt} seite={seite} seiteBeschriftung="Anmeldung und Teilnehmende" />
    </WebSeite>
  );
};

export default WebKonfiTerminDetail;
