import React from 'react';
import { useParams, useHistory } from 'react-router-dom';
import EventDetailView from '../views/EventDetailView';

interface RouteParams {
  id: string;
}

const KonfiEventDetailPage: React.FC = () => {
  const { id } = useParams<RouteParams>();
  const history = useHistory();

  const handleBack = () => {
    history.goBack();
  };

  return (
    <EventDetailView
      eventId={parseInt(id, 10)}
      onBack={handleBack}
    />
  );
};

export default KonfiEventDetailPage;