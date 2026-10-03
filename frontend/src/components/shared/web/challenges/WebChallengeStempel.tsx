// Die Challenge-Stempel einer Person in der Web-Fassung: eine Karte mit
// einem Raster aus Kacheln -- erhaltene in der Farbe der Challenges, noch
// nicht erhaltene grau. Was in der App erst ein Antippen (Popover) zeigt,
// steht hier auf der Kachel: Stempel, Challenge, "Erhalten am" bzw. was zu
// tun ist. Die Kachel fuehrt zur Challenge, solange es sie gibt.
//
// Wie in der App ohne Zaehler und ohne Fortschritt: ein Stempel belegt, dass
// jemand dabei war, er ist keine Sammelmenge. Die Karte entfaellt, wenn es
// weder erhaltene noch offene Stempel gibt -- ausser die Seite gibt einen
// Text fuer den leeren Zustand mit (`leer`): Wie in der App steht die Karte
// dann trotzdem da, damit man sieht, dass es Stempel ueberhaupt gibt.

import React, { useId } from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_ABZEICHEN, ICON_CHALLENGE_GEFUELLT } from '../../icons';
import WebLink from '../../../web/WebLink';
import WebKarte from '../../../web/WebKarte';
import { WebLeer } from '../../../web/WebZustaende';
import { offenerHinweis } from '../../StempelPopoverContent';
import { getIconFromString } from '../../../../utils/badgeIcons';
import { datumKurz } from '../../../../utils/dateUtils';
import type { ChallengeMark, OffenerStempel } from '../../../../types/challenges';
import '../../../../theme/web/challenges.css';

export interface WebChallengeStempelProps {
  marks: ChallengeMark[];
  offeneStempel?: OffenerStempel[];
  /** Liste der Rolle (/konfi/challenges): eine Kachel fuehrt darunter zur Challenge. */
  listenPfad: string;
  /** Ueberschrift; in der Ansicht auf eine ANDERE Person waere "Deine" falsch. */
  titel?: string;
  /** Satz fuer den leeren Zustand; ohne ihn entfaellt die Karte, wenn es nichts zu zeigen gibt. */
  leer?: string;
}

const WebChallengeStempel: React.FC<WebChallengeStempelProps> = ({ marks, offeneStempel = [], listenPfad, titel = 'Deine Stempel', leer }) => {
  const titelId = useId();
  if (marks.length === 0 && offeneStempel.length === 0) {
    return leer ? (
      <WebKarte titel={titel}>
        <WebLeer icon={ICON_ABZEICHEN} titel="Noch keine Stempel" text={leer} />
      </WebKarte>
    ) : null;
  }

  const untertitel = [
    marks.length > 0 ? `${marks.length} erhalten` : null,
    offeneStempel.length > 0 ? `${offeneStempel.length} noch zu holen` : null,
  ].filter(Boolean).join(' · ');

  return (
    <section className="web-karte" aria-labelledby={titelId}>
      <header className="web-karte__kopf">
        <div>
          <h2 id={titelId} className="web-karte__titel">{titel}</h2>
          <p className="web-karte__untertitel">{untertitel}</p>
        </div>
      </header>
      <div className="web-karte__inhalt">
        <ul className="web-stempel-raster">
          {marks.map((m) => (
            <li key={`erhalten-${m.challenge_id}`} className="web-stempel web-zeile">
              <span className="web-stempel__symbol">
                <IonIcon icon={getIconFromString(m.badge_icon, ICON_CHALLENGE_GEFUELLT)} aria-hidden="true" />
              </span>
              <span className="web-stempel__text">
                <span className="web-stempel__name" title={m.badge_name}>{m.badge_name}</span>
                {m.bewahrt ? (
                  <span className="web-stempel__titel" title={m.title}>{m.title}</span>
                ) : (
                  <WebLink href={`${listenPfad}/${m.challenge_id}`} className="web-link--zeile web-stempel__titel" title={m.title}>
                    {m.title}
                  </WebLink>
                )}
                <span className="web-stempel__zusatz">
                  {m.bewahrt ? 'Die Challenge gibt es nicht mehr' : m.earned_at ? `Erhalten am ${datumKurz(m.earned_at)}` : 'Erhalten'}
                </span>
              </span>
            </li>
          ))}
          {offeneStempel.map((o) => (
            <li key={`offen-${o.challenge_id}`} className="web-stempel web-stempel--offen web-zeile">
              <span className="web-stempel__symbol">
                <IonIcon icon={getIconFromString(o.badge_icon, ICON_CHALLENGE_GEFUELLT)} aria-hidden="true" />
              </span>
              <span className="web-stempel__text">
                <span className="web-stempel__name" title={o.badge_name}>{o.badge_name}</span>
                <WebLink href={`${listenPfad}/${o.challenge_id}`} className="web-link--zeile web-stempel__titel" title={o.title}>
                  {o.title}
                </WebLink>
                <span className="web-stempel__zusatz" title={offenerHinweis(o)}>
                  {o.status === 'ended' ? 'Challenge vorbei' : 'Noch zu holen'}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default WebChallengeStempel;
