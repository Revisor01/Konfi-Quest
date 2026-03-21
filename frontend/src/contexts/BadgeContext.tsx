import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback, useMemo } from 'react';
import { Badge } from '@capawesome/capacitor-badge';
import api from '../services/api';
import { writeQueue } from '../services/writeQueue';
import { networkMonitor } from '../services/networkMonitor';
import { initializeWebSocket, getSocket } from '../services/websocket';
import { getToken } from '../services/tokenStore';
import { useApp } from './AppContext';

// Badge Context Interface
interface BadgeContextType {
  // Chat
  chatUnreadByRoom: Record<number, number>;
  chatUnreadTotal: number;
  // Admin-only
  pendingRequestsCount: number;
  pendingEventsCount: number;
  // Gesamt (Role-abhaengig)
  totalBadgeCount: number;
  // Actions
  refreshAllCounts: () => Promise<void>;
  markRoomAsRead: (roomId: number) => void;
  // Legacy Alias (Abwaertskompatibilitaet)
  badgeCount: number;
  refreshFromAPI: () => Promise<void>;
}

// Create Context
const BadgeContext = createContext<BadgeContextType | undefined>(undefined);

// Badge Provider Component
export const BadgeProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useApp();

  const [chatUnreadByRoom, setChatUnreadByRoom] = useState<Record<number, number>>({});
  const [chatUnreadTotal, setChatUnreadTotal] = useState(0);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [pendingEventsCount, setPendingEventsCount] = useState(0);

  const isAdmin = user?.type === 'admin' && user?.role_name !== 'super_admin';

  // totalBadgeCount: Admin = chat + requests + events, Konfi = nur chat
  const totalBadgeCount = useMemo(() => {
    if (isAdmin) {
      return chatUnreadTotal + pendingRequestsCount + pendingEventsCount;
    }
    return chatUnreadTotal;
  }, [chatUnreadTotal, pendingRequestsCount, pendingEventsCount, isAdmin]);

  // Zentraler Refresh aller Counts
  const refreshAllCounts = useCallback(async () => {
    if (!user) return;

    try {
      // Chat-Rooms immer laden
      const promises: Promise<any>[] = [api.get('/chat/rooms')];

      // Admin-only: Requests + Events
      if (isAdmin) {
        promises.push(api.get('/admin/activities/requests'));
        promises.push(api.get('/events'));
      }

      const results = await Promise.all(promises);

      // Chat-Rooms verarbeiten
      const rooms = results[0].data;
      const unreadByRoom: Record<number, number> = {};
      let totalUnread = 0;
      rooms.forEach((room: any) => {
        const unreadCount = room.unread_count || 0;
        unreadByRoom[room.id] = unreadCount;
        totalUnread += unreadCount;
      });
      setChatUnreadByRoom(unreadByRoom);
      setChatUnreadTotal(totalUnread);

      // Admin-Counts verarbeiten
      if (isAdmin && results.length >= 3) {
        const requests = results[1].data;
        const pendingCount = requests.filter((req: any) => req.status === 'pending').length;
        setPendingRequestsCount(pendingCount);

        const events = results[2].data;
        const pendingEvents = events.filter((event: any) =>
          event.unprocessed_count > 0 && new Date(event.event_date) < new Date()
        ).length;
        setPendingEventsCount(pendingEvents);
      }
    } catch (error) {
      console.error('BadgeContext: refreshAllCounts fehlgeschlagen:', error);
    }
  }, [user, isAdmin]);

  // markRoomAsRead: Optimistisch + API Call
  const markRoomAsRead = useCallback((roomId: number) => {
    setChatUnreadByRoom(prev => {
      const currentUnread = prev[roomId] || 0;
      if (currentUnread === 0) return prev;
      return { ...prev, [roomId]: 0 };
    });
    setChatUnreadTotal(prev => {
      const currentUnread = chatUnreadByRoom[roomId] || 0;
      return Math.max(0, prev - currentUnread);
    });

    // API Call im Hintergrund — offline: Queue-Fallback
    if (!networkMonitor.isOnline) {
      writeQueue.enqueue({
        method: 'POST',
        url: `/chat/rooms/${roomId}/mark-read`,
        maxRetries: 3,
        hasFileUpload: false,
        metadata: { type: 'fire-and-forget', clientId: `mark-read-${roomId}-${Date.now()}`, label: 'Mark-Read' },
      });
      return;
    }
    api.post(`/chat/rooms/${roomId}/mark-read`).catch(err => {
      console.error('BadgeContext: markRoomAsRead API fehlgeschlagen:', err);
    });
  }, [chatUnreadByRoom]);

  // Sync Device Badge bei Aenderung von totalBadgeCount
  useEffect(() => {
    try {
      if (totalBadgeCount > 0) {
        Badge.set({ count: totalBadgeCount });
      } else {
        Badge.clear();
      }
    } catch (error) {
      console.warn('BadgeContext: Badge nicht verfuegbar:', error);
    }
  }, [totalBadgeCount]);

  // WebSocket: Live-Update bei neuen Nachrichten
  useEffect(() => {
    const token = getToken();
    if (!token || !user) return;

    const socket = initializeWebSocket(token);

    const handleNewMessage = () => {
      refreshAllCounts();
    };

    socket.on('newMessage', handleNewMessage);

    return () => {
      socket.off('newMessage', handleNewMessage);
    };
  }, [refreshAllCounts, user]);

  // Window Event Listeners fuer sofortige Aktualisierung
  useEffect(() => {
    if (!user) return;

    const handleRequestStatusChanged = () => {
      refreshAllCounts();
    };
    const handleEventsUpdated = () => {
      refreshAllCounts();
    };

    window.addEventListener('requestStatusChanged', handleRequestStatusChanged);
    window.addEventListener('events-updated', handleEventsUpdated);

    return () => {
      window.removeEventListener('requestStatusChanged', handleRequestStatusChanged);
      window.removeEventListener('events-updated', handleEventsUpdated);
    };
  }, [user, refreshAllCounts]);

  // Sync: Reconnect + Resume Badge-Refresh
  useEffect(() => {
    if (!user) return;

    const handleSyncReconnect = () => {
      refreshAllCounts();
    };

    window.addEventListener('sync:reconnect', handleSyncReconnect);
    return () => {
      window.removeEventListener('sync:reconnect', handleSyncReconnect);
    };
  }, [user, refreshAllCounts]);

  // Initialer Load + Polling fuer Admin-Counts (30s)
  useEffect(() => {
    if (!user) return;

    // Initialer Load
    refreshAllCounts();

    // Polling nur fuer Admin (requests + events aendern sich nicht per WebSocket)
    if (isAdmin) {
      const interval = setInterval(refreshAllCounts, 30000);
      return () => clearInterval(interval);
    }
  }, [user, isAdmin, refreshAllCounts]);

  // Reset bei Logout
  useEffect(() => {
    if (!user) {
      setChatUnreadByRoom({});
      setChatUnreadTotal(0);
      setPendingRequestsCount(0);
      setPendingEventsCount(0);
    }
  }, [user]);

  return (
    <BadgeContext.Provider value={{
      chatUnreadByRoom,
      chatUnreadTotal,
      pendingRequestsCount,
      pendingEventsCount,
      totalBadgeCount,
      refreshAllCounts,
      markRoomAsRead,
      // Legacy Alias
      badgeCount: chatUnreadTotal,
      refreshFromAPI: refreshAllCounts,
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
