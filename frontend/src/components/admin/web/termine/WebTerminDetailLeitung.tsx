// Ein Event bei der Leitung in der Web-Fassung (/admin/events/:id, 03.10.2026,
// docs/planung/web-alle-bereiche.md, Entscheidung 6) auf dem Geruest aller
// Detailseiten (components/web/WebDetailSeite.tsx; Simon, 06.10.2026: „Inhalt
// links, Angaben rechts"). Im Kopf Titel, Kennzeichen und ALLE Aktionen --
// auch die eigene Zusage und Absage; darunter die Kennzahlen. Links breit die
// Beschreibung, Konfis, Warteliste und Team als Tabellen mit Anwesenheit und
// die Abmeldungen; rechts schmal die Angaben, Zeitfenster, Serie und Material.
//
// Die Seite (admin/views/EventDetailView) laedt die Daten und besitzt alle
// Funktionen (Anwesenheit verbuchen, Absagen, Teilnehmende verwalten ...); sie
// reicht beides herein. Hier steht nur die Darstellung. Was die App fragt --
// Rueckfragen, Fenster mit Grund und Notiz, die Wahl der Personen --, laeuft
// ueber dieselben Modale und Alerts.

import React from 'react';
import { IonIcon } from '@ionic/react';
import {
  ICON_ABSAGE,
  ICON_BEARBEITEN,
  ICON_CHAT,
  ICON_GESPERRT,
  ICON_JAHRGANG,
  ICON_KOPIEREN,
  ICON_QRCODE,
  ICON_RUECKGAENGIG,
  ICON_ZUSAGE_GEFUELLT,
} from '../../../shared/icons';
import { formatEventTime, istAbgesagt, zeitraumText } from '../../../shared/eventFormatting';
import { konfisInReihenfolge } from '../../../../utils/teilnehmerReihenfolge';
import { absageBeschriftung, welcheKnoepfe, zusageBeschriftung } from '../../../../utils/zusageKnoepfe';
import { datumKurz, datumUhrzeit } from '../../../../utils/dateUtils';
import { kennzahlAnzeige, leitungDetailStatus, leitungKennzahlen, terminAngaben } from '../../../../utils/termineWeb';
import type { Event, EventMaterial, Participant, Unregistration } from '../../../../types/event';
import WebDetailSeite from '../../../web/WebDetailSeite';
import WebKarte from '../../../web/WebKarte';
import WebKnopf from '../../../web/WebKnopf';
import WebHinweis from '../../../web/WebHinweis';
import WebLink from '../../../web/WebLink';
import WebPill from '../../../web/WebPill';
import WebTabelle, { type WebSpalte } from '../../../web/WebTabelle';
import { WebFehler, WebLaden, WebLeer } from '../../../web/WebZustaende';
import { WebAbsage, WebTerminAngaben, WebTerminMarken } from '../../../shared/web/termine/WebTerminBausteine';
import type { EventData } from '../../views/EventDetailSections';
import WebTeilnehmerLeitung, { type TeilnehmerAktionen } from './WebTeilnehmerLeitung';
import '../../../../theme/web/termine.css';
import { zeitfensterStatusRang } from '../../../../utils/statusReihenfolge';

export interface LeitungDetailAktionen extends TeilnehmerAktionen {
  alleBestaetigen: (anzahl: number, wartend: number, rolle: 'konfi' | 'teamer') => void;
  hinzufuegen: (wen: 'konfi' | 'team' | 'leitung') => void;
  absagen: () => void;
  zuruecknehmen: () => void;
  bearbeiten: () => void;
  kopieren: () => void;
  qr: () => void;
  chat: () => void;
  material: (id: number) => void;
  /** Die eigene Zusage oder Absage der Leitung (sie meldet sich wie das Team). */
  eigeneZusage: (dabei: boolean) => void;
  eigeneAbsage: () => void;
  neuLaden: () => void;
}

export interface WebTerminDetailLeitungProps {
  pageRef: React.Ref<HTMLElement>;
  laedt: boolean;
  /** Der Termin gehoert zu einem Jahrgang, dem diese Person nicht zugewiesen ist (403). */
  jahrgangFehlt: boolean;
  eventData: EventData | null;
  teilnehmende: readonly Participant[];
  abmeldungen: readonly Unregistration[];
  materialien: readonly EventMaterial[];
  isOnline: boolean;
  /**
   * Ohne Netz kam der volle Stand aus dem gemerkten Termin
   * (services/detailSpeicher.ts): Die Teilnehmerliste ist bekannt, auch leer.
   */
  ausSpeicher?: boolean;
  /** Terminverwaltung ist Leitungssache (utils/terminRechte.ts). */
  darfVerwalten: boolean;
  /**
   * Recht „Events verbuchen" (09.10.2026): Anwesenheit, Abmeldung, Notiz und
   * „Alle bestätigen". Fehlt es, gilt darfVerwalten (wie bisher).
   */
  darfVerbuchen?: boolean;
  /** Darf hier noch jemand eingetragen werden? Nicht an abgesagten Events. */
  darfEintragen: boolean;
  /** Alle ausser Konfis melden sich selbst, wenn das Event Team sucht. */
  darfSichMelden: boolean;
  eigeneZusage: Event['booking_status'];
  zusageLaeuft: boolean;
  aktionen: LeitungDetailAktionen;
}

const ZURUECK = { href: '/admin/events', text: 'Alle Events' };

/** Datum als Zeitpunkt zum Sortieren; fehlt es oder ist es unlesbar, steht die Zeile unten. */
const zeitpunkt = (wert?: string | null): number | null => {
  const ms = wert ? new Date(wert).getTime() : NaN;
  return Number.isNaN(ms) ? null : ms;
};

const WebTerminDetailLeitung: React.FC<WebTerminDetailLeitungProps> = (p) => {
  const { eventData, teilnehmende, aktionen, isOnline, darfVerwalten, darfEintragen } = p;
  const darfVerbuchen = darfVerwalten && p.darfVerbuchen !== false;

  if (p.laedt) {
    return (
      <WebDetailSeite bereich="Mitmachen" titel="Event" zurueck={ZURUECK} pageRef={p.pageRef}
        zustand={(
          <WebLaden karten={2} text="Das Event wird geladen." />
        )}
      />
    );
  }

  // Termin aus einem fremden Jahrgang (Push oder Link): den Grund nennen -- derselbe Wortlaut wie in der App.
  if (p.jahrgangFehlt) {
    return (
      <WebDetailSeite bereich="Mitmachen" titel="Event" zurueck={ZURUECK} pageRef={p.pageRef}
        zustand={(
          <WebLeer
            icon={ICON_JAHRGANG}
            titel="Nicht deinem Jahrgang zugeordnet"
            text="Dieses Event gehört zu einem Jahrgang, dem du nicht zugewiesen bist. Die Leitung deiner Gemeinde kann das in den Einstellungen ändern."
          />
        )}
      />
    );
  }

  if (!eventData) {
    return (
      <WebDetailSeite bereich="Mitmachen" titel="Event" zurueck={ZURUECK} pageRef={p.pageRef}
        zustand={(
          <WebFehler text="Das Event konnte nicht geladen werden." onErneut={aktionen.neuLaden} />
        )}
      />
    );
  }

  const event = eventData as unknown as Event;
  const abgesagt = istAbgesagt(eventData);
  const status = leitungDetailStatus(event, teilnehmende);
  const teamErlaubt = !!(eventData.teamer_needed || eventData.teamer_only);

  // --- Teilnehmende einteilen -------------------------------------------------
  // Pflicht-Event: nach Vornamen, sonst Anmeldereihenfolge (utils/teilnehmerReihenfolge.ts).
  const konfis = konfisInReihenfolge(teilnehmende.filter((x) => x.role_name === 'konfi'), eventData.mandatory);
  // Team-Seite: Teamer:innen UND zugeordnete Leitung.
  const team = teilnehmende.filter((x) => x.role_name !== 'konfi');
  const konfisBestaetigt = konfis.filter((x) => x.status === 'confirmed');
  const konfisWartend = konfis.filter((x) => x.status === 'waitlist');
  const konfisSonst = konfis.filter((x) => x.status !== 'waitlist');
  const teamBestaetigt = team.filter((x) => x.status === 'confirmed');
  const teamWartend = team.filter((x) => x.status === 'waitlist');
  const teamAbgesagt = team.filter((x) => x.status === 'opted_out');
  const offeneKonfis = konfisBestaetigt.filter((x) => !x.attendance_status).length;
  const offenesTeam = teamBestaetigt.filter((x) => !x.attendance_status).length;
  const mitZeitfenster = !!eventData.has_timeslots;

  const konfiTitel = eventData.mandatory
    ? `Konfis (${konfisBestaetigt.length}/${konfis.length})`
    : `Konfis (${konfisBestaetigt.length})`;
  const teamTitel = `Team (${teamBestaetigt.length}`
    + (teamWartend.length > 0 ? ` + ${teamWartend.length}` : '')
    + (teamAbgesagt.length > 0 ? `, ${teamAbgesagt.length} abgesagt` : '')
    + ')';

  const gemeinsam = {
    pflicht: !!eventData.mandatory,
    darfVerwalten,
    darfVerbuchen,
    isOnline,
    mitZeitfenster,
    aktionen,
  };

  // Genau ein Material: dessen Fenster; mehrere: zum Abschnitt springen (dort ist jedes einzeln waehlbar).
  const materialHinweis = () => {
    if (p.materialien.length === 1) { aktionen.material(p.materialien[0].id); return; }
    document.getElementById('web-event-material')?.scrollIntoView({ block: 'start' });
  };

  const angaben = terminAngaben(eventData as unknown as Event & { jahrgaenge?: Array<{ name: string }> }, {
    rolle: 'leitung',
    teilnehmende,
    materialien: p.materialien,
  });

  const zeitfenster = eventData.has_timeslots && eventData.timeslots ? eventData.timeslots : [];
  const zeitfensterSpalten: Array<WebSpalte<(typeof zeitfenster)[number]>> = [
    { schluessel: 'zeit', kopf: 'Zeitfenster', sortWert: (s) => s.start_time || null, zelle: (s) => `${formatEventTime(s.start_time)} – ${formatEventTime(s.end_time)}` },
    { schluessel: 'belegt', kopf: 'Belegt', zahl: true, sortWert: (s) => s.registered_count || 0, zelle: (s) => `${s.registered_count || 0}/${s.max_participants}` },
    {
      schluessel: 'wartend',
      kopf: 'Warteliste',
      zahl: true,
      sortWert: (s) => (s as { waitlist_count?: number }).waitlist_count || 0,
      zelle: (s) => {
        const n = (s as { waitlist_count?: number }).waitlist_count || 0;
        return n > 0 ? n : <span className="web-gedaempft">–</span>;
      },
    },
    {
      schluessel: 'status',
      kopf: 'Status',
      sortWert: (s) => zeitfensterStatusRang((s.registered_count || 0) >= s.max_participants ? 'Voll' : 'Frei'),
      zelle: (s) => ((s.registered_count || 0) >= s.max_participants
        ? <WebPill ton="fehler">Voll</WebPill>
        : <WebPill ton="erfolg">Frei</WebPill>),
    },
  ];

  const serie = eventData.is_series && eventData.series_events ? eventData.series_events : [];

  // Alle Aktionen der Seite stehen im Kopf (Simon, 06.10.2026) -- die wichtigste
  // rechts: die eigene Zusage, wenn das Event Team sucht und die Leitung sich meldet.
  const kopfAktionen = (
    <>
      {/* Einen bestehenden Chat oeffnet auch das Team; ihn anzulegen ist Leitungssache (requireAdmin). */}
      {(eventData.chat_room_id || darfVerwalten) && (
        <WebKnopf onClick={aktionen.chat} aria-label="Event-Chat öffnen">
          <IonIcon icon={ICON_CHAT} aria-hidden="true" />
          Chat
        </WebKnopf>
      )}
      <WebKnopf onClick={aktionen.qr} aria-label="QR-Code anzeigen">
        <IonIcon icon={ICON_QRCODE} aria-hidden="true" />
        QR-Code
      </WebKnopf>
      {darfVerwalten && (
        <WebKnopf onClick={aktionen.kopieren} aria-label="Event kopieren">
          <IonIcon icon={ICON_KOPIEREN} aria-hidden="true" />
          Kopieren
        </WebKnopf>
      )}
      {darfVerwalten && (
        <WebKnopf onClick={aktionen.bearbeiten} aria-label="Event bearbeiten">
          <IonIcon icon={ICON_BEARBEITEN} aria-hidden="true" />
          Bearbeiten
        </WebKnopf>
      )}
      {/* Ein Knopf: am aktiven Event "Event absagen", am abgesagten "Absage zurücknehmen". */}
      {darfVerwalten && (abgesagt ? (
        <WebKnopf onClick={aktionen.zuruecknehmen} disabled={!isOnline} title={isOnline ? undefined : 'Du bist offline'}>
          <IonIcon icon={ICON_RUECKGAENGIG} aria-hidden="true" />
          Absage zurücknehmen
        </WebKnopf>
      ) : (
        <WebKnopf art="gefahr" onClick={aktionen.absagen} disabled={!isOnline} title={isOnline ? undefined : 'Du bist offline'}>
          <IonIcon icon={ICON_GESPERRT} aria-hidden="true" />
          Event absagen
        </WebKnopf>
      ))}
      {/* Eigene An- und Abmeldung: Auch Leitung meldet sich selbst, wenn das Event Team sucht (Simon, 03.09.2026). */}
      {p.darfSichMelden && welcheKnoepfe(p.eigeneZusage) !== 'zusage' && (
        <WebKnopf art="gefahr" disabled={p.zusageLaeuft || !isOnline} onClick={aktionen.eigeneAbsage}>
          <IonIcon icon={ICON_ABSAGE} aria-hidden="true" />
          {absageBeschriftung(p.eigeneZusage)}
        </WebKnopf>
      )}
      {p.darfSichMelden && welcheKnoepfe(p.eigeneZusage) !== 'absage' && (
        <WebKnopf art="primaer" disabled={p.zusageLaeuft || !isOnline} onClick={() => aktionen.eigeneZusage(true)}>
          <IonIcon icon={ICON_ZUSAGE_GEFUELLT} aria-hidden="true" />
          {zusageBeschriftung(p.eigeneZusage)}
        </WebKnopf>
      )}
    </>
  );

  const hinweis = (abgesagt || (p.darfSichMelden && !isOnline)) ? (
    <>
      {abgesagt && <WebAbsage event={event} />}
      {p.darfSichMelden && !isOnline && (
        <WebHinweis art="hinweis">Ohne Netz nicht möglich — versuch es später nochmal.</WebHinweis>
      )}
    </>
  ) : undefined;

  const kennzahlen = leitungKennzahlen(event, teilnehmende).map((k) => {
    const z = kennzahlAnzeige(k);
    return { label: z.label, wert: z.wert };
  });

  // Links, breit: Beschreibung, dann wer kommt -- Tabellen mit Anwesenheit.
  const haupt = (
    <>
      {eventData.description && (
        <WebKarte titel="Beschreibung">
          <p className="web-beschreibung">{eventData.description}</p>
        </WebKarte>
      )}

      {teilnehmende.length === 0 && !isOnline && !p.ausSpeicher && (
        <WebHinweis art="hinweis">Die Teilnehmerliste ist offline nicht verfügbar.</WebHinweis>
      )}

      {darfVerwalten && !darfVerbuchen && (
        <WebHinweis art="hinweis">An diesem Event verbucht jemand anderes. Das Recht vergibt die Gemeindeleitung.</WebHinweis>
      )}

      {!eventData.teamer_only && (konfisSonst.length > 0 || darfEintragen) && (
        <WebTeilnehmerLeitung
          {...gemeinsam}
          titel={konfiTitel}
          teilnehmende={konfisSonst}
          alleBestaetigen={darfVerbuchen && offeneKonfis > 0
            ? { anzahl: offeneKonfis, onClick: () => aktionen.alleBestaetigen(offeneKonfis, konfisWartend.length, 'konfi') }
            : undefined}
          hinzufuegen={darfEintragen ? [{ label: 'Konfi hinzufügen', onClick: () => aktionen.hinzufuegen('konfi') }] : undefined}
        />
      )}

      {!eventData.teamer_only && konfisWartend.length > 0 && (
        <WebTeilnehmerLeitung
          {...gemeinsam}
          titel={`Warteliste (${konfisWartend.length})`}
          teilnehmende={konfisWartend}
          warteliste
        />
      )}

      {(team.length > 0 || teamErlaubt) && (
        <WebTeilnehmerLeitung
          {...gemeinsam}
          titel={teamTitel}
          teilnehmende={team}
          alleBestaetigen={darfVerbuchen && offenesTeam > 0
            ? { anzahl: offenesTeam, onClick: () => aktionen.alleBestaetigen(offenesTeam, teamWartend.length, 'teamer') }
            : undefined}
          hinzufuegen={darfEintragen && teamErlaubt
            ? [
              { label: 'Team hinzufügen', onClick: () => aktionen.hinzufuegen('team') },
              { label: 'Leitung hinzufügen', onClick: () => aktionen.hinzufuegen('leitung') },
            ]
            : undefined}
          leerText="Noch niemand vom Team angemeldet."
        />
      )}

      {p.abmeldungen.length > 0 && (
        <WebKarte titel={`Abmeldungen (${p.abmeldungen.length})`} bund>
          <WebTabelle
            beschriftung="Abmeldungen"
            spalten={[
              { schluessel: 'name', kopf: 'Name', breite: '28%', sortWert: (u) => u.konfi_name, zelle: (u) => <span className="web-zelle-titel">{u.konfi_name}</span> },
              { schluessel: 'am', kopf: 'Abgemeldet am', breite: '168px', sortWert: (u) => zeitpunkt(u.unregistered_at), zelle: (u) => datumUhrzeit(u.unregistered_at) },
              { schluessel: 'grund', kopf: 'Grund', sortWert: (u) => u.reason || null, zelle: (u) => u.reason || <span className="web-gedaempft">–</span> },
            ] satisfies Array<WebSpalte<Unregistration>>}
            zeilen={p.abmeldungen}
            zeileSchluessel={(u) => u.id}
          />
        </WebKarte>
      )}
    </>
  );

  // Rechts, schmal: die Angaben und was zu ihnen gehoert -- Zeitfenster, Serie, Material.
  const seite = (
    <>
      <WebKarte titel="Angaben">
        <WebTerminAngaben angaben={angaben} onMaterial={materialHinweis} />
      </WebKarte>

      {zeitfenster.length > 0 && (
        <WebKarte titel={`Zeitfenster (${zeitfenster.length})`} bund>
          <WebTabelle
            beschriftung="Zeitfenster"
            spalten={zeitfensterSpalten}
            zeilen={zeitfenster}
            zeileSchluessel={(s) => s.id}
            mittig
          />
        </WebKarte>
      )}

      {serie.length > 0 && (
        <WebKarte titel="Weitere Events dieser Serie" bund>
          <ul className="web-liste-schlicht">
            {serie.map((s) => {
              const unbegrenzt = (s.max_participants || 0) === 0;
              const voll = !unbegrenzt && (s.registered_count || 0) >= s.max_participants;
              return (
                <li key={s.id} className="web-liste-schlicht__zeile">
                  <span>
                    <WebLink href={`/admin/events/${s.id}`} className="web-link--text">{s.name}</WebLink>
                    <span className="web-zelle-leise">
                      {datumKurz(s.event_date)}, {formatEventTime(s.event_date)} · {s.registered_count || 0}/{unbegrenzt ? '∞' : s.max_participants} TN
                    </span>
                  </span>
                  <WebPill ton={voll ? 'fehler' : 'erfolg'}>{voll ? 'Voll' : 'Frei'}</WebPill>
                </li>
              );
            })}
          </ul>
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

  return (
    <WebDetailSeite
      bereich="Mitmachen"
      zurueck={ZURUECK}
      titel={eventData.name}
      kennzeichen={(
        <span className="web-pillreihe">
          <WebTerminMarken status={status} event={event} teamZeigen serieZeigen />
          <span>{zeitraumText(event)}</span>
        </span>
      )}
      aktionen={kopfAktionen}
      hinweis={hinweis}
      kennzahlen={kennzahlen}
      haupt={haupt}
      seite={seite}
      pageRef={p.pageRef}
    />
  );
};

export default WebTerminDetailLeitung;
