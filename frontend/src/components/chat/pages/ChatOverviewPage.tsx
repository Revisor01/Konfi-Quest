import React, { useRef } from 'react';
import { useHistory } from 'react-router-dom';
import { useIonModal } from '@ionic/react';
import { useModalPage } from '../../../contexts/ModalContext';
import { useApp } from '../../../contexts/AppContext';
import ChatOverview from '../ChatOverview';
import SimpleCreateChatModal from '../modals/SimpleCreateChatModal';

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
  const { pageRef, presentingElement } = useModalPage('chat');
  const overviewRef = useRef<ChatOverviewRef>(null);

  // Modal mit useIonModal Hook
  const [presentChatModalHook, dismissChatModalHook] = useIonModal(SimpleCreateChatModal, {
    onClose: () => dismissChatModalHook(),
    onSuccess: () => {
      dismissChatModalHook();
      if (overviewRef.current) {
        overviewRef.current.loadChatRooms();
      }
    }
  });

  const handleSelectRoom = (room: ChatRoomData) => {
    // Navigate to room view with proper routing
    const basePath = user?.type === 'admin' ? '/admin' : '/konfi';
    history.push(`${basePath}/chat/room/${room.id}`);
  };

  const handleCreateNewChat = () => {
    presentChatModalHook({
      presentingElement: presentingElement
    });
  };

  return (
    <ChatOverview 
      ref={overviewRef}
      pageRef={pageRef}
      onSelectRoom={handleSelectRoom}
      onCreateNewChat={handleCreateNewChat}
    />
  );
};

export default ChatOverviewPage;