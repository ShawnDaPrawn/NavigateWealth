import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { installFunctionRegionInterceptor } from './utils/api/functionRegion';
import { installRuntimeIssueCapture } from './utils/quality/runtimeIssueReporter';

// Before the first render, so no request can escape unpinned. See
// functionRegion.ts for the measurement and the failover trade-off.
installFunctionRegionInterceptor();

// Error capture for the admin Issues dashboard: handled errors, API failures
// the server cannot see, and breadcrumbs. Installed after the region
// interceptor so it observes the final request as sent.
installRuntimeIssueCapture();

createRoot(document.getElementById('root')!).render(<App />);
