import React, { createContext, useContext, useState, useEffect } from 'react';
import { checkAuth } from '../services/auth';
import api from '../services/api';

export interface ChatNotifications {
  totalUnreadCount: number;
  unreadByRoom: Record<number, number>;
}

interface User {
  id: number;
  type: 'admin' | 'konfi' | 'user';
  display_name: string;
  username?: string;
  email?: string;
  organization?: string;
  organization_id?: number;
  roles?: string[];
  role_name?: string;
  jahrgang?: string;
  is_super_admin?: boolean;
}

interface AppContextType {
  user: User | null;
  loading: boolean;
  error: string;
  success: string;
  chatNotifications: ChatNotifications;
  chatNotificationsLoading: boolean;
  setUser: (user: User | null) => void;
  setError: (error: string) => void;
  setSuccess: (success: string) => void;
  clearMessages: () => void;
  refreshChatNotifications: () => Promise<void>;
  markChatRoomAsRead: (roomId: number) => void;
  addUnreadChatMessage: (roomId: number, count?: number) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);


export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(checkAuth());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Chat notifications state
  const [chatNotifications, setChatNotifications] = useState<ChatNotifications>({
    totalUnreadCount: 0,
    unreadByRoom: {}
  });
  const [chatNotificationsLoading, setChatNotificationsLoading] = useState(true);

  // Chat notification functions
  const refreshChatNotifications = async () => {
    if (!user) return;
    
    try {
      setChatNotificationsLoading(true);
      const response = await api.get('/chat/rooms');
      const rooms = response.data;
      
      let totalUnread = 0;
      const unreadByRoom: Record<number, number> = {};
      
      rooms.forEach((room: any) => {
        const unreadCount = room.unread_count || 0;
        unreadByRoom[room.id] = unreadCount;
        totalUnread += unreadCount;
      });
      
      setChatNotifications({
        totalUnreadCount: totalUnread,
        unreadByRoom
      });
    } catch (err) {
      console.error('Error loading chat notifications:', err);
    } finally {
      setChatNotificationsLoading(false);
    }
  };

  const markChatRoomAsRead = (roomId: number) => {
    setChatNotifications(prev => {
      const currentUnread = prev.unreadByRoom[roomId] || 0;
      return {
        totalUnreadCount: prev.totalUnreadCount - currentUnread,
        unreadByRoom: {
          ...prev.unreadByRoom,
          [roomId]: 0
        }
      };
    });
  };

  const addUnreadChatMessage = (roomId: number, count: number = 1) => {
    setChatNotifications(prev => ({
      totalUnreadCount: prev.totalUnreadCount + count,
      unreadByRoom: {
        ...prev.unreadByRoom,
        [roomId]: (prev.unreadByRoom[roomId] || 0) + count
      }
    }));
  };

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  // Clear messages after 5 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(clearMessages, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  // Load chat notifications when user changes
  useEffect(() => {
    if (user) {
      refreshChatNotifications();
      
      // Auto-refresh notifications every 30 seconds
      const interval = setInterval(refreshChatNotifications, 30000);
      return () => clearInterval(interval);
    } else {
      // Clear notifications when user logs out
      setChatNotifications({
        totalUnreadCount: 0,
        unreadByRoom: {}
      });
      setChatNotificationsLoading(false);
    }
  }, [user]);

  const value: AppContextType = {
    user,
    loading,
    error,
    success,
    chatNotifications,
    chatNotificationsLoading,
    setUser,
    setError,
    setSuccess,
    clearMessages,
    refreshChatNotifications,
    markChatRoomAsRead,
    addUnreadChatMessage,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

export default AppContext;