import React, { useState, useEffect } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import ChatRoom from '../ChatRoom';
import api from '../../../services/api';
import LoadingSpinner from '../../common/LoadingSpinner';

interface ChatRoomData {
  id: number;
  name: string;
  type: 'group' | 'direct' | 'jahrgang' | 'admin';
}

const ChatRoomView: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const history = useHistory();
  const [room, setRoom] = useState<ChatRoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRoom();
  }, [roomId]);

  const loadRoom = async () => {
    if (!roomId) return;
    
    setLoading(true);
    try {
      const response = await api.get(`/chat/rooms/${roomId}`);
      setRoom(response.data);
    } catch (err) {
      console.error('Error loading room:', err);
      setError('Fehler beim Laden des Chat-Raums');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    history.goBack();
  };

  if (loading) {
    return <LoadingSpinner fullScreen message="Chat wird geladen..." />;
  }

  if (error || !room) {
    return <LoadingSpinner fullScreen message={error || "Chat-Raum nicht gefunden"} />;
  }

  return (
    <ChatRoom 
      room={room}
      onBack={handleBack}
    />
  );
};

export default ChatRoomView;