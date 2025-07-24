import React, { useRef } from 'react';
import { useHistory } from 'react-router-dom';
import { useApp } from '../../../contexts/AppContext';
import ChatOverview from '../ChatOverview';

interface ChatOverviewRef {
  loadChatRooms: () => void;
}

interface ChatRoomData {
  id: number;
  name: string;
  type: 'group' | 'direct' | 'jahrgang' | 'admin';
}

const ChatOverviewPage: React.FC = () => {
  const { user } = useApp();
  const history = useHistory();
  const overviewRef = useRef<ChatOverviewRef>(null);

  const handleSelectRoom = (room: ChatRoomData) => {
    // Navigate to room view with proper routing
    const basePath = user?.type === 'admin' ? '/admin' : '/konfi';
    history.push(`${basePath}/chat/room/${room.id}`);
  };

  return (
    <ChatOverview 
      ref={overviewRef}
      onSelectRoom={handleSelectRoom}
    />
  );
};

export default ChatOverviewPage;