// Die Werkzeugleiste der Challenge-Listen in der Web-Fassung: Chips mit
// Zahl (laufend, geplant, beendet, alle -- fuer Team und Leitung dazu "Wartet
// auf Freigabe"), die Suche, darunter Zielgruppe und Jahrgang. Die Chips
// tragen die Zahl dessen, was unter ihnen steht; die orange Zahl heisst wie
// am Reiter der App: so viele Challenges haben Beitraege, die auf Freigabe
// warten.
//
// Reihen, die nichts zu waehlen haetten (nur eine Zielgruppe, nur ein
// Jahrgang), blendet die Seite gar nicht erst ein.

import React, { useId } from 'react';
import WebSuche from '../../../web/WebSuche';
import WebChallengeChips from './WebChallengeChips';
import WebAuswahl from '../../../web/WebAuswahl';
import { AUDIENCE_LABEL } from '../../../admin/views/ChallengesManageView';
import { FILTER_TEXT, type ListenFilter } from '../../../../utils/challengesWeb';
import type { ChallengeAudience, ChallengeJahrgang } from '../../../../types/challenges';
import '../../../../theme/web/challenges.css';

export interface WebChallengeChip {
  wert: ListenFilter;
  zahl: number;
  /** Farbe der Zahl: orange fuer Wartendes (wie am Reiter der App). */
  ton?: 'orange';
  /** Satz fuer Vorleseprogramme hinter der Zahl ("mit wartenden Beiträgen"). */
  zahlText?: string;
}

export interface WebChallengeFilterProps {
  chips: ReadonlyArray<WebChallengeChip>;
  filter: ListenFilter;
  onFilter: (filter: ListenFilter) => void;
  suche: string;
  onSuche: (suche: string) => void;
  /** Die Zielgruppen, die in der Liste vorkommen; unter zwei entfaellt die Reihe. */
  zielgruppen?: readonly ChallengeAudience[];
  zielgruppe?: ChallengeAudience | 'alle';
  onZielgruppe?: (zielgruppe: ChallengeAudience | 'alle') => void;
  /** Die Jahrgaenge, die in der Liste vorkommen; unter zwei entfaellt die Auswahl. */
  jahrgaenge?: readonly ChallengeJahrgang[];
  jahrgang?: string;
  onJahrgang?: (jahrgang: string) => void;
}

const WebChallengeFilter: React.FC<WebChallengeFilterProps> = ({
  chips,
  filter,
  onFilter,
  suche,
  onSuche,
  zielgruppen = [],
  zielgruppe = 'alle',
  onZielgruppe,
  jahrgaenge = [],
  jahrgang = 'alle',
  onJahrgang,
}) => {
  const zielgruppeId = useId();
  const zeigeZielgruppe = zielgruppen.length > 1 && !!onZielgruppe;
  const zeigeJahrgang = jahrgaenge.length > 1 && !!onJahrgang;
  const wahl: Array<ChallengeAudience | 'alle'> = ['alle', ...zielgruppen];

  return (
    <div className="web-challenge-filter">
      <div className="web-challenge-filter__zeile">
        <WebChallengeChips<ListenFilter>
          beschriftung="Challenges nach Zustand"
          wert={filter}
          onWert={onFilter}
          chips={chips.map((c) => ({ wert: c.wert, label: FILTER_TEXT[c.wert], zahl: c.zahl, ton: c.ton, zahlText: c.zahlText }))}
        />
        <div className="web-werkzeuge__rechts">
          <WebSuche beschriftung="Challenges durchsuchen" platzhalter="Challenges suchen" wert={suche} onWert={onSuche} />
        </div>
      </div>

      {(zeigeZielgruppe || zeigeJahrgang) && (
        <div className="web-challenge-filter__zeile web-challenge-filter__zeile--unten">
          {zeigeZielgruppe && (
            <div className="web-feld">
              <span className="web-feld__label" id={zielgruppeId}>Zielgruppe</span>
              <div className="web-chips" role="group" aria-labelledby={zielgruppeId}>
                {wahl.map((w) => (
                  <button key={w} type="button" className="web-chip" aria-pressed={w === zielgruppe} onClick={() => onZielgruppe?.(w)}>
                    {w === 'alle' ? 'Alle' : AUDIENCE_LABEL[w]}
                  </button>
                ))}
              </div>
            </div>
          )}
          {zeigeJahrgang && (
            <div className="web-challenge-filter__auswahl">
              <WebAuswahl
                label="Jahrgang"
                wert={jahrgang}
                onWert={(w) => onJahrgang?.(w)}
                optionen={[{ wert: 'alle', label: 'Alle Jahrgänge' }, ...jahrgaenge.map((j) => ({ wert: String(j.id), label: j.name }))]}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WebChallengeFilter;
