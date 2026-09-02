import React from 'react';
import { hintergrundFuer, zweitbildFuer } from './hintergrundbilder';

interface Props {
  /** Schlüssel der Kachel, z. B. 'intro' oder 'highlight'. */
  kachel: string;
  /**
   * Der Farbverlauf der Seite als CSS-Wert. Er wird als halbtransparenter
   * Schleier über die Bilder gelegt, damit der Text lesbar bleibt und die
   * Fotos farblich zur Seite gehören.
   */
  verlauf: string;
}

/**
 * Der bebilderte Hintergrund einer Rückblick-Seite.
 *
 * Technik aus Simons Entwurf (02.09.2026): Statt eines flächigen Fotos
 * liegen zwei weich maskierte, unscharfe Bildformen in gegenüberliegenden
 * Ecken und driften langsam. Darüber der Farbschleier der Seite und ein
 * Lichtfleck.
 *
 * Warum nicht flächig: Ein Vollbild-Foto zwingt zu einer harten Abdunklung,
 * sonst wird weißer Text auf hellen Stellen unlesbar -- und dann sieht man
 * vom Bild ohnehin nichts mehr. Als Form in der Ecke trägt es Textur, ohne
 * je hinter den Text zu geraten.
 *
 * Kacheln ohne zugeordnetes Motiv (Punkte, Abschluss) bekommen nur den
 * Verlauf: Dort trägt die große Zahl die Seite, ein Bild würde mit ihr um
 * dieselbe Aufmerksamkeit konkurrieren.
 */
const WrappedHintergrund: React.FC<Props> = ({ kachel, verlauf }) => {
  const bild = hintergrundFuer(kachel);
  const zweit = zweitbildFuer(kachel);

  return (
    <div className="wrapped-bg" aria-hidden="true">
      {/* Grundverlauf -- immer da, auch ohne Bild. */}
      <div style={{ position: 'absolute', inset: 0, background: verlauf }} />

      {bild && (
        <div
          className="wrapped-bg-form wrapped-bg-form--oben"
          style={{ backgroundImage: `url(${bild})` }}
        />
      )}
      {zweit && (
        <div
          className="wrapped-bg-form wrapped-bg-form--unten"
          style={{ backgroundImage: `url(${zweit})` }}
        />
      )}

      {/* Schleier in der Farbe der Seite. Ohne Bild wäre er überflüssig --
          er kostet nichts und hält die Seiten optisch gleich. */}
      <div
        className="wrapped-bg-schleier"
        style={{ background: verlauf, opacity: bild ? 0.86 : 0 }}
      />
      <div className="wrapped-bg-licht" />
    </div>
  );
};

export default WrappedHintergrund;
