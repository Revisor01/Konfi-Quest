// Ein Beitrag zu einer Challenge als Karte im Raster der Web-Fassung: wer,
// wann, die Marken (Zustand, Sichtbarkeit), darunter Bild, Video oder
// Aufnahme gross, der Text, ein Musik-Link, bei einem ausgeblendeten
// Beitrag der Grund -- und im Fuss die Knoepfe der Moderation (Team und
// Leitung) bzw. nichts (Konfis).
//
// Eine Karte fuer Konfis, Team und Leitung: Was sie zeigt und welche Knoepfe
// im Fuss stehen, bestimmt die Seite (useChallengeLeitung bzw.
// useKonfiChallengeAnsicht), nicht die Karte.

import React, { useId } from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_TEXTDOKUMENT } from '../../icons';
import ChallengeMedium from '../../ChallengeMedium';
import MusikLink from '../../MusikLink';
import { MEDIA_ICON } from '../../../admin/views/useChallengeLeitung';
import { istWebLink } from '../../../../utils/linkDisplay';
import type { ChallengeMediaType } from '../../../../types/challenges';
import '../../../../theme/web/challenges.css';

export interface WebBeitragProps {
  /** Wer eingereicht hat ("Anonym", wenn der Server keinen Namen liefert). */
  name: string;
  /** "Jahrgang 2026 · 03.10.2026, 18:00". */
  wann: string;
  mediaType: ChallengeMediaType;
  /** Der Beitrag gehoert der angemeldeten Person. */
  eigen?: boolean;
  ausgeblendet?: boolean;
  text?: string | null;
  link?: { link_url?: string | null; link_title?: string | null; link_author?: string | null; link_album?: string | null };
  datei?: { filePath: string; fileName?: string | null };
  /** Foto antippen: oeffnen (nativ oder im Betrachter). */
  onOeffnen?: (filePath: string, fileName: string) => void;
  /** Begruendung der Leitung beim Ausblenden. */
  grund?: string | null;
  /** Marken neben dem Namen (Zustand, Einwilligung). */
  marken?: React.ReactNode;
  /** Knoepfe unten. */
  fuss?: React.ReactNode;
}

const WebBeitrag: React.FC<WebBeitragProps> = ({
  name, wann, mediaType, eigen = false, ausgeblendet = false, text, link, datei, onOeffnen, grund, marken, fuss,
}) => {
  const nameId = useId();
  const klassen = ['web-beitrag', eigen ? 'web-beitrag--eigen' : '', ausgeblendet ? 'web-beitrag--ausgeblendet' : ''].filter(Boolean).join(' ');
  return (
    <li className="web-beitraege__eintrag">
      <article className={klassen} aria-labelledby={nameId}>
        <header className="web-beitrag__kopf">
          <span className="web-beitrag__symbol">
            <IonIcon icon={MEDIA_ICON[mediaType] || ICON_TEXTDOKUMENT} aria-hidden="true" />
          </span>
          <div className="web-beitrag__wer">
            <span id={nameId} className="web-beitrag__name">{name}</span>
            {eigen && <span className="web-beitrag__eigen">Dein Beitrag</span>}
            <span className="web-beitrag__wann">{wann}</span>
          </div>
        </header>

        {marken && <div className="web-beitrag__marken">{marken}</div>}

        {datei && (mediaType === 'photo' || mediaType === 'audio' || mediaType === 'video') && (
          <div className="web-beitrag__medium">
            <ChallengeMedium filePath={datei.filePath} fileName={datei.fileName} mediaType={mediaType} maxHoehe={420} onOeffnen={onOeffnen} />
          </div>
        )}

        {text && <p className="web-beitrag__text">{text}</p>}

        {/* Nur http/https (istWebLink): Die Adresse stammt aus einer fremden Einreichung. */}
        {mediaType === 'link' && link && istWebLink(link.link_url) && <MusikLink submission={link} />}

        {ausgeblendet && grund && (
          <p className="web-beitrag__grund">
            <span className="web-beitrag__grund-label">Grund der Ablehnung</span>
            {grund}
          </p>
        )}

        {fuss && <footer className="web-beitrag__fuss">{fuss}</footer>}
      </article>
    </li>
  );
};

export default WebBeitrag;
