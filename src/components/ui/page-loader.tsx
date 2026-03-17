import React from 'react';

export function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/50" role="status" aria-label="Loading page">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto" aria-hidden="true"></div>
        <p className="mt-4 text-gray-600 font-medium">Loading...</p>
      </div>
    </div>
  );
}