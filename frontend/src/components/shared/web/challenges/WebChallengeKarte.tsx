// Eine Challenge als Karte im Raster der Web-Fassung (Browser ab 992 px):
// oben das "Bild" -- der Stempel der Challenge gross auf einem Verlauf, mit
// der roten Zahl der neuen Beitraege -- darunter Status, Titel, Aufgabe in
// drei Zeilen und die Angaben (Zeitraum, Zielgruppe, Beitraege). Die ganze
// Karte ist ein echter Link auf die Seite der Challenge (Mittelklick und
// Strg-Klick oeffnen einen neuen Tab); Knoepfe im Fuss liegen darueber.
//
// Dieselbe Karte fuer Konfis, Team und Leitung: Sie liest nur, was da ist.
// Was jemand sieht und tut, entscheiden die Seiten, die sie fuellen --
// und der Server (backend/utils/challengeLeitungSicht.js).

import React, { useId } from 'react';
import { IonIcon } from '@ionic/react';
import {
  ICON_ALBEN,
  ICON_GRUPPE,
  ICON_PERSON,
  ICON_TERMIN,
} from '../../icons';
import WebLink from '../../../web/WebLink';
import WebPill from '../../../web/WebPill';
import WebTreffer from '../../../web/WebTreffer';
import { WebChallengeSymbol, WebEingereichtPill } from './WebChallengeBausteine';
import { AUDIENCE_LABEL, VISIBILITY_LABEL } from '../../../admin/views/ChallengesManageView';
import { formatRemaining, getAuthorLabel, getChallengeBadgeIcon } from '../../../konfi/views/ChallengesView';
import { anzahlBeitraege, wartenAufFreigabe } from '../../../../utils/challengeTexte';
import {
  STATUS_MODIFIKATOR,
  STATUS_TON,
  STATUS_WORT,
  jahrgangText,
  restzeitText,
  zeitraumText,
  type ListenChallenge,
} from '../../../../utils/challengesWeb';
import type { ChallengeStatus } from '../../../../types/challenges';
import '../../../../theme/web/challenges.css';

export interface WebChallengeKarteProps {
  challenge: ListenChallenge;
  status: ChallengeStatus;
  /** Die Seite der Challenge (/<rolle>/challenges/<id>). */
  href: string;
  /** Suchbegriff, im Titel hervorgehoben. */
  suche?: string;
  /** Die rote Zahl: neue Beitraege seit dem letzten Oeffnen. */
  kugel?: { anzahl: number; text: string };
  /** Beitraege, die auf Freigabe warten (nur Team und Leitung). */
  wartend?: number;
  /** Du hast schon eingereicht. */
  eingereicht?: boolean;
  /** Team und Leitung: Zahl der Beitraege und Sichtbarkeit zeigen. */
  mitBeitraegen?: boolean;
  /** Knoepfe im Fuss (Bearbeiten, Loeschen). */
  fuss?: React.ReactNode;
}

const WebChallengeKarte: React.FC<WebChallengeKarteProps> = ({
  challenge,
  status,
  href,
  suche = '',
  kugel,
  wartend = 0,
  eingereicht = false,
  mitBeitraegen = false,
  fuss,
}) => {
  const titelId = useId();
  const autor = getAuthorLabel(challenge as Parameters<typeof getAuthorLabel>[0]) ?? challenge.author_name?.trim() ?? null;
  const zielgruppe = challenge.audience ? AUDIENCE_LABEL[challenge.audience] : undefined;
  const jahrgaenge = challenge.jahrgaenge ?? [];
  const rest = status === 'active' ? restzeitText(formatRemaining(challenge.ends_at)) : '';

  return (
    <li className="web-challenge-raster__eintrag">
      <article className={`web-zeile web-challenge-karte web-challenge-karte--${STATUS_MODIFIKATOR[status]}`} aria-labelledby={titelId}>
        <div className="web-challenge-karte__bild">
          <WebChallengeSymbol icon={getChallengeBadgeIcon(challenge.badge_icon)} kugel={kugel} />
          <span className="web-challenge-karte__stempel">
            <span className="web-challenge-karte__stempel-label">Stempel</span>
            <span className="web-challenge-karte__stempel-name">{challenge.badge_name}</span>
          </span>
        </div>

        <div className="web-challenge-karte__inhalt">
          <div className="web-challenge-karte__marken">
            <WebPill ton={STATUS_TON[status]} punkt>{STATUS_WORT[status]}</WebPill>
            {wartend > 0 && <WebPill ton="warnung" title={wartenAufFreigabe(wartend)}>{wartenAufFreigabe(wartend)}</WebPill>}
            {eingereicht && <WebEingereichtPill />}
          </div>

          <h3 id={titelId} className="web-challenge-karte__titel">
            <WebLink href={href} className="web-link--zeile web-link--text">
              <WebTreffer text={challenge.title} suche={suche} />
            </WebLink>
          </h3>
          {challenge.description && <p className="web-challenge-karte__text">{challenge.description}</p>}

          <ul className="web-challenge-karte__meta" aria-label="Angaben">
            <li className="web-challenge-karte__meta-eintrag">
              <IonIcon icon={ICON_TERMIN} className="web-challenge-icon" aria-hidden="true" />
              <span>{[zeitraumText(challenge, status), rest].filter(Boolean).join(' · ')}</span>
            </li>
            {mitBeitraegen && (
              <li className="web-challenge-karte__meta-eintrag">
                <IonIcon icon={ICON_ALBEN} className="web-challenge-icon" aria-hidden="true" />
                <span>{anzahlBeitraege(challenge.submission_count ?? 0)} · {VISIBILITY_LABEL[challenge.visibility] ?? challenge.visibility}</span>
              </li>
            )}
            {(zielgruppe || jahrgaenge.length > 0) && (
              <li className="web-challenge-karte__meta-eintrag" title={jahrgaenge.map((j) => j.name).join(', ') || undefined}>
                <IonIcon icon={ICON_GRUPPE} className="web-challenge-icon" aria-hidden="true" />
                <span>{[zielgruppe, jahrgangText(jahrgaenge)].filter(Boolean).join(' · ')}</span>
              </li>
            )}
            {autor && (
              <li className="web-challenge-karte__meta-eintrag">
                <IonIcon icon={ICON_PERSON} className="web-challenge-icon" aria-hidden="true" />
                <span>Gestellt von {autor}</span>
              </li>
            )}
          </ul>
        </div>

        {fuss && <footer className="web-challenge-karte__fuss">{fuss}</footer>}
      </article>
    </li>
  );
};

export default WebChallengeKarte;
