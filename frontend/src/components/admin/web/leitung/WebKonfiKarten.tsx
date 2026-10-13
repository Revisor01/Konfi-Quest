// Die Karten der Detailseite einer Konfi bzw. Teamer:in in der Web-Fassung
// (web/leitung/WebKonfiDetail.tsx): Aktivitaeten, Bonuspunkte, Events,
// Zertifikate, Konfi-Historie, Konfirmation, Antraege, Stempel, Rueckblick und
// "Rolle aendern". Jede Karte stellt dar, was die Seite ihr gibt, und ruft fuer
// Aktionen die Funktionen der Seite -- dieselben Fenster und Rueckfragen wie in
// der App. Jede Tabelle ist eine WebDetailListe (Karte, Tabelle, Leerzustand,
// "Alle anzeigen"; 10.10.2026).
//
// Seiten-Interview 13.10.2026 (Simon): Aktivitaeten, Events und Bonuspunkte
// tragen vorn den Kreis ihrer Punkteart wie in der App (Gottesdienst blau,
// Gemeinde gruen, Events rot, Bonus orange); eine verbuchte Aktivitaet mit
// Antrag oeffnet ihn; die Events sind EINE Liste (eventListe.ts) mit
// Pflicht-Marke, und ein Event fuehrt mit Rueckweg zur Person.

import React from 'react';
import { IonIcon } from '@ionic/react';
import {
  ICON_AKTION,
  ICON_BILD,
  ICON_BONUS,
  ICON_CHALLENGE_GEFUELLT,
  ICON_FUNKELN,
  ICON_HINZUFUEGEN,
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
import { eventMitRueckweg, personNameMerken } from '../../../../utils/rueckweg';
import type { BonusEintrag } from '../../../../types/user';
import type { KonfiZeit } from '../../../../types/konfiZeit';
import type { ChallengeMark, OffenerStempel } from '../../../../types/challenges';
import type { WrappedHistoryEntry } from '../../../../types/wrapped';
import type { Activity, AnwesenheitWahl, Konfi, PersonTermin } from '../../views/KonfiDetailSections';
import { aktivitaetSymbol, BONUS_SYMBOL, EVENT_SYMBOL } from '../../views/punkteartSymbole';
import WebKarte from '../../../web/WebKarte';
import WebKnopf from '../../../web/WebKnopf';
import WebKreis, { type WebKreisSymbolTon } from '../../../web/WebKreis';
import WebPill from '../../../web/WebPill';
import WebLink from '../../../web/WebLink';
import WebAngaben from '../../../web/WebAngaben';
import { ANGABE_SYMBOLE } from '../../../web/angabeSymbole';
import StempelInfo from '../../../web/StempelInfo';
import WebAuszeichnungen, { type WebAuszeichnung } from '../../../web/WebAuszeichnungen';
import { WebDetailListe } from '../../../web/WebDetailSeite';
import type { WebSpalte } from '../../../web/WebListe';
import { WebMerkmale } from '../../../shared/web/termine/WebTerminBausteine';
import '../../../../theme/web/leitung.css';
// web-link--knopf (der Name als Knopf, der die Zeile ueberspannt) steht dort.
import '../../../../theme/web/termine.css';
import type { Anwesenheit, KonfiHistorie, Zertifikat } from './konfiDetailTypen';
import { eventStand, type EventZeile } from './eventListe';
import { konfiZeitStatusRang, personEventStatusRang } from '../../../../utils/statusReihenfolge';

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

// --- Offene Antraege oben in den Aktivitaeten --------------------------------------
//
// Offene Antraege stehen oben in den Aktivitaeten (Simon, 09.10.2026) -- als
// Zeilen ueber der Tabelle, die selbst nur Verbuchtes zeigt und zaehlt. (Die
// offenen und anstehenden Termine stehen seit 13.10.2026 IN der Eventliste.)

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

// --- Der Kreis vor dem Namen ---------------------------------------------------------
//
// Simon, 13.10.2026: „aktivitaeten events bonus duerften gerne auch ein icon
// bekommen vorne und color coded entsprechend ihrer kategorien sein gruen blau
// rot orange". Dieselben Symbole wie die Kreise der App (KonfiDetailSections:
// aktivitaetSymbol, EVENT_SYMBOL, BONUS_SYMBOL), dieselben Farben.

/** Farbe des Kreises einer Aktivitaet: Gottesdienst blau, Gemeinde gruen, bei einer Teamer:in die Teamer-Farbe. */
const artTon = (art: string | undefined, istTeamer: boolean): WebKreisSymbolTon =>
  istTeamer ? 'teamer' : art === 'gottesdienst' ? 'gottesdienst' : 'gemeinde';

/** Der Name einer Zeile mit dem Kreis davor; dahinter Marken, darunter Knoepfe der Zeile. */
const NameMitKreis: React.FC<{
  kreis: React.ReactNode;
  name: React.ReactNode;
  dahinter?: React.ReactNode;
  darunter?: React.ReactNode;
}> = ({ kreis, name, dahinter, darunter }) => (
  <span className="web-person-zelle">
    {kreis}
    <span className="web-person-zelle__text">
      <span className="web-zelle-mit-knopf">
        {name}
        {dahinter}
      </span>
      {darunter}
    </span>
  </span>
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
  /**
   * Eine verbuchte Aktivitaet mit Antrag (request_id): Klick auf die Zeile
   * oeffnet den Antrag (13.10.2026). Ohne Antrag -- von der Leitung
   * eingetragen -- bleibt die Zeile ohne Klick.
   */
  onAntrag?: (a: Activity) => void;
}> = ({ aktivitaeten, offene = [], isOnline = true, konfi, istTeamer, onEintragen, onLoeschen, onFoto, onAntrag }) => {
  const summe = aktivitaeten.reduce((s, a) => s + (a.points || 0), 0);

  const spalten: Array<WebSpalte<Activity>> = [
    {
      schluessel: 'name',
      kopf: 'Aktivität',
      sortWert: (a) => a.name,
      zelle: (a) => {
        const mitAntrag = Boolean(onAntrag) && a.request_id != null;
        return (
          <NameMitKreis
            kreis={<WebKreis icon={aktivitaetSymbol(a.type, istTeamer)} ton={artTon(a.type, istTeamer)} />}
            name={mitAntrag ? (
              // Der Name ist ein Knopf, dessen Netz die ganze Zeile ueberspannt
              // (web-link--zeile); Foto und Loeschen liegen darueber (vorn).
              <button
                type="button"
                className="web-link web-link--zeile web-link--text web-link--knopf web-zelle-titel"
                aria-label={`Antrag zu ${a.name} ansehen`}
                title="Antrag ansehen"
                onClick={() => onAntrag?.(a)}
              >
                {a.name}
              </button>
            ) : <span className="web-zelle-titel">{a.name}</span>}
            dahinter={(
              <>
                {!istTeamer && artAus(konfi, a.type) && <WebPill>deaktiviert</WebPill>}
                {a.hasPhoto && (
                  <WebKnopf art="text" klein symbol vorn onClick={() => onFoto(a)} aria-label={`Nachweisfoto zu ${a.name} ansehen`} title="Nachweisfoto ansehen">
                    <IonIcon icon={ICON_BILD} aria-hidden="true" />
                  </WebKnopf>
                )}
              </>
            )}
          />
        );
      },
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
  ];

  return (
    <WebDetailListe
      titel="Aktivitäten"
      untertitel={istTeamer ? mitEinheit(aktivitaeten.length, 'Aktivität', 'Aktivitäten') : `${punkteText(summe)} aus ${mitEinheit(aktivitaeten.length, 'Aktivität', 'Aktivitäten')}`}
      aktion={(
        <WebKnopf klein onClick={onEintragen}>
          <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
          Aktivität eintragen
        </WebKnopf>
      )}
      oben={offene.length > 0 ? <OffeneAntraegeZeilen antraege={offene} isOnline={isOnline} onFoto={onFoto} /> : undefined}
      leer={{ icon: ICON_AKTION, titel: 'Keine Aktivitäten', text: 'Noch keine Aktivitäten vorhanden.' }}
      kurz={ZEILEN_KURZ}
      spalten={spalten}
      zeilen={aktivitaeten}
      zeileSchluessel={(a) => a.id}
      zeileKlasse={(a) => (!istTeamer && artAus(konfi, a.type) ? 'web-zeile--leise' : undefined)}
      loeschen={{ onKlick: onLoeschen, beschriftung: (a) => `Aktivität ${a.name} löschen`, titel: () => 'Aktivität löschen' }}
      mittig
      klasse="web-tabelle--punkte"
    />
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
  const spalten: Array<WebSpalte<BonusEintrag>> = [
    {
      schluessel: 'grund',
      kopf: 'Grund',
      sortWert: (b) => b.description || 'Bonuspunkte',
      zelle: (b) => (
        <NameMitKreis
          kreis={<WebKreis icon={BONUS_SYMBOL} ton="bonus" />}
          name={<span className="web-zelle-titel">{b.description || 'Bonuspunkte'}</span>}
          dahinter={artAus(konfi, b.type) ? <WebPill>deaktiviert</WebPill> : undefined}
        />
      ),
    },
    // `bonus.date` gibt es in dieser Antwort nicht -- sie liefert bp.* aus bonus_points.
    { schluessel: 'datum', kopf: 'Datum', breite: SPALTE.datum, sortWert: (b) => alsDatum(b.completed_date || b.created_at), zelle: (b) => datumKurz(b.completed_date || b.created_at || '') },
    { schluessel: 'art', kopf: 'Art', breite: SPALTE.art, sortWert: (b) => b.type, zelle: (b) => <ArtMarke art={b.type} /> },
    { schluessel: 'punkte', kopf: 'Punkte', zahl: true, breite: SPALTE.punkte, sortWert: (b) => b.points, zelle: (b) => <strong>+{b.points}</strong> },
    { schluessel: 'von', kopf: 'Vergeben von', breite: SPALTE.von, optional: true, sortWert: (b) => b.admin_name || 'Leitung', zelle: (b) => b.admin_name || 'Leitung' },
  ];
  return (
    <WebDetailListe
      titel="Bonuspunkte"
      untertitel={punkteText(summe)}
      aktion={(
        <WebKnopf klein onClick={onVergeben}>
          <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
          Bonuspunkte vergeben
        </WebKnopf>
      )}
      leer={{ icon: ICON_BONUS, titel: 'Keine Bonuspunkte', text: 'Noch keine Bonuspunkte erhalten.' }}
      spalten={spalten}
      zeilen={bonus}
      zeileSchluessel={(b) => b.id}
      loeschen={{ onKlick: onLoeschen, beschriftung: (b) => `Bonuspunkte ${b.description || ''} löschen`.replace('  ', ' '), titel: () => 'Bonuspunkte löschen' }}
      mittig
      klasse="web-tabelle--punkte"
    />
  );
};

// --- Events: EINE Liste (Konfi und Teamer:in) ----------------------------------------
//
// Simon, 13.10.2026: „ich sehe events die angemeldeten, dann nochmal eine
// zuordnung mit teilgenommenen events -- das soll eine liste sein, pflicht
// events sollten da auch gekennzeichnet sein". Alle Termine der Person in einer
// Tabelle (eventListe.ts): zu verbuchende oben mit „Anwesend" und „Nicht
// anwesend" in der Zeile, dann anstehende, dann der Rest nach Datum.
// Pflicht und Konfirmation als Marken wie in der Terminliste (WebMerkmale).
//
// Dieselben Spaltenbreiten wie Aktivitaeten und Bonuspunkte (Simon,
// 07.10.2026): der Stand steht unter "Eingetragen von", die Aktionsspalte
// bleibt leer. Bei einer Teamer:in ohne Art und Punkte (wie ihre Aktivitaeten).
//
// Ein Event fuehrt mit Rueckweg zur Person (`?person=`, utils/rueckweg.ts;
// Simon: „zurück ins profil?").

const nichtsTun = () => {};

export const EventListeKarte: React.FC<{
  zeilen: readonly EventZeile[];
  istTeamer: boolean;
  konfi: Konfi | null;
  /** Die Person dieser Seite: Ziel des Rueckwegs aus dem Event. */
  personId: number;
  /** Ihr Name -- die Eventseite zeigt ihn am Rueckweg schon beim Laden. */
  personName?: string;
  kannVerbuchen?: boolean;
  isOnline?: boolean;
  onAnwesenheit?: (t: PersonTermin, status: AnwesenheitWahl) => void;
}> = ({ zeilen, istTeamer, konfi, personId, personName, kannVerbuchen = false, isOnline = true, onAnwesenheit = nichtsTun }) => {
  React.useEffect(() => {
    if (personName) personNameMerken(personId, personName);
  }, [personId, personName]);

  const summe = zeilen.reduce((s, z) => s + z.punkte, 0);
  const anzahl = mitEinheit(zeilen.length, 'Event', 'Events');
  const aus = (z: EventZeile) => !istTeamer && artAus(konfi, z.punkteArt ?? undefined);

  const spalten: Array<WebSpalte<EventZeile>> = [
    {
      schluessel: 'event',
      kopf: 'Event',
      sortWert: (z) => z.name,
      zelle: (z) => {
        const knoepfe = z.art === 'verbuchen' && z.termin && kannVerbuchen && z.termin.darf_verbuchen ? z.termin : null;
        return (
          <NameMitKreis
            kreis={<WebKreis icon={EVENT_SYMBOL} ton="events" />}
            // In den Termin -- mit Rueckweg zu dieser Person; ein Termin
            // ausserhalb der eigenen Sicht ohne Link (er antwortete 403).
            name={z.oeffnen
              ? <WebLink href={eventMitRueckweg(z.event_id, personId)} className="web-link--zeile web-link--text web-zelle-titel">{z.name}</WebLink>
              : <span className="web-zelle-titel">{z.name}</span>}
            dahinter={(
              <>
                <WebMerkmale
                  event={{ mandatory: z.pflicht, is_konfirmation: z.konfirmation, teamer_only: false, teamer_needed: false, is_series: false }}
                  teamZeigen={false}
                />
                {aus(z) && <WebPill>deaktiviert</WebPill>}
              </>
            )}
            darunter={knoepfe ? (
              <span className="web-zeile-knoepfe">
                <WebKnopf klein vorn disabled={!isOnline} onClick={() => onAnwesenheit(knoepfe, 'present')} aria-label={`${z.name}: anwesend`}>
                  Anwesend
                </WebKnopf>
                <WebKnopf klein vorn disabled={!isOnline} onClick={() => onAnwesenheit(knoepfe, 'absent')} aria-label={`${z.name}: nicht anwesend`}>
                  Nicht anwesend
                </WebKnopf>
              </span>
            ) : undefined}
          />
        );
      },
    },
    { schluessel: 'datum', kopf: 'Datum', breite: SPALTE.datum, sortWert: (z) => alsDatum(z.datum), zelle: (z) => datumKurz(z.datum) },
    ...(!istTeamer ? [{
      schluessel: 'art',
      kopf: 'Art',
      breite: SPALTE.art,
      sortWert: (z: EventZeile) => z.punkteArt ?? '',
      zelle: (z: EventZeile) => (z.punkte > 0 && z.punkteArt ? <ArtMarke art={z.punkteArt} /> : <span className="web-gedaempft">–</span>),
    }, {
      schluessel: 'punkte',
      kopf: 'Punkte',
      zahl: true,
      breite: SPALTE.punkte,
      sortWert: (z: EventZeile) => z.punkte,
      zelle: (z: EventZeile) => (z.punkte > 0
        ? <strong title={z.von ? `vergeben von ${z.von}` : undefined}>+{z.punkte}</strong>
        : <span className="web-gedaempft">–</span>),
    }] : []),
    {
      schluessel: 'stand',
      kopf: 'Stand',
      breite: SPALTE.von,
      // Die Reihe steht bei allen Status-Reihen (utils/statusReihenfolge.ts).
      sortWert: (z) => personEventStatusRang(eventStand(z).text),
      zelle: (z) => {
        const stand = eventStand(z);
        return <WebPill ton={stand.ton}>{stand.text}</WebPill>;
      },
    },
    // Leer, aber gleich breit: Die Spalten stehen unter denen von Aktivitaeten und Bonuspunkten.
    { schluessel: 'aktionen', kopf: 'Aktionen', kopfVersteckt: true, klasse: 'web-spalte-aktionen-schmal', zelle: () => null },
  ];

  return (
    <WebDetailListe
      titel="Events"
      untertitel={istTeamer ? anzahl : `${anzahl} · ${punkteText(summe)}`}
      // Auch leer anzeigen: sonst ist "kein Event" nicht von "nicht geladen" zu unterscheiden.
      leer={{
        icon: ICON_TERMIN,
        titel: 'Keine Events',
        text: istTeamer ? 'Noch bei keinem Event dabei gewesen.' : 'Noch bei keinem Event angemeldet.',
      }}
      kurz={ZEILEN_KURZ}
      spalten={spalten}
      zeilen={zeilen}
      zeileSchluessel={(z) => z.schluessel}
      zeileKlasse={(z) => (aus(z) ? 'web-zeile--leise' : undefined)}
      mittig
      klasse="web-tabelle--punkte"
    />
  );
};

// --- Zertifikate (Teamer) ---------------------------------------------------------------

export const ZertifikateKarte: React.FC<{
  zertifikate: readonly Zertifikat[];
  isOnline: boolean;
  onZuweisen: () => void;
  onEntfernen: (z: { id: number; name: string }) => void;
}> = ({ zertifikate, isOnline, onZuweisen, onEntfernen }) => {
  const spalten: Array<WebSpalte<Zertifikat>> = [
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
  ];
  return (
    <WebDetailListe
      titel="Zertifikate"
      untertitel={mitEinheit(zertifikate.length, 'Zertifikat', 'Zertifikate')}
      aktion={(
        <WebKnopf klein disabled={!isOnline} onClick={onZuweisen}>
          <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
          {isOnline ? 'Zertifikat zuweisen' : 'Du bist offline'}
        </WebKnopf>
      )}
      spalten={spalten}
      zeilen={zertifikate}
      zeileSchluessel={(z) => z.id}
      loeschen={{ onKlick: onEntfernen, beschriftung: (z) => `Zertifikat ${z.name} entfernen`, titel: () => 'Zertifikat entfernen' }}
      mittig
    />
  );
};

// --- Konfi-Historie einer befoerderten Teamer:in ------------------------------------------

export const KonfiHistorieKarte: React.FC<{ historie: KonfiHistorie }> = ({ historie }) => {
  // NULL-SICHER: Fehlt history/totals (alter Cache, Teamer ohne Konfi-Zeit), wirft ein Zugriff hier den ganzen Render.
  const eintraege = Array.isArray(historie?.history) ? nachAnzeigeDatumAbsteigend(historie.history) : [];
  const summe = historie?.totals || { gottesdienst: 0, gemeinde: 0, total: 0 };
  const herkunft = (t: string) => (t === 'bonus' ? 'Bonus' : t === 'event' ? 'Event' : 'Aktivität');
  const spalten: Array<WebSpalte<(typeof eintraege)[number]>> = [
    { schluessel: 'titel', kopf: 'Eintrag', sortWert: (e) => e.title, zelle: (e) => <span className="web-zelle-titel">{e.title}</span> },
    { schluessel: 'datum', kopf: 'Datum', breite: '110px', sortWert: (e) => alsDatum(punkteAnzeigeDatum(e)), zelle: (e) => datumKurz(punkteAnzeigeDatum(e)) },
    { schluessel: 'herkunft', kopf: 'Herkunft', breite: '110px', sortWert: (e) => herkunft(e.source_type), zelle: (e) => <WebPill>{herkunft(e.source_type)}</WebPill> },
    { schluessel: 'art', kopf: 'Art', breite: '124px', sortWert: (e) => e.category, zelle: (e) => <ArtMarke art={e.category} /> },
    { schluessel: 'punkte', kopf: 'Punkte', zahl: true, breite: '80px', sortWert: (e) => e.points, zelle: (e) => <strong>+{e.points}</strong> },
  ];
  return (
    <WebDetailListe
      titel="Konfi-Historie"
      untertitel={`${punkteText(summe.total)} in der Konfi-Zeit · ${summe.gottesdienst} Gottesdienst · ${summe.gemeinde} Gemeinde`}
      leer={{ icon: ICON_UHRZEIT, titel: 'Keine Konfi-Punkte', text: 'Keine Konfi-Punkte vorhanden.' }}
      kurz={3}
      spalten={spalten}
      zeilen={eintraege}
      zeileSchluessel={(e) => `${e.source_type}-${e.id}`}
      mittig
    />
  );
};

/** Die Events der dauerhaften Kopie der Konfi-Zeit (befoerderte Teamer:in). */
export const KonfiZeitKarte: React.FC<{ zeit: KonfiZeit }> = ({ zeit }) => {
  const termine = Array.isArray(zeit.termine) ? zeit.termine : [];
  if (termine.length === 0) return null;
  const spalten: Array<WebSpalte<(typeof termine)[number]>> = [
    { schluessel: 'name', kopf: 'Event', sortWert: (t) => t.name, zelle: (t) => <span className="web-zelle-titel">{t.name}</span> },
    { schluessel: 'datum', kopf: 'Datum', breite: '110px', sortWert: (t) => alsDatum(t.datum), zelle: (t) => datumKurz(t.datum) },
    { schluessel: 'status', kopf: 'Stand', breite: '150px', sortWert: (t) => konfiZeitStatusRang(konfiZeitTerminStatus(t)), zelle: (t) => <WebPill>{konfiZeitTerminStatus(t)}</WebPill> },
    { schluessel: 'punkte', kopf: 'Punkte', zahl: true, breite: '90px', sortWert: (t) => t.punkte ?? 0, zelle: (t) => ((t.punkte ?? 0) > 0 ? <strong>+{t.punkte}</strong> : <span className="web-gedaempft">–</span>) },
  ];
  return (
    <WebDetailListe
      titel="Events der Konfi-Zeit"
      untertitel={mitEinheit(termine.length, 'Event', 'Events')}
      spalten={spalten}
      zeilen={termine}
      zeileSchluessel={(t) => t.event_id}
      mittig
    />
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
