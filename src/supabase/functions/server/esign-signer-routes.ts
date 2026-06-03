/**
 * esign signer routes — thin orchestrator (Phase 5 decomposition).
 * Mounts 4 focused sub-routers extracted from the original 1,383-line file.
 */

import { Hono } from 'npm:hono';
import accessRoutes from './esign-signer-access-routes.ts';
import otpRoutes from './esign-signer-otp-routes.ts';
import submitRoutes from './esign-signer-submit-routes.ts';
import extrasRoutes from './esign-signer-extras-routes.ts';

const signerRoutes = new Hono();

signerRoutes.route('/', accessRoutes);
signerRoutes.route('/', otpRoutes);
signerRoutes.route('/', submitRoutes);
signerRoutes.route('/', extrasRoutes);

export default signerRoutes;
