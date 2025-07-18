import React, { useState, useRef } from 'react';
import { useIonModal } from '@ionic/react';
import { useModalPage } from '../../contexts/ModalContext';
import ChatOverview from './ChatOverview';
import ChatRoomComponent from './ChatRoom';
import SimpleCreateChatModal from './modals/SimpleCreateChatModal';

interface ChatOverviewRef {
  loadChatRooms: () => void;
}

interface ChatRoomData {
  id: number;
  name: string;
  type: 'group' | 'direct' | 'jahrgang' | 'admin';
}

const ChatPage: React.FC = () => {
  const { pageRef, presentingElement } = useModalPage('chat');
  const [selectedRoom, setSelectedRoom] = useState<ChatRoomData | null>(null);
  const overviewRef = useRef<ChatOverviewRef>(null);

  // Modal mit useIonModal Hook - löst Tab-Navigation Problem
  const [presentChatModalHook, dismissChatModalHook] = useIonModal(SimpleCreateChatModal, {
    onClose: () => dismissChatModalHook(),
    onSuccess: () => {
      dismissChatModalHook();
      if (overviewRef.current) {
        overviewRef.current.loadChatRooms();
      }
      if (selectedRoom) {
        setSelectedRoom(null);
      }
    }
  });

  const handleSelectRoom = (room: ChatRoomData) => {
    setSelectedRoom(room);
  };

  const handleBackToOverview = () => {
    setSelectedRoom(null);
    // Refresh overview to update unread counts
    if (overviewRef.current) {
      overviewRef.current.loadChatRooms();
    }
  };

  const handleCreateNewChat = () => {
    presentChatModalHook({
      presentingElement: presentingElement
    });
  };

  if (selectedRoom) {
    return (
      <ChatRoomComponent 
        room={selectedRoom} 
        onBack={handleBackToOverview}
      />
    );
  }

  return (
    <ChatOverview 
      ref={overviewRef}
      pageRef={pageRef}
      onSelectRoom={handleSelectRoom}
      onCreateNewChat={handleCreateNewChat}
    />
  );
};

export default ChatPage;