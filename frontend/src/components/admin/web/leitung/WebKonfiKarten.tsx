// Die Karten der Detailseite einer Konfi bzw. Teamer:in in der Web-Fassung
// (web/leitung/WebKonfiDetail.tsx): Aktivitaeten, Bonuspunkte, Events,
// Zertifikate, Konfi-Historie, Konfirmation, Antraege, Stempel, Rueckblick und
// "Rolle aendern". Jede Karte stellt dar, was die Seite ihr gibt, und ruft fuer
// Aktionen die Funktionen der Seite -- dieselben Fenster und Rueckfragen wie in
// der App.

import React, { useState } from 'react';
import { IonIcon } from '@ionic/react';
import {
  ICON_AKTION,
  ICON_BILD,
  ICON_BONUS,
  ICON_CHALLENGE_GEFUELLT,
  ICON_FUNKELN,
  ICON_HINZUFUEGEN,
  ICON_LOESCHEN,
  ICON_PODIUM,
  ICON_TERMIN,
  ICON_UHRZEIT,
  ICON_WEITER_GEFUELLT,
  ICON_ZUSAGE,
} from '../../../shared/icons';
import { getIconFromString } from '../../../../utils/badgeIcons';
import { datumKurz, datumLang, uhrzeit } from '../../../../utils/dateUtils';
import { punkteText } from '../../../../utils/punkteText';
import { konfiZeitTerminStatus } from '../../../../utils/konfiZeit';
import { nachAnzeigeDatumAbsteigend, punkteAnzeigeDatum } from '../../../../utils/punkteDatum';
import { mitEinheit } from '../../../../utils/supportStatistik';
import { teilnahmeDarstellung, type TeilnahmeDarstellung } from '../../../../utils/teilnahmeStatus';
import type { PillTon } from '../../../../utils/supportWeb';
import type { BonusEintrag, EventPunkteEintrag } from '../../../../types/user';
import type { KonfiZeit } from '../../../../types/konfiZeit';
import type { ChallengeMark, OffenerStempel } from '../../../../types/challenges';
import type { WrappedHistoryEntry } from '../../../../types/wrapped';
import { personTerminStand, type Activity, type AnwesenheitWahl, type Konfi, type PersonTermin } from '../../views/KonfiDetailSections';
import WebKarte from '../../../web/WebKarte';
import WebKnopf from '../../../web/WebKnopf';
import WebPill from '../../../web/WebPill';
import WebLink from '../../../web/WebLink';
import WebAngaben from '../../../web/WebAngaben';
import { ANGABE_SYMBOLE } from '../../../web/angabeSymbole';
import { WebLeer } from '../../../web/WebZustaende';
import StempelInfo from '../../../web/StempelInfo';
import WebAuszeichnungen, { type WebAuszeichnung } from '../../../web/WebAuszeichnungen';
import WebSortTabelle, { type WebSortSpalte } from './WebSortTabelle';
import { naechsteSortierung, sortiereZeilen, type TabellenSortierung } from '../../../../utils/tabelleSortieren';
import type { Anwesenheit, KonfiHistorie, TeamerTermin, Zertifikat } from './konfiDetailTypen';
import { konfiZeitStatusRang, teilnahmeStatusRang } from '../../../../utils/statusReihenfolge';

const ZEILEN_KURZ = 10;

// Aktivitaeten, Events und Bonuspunkte stehen untereinander und haben dieselben
// Spaltenbreiten (Simon, 07.10.2026: „die listen sollen immer die gleichen
// spaltenbreite haben"). Die Aktionsspalte ist .web-spalte-aktionen-schmal;
// "Eingetragen von" faellt auf schmaler Flaeche in allen dreien weg.
const SPALTE = { datum: '100px', art: '118px', punkte: '68px', von: '128px' } as const;

/** Eine Punkteart als Marke: Gottesdienst blau, Gemeinde gruen (wie in der App). */
const ArtMarke: React.FC<{ art?: string }> = ({ art }) => (
  <WebPill ton={art === 'gottesdienst' ? 'info' : 'erfolg'}>{art === 'gottesdienst' ? 'Gottesdienst' : 'Gemeinde'}</WebPill>
);

/** Ist diese Punkteart fuer den Jahrgang der Person abgeschaltet? (Die Zeile steht dann gedaempft da.) */
const artAus = (konfi: Konfi | null, art?: string): boolean =>
  (art === 'gottesdienst' && konfi?.gottesdienst_enabled === false) || (art === 'gemeinde' && konfi?.gemeinde_enabled === false);

/** Ein Datum zum Sortieren; ohne Datum steht die Zeile unten. */
const alsDatum = (iso?: string | null): Date | null => (iso ? new Date(iso) : null);

/**
 * Sortieren fuer Karten, die nur die ersten Zeilen zeigen ("Alle anzeigen"):
 * Die Karte haelt die Ordnung und sortiert die GANZE Liste, bevor sie kuerzt --
 * sonst ordnete ein Klick auf den Spaltenkopf nur die sichtbaren Zeilen um.
 */
function useGanzeListeSortiert<T>(zeilen: readonly T[], spalten: ReadonlyArray<WebSortSpalte<T>>) {
  const [sortierung, setSortierung] = useState<TabellenSortierung | null>(null);
  const spalte = sortierung ? spalten.find((s) => s.schluessel === sortierung.schluessel && s.sortWert) : undefined;
  const geordnet = sortierung && spalte?.sortWert ? sortiereZeilen(zeilen, spalte.sortWert, sortierung.richtung) : zeilen;
  return {
    geordnet,
    tabelle: {
      spalten: spalten.map((s) => ({ ...s, sortierbar: Boolean(s.sortWert) })),
      sortierung: sortierung ?? undefined,
      onSortieren: (schluessel: string) => setSortierung((jetzt) => naechsteSortierung(jetzt, schluessel)),
    },
  };
}

const AlleZeigen: React.FC<{ anzahl: number; alle: boolean; onUmschalten: () => void }> = ({ anzahl, alle, onUmschalten }) => (
  anzahl > ZEILEN_KURZ ? (
    <div className="web-karte__fuss">
      <WebKnopf art="text" klein onClick={onUmschalten}>
        {alle ? 'Weniger anzeigen' : `Alle ${anzahl} anzeigen`}
      </WebKnopf>
    </div>
  ) : null
);

// --- Offenes oben in der Liste ---------------------------------------------------
//
// Offene Antraege stehen oben in den Aktivitaeten, zu verbuchende und
// anstehende Termine oben in den Events (Simon, 09.10.2026) -- als Zeilen
// ueber der Tabelle, die selbst nur Verbuchtes zeigt und zaehlt.

const OffeneAntraegeZeilen: React.FC<{ antraege: readonly Activity[]; isOnline: boolean; onFoto: (a: Activity) => void }> = ({ antraege, isOnline, onFoto }) => (
  <ul className="web-feed" aria-label="Offene Anträge">
    {antraege.map((a) => {
      const name = a.name.replace(/ \(gemeldet\)$/, '');
      return (
        <li key={a.id} className="web-feed__zeile">
          <div className="web-feed__haupt">
            <span className="web-feed__titel">{name}</span>
            <span className="web-feed__meta"><span>gemeldet für {datumKurz(a.completed_date || a.date)}</span></span>
          </div>
          <div className="web-feed__rechts">
            <WebPill ton="warnung" punkt>{a.points} Punkte</WebPill>
            {a.darfEntscheiden ? (
              <WebKnopf klein art="primaer" vorn disabled={!isOnline} onClick={() => onFoto(a)} aria-label={`Aktivität ${name} prüfen`}>
                Prüfen
              </WebKnopf>
            ) : a.hasPhoto && (
              <WebKnopf art="text" klein vorn onClick={() => onFoto(a)} aria-label={`Nachweisfoto zu ${name} ansehen`}>
                <IonIcon icon={ICON_BILD} aria-hidden="true" />
                Foto
              </WebKnopf>
            )}
          </div>
        </li>
      );
    })}
  </ul>
);

const OffeneTermineZeilen: React.FC<{
  termine: readonly PersonTermin[];
  kannVerbuchen: boolean;
  isOnline: boolean;
  onAnwesenheit: (t: PersonTermin, status: AnwesenheitWahl) => void;
}> = ({ termine, kannVerbuchen, isOnline, onAnwesenheit }) => (
  <ul className="web-feed" aria-label="Offene und anstehende Events">
    {termine.map((t) => {
      const offen = t.art === 'verbuchen';
      return (
        <li key={t.booking_id} className="web-feed__zeile" data-termin-art={t.art}>
          <div className="web-feed__haupt">
            {/* In den Termin -- derselbe Link wie in der Terminliste (WebEventsTabelle). */}
            <WebLink href={`/admin/events/${t.event_id}`} className="web-feed__titel web-link--text">{t.event_name}</WebLink>
            <span className="web-feed__meta"><span>{datumKurz(t.event_date)}</span></span>
          </div>
          <div className="web-feed__rechts">
            <WebPill ton={offen ? 'warnung' : 'info'} punkt>{personTerminStand(t)}</WebPill>
            {offen && kannVerbuchen && t.darf_verbuchen && (
              <>
                <WebKnopf klein vorn disabled={!isOnline} onClick={() => onAnwesenheit(t, 'present')} aria-label={`${t.event_name}: anwesend`}>
                  Anwesend
                </WebKnopf>
                <WebKnopf klein vorn disabled={!isOnline} onClick={() => onAnwesenheit(t, 'absent')} aria-label={`${t.event_name}: nicht anwesend`}>
                  Nicht anwesend
                </WebKnopf>
              </>
            )}
          </div>
        </li>
      );
    })}
  </ul>
);

// --- Aktivitaeten -----------------------------------------------------------------

export const AktivitaetenKarte: React.FC<{
  aktivitaeten: readonly Activity[];
  /** Offene Antraege, oben in der Karte. */
  offene?: readonly Activity[];
  isOnline?: boolean;
  konfi: Konfi | null;
  istTeamer: boolean;
  onEintragen: () => void;
  onLoeschen: (a: Activity) => void;
  onFoto: (a: Activity) => void;
}> = ({ aktivitaeten, offene = [], isOnline = true, konfi, istTeamer, onEintragen, onLoeschen, onFoto }) => {
  const [alle, setAlle] = useState(false);
  const summe = aktivitaeten.reduce((s, a) => s + (a.points || 0), 0);

  const spalten: Array<WebSortSpalte<Activity>> = [
    {
      schluessel: 'name',
      kopf: 'Aktivität',
      sortWert: (a) => a.name,
      zelle: (a) => (
        <span className="web-zelle-mit-knopf">
          <span className="web-zelle-titel">{a.name}</span>
          {!istTeamer && artAus(konfi, a.type) && <WebPill>deaktiviert</WebPill>}
          {a.hasPhoto && (
            <WebKnopf art="text" klein symbol onClick={() => onFoto(a)} aria-label={`Nachweisfoto zu ${a.name} ansehen`} title="Nachweisfoto ansehen">
              <IonIcon icon={ICON_BILD} aria-hidden="true" />
            </WebKnopf>
          )}
        </span>
      ),
    },
    { schluessel: 'datum', kopf: 'Datum', breite: SPALTE.datum, sortWert: (a) => alsDatum(a.completed_date || a.date), zelle: (a) => datumKurz(a.completed_date || a.date) },
    ...(!istTeamer ? [{
      schluessel: 'art',
      kopf: 'Art',
      breite: SPALTE.art,
      sortWert: (a: Activity) => a.type,
      zelle: (a: Activity) => <ArtMarke art={a.type} />,
    }, {
      schluessel: 'punkte',
      kopf: 'Punkte',
      zahl: true,
      breite: SPALTE.punkte,
      sortWert: (a: Activity) => a.points,
      zelle: (a: Activity) => <strong>+{a.points}</strong>,
    }] : []),
    {
      schluessel: 'von',
      kopf: 'Eingetragen von',
      breite: SPALTE.von, optional: true,
      sortWert: (a) => a.admin || a.admin_name || 'Leitung',
      zelle: (a) => a.admin || a.admin_name || 'Leitung',
    },
    {
      schluessel: 'aktionen',
      kopf: 'Aktionen',
      kopfVersteckt: true,
      klasse: 'web-spalte-aktionen-schmal',
      zelle: (a) => (
        <div className="web-zeilenaktionen">
          <WebKnopf klein art="gefahr" symbol onClick={() => onLoeschen(a)} aria-label={`Aktivität ${a.name} löschen`} title="Aktivität löschen">
            <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
          </WebKnopf>
        </div>
      ),
    },
  ];
  const aktivTabelle = useGanzeListeSortiert(aktivitaeten, spalten);
  const sichtbar = alle ? aktivTabelle.geordnet : aktivTabelle.geordnet.slice(0, ZEILEN_KURZ);

  return (
    <WebKarte
      titel="Aktivitäten"
      untertitel={istTeamer ? mitEinheit(aktivitaeten.length, 'Aktivität', 'Aktivitäten') : `${punkteText(summe)} aus ${mitEinheit(aktivitaeten.length, 'Aktivität', 'Aktivitäten')}`}
      aktion={(
        <WebKnopf klein onClick={onEintragen}>
          <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
          Aktivität eintragen
        </WebKnopf>
      )}
      bund
    >
      {offene.length > 0 && <OffeneAntraegeZeilen antraege={offene} isOnline={isOnline} onFoto={onFoto} />}
      {aktivitaeten.length === 0 ? (
        offene.length === 0 && <WebLeer icon={ICON_AKTION} titel="Keine Aktivitäten" text="Noch keine Aktivitäten vorhanden." />
      ) : (
        <>
          <WebSortTabelle
            beschriftung="Aktivitäten"
            {...aktivTabelle.tabelle}
            zeilen={sichtbar}
            zeileSchluessel={(a) => a.id}
            zeileKlasse={(a) => (!istTeamer && artAus(konfi, a.type) ? 'web-zeile--leise' : undefined)}
            mittig
            klasse="web-tabelle--punkte"
          />
          <AlleZeigen anzahl={aktivitaeten.length} alle={alle} onUmschalten={() => setAlle((a) => !a)} />
        </>
      )}
    </WebKarte>
  );
};

// --- Bonuspunkte ------------------------------------------------------------------

export const BonusKarte: React.FC<{
  bonus: readonly BonusEintrag[];
  konfi: Konfi | null;
  summe: number;
  onVergeben: () => void;
  onLoeschen: (b: BonusEintrag) => void;
}> = ({ bonus, konfi, summe, onVergeben, onLoeschen }) => {
  const spalten: Array<WebSortSpalte<BonusEintrag>> = [
    {
      schluessel: 'grund',
      kopf: 'Grund',
      sortWert: (b) => b.description || 'Bonuspunkte',
      zelle: (b) => (
        <span className="web-zelle-mit-knopf">
          <span className="web-zelle-titel">{b.description || 'Bonuspunkte'}</span>
          {artAus(konfi, b.type) && <WebPill>deaktiviert</WebPill>}
        </span>
      ),
    },
    // `bonus.date` gibt es in dieser Antwort nicht -- sie liefert bp.* aus bonus_points.
    { schluessel: 'datum', kopf: 'Datum', breite: SPALTE.datum, sortWert: (b) => alsDatum(b.completed_date || b.created_at), zelle: (b) => datumKurz(b.completed_date || b.created_at || '') },
    { schluessel: 'art', kopf: 'Art', breite: SPALTE.art, sortWert: (b) => b.type, zelle: (b) => <ArtMarke art={b.type} /> },
    { schluessel: 'punkte', kopf: 'Punkte', zahl: true, breite: SPALTE.punkte, sortWert: (b) => b.points, zelle: (b) => <strong>+{b.points}</strong> },
    { schluessel: 'von', kopf: 'Vergeben von', breite: SPALTE.von, optional: true, sortWert: (b) => b.admin_name || 'Leitung', zelle: (b) => b.admin_name || 'Leitung' },
    {
      schluessel: 'aktionen',
      kopf: 'Aktionen',
      kopfVersteckt: true,
      klasse: 'web-spalte-aktionen-schmal',
      zelle: (b) => (
        <div className="web-zeilenaktionen">
          <WebKnopf klein art="gefahr" symbol onClick={() => onLoeschen(b)} aria-label={`Bonuspunkte ${b.description || ''} löschen`.replace('  ', ' ')} title="Bonuspunkte löschen">
            <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
          </WebKnopf>
        </div>
      ),
    },
  ];
  return (
    <WebKarte
      titel="Bonuspunkte"
      untertitel={punkteText(summe)}
      aktion={(
        <WebKnopf klein onClick={onVergeben}>
          <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
          Bonuspunkte vergeben
        </WebKnopf>
      )}
      bund
    >
      {bonus.length === 0 ? (
        <WebLeer icon={ICON_BONUS} titel="Keine Bonuspunkte" text="Noch keine Bonuspunkte erhalten." />
      ) : (
        <WebSortTabelle beschriftung="Bonuspunkte" spalten={spalten} zeilen={bonus} zeileSchluessel={(b) => b.id} mittig klasse="web-tabelle--punkte" />
      )}
    </WebKarte>
  );
};

// --- Events mit Punkten (Konfi) -----------------------------------------------------

interface TermineOben {
  termine?: readonly PersonTermin[];
  kannVerbuchen?: boolean;
  isOnline?: boolean;
  onAnwesenheit?: (t: PersonTermin, status: AnwesenheitWahl) => void;
}
const nichtsTun = () => {};

export const EventPunkteKarte: React.FC<{ eventPunkte: readonly EventPunkteEintrag[]; konfi: Konfi | null } & TermineOben> = ({
  eventPunkte, konfi, termine = [], kannVerbuchen = false, isOnline = true, onAnwesenheit = nichtsTun,
}) => {
  const summe = eventPunkte.reduce((s, e) => s + (e.points || 0), 0);
  const geordnet = nachAnzeigeDatumAbsteigend(eventPunkte);
  // Dieselbe Tabelle wie Aktivitaeten und Bonuspunkte darueber und darunter,
  // mit denselben festen Spaltenbreiten (Simon, 07.10.2026: Events als Liste
  // zwischen den beiden, „immer die gleichen spaltenbreite").
  const spalten: Array<WebSortSpalte<EventPunkteEintrag>> = [
    {
      schluessel: 'event',
      kopf: 'Event',
      sortWert: (e) => e.event_name || 'Event',
      zelle: (e) => (
        <span className="web-zelle-mit-knopf">
          <span className="web-zelle-titel">{e.event_name || 'Event'}</span>
          {artAus(konfi, e.point_type) && <WebPill>deaktiviert</WebPill>}
        </span>
      ),
    },
    { schluessel: 'datum', kopf: 'Datum', breite: SPALTE.datum, sortWert: (e) => alsDatum(punkteAnzeigeDatum(e)), zelle: (e) => datumKurz(punkteAnzeigeDatum(e)) },
    { schluessel: 'art', kopf: 'Art', breite: SPALTE.art, sortWert: (e) => e.point_type, zelle: (e) => <ArtMarke art={e.point_type} /> },
    { schluessel: 'punkte', kopf: 'Punkte', zahl: true, breite: SPALTE.punkte, sortWert: (e) => e.points, zelle: (e) => <strong>+{e.points}</strong> },
    { schluessel: 'von', kopf: 'Verbucht von', breite: SPALTE.von, optional: true, sortWert: (e) => e.admin_name || 'Leitung', zelle: (e) => e.admin_name || 'Leitung' },
    // Leer, aber gleich breit: Die Spalten stehen unter denen von Aktivitaeten und Bonuspunkten.
    { schluessel: 'aktionen', kopf: 'Aktionen', kopfVersteckt: true, klasse: 'web-spalte-aktionen-schmal', zelle: () => null },
  ];
  return (
    <WebKarte
      titel="Events"
      untertitel={`${punkteText(summe)} aus ${mitEinheit(eventPunkte.length, 'Event', 'Events')}`}
      bund={eventPunkte.length > 0 || termine.length > 0}
    >
      {termine.length > 0 && <OffeneTermineZeilen termine={termine} kannVerbuchen={kannVerbuchen} isOnline={isOnline} onAnwesenheit={onAnwesenheit} />}
      {eventPunkte.length === 0 ? (
        termine.length === 0 && <WebLeer icon={ICON_PODIUM} titel="Keine Event-Punkte" text="Noch keine Event-Punkte erhalten." />
      ) : (
        <WebSortTabelle
          beschriftung="Events"
          spalten={spalten}
          zeilen={geordnet}
          zeileSchluessel={(e) => e.id}
          zeileKlasse={(e) => (artAus(konfi, e.point_type) ? 'web-zeile--leise' : undefined)}
          mittig
          klasse="web-tabelle--punkte"
        />
      )}
    </WebKarte>
  );
};

// --- Events einer Teamer:in -----------------------------------------------------------

// Stand einer Teamer:in bei einem Event: dieselbe Regel wie die
// Teilnehmerliste (teilnahmeDarstellung) -- Anwesend/Abwesend aus der
// Anwesenheit, sonst Gebucht, Warteliste oder Abgemeldet.
const STAND_TON: Record<TeilnahmeDarstellung['farbe'], PillTon> = {
  success: 'erfolg', danger: 'fehler', warning: 'warnung', info: 'info', neutral: 'neutral',
};

export const TeamerEventsKarte: React.FC<{ events: readonly TeamerTermin[] } & TermineOben> = ({
  events: alleEvents, termine = [], kannVerbuchen = false, isOnline = true, onAnwesenheit = nichtsTun,
}) => {
  const [alle, setAlle] = useState(false);
  // Was oben steht, steht in der Tabelle nicht noch einmal; der Untertitel
  // zaehlt wie bisher alle Events.
  const oben = new Set(termine.map((t) => t.event_id));
  const events = alleEvents.filter((e) => !oben.has(e.id));
  // Steht links unter den Aktivitaeten (Simon, 07.10.2026) und teilt deren
  // Spaltenbreiten: Event, Datum, Stand an der Stelle von "Eingetragen von".
  const spalten: Array<WebSortSpalte<TeamerTermin>> = [
    { schluessel: 'event', kopf: 'Event', sortWert: (e) => e.name, zelle: (e) => <span className="web-zelle-titel">{e.name}</span> },
    { schluessel: 'datum', kopf: 'Datum', breite: SPALTE.datum, sortWert: (e) => alsDatum(e.event_date), zelle: (e) => datumKurz(e.event_date) },
    {
      schluessel: 'stand',
      kopf: 'Stand',
      breite: SPALTE.von,
      sortWert: (e) => teilnahmeStatusRang(teilnahmeDarstellung({ status: e.booking_status, attendance_status: e.attendance_status }).statusText),
      zelle: (e) => {
        const stand = teilnahmeDarstellung({ status: e.booking_status, attendance_status: e.attendance_status });
        return <WebPill ton={STAND_TON[stand.farbe]}>{stand.statusText}</WebPill>;
      },
    },
    { schluessel: 'aktionen', kopf: 'Aktionen', kopfVersteckt: true, klasse: 'web-spalte-aktionen-schmal', zelle: () => null },
  ];
  const eventTabelle = useGanzeListeSortiert(events, spalten);
  const sichtbar = alle ? eventTabelle.geordnet : eventTabelle.geordnet.slice(0, ZEILEN_KURZ);
  return (
    <WebKarte titel="Events" untertitel={mitEinheit(alleEvents.length, 'Event', 'Events')} bund={events.length > 0 || termine.length > 0}>
      {termine.length > 0 && <OffeneTermineZeilen termine={termine} kannVerbuchen={kannVerbuchen} isOnline={isOnline} onAnwesenheit={onAnwesenheit} />}
      {events.length === 0 ? (
        // Auch leer anzeigen: sonst ist "war bei keinem Event" nicht von "nicht geladen" zu unterscheiden.
        termine.length === 0 && <WebLeer icon={ICON_TERMIN} titel="Keine Events" text="Noch bei keinem Event dabei gewesen." />
      ) : (
        <>
          <WebSortTabelle beschriftung="Events" {...eventTabelle.tabelle} zeilen={sichtbar} zeileSchluessel={(e) => e.id} mittig klasse="web-tabelle--punkte" />
          <AlleZeigen anzahl={events.length} alle={alle} onUmschalten={() => setAlle((a) => !a)} />
        </>
      )}
    </WebKarte>
  );
};

// --- Zertifikate (Teamer) ---------------------------------------------------------------

export const ZertifikateKarte: React.FC<{
  zertifikate: readonly Zertifikat[];
  isOnline: boolean;
  onZuweisen: () => void;
  onEntfernen: (z: { id: number; name: string }) => void;
}> = ({ zertifikate, isOnline, onZuweisen, onEntfernen }) => {
  const spalten: Array<WebSortSpalte<Zertifikat>> = [
    {
      schluessel: 'name',
      kopf: 'Zertifikat',
      sortWert: (z) => z.name,
      zelle: (z) => (
        <span className="web-zelle-mit-knopf">
          <IonIcon icon={getIconFromString(z.icon)} className="web-zelle-symbol" aria-hidden="true" />
          <span className="web-zelle-titel">{z.name}</span>
          {z.status === 'expired' && <WebPill ton="fehler">Abgelaufen</WebPill>}
        </span>
      ),
    },
    { schluessel: 'ausgestellt', kopf: 'Ausgestellt', breite: '120px', sortWert: (z) => alsDatum(z.issued_date), zelle: (z) => datumKurz(z.issued_date) },
    { schluessel: 'ablauf', kopf: 'Läuft ab', breite: '120px', optional: true, sortWert: (z) => alsDatum(z.expiry_date), zelle: (z) => (z.expiry_date ? datumKurz(z.expiry_date) : <span className="web-gedaempft">–</span>) },
    {
      schluessel: 'aktionen',
      kopf: 'Aktionen',
      kopfVersteckt: true,
      klasse: 'web-spalte-aktionen-schmal',
      zelle: (z) => (
        <div className="web-zeilenaktionen">
          <WebKnopf klein art="gefahr" symbol onClick={() => onEntfernen(z)} aria-label={`Zertifikat ${z.name} entfernen`} title="Zertifikat entfernen">
            <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
          </WebKnopf>
        </div>
      ),
    },
  ];
  return (
    <WebKarte
      titel="Zertifikate"
      untertitel={mitEinheit(zertifikate.length, 'Zertifikat', 'Zertifikate')}
      aktion={(
        <WebKnopf klein disabled={!isOnline} onClick={onZuweisen}>
          <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
          {isOnline ? 'Zertifikat zuweisen' : 'Du bist offline'}
        </WebKnopf>
      )}
      bund
    >
      <WebSortTabelle beschriftung="Zertifikate" spalten={spalten} zeilen={zertifikate} zeileSchluessel={(z) => z.id} mittig />
    </WebKarte>
  );
};

// --- Konfi-Historie einer befoerderten Teamer:in ------------------------------------------

export const KonfiHistorieKarte: React.FC<{ historie: KonfiHistorie }> = ({ historie }) => {
  const [alle, setAlle] = useState(false);
  // NULL-SICHER: Fehlt history/totals (alter Cache, Teamer ohne Konfi-Zeit), wirft ein Zugriff hier den ganzen Render.
  const eintraege = Array.isArray(historie?.history) ? nachAnzeigeDatumAbsteigend(historie.history) : [];
  const summe = historie?.totals || { gottesdienst: 0, gemeinde: 0, total: 0 };
  const herkunft = (t: string) => (t === 'bonus' ? 'Bonus' : t === 'event' ? 'Event' : 'Aktivität');
  const spalten: Array<WebSortSpalte<(typeof eintraege)[number]>> = [
    { schluessel: 'titel', kopf: 'Eintrag', sortWert: (e) => e.title, zelle: (e) => <span className="web-zelle-titel">{e.title}</span> },
    { schluessel: 'datum', kopf: 'Datum', breite: '110px', sortWert: (e) => alsDatum(punkteAnzeigeDatum(e)), zelle: (e) => datumKurz(punkteAnzeigeDatum(e)) },
    { schluessel: 'herkunft', kopf: 'Herkunft', breite: '110px', sortWert: (e) => herkunft(e.source_type), zelle: (e) => <WebPill>{herkunft(e.source_type)}</WebPill> },
    { schluessel: 'art', kopf: 'Art', breite: '124px', sortWert: (e) => e.category, zelle: (e) => <ArtMarke art={e.category} /> },
    { schluessel: 'punkte', kopf: 'Punkte', zahl: true, breite: '80px', sortWert: (e) => e.points, zelle: (e) => <strong>+{e.points}</strong> },
  ];
  const historieTabelle = useGanzeListeSortiert(eintraege, spalten);
  const sichtbar = alle ? historieTabelle.geordnet : historieTabelle.geordnet.slice(0, 3);
  return (
    <WebKarte
      titel="Konfi-Historie"
      untertitel={`${punkteText(summe.total)} in der Konfi-Zeit · ${summe.gottesdienst} Gottesdienst · ${summe.gemeinde} Gemeinde`}
      bund
    >
      {eintraege.length === 0 ? (
        <WebLeer icon={ICON_UHRZEIT} titel="Keine Konfi-Punkte" text="Keine Konfi-Punkte vorhanden." />
      ) : (
        <>
          <WebSortTabelle beschriftung="Konfi-Historie" {...historieTabelle.tabelle} zeilen={sichtbar} zeileSchluessel={(e) => `${e.source_type}-${e.id}`} mittig />
          {eintraege.length > 3 && (
            <div className="web-karte__fuss">
              <WebKnopf art="text" klein onClick={() => setAlle((a) => !a)}>
                {alle ? 'Weniger anzeigen' : `${eintraege.length - 3} weitere anzeigen`}
              </WebKnopf>
            </div>
          )}
        </>
      )}
    </WebKarte>
  );
};

/** Die Events der dauerhaften Kopie der Konfi-Zeit (befoerderte Teamer:in). */
export const KonfiZeitKarte: React.FC<{ zeit: KonfiZeit }> = ({ zeit }) => {
  const termine = Array.isArray(zeit.termine) ? zeit.termine : [];
  if (termine.length === 0) return null;
  const spalten: Array<WebSortSpalte<(typeof termine)[number]>> = [
    { schluessel: 'name', kopf: 'Event', sortWert: (t) => t.name, zelle: (t) => <span className="web-zelle-titel">{t.name}</span> },
    { schluessel: 'datum', kopf: 'Datum', breite: '110px', sortWert: (t) => alsDatum(t.datum), zelle: (t) => datumKurz(t.datum) },
    { schluessel: 'status', kopf: 'Stand', breite: '150px', sortWert: (t) => konfiZeitStatusRang(konfiZeitTerminStatus(t)), zelle: (t) => <WebPill>{konfiZeitTerminStatus(t)}</WebPill> },
    { schluessel: 'punkte', kopf: 'Punkte', zahl: true, breite: '90px', sortWert: (t) => t.punkte ?? 0, zelle: (t) => ((t.punkte ?? 0) > 0 ? <strong>+{t.punkte}</strong> : <span className="web-gedaempft">–</span>) },
  ];
  return (
    <WebKarte titel="Events der Konfi-Zeit" untertitel={mitEinheit(termine.length, 'Event', 'Events')} bund>
      <WebSortTabelle beschriftung="Events der Konfi-Zeit" spalten={spalten} zeilen={termine} zeileSchluessel={(t) => t.event_id} mittig />
    </WebKarte>
  );
};

// --- Konfirmation --------------------------------------------------------------------------

export const KonfirmationKarte: React.FC<{
  konfi: Konfi;
  anwesenheit: Anwesenheit | null;
  onMatrix: () => void;
}> = ({ konfi, anwesenheit, onMatrix }) => {
  const spruch = konfi.konfspruch;
  const hatAnwesenheit = !!anwesenheit && anwesenheit.total_mandatory > 0;
  const quote = anwesenheit?.percentage ?? 0;
  return (
    <WebKarte titel="Konfirmation">
      <WebAngaben
        angaben={[
          {
            label: 'Konfirmationstermin',
            wert: konfi.confirmation_date
              ? `${datumLang(konfi.confirmation_date)} · ${uhrzeit(konfi.confirmation_date)} Uhr${konfi.confirmation_location ? ` · ${konfi.confirmation_location}` : ''}`
              : <span className="web-gedaempft">Noch kein Termin festgelegt</span>,
          },
          {
            label: spruch?.reference || 'Konfispruch',
            // Die Bezeichnung ist die Bibelstelle -- das Symbol des Konfispruchs kommt mit.
            icon: ANGABE_SYMBOLE.Konfispruch.icon,
            iconKlasse: ANGABE_SYMBOLE.Konfispruch.klasse,
            wert: spruch?.text
              ? spruch.text
              : <span className="web-gedaempft">{spruch ? 'Übersetzung noch nicht hinterlegt' : 'Noch kein Spruch gewählt'}</span>,
          },
          ...(hatAnwesenheit ? [{
            label: 'Pflicht-Events',
            wert: (
              <span className="web-pflicht">
                <strong className={quote >= 80 ? 'web-pflicht--gut' : quote >= 50 ? 'web-pflicht--mittel' : 'web-pflicht--schwach'}>
                  {anwesenheit!.attended} von {anwesenheit!.total_mandatory} besucht · {quote} %
                </strong>
                {konfi.jahrgang_id && (
                  <WebKnopf art="text" klein onClick={onMatrix}>
                    Anwesenheit ansehen
                    <IonIcon icon={ICON_WEITER_GEFUELLT} aria-hidden="true" />
                  </WebKnopf>
                )}
              </span>
            ),
          }] : []),
        ]}
      />
    </WebKarte>
  );
};

// --- Stempel --------------------------------------------------------------------------------

export const StempelKarte: React.FC<{ marks: readonly ChallengeMark[]; offene: readonly OffenerStempel[] }> = ({ marks, offene }) => {
  if (marks.length === 0 && offene.length === 0) return null;
  // Stempel tragen immer die Challenge-Farbe, nie eine eigene (wie in der App).
  const eintraege: WebAuszeichnung[] = [
    ...marks.map((m) => ({
      schluessel: `m-${m.challenge_id}`,
      name: m.badge_name || m.title,
      icon: getIconFromString(m.badge_icon, ICON_CHALLENGE_GEFUELLT),
      farbe: 'var(--app-color-challenges)',
      erreicht: true,
      info: <StempelInfo stempel={m} />,
    })),
    ...offene.map((o) => ({
      schluessel: `o-${o.challenge_id}`,
      name: o.badge_name || o.title,
      icon: getIconFromString(o.badge_icon, ICON_CHALLENGE_GEFUELLT),
      farbe: 'var(--app-color-challenges)',
      erreicht: false,
      info: <StempelInfo stempel={o} offen />,
    })),
  ];
  return (
    <WebKarte titel="Stempel" untertitel={`${mitEinheit(marks.length, 'Stempel', 'Stempel')} erhalten`}>
      <WebAuszeichnungen beschriftung="Stempel" eintraege={eintraege} />
    </WebKarte>
  );
};

// --- Jahresrueckblick -----------------------------------------------------------------------

export const RueckblickKarte: React.FC<{
  eintraege: readonly WrappedHistoryEntry[];
  istTeamer: boolean;
  onOeffnen: (e: WrappedHistoryEntry) => void;
}> = ({ eintraege, istTeamer, onOeffnen }) => {
  if (eintraege.length === 0) return null;
  return (
    <WebKarte titel="Jahresrückblick" untertitel={istTeamer ? 'Der Rückblick, den diese Teamer:in sieht' : 'Der Rückblick, den diese Konfi sieht'} bund>
      <ul className="web-feed">
        {eintraege.map((e) => (
          <li key={e.id} className="web-feed__zeile">
            <div className="web-feed__haupt">
              {/* Der NAME der Ausgabe, nicht das Jahr (Simon 03.09.2026): Mit mehreren Ausgaben je Jahrgang waere die Jahreszahl nicht unterscheidbar. */}
              <span className="web-feed__titel">{e.titel || `Jahresrückblick ${e.year}`}</span>
            </div>
            <div className="web-feed__rechts">
              <WebKnopf klein vorn onClick={() => onOeffnen(e)} aria-label={`${e.titel || `Jahresrückblick ${e.year}`} ansehen`}>
                <IonIcon icon={ICON_FUNKELN} aria-hidden="true" />
                Ansehen
              </WebKnopf>
            </div>
          </li>
        ))}
      </ul>
    </WebKarte>
  );
};

// --- Rolle aendern ---------------------------------------------------------------------------

export const BefoerdernKarte: React.FC<{ isOnline: boolean; onBefoerdern: () => void }> = ({ isOnline, onBefoerdern }) => (
  <WebKarte titel="Rolle ändern">
    <p className="web-karte__text">
      Beim Befördern bleiben Konfi-Punkte und Badges als Historie erhalten. Event-Buchungen und offene Aktivitäten werden gelöscht.
      Diese Aktion kann nicht rückgängig gemacht werden.
    </p>
    <WebKnopf disabled={!isOnline} onClick={onBefoerdern}>
      <IonIcon icon={ICON_ZUSAGE} aria-hidden="true" />
      {isOnline ? 'Zur Teamer:in befördern' : 'Du bist offline'}
    </WebKnopf>
  </WebKarte>
);
