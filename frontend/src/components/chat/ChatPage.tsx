import React, { useState, useRef } from 'react';
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
  const [selectedRoom, setSelectedRoom] = useState<ChatRoomData | null>(null);
  const [showCreateChatModal, setShowCreateChatModal] = useState(false);
  const [modalPresentingElement, setModalPresentingElement] = useState<HTMLElement | null>(null);
  const overviewRef = useRef<ChatOverviewRef>(null);

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
    setShowCreateChatModal(true);
  };

  const handleCreateNewChatWithRef = (pageRef: HTMLElement | null) => {
    setModalPresentingElement(pageRef);
    setShowCreateChatModal(true);
  };

  const handleChatCreated = () => {
    setShowCreateChatModal(false);
    // Refresh chat overview
    if (overviewRef.current) {
      overviewRef.current.loadChatRooms();
    }
    // Go back to overview if we're in a room
    if (selectedRoom) {
      setSelectedRoom(null);
    }
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
    <>
      <ChatOverview 
        ref={overviewRef}
        onSelectRoom={handleSelectRoom}
        onCreateNewChat={handleCreateNewChat}
        onCreateNewChatWithRef={handleCreateNewChatWithRef}
      />
      
      <SimpleCreateChatModal
        isOpen={showCreateChatModal}
        onClose={() => setShowCreateChatModal(false)}
        onSuccess={handleChatCreated}
        presentingElement={modalPresentingElement || undefined}
      />
    </>
  );
};

export default ChatPage;