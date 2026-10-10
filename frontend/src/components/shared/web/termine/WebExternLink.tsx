// Ein Link auf eine fremde Seite (Karte) in der Web-Fassung von Mitmachen:
// ueber die Huelle der App, damit die App-Sperre nicht ausloest.

import React from 'react';
import { linkOeffnen } from '../../../../services/systemDialoge';

/** Ein Link auf eine fremde Seite (Karte): ueber die Huelle der App, damit die App-Sperre nicht ausloest. */
const WebExternLink: React.FC<{ href: string; children: React.ReactNode; title?: string }> = ({ href, children, title }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="web-link"
    title={title}
    onClick={(e) => { e.preventDefault(); linkOeffnen(href); }}
  >
    {children}
  </a>
);

export default WebExternLink;
