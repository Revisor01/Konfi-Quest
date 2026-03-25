import React from 'react';
import { IonIcon } from '@ionic/react';
import { calendarOutline, closeCircleOutline } from 'ionicons/icons';
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
        <IonIcon icon={calendarOutline} style={{ fontSize: '2.5rem', opacity: 0.7, color: '#a78bfa' }} />
      </div>
      <div className="wrapped-anim-fade wrapped-anim-delay-1">
        <p className="wrapped-label">Deine Events</p>
      </div>
      <div className="wrapped-anim-number-pop wrapped-anim-delay-1">
        <p className="wrapped-big-number">{animatedCount}</p>
        <p className="wrapped-subtitle">Events besucht</p>
        {events.total_available > 0 && (
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', marginTop: '4px' }}>
            von {events.total_available} verfuegbaren
          </p>
        )}
      </div>
      <div className="wrapped-anim-fade wrapped-anim-delay-2" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px', color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>
        <IonIcon icon={closeCircleOutline} style={{ fontSize: '1.1rem' }} />
        <span>0 mal abgesagt</span>
      </div>
      {events.lieblings_event && (
        <div className="wrapped-anim-fly-left wrapped-anim-delay-3">
          <div style={{
            marginTop: '24px',
            padding: '16px 24px',
            background: 'rgba(255,255,255,0.15)',
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <IonIcon icon={calendarOutline} style={{ fontSize: '1.5rem', color: '#a78bfa', flexShrink: 0 }} />
            <div style={{ textAlign: 'left' }}>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', margin: 0 }}>Dein letztes Event</p>
              <p style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 600, margin: '2px 0 0 0' }}>
                {events.lieblings_event.name}
              </p>
            </div>
          </div>
        </div>
      )}
    </SlideBase>
  );
};

export default EventsSlide;
