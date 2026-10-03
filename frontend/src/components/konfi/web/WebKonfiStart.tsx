// Die Startseite der Konfis in der Web-Fassung (Browser ab 992 px): ein Raster
// aus Karten statt einer Spalte aus Farbverläufen.
//
//   oben     Deine Punkte -- Ringe, Fortschritt gegen die Ziele, Level
//   darunter die Karten, die die Leitung in den Startseiten-Einstellungen
//            einschaltet, in deren Reihenfolge: Konfirmation, Challenges,
//            Konfispruch, Events, Losung, Badges, Rangliste
//
// Die Seite lädt nichts selbst. Daten und Handgriffe (Punkte-Verlauf,
// Konfispruch wählen, Bibelübersetzung) reicht die App-Fassung durch
// (konfi/views/DashboardView.tsx) -- dieselben Abrufe, dieselben Modale, nur
// anders gezeigt. Welche Karte fehlt, wenn ihre Daten fehlen, entscheidet
// dort dieselbe Regel wie in der App.

import React, { useState } from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_ORT_GEFUELLT, ICON_TERMIN_GEFUELLT, ICON_UHRZEIT_GEFUELLT } from '../../shared/icons';
import { getInitials } from '../views/DashboardSections';
import { datumKurz, uhrzeit } from '../../../utils/dateUtils';
import { getIconFromString } from '../../../utils/badgeIcons';
import { punkteText } from '../../../utils/punkteText';
import { rangAuswahl, zielProzent, type StartEvent } from '../../../utils/webStart';
import type { ApiBadge, RankingEntry } from '../../../types/dashboard';
import { getBadgeColor } from '../../shared/BadgePopoverContent';
import WebKarte from '../../web/WebKarte';
import WebPunkteRinge from './WebPunkteRinge';
import WebFortschritt from './WebFortschritt';
import WebBadgeDialog from './WebBadgeDialog';
import {
  SYMBOL_LOSUNG,
  SYMBOL_SPRUCH,
  WebBadgesKarte,
  WebChallengesKarte,
  WebEventsKarte,
  WebRangKarte,
  WebZitatKarte,
  type StartBadge,
  type StartChallenge,
} from './WebStartKarten';
import '../../../theme/web/start.css';

export interface WebLevel {
  id: number;
  name: string;
  title: string;
  icon: string;
  color: string;
  points_required: number;
}

export interface WebLevelInfo {
  current_level?: WebLevel | null;
  next_level?: WebLevel | null;
  progress_percentage: number;
  points_to_next_level: number;
  level_index: number;
  all_levels?: WebLevel[];
}

export interface WebKonfirmation {
  /** Tage laut Server; fehlt er, rechnet die Karte mit dem gebuchten Event. */
  tage: number | null;
  /** „3 Tage", „Morgen" -- nur für den Fall ohne Tageszahl des Servers. */
  zeitBis: string | null;
  /** Beginn des gebuchten Konfirmationsgottesdienstes. */
  beginn: string | null;
  ort: string | null;
}

export interface WebKonfiStartProps {
  konfi: { id: number; display_name: string; jahrgang_name: string };
  punkte: {
    gesamt: number;
    gottesdienst: number;
    gemeinde: number;
    zielGottesdienst: number;
    zielGemeinde: number;
    gottesdienstAktiv: boolean;
    gemeindeAktiv: boolean;
  };
  levelInfo?: WebLevelInfo;
  rang: { platz: number; gesamt: number; ranking: RankingEntry[] };
  konfirmation: WebKonfirmation | null;
  events: StartEvent[];
  challenges: StartChallenge[];
  konfispruch: { text?: string | null; reference?: string | null } | null;
  konfispruchSichtbar: boolean;
  losung: { text: string; quelle: string; uebersetzung: string } | null;
  alleBadges: ApiBadge[];
  erreichteIds: ReadonlySet<number>;
  neueIds: ReadonlySet<number>;
  badgeZahlen: { erreicht: number; gesamt: number; geheimErreicht: number; geheimGesamt: number };
  config: {
    show_konfirmation: boolean;
    show_events: boolean;
    show_losung: boolean;
    show_badges: boolean;
    show_ranking: boolean;
    show_challenges: boolean;
  };
  sectionOrder: readonly string[];
  onUebersetzung: () => void;
  onKonfispruch?: () => void;
}

/** Die Karte „Deine Punkte": Ringe, Balken gegen die Ziele, Level mit Stufen. */
const PunkteKarte: React.FC<Pick<WebKonfiStartProps, 'punkte' | 'levelInfo' | 'rang'>> = ({ punkte, levelInfo, rang }) => {
  const p = punkte;
  const ziel = (z: number) => (z > 0 ? z : 10);
  const gesamtZiel = ziel(p.zielGottesdienst) + ziel(p.zielGemeinde);
  const beide = p.gottesdienstAktiv && p.gemeindeAktiv;
  const level = levelInfo?.current_level ?? null;
  const naechstes = levelInfo?.next_level ?? null;
  const stufen = levelInfo?.all_levels ?? [];

  const zeilen: Array<{ art: 'gesamt' | 'gottesdienst' | 'gemeinde'; name: string; wert: number; ziel: number }> = [];
  if (beide) zeilen.push({ art: 'gesamt', name: 'Gesamt', wert: p.gesamt, ziel: gesamtZiel });
  if (p.gottesdienstAktiv) zeilen.push({ art: 'gottesdienst', name: 'Gottesdienst', wert: p.gottesdienst, ziel: ziel(p.zielGottesdienst) });
  if (p.gemeindeAktiv) zeilen.push({ art: 'gemeinde', name: 'Gemeinde', wert: p.gemeinde, ziel: ziel(p.zielGemeinde) });

  return (
    <WebKarte titel="Deine Punkte" untertitel={rang.platz > 0 && rang.gesamt > 0 ? `Platz ${rang.platz} von ${rang.gesamt} im Jahrgang` : undefined}>
      <div className={level ? 'web-punkte' : 'web-punkte web-punkte--ohne-level'}>
        <div className="web-punkte__ringe">
          <WebPunkteRinge
            gesamt={p.gesamt}
            gottesdienst={p.gottesdienst}
            gemeinde={p.gemeinde}
            zielGottesdienst={p.zielGottesdienst}
            zielGemeinde={p.zielGemeinde}
            gottesdienstAktiv={p.gottesdienstAktiv}
            gemeindeAktiv={p.gemeindeAktiv}
          />
        </div>

        <ul className="web-punkte__ziele" aria-label="Punkte gegen die Ziele">
          {zeilen.map((z) => {
            const prozent = zielProzent(z.wert, z.ziel);
            return (
              <li key={z.art} className="web-ziel">
                <div className="web-ziel__kopf">
                  <span className={`web-ziel__marke web-ziel__marke--${z.art}`} aria-hidden="true" />
                  <span className="web-ziel__name">{z.name}</span>
                  <span className="web-ziel__wert">
                    <strong>{z.wert}</strong> von {z.ziel}
                  </span>
                </div>
                <WebFortschritt prozent={prozent} beschriftung={`${z.name}-Punkte`} ton={z.art} wertText={`${z.wert} von ${z.ziel}`} />
                <p className="web-ziel__fuss">
                  {prozent > 100
                    ? `${prozent} % – Ziel erreicht, ${punkteText(z.wert - z.ziel)} darüber`
                    : prozent === 100
                      ? 'Ziel erreicht'
                      : `Noch ${punkteText(z.ziel - z.wert)} bis zum Ziel`}
                </p>
              </li>
            );
          })}
          {zeilen.length === 0 && <li className="web-ziel__fuss">Zurzeit ist keine Punkteart eingeschaltet.</li>}
        </ul>

        {level && (
          <div className="web-level">
            <p className="web-level__kopf">
              <span className="web-level__etikett">Dein Level</span>
              <strong className="web-level__titel">{level.title}</strong>
            </p>
            {stufen.length > 0 && (
              <ol className="web-level__stufen" aria-label="Alle Level">
                {stufen.map((s, i) => {
                  const erreicht = i < (levelInfo?.level_index ?? 0);
                  const aktuell = i === (levelInfo?.level_index ?? 0) - 1;
                  return (
                    <li
                      key={s.id}
                      className={`web-stufe${erreicht ? ' web-stufe--erreicht' : ''}${aktuell ? ' web-stufe--aktuell' : ''}`}
                      title={`${s.title} · ${punkteText(s.points_required)} erforderlich`}
                    >
                      <span className="web-stufe__symbol" style={erreicht ? { background: s.color || undefined } : undefined} aria-hidden="true">
                        <IonIcon icon={getIconFromString(s.icon)} />
                      </span>
                      <span className="web-nur-vorlesen">
                        {s.title}, {punkteText(s.points_required)} erforderlich, {erreicht ? 'erreicht' : 'noch nicht erreicht'}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
            {naechstes && (
              <div className="web-level__weiter">
                <p className="web-level__naechstes">
                  Nächstes Level: <strong>{naechstes.title}</strong>
                  <span>{levelInfo?.points_to_next_level ? `noch ${punkteText(levelInfo.points_to_next_level)}` : `${levelInfo?.progress_percentage ?? 0} %`}</span>
                </p>
                <WebFortschritt
                  prozent={levelInfo?.progress_percentage ?? 0}
                  beschriftung={`Fortschritt zum Level ${naechstes.title}`}
                  ton="level"
                  wertText={`${levelInfo?.progress_percentage ?? 0} Prozent`}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </WebKarte>
  );
};

/** Die Karte „Deine Konfirmation": die Tage bis zum Gottesdienst, Datum und Ort. */
const KonfirmationKarte: React.FC<{ k: WebKonfirmation }> = ({ k }) => {
  const tage = k.tage;
  return (
    <WebKarte titel="Deine Konfirmation">
      <div className="web-konfirmation">
        <p className="web-konfirmation__zahl">
          {tage !== null ? tage : k.zeitBis}
          {tage !== null && <span className="web-konfirmation__einheit">{tage === 1 ? 'Tag' : 'Tage'}</span>}
        </p>
        <p className="web-konfirmation__text">
          {tage !== null
            ? (tage === 1 ? 'Genau 1 Tag bis zu deiner Konfirmation' : `Noch genau ${tage} Tage bis zu deiner Konfirmation`)
            : 'bis zu deiner Konfirmation'}
        </p>
        <div className="web-feed__meta">
          {k.beginn && (
            <>
              <span className="web-start-meta"><IonIcon icon={ICON_TERMIN_GEFUELLT} aria-hidden="true" />{datumKurz(k.beginn, { mitWochentag: true })}</span>
              <span className="web-start-meta"><IonIcon icon={ICON_UHRZEIT_GEFUELLT} aria-hidden="true" />{uhrzeit(k.beginn)} Uhr</span>
            </>
          )}
          {k.ort && <span className="web-start-meta"><IonIcon icon={ICON_ORT_GEFUELLT} aria-hidden="true" />{k.ort}</span>}
        </div>
      </div>
    </WebKarte>
  );
};

const WebKonfiStart: React.FC<WebKonfiStartProps> = (props) => {
  const { konfi, punkte, levelInfo, rang, konfirmation, events, challenges, config, sectionOrder, alleBadges, erreichteIds, neueIds } = props;
  const [offenesBadge, setOffenesBadge] = useState<number | null>(null);

  // Badges für die Karte: die erreichten, die neuesten zuerst (Verleihdatum), höchstens zwölf.
  const erreichte = alleBadges
    .filter((b) => erreichteIds.has(b.id))
    .sort((a, b) => new Date(b.earned_at || 0).getTime() - new Date(a.earned_at || 0).getTime());
  const kartenBadges: StartBadge[] = erreichte.slice(0, 12).map((b) => ({
    id: b.id,
    name: b.name,
    icon: getIconFromString(b.icon),
    farbe: getBadgeColor(b),
    erreicht: true,
    neu: neueIds.has(b.id),
    datum: b.earned_at,
  }));
  const neueSichtbar = erreichte.filter((b) => !b.is_hidden && neueIds.has(b.id)).length;
  const gewaehlt = offenesBadge === null ? null : alleBadges.find((b) => b.id === offenesBadge) ?? null;

  const rangZeilen = rangAuswahl({
    ranking: rang.ranking,
    eigenerPlatz: rang.platz || 1,
    gesamtImJahrgang: rang.gesamt || 1,
    konfiId: konfi.id,
    konfiName: konfi.display_name,
    konfiPunkte: punkte.gottesdienst + punkte.gemeinde,
    initialen: getInitials,
  });

  const karten: Record<string, () => React.ReactNode> = {
    konfirmation: () => (config.show_konfirmation && konfirmation ? <KonfirmationKarte key="konfirmation" k={konfirmation} /> : null),
    challenges: () => (config.show_challenges
      ? (
        <WebChallengesKarte
          key="challenges"
          challenges={challenges}
          challengeHref={(id) => `/konfi/challenges/${id}`}
          alleHref="/konfi/challenges"
        />
      )
      : null),
    konfispruch: () => {
      if (!props.konfispruchSichtbar) return null;
      const spruch = props.konfispruch;
      return (
        <WebZitatKarte
          key="konfispruch"
          titel="Dein Konfispruch"
          symbol={SYMBOL_SPRUCH}
          text={spruch?.text}
          quelle={spruch?.reference}
          aktion={props.onKonfispruch ? { text: 'Konfispruch ändern', onClick: props.onKonfispruch } : undefined}
          leer={{ text: 'Du hast noch keinen Konfispruch gewählt. Such dir deinen Spruch für die Konfirmation aus.', aktion: 'Konfispruch wählen' }}
        />
      );
    },
    events: () => (config.show_events
      ? (
        <WebEventsKarte
          key="events"
          events={events}
          eventHref={(id) => `/konfi/events/${id}`}
          alleHref="/konfi/events"
          leer={{ titel: 'Buche dein nächstes Event', text: 'Du bist zu keinem kommenden Event angemeldet. Schau, was als Nächstes ansteht.' }}
        />
      )
      : null),
    losung: () => (config.show_losung && props.losung
      ? (
        <WebZitatKarte
          key="losung"
          titel="Tageslosung"
          symbol={SYMBOL_LOSUNG}
          text={props.losung.text}
          quelle={props.losung.quelle}
          fussnote={props.losung.uebersetzung}
          aktion={{ text: 'Übersetzung ändern', onClick: props.onUebersetzung }}
        />
      )
      : null),
    badges: () => (config.show_badges && alleBadges.length > 0
      ? (
        <WebBadgesKarte
          key="badges"
          badges={kartenBadges}
          erreicht={props.badgeZahlen.erreicht}
          gesamt={props.badgeZahlen.gesamt}
          geheimErreicht={props.badgeZahlen.geheimErreicht}
          geheimGesamt={props.badgeZahlen.geheimGesamt}
          neueSichtbar={neueSichtbar}
          alleHref="/konfi/badges"
          onOeffnen={setOffenesBadge}
        />
      )
      : null),
    ranking: () => (config.show_ranking && rang.ranking.length > 0
      ? <WebRangKarte key="ranking" zeilen={rangZeilen} platz={rang.platz || 1} gesamt={rang.gesamt || 1} jahrgang={konfi.jahrgang_name} konfiId={konfi.id} />
      : null),
  };

  const sichtbar = sectionOrder.map((schluessel) => karten[schluessel]?.()).filter(Boolean);

  return (
    <div className="web-start web-rolle">
      <PunkteKarte punkte={punkte} levelInfo={levelInfo} rang={rang} />
      {sichtbar.length > 0 && <div className="web-start-raster">{sichtbar}</div>}
      {gewaehlt && (
        <WebBadgeDialog
          badge={gewaehlt}
          erreicht={erreichteIds.has(gewaehlt.id)}
          onSchliessen={() => setOffenesBadge(null)}
        />
      )}
    </div>
  );
};

export default WebKonfiStart;
