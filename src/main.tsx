import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global Error Handlers for unhandled runtime errors and unhandled promise rejections
window.onerror = (message, source, lineno, colno, error) => {
  console.error('[Global Error Handler]:', { message, source, lineno, colno, error });
  return false;
};

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Global Unhandled Rejection Handler]:', event.reason);
});

// Register service worker for offline capability & updates in production builds
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        // Save registration reference globally for manual and auto update checks
        (window as any).__swRegistration = reg;

        // Check if there's already a waiting worker
        if (reg.waiting) {
          window.dispatchEvent(
            new CustomEvent('sw-update-available', { detail: { registration: reg } })
          );
        }

        // Listen for new worker updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                window.dispatchEvent(
                  new CustomEvent('sw-update-available', { detail: { registration: reg } })
                );
              }
            });
          }
        });
      })
      .catch((err) => {
        console.log('ServiceWorker registration error: ', err);
      });
  });

  // Reload page when the service worker controller changes after skipWaiting
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
