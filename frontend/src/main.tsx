import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { migrateToPreferences } from './services/migrateStorage';
import { initTokenStore } from './services/tokenStore';

const container = document.getElementById('root');
const root = createRoot(container!);

(async () => {
  await migrateToPreferences();
  await initTokenStore();
  root.render(
    // <React.StrictMode>  // Temporarily disabled to avoid double routing in development
      <App />
    // </React.StrictMode>
  );
})();