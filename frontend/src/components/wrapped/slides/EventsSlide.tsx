import React from 'react';
import SlideBase from './SlideBase';
import { useCountUp } from '../../../hooks/useCountUp';
import type { SlideProps, KonfiEventsSlide } from '../../../types/wrapped';

interface EventsSlideProps extends SlideProps {
  events: KonfiEventsSlide;
}

const EventsSlide: React.FC<EventsSlideProps> = ({ isActive, events }) => {
  const animatedCount = useCountUp(events.total_attended, isActive);

  return (
    <SlideBase isActive={isActive} className="events-slide">
      <div className="wrapped-anim-fade">
        <p className="wrapped-subtitle">Deine Events</p>
      </div>
      <div className="wrapped-anim-scale wrapped-anim-delay-1">
        <p className="wrapped-big-number">{animatedCount}</p>
        <p className="wrapped-subtitle">Events besucht</p>
        {events.total_available > 0 && (
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', marginTop: '4px' }}>
            von {events.total_available} verf&uuml;gbaren
          </p>
        )}
      </div>
      {events.lieblings_event && (
        <div className="wrapped-anim-fade wrapped-anim-delay-2">
          <div className="events-highlight">
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>Dein letztes Event</p>
            <p style={{ color: '#a78bfa', fontSize: '1.2rem', fontWeight: 600, marginTop: '4px' }}>
              {events.lieblings_event.name}
            </p>
          </div>
        </div>
      )}
    </SlideBase>
  );
};

export default EventsSlide;
