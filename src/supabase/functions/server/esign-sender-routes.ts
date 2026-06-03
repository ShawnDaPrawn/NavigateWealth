/**
 * esign sender routes — thin orchestrator (Phase 5 decomposition).
 * Mounts 5 focused sub-routers extracted from the original 1,408-line file.
 */

import { Hono } from 'npm:hono';
import envelopeRoutes from './esign-sender-envelope-routes.ts';
import auditRoutes from './esign-sender-audit-routes.ts';
import lifecycleRoutes from './esign-sender-lifecycle-routes.ts';
import downloadRoutes from './esign-sender-download-routes.ts';
import kbaRoutes from './esign-sender-kba-routes.ts';

const senderRoutes = new Hono();

senderRoutes.route('/', envelopeRoutes);
senderRoutes.route('/', auditRoutes);
senderRoutes.route('/', lifecycleRoutes);
senderRoutes.route('/', downloadRoutes);
senderRoutes.route('/', kbaRoutes);

export default senderRoutes;
