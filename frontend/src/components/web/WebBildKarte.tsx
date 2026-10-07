// Die eine Kachel der Web-Fassung (Ansicht "Kacheln"): oben ein farbiger
// Kopf mit Symbol, kleiner Beschriftung und Namen, darunter Marken, Titel als
// Link, ein Text, die Angaben mit Symbolen und im Fuss die Knoepfe.
//
// Vorbild war die Challenge-Karte; Konfis, Team und Events stehen seit dem
// 07.10.2026 auf demselben Baustein (Simon: „die kacheln mögen bitte bei
// konfis und bei [events] von der struktur so sein wie bei challanges.
// schicker header, details, buttons"). Wo etwas steht, entscheidet dieser
// Baustein; die Seiten reichen nur Inhalte herein.
//
// Der Titel ist ein echter Link (Mittelklick, Strg-Klick); er legt sich ueber
// die ganze Karte (web-link--zeile), die Knoepfe im Fuss und in der Ecke
// liegen darueber.

import React, { useId } from 'react';
import { IonIcon } from '@ionic/react';
import WebLink from './WebLink';

export interface WebBildKarteAngabe {
  icon: string;
  inhalt: React.ReactNode;
  /** Farbe des Symbols (Token); sonst die Farbe der Karte. */
  farbe?: string;
  /** Langer Text zum Darueberfahren (z. B. alle Jahrgaenge). */
  titel?: string;
}

export interface WebBildKarteProps {
  /** Farbe des Kopfes (Token, z. B. var(--app-color-konfis)) und die dunklere Seite des Verlaufs. */
  akzent: string;
  akzentDunkel?: string;
  /** Der Kreis im Kopf: WebBildKarteSymbol oder ein eigener (Challenge mit roter Zahl). */
  symbol: React.ReactNode;
  /** Kleine Beschriftung im Kopf ("Stempel", "Konfi", "Event"). */
  label: string;
  /** Gross im Kopf; entfaellt bei `titelImKopf`. */
  name?: React.ReactNode;
  /** Der Titel steht gross im Kopf statt im Inhalt (Events, Simon 07.10.2026). */
  titelImKopf?: boolean;
  /** Marken ueber dem Titel (Status). */
  marken?: React.ReactNode;
  titel: React.ReactNode;
  /** Ziel des Titels als Link ... */
  href?: string;
  /** ... oder ein Klick (Aktivitaeten haben keine eigene Seite, sie oeffnen das Bearbeiten-Fenster). */
  onTitel?: () => void;
  /** Name des Knopfs fuer Vorleseprogramme, wenn `onTitel` gesetzt ist. */
  titelBeschriftung?: string;
  /** Unter dem Titel, leise (Benutzername, Jahrgaenge). */
  unterzeile?: React.ReactNode;
  /** Ein Absatz Text, hoechstens drei Zeilen. */
  text?: React.ReactNode;
  /** Was zwischen Text und Angaben steht (Punktebalken). */
  children?: React.ReactNode;
  angaben?: ReadonlyArray<WebBildKarteAngabe | false | null | undefined | 0 | ''>;
  /** Knoepfe im Fuss. */
  fuss?: React.ReactNode;
  /** Vorbei, beendet: Kopf grau, Titel leise. */
  gedaempft?: boolean;
  /** Zusaetzliche Klasse am <article> (Zustand fuer Tests und Seiten). */
  klasse?: string;
  /** Inline-Stil am <article> (z. B. die Statusfarbe eines Events). */
  stil?: React.CSSProperties;
  /** Inline-Stil an der Ueberschrift (abgesagt: durchgestrichen). */
  titelStil?: React.CSSProperties;
}

/** Der Kreis im Kopf: ein Symbol oder Initialen auf dem Verlauf. */
export const WebBildKarteSymbol: React.FC<{ icon?: string; text?: string }> = ({ icon, text }) => (
  <span className="web-bildkarte__symbol" aria-hidden="true">
    {icon ? <IonIcon icon={icon} /> : <span className="web-bildkarte__initialen">{text}</span>}
  </span>
);

const WebBildKarte: React.FC<WebBildKarteProps> = ({
  akzent, akzentDunkel, symbol, label, name, titelImKopf = false, marken, titel, href, onTitel, titelBeschriftung, unterzeile, text, children,
  angaben = [], fuss, gedaempft = false, klasse, stil, titelStil,
}) => {
  const titelId = useId();
  const sichtbar = angaben.filter((a): a is WebBildKarteAngabe => Boolean(a));
  const titelZeile = (
    <h3 id={titelId} className={titelImKopf ? 'web-bildkarte__name web-bildkarte__name--titel' : 'web-bildkarte__titel'} style={titelStil}>
      {href ? (
        <WebLink href={href} className="web-link--zeile web-link--text">{titel}</WebLink>
      ) : onTitel ? (
        <button type="button" className="web-link web-link--zeile web-link--text web-link--knopf" aria-label={titelBeschriftung} onClick={onTitel}>
          {titel}
        </button>
      ) : titel}
    </h3>
  );
  const farben = {
    '--web-bildkarte-akzent': akzent,
    '--web-bildkarte-akzent-dunkel': akzentDunkel ?? akzent,
    ...stil,
  } as React.CSSProperties;
  return (
    <article
      className={['web-zeile', 'web-bildkarte', gedaempft ? 'web-bildkarte--gedaempft' : '', klasse ?? ''].filter(Boolean).join(' ')}
      style={farben}
      aria-labelledby={titelId}
    >
      <div className="web-bildkarte__kopf">
        {symbol}
        <span className="web-bildkarte__kopftext">
          <span className="web-bildkarte__label">{label}</span>
          {titelImKopf ? titelZeile : <span className="web-bildkarte__name">{name}</span>}
        </span>
      </div>

      <div className="web-bildkarte__inhalt">
        {marken && <div className="web-bildkarte__marken">{marken}</div>}
        {!titelImKopf && titelZeile}
        {unterzeile && <p className="web-bildkarte__unterzeile">{unterzeile}</p>}
        {text && <p className="web-bildkarte__text">{text}</p>}
        {children}
        {sichtbar.length > 0 && (
          <ul className="web-bildkarte__angaben" aria-label="Angaben">
            {sichtbar.map((a, i) => (
              <li key={i} className="web-bildkarte__angabe" title={a.titel}>
                <IonIcon
                  icon={a.icon}
                  className="web-bildkarte__icon"
                  style={a.farbe ? { color: a.farbe } : undefined}
                  aria-hidden="true"
                />
                <span>{a.inhalt}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {fuss && <footer className="web-bildkarte__fuss">{fuss}</footer>}
    </article>
  );
};

export default WebBildKarte;
