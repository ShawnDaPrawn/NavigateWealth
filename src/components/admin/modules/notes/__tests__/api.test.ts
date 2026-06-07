import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotesAPI, NotesApiError } from '../api';

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

const MOCK_NOTE = {
  id: 'note-001',
  title: 'Meeting Notes',
  content: 'Discussed portfolio rebalancing',
  personnelId: 'per-001',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('NotesAPI', () => {
  describe('getNotes', () => {
    it('returns notes for personnel member', async () => {
      mockApiGet.mockResolvedValue({ notes: [MOCK_NOTE] });
      const result = await NotesAPI.getNotes('per-001');
      expect(result).toEqual([MOCK_NOTE]);
      expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('personnelId=per-001'));
    });

    it('returns empty array when no notes', async () => {
      mockApiGet.mockResolvedValue({ notes: [] });
      const result = await NotesAPI.getNotes('per-001');
      expect(result).toEqual([]);
    });

    it('returns empty array when notes absent in response', async () => {
      mockApiGet.mockResolvedValue({});
      const result = await NotesAPI.getNotes('per-001');
      expect(result).toEqual([]);
    });

    it('throws NotesApiError on API error', async () => {
      mockApiGet.mockRejectedValue(new Error('Network error'));
      await expect(NotesAPI.getNotes('per-001')).rejects.toThrow(NotesApiError);
    });
  });

  describe('getClientNotes', () => {
    it('returns notes linked to a client', async () => {
      mockApiGet.mockResolvedValue({ notes: [MOCK_NOTE] });
      const result = await NotesAPI.getClientNotes('client-001');
      expect(result).toEqual([MOCK_NOTE]);
      expect(mockApiGet).toHaveBeenCalledWith('/notes/client/client-001');
    });

    it('throws NotesApiError on API error', async () => {
      mockApiGet.mockRejectedValue(new Error('Not found'));
      await expect(NotesAPI.getClientNotes('client-001')).rejects.toThrow(NotesApiError);
    });
  });

  describe('getNote', () => {
    it('returns a single note by ID', async () => {
      mockApiGet.mockResolvedValue({ note: MOCK_NOTE });
      const result = await NotesAPI.getNote('note-001');
      expect(result).toEqual(MOCK_NOTE);
      expect(mockApiGet).toHaveBeenCalledWith('/notes/note-001');
    });

    it('throws NotesApiError when note not found in response', async () => {
      mockApiGet.mockResolvedValue({});
      await expect(NotesAPI.getNote('note-001')).rejects.toThrow(NotesApiError);
    });

    it('throws NotesApiError on API error', async () => {
      mockApiGet.mockRejectedValue(new Error('Not found'));
      await expect(NotesAPI.getNote('note-001')).rejects.toThrow(NotesApiError);
    });
  });

  describe('createNote', () => {
    it('creates and returns a new note', async () => {
      mockApiPost.mockResolvedValue({ note: MOCK_NOTE });
      const result = await NotesAPI.createNote({
        title: 'Meeting Notes',
        content: 'Discussion details',
        personnelId: 'per-001',
      } as never);
      expect(result).toEqual(MOCK_NOTE);
      expect(mockApiPost).toHaveBeenCalledWith('/notes', expect.any(Object));
    });

    it('throws NotesApiError on API error', async () => {
      mockApiPost.mockRejectedValue(new Error('Create failed'));
      await expect(NotesAPI.createNote({ title: 'Test' } as never)).rejects.toThrow(NotesApiError);
    });
  });

  describe('updateNote', () => {
    it('updates and returns the modified note', async () => {
      const updated = { ...MOCK_NOTE, title: 'Updated Meeting Notes' };
      mockApiPut.mockResolvedValue({ note: updated });
      const result = await NotesAPI.updateNote({
        id: 'note-001',
        title: 'Updated Meeting Notes',
      } as never);
      expect(result.title).toBe('Updated Meeting Notes');
      expect(mockApiPut).toHaveBeenCalledWith('/notes/note-001', {
        title: 'Updated Meeting Notes',
      });
    });

    it('throws NotesApiError on API error', async () => {
      mockApiPut.mockRejectedValue(new Error('Update failed'));
      await expect(NotesAPI.updateNote({ id: 'note-001' } as never)).rejects.toThrow(NotesApiError);
    });
  });

  describe('deleteNote', () => {
    it('deletes note by ID', async () => {
      mockApiDelete.mockResolvedValue(undefined);
      await expect(NotesAPI.deleteNote('note-001')).resolves.toBeUndefined();
      expect(mockApiDelete).toHaveBeenCalledWith('/notes/note-001');
    });

    it('throws NotesApiError on API error', async () => {
      mockApiDelete.mockRejectedValue(new Error('Delete failed'));
      await expect(NotesAPI.deleteNote('note-001')).rejects.toThrow(NotesApiError);
    });
  });

  describe('convertToTask', () => {
    it('converts note to task and returns task ID and note', async () => {
      mockApiPost.mockResolvedValue({ taskId: 'task-001', note: MOCK_NOTE });
      const result = await NotesAPI.convertToTask('note-001');
      expect(result.taskId).toBe('task-001');
      expect(result.note).toEqual(MOCK_NOTE);
      expect(mockApiPost).toHaveBeenCalledWith('/notes/note-001/convert-to-task', {});
    });

    it('throws NotesApiError on API error', async () => {
      mockApiPost.mockRejectedValue(new Error('Convert failed'));
      await expect(NotesAPI.convertToTask('note-001')).rejects.toThrow(NotesApiError);
    });
  });

  describe('transcribe', () => {
    it('transcribes audio and returns text', async () => {
      mockApiPost.mockResolvedValue({ success: true, text: 'Transcribed text', duration: 10 });
      const result = await NotesAPI.transcribe('base64audiodata', 'wav');
      expect(result.text).toBe('Transcribed text');
      expect(result.duration).toBe(10);
      expect(mockApiPost).toHaveBeenCalledWith('/transcription/transcribe', {
        audio: 'base64audiodata',
        format: 'wav',
        language: undefined,
      });
    });

    it('passes language parameter when provided', async () => {
      mockApiPost.mockResolvedValue({ success: true, text: 'Tekst', duration: 5 });
      await NotesAPI.transcribe('audiodata', 'mp3', 'af');
      expect(mockApiPost).toHaveBeenCalledWith('/transcription/transcribe', {
        audio: 'audiodata',
        format: 'mp3',
        language: 'af',
      });
    });

    it('throws NotesApiError when success is false', async () => {
      mockApiPost.mockResolvedValue({ success: false, error: 'Audio quality too poor' });
      await expect(NotesAPI.transcribe('badaudio', 'wav')).rejects.toThrow(NotesApiError);
    });

    it('throws NotesApiError on API error', async () => {
      mockApiPost.mockRejectedValue(new Error('Transcription service unavailable'));
      await expect(NotesAPI.transcribe('audio', 'wav')).rejects.toThrow(NotesApiError);
    });
  });

  describe('summariseNote', () => {
    it('returns summary and updated note', async () => {
      const summarised = { ...MOCK_NOTE, content: 'Summarised content' };
      mockApiPost.mockResolvedValue({
        success: true,
        summary: 'Key points: ...',
        note: summarised,
      });
      const result = await NotesAPI.summariseNote('note-001');
      expect(result.summary).toBe('Key points: ...');
      expect(result.note).toEqual(summarised);
      expect(mockApiPost).toHaveBeenCalledWith('/notes/note-001/summarise', {});
    });

    it('throws NotesApiError when success is false', async () => {
      mockApiPost.mockResolvedValue({ success: false, error: 'Content too short' });
      await expect(NotesAPI.summariseNote('note-001')).rejects.toThrow(NotesApiError);
    });

    it('throws NotesApiError on API error', async () => {
      mockApiPost.mockRejectedValue(new Error('AI service unavailable'));
      await expect(NotesAPI.summariseNote('note-001')).rejects.toThrow(NotesApiError);
    });
  });
});

describe('NotesApiError', () => {
  it('creates error with message, code, and details', () => {
    const error = new NotesApiError('Note not found', 'NOT_FOUND', { id: 'note-001' });
    expect(error.message).toBe('Note not found');
    expect(error.code).toBe('NOT_FOUND');
    expect(error.details).toEqual({ id: 'note-001' });
    expect(error.name).toBe('NotesApiError');
    expect(error).toBeInstanceOf(Error);
  });

  it('creates error with message only', () => {
    const error = new NotesApiError('Generic error');
    expect(error.message).toBe('Generic error');
    expect(error.code).toBeUndefined();
    expect(error.details).toBeUndefined();
  });
});
