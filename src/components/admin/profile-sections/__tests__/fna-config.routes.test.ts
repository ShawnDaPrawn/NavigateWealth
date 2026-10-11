/**
 * The FNA registry's list and view calls hit routes the server actually has.
 *
 * The category tab used to build these URLs by hand. For Investment INA and
 * Estate Planning it built `/investment-ina/...` and `/estate-planning-fna/:id`
 * — routes that do not exist — so their FNA list and "View" answered 404 and a
 * published FNA could be found nowhere. The registry now goes through each
 * module's own API; this pins the paths that produces (the server mounts are in
 * src/supabase/functions/server/mount-fna.ts).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockApiPut = vi.fn();
const mockApiDelete = vi.fn();

vi.mock('../../../../utils/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: (...args: unknown[]) => mockApiPut(...args),
    delete: (...args: unknown[]) => mockApiDelete(...args),
  },
  APIError: class APIError extends Error {},
  resolveApiEndpoint: (url: string) => url,
}));

const { FNA_CONFIGS } = await import('../fna-config');

const CLIENT = 'client-1';
const FNA = 'fna-1';

const EXPECTED: Record<string, { list: string; view: string }> = {
  'risk-planning': {
    list: `/risk-planning-fna/client/${CLIENT}/list`,
    view: `/risk-planning-fna/${FNA}`,
  },
  'medical-aid': {
    list: `/medical-fna/client/${CLIENT}`,
    view: `/medical-fna/${FNA}?clientId=${CLIENT}`,
  },
  retirement: {
    list: `/retirement-fna/client/${CLIENT}`,
    view: `/retirement-fna/${FNA}`,
  },
  investments: {
    list: `/ina/investment/client/${CLIENT}/sessions`,
    view: `/ina/investment/session/${FNA}?clientId=${CLIENT}`,
  },
  'tax-planning': {
    list: `/tax-planning-fna/client/${CLIENT}`,
    view: `/tax-planning-fna/${FNA}`,
  },
  'estate-planning': {
    list: `/estate-planning-fna/client/${CLIENT}/sessions`,
    view: `/estate-planning-fna/session/${FNA}?clientId=${CLIENT}`,
  },
};

beforeEach(() => {
  mockApiGet.mockReset();
  mockApiGet.mockResolvedValue({ success: true, data: [] });
  for (const mock of [mockApiPost, mockApiPut, mockApiDelete]) {
    mock.mockReset();
    mock.mockResolvedValue({ success: true, data: { id: FNA } });
  }
});

/**
 * Delete, publish and unpublish. Each was missing somewhere: Retirement had no
 * server routes for delete or unpublish (Delete answered 404), Tax stubbed all
 * three as no-ops (Delete reported success and deleted nothing), and Investment
 * and Estate had no publish or unpublish routes. The `?clientId=` is there for
 * FNAs created from a client intake, whose ids do not name their client.
 */
const q = `?clientId=${CLIENT}`;
const LIFECYCLE: Record<
  string,
  Record<'delete' | 'publish' | 'unpublish', [method: 'POST' | 'PUT' | 'DELETE', path: string]>
> = {
  'risk-planning': {
    delete: ['DELETE', `/risk-planning-fna/archive/${FNA}`],
    publish: ['POST', `/risk-planning-fna/publish/${FNA}`],
    unpublish: ['POST', `/risk-planning-fna/unpublish/${FNA}`],
  },
  'medical-aid': {
    delete: ['DELETE', `/medical-fna/delete/${FNA}${q}`],
    publish: ['POST', `/medical-fna/publish/${FNA}${q}`],
    unpublish: ['POST', `/medical-fna/unpublish/${FNA}${q}`],
  },
  retirement: {
    delete: ['DELETE', `/retirement-fna/${FNA}`],
    publish: ['PUT', `/retirement-fna/${FNA}/publish`],
    unpublish: ['PUT', `/retirement-fna/${FNA}/unpublish`],
  },
  investments: {
    delete: ['DELETE', `/ina/investment/session/${FNA}${q}`],
    publish: ['PUT', `/ina/investment/session/${FNA}/publish${q}`],
    unpublish: ['PUT', `/ina/investment/session/${FNA}/unpublish${q}`],
  },
  'tax-planning': {
    delete: ['DELETE', `/tax-planning-fna/${FNA}${q}`],
    publish: ['PUT', `/tax-planning-fna/${FNA}/publish${q}`],
    unpublish: ['PUT', `/tax-planning-fna/${FNA}/unpublish${q}`],
  },
  'estate-planning': {
    delete: ['DELETE', `/estate-planning-fna/session/${FNA}${q}`],
    publish: ['PUT', `/estate-planning-fna/session/${FNA}/publish${q}`],
    unpublish: ['PUT', `/estate-planning-fna/session/${FNA}/unpublish${q}`],
  },
};

const MOCK_BY_METHOD = { POST: mockApiPost, PUT: mockApiPut, DELETE: mockApiDelete };

describe('FNA registry delete, publish and unpublish routes', () => {
  it('covers every FNA type', () => {
    expect(Object.keys(LIFECYCLE).sort()).toEqual(Object.keys(FNA_CONFIGS).sort());
  });

  it.each(Object.entries(LIFECYCLE))('%s calls a real route for each', async (category, calls) => {
    const config = FNA_CONFIGS[category];
    await config.deleteFNA(FNA, CLIENT);
    await config.publishFNA(FNA, CLIENT);
    await config.unpublishFNA(FNA, CLIENT);
    for (const [method, path] of Object.values(calls)) {
      expect(MOCK_BY_METHOD[method]).toHaveBeenCalledWith(path);
    }
  });
});

describe('FNA registry list and view routes', () => {
  it('covers every FNA type', () => {
    expect(Object.keys(FNA_CONFIGS).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it.each(Object.entries(EXPECTED))('%s lists the client’s FNAs', async (category, paths) => {
    await FNA_CONFIGS[category].listForClient(CLIENT);
    expect(mockApiGet).toHaveBeenCalledWith(paths.list);
  });

  it.each(Object.entries(EXPECTED))('%s opens one FNA by id', async (category, paths) => {
    mockApiGet.mockResolvedValue({ success: true, data: { id: FNA } });
    await expect(FNA_CONFIGS[category].getById(FNA, CLIENT)).resolves.toEqual({ id: FNA });
    expect(mockApiGet).toHaveBeenCalledWith(paths.view);
  });
});
