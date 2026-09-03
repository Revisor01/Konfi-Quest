import React from 'react';
import SlideBase from './SlideBase';
import { useCountUp } from '../../../hooks/useCountUp';
import type { SlideProps, KonfiEventsSlide } from '../../../types/wrapped';

interface EventsSlideProps extends SlideProps {
  events: KonfiEventsSlide;
}

/**
 * Die Termin-Seite -- auf die Slogan-Gestaltung umgezogen (03.09.2026).
 *
 * DABEI ENTFERNT: Die Zeile "0 mal abgesagt" stand hier FEST VERDRAHTET --
 * eine Null, die bei jeder Person erschien, unabhaengig von den Daten. Das
 * ist genau die Art Zeile, die Simons Regel verbietet ("keine
 * Negativ-Seiten"): Sie macht das Absagen zum Thema, obwohl niemand danach
 * gefragt hat, und war obendrein nicht mal gerechnet.
 */

function spruchFuer(besucht: number): { auge: string; slogan: string[]; nachsatz: string } {
  if (besucht >= 20) {
    return {
      auge: 'Deine Termine',
      slogan: ['Du warst', 'öfter da', 'als manche', 'Möbel.'],
      nachsatz: 'Ein Jahr, in dem du kaum etwas verpasst hast.'
    };
  }
  if (besucht >= 10) {
    return {
      auge: 'Deine Termine',
      slogan: ['Immer wieder', 'aufgetaucht.'],
      nachsatz: 'Nicht einmal, nicht zweimal — immer wieder.'
    };
  }
  if (besucht >= 2) {
    return {
      auge: 'Deine Termine',
      slogan: ['Du warst', 'dabei.'],
      nachsatz: 'Und darum geht es.'
    };
  }
  if (besucht === 1) {
    return {
      auge: 'Dein Termin',
      slogan: ['Einmal', 'hingegangen.'],
      nachsatz: 'Aller Anfang ist genau das.'
    };
  }
  return {
    auge: 'Deine Termine',
    slogan: ['Der erste', 'Termin', 'wartet noch.'],
    nachsatz: 'Es ist immer Platz für dich.'
  };
}

const EventsSlide: React.FC<EventsSlideProps> = ({ isActive, events }) => {
  const animatedCount = useCountUp(events.total_attended, isActive);
  const text = spruchFuer(events.total_attended);

  return (
    <SlideBase isActive={isActive} className="events-slide" kachel="events">
      <div className="kat-auge">{text.auge}</div>

      {events.total_attended > 0 && (
        <div className="kat-zahl">
          {animatedCount}<span className="kat-zahl__mal">×</span>
        </div>
      )}

      <div className="kat-slogan">
        {text.slogan.map((zeile, i) => (
          <span key={i} style={{ display: 'block' }}>{zeile}</span>
        ))}
      </div>

      <div className="kat-nachsatz">{text.nachsatz}</div>

      {events.lieblings_event?.name && (
        <div className="w-merkzettel">
          <span className="w-merkzettel__label">Dein letzter Termin</span>
          <span className="w-merkzettel__wert">{events.lieblings_event.name}</span>
        </div>
      )}
    </SlideBase>
  );
};

export default EventsSlide;
