// Eine Challenge als Karte im Raster der Web-Fassung (Browser ab 992 px),
// gebaut auf der einen Kachel aller Bereiche (components/web/WebBildKarte):
// oben das "Bild" -- der Stempel der Challenge gross auf einem Verlauf, mit
// der roten Zahl der neuen Beitraege -- darunter Status, Titel, Aufgabe in
// drei Zeilen und die Angaben (Zeitraum, Zielgruppe, Beitraege). Die ganze
// Karte ist ein echter Link auf die Seite der Challenge (Mittelklick und
// Strg-Klick oeffnen einen neuen Tab); Knoepfe im Fuss liegen darueber.
//
// Dieselbe Karte fuer Konfis, Team und Leitung: Sie liest nur, was da ist.
// Was jemand sieht und tut, entscheiden die Seiten, die sie fuellen --
// und der Server (backend/utils/challengeLeitungSicht.js).

import React from 'react';
import {
  ICON_ALBEN,
  ICON_GRUPPE,
  ICON_PERSON,
  ICON_TERMIN,
} from '../../icons';
import WebBildKarte from '../../../web/WebBildKarte';
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
  const autor = getAuthorLabel(challenge as Parameters<typeof getAuthorLabel>[0]) ?? challenge.author_name?.trim() ?? null;
  const zielgruppe = challenge.audience ? AUDIENCE_LABEL[challenge.audience] : undefined;
  const jahrgaenge = challenge.jahrgaenge ?? [];
  const rest = status === 'active' ? restzeitText(formatRemaining(challenge.ends_at)) : '';
  const modifikator = STATUS_MODIFIKATOR[status];

  return (
    <li className="web-challenge-raster__eintrag">
      <WebBildKarte
        akzent={modifikator === 'geplant' ? 'var(--app-color-info)' : 'var(--app-color-challenges)'}
        akzentDunkel="var(--app-color-challenges-dunkel)"
        gedaempft={modifikator === 'entwurf' || modifikator === 'beendet'}
        klasse={`web-challenge-karte--${modifikator}`}
        symbol={<WebChallengeSymbol icon={getChallengeBadgeIcon(challenge.badge_icon)} kugel={kugel} />}
        label="Stempel"
        name={challenge.badge_name}
        marken={(
          <>
            <WebPill ton={STATUS_TON[status]} punkt>{STATUS_WORT[status]}</WebPill>
            {wartend > 0 && <WebPill ton="warnung" title={wartenAufFreigabe(wartend)}>{wartenAufFreigabe(wartend)}</WebPill>}
            {eingereicht && <WebEingereichtPill />}
          </>
        )}
        titel={<WebTreffer text={challenge.title} suche={suche} />}
        href={href}
        text={challenge.description || undefined}
        angaben={[
          { icon: ICON_TERMIN, inhalt: [zeitraumText(challenge, status), rest].filter(Boolean).join(' · ') },
          mitBeitraegen && {
            icon: ICON_ALBEN,
            inhalt: `${anzahlBeitraege(challenge.submission_count ?? 0)} · ${VISIBILITY_LABEL[challenge.visibility] ?? challenge.visibility}`,
          },
          (zielgruppe || jahrgaenge.length > 0) && {
            icon: ICON_GRUPPE,
            inhalt: [zielgruppe, jahrgangText(jahrgaenge)].filter(Boolean).join(' · '),
            titel: jahrgaenge.map((j) => j.name).join(', ') || undefined,
          },
          autor && { icon: ICON_PERSON, inhalt: `Gestellt von ${autor}` },
        ]}
        fuss={fuss}
      />
    </li>
  );
};

export default WebChallengeKarte;
