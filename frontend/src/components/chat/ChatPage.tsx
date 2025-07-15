import React, { useState } from 'react';
import ChatOverview from './ChatOverview';
import ChatRoom from './ChatRoom';
import GroupChatModal from './modals/GroupChatModal';

interface ChatRoom {
  id: number;
  name: string;
  type: 'group' | 'direct' | 'jahrgang' | 'admin';
}

const ChatPage: React.FC = () => {
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [showGroupChatModal, setShowGroupChatModal] = useState(false);

  const handleSelectRoom = (room: ChatRoom) => {
    setSelectedRoom(room);
  };

  const handleBackToOverview = () => {
    setSelectedRoom(null);
  };

  const handleCreateGroupChat = () => {
    setShowGroupChatModal(true);
  };

  const handleGroupChatCreated = () => {
    setShowGroupChatModal(false);
    // Refresh chat overview by going back if we're in a room
    if (selectedRoom) {
      setSelectedRoom(null);
    }
  };

  if (selectedRoom) {
    return (
      <ChatRoom 
        room={selectedRoom} 
        onBack={handleBackToOverview}
      />
    );
  }

  return (
    <>
      <ChatOverview 
        onSelectRoom={handleSelectRoom}
        onCreateGroupChat={handleCreateGroupChat}
      />
      
      <GroupChatModal 
        isOpen={showGroupChatModal}
        onClose={() => setShowGroupChatModal(false)}
        onSuccess={handleGroupChatCreated}
      />
    </>
  );
};

export default ChatPage;