import React, { useState } from 'react';
import { chatbubblesOutline } from 'ionicons/icons';
import { SplitViewShell, useIsWideScreen } from '../../shared';
import { useApp } from '../../../contexts/AppContext';
import ChatOverviewPage from './ChatOverviewPage';
import ChatRoomView from '../views/ChatRoomView';

// iPad-Split-View fuer den Chat-Bereich (alle Rollen).
// Breit (>=lg): Raumliste links + Raum rechts. Schmal: nur die Liste; Auswahl
// navigiert per Route /{rolle}/chat/room/:roomId.

const ChatSplitView: React.FC = () => {
  const { user } = useApp();
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const isWide = useIsWideScreen();

  const basePath = user?.type === 'admin' ? '/admin' : user?.type === 'teamer' ? '/teamer' : '/konfi';

  const handleSelect = (roomId: number) => {
    if (isWide) {
      setSelectedRoomId(roomId);
    } else {
      window.location.assign(`${basePath}/chat/room/${roomId}`);
    }
  };

  if (!isWide) {
    return <ChatOverviewPage />;
  }

  return (
    <SplitViewShell
      emptyIcon={chatbubblesOutline}
      emptyText="Wähle links einen Chat aus, um die Nachrichten zu sehen."
      master={<ChatOverviewPage onSelectRoom={handleSelect} selectedRoomId={selectedRoomId} />}
      detail={
        selectedRoomId ? (
          <ChatRoomView
            key={selectedRoomId}
            roomId={selectedRoomId}
            onBack={() => setSelectedRoomId(null)}
          />
        ) : null
      }
    />
  );
};

export default ChatSplitView;
