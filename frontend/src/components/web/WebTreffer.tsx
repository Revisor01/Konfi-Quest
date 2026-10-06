// Einen Text mit hervorgehobenem Suchbegriff setzen: Treffer als <mark>, der
// Rest bleibt Text. Dieselbe Vergleichsform wie die Suche (Umlaute als
// Umschreibung), damit hervorgehoben wird, was gefunden wurde.

import React from 'react';
import { suchSegmente } from '../../utils/supportWeb';

const WebTreffer: React.FC<{ text: string; suche: string }> = ({ text, suche }) => (
  <>
    {suchSegmente(text, suche).map((s, i) => (s.treffer
      ? <mark key={i} className="web-treffer">{s.text}</mark>
      : <React.Fragment key={i}>{s.text}</React.Fragment>))}
  </>
);

export default WebTreffer;
