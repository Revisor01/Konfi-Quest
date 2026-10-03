// Knoepfe der Web-Fassung: primaer, sekundaer (Vorgabe), Text, Gefahr.
// Mit `href` ein Link im Aussehen eines Knopfes, sonst ein <button>.

import React from 'react';
import WebLink from './WebLink';

export interface WebKnopfProps {
  children: React.ReactNode;
  art?: 'primaer' | 'sekundaer' | 'text' | 'gefahr';
  klein?: boolean;
  /** Nur ein Symbol: dann ist `aria-label` Pflicht. */
  symbol?: boolean;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  'aria-label'?: string;
  /** Liegt in einer Zeile ueber deren Link. */
  vorn?: boolean;
}

const WebKnopf: React.FC<WebKnopfProps> = ({
  children, art = 'sekundaer', klein = false, symbol = false, href, onClick, disabled, title, 'aria-label': ariaLabel, vorn = false,
}) => {
  const klassen = [
    'web-knopf',
    art === 'primaer' ? 'web-knopf--primaer' : '',
    art === 'text' ? 'web-knopf--text' : '',
    art === 'gefahr' ? 'web-knopf--gefahr' : '',
    klein ? 'web-knopf--klein' : '',
    symbol ? 'web-knopf--symbol' : '',
  ].filter(Boolean).join(' ');
  if (href) {
    return <WebLink href={href} className={klassen} title={title} aria-label={ariaLabel} vorn={vorn}>{children}</WebLink>;
  }
  return (
    <button
      type="button"
      className={`${klassen}${vorn ? ' web-vorn' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
};

export default WebKnopf;
