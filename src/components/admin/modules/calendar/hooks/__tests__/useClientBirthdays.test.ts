import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useClientBirthdays } from '../useClientBirthdays';

const mockUseQuery = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

const mockClientApiGetClients = vi.fn();

vi.mock('../../../client-management/api', () => ({
  clientApi: {
    getClients: (...args: unknown[]) => mockClientApiGetClients(...args),
  },
}));

vi.mock('../queryKeys', () => ({
  calendarKeys: {
    birthdays: (year: number) => ['client-birthdays', year],
    renewals: (year: number) => ['policy-renewals', year],
    events: {
      all: ['calendar', 'events'],
      list: (filters?: unknown) => ['calendar', 'events', 'list', filters ?? {}],
    },
  },
}));

function makeQueryResult(data: unknown = [], loading = false) {
  return { data, isLoading: loading, isError: false, error: null };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseQuery.mockReturnValue(makeQueryResult([]));
});

const TEST_DATE = new Date('2025-06-15');

describe('useClientBirthdays', () => {
  it('calls useQuery once', () => {
    renderHook(() => useClientBirthdays(TEST_DATE));
    expect(mockUseQuery).toHaveBeenCalledTimes(1);
  });

  it('passes queryKey with current year', () => {
    renderHook(() => useClientBirthdays(TEST_DATE));
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.queryKey).toEqual(['client-birthdays', 2025]);
  });

  it('passes 1-hour staleTime', () => {
    renderHook(() => useClientBirthdays(TEST_DATE));
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.staleTime).toBe(60 * 60 * 1000);
  });

  it('returns data from useQuery', () => {
    const mockEvents = [{ id: 'birthday-c1-2025', title: 'Birthday: Alice' }];
    mockUseQuery.mockReturnValue(makeQueryResult(mockEvents));
    const { result } = renderHook(() => useClientBirthdays(TEST_DATE));
    expect(result.current.data).toEqual(mockEvents);
  });

  it('queryFn returns empty array when no clients have DOB', async () => {
    mockClientApiGetClients.mockResolvedValue({
      users: [{ id: 'c-1', email: 'alice@test.com', profile: null }],
    });
    const capturedConfig = vi.fn();
    mockUseQuery.mockImplementation((config) => {
      capturedConfig(config);
      return makeQueryResult([]);
    });
    renderHook(() => useClientBirthdays(TEST_DATE));
    const config = capturedConfig.mock.calls[0][0];
    const events = await config.queryFn();
    expect(events).toEqual([]);
  });

  it('queryFn generates birthday events for clients with valid DOB', async () => {
    mockClientApiGetClients.mockResolvedValue({
      users: [
        {
          id: 'c-1',
          email: 'alice@test.com',
          name: 'Alice Smith',
          profile: {
            personalInformation: { dateOfBirth: '1990-03-15' },
          },
        },
      ],
    });
    const capturedConfig = vi.fn();
    mockUseQuery.mockImplementation((config) => {
      capturedConfig(config);
      return makeQueryResult([]);
    });
    renderHook(() => useClientBirthdays(TEST_DATE));
    const config = capturedConfig.mock.calls[0][0];
    const events = await config.queryFn();
    // Should generate birthday events for prev year, current year, next year
    expect(events.length).toBeGreaterThanOrEqual(3);
    expect(events[0].event_type).toBe('birthday');
    expect(events[0].title).toContain('Alice Smith');
  });

  it('queryFn skips clients with invalid DOB format', async () => {
    mockClientApiGetClients.mockResolvedValue({
      users: [
        {
          id: 'c-1',
          email: 'bob@test.com',
          profile: {
            personalInformation: { dateOfBirth: 'not-a-date' },
          },
        },
      ],
    });
    const capturedConfig = vi.fn();
    mockUseQuery.mockImplementation((config) => {
      capturedConfig(config);
      return makeQueryResult([]);
    });
    renderHook(() => useClientBirthdays(TEST_DATE));
    const config = capturedConfig.mock.calls[0][0];
    const events = await config.queryFn();
    expect(events).toEqual([]);
  });

  it('queryFn handles empty users array', async () => {
    mockClientApiGetClients.mockResolvedValue({ users: [] });
    const capturedConfig = vi.fn();
    mockUseQuery.mockImplementation((config) => {
      capturedConfig(config);
      return makeQueryResult([]);
    });
    renderHook(() => useClientBirthdays(TEST_DATE));
    const config = capturedConfig.mock.calls[0][0];
    const events = await config.queryFn();
    expect(events).toEqual([]);
  });

  it('uses different query key for different years', () => {
    renderHook(() => useClientBirthdays(new Date('2026-01-01')));
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.queryKey).toEqual(['client-birthdays', 2026]);
  });
});
