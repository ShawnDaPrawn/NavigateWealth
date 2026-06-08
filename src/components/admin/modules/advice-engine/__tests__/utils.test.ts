import { describe, it, expect } from 'vitest';
import type { Message, Client, RoADraft, RoAField, RoAFormData } from '../types';
import {
  formatTimestamp,
  truncateMessage,
  countConversationCharacters,
  extractCodeBlocks,
  buildConversationHistory,
  getLastNMessages,
  getClientMessages,
  formatClientName,
  formatClientDisplay,
  getClientInitials,
  validateChatInput,
  validateRoAForm,
  calculateDraftCompletion,
  canSubmitDraft,
  formatDate,
  formatDateTime,
  getRelativeTime,
  highlightText,
  extractKeywords,
  isUserMessage,
  isAssistantMessage,
  isSystemMessage,
  isApiKeyConfigured,
  isRoAComplete,
} from '../utils';

const makeMessage = (
  role: 'user' | 'assistant' | 'system',
  content: string,
  clientId?: string,
): Message => ({
  role,
  content,
  timestamp: new Date('2026-01-01T10:00:00Z'),
  clientId,
});

const makeClient = (overrides: Partial<Client> = {}): Client => ({
  user_id: 'u1',
  first_name: 'John',
  last_name: 'Smith',
  email: 'john@example.com',
  ...overrides,
});

const makeDraft = (overrides: Partial<RoADraft> = {}): RoADraft => ({
  id: 'd1',
  selectedModules: ['risk'],
  moduleData: {},
  status: 'draft',
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1,
  clientId: 'c1',
  ...overrides,
});

// ── formatTimestamp ──────────────────────────────────────────────────────────

describe('formatTimestamp', () => {
  it('returns a 12-hour time string', () => {
    const date = new Date('2026-06-07T14:30:00');
    const result = formatTimestamp(date);
    expect(result).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/i);
  });
});

// ── truncateMessage ──────────────────────────────────────────────────────────

describe('truncateMessage', () => {
  it('returns message unchanged when within limit', () => {
    expect(truncateMessage('Hello', 100)).toBe('Hello');
  });

  it('truncates and appends ellipsis when over limit', () => {
    const result = truncateMessage('Hello World!', 8);
    expect(result).toBe('Hello...');
    expect(result.length).toBe(8);
  });

  it('uses default maxLength of 100', () => {
    const long = 'a'.repeat(150);
    expect(truncateMessage(long)).toHaveLength(100);
  });
});

// ── countConversationCharacters ──────────────────────────────────────────────

describe('countConversationCharacters', () => {
  it('returns 0 for empty array', () => {
    expect(countConversationCharacters([])).toBe(0);
  });

  it('sums content lengths', () => {
    const msgs = [makeMessage('user', 'Hello'), makeMessage('assistant', 'World!!')];
    expect(countConversationCharacters(msgs)).toBe(12);
  });
});

// ── extractCodeBlocks ────────────────────────────────────────────────────────

describe('extractCodeBlocks', () => {
  it('returns empty array when no code blocks', () => {
    expect(extractCodeBlocks('plain text')).toEqual([]);
  });

  it('extracts single code block', () => {
    const result = extractCodeBlocks('Before ```const x = 1``` after');
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('const x = 1');
  });

  it('extracts multiple code blocks', () => {
    const result = extractCodeBlocks('```foo``` and ```bar```');
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('foo');
    expect(result[1]).toBe('bar');
  });
});

// ── buildConversationHistory ─────────────────────────────────────────────────

describe('buildConversationHistory', () => {
  it('filters out system messages', () => {
    const msgs = [
      makeMessage('system', 'system prompt'),
      makeMessage('user', 'hi'),
      makeMessage('assistant', 'hello'),
    ];
    const result = buildConversationHistory(msgs);
    expect(result.messages).toHaveLength(2);
    expect(result.messages.every((m) => m.role !== 'system')).toBe(true);
  });

  it('limits to maxMessages', () => {
    const msgs = Array.from({ length: 15 }, (_, i) => makeMessage('user', `msg ${i}`));
    const result = buildConversationHistory(msgs, 5);
    expect(result.messages).toHaveLength(5);
  });

  it('returns last N messages when more than max', () => {
    const msgs = Array.from({ length: 12 }, (_, i) => makeMessage('user', `msg ${i}`));
    const result = buildConversationHistory(msgs, 10);
    expect(result.messages).toHaveLength(10);
    expect(result.messages[9].content).toBe('msg 11');
  });
});

// ── getLastNMessages ─────────────────────────────────────────────────────────

describe('getLastNMessages', () => {
  it('returns last N messages', () => {
    const msgs = [makeMessage('user', '1'), makeMessage('user', '2'), makeMessage('user', '3')];
    const result = getLastNMessages(msgs, 2);
    expect(result).toHaveLength(2);
    expect(result[1].content).toBe('3');
  });

  it('returns all when N exceeds length', () => {
    const msgs = [makeMessage('user', '1')];
    expect(getLastNMessages(msgs, 10)).toHaveLength(1);
  });
});

// ── getClientMessages ────────────────────────────────────────────────────────

describe('getClientMessages', () => {
  it('filters by clientId', () => {
    const msgs = [
      makeMessage('user', 'for c1', 'c1'),
      makeMessage('user', 'for c2', 'c2'),
      makeMessage('user', 'also c1', 'c1'),
    ];
    const result = getClientMessages(msgs, 'c1');
    expect(result).toHaveLength(2);
  });

  it('returns empty array when no matches', () => {
    const msgs = [makeMessage('user', 'msg', 'c1')];
    expect(getClientMessages(msgs, 'c99')).toHaveLength(0);
  });
});

// ── formatClientName ─────────────────────────────────────────────────────────

describe('formatClientName', () => {
  it('returns empty string for null', () => {
    expect(formatClientName(null)).toBe('');
  });

  it('returns trimmed full name', () => {
    expect(formatClientName(makeClient())).toBe('John Smith');
  });

  it('trims when one part is empty', () => {
    expect(formatClientName(makeClient({ last_name: '' }))).toBe('John');
  });
});

// ── formatClientDisplay ──────────────────────────────────────────────────────

describe('formatClientDisplay', () => {
  it('appends email in parentheses', () => {
    const result = formatClientDisplay(makeClient());
    expect(result).toBe('John Smith (john@example.com)');
  });

  it('returns only name when email is absent', () => {
    const result = formatClientDisplay(makeClient({ email: '' }));
    expect(result).toBe('John Smith');
  });
});

// ── getClientInitials ────────────────────────────────────────────────────────

describe('getClientInitials', () => {
  it('returns uppercase initials', () => {
    expect(getClientInitials(makeClient())).toBe('JS');
  });

  it('handles missing parts gracefully', () => {
    expect(getClientInitials(makeClient({ first_name: '', last_name: 'Doe' }))).toBe('D');
  });
});

// ── validateChatInput ────────────────────────────────────────────────────────

describe('validateChatInput', () => {
  it('returns true for non-empty input', () => {
    expect(validateChatInput('Hello!')).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(validateChatInput('')).toBe(false);
  });

  it('returns false for whitespace-only', () => {
    expect(validateChatInput('   ')).toBe(false);
  });

  it('returns false for input over 4000 chars', () => {
    expect(validateChatInput('a'.repeat(4001))).toBe(false);
  });

  it('returns true for exactly 4000 chars', () => {
    expect(validateChatInput('a'.repeat(4000))).toBe(true);
  });
});

// ── validateRoAForm ──────────────────────────────────────────────────────────

describe('validateRoAForm', () => {
  const textField = (key: string, required = true): RoAField => ({
    key,
    label: key,
    type: 'text',
    required,
  });

  it('returns valid=true with no errors when all required fields filled', () => {
    const result = validateRoAForm({ name: 'Alice' } as RoAFormData, [textField('name')]);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
    expect(result.message).toBeUndefined();
  });

  it('returns error for missing required field', () => {
    const result = validateRoAForm({} as RoAFormData, [textField('name')]);
    expect(result.valid).toBe(false);
    expect(result.errors.name).toContain('required');
    expect(result.message).toContain('1 validation error');
  });

  it('skips empty optional fields', () => {
    const field: RoAField = { key: 'bio', label: 'Bio', type: 'text', required: false };
    const result = validateRoAForm({ bio: '' } as RoAFormData, [field]);
    expect(result.valid).toBe(true);
  });

  it('enforces minLength on text field', () => {
    const field: RoAField = {
      key: 'desc',
      label: 'Desc',
      type: 'text',
      required: true,
      validation: { minLength: 10 },
    };
    const result = validateRoAForm({ desc: 'short' } as RoAFormData, [field]);
    expect(result.valid).toBe(false);
    expect(result.errors.desc).toContain('at least 10');
  });

  it('enforces maxLength on text field', () => {
    const field: RoAField = {
      key: 'desc',
      label: 'Desc',
      type: 'text',
      required: true,
      validation: { maxLength: 5 },
    };
    const result = validateRoAForm({ desc: 'toolongvalue' } as RoAFormData, [field]);
    expect(result.errors.desc).toContain('at most 5');
  });

  it('enforces pattern on text field', () => {
    const field: RoAField = {
      key: 'code',
      label: 'Code',
      type: 'text',
      required: true,
      validation: { pattern: /^\d+$/ },
    };
    const result = validateRoAForm({ code: 'abc' } as RoAFormData, [field]);
    expect(result.errors.code).toContain('invalid');
  });

  it('validates number field', () => {
    const field: RoAField = {
      key: 'age',
      label: 'Age',
      type: 'number',
      required: true,
      validation: { min: 18, max: 120 },
    };
    expect(validateRoAForm({ age: 17 } as RoAFormData, [field]).valid).toBe(false);
    expect(validateRoAForm({ age: 25 } as RoAFormData, [field]).valid).toBe(true);
    expect(validateRoAForm({ age: 121 } as RoAFormData, [field]).valid).toBe(false);
  });

  it('catches NaN number values', () => {
    const field: RoAField = { key: 'n', label: 'N', type: 'number', required: true };
    const result = validateRoAForm({ n: 'not-a-number' } as RoAFormData, [field]);
    expect(result.errors.n).toContain('must be a number');
  });

  it('validates select field against options', () => {
    const field: RoAField = {
      key: 'color',
      label: 'Color',
      type: 'select',
      required: true,
      options: ['red', 'blue'],
    };
    expect(validateRoAForm({ color: 'green' } as RoAFormData, [field]).valid).toBe(false);
    expect(validateRoAForm({ color: 'red' } as RoAFormData, [field]).valid).toBe(true);
  });

  it('reports multiple errors', () => {
    const fields = [textField('a'), textField('b')];
    const result = validateRoAForm({} as RoAFormData, fields);
    expect(result.message).toContain('2 validation error');
  });
});

// ── calculateDraftCompletion ─────────────────────────────────────────────────

describe('calculateDraftCompletion', () => {
  it('returns 0 when totalFields is 0', () => {
    expect(
      calculateDraftCompletion(makeDraft({ moduleData: { a: 'x' } as RoADraft['moduleData'] }), 0),
    ).toBe(0);
  });

  it('calculates percentage of filled fields', () => {
    const draft = makeDraft({
      moduleData: { a: 'filled', b: '', c: null, d: 'also' } as unknown as RoADraft['moduleData'],
    });
    expect(calculateDraftCompletion(draft, 4)).toBe(50);
  });

  it('returns 100 when all fields filled', () => {
    const draft = makeDraft({ moduleData: { a: '1', b: '2' } as RoADraft['moduleData'] });
    expect(calculateDraftCompletion(draft, 2)).toBe(100);
  });
});

// ── canSubmitDraft ───────────────────────────────────────────────────────────

describe('canSubmitDraft', () => {
  it('returns false when no modules selected', () => {
    const draft = makeDraft({ selectedModules: [] });
    expect(canSubmitDraft(draft, [])).toBe(false);
  });

  it('returns false when no client id and no client data', () => {
    const draft = makeDraft({ clientId: undefined, clientData: undefined });
    expect(canSubmitDraft(draft, [])).toBe(false);
  });

  it('returns false when required field is missing', () => {
    const draft = makeDraft({ moduleData: {} });
    expect(canSubmitDraft(draft, ['requiredField'])).toBe(false);
  });

  it('returns true when all conditions met', () => {
    const draft = makeDraft({ moduleData: { field: 'value' } as RoADraft['moduleData'] });
    expect(canSubmitDraft(draft, ['field'])).toBe(true);
  });

  it('accepts draft with clientData instead of clientId', () => {
    const draft = makeDraft({
      clientId: undefined,
      clientData: {
        firstName: 'A',
        lastName: 'B',
        email: 'a@b.com',
        mobile: '0',
        idOrDob: '1',
        advisorId: 'adv',
      },
    });
    expect(canSubmitDraft(draft, [])).toBe(true);
  });
});

// ── formatDate / formatDateTime ──────────────────────────────────────────────

describe('formatDate', () => {
  it('returns a date string with month name, day and year', () => {
    const result = formatDate(new Date('2026-01-04T00:00:00Z'));
    expect(result).toMatch(/Jan/i);
    expect(result).toMatch(/2026/);
  });
});

describe('formatDateTime', () => {
  it('combines date and time parts', () => {
    const result = formatDateTime(new Date('2026-01-04T14:30:00'));
    expect(result).toMatch(/Jan/i);
    expect(result).toContain(' at ');
  });
});

// ── getRelativeTime ──────────────────────────────────────────────────────────

describe('getRelativeTime', () => {
  it('returns "just now" for recent events', () => {
    expect(getRelativeTime(new Date(Date.now() - 5000))).toBe('just now');
  });

  it('returns minutes ago', () => {
    const result = getRelativeTime(new Date(Date.now() - 2 * 60 * 1000));
    expect(result).toBe('2 minutes ago');
  });

  it('returns singular minute', () => {
    const result = getRelativeTime(new Date(Date.now() - 60 * 1000));
    expect(result).toBe('1 minute ago');
  });

  it('returns hours ago', () => {
    const result = getRelativeTime(new Date(Date.now() - 3 * 60 * 60 * 1000));
    expect(result).toBe('3 hours ago');
  });

  it('returns singular hour', () => {
    const result = getRelativeTime(new Date(Date.now() - 60 * 60 * 1000));
    expect(result).toBe('1 hour ago');
  });

  it('returns days ago', () => {
    const result = getRelativeTime(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000));
    expect(result).toBe('3 days ago');
  });

  it('returns formatted date for old events', () => {
    const result = getRelativeTime(new Date('2020-01-01T00:00:00Z'));
    expect(result).toMatch(/2020/);
  });
});

// ── highlightText ────────────────────────────────────────────────────────────

describe('highlightText', () => {
  it('wraps matching text in <mark> tags', () => {
    expect(highlightText('Hello World', 'world')).toBe('Hello <mark>World</mark>');
  });

  it('is case-insensitive', () => {
    expect(highlightText('JOHN smith', 'john')).toContain('<mark>JOHN</mark>');
  });

  it('returns original text when searchTerm is empty', () => {
    expect(highlightText('Hello World', '')).toBe('Hello World');
  });

  it('highlights multiple occurrences', () => {
    const result = highlightText('cat and cat', 'cat');
    expect(result).toBe('<mark>cat</mark> and <mark>cat</mark>');
  });
});

// ── extractKeywords ──────────────────────────────────────────────────────────

describe('extractKeywords', () => {
  it('extracts unique words above minimum length', () => {
    const result = extractKeywords('life insurance policy');
    expect(result).toContain('life');
    expect(result).toContain('insurance');
    expect(result).toContain('policy');
  });

  it('excludes common words', () => {
    const result = extractKeywords('the insurance for the client');
    expect(result).not.toContain('the');
    expect(result).not.toContain('for');
  });

  it('excludes words shorter than minLength', () => {
    const result = extractKeywords('hi insurance', 4);
    expect(result).not.toContain('hi');
    expect(result).toContain('insurance');
  });

  it('returns deduplicated keywords', () => {
    const result = extractKeywords('insurance insurance policy');
    expect(result.filter((k) => k === 'insurance')).toHaveLength(1);
  });
});

// ── type guards ──────────────────────────────────────────────────────────────

describe('isUserMessage', () => {
  it('returns true for user role', () => {
    expect(isUserMessage(makeMessage('user', 'hi'))).toBe(true);
  });

  it('returns false for non-user role', () => {
    expect(isUserMessage(makeMessage('assistant', 'hi'))).toBe(false);
  });
});

describe('isAssistantMessage', () => {
  it('returns true for assistant role', () => {
    expect(isAssistantMessage(makeMessage('assistant', 'hi'))).toBe(true);
  });
});

describe('isSystemMessage', () => {
  it('returns true for system role', () => {
    expect(isSystemMessage(makeMessage('system', 'hi'))).toBe(true);
  });
});

describe('isApiKeyConfigured', () => {
  it('returns true when configured is true', () => {
    expect(isApiKeyConfigured({ configured: true })).toBe(true);
  });

  it('returns false when configured is false', () => {
    expect(isApiKeyConfigured({ configured: false })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isApiKeyConfigured(null)).toBe(false);
  });
});

describe('isRoAComplete', () => {
  it('returns true for complete status', () => {
    expect(isRoAComplete(makeDraft({ status: 'complete' }))).toBe(true);
  });

  it('returns true for submitted status', () => {
    expect(isRoAComplete(makeDraft({ status: 'submitted' }))).toBe(true);
  });

  it('returns false for draft status', () => {
    expect(isRoAComplete(makeDraft({ status: 'draft' }))).toBe(false);
  });

  it('returns false for archived status', () => {
    expect(isRoAComplete(makeDraft({ status: 'archived' }))).toBe(false);
  });
});
