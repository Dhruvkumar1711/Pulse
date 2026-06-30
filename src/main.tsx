import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress benign HMR / WebSocket connection errors in development environment
if (typeof window !== 'undefined') {
  const isViteBenignError = (msg: string | null | undefined) => {
    if (!msg) return false;
    const lower = msg.toLowerCase();
    return lower.includes('websocket') || lower.includes('vite') || lower.includes('hmr') || lower.includes('hot reload');
  };

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    if (reason) {
      const msg = reason.message || (typeof reason === 'string' ? reason : '');
      const stack = reason.stack || '';
      if (isViteBenignError(msg) || isViteBenignError(stack)) {
        event.preventDefault();
        // Swallow or log as a low-priority debug message to keep console pristine
        console.debug('Suppressed benign HMR websocket rejection:', msg);
      }
    }
  });

  window.addEventListener('error', (event) => {
    const msg = event.message || '';
    if (isViteBenignError(msg)) {
      event.preventDefault();
      console.debug('Suppressed benign HMR error:', msg);
    }
  }, true); // Capture phase to catch resource errors
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
