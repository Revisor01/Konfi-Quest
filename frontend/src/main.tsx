import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
  // <React.StrictMode>  // Temporarily disabled to avoid double routing in development
    <App />
  // </React.StrictMode>
);