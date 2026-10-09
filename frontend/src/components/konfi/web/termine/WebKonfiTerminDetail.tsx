// Ein Event bei Konfis in der Web-Fassung (/konfi/events/:id, 03.10.2026,
// docs/planung/web-alle-bereiche.md, Entscheidung 6) auf dem Geruest aller
// Detailseiten (components/web/WebDetailSeite.tsx; Simon, 06.10.2026: „Inhalt
// links, Angaben rechts"). Im Kopf Titel, Kennzeichen und ALLE Aktionen --
// Anmelden oder Abmelden, Einchecken, Chat; was die Karte "Bist du dabei?"
// erklaerte (Warteliste Platz 3, Abmeldefrist, Anwesend), steht als Hinweis
// ueber den Kennzahlen. Links breit die Beschreibung und wer dabei ist, rechts
// schmal die Angaben.
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
import WebDetailSeite from '../../../web/WebDetailSeite';
import WebKarte from '../../../web/WebKarte';
import WebKnopf from '../../../web/WebKnopf';
import WebHinweis from '../../../web/WebHinweis';
import { WebFehler, WebLaden } from '../../../web/WebZustaende';
import { WebAbsage, WebTerminAngaben, WebTerminMarken } from '../../../shared/web/termine/WebTerminBausteine';
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
  /**
   * Ohne Netz aus dem gemerkten Stand des Termins bekannt -- auch leer
   * (services/detailSpeicher.ts). Dann kein Offline-Hinweis.
   */
  gemerkt?: { teilnehmer: boolean; zeitfenster: boolean };
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
      <WebDetailSeite bereich="Mitmachen" titel="Event" zurueck={ZURUECK} pageRef={p.pageRef}
        zustand={(
          <WebLaden karten={2} text="Das Event wird geladen." />
        )}
      />
    );
  }
  if (!eventData) {
    return (
      <WebDetailSeite bereich="Mitmachen" titel="Event nicht gefunden" zurueck={ZURUECK} pageRef={p.pageRef}
        zustand={(
          <WebFehler text="Dieses Event gibt es nicht (mehr) oder du siehst es nicht." onErneut={aktionen.neuLaden} />
        )}
      />
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
  const einchecken = eventData.booking_status === 'confirmed' && !eventData.attendance_status;

  // Alle Aktionen im Kopf; die wichtigste -- Anmelden, auch Wieder anmelden und die
  // Warteliste -- rechts und als primaerer Knopf, Abmelden als Gefahr.
  const aktion = zustand.knopf;
  const kopfAktionen = (
    <>
      {eventData.chat_room_id && (
        <WebKnopf onClick={aktionen.chat} aria-label="Event-Chat öffnen">
          <IonIcon icon={ICON_CHAT} aria-hidden="true" />
          Chat
        </WebKnopf>
      )}
      {einchecken && (
        <WebKnopf onClick={aktionen.einchecken}>
          <IonIcon icon={ICON_QRCODE} aria-hidden="true" />
          Einchecken
        </WebKnopf>
      )}
      {aktion && (
        <WebKnopf
          art={aktion.gefahr ? 'gefahr' : 'primaer'}
          disabled={aktion.sperrt}
          onClick={aktionen[AKTION_ZU_FUNKTION[aktion.aktion]]}
        >
          {aktion.text}
        </WebKnopf>
      )}
    </>
  );

  // Ein abgesagtes Event sagt es schon in WebAbsage -- konfiAnmeldeZustand wiederholt dort nur
  // "Dieses Event ist abgesagt". Was die Karte "Bist du dabei?" der App erklaert, steht hier als Hinweis:
  // der Stand, die Erklaerung zum gesperrten Knopf ("Abmelden geht nur bis 2 Tage vorher"), Anwesend.
  const zustandHinweis = abgesagt ? undefined : zustand.hinweis;
  const hinweis = (abgesagt || zustandHinweis || zustand.gesperrt || eventData.attendance_status === 'present') ? (
    <>
      {abgesagt && <WebAbsage event={eventData} />}
      {zustandHinweis && (
        <WebHinweis art={zustandHinweis.art === 'info' ? 'hinweis' : zustandHinweis.art}>{zustandHinweis.text}</WebHinweis>
      )}
      {zustand.gesperrt && <WebHinweis art="hinweis">{zustand.gesperrt.text}</WebHinweis>}
      {eventData.attendance_status === 'present' && <WebHinweis art="erfolg">Anwesend</WebHinweis>}
    </>
  ) : undefined;

  // Links, breit: Beschreibung, dann wer dabei ist.
  const haupt = (
    <>
      {eventData.description && (
        <WebKarte titel="Beschreibung">
          <p className="web-beschreibung">{eventData.description}</p>
        </WebKarte>
      )}

      {p.teilnehmende.length === 0 && !isOnline && !p.gemerkt?.teilnehmer && (
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

  // Rechts, schmal: die Angaben.
  const seite = (
    <WebKarte titel="Angaben">
      {eventData.has_timeslots && p.zeitfenster.length === 0 && !isOnline && !p.gemerkt?.zeitfenster && (
        <WebHinweis art="hinweis">Die Zeitfenster-Auswahl ist offline nicht verfügbar.</WebHinweis>
      )}
      <WebTerminAngaben angaben={angaben} />
    </WebKarte>
  );

  return (
    <WebDetailSeite
      bereich="Mitmachen"
      zurueck={ZURUECK}
      titel={eventData.name}
      kennzeichen={(
        <span className="web-pillreihe">
          <WebTerminMarken status={status} event={eventData} teamZeigen={false} />
          <span>{zeitraumText(eventData)}</span>
        </span>
      )}
      aktionen={kopfAktionen}
      hinweis={hinweis}
      kennzahlen={konfiKennzahlen(eventData).map((k) => ({ label: k.label, wert: k.wert }))}
      haupt={haupt}
      seite={seite}
      pageRef={p.pageRef}
    />
  );
};

export default WebKonfiTerminDetail;
