import React, { createContext, useContext, useEffect, useCallback, ReactNode } from 'react';
import { initializeWebSocket, getSocket } from '../services/websocket';

// Live Update Event Types
export type LiveUpdateType =
  | 'dashboard'      // Konfi Dashboard (Punkte, Level, etc.)
  | 'events'         // Events Liste
  | 'event_booking'  // Einzelne Buchung
  | 'badges'         // Badges
  | 'requests'       // Aktivitäts-Anträge
  | 'konfis'         // Admin Konfi-Liste
  | 'points'         // Punkte-Änderungen
  | 'chat'           // Chat (bereits via BadgeContext)
  | 'activities'     // Aktivitäten-Verwaltung
  | 'categories'     // Kategorien-Verwaltung
  | 'jahrgaenge'     // Jahrgänge-Verwaltung
  | 'levels';        // Level-Verwaltung

export interface LiveUpdateEvent {
  type: LiveUpdateType;
  action: 'refresh' | 'update' | 'delete' | 'create';
  targetUserId?: number;      // Fuer welchen User
  targetUserType?: string;    // 'konfi' | 'admin'
  data?: any;                 // Optionale Daten
}

interface LiveUpdateContextType {
  // Subscribe to specific update types
  subscribe: (type: LiveUpdateType, callback: (event: LiveUpdateEvent) => void) => () => void;
  // Manually trigger a refresh (for testing/debugging)
  triggerRefresh: (type: LiveUpdateType) => void;
}

const LiveUpdateContext = createContext<LiveUpdateContextType | undefined>(undefined);

// Event listeners storage
const listeners: Map<LiveUpdateType, Set<(event: LiveUpdateEvent) => void>> = new Map();

export const LiveUpdateProvider = ({ children }: { children: ReactNode }) => {

  // Setup WebSocket listener
  useEffect(() => {
    const token = localStorage.getItem('konfi_token');
    if (!token) return;

    const socket = initializeWebSocket(token);

    // Main handler for all live updates
    const handleLiveUpdate = (event: LiveUpdateEvent) => {
      console.log('Live Update received:', event);

      // Notify all listeners for this type
      const typeListeners = listeners.get(event.type);
      if (typeListeners) {
        typeListeners.forEach(callback => {
          try {
            callback(event);
          } catch (error) {
            console.error('Error in live update listener:', error);
          }
        });
      }

      // Also dispatch a DOM event for components that prefer that pattern
      window.dispatchEvent(new CustomEvent(`liveUpdate:${event.type}`, { detail: event }));
    };

    // Listen for the main liveUpdate event
    socket.on('liveUpdate', handleLiveUpdate);

    // Also listen for specific event types (backward compatibility)
    socket.on('dashboardUpdate', (data: any) => handleLiveUpdate({ type: 'dashboard', action: 'refresh', data }));
    socket.on('eventsUpdate', (data: any) => handleLiveUpdate({ type: 'events', action: 'refresh', data }));
    socket.on('badgesUpdate', (data: any) => handleLiveUpdate({ type: 'badges', action: 'refresh', data }));
    socket.on('requestsUpdate', (data: any) => handleLiveUpdate({ type: 'requests', action: 'refresh', data }));
    socket.on('konfisUpdate', (data: any) => handleLiveUpdate({ type: 'konfis', action: 'refresh', data }));
    socket.on('pointsUpdate', (data: any) => handleLiveUpdate({ type: 'points', action: 'refresh', data }));
    socket.on('bookingUpdate', (data: any) => handleLiveUpdate({ type: 'event_booking', action: 'update', data }));
    socket.on('activitiesUpdate', (data: any) => handleLiveUpdate({ type: 'activities', action: 'refresh', data }));
    socket.on('categoriesUpdate', (data: any) => handleLiveUpdate({ type: 'categories', action: 'refresh', data }));
    socket.on('jahrgaengeUpdate', (data: any) => handleLiveUpdate({ type: 'jahrgaenge', action: 'refresh', data }));
    socket.on('levelsUpdate', (data: any) => handleLiveUpdate({ type: 'levels', action: 'refresh', data }));

    console.log('LiveUpdateContext: WebSocket listeners registered');

    return () => {
      socket.off('liveUpdate', handleLiveUpdate);
      socket.off('dashboardUpdate');
      socket.off('eventsUpdate');
      socket.off('badgesUpdate');
      socket.off('requestsUpdate');
      socket.off('konfisUpdate');
      socket.off('pointsUpdate');
      socket.off('bookingUpdate');
      socket.off('activitiesUpdate');
      socket.off('categoriesUpdate');
      socket.off('jahrgaengeUpdate');
      socket.off('levelsUpdate');
    };
  }, []);

  // Subscribe function
  const subscribe = useCallback((type: LiveUpdateType, callback: (event: LiveUpdateEvent) => void) => {
    if (!listeners.has(type)) {
      listeners.set(type, new Set());
    }
    listeners.get(type)!.add(callback);

    console.log(`LiveUpdate: Subscribed to ${type}`);

    // Return unsubscribe function
    return () => {
      listeners.get(type)?.delete(callback);
      console.log(`LiveUpdate: Unsubscribed from ${type}`);
    };
  }, []);

  // Manual trigger for testing
  const triggerRefresh = useCallback((type: LiveUpdateType) => {
    const event: LiveUpdateEvent = { type, action: 'refresh' };
    const typeListeners = listeners.get(type);
    if (typeListeners) {
      typeListeners.forEach(callback => callback(event));
    }
    window.dispatchEvent(new CustomEvent(`liveUpdate:${type}`, { detail: event }));
  }, []);

  return (
    <LiveUpdateContext.Provider value={{ subscribe, triggerRefresh }}>
      {children}
    </LiveUpdateContext.Provider>
  );
};

// Hook for easy subscription
export const useLiveUpdate = () => {
  const context = useContext(LiveUpdateContext);
  if (context === undefined) {
    throw new Error('useLiveUpdate must be used within a LiveUpdateProvider');
  }
  return context;
};

// Convenience hook that auto-subscribes and refreshes
export const useLiveRefresh = (
  types: LiveUpdateType | LiveUpdateType[],
  onRefresh: () => void
) => {
  const { subscribe } = useLiveUpdate();

  useEffect(() => {
    const typeArray = Array.isArray(types) ? types : [types];
    const unsubscribes: (() => void)[] = [];

    typeArray.forEach(type => {
      const unsub = subscribe(type, () => {
        console.log(`LiveRefresh: Refreshing due to ${type} update`);
        onRefresh();
      });
      unsubscribes.push(unsub);
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [types, onRefresh, subscribe]);
};
