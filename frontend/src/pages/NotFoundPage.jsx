import React from 'react';
import { Link } from '@tanstack/react-router';

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface-app px-4">
      <p className="text-8xl font-bold text-indigo-500 select-none">404</p>
      <h1 className="mt-4 text-2xl font-semibold text-gray-900 dark:text-white">Page not found</h1>
      <p className="mt-2 text-gray-500 dark:text-gray-400">
        The page you're looking for doesn't exist or was moved.
      </p>
      <Link
        to="/app/dashboard"
        className="mt-6 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
