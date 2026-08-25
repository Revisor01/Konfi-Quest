import React from 'react';
import { IonIcon } from '@ionic/react';
import { chevronForwardOutline, closeOutline, flagOutline } from 'ionicons/icons';

interface ChallengesHinweisKarteProps {
  /** Öffnet den Challenges-Bereich. */
  onOpen: () => void;
  /**
   * X gedrückt: Hinweis dauerhaft ausblenden. Fehlt der Wert, wird kein X
   * gerendert — dann steht ein Pfeil da, wie bei den anderen Hinweisen.
   */
  onDismiss?: () => void;
  /** Untertitel; je Rolle unterschiedlich, weil Leitung und Konfis
   *  Verschiedenes im Challenges-Bereich tun. */
  untertitel: string;
  style?: React.CSSProperties;
}

// Einstieg in den Challenges-Bereich, in der Form der uebrigen Hinweise
// (.app-whatsnew, siehe Theme) statt als weisse Listenzeile.
//
// Warum als gemeinsame Komponente: Die Karte gab es nur im Teamer-Dashboard,
// dort handgebaut aus app-list-item plus Inline-Styles — also in einem anderen
// Look als "Was ist neu?" und der Mitmachen-Hinweis, die direkt daneben
// stehen. Jede Rolle hat einen eigenen Komponentenbaum (siehe CLAUDE.md);
// genau daran ist der Look auseinandergelaufen. Eine Komponente fuer alle
// drei Baeume verhindert, dass das noch einmal passiert.
const ChallengesHinweisKarte: React.FC<ChallengesHinweisKarteProps> = ({
  onOpen,
  onDismiss,
  untertitel,
  style,
}) => (
  <div
    className="app-whatsnew app-whatsnew--challenges"
    role="button"
    tabIndex={0}
    style={style}
    aria-label={`Challenges: ${untertitel}`}
    onClick={onOpen}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onOpen();
      }
    }}
  >
    <IonIcon icon={flagOutline} className="app-whatsnew__icon" aria-hidden="true" />
    <div className="app-whatsnew__text">
      <span className="app-whatsnew__title">Challenges</span>
      <span className="app-whatsnew__sub">{untertitel}</span>
    </div>
    {onDismiss ? (
      <button
        type="button"
        className="app-whatsnew__close"
        aria-label="Hinweis ausblenden"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
      >
        <IonIcon icon={closeOutline} aria-hidden="true" />
      </button>
    ) : (
      <IonIcon icon={chevronForwardOutline} className="app-whatsnew__chevron" aria-hidden="true" />
    )}
  </div>
);

export default ChallengesHinweisKarte;
