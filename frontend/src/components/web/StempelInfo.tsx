// Die Info zu einem Stempel in der Web-Fassung (WebAuszeichnungen): der
// Inhalt des Stempel-Popovers der App, dazu bei einem aufbewahrten Stempel
// der Satz, dass es die Challenge nicht mehr gibt -- das Popover der App
// kennt diesen Fall nicht, die Web-Fassung nannte ihn schon vorher.

import React from 'react';
import StempelPopoverContent from '../shared/StempelPopoverContent';
import type { ChallengeMark, OffenerStempel } from '../../types/challenges';

const StempelInfo: React.FC<{ stempel: ChallengeMark | OffenerStempel; offen?: boolean }> = ({ stempel, offen = false }) => (
  <>
    <StempelPopoverContent dataRef={{ current: { stempel, erhalten: !offen } }} />
    {!offen && (stempel as ChallengeMark).bewahrt && (
      <span className="web-infotipp__zusatz">Die Challenge gibt es nicht mehr.</span>
    )}
  </>
);

export default StempelInfo;
