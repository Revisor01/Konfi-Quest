import { Network } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';

// Modul-Level State (Singleton-Pattern wie websocket.ts)
let _isOnline: boolean = true; // Optimistisch starten
let _initialized = false;
let _debounceTimer: ReturnType<typeof setTimeout> | null = null;

type NetworkListener = (isOnline: boolean) => void;
const _listeners: Set<NetworkListener> = new Set();

function notifyListeners() {
  _listeners.forEach(fn => fn(_isOnline));
}

async function initNetworkMonitor(): Promise<void> {
  if (_initialized) return;

  try {
    // Initialen Status abfragen
    const status = await Network.getStatus();
    _isOnline = status.connected;

    // Listener fuer Status-Aenderungen
    Network.addListener('networkStatusChange', (status) => {
      if (_debounceTimer) clearTimeout(_debounceTimer);
      _debounceTimer = setTimeout(() => {
        _isOnline = status.connected;
        notifyListeners();
      }, 300);
    });
  } catch (err) {
    console.warn('Capacitor Network Plugin nicht verfuegbar, nutze Web-Fallback');
  }

  // Web-Fallback (fuer Browser-Dev und falls Capacitor-Plugin nicht verfuegbar)
  if (!Capacitor.isNativePlatform()) {
    _isOnline = navigator.onLine;

    window.addEventListener('online', () => {
      if (_debounceTimer) clearTimeout(_debounceTimer);
      _debounceTimer = setTimeout(() => {
        _isOnline = true;
        notifyListeners();
      }, 300);
    });

    window.addEventListener('offline', () => {
      if (_debounceTimer) clearTimeout(_debounceTimer);
      _debounceTimer = setTimeout(() => {
        _isOnline = false;
        notifyListeners();
      }, 300);
    });
  }

  _initialized = true;
}

function subscribe(fn: NetworkListener): () => void {
  _listeners.add(fn);
  return () => {
    _listeners.delete(fn);
  };
}

export const networkMonitor = {
  get isOnline() { return _isOnline; },
  subscribe,
  init: initNetworkMonitor,
};
