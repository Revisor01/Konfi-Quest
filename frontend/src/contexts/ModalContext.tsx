import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { modalController } from '@ionic/core';

interface ModalContextType {
  presentingElement: HTMLElement | undefined;
  registerPage: (tabId: string, element: HTMLElement | null) => void;
  getCurrentPresentingElement: () => HTMLElement | undefined;
  cleanupModals: () => Promise<void>;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tabPresentingElements, setTabPresentingElements] = useState<Map<string, HTMLElement>>(new Map());
  const location = useLocation();

  // Modal cleanup function
  const cleanupModals = async () => {
    try {
      // Dismiss all active modals
      await modalController.dismiss();
    } catch (error) {
      console.warn('Modal cleanup warning:', error);
    }
  };

  // Listen for route changes to cleanup modals
  useEffect(() => {
    cleanupModals();
  }, [location.pathname]);

  const registerPage = (tabId: string, element: HTMLElement | null) => {
    if (element) {
      setTabPresentingElements(prev => {
        const newMap = new Map(prev);
        newMap.set(tabId, element);
        return newMap;
      });
    }
  };

  const getCurrentPresentingElement = () => {
    // Aktuelle Route ermitteln
    const currentPath = location.pathname;
    let currentTabId = '';
    
    if (currentPath.includes('/admin/konfis')) currentTabId = 'konfis';
    else if (currentPath.includes('/admin/chat')) currentTabId = 'chat';
    else if (currentPath.includes('/admin/activities')) currentTabId = 'activities';
    else if (currentPath.includes('/admin/events')) currentTabId = 'events';
    else if (currentPath.includes('/admin/categories')) currentTabId = 'categories';
    else if (currentPath.includes('/admin/jahrgaenge')) currentTabId = 'jahrgaenge';
    else if (currentPath.includes('/admin/badges')) currentTabId = 'badges';
    else if (currentPath.includes('/admin/settings')) currentTabId = 'settings';
    
    return tabPresentingElements.get(currentTabId);
  };

  const presentingElement = getCurrentPresentingElement();

  return (
    <ModalContext.Provider value={{ presentingElement, registerPage, getCurrentPresentingElement, cleanupModals }}>
      {children}
    </ModalContext.Provider>
  );
};

export const useModal = () => {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};

export const useModalPage = (tabId: string) => {
  const { registerPage, presentingElement, cleanupModals } = useModal();
  const pageRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (pageRef.current) {
        registerPage(tabId, pageRef.current);
      }
    }, 0);
    
    return () => clearTimeout(timeout);
  }, [registerPage, tabId]);

  return { pageRef, presentingElement, cleanupModals };
};