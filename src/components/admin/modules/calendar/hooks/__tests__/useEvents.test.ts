import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  eventKeys,
  useEvents,
  useEvent,
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
} from '../useEvents';

const mockInvalidateQueries = vi.fn();
const mockQueryClient = { invalidateQueries: mockInvalidateQueries };
const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQueryClient: () => mockQueryClient,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

const mockCalendarApiFetchEvents = vi.fn();
const mockCalendarApiCreateEvent = vi.fn();
const mockCalendarApiUpdateEvent = vi.fn();
const mockCalendarApiDeleteEvent = vi.fn();

vi.mock('../../api', () => ({
  calendarApi: {
    fetchEvents: (...args: unknown[]) => mockCalendarApiFetchEvents(...args),
    createEvent: (...args: unknown[]) => mockCalendarApiCreateEvent(...args),
    updateEvent: (...args: unknown[]) => mockCalendarApiUpdateEvent(...args),
    deleteEvent: (...args: unknown[]) => mockCalendarApiDeleteEvent(...args),
  },
}));

vi.mock('../../constants', () => ({
  QUERY_STALE_TIME: 60000,
  QUERY_GC_TIME: 300000,
}));

function makeQueryResult(data: unknown = [], loading = false) {
  return { data, isLoading: loading, isError: false, error: null };
}

function makeMutationResult() {
  return { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseQuery.mockReturnValue(makeQueryResult([]));
  mockUseMutation.mockReturnValue(makeMutationResult());
});

describe('eventKeys', () => {
  it('all returns base events key', () => {
    expect(eventKeys.all).toEqual(['events']);
  });

  it('lists() returns list key array', () => {
    expect(eventKeys.lists()).toEqual(['events', 'list']);
  });

  it('list(filters) returns key with filters', () => {
    const key = eventKeys.list({ userId: 'u1' } as never);
    expect(key).toEqual(['events', 'list', { userId: 'u1' }]);
  });

  it('details() returns detail base key', () => {
    expect(eventKeys.details()).toEqual(['events', 'detail']);
  });

  it('detail(id) returns key with id', () => {
    expect(eventKeys.detail('e-001')).toEqual(['events', 'detail', 'e-001']);
  });
});

describe('useEvents', () => {
  it('calls useQuery once', () => {
    renderHook(() => useEvents());
    expect(mockUseQuery).toHaveBeenCalledTimes(1);
  });

  it('passes correct queryKey with empty filters when no filters provided', () => {
    renderHook(() => useEvents());
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.queryKey).toEqual(['events', 'list', {}]);
  });

  it('passes correct queryKey with provided filters', () => {
    renderHook(() => useEvents({ userId: 'u-1' } as never));
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.queryKey).toEqual(['events', 'list', { userId: 'u-1' }]);
  });

  it('passes staleTime and gcTime', () => {
    renderHook(() => useEvents());
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.staleTime).toBe(60000);
    expect(config.gcTime).toBe(300000);
  });

  it('disables retry', () => {
    renderHook(() => useEvents());
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.retry).toBe(false);
  });

  it('queryFn calls calendarApi.fetchEvents with filters', async () => {
    const mockEvents = [{ id: 'e-001', title: 'Meeting' }];
    mockCalendarApiFetchEvents.mockResolvedValue(mockEvents);
    const capturedConfig = vi.fn();
    mockUseQuery.mockImplementation((config) => {
      capturedConfig(config);
      return makeQueryResult([]);
    });
    renderHook(() => useEvents({ userId: 'u-1' } as never));
    const config = capturedConfig.mock.calls[0][0];
    const result = await config.queryFn();
    expect(mockCalendarApiFetchEvents).toHaveBeenCalledWith({ userId: 'u-1' });
    expect(result).toEqual(mockEvents);
  });
});

describe('useEvent', () => {
  it('is enabled when id is provided', () => {
    renderHook(() => useEvent('e-001'));
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.enabled).toBe(true);
  });

  it('is disabled when id is null', () => {
    renderHook(() => useEvent(null));
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.enabled).toBe(false);
  });

  it('passes correct queryKey with id', () => {
    renderHook(() => useEvent('e-001'));
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.queryKey).toEqual(['events', 'detail', 'e-001']);
  });

  it('passes empty string in queryKey when id is null', () => {
    renderHook(() => useEvent(null));
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.queryKey).toEqual(['events', 'detail', '']);
  });

  it('queryFn returns matching event', async () => {
    const mockEvents = [
      { id: 'e-001', title: 'Meeting' },
      { id: 'e-002', title: 'Call' },
    ];
    mockCalendarApiFetchEvents.mockResolvedValue(mockEvents);
    const capturedConfig = vi.fn();
    mockUseQuery.mockImplementation((config) => {
      capturedConfig(config);
      return makeQueryResult(null);
    });
    renderHook(() => useEvent('e-001'));
    const config = capturedConfig.mock.calls[0][0];
    const result = await config.queryFn();
    expect(result).toEqual({ id: 'e-001', title: 'Meeting' });
  });

  it('queryFn returns null when id is null', async () => {
    const capturedConfig = vi.fn();
    mockUseQuery.mockImplementation((config) => {
      capturedConfig(config);
      return makeQueryResult(null);
    });
    renderHook(() => useEvent(null));
    const config = capturedConfig.mock.calls[0][0];
    const result = await config.queryFn();
    expect(result).toBeNull();
  });
});

describe('useCreateEvent', () => {
  it('calls useMutation once', () => {
    renderHook(() => useCreateEvent());
    expect(mockUseMutation).toHaveBeenCalledTimes(1);
  });

  it('mutationFn calls calendarApi.createEvent with persisted event fields', async () => {
    const createdEvent = { id: 'e-new', title: 'New Meeting' };
    mockCalendarApiCreateEvent.mockResolvedValue(createdEvent);
    const capturedConfig = vi.fn();
    mockUseMutation.mockImplementation((config) => {
      capturedConfig(config);
      return makeMutationResult();
    });
    renderHook(() => useCreateEvent());
    const config = capturedConfig.mock.calls[0][0];
    const input = { title: 'New Meeting' };
    const result = await config.mutationFn(input);
    expect(mockCalendarApiCreateEvent).toHaveBeenCalledWith(input);
    expect(result).toEqual(createdEvent);
  });

  it('onSuccess invalidates event list queries', () => {
    const capturedConfig = vi.fn();
    mockUseMutation.mockImplementation((config) => {
      capturedConfig(config);
      return makeMutationResult();
    });
    renderHook(() => useCreateEvent());
    const config = capturedConfig.mock.calls[0][0];
    config.onSuccess();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['events', 'list'] });
  });

  it('onError does not throw', () => {
    const capturedConfig = vi.fn();
    mockUseMutation.mockImplementation((config) => {
      capturedConfig(config);
      return makeMutationResult();
    });
    renderHook(() => useCreateEvent());
    const config = capturedConfig.mock.calls[0][0];
    expect(() => config.onError(new Error('fail'))).not.toThrow();
  });
});

describe('useUpdateEvent', () => {
  it('mutationFn calls calendarApi.updateEvent with id and updates', async () => {
    const updatedEvent = { id: 'e-001', title: 'Updated' };
    mockCalendarApiUpdateEvent.mockResolvedValue(updatedEvent);
    const capturedConfig = vi.fn();
    mockUseMutation.mockImplementation((config) => {
      capturedConfig(config);
      return makeMutationResult();
    });
    renderHook(() => useUpdateEvent());
    const config = capturedConfig.mock.calls[0][0];
    const result = await config.mutationFn({ id: 'e-001', title: 'Updated' });
    expect(mockCalendarApiUpdateEvent).toHaveBeenCalledWith('e-001', { title: 'Updated' });
    expect(result).toEqual(updatedEvent);
  });

  it('onSuccess invalidates event list queries', () => {
    const capturedConfig = vi.fn();
    mockUseMutation.mockImplementation((config) => {
      capturedConfig(config);
      return makeMutationResult();
    });
    renderHook(() => useUpdateEvent());
    const config = capturedConfig.mock.calls[0][0];
    config.onSuccess();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['events', 'list'] });
  });
});

describe('useDeleteEvent', () => {
  it('mutationFn calls calendarApi.deleteEvent', async () => {
    mockCalendarApiDeleteEvent.mockResolvedValue(undefined);
    const capturedConfig = vi.fn();
    mockUseMutation.mockImplementation((config) => {
      capturedConfig(config);
      return makeMutationResult();
    });
    renderHook(() => useDeleteEvent());
    const config = capturedConfig.mock.calls[0][0];
    await config.mutationFn('e-001');
    expect(mockCalendarApiDeleteEvent).toHaveBeenCalledWith('e-001');
  });

  it('onSuccess invalidates event list queries', () => {
    const capturedConfig = vi.fn();
    mockUseMutation.mockImplementation((config) => {
      capturedConfig(config);
      return makeMutationResult();
    });
    renderHook(() => useDeleteEvent());
    const config = capturedConfig.mock.calls[0][0];
    config.onSuccess();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['events', 'list'] });
  });
});
