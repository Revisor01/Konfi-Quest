import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_ABZEICHEN, ICON_HERZ, ICON_POKAL, ICON_TERMIN } from '../../shared/icons';
import type { SlideProps, KonfiWrappedData } from '../../../types/wrapped';
import SlideBase from './SlideBase';

interface AbschlussSlideProps extends SlideProps {
  data: KonfiWrappedData;
  year: number;
  /** Name der Ausgabe -- steht in der Ueberschrift statt "Konfi-Jahr {Jahr}". */
  titel?: string | null;
}

/**
 * Die Abschluss-Seite -- auf die Slogan-Gestaltung umgezogen (03.09.2026).
 *
 * Simons Botschaft "Dein Weg. Deine Zeit. Dein Glaube." (01.09.2026) bleibt
 * unveraendert -- sie ist der Schluss des Rueckblicks. Neu ist nur, dass sie
 * die Typo der uebrigen Seiten traegt: Sie IST der Slogan dieser Seite und
 * steht damit gross, statt als kleiner Nachsatz unter einer Statistikliste.
 *
 * Die drei Zahlen bleiben als Zeile darunter -- hier gehoert die Uebersicht
 * hin, das ist der Sinn der Seite.
 */
const AbschlussSlide: React.FC<AbschlussSlideProps> = ({ isActive, data, year: _year, titel }) => {
  // Siehe WrappedModal: `konfirmation` ist das echte Datum, `ende` nur der
  // Rueckfall fuer Alt-Snapshots ohne das Feld.
  const z = data.slides.zeitraum;
  const zeitraumEnde = z ? (('konfirmation' in z) ? (z.konfirmation || null) : (z.ende || null)) : null;

  const zahlen = [
    { icon: ICON_POKAL, wert: data.slides.punkte.total, label: 'Punkte' },
    { icon: ICON_TERMIN, wert: data.slides.events.total_attended, label: 'Termine' },
    { icon: ICON_ABZEICHEN, wert: data.slides.badges.total_earned, label: 'Abzeichen' },
  ];

  return (
    <SlideBase isActive={isActive} className="abschluss-slide" kachel="abschluss">
      {/* "Deine Konfi-Zeit" statt einer Jahreszahl (Simons Wortlaut,
          07.09.2026). Seit derselben Regel laeuft der Konfi-Rueckblick vom
          Anfang der Konfi-Zeit bis heute -- das koennen zwei Jahre sein, und
          dann ist "Dein Konfi-Jahr 2026" schlicht falsch. Ein gesetzter
          Titel gewinnt weiterhin (Muster aus IntroSlide). */}
      <div className="kat-auge">{titel?.trim() || 'Deine Konfi-Zeit'}</div>

      {/* Simons Botschaft traegt die Seite. */}
      <div className="kat-slogan">
        <span style={{ display: 'block' }}>Dein Weg.</span>
        <span style={{ display: 'block' }}>Deine Zeit.</span>
        <span style={{ display: 'block' }}>Dein Glaube.</span>
      </div>

      <div className="w-bilanz">
        {zahlen.map((s, i) => (
          <div key={i} className="w-bilanz__zeile">
            <IonIcon icon={s.icon} />
            <b>{s.wert}</b>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      {zeitraumEnde && (
        <div className="kat-fussnote">
          Konfirmation am {new Date(zeitraumEnde).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      )}

      {/* Einladend, nicht werbend -- es ist eine Kirchen-App. */}
      <div className="w-einladung">
        <IonIcon icon={ICON_HERZ} />
        <span>Werde Teamer:in und gestalte das nächste Jahr mit</span>
      </div>
    </SlideBase>
  );
};

export default AbschlussSlide;
