import React, { useRef } from 'react';
import { useIonRouter } from '@ionic/react';
// useIonRouter: Ionic 8 API - bei Ionic v9 ggf. auf useNavigate migrieren
import { useApp } from '../../../contexts/AppContext';
import ChatOverview from '../ChatOverview';
import { useBreitesLayout } from '../../../navigation/breitesLayout';
import WebChat from '../web/WebChat';

interface ChatOverviewRef {
  loadChatRooms: () => void;
}

interface ChatRoomData {
  id: number;
  name: string;
  type: 'group' | 'direct' | 'jahrgang' | 'admin';
}

interface ChatOverviewPageProps {
  // Im iPad-Split-View setzt der Master die Auswahl als State (statt zu
  // navigieren). Fehlt der Callback (iPhone/Portrait), wird wie bisher per
  // Route auf die Raum-Ansicht navigiert.
  onSelectRoom?: (roomId: number) => void;
  selectedRoomId?: number | null;
}

const ChatOverviewPage: React.FC<ChatOverviewPageProps> = ({ onSelectRoom, selectedRoomId }) => {
  const { user } = useApp();
  const router = useIonRouter();
  const overviewRef = useRef<ChatOverviewRef>(null);
  // Browser ab 992 px: der Messenger mit Liste links und leerem Raum rechts.
  // In den Apps und im schmalen Fenster bleibt die Uebersicht wie sie ist.
  const breit = useBreitesLayout();

  const handleSelectRoom = (room: ChatRoomData) => {
    if (onSelectRoom) {
      onSelectRoom(room.id);
    } else {
      // Navigate to room view with proper routing
      const basePath = user?.type === 'admin' ? '/admin' : user?.type === 'teamer' ? '/teamer' : '/konfi';
      router.push(`${basePath}/chat/room/${room.id}`);
    }
  };

  if (breit) return <WebChat roomId={null} />;

  return (
    <ChatOverview
      ref={overviewRef}
      onSelectRoom={handleSelectRoom}
      selectedRoomId={selectedRoomId}
    />
  );
};

export default ChatOverviewPage;