// Die Challenges als Tabelle -- die Ansicht "Liste" der Web-Fassung (Simon,
// 06.10.2026: Challenges, Events und Konfis bekommen denselben Umschalter
// Liste | Kacheln). Dieselben Challenges wie die Karten im Raster, in
// derselben Reihenfolge; Filter, Suche und Zaehler gelten fuer beide
// Ansichten gleich, sie stehen darueber und kommen von der Seite.
//
// Zwei Gesichter, eine Tabelle: Team und Leitung sehen Beitraege, Wartendes,
// Zielgruppe und am Zeilenende die Aktionen der Karte (Bearbeiten, Loeschen --
// mit den Funktionen und Rechten der Seite); Konfis sehen ihren eigenen Stand.
// Eine Zeile oeffnet die Challenge (echter Link, Mittelklick geht auch).
// Die rote Zahl sitzt wie auf der Karte am Stempel.

import React from 'react';
import WebTabelle, { type WebSpalte } from '../../../web/WebTabelle';
import WebLink from '../../../web/WebLink';
import WebPill from '../../../web/WebPill';
import WebTreffer from '../../../web/WebTreffer';
import { AUDIENCE_LABEL, VISIBILITY_LABEL } from '../../../admin/views/ChallengesManageView';
import { formatRemaining, getChallengeBadgeIcon } from '../../../konfi/views/ChallengesView';
import { anzahlBeitraege, wartenAufFreigabe } from '../../../../utils/challengeTexte';
import {
  STATUS_MODIFIKATOR,
  STATUS_TON,
  STATUS_WORT,
  jahrgangText,
  restzeitText,
  zeitraumText,
  type ListenChallenge,
  type ListenEintrag,
} from '../../../../utils/challengesWeb';
import { WebChallengeSymbol, WebEingereichtPill } from './WebChallengeBausteine';
import '../../../../theme/web/challenges.css';
import { challengeStatusRang } from '../../../../utils/statusReihenfolge';

export interface WebChallengesTabelleProps<T extends ListenChallenge> {
  /** Die Challenges nach Filter und Suche, in der Reihenfolge der Seite. */
  eintraege: ReadonlyArray<ListenEintrag<T>>;
  /** Suchbegriff, in Titel und Stempel hervorgehoben. */
  suche?: string;
  /** Wessen Liste: Team und Leitung sehen mehr Spalten als Konfis. */
  fuer: 'leitung' | 'konfi';
  /** Die Seite der Challenge (/<rolle>/challenges/<id>). */
  href: (challenge: T) => string;
  /** Die rote Zahl je Challenge; `wartend`: Beitraege, die auf Freigabe warten (nur Team und Leitung). */
  kugel: (id: number) => { anzahl: number; text: string; wartend?: number };
  /** Du hast schon eingereicht. */
  eingereicht: (challenge: T) => boolean;
  /** Am Zeilenende: die Knoepfe der Karte (Bearbeiten, Loeschen), als Symbole. Nur Team und Leitung. */
  aktionen?: (challenge: T) => React.ReactNode;
}

/** Datum als Zeitpunkt zum Sortieren; fehlt es oder ist es unlesbar, steht die Zeile unten. */
const zeitpunkt = (wert?: string | null): number | null => {
  const ms = wert ? new Date(wert).getTime() : NaN;
  return Number.isNaN(ms) ? null : ms;
};

function WebChallengesTabelle<T extends ListenChallenge>({
  eintraege,
  suche = '',
  fuer,
  href,
  kugel,
  eingereicht,
  aktionen,
}: WebChallengesTabelleProps<T>): React.ReactElement {
  const leitung = fuer === 'leitung';

  const spalten: Array<WebSpalte<ListenEintrag<T>>> = [
    {
      schluessel: 'challenge',
      kopf: 'Challenge',
      breite: leitung ? '25%' : '40%',
      sortWert: ({ challenge: c }) => c.title,
      zelle: ({ challenge: c }) => (
        <div className="web-challenge-zelle">
          <WebChallengeSymbol icon={getChallengeBadgeIcon(c.badge_icon)} kugel={kugel(c.id)} klein />
          <div className="web-challenge-zelle__text">
            <WebLink href={href(c)} className="web-link--zeile web-link--text web-challenge-zeile__titel">
              <WebTreffer text={c.title} suche={suche} />
            </WebLink>
            {c.badge_name && (
              <span className="web-zelle-leise">
                Stempel: <WebTreffer text={c.badge_name} suche={suche} />
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      schluessel: 'zeitraum',
      kopf: 'Zeitraum',
      breite: leitung ? '156px' : '180px',
      // Nach dem Ende -- was zuerst ausläuft, steht oben.
      sortWert: ({ challenge: c }) => zeitpunkt(c.ends_at) ?? zeitpunkt(c.starts_at),
      zelle: ({ challenge: c, status }) => {
        const rest = status === 'active' ? restzeitText(formatRemaining(c.ends_at)) : '';
        return (
          <>
            <span className="web-challenge-wert">{zeitraumText(c, status)}</span>
            {rest && <span className="web-zelle-leise">{rest}</span>}
          </>
        );
      },
    },
    {
      schluessel: 'status',
      kopf: 'Status',
      breite: leitung ? '136px' : '130px',
      sortWert: ({ status }) => challengeStatusRang(status),
      zelle: ({ challenge: c, status }) => (
        <div className="web-pillreihe web-challenge-marken">
          <WebPill ton={STATUS_TON[status]} punkt>{STATUS_WORT[status]}</WebPill>
          {/* Die Leitung macht selbst mit, auch das zeigt die Karte -- hier als Symbol neben dem Status;
              fuer Konfis hat der eigene Stand seine Spalte. */}
          {leitung && eingereicht(c) && <WebEingereichtPill kompakt />}
        </div>
      ),
    },
  ];

  if (leitung) {
    spalten.push(
      {
        schluessel: 'beitraege',
        kopf: 'Beiträge',
        breite: '148px',
        optional: true,
        sortWert: ({ challenge: c }) => c.submission_count ?? 0,
        zelle: ({ challenge: c }) => (
          <>
            <span className="web-challenge-wert">{anzahlBeitraege(c.submission_count ?? 0)}</span>
            <span className="web-zelle-leise">{VISIBILITY_LABEL[c.visibility] ?? c.visibility}</span>
          </>
        ),
      },
      {
        schluessel: 'wartet',
        kopf: 'Freigabe',
        breite: '88px',
        sortWert: ({ challenge: c }) => kugel(c.id).wartend ?? 0,
        zelle: ({ challenge: c }) => {
          const wartend = kugel(c.id).wartend ?? 0;
          // Die orange Zahl wie am Filter: so viele Beitraege warten auf Freigabe.
          return wartend > 0 ? (
            <span
              className="web-chip__zahl web-chip__zahl--orange web-challenge-wartet"
              role="img"
              aria-label={wartenAufFreigabe(wartend)}
              title={wartenAufFreigabe(wartend)}
            >
              {wartend}
            </span>
          ) : <span className="web-gedaempft">–</span>;
        },
      },
      {
        schluessel: 'zielgruppe',
        kopf: 'Zielgruppe',
        optional: true,
        sortWert: ({ challenge: c }) => [c.audience ? AUDIENCE_LABEL[c.audience] : '', jahrgangText(c.jahrgaenge ?? [])].filter(Boolean).join(' ') || null,
        zelle: ({ challenge: c }) => {
          const zielgruppe = c.audience ? AUDIENCE_LABEL[c.audience] : undefined;
          const jahrgaenge = c.jahrgaenge ?? [];
          const kurz = jahrgangText(jahrgaenge);
          return zielgruppe || kurz ? (
            <>
              {zielgruppe && <span className="web-challenge-wert">{zielgruppe}</span>}
              {kurz && <span className="web-zelle-leise" title={jahrgaenge.map((j) => j.name).join(', ')}>{kurz}</span>}
            </>
          ) : <span className="web-gedaempft">–</span>;
        },
      },
    );
    if (aktionen) {
      spalten.push({
        schluessel: 'aktionen',
        kopf: 'Aktionen',
        kopfVersteckt: true,
        breite: '108px',
        klasse: 'web-challenge-spalte-aktionen',
        zelle: ({ challenge: c }) => <div className="web-zeilenaktionen web-challenge-zeile__aktionen">{aktionen(c)}</div>,
      });
    }
  } else {
    spalten.push({
      schluessel: 'stand',
      kopf: 'Dein Stand',
      sortWert: ({ challenge: c }) => (eingereicht(c) ? 'Eingereicht' : null),
      zelle: ({ challenge: c }) => (eingereicht(c) ? <WebEingereichtPill /> : <span className="web-gedaempft">–</span>),
    });
  }

  return (
    <WebTabelle
      beschriftung="Challenges"
      spalten={spalten}
      zeilen={eintraege}
      zeileSchluessel={({ challenge }) => challenge.id}
      zeileKlasse={({ status }) => `web-challenge-zeile web-challenge-zeile--${STATUS_MODIFIKATOR[status]}`}
      mittig
      fest
    />
  );
}

export default WebChallengesTabelle;
