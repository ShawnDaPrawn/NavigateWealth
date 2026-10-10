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

vi.mock('../../../../utils/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
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
