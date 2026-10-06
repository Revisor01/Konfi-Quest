// Ein echter Link (<a href>) der Web-Fassung: Mittelklick und Strg-Klick
// oeffnen einen neuen Tab, Rechtsklick kopiert die Adresse, die Statuszeile
// zeigt das Ziel. Ein einfacher Klick bleibt in der App (useIonRouter), ohne
// die Seite neu zu laden -- dasselbe Muster wie `oeffne` in
// components/layout/Seitenleiste.tsx, nur fuer Links im Inhalt.

import React, { useCallback } from 'react';
import { useIonRouter } from '@ionic/react';

export interface WebLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
  'aria-label'?: string;
  /** Liegt in einer Zeile ueber deren Link (`web-link--zeile`), nicht darunter. */
  vorn?: boolean;
}

const WebLink: React.FC<WebLinkProps> = ({ href, children, className, title, 'aria-label': ariaLabel, vorn = false }) => {
  const router = useIonRouter();

  const oeffne = useCallback((ereignis: React.MouseEvent<HTMLAnchorElement>) => {
    // Neuer Tab, neues Fenster, Herunterladen: Das erledigt der Browser.
    if (ereignis.button !== 0 || ereignis.metaKey || ereignis.ctrlKey || ereignis.shiftKey || ereignis.altKey) return;
    ereignis.preventDefault();
    // Ohne Uebergangsanimation, wie ein Wechsel ueber die Leiste.
    router.push(href, 'none', 'push');
  }, [href, router]);

  const klassen = ['web-link', vorn ? 'web-vorn' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <a href={href} className={klassen} title={title} aria-label={ariaLabel} onClick={oeffne}>
      {children}
    </a>
  );
};

export default WebLink;
