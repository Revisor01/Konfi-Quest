import React, { useState } from 'react';
import ChatOverview from './ChatOverview';
import ChatRoomComponent from './ChatRoom';
import SimpleCreateChatModal from './modals/SimpleCreateChatModal';

interface ChatRoomData {
  id: number;
  name: string;
  type: 'group' | 'direct' | 'jahrgang' | 'admin';
}

const ChatPage: React.FC = () => {
  const [selectedRoom, setSelectedRoom] = useState<ChatRoomData | null>(null);
  const [showCreateChatModal, setShowCreateChatModal] = useState(false);

  const handleSelectRoom = (room: ChatRoomData) => {
    setSelectedRoom(room);
  };

  const handleBackToOverview = () => {
    setSelectedRoom(null);
  };

  const handleCreateNewChat = () => {
    setShowCreateChatModal(true);
  };

  const handleChatCreated = () => {
    setShowCreateChatModal(false);
    // Refresh chat overview by going back if we're in a room
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
        onSelectRoom={handleSelectRoom}
        onCreateNewChat={handleCreateNewChat}
      />
      
      <SimpleCreateChatModal
        isOpen={showCreateChatModal}
        onClose={() => setShowCreateChatModal(false)}
        onSuccess={handleChatCreated}
      />
    </>
  );
};

export default ChatPage;