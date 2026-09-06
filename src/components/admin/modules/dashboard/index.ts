export { DashboardModule } from './DashboardModule';
export * from './types';
export * from './hooks';
export * from './utils';
export * from './api';
export { prefetchDashboardData } from './prefetch';

// --- public API used by other modules and by code outside admin/modules ---
export { DashboardSkeleton } from './components/DashboardSkeleton';
export { PlatformFeaturesCard } from './components/PlatformFeaturesCard';
export { VascoAnalyticsCard } from './components/VascoAnalyticsCard';
