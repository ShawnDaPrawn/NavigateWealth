import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { installFunctionRegionInterceptor } from './utils/api/functionRegion';

// Before the first render, so no request can escape unpinned. See
// functionRegion.ts for the measurement and the failover trade-off.
installFunctionRegionInterceptor();

createRoot(document.getElementById('root')!).render(<App />);
