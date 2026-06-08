/**
 * Tests for useComplianceQueries and complianceKeys
 * Navigate Wealth Admin Dashboard
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  complianceKeys,
  useFAISRecords,
  useFAISRecord,
  useFAISByAdviser,
  useAMLFICARecords,
  useAMLFICAByClient,
  usePOPIAConsents,
  usePOPIAConsentsByUser,
  usePAIARequests,
  useStatutoryRecords,
  useStatutoryRecord,
  useTCFRecords,
  useRecordKeeping,
  useDebarmentRecords,
  useSupervisionRecords,
  useConflictRecords,
  useMarketingRecords,
  useDocumentsInsuranceRecords,
  useNewBusinessRecords,
  useNewBusinessByClient,
  useComplaints,
  useComplaint,
  useComplianceActivities,
  useComplianceDeadlines,
  useComplianceStats,
  useComplianceOverview,
} from '../useComplianceQueries';

// ============================================================================
// MOCK SETUP
// ============================================================================

const mockUseQuery = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock('../../api', () => ({
  faisApi: {
    getAll: vi.fn(),
    getById: vi.fn(),
    getByAdviser: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  amlFicaApi: {
    getAll: vi.fn(),
    getByClient: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    runScreening: vi.fn(),
  },
  popiPaiaApi: {
    getAllConsents: vi.fn(),
    getConsentsByUser: vi.fn(),
    getAllPAIARequests: vi.fn(),
    recordConsent: vi.fn(),
    withdrawConsent: vi.fn(),
    createPAIARequest: vi.fn(),
    updatePAIARequest: vi.fn(),
  },
  statutoryApi: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    markAsSubmitted: vi.fn(),
  },
  tcfApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  recordKeepingApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    markForDisposal: vi.fn(),
  },
  debarmentSupervisionApi: {
    getAllDebarments: vi.fn(),
    getAllSupervision: vi.fn(),
    runCheck: vi.fn(),
    createSupervision: vi.fn(),
    updateSupervision: vi.fn(),
  },
  conflictsMarketingApi: {
    getAllConflicts: vi.fn(),
    getAllMarketing: vi.fn(),
    createConflict: vi.fn(),
    createMarketing: vi.fn(),
    approveMarketing: vi.fn(),
    updateConflict: vi.fn(),
  },
  documentsInsuranceApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    markAsRenewed: vi.fn(),
  },
  newBusinessApi: {
    getAll: vi.fn(),
    getByClient: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  complaintsApi: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    resolve: vi.fn(),
    escalate: vi.fn(),
  },
  complianceOverviewApi: {
    getRecentActivities: vi.fn(),
    getUpcomingDeadlines: vi.fn(),
    getStats: vi.fn(),
    refreshAll: vi.fn(),
  },
}));

vi.mock('../../constants', () => ({
  QUERY_STALE_TIME: 60000,
  QUERY_GC_TIME: 300000,
  SUCCESS_MESSAGES: {
    RECORD_CREATED: 'Compliance record created successfully',
    RECORD_UPDATED: 'Compliance record updated successfully',
    RECORD_DELETED: 'Compliance record deleted successfully',
    CHECK_COMPLETED: 'Compliance check completed successfully',
    CONSENT_RECORDED: 'Consent recorded successfully',
    COMPLAINT_SUBMITTED: 'Complaint submitted successfully',
    COMPLAINT_RESOLVED: 'Complaint resolved successfully',
  },
  ERROR_MESSAGES: {
    CREATE_FAILED: 'Failed to create compliance record',
    UPDATE_FAILED: 'Failed to update compliance record',
    DELETE_FAILED: 'Failed to delete compliance record',
    CHECK_FAILED: 'Compliance check failed',
    CONSENT_FAILED: 'Failed to record consent',
    COMPLAINT_FAILED: 'Failed to submit complaint',
    FETCH_FAILED: 'Failed to load compliance records',
  },
}));

const DEFAULT_QUERY_RESULT = {
  data: undefined,
  isLoading: false,
  isFetching: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseQuery.mockReturnValue(DEFAULT_QUERY_RESULT);
});

// ============================================================================
// QUERY KEY FACTORY
// ============================================================================

describe('complianceKeys', () => {
  it('all returns base compliance key array', () => {
    expect(complianceKeys.all).toEqual(['compliance']);
  });

  it('fais() returns correct key array', () => {
    expect(complianceKeys.fais()).toEqual(['compliance', 'fais']);
  });

  it('faisRecord(id) returns correct key array with id', () => {
    expect(complianceKeys.faisRecord('fais-123')).toEqual(['compliance', 'fais', 'fais-123']);
  });

  it('faisByAdviser(id) returns correct key array', () => {
    expect(complianceKeys.faisByAdviser('adv-1')).toEqual([
      'compliance',
      'fais',
      'adviser',
      'adv-1',
    ]);
  });

  it('amlFica() returns correct key array', () => {
    expect(complianceKeys.amlFica()).toEqual(['compliance', 'aml-fica']);
  });

  it('amlFicaRecord(id) returns correct key array with id', () => {
    expect(complianceKeys.amlFicaRecord('aml-1')).toEqual(['compliance', 'aml-fica', 'aml-1']);
  });

  it('amlFicaByClient(id) returns correct key array', () => {
    expect(complianceKeys.amlFicaByClient('client-1')).toEqual([
      'compliance',
      'aml-fica',
      'client',
      'client-1',
    ]);
  });

  it('popiaConsents() returns correct key array', () => {
    expect(complianceKeys.popiaConsents()).toEqual(['compliance', 'popi-paia', 'consents']);
  });

  it('popiaConsentsByUser(id) returns correct key array', () => {
    expect(complianceKeys.popiaConsentsByUser('user-1')).toEqual([
      'compliance',
      'popi-paia',
      'consents',
      'user',
      'user-1',
    ]);
  });

  it('paiaRequests() returns correct key array', () => {
    expect(complianceKeys.paiaRequests()).toEqual(['compliance', 'popi-paia', 'paia-requests']);
  });

  it('statutory() returns correct key array', () => {
    expect(complianceKeys.statutory()).toEqual(['compliance', 'statutory']);
  });

  it('statutoryRecord(id) returns correct key array with id', () => {
    expect(complianceKeys.statutoryRecord('stat-1')).toEqual(['compliance', 'statutory', 'stat-1']);
  });

  it('tcf() returns correct key array', () => {
    expect(complianceKeys.tcf()).toEqual(['compliance', 'tcf']);
  });

  it('recordKeeping() returns correct key array', () => {
    expect(complianceKeys.recordKeeping()).toEqual(['compliance', 'record-keeping']);
  });

  it('debarments() returns correct key array nested under debarmentSupervision', () => {
    expect(complianceKeys.debarments()).toEqual([
      'compliance',
      'debarment-supervision',
      'debarments',
    ]);
  });

  it('supervision() returns correct key array', () => {
    expect(complianceKeys.supervision()).toEqual([
      'compliance',
      'debarment-supervision',
      'supervision',
    ]);
  });

  it('conflicts() returns correct key array', () => {
    expect(complianceKeys.conflicts()).toEqual(['compliance', 'conflicts-marketing', 'conflicts']);
  });

  it('marketing() returns correct key array', () => {
    expect(complianceKeys.marketing()).toEqual(['compliance', 'conflicts-marketing', 'marketing']);
  });

  it('documentsInsurance() returns correct key array', () => {
    expect(complianceKeys.documentsInsurance()).toEqual(['compliance', 'documents-insurance']);
  });

  it('newBusiness() returns correct key array', () => {
    expect(complianceKeys.newBusiness()).toEqual(['compliance', 'new-business']);
  });

  it('newBusinessByClient(id) returns correct key array', () => {
    expect(complianceKeys.newBusinessByClient('client-1')).toEqual([
      'compliance',
      'new-business',
      'client',
      'client-1',
    ]);
  });

  it('complaints() returns correct key array', () => {
    expect(complianceKeys.complaints()).toEqual(['compliance', 'complaints']);
  });

  it('complaint(id) returns correct key array with id', () => {
    expect(complianceKeys.complaint('comp-1')).toEqual(['compliance', 'complaints', 'comp-1']);
  });

  it('activities() returns correct key array', () => {
    expect(complianceKeys.activities()).toEqual(['compliance', 'activities']);
  });

  it('deadlines() returns correct key array', () => {
    expect(complianceKeys.deadlines()).toEqual(['compliance', 'deadlines']);
  });

  it('stats() returns correct key array', () => {
    expect(complianceKeys.stats()).toEqual(['compliance', 'stats']);
  });
});

// ============================================================================
// FAIS QUERIES
// ============================================================================

describe('useFAISRecords', () => {
  it('calls useQuery once', () => {
    renderHook(() => useFAISRecords());
    expect(mockUseQuery).toHaveBeenCalledTimes(1);
  });

  it('passes the correct queryKey', () => {
    renderHook(() => useFAISRecords());
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.queryKey).toEqual(['compliance', 'fais']);
  });

  it('passes staleTime and gcTime from constants', () => {
    renderHook(() => useFAISRecords());
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.staleTime).toBe(60000);
    expect(config.gcTime).toBe(300000);
  });

  it('is enabled by default', () => {
    renderHook(() => useFAISRecords());
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.enabled).toBe(true);
  });

  it('is disabled when enabled=false is passed', () => {
    renderHook(() => useFAISRecords(false));
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.enabled).toBe(false);
  });

  it('returns data and loading state from useQuery', () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false, isError: false });
    const { result } = renderHook(() => useFAISRecords());
    expect(result.current.data).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('returns loading state when query is loading', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    const { result } = renderHook(() => useFAISRecords());
    expect(result.current.isLoading).toBe(true);
  });
});

describe('useFAISRecord', () => {
  it('passes the correct queryKey with id', () => {
    renderHook(() => useFAISRecord('fais-1'));
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.queryKey).toEqual(['compliance', 'fais', 'fais-1']);
  });

  it('is disabled when id is empty', () => {
    renderHook(() => useFAISRecord(''));
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.enabled).toBe(false);
  });

  it('is enabled when valid id is provided', () => {
    renderHook(() => useFAISRecord('fais-1'));
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.enabled).toBe(true);
  });

  it('is disabled when enabled=false is passed', () => {
    renderHook(() => useFAISRecord('fais-1', false));
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.enabled).toBe(false);
  });
});

describe('useFAISByAdviser', () => {
  it('passes the correct queryKey with adviserId', () => {
    renderHook(() => useFAISByAdviser('adv-1'));
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.queryKey).toEqual(['compliance', 'fais', 'adviser', 'adv-1']);
  });

  it('is disabled when adviserId is empty', () => {
    renderHook(() => useFAISByAdviser(''));
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.enabled).toBe(false);
  });
});

// ============================================================================
// AML/FICA QUERIES
// ============================================================================

describe('useAMLFICARecords', () => {
  it('calls useQuery with the correct queryKey', () => {
    renderHook(() => useAMLFICARecords());
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.queryKey).toEqual(['compliance', 'aml-fica']);
  });

  it('is enabled by default', () => {
    renderHook(() => useAMLFICARecords());
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.enabled).toBe(true);
  });

  it('returns data from useQuery', () => {
    const mockData = [{ id: 'aml-1', clientId: 'client-1' }];
    mockUseQuery.mockReturnValue({ data: mockData, isLoading: false, isError: false });
    const { result } = renderHook(() => useAMLFICARecords());
    expect(result.current.data).toEqual(mockData);
  });
});

describe('useAMLFICAByClient', () => {
  it('passes correct queryKey with clientId', () => {
    renderHook(() => useAMLFICAByClient('client-1'));
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.queryKey).toEqual(['compliance', 'aml-fica', 'client', 'client-1']);
  });

  it('is disabled when clientId is empty', () => {
    renderHook(() => useAMLFICAByClient(''));
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.enabled).toBe(false);
  });
});

// ============================================================================
// POPI/PAIA QUERIES
// ============================================================================

describe('usePOPIAConsents', () => {
  it('calls useQuery with the correct queryKey', () => {
    renderHook(() => usePOPIAConsents());
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.queryKey).toEqual(['compliance', 'popi-paia', 'consents']);
  });

  it('is enabled by default', () => {
    renderHook(() => usePOPIAConsents());
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.enabled).toBe(true);
  });
});

describe('usePOPIAConsentsByUser', () => {
  it('passes correct queryKey with userId', () => {
    renderHook(() => usePOPIAConsentsByUser('user-1'));
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.queryKey).toEqual(['compliance', 'popi-paia', 'consents', 'user', 'user-1']);
  });

  it('is disabled when userId is empty', () => {
    renderHook(() => usePOPIAConsentsByUser(''));
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.enabled).toBe(false);
  });
});

describe('usePAIARequests', () => {
  it('calls useQuery with the correct queryKey', () => {
    renderHook(() => usePAIARequests());
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.queryKey).toEqual(['compliance', 'popi-paia', 'paia-requests']);
  });
});

// ============================================================================
// STATUTORY QUERIES
// ============================================================================

describe('useStatutoryRecords', () => {
  it('calls useQuery with the correct queryKey', () => {
    renderHook(() => useStatutoryRecords());
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.queryKey).toEqual(['compliance', 'statutory']);
  });

  it('is enabled by default', () => {
    renderHook(() => useStatutoryRecords());
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.enabled).toBe(true);
  });

  it('is disabled when enabled=false is passed', () => {
    renderHook(() => useStatutoryRecords(false));
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.enabled).toBe(false);
  });
});

describe('useStatutoryRecord', () => {
  it('passes correct queryKey with id', () => {
    renderHook(() => useStatutoryRecord('stat-1'));
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.queryKey).toEqual(['compliance', 'statutory', 'stat-1']);
  });

  it('is disabled when id is empty', () => {
    renderHook(() => useStatutoryRecord(''));
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.enabled).toBe(false);
  });
});

// ============================================================================
// TCF QUERIES
// ============================================================================

describe('useTCFRecords', () => {
  it('calls useQuery with the correct queryKey', () => {
    renderHook(() => useTCFRecords());
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.queryKey).toEqual(['compliance', 'tcf']);
  });

  it('is enabled by default', () => {
    renderHook(() => useTCFRecords());
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.enabled).toBe(true);
  });

  it('returns data and error state from useQuery', () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('fetch failed'),
    });
    const { result } = renderHook(() => useTCFRecords());
    expect(result.current.isError).toBe(true);
  });
});

// ============================================================================
// RECORD KEEPING QUERIES
// ============================================================================

describe('useRecordKeeping', () => {
  it('calls useQuery with the correct queryKey', () => {
    renderHook(() => useRecordKeeping());
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.queryKey).toEqual(['compliance', 'record-keeping']);
  });

  it('is disabled when enabled=false passed', () => {
    renderHook(() => useRecordKeeping(false));
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.enabled).toBe(false);
  });
});

// ============================================================================
// DEBARMENT & SUPERVISION QUERIES
// ============================================================================

describe('useDebarmentRecords', () => {
  it('calls useQuery with the correct queryKey', () => {
    renderHook(() => useDebarmentRecords());
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.queryKey).toEqual(['compliance', 'debarment-supervision', 'debarments']);
  });

  it('is enabled by default', () => {
    renderHook(() => useDebarmentRecords());
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.enabled).toBe(true);
  });
});

describe('useSupervisionRecords', () => {
  it('calls useQuery with the correct queryKey', () => {
    renderHook(() => useSupervisionRecords());
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.queryKey).toEqual(['compliance', 'debarment-supervision', 'supervision']);
  });
});

// ============================================================================
// CONFLICTS & MARKETING QUERIES
// ============================================================================

describe('useConflictRecords', () => {
  it('calls useQuery with the correct queryKey', () => {
    renderHook(() => useConflictRecords());
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.queryKey).toEqual(['compliance', 'conflicts-marketing', 'conflicts']);
  });
});

describe('useMarketingRecords', () => {
  it('calls useQuery with the correct queryKey', () => {
    renderHook(() => useMarketingRecords());
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.queryKey).toEqual(['compliance', 'conflicts-marketing', 'marketing']);
  });

  it('is enabled by default', () => {
    renderHook(() => useMarketingRecords());
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.enabled).toBe(true);
  });
});

// ============================================================================
// DOCUMENTS & INSURANCE QUERIES
// ============================================================================

describe('useDocumentsInsuranceRecords', () => {
  it('calls useQuery with the correct queryKey', () => {
    renderHook(() => useDocumentsInsuranceRecords());
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.queryKey).toEqual(['compliance', 'documents-insurance']);
  });
});

// ============================================================================
// NEW BUSINESS QUERIES
// ============================================================================

describe('useNewBusinessRecords', () => {
  it('calls useQuery with the correct queryKey', () => {
    renderHook(() => useNewBusinessRecords());
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.queryKey).toEqual(['compliance', 'new-business']);
  });

  it('is enabled by default', () => {
    renderHook(() => useNewBusinessRecords());
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.enabled).toBe(true);
  });
});

describe('useNewBusinessByClient', () => {
  it('passes correct queryKey with clientId', () => {
    renderHook(() => useNewBusinessByClient('client-1'));
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.queryKey).toEqual(['compliance', 'new-business', 'client', 'client-1']);
  });

  it('is disabled when clientId is empty', () => {
    renderHook(() => useNewBusinessByClient(''));
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.enabled).toBe(false);
  });
});

// ============================================================================
// COMPLAINTS QUERIES
// ============================================================================

describe('useComplaints', () => {
  it('calls useQuery with the correct queryKey', () => {
    renderHook(() => useComplaints());
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.queryKey).toEqual(['compliance', 'complaints']);
  });

  it('is enabled by default', () => {
    renderHook(() => useComplaints());
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.enabled).toBe(true);
  });

  it('returns data from useQuery', () => {
    const mockComplaints = [{ id: 'comp-1', category: 'service' }];
    mockUseQuery.mockReturnValue({
      data: mockComplaints,
      isLoading: false,
      isError: false,
    });
    const { result } = renderHook(() => useComplaints());
    expect(result.current.data).toEqual(mockComplaints);
  });
});

describe('useComplaint', () => {
  it('passes correct queryKey with id', () => {
    renderHook(() => useComplaint('comp-1'));
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.queryKey).toEqual(['compliance', 'complaints', 'comp-1']);
  });

  it('is disabled when id is empty', () => {
    renderHook(() => useComplaint(''));
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.enabled).toBe(false);
  });

  it('is enabled when valid id is provided', () => {
    renderHook(() => useComplaint('comp-1'));
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.enabled).toBe(true);
  });
});

// ============================================================================
// OVERVIEW QUERIES
// ============================================================================

describe('useComplianceActivities', () => {
  it('calls useQuery with the correct queryKey', () => {
    renderHook(() => useComplianceActivities());
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.queryKey).toEqual(['compliance', 'activities']);
  });

  it('is enabled by default', () => {
    renderHook(() => useComplianceActivities());
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.enabled).toBe(true);
  });

  it('is disabled when enabled=false passed', () => {
    renderHook(() => useComplianceActivities(20, false));
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.enabled).toBe(false);
  });
});

describe('useComplianceDeadlines', () => {
  it('calls useQuery with the correct queryKey', () => {
    renderHook(() => useComplianceDeadlines());
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.queryKey).toEqual(['compliance', 'deadlines']);
  });

  it('is enabled by default', () => {
    renderHook(() => useComplianceDeadlines());
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.enabled).toBe(true);
  });

  it('is disabled when enabled=false passed', () => {
    renderHook(() => useComplianceDeadlines(30, false));
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.enabled).toBe(false);
  });
});

describe('useComplianceStats', () => {
  it('calls useQuery with the correct queryKey', () => {
    renderHook(() => useComplianceStats());
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.queryKey).toEqual(['compliance', 'stats']);
  });

  it('is enabled by default', () => {
    renderHook(() => useComplianceStats());
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.enabled).toBe(true);
  });

  it('returns stats data from useQuery', () => {
    const mockStats = { totalRecords: 100, overdueCount: 5, ragStatus: 'green' };
    mockUseQuery.mockReturnValue({ data: mockStats, isLoading: false, isError: false });
    const { result } = renderHook(() => useComplianceStats());
    expect(result.current.data).toEqual(mockStats);
  });
});

// ============================================================================
// LEGACY HOOK
// ============================================================================

describe('useComplianceOverview', () => {
  it('calls useQuery three times (activities, deadlines, stats)', () => {
    renderHook(() => useComplianceOverview());
    expect(mockUseQuery).toHaveBeenCalledTimes(3);
  });

  it('returns combined activities, deadlines, stats, and loading state', () => {
    const mockActivities = [{ id: 'act-1', type: 'create' }];
    const mockDeadlines = [{ id: 'dl-1', title: 'Annual return' }];
    const mockStats = { totalRecords: 50 };

    mockUseQuery
      .mockReturnValueOnce({ data: mockActivities, isLoading: false, isError: false })
      .mockReturnValueOnce({ data: mockDeadlines, isLoading: false, isError: false })
      .mockReturnValueOnce({ data: mockStats, isLoading: false, isError: false });

    const { result } = renderHook(() => useComplianceOverview());
    expect(result.current.activities).toEqual(mockActivities);
    expect(result.current.deadlines).toEqual(mockDeadlines);
    expect(result.current.stats).toEqual(mockStats);
    expect(result.current.loading).toBe(false);
  });

  it('reports loading=true when any sub-query is loading', () => {
    mockUseQuery
      .mockReturnValueOnce({ data: [], isLoading: true, isError: false })
      .mockReturnValueOnce({ data: [], isLoading: false, isError: false })
      .mockReturnValueOnce({ data: undefined, isLoading: false, isError: false });

    const { result } = renderHook(() => useComplianceOverview());
    expect(result.current.loading).toBe(true);
  });

  it('defaults activities and deadlines to empty arrays when data is undefined', () => {
    mockUseQuery
      .mockReturnValueOnce({ data: undefined, isLoading: false, isError: false })
      .mockReturnValueOnce({ data: undefined, isLoading: false, isError: false })
      .mockReturnValueOnce({ data: undefined, isLoading: false, isError: false });

    const { result } = renderHook(() => useComplianceOverview());
    expect(result.current.activities).toEqual([]);
    expect(result.current.deadlines).toEqual([]);
    expect(result.current.stats).toBeUndefined();
  });

  it('queries activities with the activities queryKey', () => {
    renderHook(() => useComplianceOverview());
    const activitiesConfig = mockUseQuery.mock.calls[0][0];
    expect(activitiesConfig.queryKey).toEqual(['compliance', 'activities']);
  });

  it('queries deadlines with the deadlines queryKey', () => {
    renderHook(() => useComplianceOverview());
    const deadlinesConfig = mockUseQuery.mock.calls[1][0];
    expect(deadlinesConfig.queryKey).toEqual(['compliance', 'deadlines']);
  });

  it('queries stats with the stats queryKey', () => {
    renderHook(() => useComplianceOverview());
    const statsConfig = mockUseQuery.mock.calls[2][0];
    expect(statsConfig.queryKey).toEqual(['compliance', 'stats']);
  });
});
