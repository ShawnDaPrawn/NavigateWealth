import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resourcesApi, trainingApi, knowledgeApi } from '../api';

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockApiPut = vi.fn();
const mockApiDelete = vi.fn();
const mockApiPatch = vi.fn();

vi.mock('../../../../../utils/api/client', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: (...args: unknown[]) => mockApiPut(...args),
    delete: (...args: unknown[]) => mockApiDelete(...args),
    patch: (...args: unknown[]) => mockApiPatch(...args),
  },
}));

const MOCK_RESOURCE = {
  id: 'res-001',
  title: 'Tax Planning Guide',
  category: ['tax'],
  clientType: 'all',
  status: 'published',
};

const MOCK_TRAINING = {
  id: 'train-001',
  title: 'FAIS Compliance Training',
  type: 'video',
  category: 'compliance',
  difficulty: 'intermediate',
};

const MOCK_ARTICLE = {
  id: 'kb-001',
  title: 'Understanding TCF',
  category: 'compliance',
  tags: ['tcf', 'regulatory'],
};

const MOCK_LEGAL_DOC = {
  id: 'doc-001',
  slug: 'terms-of-service',
  title: 'Terms of Service',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resourcesApi', () => {
  it('getAll returns resources without filters', async () => {
    mockApiGet.mockResolvedValue({ resources: [MOCK_RESOURCE] });
    const result = await resourcesApi.getAll();
    expect(result).toEqual([MOCK_RESOURCE]);
    expect(mockApiGet).toHaveBeenCalledWith('/resources');
  });

  it('getAll applies category filter', async () => {
    mockApiGet.mockResolvedValue({ resources: [MOCK_RESOURCE] });
    await resourcesApi.getAll({ category: ['tax'] });
    expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('category=tax'));
  });

  it('getAll applies search filter', async () => {
    mockApiGet.mockResolvedValue({ resources: [] });
    await resourcesApi.getAll({ search: 'planning' });
    expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('search=planning'));
  });

  it('getAll applies clientType filter', async () => {
    mockApiGet.mockResolvedValue({ resources: [] });
    await resourcesApi.getAll({ clientType: 'retail' });
    expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('clientType=retail'));
  });

  it('getAll applies limit and offset filters', async () => {
    mockApiGet.mockResolvedValue({ resources: [] });
    await resourcesApi.getAll({ limit: 10, offset: 20 });
    const call = mockApiGet.mock.calls[0][0] as string;
    expect(call).toContain('limit=10');
    expect(call).toContain('offset=20');
  });

  it('getAll returns empty array when resources absent', async () => {
    mockApiGet.mockResolvedValue({});
    const result = await resourcesApi.getAll();
    expect(result).toEqual([]);
  });

  it('getById returns single resource', async () => {
    mockApiGet.mockResolvedValue({ resource: MOCK_RESOURCE });
    const result = await resourcesApi.getById('res-001');
    expect(result).toEqual(MOCK_RESOURCE);
    expect(mockApiGet).toHaveBeenCalledWith('/resources/res-001');
  });

  it('create posts resource and returns it', async () => {
    mockApiPost.mockResolvedValue({ resource: MOCK_RESOURCE });
    const result = await resourcesApi.create({ title: 'Tax Planning Guide' } as never);
    expect(result).toEqual(MOCK_RESOURCE);
    expect(mockApiPost).toHaveBeenCalledWith('/resources', expect.any(Object));
  });

  it('update puts resource and returns updated', async () => {
    const updated = { ...MOCK_RESOURCE, title: 'Updated Guide' };
    mockApiPut.mockResolvedValue({ resource: updated });
    const result = await resourcesApi.update('res-001', { title: 'Updated Guide' });
    expect(result.title).toBe('Updated Guide');
    expect(mockApiPut).toHaveBeenCalledWith('/resources/res-001', { title: 'Updated Guide' });
  });

  it('delete calls delete endpoint', async () => {
    mockApiDelete.mockResolvedValue(undefined);
    await resourcesApi.delete('res-001');
    expect(mockApiDelete).toHaveBeenCalledWith('/resources/res-001');
  });

  it('duplicate posts to duplicate endpoint', async () => {
    mockApiPost.mockResolvedValue({ resource: { ...MOCK_RESOURCE, id: 'res-002' } });
    const result = await resourcesApi.duplicate('res-001');
    expect(result.id).toBe('res-002');
    expect(mockApiPost).toHaveBeenCalledWith('/resources/res-001/duplicate');
  });

  it('updateStatus patches status', async () => {
    const updated = { ...MOCK_RESOURCE, status: 'archived' };
    mockApiPatch.mockResolvedValue({ resource: updated });
    const result = await resourcesApi.updateStatus('res-001', 'archived');
    expect(result.status).toBe('archived');
    expect(mockApiPatch).toHaveBeenCalledWith('/resources/res-001/status', { status: 'archived' });
  });

  it('getStats returns resource statistics', async () => {
    const stats = { total: 10, byCategory: { tax: 5 }, byClientType: { all: 10 } };
    mockApiGet.mockResolvedValue(stats);
    const result = await resourcesApi.getStats();
    expect(result.total).toBe(10);
    expect(mockApiGet).toHaveBeenCalledWith('/resources/stats');
  });

  it('getLegalDocuments returns documents list', async () => {
    mockApiGet.mockResolvedValue({ documents: [MOCK_LEGAL_DOC] });
    const result = await resourcesApi.getLegalDocuments();
    expect(result).toEqual([MOCK_LEGAL_DOC]);
    expect(mockApiGet).toHaveBeenCalledWith('/resources/admin/legal-documents');
  });

  it('getLegalDocuments returns empty array when absent', async () => {
    mockApiGet.mockResolvedValue({});
    const result = await resourcesApi.getLegalDocuments();
    expect(result).toEqual([]);
  });

  it('getLegalDocument returns single document', async () => {
    mockApiGet.mockResolvedValue(MOCK_LEGAL_DOC);
    const result = await resourcesApi.getLegalDocument('terms-of-service');
    expect(result).toEqual(MOCK_LEGAL_DOC);
    expect(mockApiGet).toHaveBeenCalledWith('/resources/admin/legal-documents/terms-of-service');
  });

  it('getLegalDocumentVersions returns versions', async () => {
    const versions = [{ id: 'v1', version: '1.0' }];
    mockApiGet.mockResolvedValue({ versions });
    const result = await resourcesApi.getLegalDocumentVersions('terms-of-service');
    expect(result).toEqual(versions);
  });

  it('getLegalDocumentVersions returns empty array when absent', async () => {
    mockApiGet.mockResolvedValue({});
    const result = await resourcesApi.getLegalDocumentVersions('terms-of-service');
    expect(result).toEqual([]);
  });

  it('getLegalDocumentAudit returns audit entries', async () => {
    const entries = [{ id: 'e1', action: 'published', at: '2025-01-01' }];
    mockApiGet.mockResolvedValue({ entries });
    const result = await resourcesApi.getLegalDocumentAudit('terms-of-service');
    expect(result).toEqual(entries);
  });

  it('getLegalDocumentAudit returns empty array when absent', async () => {
    mockApiGet.mockResolvedValue({});
    const result = await resourcesApi.getLegalDocumentAudit('terms-of-service');
    expect(result).toEqual([]);
  });

  it('migrateLegalDocument posts to migrate endpoint', async () => {
    mockApiPost.mockResolvedValue(MOCK_LEGAL_DOC);
    const result = await resourcesApi.migrateLegalDocument('terms-of-service');
    expect(mockApiPost).toHaveBeenCalledWith(
      '/resources/admin/legal-documents/terms-of-service/migrate',
    );
  });

  it('migratePriorityLegalDocuments posts to batch migrate endpoint', async () => {
    mockApiPost.mockResolvedValue({ migrated: 3 });
    await resourcesApi.migratePriorityLegalDocuments();
    expect(mockApiPost).toHaveBeenCalledWith('/resources/admin/legal-documents/migrate-priority');
  });

  it('createLegalDocumentDraft posts draft', async () => {
    mockApiPost.mockResolvedValue(MOCK_LEGAL_DOC);
    await resourcesApi.createLegalDocumentDraft('terms-of-service', {
      content: 'Draft text',
    } as never);
    expect(mockApiPost).toHaveBeenCalledWith(
      '/resources/admin/legal-documents/terms-of-service/drafts',
      { content: 'Draft text' },
    );
  });

  it('updateLegalDocumentDraft puts draft', async () => {
    mockApiPut.mockResolvedValue(MOCK_LEGAL_DOC);
    await resourcesApi.updateLegalDocumentDraft('terms-of-service', 'v1', {
      content: 'Updated',
    } as never);
    expect(mockApiPut).toHaveBeenCalledWith(
      '/resources/admin/legal-documents/terms-of-service/versions/v1',
      { content: 'Updated' },
    );
  });

  it('publishLegalDocumentDraft posts to publish endpoint', async () => {
    mockApiPost.mockResolvedValue(MOCK_LEGAL_DOC);
    await resourcesApi.publishLegalDocumentDraft('terms-of-service', 'v1');
    expect(mockApiPost).toHaveBeenCalledWith(
      '/resources/admin/legal-documents/terms-of-service/versions/v1/publish',
    );
  });

  it('archiveLegalDocumentVersion posts to archive endpoint', async () => {
    mockApiPost.mockResolvedValue(MOCK_LEGAL_DOC);
    await resourcesApi.archiveLegalDocumentVersion('terms-of-service', 'v1');
    expect(mockApiPost).toHaveBeenCalledWith(
      '/resources/admin/legal-documents/terms-of-service/versions/v1/archive',
    );
  });

  it('duplicateLegalDocumentVersion posts to duplicate endpoint', async () => {
    mockApiPost.mockResolvedValue(MOCK_LEGAL_DOC);
    await resourcesApi.duplicateLegalDocumentVersion('terms-of-service', 'v1');
    expect(mockApiPost).toHaveBeenCalledWith(
      '/resources/admin/legal-documents/terms-of-service/versions/v1/duplicate',
    );
  });
});

describe('trainingApi', () => {
  it('getAll returns training resources without filters', async () => {
    mockApiGet.mockResolvedValue([MOCK_TRAINING]);
    const result = await trainingApi.getAll();
    expect(result).toEqual([MOCK_TRAINING]);
    expect(mockApiGet).toHaveBeenCalledWith('/resources/training');
  });

  it('getAll applies type and category filters', async () => {
    mockApiGet.mockResolvedValue([]);
    await trainingApi.getAll({ type: 'video', category: 'compliance' });
    const call = mockApiGet.mock.calls[0][0] as string;
    expect(call).toContain('type=video');
    expect(call).toContain('category=compliance');
  });

  it('getAll applies difficulty and search filters', async () => {
    mockApiGet.mockResolvedValue([]);
    await trainingApi.getAll({ difficulty: 'beginner', search: 'FAIS' });
    const call = mockApiGet.mock.calls[0][0] as string;
    expect(call).toContain('difficulty=beginner');
    expect(call).toContain('search=FAIS');
  });

  it('getById returns single training resource', async () => {
    mockApiGet.mockResolvedValue(MOCK_TRAINING);
    const result = await trainingApi.getById('train-001');
    expect(result).toEqual(MOCK_TRAINING);
    expect(mockApiGet).toHaveBeenCalledWith('/resources/training/train-001');
  });

  it('trackView posts view event', async () => {
    mockApiPost.mockResolvedValue(undefined);
    await trainingApi.trackView('train-001');
    expect(mockApiPost).toHaveBeenCalledWith('/resources/training/train-001/view');
  });

  it('rate posts rating', async () => {
    mockApiPost.mockResolvedValue(undefined);
    await trainingApi.rate('train-001', 5);
    expect(mockApiPost).toHaveBeenCalledWith('/resources/training/train-001/rate', { rating: 5 });
  });
});

describe('knowledgeApi', () => {
  it('getAll returns knowledge articles without filters', async () => {
    mockApiGet.mockResolvedValue([MOCK_ARTICLE]);
    const result = await knowledgeApi.getAll();
    expect(result).toEqual([MOCK_ARTICLE]);
    expect(mockApiGet).toHaveBeenCalledWith('/resources/knowledge');
  });

  it('getAll applies category and tags filters', async () => {
    mockApiGet.mockResolvedValue([]);
    await knowledgeApi.getAll({ category: 'compliance', tags: ['tcf', 'regulatory'] });
    const call = mockApiGet.mock.calls[0][0] as string;
    expect(call).toContain('category=compliance');
    expect(call).toContain('tags=tcf%2Cregulatory');
  });

  it('getAll applies search filter', async () => {
    mockApiGet.mockResolvedValue([]);
    await knowledgeApi.getAll({ search: 'TCF' });
    expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('search=TCF'));
  });

  it('getById returns single article', async () => {
    mockApiGet.mockResolvedValue(MOCK_ARTICLE);
    const result = await knowledgeApi.getById('kb-001');
    expect(result).toEqual(MOCK_ARTICLE);
    expect(mockApiGet).toHaveBeenCalledWith('/resources/knowledge/kb-001');
  });

  it('trackView posts view event', async () => {
    mockApiPost.mockResolvedValue(undefined);
    await knowledgeApi.trackView('kb-001');
    expect(mockApiPost).toHaveBeenCalledWith('/resources/knowledge/kb-001/view');
  });

  it('markHelpful posts helpful event', async () => {
    mockApiPost.mockResolvedValue(undefined);
    await knowledgeApi.markHelpful('kb-001');
    expect(mockApiPost).toHaveBeenCalledWith('/resources/knowledge/kb-001/helpful');
  });

  it('search returns matching articles', async () => {
    mockApiGet.mockResolvedValue([MOCK_ARTICLE]);
    const result = await knowledgeApi.search('TCF');
    expect(result).toEqual([MOCK_ARTICLE]);
    expect(mockApiGet).toHaveBeenCalledWith('/resources/knowledge/search?q=TCF');
  });

  it('search encodes special characters in query', async () => {
    mockApiGet.mockResolvedValue([]);
    await knowledgeApi.search('tax & levy');
    expect(mockApiGet).toHaveBeenCalledWith(
      expect.stringContaining('/resources/knowledge/search?q='),
    );
  });
});
