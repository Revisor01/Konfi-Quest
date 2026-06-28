import React, { useState } from 'react';
import { calendarOutline } from 'ionicons/icons';
import { SplitViewShell, useIsWideScreen } from '../../shared';
import AdminEventsPage from './AdminEventsPage';
import EventDetailView from '../views/EventDetailView';

// iPad-Split-View fuer den Admin-Events-Bereich.
// Breit (>=lg): Liste links + Event-Detail rechts. Schmal: nur die Liste;
// Auswahl navigiert per Route /admin/events/:id.

const AdminEventsSplitView: React.FC = () => {
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const isWide = useIsWideScreen();

  const handleSelect = (eventId: number) => {
    if (isWide) {
      setSelectedEventId(eventId);
    } else {
      window.location.assign(`/admin/events/${eventId}`);
    }
  };

  if (!isWide) {
    return <AdminEventsPage />;
  }

  return (
    <SplitViewShell
      emptyIcon={calendarOutline}
      emptyText="Wähle links ein Event aus, um die Details zu sehen."
      master={<AdminEventsPage onSelectEvent={handleSelect} selectedEventId={selectedEventId} />}
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

export default AdminEventsSplitView;
