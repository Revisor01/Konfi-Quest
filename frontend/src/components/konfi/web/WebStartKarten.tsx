// Die Karten der Startseiten in der Web-Fassung -- für Konfis UND Team. Beide
// Startseiten zeigen dieselben Bausteine (Events, Challenges, Losung,
// Konfispruch, Badges); sie unterscheiden sich in den Daten und Wegen, nicht in
// der Gestalt. Deshalb liegen die Karten hier an einer Stelle, und die beiden
// Seiten (WebKonfiStart, teamer/web/WebTeamerStart) setzen sie zusammen.
//
// Jede Karte ist ein Bereich mit Überschrift (WebKarte), die Zeilen sind echte
// Links (Mittelklick öffnet einen neuen Tab), Abzeichen sind Knöpfe, die den
// Dialog mit den Einzelheiten öffnen. Welche Karten erscheinen und in welcher
// Reihenfolge, entscheidet die Seite nach den Einstellungen der Leitung.

import React from 'react';
import { IonIcon } from '@ionic/react';
import {
  ICON_ANKUENDIGUNG,
  ICON_CHALLENGE,
  ICON_FUNKELN_GEFUELLT,
  ICON_GRUPPE_GEFUELLT,
  ICON_ORT_GEFUELLT,
  ICON_POKAL_GEFUELLT,
  ICON_SICHTBAR,
  ICON_TERMIN,
  ICON_UHRZEIT,
  ICON_WERKZEUG,
  ICON_BUCH,
} from '../../shared/icons';
import { datumKurz } from '../../../utils/dateUtils';
import { punkteText } from '../../../utils/punkteText';
import { challengeRestzeit, datumsBlock, naehe, type StartEvent } from '../../../utils/webStart';
import type { RankingZeile } from '../../../types/dashboard';
import WebKarte from '../../web/WebKarte';
import WebLink from '../../web/WebLink';
import WebKnopf from '../../web/WebKnopf';
import WebPill from '../../web/WebPill';
import { WebLeer } from '../../web/WebZustaende';
import WebBadgeSymbol from './WebBadgeSymbol';
import WebFortschritt from './WebFortschritt';
import '../../../theme/web/start.css';

// --- Events ---------------------------------------------------------------

export interface WebEventsKarteProps {
  events: StartEvent[];
  /** Adresse eines Events: Konfi `/konfi/events/7`, Team `/teamer/events?eventId=7`. */
  eventHref: (id: number) => string;
  alleHref: string;
  /** Was die leere Karte sagt. */
  leer: { titel: string; text: string };
  titel?: string;
}

export const WebEventsKarte: React.FC<WebEventsKarteProps> = ({ events, eventHref, alleHref, leer, titel = 'Deine Events' }) => (
  <WebKarte
    titel={titel}
    bund={events.length > 0}
    aktion={<WebLink href={alleHref}>Alle Events →</WebLink>}
  >
    {events.length === 0 ? (
      <WebLeer icon={ICON_TERMIN} titel={leer.titel} text={leer.text} aktion={<WebKnopf href={alleHref}>Events ansehen</WebKnopf>} />
    ) : (
      <ul className="web-feed" aria-label={titel}>
        {events.map((e) => {
          const block = datumsBlock(e.beginn);
          return (
            <li key={e.id} className="web-feed__zeile web-zeile web-start-event">
              {block && (
                <span className="web-datumsblock" aria-hidden="true">
                  <span className="web-datumsblock__tag">{block.wochentag}</span>
                  <span className="web-datumsblock__zahl">{block.tag}</span>
                  <span className="web-datumsblock__monat">{block.monat}</span>
                </span>
              )}
              <div className="web-feed__haupt">
                <WebLink
                  href={eventHref(e.id)}
                  className={`web-link--zeile web-feed__titel${e.status === 'abgesagt' ? ' web-start-durchgestrichen' : ''}`}
                >
                  {e.titel}
                </WebLink>
                <div className="web-feed__meta">
                  <span className="web-start-meta">
                    <IonIcon icon={ICON_TERMIN} aria-hidden="true" />
                    {e.datum}
                  </span>
                  {e.zeit && (
                    <span className="web-start-meta">
                      <IonIcon icon={ICON_UHRZEIT} aria-hidden="true" />
                      {e.zeit} Uhr
                    </span>
                  )}
                  {e.ort && (
                    <span className="web-start-meta">
                      <IonIcon icon={ICON_ORT_GEFUELLT} aria-hidden="true" />
                      {e.ort}
                    </span>
                  )}
                </div>
                {e.mitbringen && <p className="web-start-notiz">Mitbringen: {e.mitbringen}</p>}
                {e.status === 'abgesagt' && e.grund && <p className="web-start-notiz">Grund: {e.grund}</p>}
              </div>
              <div className="web-feed__rechts">
                {e.status === 'abgesagt' ? (
                  <WebPill ton="fehler" punkt>Abgesagt</WebPill>
                ) : e.status === 'warteliste' ? (
                  <WebPill ton="warnung" punkt>Warteliste{e.wartePlatz ? ` #${e.wartePlatz}` : ''}</WebPill>
                ) : (
                  <WebPill>{naehe(e.tage)}</WebPill>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    )}
  </WebKarte>
);

// --- Challenges -----------------------------------------------------------

export interface StartChallenge {
  id: number;
  title: string;
  ends_at: string;
  has_submission?: boolean;
  challenge_type?: string;
}

const CHALLENGE_ICON: Record<string, string> = {
  wahrnehmung: ICON_SICHTBAR,
  beitrag: ICON_ANKUENDIGUNG,
  praxis: ICON_WERKZEUG,
  frei: ICON_CHALLENGE,
};

export interface WebChallengesKarteProps {
  challenges: StartChallenge[];
  /** Adresse einer Challenge: `/konfi/challenges/3`. */
  challengeHref: (id: number) => string;
  alleHref: string;
  /** Mit Angabe steht die Karte auch ohne laufende Challenge da (Team), sonst entfällt sie. */
  leer?: { titel: string; text: string };
}

export const WebChallengesKarte: React.FC<WebChallengesKarteProps> = ({ challenges, challengeHref, alleHref, leer }) => {
  if (challenges.length === 0 && !leer) return null;
  return (
    <WebKarte titel="Laufende Challenges" bund={challenges.length > 0} aktion={<WebLink href={alleHref}>Alle Challenges →</WebLink>}>
      {challenges.length === 0 && leer ? (
        <WebLeer icon={ICON_CHALLENGE} titel={leer.titel} text={leer.text} aktion={<WebKnopf href={alleHref}>Challenges ansehen</WebKnopf>} />
      ) : (
        <ul className="web-feed" aria-label="Laufende Challenges">
          {challenges.slice(0, 5).map((c) => (
            <li key={c.id} className="web-feed__zeile web-zeile">
              <span className="web-start-symbol web-start-symbol--challenges" aria-hidden="true">
                <IonIcon icon={CHALLENGE_ICON[c.challenge_type || ''] || ICON_CHALLENGE} />
              </span>
              <div className="web-feed__haupt">
                <WebLink href={challengeHref(c.id)} className="web-link--zeile web-feed__titel">{c.title}</WebLink>
                <div className="web-feed__meta">
                  <span className="web-start-meta">
                    <IonIcon icon={ICON_UHRZEIT} aria-hidden="true" />
                    {challengeRestzeit(c.ends_at)}
                  </span>
                </div>
              </div>
              {c.has_submission && (
                <div className="web-feed__rechts">
                  <WebPill ton="erfolg" punkt>Beitrag eingereicht</WebPill>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </WebKarte>
  );
};

// --- Zitate: Tageslosung und Konfispruch -----------------------------------

export interface WebZitatKarteProps {
  titel: string;
  symbol: string;
  /** Der Text des Verses; ohne Text steht `leer` da. */
  text?: string | null;
  quelle?: string | null;
  /** Kleine Zeile unter dem Zitat („Lutherbibel 2017"). */
  fussnote?: string;
  /** Ändern-Knopf unter dem Zitat. */
  aktion?: { text: string; onClick: () => void };
  /** Was die Karte ohne Text sagt, mit eigenem Knopf zum Eintragen. */
  leer?: { text: string; aktion: string };
}

export const WebZitatKarte: React.FC<WebZitatKarteProps> = ({ titel, symbol, text, quelle, fussnote, aktion, leer }) => {
  const hatText = Boolean(text?.trim());
  return (
    <WebKarte titel={titel}>
      {hatText || quelle ? (
        <figure className="web-zitat">
          <IonIcon icon={symbol} className="web-zitat__symbol" aria-hidden="true" />
          <blockquote className="web-zitat__text">{hatText ? `„${text!.trim()}“` : null}</blockquote>
          {quelle && <figcaption className="web-zitat__quelle">{quelle}</figcaption>}
          {fussnote && <p className="web-zitat__fussnote">{fussnote}</p>}
          {aktion && (
            <div className="web-zitat__aktion">
              <WebKnopf klein onClick={aktion.onClick}>{aktion.text}</WebKnopf>
            </div>
          )}
        </figure>
      ) : (
        <div className="web-zitat web-zitat--leer">
          <IonIcon icon={symbol} className="web-zitat__symbol" aria-hidden="true" />
          <p className="web-zitat__text">{leer?.text}</p>
          {leer && aktion && (
            <div className="web-zitat__aktion">
              <WebKnopf klein art="primaer" onClick={aktion.onClick}>{leer.aktion}</WebKnopf>
            </div>
          )}
        </div>
      )}
    </WebKarte>
  );
};

export const SYMBOL_LOSUNG = ICON_BUCH;
export const SYMBOL_SPRUCH = ICON_FUNKELN_GEFUELLT;

// --- Badges ---------------------------------------------------------------

export interface StartBadge {
  id: number;
  name: string;
  icon: string;
  farbe: string;
  erreicht: boolean;
  neu: boolean;
  datum?: string | null;
}

export interface WebBadgesKarteProps {
  /** Die Badges, die die Karte zeigt (erreichte zuerst, neueste vorn). */
  badges: StartBadge[];
  /** „5 von 24 erreicht" -- Zahlen der sichtbaren Badges. */
  erreicht: number;
  gesamt: number;
  /** Geheime Badges: erreichte und alle, damit „noch 2 geheim" stimmt. */
  geheimErreicht: number;
  geheimGesamt: number;
  neueSichtbar: number;
  alleHref: string;
  onOeffnen: (id: number) => void;
}

export const WebBadgesKarte: React.FC<WebBadgesKarteProps> = ({
  badges, erreicht, gesamt, geheimErreicht, geheimGesamt, neueSichtbar, alleHref, onOeffnen,
}) => {
  const prozent = gesamt > 0 ? Math.round((erreicht / gesamt) * 100) : 0;
  const geheimOffen = Math.max(0, geheimGesamt - geheimErreicht);
  return (
    <WebKarte titel="Deine Badges" aktion={<WebLink href={alleHref}>Alle Badges →</WebLink>}>
      <div className="web-start-badgekopf">
        <p className="web-start-badgezahl">
          <strong>{erreicht}</strong> von {gesamt} erreicht
          {neueSichtbar > 0 && <WebPill ton="erfolg" punkt>{neueSichtbar} {neueSichtbar === 1 ? 'neues' : 'neue'}</WebPill>}
        </p>
        <WebFortschritt prozent={prozent} beschriftung="Badges erreicht" ton="gesamt" wertText={`${erreicht} von ${gesamt}`} />
        {geheimGesamt > 0 && (
          <p className="web-start-notiz">
            Geheim: {geheimErreicht} von {geheimGesamt}{geheimOffen > 0 ? ` – noch ${geheimOffen} zu entdecken` : ''}
          </p>
        )}
      </div>
      {badges.length === 0 ? (
        <WebLeer icon={ICON_POKAL_GEFUELLT} titel="Noch keine Badges" text="Sammle Punkte, um deine ersten Badges zu bekommen." />
      ) : (
        <ul className="web-abzeichen-reihe" aria-label="Zuletzt erhaltene Badges">
          {badges.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                className="web-abzeichen-knopf"
                onClick={() => onOeffnen(b.id)}
                aria-label={`${b.name}${b.neu ? ' (neu)' : ''}${b.erreicht ? '' : ' (noch nicht erreicht)'}: Einzelheiten ansehen`}
              >
                <WebBadgeSymbol icon={b.icon} farbe={b.farbe} erreicht={b.erreicht} neu={b.neu} groesse="mittel" />
                <span className="web-abzeichen-knopf__name">{b.name}</span>
                {b.datum && <span className="web-abzeichen-knopf__datum">{datumKurz(b.datum, { ohneJahr: true })}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </WebKarte>
  );
};

// --- Rangliste ------------------------------------------------------------

export interface WebRangKarteProps {
  zeilen: RankingZeile[];
  platz: number;
  gesamt: number;
  jahrgang: string;
  konfiId: number;
}

export const WebRangKarte: React.FC<WebRangKarteProps> = ({ zeilen, platz, gesamt, jahrgang, konfiId }) => (
  <WebKarte titel="Deine Rangliste" untertitel={jahrgang}>
    <div className="web-rang-kopf">
      <span className="web-rang-kopf__platz">{platz}</span>
      <span className="web-rang-kopf__von">von {gesamt}</span>
      <IonIcon icon={ICON_POKAL_GEFUELLT} className="web-rang-kopf__pokal" aria-hidden="true" />
    </div>
    <ol className="web-rang" aria-label={`Rangliste im Jahrgang ${jahrgang}`}>
      {zeilen.map((z, i) => {
        if ('separator' in z) {
          return <li key={`trenner-${i}`} className="web-rang__trenner" aria-hidden="true">…</li>;
        }
        const eigen = z.isCurrentUser || z.id === konfiId;
        const rang = z.actualRank ?? z.rank ?? 0;
        return (
          <li key={z.id} className={`web-rang__zeile${eigen ? ' web-rang__zeile--eigen' : ''}${z.isNeighbor ? ' web-rang__zeile--nachbar' : ''}`}>
            <span className={`web-rang__platz web-rang__platz--${rang >= 1 && rang <= 3 ? rang : 'n'}`}>{rang}</span>
            <span className="web-rang__initialen" aria-hidden="true">
              {z.isNeighbor ? <IonIcon icon={ICON_GRUPPE_GEFUELLT} /> : z.initials}
            </span>
            <span className="web-rang__name">
              {z.display_name}
              {eigen && <WebPill ton="info">Du</WebPill>}
            </span>
            <span className="web-rang__punkte">
              {z.points === null || z.points === undefined ? `Platz ${z.actualRank}` : punkteText(z.points)}
            </span>
          </li>
        );
      })}
    </ol>
  </WebKarte>
);

// --- Hinweis auf den Rückblick ---------------------------------------------

export interface WebRueckblickHinweisProps {
  titel: string;
  text: string;
  onOeffnen: () => void;
  onAusblenden: () => void;
}

/** Der Rückblick meldet sich als farbige Karte; Ansehen und Ausblenden sind zwei getrennte Knöpfe. */
export const WebRueckblickHinweis: React.FC<WebRueckblickHinweisProps> = ({ titel, text, onOeffnen, onAusblenden }) => (
  <section className="web-rueckblick" aria-label="Rückblick">
    <IonIcon icon={ICON_FUNKELN_GEFUELLT} className="web-rueckblick__symbol" aria-hidden="true" />
    <div className="web-rueckblick__text">
      <h2 className="web-rueckblick__titel">{titel}</h2>
      <p className="web-rueckblick__beschreibung">{text}</p>
    </div>
    <div className="web-rueckblick__aktionen">
      <button type="button" className="web-rueckblick__knopf" onClick={onOeffnen}>Rückblick ansehen</button>
      <button type="button" className="web-rueckblick__knopf web-rueckblick__knopf--leise" onClick={onAusblenden}>Hinweis ausblenden</button>
    </div>
  </section>
);

// --- Zertifikate (Team) ------------------------------------------------------

export interface StartZertifikat {
  id: number;
  name: string;
  icon: string;
  status: 'valid' | 'expired' | 'not_earned';
  issued_date: string | null;
  expiry_date: string | null;
}

export interface WebZertifikateKarteProps {
  zertifikate: StartZertifikat[];
  symbol: (name: string) => string;
}

export const WebZertifikateKarte: React.FC<WebZertifikateKarteProps> = ({ zertifikate, symbol }) => {
  const abgelaufen = zertifikate.some((z) => z.status === 'expired');
  const gueltig = zertifikate.filter((z) => z.status === 'valid').length;
  return (
    <WebKarte
      titel="Deine Zertifikate"
      untertitel={abgelaufen ? `${gueltig} von ${zertifikate.length} gültig` : `${zertifikate.length} erhalten`}
    >
      <ul className="web-zertifikate" aria-label="Zertifikate">
        {zertifikate.map((z) => (
          <li key={z.id} className="web-zertifikat">
            <span className={`web-start-symbol ${z.status === 'valid' ? 'web-start-symbol--erfolg' : 'web-start-symbol--fehler'}`} aria-hidden="true">
              <IonIcon icon={symbol(z.icon)} />
            </span>
            <div className="web-zertifikat__text">
              <span className="web-zertifikat__name">{z.name}</span>
              <span className="web-zertifikat__meta">
                {z.status === 'valid' && z.issued_date ? `Seit ${datumKurz(z.issued_date)}` : null}
                {z.status === 'expired' ? 'Abgelaufen' : null}
                {z.status === 'valid' && z.expiry_date ? ` · gültig bis ${datumKurz(z.expiry_date)}` : null}
              </span>
            </div>
            <WebPill ton={z.status === 'valid' ? 'erfolg' : 'fehler'} punkt>{z.status === 'valid' ? 'Gültig' : 'Abgelaufen'}</WebPill>
          </li>
        ))}
      </ul>
    </WebKarte>
  );
};

