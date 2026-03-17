/**
 * FNA Route Mounter — Lazy Loading
 * 
 * All FNA route modules are dynamically imported on first request.
 * Legacy paths are maintained for backward compatibility.
 */

import { lazy } from './lazy-router.ts';
import type { Hono } from 'npm:hono';

export function mountFnaRoutes(app: Hono) {
  // Batch status endpoint — must be registered before /fna catch-all
  lazy(app, '/fna/batch-status', () => import('./fna-batch-status-routes.ts'));

  // Current paths
  lazy(app, '/fna/retirement',      () => import('./retirement-fna-routes.ts'));
  lazy(app, '/fna/estate-planning', () => import('./estate-planning-fna-routes.ts'));
  lazy(app, '/fna/tax-planning',    () => import('./tax-planning-fna-routes.ts'));
  lazy(app, '/fna/medical',         () => import('./medical-fna-routes.ts'));
  lazy(app, '/fna',                 () => import('./fna-routes.ts'));
  lazy(app, '/ina/investment',      () => import('./investment-ina-routes.ts'));
  lazy(app, '/risk-planning-fna',   () => import('./risk-planning-fna-routes.ts'));

  // Legacy paths (backward compatibility)
  lazy(app, '/retirement-fna',      () => import('./retirement-fna-routes.ts'));
  lazy(app, '/estate-planning-fna', () => import('./estate-planning-fna-routes.ts'));
  lazy(app, '/tax-planning-fna',    () => import('./tax-planning-fna-routes.ts'));
  lazy(app, '/medical-fna',         () => import('./medical-fna-routes.ts'));
}