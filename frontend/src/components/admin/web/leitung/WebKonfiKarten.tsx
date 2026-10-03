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
import type { BonusEintrag, EventPunkteEintrag } from '../../../../types/user';
import type { KonfiZeit } from '../../../../types/konfiZeit';
import type { ChallengeMark, OffenerStempel } from '../../../../types/challenges';
import type { WrappedHistoryEntry } from '../../../../types/wrapped';
import type { Activity, Konfi } from '../../views/KonfiDetailSections';
import WebKarte from '../../../web/WebKarte';
import WebKnopf from '../../../web/WebKnopf';
import WebPill from '../../../web/WebPill';
import WebLink from '../../../web/WebLink';
import WebAngaben from '../../../web/WebAngaben';
import { WebLeer } from '../../../web/WebZustaende';
import WebSortTabelle, { type WebSortSpalte } from './WebSortTabelle';
import type { Anwesenheit, KonfiHistorie, TeamerTermin, Zertifikat } from './konfiDetailTypen';

const ZEILEN_KURZ = 10;

/** Eine Punkteart als Marke: Gottesdienst blau, Gemeinde gruen (wie in der App). */
const ArtMarke: React.FC<{ art?: string }> = ({ art }) => (
  <WebPill ton={art === 'gottesdienst' ? 'info' : 'erfolg'}>{art === 'gottesdienst' ? 'Gottesdienst' : 'Gemeinde'}</WebPill>
);

/** Ist diese Punkteart fuer den Jahrgang der Person abgeschaltet? (Die Zeile steht dann gedaempft da.) */
const artAus = (konfi: Konfi | null, art?: string): boolean =>
  (art === 'gottesdienst' && konfi?.gottesdienst_enabled === false) || (art === 'gemeinde' && konfi?.gemeinde_enabled === false);

const AlleZeigen: React.FC<{ anzahl: number; alle: boolean; onUmschalten: () => void }> = ({ anzahl, alle, onUmschalten }) => (
  anzahl > ZEILEN_KURZ ? (
    <div className="web-karte__fuss">
      <WebKnopf art="text" klein onClick={onUmschalten}>
        {alle ? 'Weniger anzeigen' : `Alle ${anzahl} anzeigen`}
      </WebKnopf>
    </div>
  ) : null
);

// --- Aktivitaeten -----------------------------------------------------------------

export const AktivitaetenKarte: React.FC<{
  aktivitaeten: readonly Activity[];
  konfi: Konfi | null;
  istTeamer: boolean;
  onEintragen: () => void;
  onLoeschen: (a: Activity) => void;
  onFoto: (a: Activity) => void;
}> = ({ aktivitaeten, konfi, istTeamer, onEintragen, onLoeschen, onFoto }) => {
  const [alle, setAlle] = useState(false);
  const sichtbar = alle ? aktivitaeten : aktivitaeten.slice(0, ZEILEN_KURZ);
  const summe = aktivitaeten.reduce((s, a) => s + (a.points || 0), 0);

  const spalten: Array<WebSortSpalte<Activity>> = [
    {
      schluessel: 'name',
      kopf: 'Aktivität',
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
    { schluessel: 'datum', kopf: 'Datum', breite: '110px', zelle: (a) => datumKurz(a.completed_date || a.date) },
    ...(!istTeamer ? [{
      schluessel: 'art',
      kopf: 'Art',
      breite: '124px',
      zelle: (a: Activity) => <ArtMarke art={a.type} />,
    }, {
      schluessel: 'punkte',
      kopf: 'Punkte',
      zahl: true,
      breite: '80px',
      zelle: (a: Activity) => <strong>+{a.points}</strong>,
    }] : []),
    {
      schluessel: 'von',
      kopf: 'Eingetragen von',
      breite: '136px',
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
      {aktivitaeten.length === 0 ? (
        <WebLeer icon={ICON_AKTION} titel="Keine Aktivitäten" text="Noch keine Aktivitäten vorhanden." />
      ) : (
        <>
          <WebSortTabelle
            beschriftung="Aktivitäten"
            spalten={spalten}
            zeilen={sichtbar}
            zeileSchluessel={(a) => a.id}
            zeileKlasse={(a) => (!istTeamer && artAus(konfi, a.type) ? 'web-zeile--leise' : undefined)}
            mittig
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
      zelle: (b) => (
        <span className="web-zelle-mit-knopf">
          <span className="web-zelle-titel">{b.description || 'Bonuspunkte'}</span>
          {artAus(konfi, b.type) && <WebPill>deaktiviert</WebPill>}
        </span>
      ),
    },
    // `bonus.date` gibt es in dieser Antwort nicht -- sie liefert bp.* aus bonus_points.
    { schluessel: 'datum', kopf: 'Datum', breite: '110px', zelle: (b) => datumKurz(b.completed_date || b.created_at || '') },
    { schluessel: 'art', kopf: 'Art', breite: '124px', zelle: (b) => <ArtMarke art={b.type} /> },
    { schluessel: 'punkte', kopf: 'Punkte', zahl: true, breite: '80px', zelle: (b) => <strong>+{b.points}</strong> },
    { schluessel: 'von', kopf: 'Vergeben von', breite: '136px', zelle: (b) => b.admin_name || 'Leitung' },
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
        <WebSortTabelle beschriftung="Bonuspunkte" spalten={spalten} zeilen={bonus} zeileSchluessel={(b) => b.id} mittig />
      )}
    </WebKarte>
  );
};

// --- Events mit Punkten (Konfi) -----------------------------------------------------

export const EventPunkteKarte: React.FC<{ eventPunkte: readonly EventPunkteEintrag[]; konfi: Konfi | null }> = ({ eventPunkte, konfi }) => {
  const summe = eventPunkte.reduce((s, e) => s + (e.points || 0), 0);
  const geordnet = nachAnzeigeDatumAbsteigend(eventPunkte);
  return (
    <WebKarte titel="Events" untertitel={punkteText(summe)} bund={eventPunkte.length > 0}>
      {eventPunkte.length === 0 ? (
        <WebLeer icon={ICON_PODIUM} titel="Keine Event-Punkte" text="Noch keine Event-Punkte erhalten." />
      ) : (
        <ul className="web-feed">
          {geordnet.map((e, i) => (
            <li key={e.id ?? i} className={`web-feed__zeile${artAus(konfi, e.point_type) ? ' web-zeile--leise' : ''}`}>
              <div className="web-feed__haupt">
                <span className="web-feed__titel">{e.event_name || 'Event'}</span>
                <span className="web-feed__meta">
                  <span>{datumKurz(punkteAnzeigeDatum(e), { ohneJahr: true })}</span>
                  <span>{e.admin_name || 'Leitung'}</span>
                  {artAus(konfi, e.point_type) && <span>(deaktiviert)</span>}
                </span>
              </div>
              <div className="web-feed__rechts">
                <strong>+{e.points}</strong>
                <ArtMarke art={e.point_type} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </WebKarte>
  );
};

// --- Events einer Teamer:in -----------------------------------------------------------

const BUCHUNG: Record<string, { text: string; ton: 'erfolg' | 'warnung' | 'neutral' }> = {
  confirmed: { text: 'Anwesend', ton: 'erfolg' },
  absent: { text: 'Abwesend', ton: 'warnung' },
};

export const TeamerEventsKarte: React.FC<{ events: readonly TeamerTermin[] }> = ({ events }) => (
  <WebKarte titel="Events" untertitel={mitEinheit(events.length, 'Event', 'Events')} bund={events.length > 0}>
    {events.length === 0 ? (
      // Auch leer anzeigen: sonst ist "war bei keinem Event" nicht von "nicht geladen" zu unterscheiden.
      <WebLeer icon={ICON_TERMIN} titel="Keine Events" text="Noch bei keinem Event dabei gewesen." />
    ) : (
      <ul className="web-feed">
        {events.slice(0, ZEILEN_KURZ).map((e) => {
          const b = BUCHUNG[e.booking_status] ?? { text: 'Ausstehend', ton: 'neutral' as const };
          return (
            <li key={e.id} className="web-feed__zeile">
              <div className="web-feed__haupt">
                <span className="web-feed__titel">{e.name}</span>
                <span className="web-feed__meta"><span>{datumKurz(e.event_date)}</span></span>
              </div>
              <div className="web-feed__rechts"><WebPill ton={b.ton}>{b.text}</WebPill></div>
            </li>
          );
        })}
        {/* Die Liste ist auf 10 begrenzt, der Titel zaehlt aber alle. */}
        {events.length > ZEILEN_KURZ && (
          <li className="web-feed__zeile"><span className="web-gedaempft">und {events.length - ZEILEN_KURZ} weitere</span></li>
        )}
      </ul>
    )}
  </WebKarte>
);

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
      zelle: (z) => (
        <span className="web-zelle-mit-knopf">
          <IonIcon icon={getIconFromString(z.icon)} className="web-zelle-symbol" aria-hidden="true" />
          <span className="web-zelle-titel">{z.name}</span>
          {z.status === 'expired' && <WebPill ton="fehler">Abgelaufen</WebPill>}
        </span>
      ),
    },
    { schluessel: 'ausgestellt', kopf: 'Ausgestellt', breite: '120px', zelle: (z) => datumKurz(z.issued_date) },
    { schluessel: 'ablauf', kopf: 'Läuft ab', breite: '120px', optional: true, zelle: (z) => (z.expiry_date ? datumKurz(z.expiry_date) : <span className="web-gedaempft">–</span>) },
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
  const sichtbar = alle ? eintraege : eintraege.slice(0, 3);
  const herkunft = (t: string) => (t === 'bonus' ? 'Bonus' : t === 'event' ? 'Event' : 'Aktivität');
  const spalten: Array<WebSortSpalte<(typeof eintraege)[number]>> = [
    { schluessel: 'titel', kopf: 'Eintrag', zelle: (e) => <span className="web-zelle-titel">{e.title}</span> },
    { schluessel: 'datum', kopf: 'Datum', breite: '110px', zelle: (e) => datumKurz(punkteAnzeigeDatum(e)) },
    { schluessel: 'herkunft', kopf: 'Herkunft', breite: '110px', zelle: (e) => <WebPill>{herkunft(e.source_type)}</WebPill> },
    { schluessel: 'art', kopf: 'Art', breite: '124px', zelle: (e) => <ArtMarke art={e.category} /> },
    { schluessel: 'punkte', kopf: 'Punkte', zahl: true, breite: '80px', zelle: (e) => <strong>+{e.points}</strong> },
  ];
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
          <WebSortTabelle beschriftung="Konfi-Historie" spalten={spalten} zeilen={sichtbar} zeileSchluessel={(e) => `${e.source_type}-${e.id}`} mittig />
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
    { schluessel: 'name', kopf: 'Event', zelle: (t) => <span className="web-zelle-titel">{t.name}</span> },
    { schluessel: 'datum', kopf: 'Datum', breite: '110px', zelle: (t) => datumKurz(t.datum) },
    { schluessel: 'status', kopf: 'Stand', breite: '150px', zelle: (t) => <WebPill>{konfiZeitTerminStatus(t)}</WebPill> },
    { schluessel: 'punkte', kopf: 'Punkte', zahl: true, breite: '90px', zelle: (t) => ((t.punkte ?? 0) > 0 ? <strong>+{t.punkte}</strong> : <span className="web-gedaempft">–</span>) },
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
            label: 'Termin',
            wert: konfi.confirmation_date
              ? `${datumLang(konfi.confirmation_date)} · ${uhrzeit(konfi.confirmation_date)} Uhr${konfi.confirmation_location ? ` · ${konfi.confirmation_location}` : ''}`
              : <span className="web-gedaempft">Noch kein Termin festgelegt</span>,
          },
          {
            label: spruch?.reference || 'Konfispruch',
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

// --- Offene Antraege -------------------------------------------------------------------------

export const AntraegeKarte: React.FC<{ antraege: readonly Activity[]; onFoto: (a: Activity) => void }> = ({ antraege, onFoto }) => {
  if (antraege.length === 0) return null;
  return (
    <WebKarte
      titel="Offene Anträge"
      untertitel="Warten auf Genehmigung"
      aktion={<WebLink href="/admin/events?segment=antraege">Anträge bearbeiten →</WebLink>}
      bund
    >
      <ul className="web-feed">
        {antraege.map((a) => (
          <li key={a.id} className="web-feed__zeile">
            <div className="web-feed__haupt">
              <span className="web-feed__titel">{a.name.replace(/ \(gemeldet\)$/, '')}</span>
              <span className="web-feed__meta"><span>gemeldet für {datumKurz(a.completed_date || a.date)}</span></span>
            </div>
            <div className="web-feed__rechts">
              <WebPill ton="warnung" punkt>{a.points} Punkte</WebPill>
              {a.hasPhoto && (
                <WebKnopf art="text" klein vorn onClick={() => onFoto(a)} aria-label={`Nachweisfoto zu ${a.name.replace(/ \(gemeldet\)$/, '')} ansehen`}>
                  <IonIcon icon={ICON_BILD} aria-hidden="true" />
                  Foto
                </WebKnopf>
              )}
            </div>
          </li>
        ))}
      </ul>
    </WebKarte>
  );
};

// --- Stempel --------------------------------------------------------------------------------

export const StempelKarte: React.FC<{ marks: readonly ChallengeMark[]; offene: readonly OffenerStempel[] }> = ({ marks, offene }) => {
  if (marks.length === 0 && offene.length === 0) return null;
  return (
    <WebKarte titel="Stempel" untertitel={`${mitEinheit(marks.length, 'Stempel', 'Stempel')} erhalten`}>
      <ul className="web-stempel">
        {marks.map((m) => (
          <li key={`m-${m.challenge_id}`} className="web-stempel__eintrag" title={m.description || undefined}>
            <span className="web-stempel__symbol" aria-hidden="true"><IonIcon icon={getIconFromString(m.badge_icon)} /></span>
            <span className="web-stempel__text">
              <span className="web-zelle-titel">{m.title}</span>
              <span className="web-zelle-leise">{m.earned_at ? `erhalten am ${datumKurz(m.earned_at)}` : 'erhalten'}{m.bewahrt ? ' · Challenge gelöscht' : ''}</span>
            </span>
          </li>
        ))}
        {offene.map((o) => (
          <li key={`o-${o.challenge_id}`} className="web-stempel__eintrag web-stempel__eintrag--offen" title={o.description || undefined}>
            <span className="web-stempel__symbol" aria-hidden="true"><IonIcon icon={getIconFromString(o.badge_icon)} /></span>
            <span className="web-stempel__text">
              <span className="web-zelle-titel">{o.title}</span>
              <span className="web-zelle-leise">noch nicht erhalten{o.status === 'ended' ? ' · Challenge beendet' : ''}</span>
            </span>
          </li>
        ))}
      </ul>
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
