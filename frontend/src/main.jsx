import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { queryClient } from './lib/queryClient';
import { routeTree } from './routeTree';
import { useThemeStore } from './stores/themeStore';
import { CookieBanner } from './components/shared/CookieBanner';
import './index.css';

// Sentry frontend error tracking
if (import.meta.env.VITE_SENTRY_DSN) {
  import('@sentry/react').then(({ init, browserTracingIntegration }) => {
    init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.MODE,
      integrations: [browserTracingIntegration()],
      tracesSampleRate: 0.1,
    });
  });
}

useThemeStore.getState().initTheme();

const router = createRouter({ routeTree, defaultPreload: 'intent' });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <CookieBanner />
    </QueryClientProvider>
  </React.StrictMode>
);
