import React from 'react';
import SlideBase from '../SlideBase';
import { useCountUp } from '../../../../hooks/useCountUp';
import type { SlideProps, TeamerEventsGeleitetSlide } from '../../../../types/wrapped';

interface TeamerEventsSlideProps extends SlideProps {
  events: TeamerEventsGeleitetSlide;
}

const TeamerEventsSlide: React.FC<TeamerEventsSlideProps> = ({ isActive, events }) => {
  const animatedCount = useCountUp(events.total, isActive);

  return (
    <SlideBase isActive={isActive}>
      <div className="wrapped-anim-fade">
        <p className="wrapped-subtitle">Deine Events</p>
      </div>
      <div className="wrapped-anim-scale wrapped-anim-delay-1">
        <p className="wrapped-big-number">{animatedCount}</p>
        <p className="wrapped-subtitle">Events geleitet</p>
      </div>
      {events.meiste_teilnehmer_event && (
        <div className="wrapped-anim-fade wrapped-anim-delay-2">
          <div className="events-highlight" style={{
            background: 'rgba(225, 29, 72, 0.15)',
            border: '1px solid rgba(225, 29, 72, 0.3)',
          }}>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>Gr&ouml;&szlig;tes Event</p>
            <p style={{ color: '#fb7185', fontSize: '1.2rem', fontWeight: 600, marginTop: '4px' }}>
              {events.meiste_teilnehmer_event.name}
            </p>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', marginTop: '4px' }}>
              {events.meiste_teilnehmer_event.teilnehmer} Teilnehmer:innen
            </p>
          </div>
        </div>
      )}
    </SlideBase>
  );
};

export default TeamerEventsSlide;
