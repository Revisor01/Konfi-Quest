import React, { useState } from 'react';
import { calendarOutline } from 'ionicons/icons';
import { SplitViewShell, useIsWideScreen } from '../../shared';
import KonfiEventsPage from './KonfiEventsPage';
import EventDetailView from '../views/EventDetailView';

// iPad-Split-View fuer den Konfi-Events-Bereich.
// Breit (>=lg): Liste links + Event-Detail rechts. Schmal: nur die Liste;
// Auswahl navigiert per Route /konfi/events/:id.

const KonfiEventsSplitView: React.FC = () => {
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const isWide = useIsWideScreen();

  const handleSelect = (eventId: number) => {
    if (isWide) {
      setSelectedEventId(eventId);
    } else {
      window.location.assign(`/konfi/events/${eventId}`);
    }
  };

  if (!isWide) {
    return <KonfiEventsPage />;
  }

  return (
    <SplitViewShell
      emptyIcon={calendarOutline}
      emptyText="Wähle links ein Event aus, um die Details zu sehen."
      master={<KonfiEventsPage onSelectEvent={handleSelect} selectedEventId={selectedEventId} />}
      detail={
        selectedEventId ? (
          <EventDetailView
            key={selectedEventId}
            eventId={selectedEventId}
            onBack={() => setSelectedEventId(null)}
            hideBackButton
          />
        ) : null
      }
    />
  );
};

export default KonfiEventsSplitView;
