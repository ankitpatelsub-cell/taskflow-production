import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { queryClient } from './lib/queryClient';
import { routeTree } from './routeTree';
import { useThemeStore } from './stores/themeStore';
import './index.css';

// Apply stored theme before first render
useThemeStore.getState().initTheme();

const router = createRouter({ routeTree, defaultPreload: 'intent' });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>
);
