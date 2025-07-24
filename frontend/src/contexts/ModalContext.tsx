import React, { createContext, useContext, useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
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

  const registerPage = useCallback((tabId: string, element: HTMLElement | null) => {
    console.log('🔥 ModalContext: registerPage called with:', { tabId, element });
    if (element) {
      setTabPresentingElements(prev => {
        const newMap = new Map(prev);
        newMap.set(tabId, element);
        console.log('🔥 ModalContext: Updated map:', Array.from(newMap.keys()));
        return newMap;
      });
    }
  }, []);

  const getCurrentPresentingElement = () => {
    // Aktuelle Route ermitteln
    const currentPath = location.pathname;
    let currentTabId = '';
    
    // Admin Routes - KORRIGIERT: Tab IDs müssen mit MainTabs.tsx übereinstimmen
    if (currentPath.includes('/admin/konfis')) currentTabId = 'admin-konfis';
    else if (currentPath.includes('/admin/chat')) currentTabId = 'admin-chat';
    else if (currentPath.includes('/admin/activities')) currentTabId = 'admin-activities';
    else if (currentPath.includes('/admin/events')) currentTabId = 'admin-events';
    else if (currentPath.includes('/admin/badges')) currentTabId = 'admin-badges';
    else if (currentPath.includes('/admin/requests')) currentTabId = 'admin-requests';
    else if (currentPath.includes('/admin/users')) currentTabId = 'admin-users';
    else if (currentPath.includes('/admin/roles')) currentTabId = 'admin-roles';
    else if (currentPath.includes('/admin/organizations')) currentTabId = 'admin-organizations';
    else if (currentPath.includes('/admin/profile')) currentTabId = 'admin-profile';
    else if (currentPath.includes('/admin/settings/categories')) currentTabId = 'admin-categories';
    else if (currentPath.includes('/admin/settings/jahrgaenge')) currentTabId = 'admin-jahrgaenge';
    else if (currentPath.includes('/admin/settings')) currentTabId = 'admin-settings';
    // Konfi Routes - diese sind bereits korrekt
    else if (currentPath.includes('/konfi/dashboard')) currentTabId = 'dashboard';
    else if (currentPath.includes('/konfi/events')) currentTabId = 'events';
    else if (currentPath.includes('/konfi/requests')) currentTabId = 'requests';
    else if (currentPath.includes('/konfi/badges')) currentTabId = 'badges';
    else if (currentPath.includes('/konfi/chat')) currentTabId = 'chat';
    else if (currentPath.includes('/konfi/profile')) currentTabId = 'profile';
    
    const element = tabPresentingElements.get(currentTabId);
    console.log('🔥 ModalContext: getCurrentPresentingElement:', { currentPath, currentTabId, element, allKeys: Array.from(tabPresentingElements.keys()) });
    return element;
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

  useLayoutEffect(() => {
    console.log('🔥 useModalPage: useLayoutEffect triggered for tabId:', tabId);
    console.log('🔥 useModalPage: pageRef.current:', pageRef.current);
    
    if (pageRef.current) {
      console.log('🔥 useModalPage: calling registerPage immediately');
      registerPage(tabId, pageRef.current);
    } else {
      // Fallback mit längerem Timeout
      const timeout = setTimeout(() => {
        console.log('🔥 useModalPage: fallback timeout callback, pageRef.current:', pageRef.current);
        if (pageRef.current) {
          console.log('🔥 useModalPage: calling registerPage from fallback');
          registerPage(tabId, pageRef.current);
        } else {
          console.log('🔥 useModalPage: pageRef.current still null after fallback');
        }
      }, 500);
      
      return () => clearTimeout(timeout);
    }
  }, [registerPage, tabId]);

  return { pageRef, presentingElement, cleanupModals };
};