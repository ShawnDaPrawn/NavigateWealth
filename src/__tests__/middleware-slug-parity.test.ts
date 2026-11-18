/**
 * The edge middleware decides which /legal/<slug> and /get-quote/<service>
 * addresses exist, and answers a real 404 for everything else. It cannot import
 * the app's own lists (middleware.ts must stay free of SPA-tree imports — see
 * docs/STATUS.md, "Deliberate fallbacks"), so it carries copies. This suite
 * fails the moment a copy drifts: a legal document or quote service added to
 * the app but not to the middleware would otherwise 404 in production.
 *
 * It lives outside src/middleware/ on purpose: the quote constants import
 * provider logos through `figma:asset/…`, which `typecheck:middleware` cannot
 * resolve.
 */
import { describe, expect, it } from 'vitest';
import { LEGAL_DOCUMENT_SLUGS, QUOTE_SERVICE_SLUGS } from '../middleware/route-policy';
import { LEGAL_DOCUMENTS_REGISTRY } from '../shared/legal-documents-registry';
import { QUOTE_SERVICES } from '../components/pages/quote/constants';

describe('middleware slug lists match the app', () => {
  it('lists every published legal document', () => {
    expect([...LEGAL_DOCUMENT_SLUGS].sort()).toEqual(
      LEGAL_DOCUMENTS_REGISTRY.map((doc) => doc.slug).sort(),
    );
  });

  it('lists every quote service', () => {
    expect([...QUOTE_SERVICE_SLUGS].sort()).toEqual(
      QUOTE_SERVICES.map((service) => service.id).sort(),
    );
  });
});
