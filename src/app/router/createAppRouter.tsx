import React from 'react';
import { createBrowserRouter } from 'react-router';

/**
 * Data router shell — enables useBlocker in descendants while preserving
 * the existing AppRoutes JSX tree unchanged (catch-all wrapper strategy).
 */
export function createAppRouter(appShell: React.ReactNode) {
  return createBrowserRouter([
    {
      path: '*',
      element: appShell,
    },
  ]);
}
