import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  fetchReminders,
  createReminder,
  updateReminder,
  deleteReminder,
  calendarApi,
} from '../api';

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockApiPut = vi.fn();
const mockApiDelete = vi.fn();

vi.mock('../../../../../utils/api/client', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: (...args: unknown[]) => mockApiPut(...args),
    delete: (...args: unknown[]) => mockApiDelete(...args),
  },
}));

vi.mock('../../../../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const MOCK_EVENT = {
  id: 'evt-001',
  title: 'Client Review Meeting',
  start: '2025-06-01T09:00:00Z',
  end: '2025-06-01T10:00:00Z',
  type: 'meeting',
  status: 'confirmed',
};

const MOCK_REMINDER = {
  id: 'rem-001',
  title: 'Policy Renewal Reminder',
  dueDate: '2025-06-15T08:00:00Z',
  status: 'pending',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fetchEvents', () => {
  it('returns events from API without filters', async () => {
    mockApiGet.mockResolvedValue([MOCK_EVENT]);
    const events = await fetchEvents();
    expect(events).toEqual([MOCK_EVENT]);
    expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('/calendar/events'));
  });

  it('applies search filter to query params', async () => {
    mockApiGet.mockResolvedValue([MOCK_EVENT]);
    await fetchEvents({ search: 'Client Review' });
    expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('search=Client+Review'));
  });

  it('applies dateRange filters', async () => {
    mockApiGet.mockResolvedValue([]);
    await fetchEvents({ dateRange: { start: '2025-06-01', end: '2025-06-30' } });
    const call = mockApiGet.mock.calls[0][0];
    expect(call).toContain('start=2025-06-01');
    expect(call).toContain('end=2025-06-30');
  });

  it('applies eventTypes filter', async () => {
    mockApiGet.mockResolvedValue([]);
    await fetchEvents({ eventTypes: ['meeting', 'reminder'] });
    expect(mockApiGet).toHaveBeenCalledWith(
      expect.stringContaining('eventTypes=meeting%2Creminder'),
    );
  });

  it('applies clientId filter', async () => {
    mockApiGet.mockResolvedValue([]);
    await fetchEvents({ clientId: 'client-001' });
    expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('clientId=client-001'));
  });

  it('throws on API failure', async () => {
    mockApiGet.mockRejectedValue(new Error('Network error'));
    await expect(fetchEvents()).rejects.toThrow('Network error');
  });
});

describe('createEvent', () => {
  it('posts event to API and returns created event', async () => {
    mockApiPost.mockResolvedValue(MOCK_EVENT);
    const result = await createEvent({
      title: 'Client Review Meeting',
      start: '2025-06-01T09:00:00Z',
      end: '2025-06-01T10:00:00Z',
    } as never);
    expect(result).toEqual(MOCK_EVENT);
    expect(mockApiPost).toHaveBeenCalledWith('/calendar/events', expect.any(Object));
  });

  it('throws on failure', async () => {
    mockApiPost.mockRejectedValue(new Error('Create failed'));
    await expect(createEvent({ title: 'Event' } as never)).rejects.toThrow('Create failed');
  });
});

describe('updateEvent', () => {
  it('puts update to API and returns updated event', async () => {
    const updated = { ...MOCK_EVENT, title: 'Updated Meeting' };
    mockApiPut.mockResolvedValue(updated);
    const result = await updateEvent('evt-001', { title: 'Updated Meeting' });
    expect(result.title).toBe('Updated Meeting');
    expect(mockApiPut).toHaveBeenCalledWith('/calendar/events/evt-001', {
      title: 'Updated Meeting',
    });
  });

  it('throws on failure', async () => {
    mockApiPut.mockRejectedValue(new Error('Update failed'));
    await expect(updateEvent('evt-001', { title: 'New' })).rejects.toThrow('Update failed');
  });
});

describe('deleteEvent', () => {
  it('deletes event by ID', async () => {
    mockApiDelete.mockResolvedValue(undefined);
    await expect(deleteEvent('evt-001')).resolves.toBeUndefined();
    expect(mockApiDelete).toHaveBeenCalledWith('/calendar/events/evt-001');
  });

  it('throws on failure', async () => {
    mockApiDelete.mockRejectedValue(new Error('Delete failed'));
    await expect(deleteEvent('evt-001')).rejects.toThrow('Delete failed');
  });
});

describe('fetchReminders', () => {
  it('returns reminders from API', async () => {
    mockApiGet.mockResolvedValue([MOCK_REMINDER]);
    const reminders = await fetchReminders();
    expect(reminders).toEqual([MOCK_REMINDER]);
  });

  it('applies reminderStatuses filter', async () => {
    mockApiGet.mockResolvedValue([]);
    await fetchReminders({ reminderStatuses: ['pending'] });
    expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('status=pending'));
  });

  it('throws on failure', async () => {
    mockApiGet.mockRejectedValue(new Error('Fetch failed'));
    await expect(fetchReminders()).rejects.toThrow('Fetch failed');
  });
});

describe('createReminder', () => {
  it('posts reminder to API', async () => {
    mockApiPost.mockResolvedValue(MOCK_REMINDER);
    const result = await createReminder({
      title: 'Policy Renewal Reminder',
      dueDate: '2025-06-15',
    } as never);
    expect(result).toEqual(MOCK_REMINDER);
    expect(mockApiPost).toHaveBeenCalledWith('/calendar/reminders', expect.any(Object));
  });

  it('throws on failure', async () => {
    mockApiPost.mockRejectedValue(new Error('Create failed'));
    await expect(createReminder({ title: 'Test' } as never)).rejects.toThrow('Create failed');
  });
});

describe('updateReminder', () => {
  it('puts update to reminder endpoint', async () => {
    const updated = { ...MOCK_REMINDER, title: 'Updated Reminder' };
    mockApiPut.mockResolvedValue(updated);
    const result = await updateReminder('rem-001', { title: 'Updated Reminder' });
    expect(result.title).toBe('Updated Reminder');
    expect(mockApiPut).toHaveBeenCalledWith('/calendar/reminders/rem-001', {
      title: 'Updated Reminder',
    });
  });
});

describe('deleteReminder', () => {
  it('deletes reminder by ID', async () => {
    mockApiDelete.mockResolvedValue(undefined);
    await expect(deleteReminder('rem-001')).resolves.toBeUndefined();
    expect(mockApiDelete).toHaveBeenCalledWith('/calendar/reminders/rem-001');
  });

  it('throws on failure', async () => {
    mockApiDelete.mockRejectedValue(new Error('Delete failed'));
    await expect(deleteReminder('rem-001')).rejects.toThrow('Delete failed');
  });
});

describe('calendarApi object', () => {
  it('exposes all event and reminder functions', () => {
    expect(typeof calendarApi.fetchEvents).toBe('function');
    expect(typeof calendarApi.createEvent).toBe('function');
    expect(typeof calendarApi.updateEvent).toBe('function');
    expect(typeof calendarApi.deleteEvent).toBe('function');
    expect(typeof calendarApi.fetchReminders).toBe('function');
    expect(typeof calendarApi.createReminder).toBe('function');
    expect(typeof calendarApi.updateReminder).toBe('function');
    expect(typeof calendarApi.deleteReminder).toBe('function');
  });
});
