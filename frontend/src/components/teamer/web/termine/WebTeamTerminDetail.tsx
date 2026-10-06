// Ein Event beim Team in der Web-Fassung (/teamer/events?eventId=<id>,
// 03.10.2026, docs/planung/web-alle-bereiche.md, Entscheidung 6): zweispaltig.
// Links die Kennzahlen, die Angaben, die Beschreibung und das Material; rechts
// "Bist du dabei?" mit Zusage und Absage und -- nur lesend -- wer kommt.
//
// Die Seite (TeamerEventsPage) laedt, besitzt die Funktionen (Zusage und
// Absage mit Grund, QR-Code, Material) und reicht beides herein. Verbucht,
// abgemeldet und entfernt wird bei der Leitung (requireAdmin) -- die Tabelle
// hat deshalb keine Knoepfe.

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_CHAT, ICON_ABSAGE, ICON_JAHRGANG, ICON_QRCODE, ICON_ZUSAGE_GEFUELLT } from '../../../shared/icons';
import { istAbgesagt, zeitraumText } from '../../../shared/eventFormatting';
import { konfisInReihenfolge } from '../../../../utils/teilnehmerReihenfolge';
import { teilnahmeDarstellung, type TeilnahmeDarstellung } from '../../../../utils/teilnahmeStatus';
import { absageBeschriftung, hatAbgesagt, zusageBeschriftung } from '../../../../utils/zusageKnoepfe';
import type { PillTon } from '../../../../utils/supportWeb';
import {
  teamDetailStatus,
  teamKennzahlen,
  teamZusageZustand,
  terminAngaben,
  type DetailZeitfenster,
} from '../../../../utils/termineWeb';
import type { Event, Participant } from '../../../../types/event';
import WebSeite from '../../../web/WebSeite';
import WebSpalten from '../../../web/WebSpalten';
import WebKarte from '../../../web/WebKarte';
import WebKachel from '../../../web/WebKachel';
import WebKnopf from '../../../web/WebKnopf';
import WebHinweis from '../../../web/WebHinweis';
import WebPill from '../../../web/WebPill';
import WebTabelle, { type WebSpalte } from '../../../web/WebTabelle';
import { WebLeer } from '../../../web/WebZustaende';
import {
  WebAbsage,
  WebAktionsKnopf,
  WebTeilnahmeHinweise,
  WebTerminAngaben,
  WebTerminMarken,
} from '../../../shared/web/termine/WebTerminBausteine';
import '../../../../theme/web/termine.css';

const TON: Record<TeilnahmeDarstellung['farbe'], PillTon> = {
  danger: 'fehler',
  neutral: 'neutral',
  success: 'erfolg',
  warning: 'warnung',
  info: 'info',
};

export interface TeamDetailAktionen {
  /** Zusage (dabei) oder Absage -- die Seite fragt bei einer Absage nach Zusage nach dem Grund. */
  zusage: (dabei: boolean) => void;
  absage: () => void;
  qr: () => void;
  chat: () => void;
  material: (id: number) => void;
  neuLaden: () => void;
}

export interface WebTeamTerminDetailProps {
  pageRef: React.Ref<HTMLElement>;
  /** Der Termin gehoert zu einem Jahrgang, dem diese Person nicht zugewiesen ist (403). */
  jahrgangFehlt: boolean;
  /** Der Termin wird noch ausgewaehlt (Adresse ist gesetzt, die Liste noch nicht da). */
  laedt: boolean;
  event: Event | null;
  teilnehmende: readonly Participant[];
  materialien: ReadonlyArray<{ id: number; title: string; file_count?: number; link_url?: string | null }>;
  zeitfenster: readonly DetailZeitfenster[];
  isOnline: boolean;
  /** Eine Zusage oder Absage laeuft gerade. */
  bucht: boolean;
  aktionen: TeamDetailAktionen;
}

const ZURUECK = { href: '/teamer/events', text: 'Alle Events' };

/** Eine Teilnehmerliste -- nur lesend: Name, Status, Hinweise. */
const WerKommt: React.FC<{ titel: string; personen: readonly Participant[] }> = ({ titel, personen }) => {
  const spalten: Array<WebSpalte<Participant>> = [
    {
      schluessel: 'name',
      kopf: 'Name',
      breite: '40%',
      zelle: (x) => (
        <>
          <span className="web-zelle-titel">{x.participant_name}</span>
          {x.jahrgang_name && <span className="web-zelle-leise">{x.jahrgang_name}</span>}
        </>
      ),
    },
    {
      schluessel: 'status',
      kopf: 'Status',
      zelle: (x) => {
        const d = teilnahmeDarstellung(x);
        return (
          <>
            <span><WebPill ton={TON[d.farbe]} punkt>{d.statusText}</WebPill></span>
            <WebTeilnahmeHinweise person={x} />
          </>
        );
      },
    },
  ];
  return (
    <WebKarte titel={`${titel} (${personen.length})`} bund>
      <WebTabelle beschriftung={titel} spalten={spalten} zeilen={personen} zeileSchluessel={(x) => x.id} />
    </WebKarte>
  );
};

const WebTeamTerminDetail: React.FC<WebTeamTerminDetailProps> = (p) => {
  const { event, aktionen, isOnline } = p;

  if (p.jahrgangFehlt) {
    return (
      <WebSeite bereich="Mitmachen" titel="Event" zurueck={ZURUECK} pageRef={p.pageRef}>
        <WebLeer
          icon={ICON_JAHRGANG}
          titel="Nicht deinem Jahrgang zugeordnet"
          text="Dieses Event gehört zu einem Jahrgang, dem du nicht zugewiesen bist. Die Leitung deiner Gemeinde kann das in den Einstellungen ändern."
        />
      </WebSeite>
    );
  }
  if (p.laedt || !event) {
    return (
      <WebSeite bereich="Mitmachen" titel="Event" zurueck={ZURUECK} pageRef={p.pageRef}>
        <WebLeer icon={ICON_JAHRGANG} titel="Event wird geladen" text="Einen Moment, das Event wird geöffnet." />
      </WebSeite>
    );
  }

  const abgesagt = istAbgesagt(event);
  const status = teamDetailStatus(event);
  const zusage = teamZusageZustand(event);
  const angaben = terminAngaben(event, { rolle: 'team', zeitfenster: p.zeitfenster, materialien: p.materialien });
  const materialHinweis = () => {
    if (p.materialien.length === 1) { aktionen.material(p.materialien[0].id); return; }
    document.getElementById('web-event-material')?.scrollIntoView({ block: 'start' });
  };

  // Pflicht-Event: nach Vornamen, sonst Anmeldereihenfolge (utils/teilnehmerReihenfolge.ts).
  const konfis = konfisInReihenfolge(p.teilnehmende.filter((x) => x.role_name === 'konfi'), event.mandatory);
  const team = p.teilnehmende.filter((x) => x.role_name !== 'konfi');

  // Zusage und Absage: noch nichts gesagt, beide Knoepfe; danach nur der Weg zurueck (Simon, 05.09.2026).
  const knoepfe = (() => {
    if (!zusage?.zeigtKnoepfe) return null;
    const zugesagt = !!event.is_registered;
    const abgesagtVonMir = hatAbgesagt(event.booking_status);
    const zusageKnopf = (
      <WebAktionsKnopf art="erfolg" disabled={p.bucht || !isOnline || !zusage.zusageMoeglich} onClick={() => aktionen.zusage(true)}>
        <IonIcon icon={ICON_ZUSAGE_GEFUELLT} aria-hidden="true" />
        {p.bucht ? 'Wird verarbeitet...' : !isOnline ? 'Du bist offline' : zusageBeschriftung(abgesagtVonMir ? 'opted_out' : null, zusage.zusageText)}
      </WebAktionsKnopf>
    );
    const absageKnopf = (
      <WebAktionsKnopf art="gefahr" disabled={p.bucht} onClick={aktionen.absage}>
        <IonIcon icon={ICON_ABSAGE} aria-hidden="true" />
        {p.bucht ? 'Wird verarbeitet...' : absageBeschriftung(zugesagt ? 'confirmed' : null)}
      </WebAktionsKnopf>
    );
    if (zugesagt) return absageKnopf;
    if (abgesagtVonMir) return zusageKnopf;
    return <>{zusageKnopf}{absageKnopf}</>;
  })();

  const haupt = (
    <>
      {abgesagt && <WebAbsage event={event} />}

      <div className="web-raster web-raster--kacheln">
        {teamKennzahlen(event).map((k) => <WebKachel key={k.label} label={k.label} wert={k.wert} />)}
      </div>

      <WebKarte titel="Angaben">
        <WebTerminAngaben angaben={angaben} onMaterial={materialHinweis} />
      </WebKarte>

      {event.description && (
        <WebKarte titel="Beschreibung">
          <p className="web-beschreibung">{event.description}</p>
        </WebKarte>
      )}

      {p.materialien.length > 0 && (
        <section id="web-event-material" aria-label="Material">
          <WebKarte titel={`Material (${p.materialien.length})`} bund>
            <ul className="web-liste-schlicht">
              {p.materialien.map((m) => (
                <li key={m.id} className="web-liste-schlicht__zeile">
                  <button type="button" className="web-link web-link--text web-link--knopf" onClick={() => aktionen.material(m.id)}>
                    {m.title}
                  </button>
                  <span className="web-zelle-leise">
                    {m.link_url ? 'Link' : `${m.file_count || 0} ${(m.file_count || 0) === 1 ? 'Datei' : 'Dateien'}`}
                  </span>
                </li>
              ))}
            </ul>
          </WebKarte>
        </section>
      )}
    </>
  );

  const seite = (
    <>
      {/* Ist nichts zu zeigen (vergangen, nicht dabei), entfaellt die ganze Karte. */}
      {zusage && (
        <WebKarte titel="Bist du dabei?">
          <div className="web-block-knoepfe">
            {zusage.hinweis && (
              <WebHinweis art={zusage.hinweis.art === 'info' ? 'hinweis' : zusage.hinweis.art}>{zusage.hinweis.text}</WebHinweis>
            )}
            {knoepfe}
          </div>
        </WebKarte>
      )}

      {konfis.length > 0 && <WerKommt titel="Konfis" personen={konfis} />}
      {team.length > 0 && <WerKommt titel="Team" personen={team} />}
    </>
  );

  return (
    <WebSeite
      bereich="Mitmachen"
      titel={event.name}
      untertitel={(
        <span className="web-pillreihe">
          <WebTerminMarken status={status} event={event} teamZeigen />
          <span>{zeitraumText(event)}</span>
        </span>
      )}
      aktionen={(
        <>
          {event.chat_room_id && (
            <WebKnopf onClick={aktionen.chat} aria-label="Event-Chat öffnen">
              <IonIcon icon={ICON_CHAT} aria-hidden="true" />
              Chat
            </WebKnopf>
          )}
          <WebKnopf onClick={aktionen.qr} aria-label="QR-Code zum Einchecken anzeigen">
            <IonIcon icon={ICON_QRCODE} aria-hidden="true" />
            QR-Code
          </WebKnopf>
        </>
      )}
      zurueck={ZURUECK}
      pageRef={p.pageRef}
    >
      <WebSpalten haupt={haupt} seite={seite} seiteBeschriftung="Anmeldung und Teilnehmende" />
    </WebSeite>
  );
};

export default WebTeamTerminDetail;
