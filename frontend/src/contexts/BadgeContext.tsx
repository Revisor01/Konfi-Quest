import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { Badge } from '@capawesome/capacitor-badge';
import api from '../services/api';
import { initializeWebSocket, getSocket } from '../services/websocket';

// Badge Context Interface
interface BadgeContextType {
  badgeCount: number;
  setBadgeCount: React.Dispatch<React.SetStateAction<number>>;
  incrementBadge: () => void;
  decrementBadge: (amount?: number) => void;
  resetBadge: () => void;
  refreshFromAPI: () => Promise<void>;
}

// Create Context
const BadgeContext = createContext<BadgeContextType | undefined>(undefined);

// Badge Provider Component
export const BadgeProvider = ({ children }: { children: ReactNode }) => {
  const [badgeCount, setBadgeCount] = useState(0);

  // API refresh function - wird von AppContent aufgerufen
  const refreshFromAPI = useCallback(async () => {
    try {
      // console.log('🔄 BadgeContext: Refreshing from API'); // DISABLED wegen Spam
      const response = await api.get('/chat/rooms');
      const rooms = response.data;
      
      let totalUnread = 0;
      rooms.forEach((room: any) => {
        totalUnread += room.unread_count || 0;
      });
      
      // console.log('📱 BadgeContext: API refresh result:', totalUnread); // DISABLED wegen Spam
      setBadgeCount(totalUnread);
    } catch (error) {
      console.log('📱 BadgeContext: API refresh failed:', error);
    }
  }, []);

  // Sync badge with device badge whenever count changes
  useEffect(() => {
    try {
      if (badgeCount > 0) {
        Badge.set({ count: badgeCount });
        console.log('📱 BadgeContext: Device badge set to:', badgeCount);
      } else {
        Badge.clear();
        console.log('📱 BadgeContext: Device badge cleared');
      }
    } catch (error) {
      console.log('📱 BadgeContext: Badge not available:', error);
    }
  }, [badgeCount]);

  // WebSocket: Live-Update wenn neue Nachrichten ankommen
  // WICHTIG: Muss hier bleiben für Updates wenn User NICHT auf Chat-Tab ist
  useEffect(() => {
    const token = localStorage.getItem('konfi_token');
    if (!token) return;

    const socket = initializeWebSocket(token);

    const handleNewMessage = () => {
      console.log('📱 BadgeContext: New message via WebSocket, refreshing badge');
      refreshFromAPI();
    };

    socket.on('newMessage', handleNewMessage);

    return () => {
      socket.off('newMessage', handleNewMessage);
    };
  }, [refreshFromAPI]);

  const incrementBadge = () => {
    setBadgeCount(prev => prev + 1);
  };

  const decrementBadge = (amount: number = 1) => {
    setBadgeCount(prev => Math.max(0, prev - amount));
  };

  const resetBadge = () => {
    setBadgeCount(0);
  };

  return (
    <BadgeContext.Provider value={{ 
      badgeCount, 
      setBadgeCount, 
      incrementBadge, 
      decrementBadge, 
      resetBadge,
      refreshFromAPI
    }}>
      {children}
    </BadgeContext.Provider>
  );
};

// Custom Hook for easy access
export const useBadge = () => {
  const context = useContext(BadgeContext);
  if (context === undefined) {
    throw new Error('useBadge must be used within a BadgeProvider');
  }
  return context;
};