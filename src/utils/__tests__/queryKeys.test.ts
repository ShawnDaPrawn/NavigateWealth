/**
 * queryKeys — unit tests (Phase 4 coverage push).
 *
 * The centralized React Query key factory. Exercises every key function with
 * exact expected tuples, which both covers the factory and documents/locks the
 * key shapes (a changed key is a cache-invalidation contract change).
 */
import { describe, expect, it } from 'vitest';
import {
  adminStatsKeys,
  pendingCountsKeys,
  dashboardKeys,
  aiManagementKeys,
  clientDataKeys,
  clientKeys,
  tasksKeys,
  submissionsKeys,
  requestKeys,
  communicationKeys,
  advisorKeys,
  vascoKeys,
  adviceEngineKeys,
  willChatKeys,
  integrationsKeys,
  productKeys,
  publicationsKeys,
  publicationKeys,
  newsletterKeys,
  applicationKeys,
  socialMediaKeys,
  calendarKeys,
  personnelKeys,
  permissionKeys,
  resourceKeys,
  fnaKeys,
  riskFnaKeys,
  medicalFnaKeys,
  complianceKeys,
  esignKeys,
  noteKeys,
} from '../queryKeys';

describe('admin / dashboard keys', () => {
  it('root prefixes', () => {
    expect(adminStatsKeys.all).toEqual(['admin-stats']);
    expect(pendingCountsKeys.all).toEqual(['pendingCounts']);
  });
  it('dashboardKeys', () => {
    expect(dashboardKeys.all).toEqual(['dashboard']);
    expect(dashboardKeys.stats()).toEqual(['dashboard-stats']);
    expect(dashboardKeys.metrics()).toEqual(['dashboard-metrics']);
    expect(dashboardKeys.tasksToday()).toEqual(['dashboard-tasks-today']);
    expect(dashboardKeys.recentRequests()).toEqual(['dashboard-recent-requests']);
  });
});

describe('aiManagementKeys', () => {
  it('builds hierarchical keys', () => {
    expect(aiManagementKeys.all).toEqual(['ai-management']);
    expect(aiManagementKeys.agents()).toEqual(['ai-management', 'agents']);
    expect(aiManagementKeys.agent('a1')).toEqual(['ai-management', 'agent', 'a1']);
    expect(aiManagementKeys.vascoConfig()).toEqual(['ai-management', 'vasco-config']);
    expect(aiManagementKeys.analytics()).toEqual(['ai-management', 'analytics']);
    expect(aiManagementKeys.feedback()).toEqual(['ai-management', 'feedback']);
    expect(aiManagementKeys.handoffs()).toEqual(['ai-management', 'handoffs', 'all']);
    expect(aiManagementKeys.handoffs('open')).toEqual(['ai-management', 'handoffs', 'open']);
    expect(aiManagementKeys.ragIndex()).toEqual(['ai-management', 'rag-index']);
    expect(aiManagementKeys.kbEntries()).toEqual(['ai-management', 'kb-entries']);
    expect(aiManagementKeys.kbEntry('k1')).toEqual(['ai-management', 'kb-entry', 'k1']);
    expect(aiManagementKeys.kbStats()).toEqual(['ai-management', 'kb-stats']);
  });
});

describe('client keys', () => {
  it('clientDataKeys', () => {
    expect(clientDataKeys.all).toEqual(['client-keys']);
    expect(clientDataKeys.byClient('c1')).toEqual(['client-keys', 'c1']);
  });
  it('clientKeys', () => {
    expect(clientKeys.all).toEqual(['clients']);
    expect(clientKeys.lists()).toEqual(['clients', 'list']);
    expect(clientKeys.list()).toEqual(['clients', 'list', {}]);
    expect(clientKeys.list({ q: 1 })).toEqual(['clients', 'list', { q: 1 }]);
    expect(clientKeys.details()).toEqual(['clients', 'detail']);
    expect(clientKeys.detail('c1')).toEqual(['clients', 'detail', 'c1']);
    expect(clientKeys.profile('c1')).toEqual(['clients', 'profile', 'c1']);
    expect(clientKeys.keys('c1')).toEqual(['clients', 'keys', 'c1']);
    expect(clientKeys.clientKeys.all('c1')).toEqual(['client-keys', 'c1']);
    expect(clientKeys.clientKeys.history('c1', 'k1')).toEqual(['client-key-history', 'c1', 'k1']);
    expect(clientKeys.communicationLogs('c1')).toEqual(['client-logs', 'c1']);
  });
});

describe('tasks / submissions / requests', () => {
  it('tasksKeys', () => {
    expect(tasksKeys.all).toEqual(['tasks']);
    expect(tasksKeys.lists()).toEqual(['tasks', 'list']);
    expect(tasksKeys.list({ a: 1 })).toEqual(['tasks', 'list', { a: 1 }]);
    expect(tasksKeys.dueToday()).toEqual(['tasksDueToday']);
    expect(tasksKeys.detail('t1')).toEqual(['tasks', 'detail', 't1']);
  });
  it('submissionsKeys', () => {
    expect(submissionsKeys.lists()).toEqual(['submissions', 'list']);
    expect(submissionsKeys.list()).toEqual(['submissions', 'list', {}]);
    expect(submissionsKeys.details()).toEqual(['submissions', 'detail']);
    expect(submissionsKeys.detail('s1')).toEqual(['submissions', 'detail', 's1']);
    expect(submissionsKeys.countNew()).toEqual(['submissions', 'count', 'new']);
  });
  it('requestKeys', () => {
    expect(requestKeys.lists()).toEqual(['requests', 'list']);
    expect(requestKeys.list()).toEqual(['requests', 'list', {}]);
    expect(requestKeys.detail('r1')).toEqual(['requests', 'detail', 'r1']);
    expect(requestKeys.templates()).toEqual(['requests', 'templates']);
    expect(requestKeys.templateList()).toEqual(['requests', 'templates', {}]);
    expect(requestKeys.template('t1')).toEqual(['requests', 'templates', 't1']);
  });
});

describe('communications / advisor / vasco', () => {
  it('communicationKeys', () => {
    expect(communicationKeys.byUser('u1')).toEqual(['communications', 'u1']);
    expect(communicationKeys.byUser(undefined)).toEqual(['communications', undefined]);
    expect(communicationKeys.preferences('u1')).toEqual(['communications', 'preferences', 'u1']);
  });
  it('advisorKeys', () => {
    expect(advisorKeys.status()).toEqual(['advisor', 'status']);
    expect(advisorKeys.history('u1')).toEqual(['advisor', 'history', 'u1']);
    expect(advisorKeys.sessions('u1')).toEqual(['advisor', 'sessions', 'u1']);
    expect(advisorKeys.session('u1', 's1')).toEqual(['advisor', 'session', 'u1', 's1']);
    expect(advisorKeys.adminClientHistory('c1')).toEqual(['advisor', 'admin-client-history', 'c1']);
    expect(advisorKeys.adminClientSessions('c1')).toEqual([
      'advisor',
      'admin-client-sessions',
      'c1',
    ]);
    expect(advisorKeys.adminClientSession('c1', 's1')).toEqual([
      'advisor',
      'admin-client-session',
      'c1',
      's1',
    ]);
  });
  it('vascoKeys', () => {
    expect(vascoKeys.status()).toEqual(['vasco', 'status']);
    expect(vascoKeys.config()).toEqual(['vasco', 'config']);
    expect(vascoKeys.analytics()).toEqual(['vasco', 'analytics']);
    expect(vascoKeys.feedback()).toEqual(['vasco', 'feedback']);
    expect(vascoKeys.handoffs()).toEqual(['vasco', 'handoffs']);
    expect(vascoKeys.indexStatus()).toEqual(['vasco', 'index-status']);
  });
});

describe('advice engine / will chat', () => {
  it('adviceEngineKeys', () => {
    expect(adviceEngineKeys.ai.status()).toEqual(['ai-intelligence', 'status']);
    expect(adviceEngineKeys.ai.history()).toEqual(['ai-intelligence', 'history']);
    expect(adviceEngineKeys.ai.searchClients('t')).toEqual([
      'ai-intelligence',
      'search-clients',
      't',
    ]);
    expect(adviceEngineKeys.roa.drafts()).toEqual(['roa', 'drafts']);
    expect(adviceEngineKeys.roa.draft('d1')).toEqual(['roa', 'draft', 'd1']);
    expect(adviceEngineKeys.roa.modules()).toEqual(['roa', 'modules']);
    expect(adviceEngineKeys.roa.moduleContracts()).toEqual(['roa', 'module-contracts', {}]);
    expect(adviceEngineKeys.roa.moduleContract('m1')).toEqual(['roa', 'module-contract', 'm1']);
    expect(adviceEngineKeys.roa.moduleContractSchema()).toEqual(['roa', 'module-contract-schema']);
    expect(adviceEngineKeys.roa.clientContext('c1')).toEqual(['roa', 'client-context', 'c1']);
    expect(adviceEngineKeys.client('c1')).toEqual(['client', 'c1']);
    expect(adviceEngineKeys.personnel()).toEqual(['personnel']);
  });
  it('willChatKeys', () => {
    expect(willChatKeys.status()).toEqual(['will-chat', 'status']);
    expect(willChatKeys.sessions('c1')).toEqual(['will-chat', 'sessions', 'c1']);
    expect(willChatKeys.session('s1')).toEqual(['will-chat', 'session', 's1']);
  });
});

describe('integrations / products', () => {
  it('integrationsKeys', () => {
    expect(integrationsKeys.providers()).toEqual(['integrations', 'providers']);
    expect(integrationsKeys.history('p', 'c')).toEqual(['integrations', 'history', 'p', 'c']);
    expect(integrationsKeys.config('p', 'c')).toEqual(['integrations', 'config', 'p', 'c']);
    expect(integrationsKeys.portalFlow('p', 'c')).toEqual([
      'integrations',
      'portal-flow',
      'p',
      'c',
    ]);
    expect(integrationsKeys.portalBrainMemory('p', 'c')).toEqual([
      'integrations',
      'portal-brain-memory',
      'p',
      'c',
    ]);
    expect(integrationsKeys.portalCredentialStatus('p', 'pr')).toEqual([
      'integrations',
      'portal-credential-status',
      'p',
      'pr',
    ]);
    expect(integrationsKeys.portalJob('j')).toEqual(['integrations', 'portal-job', 'j']);
    expect(integrationsKeys.portalJobItems('j')).toEqual(['integrations', 'portal-job-items', 'j']);
    expect(integrationsKeys.latestPortalJob('p', 'c')).toEqual([
      'integrations',
      'portal-job-latest',
      'p',
      'c',
    ]);
    expect(integrationsKeys.portalDiscoveryReport('j')).toEqual([
      'integrations',
      'portal-discovery-report',
      'j',
    ]);
    expect(integrationsKeys.syncRun('r')).toEqual(['integrations', 'sync-run', 'r']);
  });
  it('productKeys', () => {
    expect(productKeys.providers()).toEqual(['product-management', 'providers']);
    expect(productKeys.provider('p1')).toEqual(['product-management', 'providers', 'p1']);
    expect(productKeys.schemas()).toEqual(['product-management', 'schemas']);
    expect(productKeys.schema('cat')).toEqual(['product-management', 'schemas', 'cat']);
  });
});

describe('publications / newsletter / applications', () => {
  it('publicationsKeys + publicationKeys', () => {
    expect(publicationsKeys.initialization()).toEqual(['publications', 'initialization']);
    expect(publicationKeys.articles()).toEqual(['publications', 'articles']);
    expect(publicationKeys.articleList()).toEqual(['publications', 'articles', {}]);
    expect(publicationKeys.article('a1')).toEqual(['publications', 'articles', 'a1']);
    expect(publicationKeys.categories()).toEqual(['publications', 'categories']);
    expect(publicationKeys.types()).toEqual(['publications', 'types']);
    expect(publicationKeys.stats()).toEqual(['publications', 'stats']);
    expect(publicationKeys.marketNews()).toEqual(['publications', 'market-news']);
    expect(publicationKeys.templates()).toEqual(['publications', 'templates']);
    expect(publicationKeys.versions('a1')).toEqual(['publications', 'versions', 'a1']);
  });
  it('newsletterKeys', () => {
    expect(newsletterKeys.subscribers()).toEqual(['newsletter', 'subscribers']);
    expect(newsletterKeys.stats()).toEqual(['newsletter', 'stats']);
  });
  it('applicationKeys', () => {
    expect(applicationKeys.lists()).toEqual(['applications', 'list']);
    expect(applicationKeys.detail('a1')).toEqual(['applications', 'detail', 'a1']);
    expect(applicationKeys.steps('a1')).toEqual(['applications', 'steps', 'a1']);
    expect(applicationKeys.step('a1', 2)).toEqual(['applications', 'step', 'a1', 2]);
    expect(applicationKeys.byUser('u1')).toEqual(['applications', 'user', 'u1']);
  });
});

describe('socialMediaKeys', () => {
  it('profiles + posts', () => {
    expect(socialMediaKeys.profiles.lists()).toEqual(['social-media', 'profiles', 'list']);
    expect(socialMediaKeys.profiles.detail('p1')).toEqual([
      'social-media',
      'profiles',
      'detail',
      'p1',
    ]);
    expect(socialMediaKeys.posts.list()).toEqual(['social-media', 'posts', 'list', {}]);
    expect(socialMediaKeys.posts.detail('p1')).toEqual(['social-media', 'posts', 'detail', 'p1']);
    expect(socialMediaKeys.posts.analytics('p1')).toEqual([
      'social-media',
      'posts',
      'analytics',
      'p1',
    ]);
    expect(socialMediaKeys.posts.dateRange('s', 'e')).toEqual([
      'social-media',
      'posts',
      'date-range',
      's',
      'e',
    ]);
  });
  it('campaigns + analytics + ai', () => {
    expect(socialMediaKeys.campaigns.detail('c1')).toEqual([
      'social-media',
      'campaigns',
      'detail',
      'c1',
    ]);
    expect(socialMediaKeys.campaigns.posts('c1')).toEqual([
      'social-media',
      'campaigns',
      'posts',
      'c1',
    ]);
    expect(socialMediaKeys.campaigns.analytics('c1')).toEqual([
      'social-media',
      'campaigns',
      'analytics',
      'c1',
    ]);
    expect(socialMediaKeys.analytics.overview()).toEqual(['social-media', 'analytics', 'overview']);
    expect(socialMediaKeys.analytics.topPosts()).toEqual([
      'social-media',
      'analytics',
      'top-posts',
      10,
    ]);
    expect(socialMediaKeys.analytics.topPosts(5)).toEqual([
      'social-media',
      'analytics',
      'top-posts',
      5,
    ]);
    expect(socialMediaKeys.ai.history()).toEqual(['social-media', 'ai', 'history', 20]);
    expect(socialMediaKeys.ai.generation('g')).toEqual(['social-media', 'ai', 'generation', 'g']);
    expect(socialMediaKeys.ai.status()).toEqual(['social-media', 'ai', 'status']);
    expect(socialMediaKeys.ai.imageHistory()).toEqual(['social-media', 'ai', 'image-history', 20]);
    expect(socialMediaKeys.ai.imageGeneration('g')).toEqual([
      'social-media',
      'ai',
      'image-generation',
      'g',
    ]);
    expect(socialMediaKeys.ai.templates()).toEqual(['social-media', 'ai', 'templates']);
    expect(socialMediaKeys.ai.template('t')).toEqual(['social-media', 'ai', 'template', 't']);
    expect(socialMediaKeys.ai.analytics()).toEqual(['social-media', 'ai', 'analytics']);
  });
});

describe('calendar / personnel / resources', () => {
  it('calendarKeys', () => {
    expect(calendarKeys.birthdays(2026)).toEqual(['client-birthdays', 2026]);
    expect(calendarKeys.renewals(2026)).toEqual(['policy-renewals', 2026]);
    expect(calendarKeys.events.list()).toEqual(['calendar', 'events', 'list', {}]);
    expect(calendarKeys.events.detail('e1')).toEqual(['calendar', 'events', 'detail', 'e1']);
  });
  it('personnelKeys + permissionKeys', () => {
    expect(personnelKeys.lists()).toEqual(['personnel', 'list']);
    expect(personnelKeys.details()).toEqual(['personnel', 'detail']);
    expect(personnelKeys.detail('p1')).toEqual(['personnel', 'detail', 'p1']);
    expect(personnelKeys.clients('p1')).toEqual(['personnel', 'detail', 'p1', 'clients']);
    expect(personnelKeys.superAdmin()).toEqual(['personnel', 'super-admin']);
    expect(permissionKeys.all).toEqual(['personnel', 'permissions']);
    expect(permissionKeys.detail('p1')).toEqual(['personnel', 'permissions', 'p1']);
    expect(permissionKeys.me()).toEqual(['personnel', 'permissions', 'me']);
  });
  it('resourceKeys', () => {
    expect(resourceKeys.lists()).toEqual(['resources', 'list']);
    expect(resourceKeys.detail('r1')).toEqual(['resources', 'detail', 'r1']);
    expect(resourceKeys.legalDocuments()).toEqual(['resources', 'legal-documents']);
    expect(resourceKeys.legalDocument('slug')).toEqual(['resources', 'legal-documents', 'slug']);
    expect(resourceKeys.legalDocumentVersions('slug')).toEqual([
      'resources',
      'legal-documents',
      'slug',
      'versions',
    ]);
  });
});

describe('fna / compliance / esign / notes', () => {
  it('fnaKeys + riskFnaKeys + medicalFnaKeys', () => {
    expect(fnaKeys.clientSessions('c1')).toEqual(['fna', 'sessions', 'c1']);
    expect(fnaKeys.latestPublished('c1')).toEqual(['fna', 'latest-published', 'c1']);
    expect(fnaKeys.session('f1')).toEqual(['fna', 'session', 'f1']);
    expect(fnaKeys.batchStatus('c1')).toEqual(['fna', 'batch-status', 'c1']);
    expect(riskFnaKeys.list('c1')).toEqual(['risk-fna', 'list', 'c1']);
    expect(riskFnaKeys.detail('d1')).toEqual(['risk-fna', 'detail', 'd1']);
    expect(riskFnaKeys.clientProfile('c1')).toEqual(['risk-fna', 'client-profile', 'c1']);
    expect(medicalFnaKeys.policies('c1')).toEqual(['medical-aid-policies', 'c1']);
  });
  it('complianceKeys + esignKeys + noteKeys', () => {
    expect(complianceKeys.overview()).toEqual(['compliance', 'overview']);
    expect(complianceKeys.records('tab')).toEqual(['compliance', 'records', 'tab']);
    expect(esignKeys.envelopes()).toEqual(['esign', 'envelopes']);
    expect(esignKeys.envelope('e1')).toEqual(['esign', 'envelopes', 'e1']);
    expect(esignKeys.templates()).toEqual(['esign', 'templates']);
    expect(esignKeys.dashboard()).toEqual(['esign', 'dashboard']);
    expect(noteKeys.list('p1')).toEqual(['notes', 'list', 'p1']);
    expect(noteKeys.detail('n1')).toEqual(['notes', 'detail', 'n1']);
    expect(noteKeys.clientNotes('c1')).toEqual(['notes', 'client', 'c1']);
  });
});
