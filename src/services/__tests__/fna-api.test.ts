import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getRiskPlanningFNA,
  getMedicalFNA,
  getRetirementFNA,
  getInvestmentINA,
  getTaxPlanningFNA,
  getEstatePlanningFNA,
  getFNA,
  formatCurrency,
  formatDate,
  timeAgo,
} from '../fna-api';

const mockApiGet = vi.fn();

vi.mock('../../utils/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
  },
  APIError: class APIError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.name = 'APIError';
      this.statusCode = statusCode;
    }
  },
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const MOCK_RISK_FNA = { id: 'rfna-001', clientId: 'c-001', status: 'published' };
const MOCK_MEDICAL_FNA = { id: 'mfna-001', clientId: 'c-001', status: 'published' };
const MOCK_RETIREMENT_FNA = { id: 'rtfna-001', clientId: 'c-001', status: 'published' };
const MOCK_INVESTMENT_INA = { id: 'ina-001', clientId: 'c-001', status: 'published' };
const MOCK_TAX_FNA = { id: 'tfna-001', clientId: 'c-001', status: 'published' };
const MOCK_ESTATE_FNA = { id: 'efna-001', clientId: 'c-001', status: 'published' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getRiskPlanningFNA', () => {
  it('returns Risk Planning FNA for client', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: MOCK_RISK_FNA });
    const result = await getRiskPlanningFNA('c-001');
    expect(result).toEqual(MOCK_RISK_FNA);
    expect(mockApiGet).toHaveBeenCalledWith('/risk-planning-fna/client/c-001/latest');
  });

  it('returns null on 404', async () => {
    const err = Object.assign(new Error('Not found'), { statusCode: 404 });
    mockApiGet.mockRejectedValue(err);
    expect(await getRiskPlanningFNA('c-001')).toBeNull();
  });

  it('returns null on message-based 404', async () => {
    mockApiGet.mockRejectedValue(new Error('404 Not Found'));
    expect(await getRiskPlanningFNA('c-001')).toBeNull();
  });

  it('returns null on other errors', async () => {
    mockApiGet.mockRejectedValue(new Error('Server error'));
    expect(await getRiskPlanningFNA('c-001')).toBeNull();
  });
});

describe('getMedicalFNA', () => {
  it('returns Medical FNA for client', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: MOCK_MEDICAL_FNA });
    const result = await getMedicalFNA('c-001');
    expect(result).toEqual(MOCK_MEDICAL_FNA);
    expect(mockApiGet).toHaveBeenCalledWith('/medical-fna/client/c-001/latest-published');
  });

  it('returns null on 404', async () => {
    const err = Object.assign(new Error('Not found'), { statusCode: 404 });
    mockApiGet.mockRejectedValue(err);
    expect(await getMedicalFNA('c-001')).toBeNull();
  });

  it('returns null on 403 (access denied)', async () => {
    const err = Object.assign(new Error('Forbidden'), { statusCode: 403 });
    mockApiGet.mockRejectedValue(err);
    expect(await getMedicalFNA('c-001')).toBeNull();
  });

  it('returns null on other errors', async () => {
    mockApiGet.mockRejectedValue(new Error('Server error'));
    expect(await getMedicalFNA('c-001')).toBeNull();
  });
});

describe('getRetirementFNA', () => {
  it('returns Retirement FNA for client', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: MOCK_RETIREMENT_FNA });
    const result = await getRetirementFNA('c-001');
    expect(result).toEqual(MOCK_RETIREMENT_FNA);
    expect(mockApiGet).toHaveBeenCalledWith('/retirement-fna/client/c-001/latest-published');
  });

  it('returns null on 404', async () => {
    const err = Object.assign(new Error('Not found'), { statusCode: 404 });
    mockApiGet.mockRejectedValue(err);
    expect(await getRetirementFNA('c-001')).toBeNull();
  });

  it('returns null on other errors', async () => {
    mockApiGet.mockRejectedValue(new Error('Server error'));
    expect(await getRetirementFNA('c-001')).toBeNull();
  });
});

describe('getInvestmentINA', () => {
  it('returns Investment INA for client', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: MOCK_INVESTMENT_INA });
    const result = await getInvestmentINA('c-001');
    expect(result).toEqual(MOCK_INVESTMENT_INA);
    expect(mockApiGet).toHaveBeenCalledWith('/ina/investment/client/c-001/latest-published');
  });

  it('returns null on 404', async () => {
    const err = Object.assign(new Error('Not found'), { statusCode: 404 });
    mockApiGet.mockRejectedValue(err);
    expect(await getInvestmentINA('c-001')).toBeNull();
  });

  it('returns null on other errors', async () => {
    mockApiGet.mockRejectedValue(new Error('Server error'));
    expect(await getInvestmentINA('c-001')).toBeNull();
  });
});

describe('getTaxPlanningFNA', () => {
  it('returns Tax Planning FNA for client', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: MOCK_TAX_FNA });
    const result = await getTaxPlanningFNA('c-001');
    expect(result).toEqual(MOCK_TAX_FNA);
    expect(mockApiGet).toHaveBeenCalledWith('/tax-planning-fna/client/c-001/latest-published');
  });

  it('returns null on 404', async () => {
    const err = Object.assign(new Error('Not found'), { statusCode: 404 });
    mockApiGet.mockRejectedValue(err);
    expect(await getTaxPlanningFNA('c-001')).toBeNull();
  });

  it('returns null on other errors', async () => {
    mockApiGet.mockRejectedValue(new Error('Server error'));
    expect(await getTaxPlanningFNA('c-001')).toBeNull();
  });
});

describe('getEstatePlanningFNA', () => {
  it('returns Estate Planning FNA for client', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: MOCK_ESTATE_FNA });
    const result = await getEstatePlanningFNA('c-001');
    expect(result).toEqual(MOCK_ESTATE_FNA);
    expect(mockApiGet).toHaveBeenCalledWith('/estate-planning-fna/client/c-001/latest-published');
  });

  it('returns null on 404', async () => {
    const err = Object.assign(new Error('Not found'), { statusCode: 404 });
    mockApiGet.mockRejectedValue(err);
    expect(await getEstatePlanningFNA('c-001')).toBeNull();
  });

  it('returns null on other errors', async () => {
    mockApiGet.mockRejectedValue(new Error('Server error'));
    expect(await getEstatePlanningFNA('c-001')).toBeNull();
  });
});

describe('getFNA', () => {
  it('dispatches to getRiskPlanningFNA for type "risk"', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: MOCK_RISK_FNA });
    const result = await getFNA('c-001', 'risk');
    expect(result).toEqual(MOCK_RISK_FNA);
  });

  it('dispatches to getMedicalFNA for type "medical"', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: MOCK_MEDICAL_FNA });
    const result = await getFNA('c-001', 'medical');
    expect(result).toEqual(MOCK_MEDICAL_FNA);
  });

  it('dispatches to getRetirementFNA for type "retirement"', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: MOCK_RETIREMENT_FNA });
    const result = await getFNA('c-001', 'retirement');
    expect(result).toEqual(MOCK_RETIREMENT_FNA);
  });

  it('dispatches to getInvestmentINA for type "investment"', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: MOCK_INVESTMENT_INA });
    const result = await getFNA('c-001', 'investment');
    expect(result).toEqual(MOCK_INVESTMENT_INA);
  });

  it('dispatches to getTaxPlanningFNA for type "tax"', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: MOCK_TAX_FNA });
    const result = await getFNA('c-001', 'tax');
    expect(result).toEqual(MOCK_TAX_FNA);
  });

  it('dispatches to getEstatePlanningFNA for type "estate"', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: MOCK_ESTATE_FNA });
    const result = await getFNA('c-001', 'estate');
    expect(result).toEqual(MOCK_ESTATE_FNA);
  });
});

describe('formatCurrency', () => {
  it('formats a positive amount in ZAR', () => {
    const result = formatCurrency(1234567);
    expect(result).toContain('1');
    expect(result).toContain('234');
  });

  it('formats zero', () => {
    const result = formatCurrency(0);
    expect(result).toBeTruthy();
  });

  it('formats a large amount', () => {
    const result = formatCurrency(10000000);
    expect(result).toContain('10');
  });
});

describe('formatDate', () => {
  it('formats an ISO date string', () => {
    const result = formatDate('2025-01-15T00:00:00Z');
    expect(result).toContain('2025');
    expect(result).toContain('15');
  });

  it('formats another date', () => {
    const result = formatDate('2024-06-01T00:00:00Z');
    expect(result).toContain('2024');
  });
});

describe('timeAgo', () => {
  it('returns "just now" for very recent times', () => {
    const now = new Date().toISOString();
    const result = timeAgo(now);
    expect(result).toBe('just now');
  });

  it('returns minutes ago', () => {
    const past = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const result = timeAgo(past);
    expect(result).toContain('minute');
  });

  it('returns hours ago', () => {
    const past = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    const result = timeAgo(past);
    expect(result).toContain('hour');
  });

  it('returns days ago', () => {
    const past = new Date(Date.now() - 5 * 86400 * 1000).toISOString();
    const result = timeAgo(past);
    expect(result).toContain('day');
  });

  it('returns months ago', () => {
    const past = new Date(Date.now() - 45 * 86400 * 1000).toISOString();
    const result = timeAgo(past);
    expect(result).toContain('month');
  });

  it('returns years ago', () => {
    const past = new Date(Date.now() - 400 * 86400 * 1000).toISOString();
    const result = timeAgo(past);
    expect(result).toContain('year');
  });

  it('uses singular form for 1 unit', () => {
    const past = new Date(Date.now() - 1 * 3600 * 1000 - 30 * 1000).toISOString();
    const result = timeAgo(past);
    expect(result).toBe('1 hour ago');
  });
});
