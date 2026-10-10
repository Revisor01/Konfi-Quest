// Die Antraege der Leitung als Tabelle oder Kacheln (Web-Fassung von
// Mitmachen, 03.10.2026; Kacheln wie die Challenges seit 07.10.2026; Rahmen,
// Werkzeugzeile und Zustaende aus WebListenSeite seit 10.10.2026):
// was Konfis und Team als Aktivitaet gemeldet haben und auf eine Entscheidung
// wartet. Status als Marke und als Filter (Offen, Verbucht, Abgelehnt, Alle).
//
// Entschieden wird im Fenster "Aktivitaet pruefen" (ActivityRequestModal) --
// dort stehen Nachweisfoto, Kommentar und die Entscheidung mit Grund; die
// Tabelle oeffnet es nur (wie die Zeile in der App). Zuruecksetzen laeuft
// ueber dieselbe Rueckfrage wie in der App (AdminEventsPage).

import React, { useMemo, useState } from 'react';
import { IonIcon } from '@ionic/react';
import {
  ICON_AKTION_GEFUELLT,
  ICON_ANTWORTEN,
  ICON_KAMERA_GEFUELLT,
  ICON_POKAL_GEFUELLT,
  ICON_TERMIN_GEFUELLT,
  ICON_TEXTDOKUMENT,
} from '../../../shared/icons';
import { initialen } from '../../../../utils/konfiListe';
import { datumKurz } from '../../../../utils/dateUtils';
import { suchbegriff, type PillTon } from '../../../../utils/supportWeb';
import WebKnopf from '../../../web/WebKnopf';
import WebPill from '../../../web/WebPill';
import WebHinweis from '../../../web/WebHinweis';
import WebTreffer from '../../../web/WebTreffer';
import { WebBildKarteSymbol, type WebBildKarteProps } from '../../../web/WebBildKarte';
import WebListenSeite from '../../../web/WebListenSeite';
import type { WebSpalte } from '../../../web/WebListe';
import { useFilterAusAdresse } from '../../../web/useFilterAusAdresse';
import { ANTRAG_FILTER, type AntragAktionen, type AntragFilter, type AntragZeile } from './typen';
import '../../../../theme/web/termine.css';
import { antragStatusRang } from '../../../../utils/statusReihenfolge';
import { leerVon, wahlVon } from '../../../../seiten/beschreibung';
import {
  LEITUNG_ANTRAEGE_LEER_TITEL,
  LEITUNG_ANTRAEGE_TITEL,
  LEITUNG_ANTRAEGE_UNTERTITEL,
  LEITUNG_ANTRAG_STATUS,
  LEITUNG_ANTRAG_STATUS_BESCHRIFTUNG,
  OHNE_JAHRGANG,
} from '../../../../seiten/mitmachenLeitung';

// "Verbucht" statt "Genehmigt" (Entscheidung 28.08.2026): Es beschreibt, was
// passiert ist -- die Punkte sind gutgeschrieben --, nicht einen Verwaltungsakt.
const STATUS: Record<AntragZeile['status'], { text: string; ton: PillTon }> = {
  pending: { text: 'Offen', ton: 'warnung' },
  approved: { text: 'Verbucht', ton: 'erfolg' },
  rejected: { text: 'Abgelehnt', ton: 'fehler' },
};

/** Kopf der Kachel in der Farbe des Stands: offen orange, verbucht gruen, abgelehnt rot. */
const KOPF: Record<AntragZeile['status'], { akzent: string; dunkel: string }> = {
  pending: { akzent: 'var(--app-color-warning)', dunkel: 'var(--app-color-warning)' },
  approved: { akzent: 'var(--app-color-success)', dunkel: 'var(--app-color-success-strong)' },
  rejected: { akzent: 'var(--app-color-danger)', dunkel: 'var(--app-color-danger)' },
};

/** Datum als Zeitpunkt zum Sortieren; fehlt es oder ist es unlesbar, steht die Zeile unten. */
const zeitpunkt = (wert?: string | null): number | null => {
  const ms = wert ? new Date(wert).getTime() : NaN;
  return Number.isNaN(ms) ? null : ms;
};


export interface WebAntraegeProps {
  antraege: readonly AntragZeile[];
  /**
   * Der Server hat die Konfi-Antraege wegen fehlender Jahrgangs-Zuweisung
   * ausgeblendet (Header X-Kein-Jahrgang-Zugewiesen, Entscheidung 31.08.2026).
   */
  ohneJahrgang: boolean;
  aktionen: AntragAktionen;
  /** Die Antraege werden geladen. */
  laedt?: boolean;
  /** Knoepfe im Kopf (Aktualisieren) -- von Mitmachen. */
  kopfAktionen?: React.ReactNode;
  /** Ueber der Werkzeugzeile: die Reiter von Mitmachen. */
  oben?: React.ReactNode;
  /** Fuer die Modale, die ueber dieser Seite aufklappen (useModalPage). */
  pageRef?: React.Ref<HTMLElement>;
}

/** Darf die Leitung ueber diesen offenen Antrag entscheiden? Dann "Pruefen", sonst "Ansehen". */
const zuPruefen = (a: AntragZeile): boolean => a.status === 'pending' && a.darf_entscheiden !== false;

/** Die Knoepfe eines Antrags: in der Zeile Zuruecksetzen nur als Symbol, im Fuss der Karte mit Wort. */
const AntragKnoepfe: React.FC<{ antrag: AntragZeile; aktionen: AntragAktionen; mitText?: boolean }> = ({ antrag: a, aktionen, mitText = false }) => (
  zuPruefen(a) ? (
    <WebKnopf klein art="primaer" vorn onClick={() => aktionen.pruefen(a)} aria-label={`Aktivität von ${a.konfi_name} prüfen`}>
      Prüfen
    </WebKnopf>
  ) : (
    <>
      <WebKnopf klein vorn onClick={() => aktionen.pruefen(a)} aria-label={`Aktivität von ${a.konfi_name} ansehen`}>
        Ansehen
      </WebKnopf>
      {/* Ohne das Recht "Anträge entscheiden" kein Zurücksetzen (Server: 403). */}
      {a.status !== 'pending' && a.darf_entscheiden !== false && (
        <WebKnopf klein symbol={!mitText} vorn aria-label="Aktivität zurücksetzen" title="Zurücksetzen und wieder als offen markieren" onClick={() => aktionen.zuruecksetzen(a)}>
          <IonIcon icon={ICON_ANTWORTEN} aria-hidden="true" />
          {mitText && 'Zurücksetzen'}
        </WebKnopf>
      )}
    </>
  )
);

const WebAntraege: React.FC<WebAntraegeProps> = ({ antraege: roh, ohneJahrgang, aktionen, laedt = false, kopfAktionen, oben, pageRef }) => {
  // Defensive: bei kaputten oder gecachten Antworten (Objekt statt Array) leer.
  const antraege = useMemo<AntragZeile[]>(() => (Array.isArray(roh) ? [...roh] : []), [roh]);
  const [filter, setFilter] = useFilterAusAdresse<AntragFilter>('/admin/events', ANTRAG_FILTER, 'offen');
  const [suche, setSuche] = useState('');

  // Zahl je Stand, ohne die Suche -- Prädikate aus der gemeinsamen Beschreibung (seiten/mitmachenLeitung.ts).
  const zaehlen = useMemo(() => Object.fromEntries(
    LEITUNG_ANTRAG_STATUS.map((w) => [w.schluessel, antraege.filter((a) => w.passt?.(a) ?? true).length]),
  ) as Record<AntragFilter, number>, [antraege]);

  // Der Stand des Reiters, neueste zuerst; die Suche filtert die Huelle.
  const imReiter = useMemo(() => antraege
    .filter((a) => wahlVon(LEITUNG_ANTRAG_STATUS, filter).passt?.(a) ?? true)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [antraege, filter]);

  const sucht = suchbegriff(suche) !== '';

  const spalten: Array<WebSpalte<AntragZeile>> = [
    {
      schluessel: 'eingang',
      kopf: 'Eingang',
      breite: '112px',
      sortWert: (a) => zeitpunkt(a.created_at),
      zelle: (a) => <span title={a.created_at}>{datumKurz(a.created_at)}</span>,
    },
    {
      schluessel: 'person',
      kopf: 'Von',
      breite: '22%',
      sortWert: (a) => a.konfi_name,
      zelle: (a) => (
        <>
          <span className="web-zelle-titel"><WebTreffer text={a.konfi_name} suche={suche} /></span>
          {a.activity_target_role === 'teamer'
            ? <span className="web-zelle-leise">Team</span>
            : a.jahrgang_name && <span className="web-zelle-leise">{a.jahrgang_name}</span>}
        </>
      ),
    },
    {
      schluessel: 'aktivitaet',
      kopf: 'Aktivität',
      sortWert: (a) => a.activity_name,
      zelle: (a) => (
        <>
          <span className="web-zelle-titel"><WebTreffer text={a.activity_name} suche={suche} /></span>
          {a.comment && <span className="web-zelle-leise web-einzeilig" title={a.comment}>„{a.comment}“</span>}
          {a.status === 'rejected' && a.admin_comment && (
            <span className="web-zelle-leise"><strong>Grund der Ablehnung: </strong>{a.admin_comment}</span>
          )}
        </>
      ),
    },
    {
      schluessel: 'datum',
      kopf: 'Stattgefunden',
      breite: '120px',
      optional: true,
      sortWert: (a) => zeitpunkt(a.requested_date),
      zelle: (a) => (
        <>
          <span className="web-zelle-titel web-zelle-normal">{datumKurz(a.requested_date)}</span>
          {a.photo_filename && (
            <span className="web-zelle-leise web-mit-symbol">
              <IonIcon icon={ICON_KAMERA_GEFUELLT} className="app-icon-color--konfis" aria-hidden="true" />
              Foto
            </span>
          )}
        </>
      ),
    },
    {
      schluessel: 'punkte',
      kopf: 'Punkte',
      breite: '112px',
      optional: true,
      // Team-Antraege tragen keine Punkte und stehen deshalb unten.
      sortWert: (a) => (a.activity_target_role === 'teamer' ? null : a.activity_points ?? 0),
      // Antraege des Teams sind reiner Nachweis: keine Punkte, keine Art.
      zelle: (a) => (a.activity_target_role === 'teamer'
        ? <span className="web-gedaempft">–</span>
        : (
          <>
            {a.activity_points ? <span className="web-zelle-titel">{a.activity_points}P</span> : null}
            <span className="web-zelle-leise">{a.activity_type === 'gottesdienst' ? 'Gottesdienst' : 'Gemeinde'}</span>
          </>
        )),
    },
    {
      schluessel: 'status',
      kopf: 'Status',
      breite: '112px',
      sortWert: (a) => antragStatusRang(a.status),
      zelle: (a) => <WebPill ton={STATUS[a.status].ton} punkt>{STATUS[a.status].text}</WebPill>,
    },
    {
      schluessel: 'aktionen',
      kopf: 'Aktionen',
      kopfVersteckt: true,
      breite: '184px',
      zelle: (a) => <div className="web-termin-aktionen"><AntragKnoepfe antrag={a} aktionen={aktionen} /></div>,
    },
  ];

  /** Die Karte eines Antrags: Name im Kopf in der Farbe des Stands, darunter Aktivitaet, Daten, Punkte. */
  const karte = (a: AntragZeile): Omit<WebBildKarteProps, 'fuss'> => {
    const team = a.activity_target_role === 'teamer';
    const art = team ? 'Team' : a.activity_type === 'gottesdienst' ? 'Gottesdienst' : 'Gemeinde';
    return {
      akzent: KOPF[a.status].akzent,
      akzentDunkel: KOPF[a.status].dunkel,
      symbol: <WebBildKarteSymbol text={initialen(a.konfi_name)} />,
      label: [art, team ? '' : a.jahrgang_name].filter(Boolean).join(' · '),
      titelImKopf: true,
      titel: <WebTreffer text={a.konfi_name} suche={suche} />,
      onTitel: () => aktionen.pruefen(a),
      titelBeschriftung: `Aktivität von ${a.konfi_name} ${zuPruefen(a) ? 'prüfen' : 'ansehen'}`,
      marken: <WebPill ton={STATUS[a.status].ton} punkt>{STATUS[a.status].text}</WebPill>,
      text: a.comment ? `„${a.comment}“` : undefined,
      angaben: [
        { icon: ICON_AKTION_GEFUELLT, inhalt: <WebTreffer text={a.activity_name} suche={suche} />, farbe: 'var(--app-color-activities)' },
        { icon: ICON_TERMIN_GEFUELLT, inhalt: `Stattgefunden am ${datumKurz(a.requested_date)} · gemeldet am ${datumKurz(a.created_at)}`, farbe: 'var(--app-color-events)' },
        !team && a.activity_points && { icon: ICON_POKAL_GEFUELLT, inhalt: `${a.activity_points}P ${art}`, farbe: 'var(--app-color-warning)' },
        a.photo_filename && { icon: ICON_KAMERA_GEFUELLT, inhalt: 'Mit Nachweisfoto', farbe: 'var(--app-color-konfis)' },
        a.status === 'rejected' && a.admin_comment && { icon: ICON_ANTWORTEN, inhalt: `Grund der Ablehnung: ${a.admin_comment}`, farbe: 'var(--app-color-danger)' },
      ],
    };
  };

  return (
    <WebListenSeite<AntragZeile, AntragFilter>
      bereich="Mitmachen"
      titel={LEITUNG_ANTRAEGE_TITEL}
      untertitel={LEITUNG_ANTRAEGE_UNTERTITEL}
      aktionen={kopfAktionen}
      pageRef={pageRef}
      oben={(
        <>
          {oben}
          {ohneJahrgang && (
            <WebHinweis art="hinweis" titel={OHNE_JAHRGANG.titel}>
              {OHNE_JAHRGANG.text}
            </WebHinweis>
          )}
        </>
      )}
      reiter={{
        beschriftung: LEITUNG_ANTRAG_STATUS_BESCHRIFTUNG,
        wahlen: LEITUNG_ANTRAG_STATUS,
        wert: filter,
        onWert: setFilter,
        zahlen: laedt ? undefined : zaehlen,
        // Rot ist die Zahl, hinter der eine Entscheidung wartet (Offen).
        farbe: { offen: 'rot' },
      }}
      suche={{
        beschriftung: 'Aktivitäten durchsuchen',
        platzhalter: 'Person oder Aktivität suchen',
        wert: suche,
        onWert: setSuche,
        felder: (a) => [a.konfi_name, a.activity_name],
      }}
      ansicht={{ seite: 'antraege', vorgabe: 'liste' }}
      eintraege={imReiter}
      liste={{
        beschriftung: 'Gemeldete Aktivitäten',
        spalten,
        zeileSchluessel: (a) => a.id,
        zeileKlasse: (a) => (a.status === 'pending' ? undefined : 'web-zeile--gedaempft'),
        mittig: true,
        fest: true,
      }}
      kacheln={{
        beschriftung: 'Gemeldete Aktivitäten',
        schluessel: (a) => a.id,
        karte,
        fuss: (a) => <AntragKnoepfe antrag={a} aktionen={aktionen} mitText />,
      }}
      leer={{
        icon: ICON_TEXTDOKUMENT,
        titel: ohneJahrgang && antraege.length === 0 ? OHNE_JAHRGANG.titel : sucht ? 'Keine Treffer' : LEITUNG_ANTRAEGE_LEER_TITEL,
        text: sucht ? `Zu „${suche.trim()}“ gibt es in dieser Auswahl keine Aktivität.` : leerVon(LEITUNG_ANTRAG_STATUS, filter),
        aktion: sucht ? <WebKnopf onClick={() => setSuche('')}>Suche leeren</WebKnopf> : undefined,
      }}
      inhaltLaden={laedt ? 'Die Aktivitäten werden geladen.' : undefined}
    />
  );
};

export default WebAntraege;
