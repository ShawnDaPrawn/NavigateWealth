/**
 * CRITICAL: Global Console Override
 * 
 * This file must be imported BEFORE any other imports in index.tsx.
 * 
 * Supabase Edge Functions use stdout for the HTTP response body.
 * Any console.log/info writes to stdout and corrupts the JSON response,
 * causing "Failed to fetch" or "Unexpected token" errors in the frontend.
 * 
 * We redirect console.log and console.info to stderr to prevent this corruption
 * while preserving logs in the Supabase dashboard.
 */

// Override console methods immediately upon import
(function() {
  const originalLog = console.log;
  const originalInfo = console.info;

  // Redirect console.log to console.error (stderr)
  console.log = function(...args: any[]) {
    console.error(...args);
  };

  // Redirect console.info to console.error (stderr)
  console.info = function(...args: any[]) {
    console.error(...args);
  };
})();

export const setupConsoleOverride = () => {
  return true;
};
