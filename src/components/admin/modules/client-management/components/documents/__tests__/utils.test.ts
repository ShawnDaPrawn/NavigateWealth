import { describe, expect, it, vi } from 'vitest';
import {
  isValidUrl,
  validateFile,
  formatFileSize,
  formatDate,
  getCategoryConfig,
  filterDocuments,
  calculateStats,
  sortDocuments,
  groupByCategory,
  sanitizeFilename,
  generateDocumentId,
  createFilePath,
  extractFilename,
  isRecentDocument,
  getFileExtension,
  isValidFileExtension,
  debounce,
  getDisplayName,
  getDocumentTypeColor,
  getDocumentTypeBgColor,
} from '../utils';
import { FILE_CONSTRAINTS, CATEGORY_CONFIG } from '../constants';
import type { DocumentItem } from '../types';

function daysAgoISO(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

function doc(over: Partial<DocumentItem> = {}): DocumentItem {
  return {
    id: 'd1',
    userId: 'u1',
    type: 'document',
    title: 'Title',
    uploadDate: '2024-06-01T00:00:00.000Z',
    productCategory: 'General',
    policyNumber: 'POL-1',
    status: 'viewed',
    isFavourite: false,
    uploadedBy: 'u1',
    ...over,
  } as DocumentItem;
}

describe('isValidUrl', () => {
  it('accepts URLs with or without a protocol', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('example.com')).toBe(true);
    expect(isValidUrl('http://foo.co.za/path')).toBe(true);
  });
  it('rejects empty or non-URL text', () => {
    expect(isValidUrl('')).toBe(false);
    expect(isValidUrl('just text')).toBe(false);
  });
});

describe('validateFile', () => {
  it('accepts an allowed file under the size cap', () => {
    const f = new File(['hello'], 'a.pdf', { type: 'application/pdf' });
    expect(validateFile(f)).toEqual({ valid: true });
  });
  it('rejects an oversized file', () => {
    const f = new File(['x'], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(f, 'size', { value: FILE_CONSTRAINTS.MAX_SIZE_BYTES + 1 });
    const res = validateFile(f);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('less than');
  });
  it('rejects a disallowed mime type', () => {
    const f = new File(['x'], 'a.exe', { type: 'application/x-msdownload' });
    const res = validateFile(f);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('Invalid file type');
  });
});

describe('formatFileSize', () => {
  it('blanks falsy sizes and formats B/KB/MB', () => {
    expect(formatFileSize(undefined)).toBe('');
    expect(formatFileSize(0)).toBe('');
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.00 MB');
  });
});

describe('formatDate', () => {
  it('renders day, short month and year', () => {
    const s = formatDate('2024-01-15');
    expect(s).toContain('2024');
    expect(s).toContain('Jan');
    expect(s).toContain('15');
  });
});

describe('getCategoryConfig', () => {
  it('returns the matching config and falls back to General', () => {
    expect(getCategoryConfig('Life')).toBe(CATEGORY_CONFIG.Life);
    expect(getCategoryConfig('Nonexistent')).toBe(CATEGORY_CONFIG.General);
  });
});

describe('filterDocuments', () => {
  const items = [
    doc({ id: 'a', title: 'Alpha', productCategory: 'Life', uploadDate: daysAgoISO(2) }),
    doc({ id: 'b', title: 'Beta', productCategory: 'Investment', uploadDate: daysAgoISO(60) }),
    doc({
      id: 'c',
      title: 'Gamma',
      policyNumber: 'XYZ-999',
      productCategory: 'Life',
      uploadDate: daysAgoISO(10),
    }),
  ];

  it('filters by search query across title and policy number', () => {
    expect(
      filterDocuments(items, {
        searchQuery: 'alpha',
        categoryFilter: 'all',
        dateRangeFilter: 'all',
      }).map((d) => d.id),
    ).toEqual(['a']);
    expect(
      filterDocuments(items, {
        searchQuery: 'xyz',
        categoryFilter: 'all',
        dateRangeFilter: 'all',
      }).map((d) => d.id),
    ).toEqual(['c']);
  });
  it('filters by category', () => {
    expect(
      filterDocuments(items, { searchQuery: '', categoryFilter: 'Life', dateRangeFilter: 'all' })
        .map((d) => d.id)
        .sort(),
    ).toEqual(['a', 'c']);
  });
  it('filters out documents older than the selected range', () => {
    const recent = filterDocuments(items, {
      searchQuery: '',
      categoryFilter: 'all',
      dateRangeFilter: '30days',
    });
    expect(recent.find((d) => d.id === 'b')).toBeUndefined();
    expect(recent.map((d) => d.id).sort()).toEqual(['a', 'c']);
  });
  it('sorts newest first', () => {
    const all = filterDocuments(items, {
      searchQuery: '',
      categoryFilter: 'all',
      dateRangeFilter: 'all',
    });
    expect(all.map((d) => d.id)).toEqual(['a', 'c', 'b']);
  });
});

describe('calculateStats', () => {
  it('counts totals, types, new and favourite items', () => {
    const items = [
      doc({ type: 'document', status: 'new', isFavourite: true }),
      doc({ type: 'link', status: 'viewed', isFavourite: false }),
      doc({ type: 'document', status: 'new', isFavourite: false }),
    ];
    expect(calculateStats(items)).toEqual({
      totalItems: 3,
      totalDocs: 2,
      totalLinks: 1,
      newItems: 2,
      favouriteItems: 1,
    });
  });
});

describe('sortDocuments', () => {
  const items = [
    doc({ id: 'a', title: 'Banana', productCategory: 'Life', uploadDate: '2024-01-01' }),
    doc({ id: 'b', title: 'Apple', productCategory: 'Estate', uploadDate: '2024-03-01' }),
  ];
  it('sorts by date ascending and descending', () => {
    expect(sortDocuments(items, 'date', 'asc').map((d) => d.id)).toEqual(['a', 'b']);
    expect(sortDocuments(items, 'date', 'desc').map((d) => d.id)).toEqual(['b', 'a']);
  });
  it('sorts by title and category', () => {
    expect(sortDocuments(items, 'title', 'asc').map((d) => d.id)).toEqual(['b', 'a']);
    expect(sortDocuments(items, 'category', 'asc').map((d) => d.id)).toEqual(['b', 'a']);
  });
});

describe('groupByCategory', () => {
  it('buckets documents by product category', () => {
    const groups = groupByCategory([
      doc({ id: 'a', productCategory: 'Life' }),
      doc({ id: 'b', productCategory: 'Life' }),
      doc({ id: 'c', productCategory: 'Estate' }),
    ]);
    expect(Object.keys(groups).sort()).toEqual(['Estate', 'Life']);
    expect(groups.Life.map((d) => d.id)).toEqual(['a', 'b']);
  });
});

describe('filename helpers', () => {
  it('sanitizeFilename replaces unsafe characters with underscores', () => {
    expect(sanitizeFilename('my file@2.pdf')).toBe('my_file_2.pdf');
  });
  it('generateDocumentId is prefixed by type', () => {
    expect(generateDocumentId('document')).toMatch(/^doc_\d+$/);
    expect(generateDocumentId('link')).toMatch(/^link_\d+$/);
  });
  it('createFilePath namespaces by user and timestamps the sanitized name', () => {
    expect(createFilePath('user1', 'my report.pdf')).toMatch(/^user1\/\d+_my_report\.pdf$/);
  });
  it('extractFilename strips path and timestamp prefix', () => {
    expect(extractFilename('user1/1700000000_report.pdf')).toBe('report.pdf');
    expect(extractFilename('plain.pdf')).toBe('plain.pdf');
  });
  it('getFileExtension returns the dotted extension or empty', () => {
    expect(getFileExtension('report.PDF')).toBe('.PDF');
    expect(getFileExtension('noext')).toBe('');
  });
  it('isValidFileExtension is case-insensitive against the allow-list', () => {
    expect(isValidFileExtension('a.pdf')).toBe(true);
    expect(isValidFileExtension('a.PDF')).toBe(true);
    expect(isValidFileExtension('a.exe')).toBe(false);
  });
});

describe('isRecentDocument', () => {
  it('is true within seven days and false beyond', () => {
    expect(isRecentDocument(daysAgoISO(3))).toBe(true);
    expect(isRecentDocument(daysAgoISO(10))).toBe(false);
  });
});

describe('debounce', () => {
  it('invokes the wrapped function once after the wait window', () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn();
      const debounced = debounce(fn, 200);
      debounced();
      debounced();
      debounced();
      expect(fn).not.toHaveBeenCalled();
      vi.advanceTimersByTime(200);
      expect(fn).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('display helpers', () => {
  it('getDisplayName prefers link title and document fileName', () => {
    expect(getDisplayName(doc({ type: 'link', title: 'My Link' }))).toBe('My Link');
    expect(getDisplayName(doc({ type: 'document', fileName: 'file.pdf', title: 'T' }))).toBe(
      'file.pdf',
    );
    expect(getDisplayName(doc({ type: 'document', fileName: undefined, title: 'T' }))).toBe('T');
  });
  it('type colours differ for links and documents', () => {
    expect(getDocumentTypeColor('link')).toContain('purple');
    expect(getDocumentTypeColor('document')).toContain('red');
    expect(getDocumentTypeBgColor('link')).toContain('purple');
    expect(getDocumentTypeBgColor('document')).toContain('red');
  });
});
