import { describe, expect, it } from 'vitest';
import {
  filterDocuments,
  groupDocumentsByPack,
  type DocumentItem,
  type DocPack,
} from '../documentsUtils';

const doc = (over: Partial<DocumentItem>): DocumentItem => ({
  id: 'd',
  userId: 'u',
  type: 'document',
  title: 'T',
  uploadDate: '2024-06-01',
  productCategory: 'Life',
  policyNumber: 'P1',
  status: 'new',
  isFavourite: false,
  uploadedBy: 'admin',
  ...over,
});

const noFilters = {
  searchQuery: '',
  filterCategory: 'All',
  filterDateStart: '',
  filterDateEnd: '',
};

describe('filterDocuments', () => {
  it('matches the search query against title and fileName', () => {
    const docs = [
      doc({ id: '1', title: 'Tax cert' }),
      doc({ id: '2', title: 'Will', fileName: 'tax-2024.pdf' }),
      doc({ id: '3', title: 'Unrelated' }),
    ];
    expect(filterDocuments(docs, { ...noFilters, searchQuery: 'tax' }).map((d) => d.id)).toEqual([
      '1',
      '2',
    ]);
  });

  it('filters by product category', () => {
    const docs = [
      doc({ id: '1', productCategory: 'Life' }),
      doc({ id: '2', productCategory: 'Investment' }),
    ];
    expect(
      filterDocuments(docs, { ...noFilters, filterCategory: 'Investment' }).map((d) => d.id),
    ).toEqual(['2']);
  });

  it('filters by date range with an inclusive end date', () => {
    const docs = [
      doc({ id: '1', uploadDate: '2024-05-01' }),
      doc({ id: '2', uploadDate: '2024-06-15' }),
    ];
    expect(
      filterDocuments(docs, {
        ...noFilters,
        filterDateStart: '2024-06-01',
        filterDateEnd: '2024-06-30',
      }).map((d) => d.id),
    ).toEqual(['2']);
  });
});

describe('groupDocumentsByPack', () => {
  it('collapses packId-sharing documents into a pack and passes singles through', () => {
    const docs = [
      doc({ id: 'a', packId: 'pk', title: 'A (1)', packTitle: 'Pack', status: 'viewed' }),
      doc({ id: 'b', packId: 'pk', title: 'A (2)', status: 'new' }),
      doc({ id: 'c', title: 'Solo' }),
    ];
    const grouped = groupDocumentsByPack(docs);
    expect(grouped).toHaveLength(2);

    const pack = grouped[0] as DocPack;
    expect(pack.type).toBe('pack');
    expect(pack.id).toBe('pk');
    expect(pack.title).toBe('Pack');
    expect(pack.documents.map((d) => d.id)).toEqual(['a', 'b']);
    expect(pack.status).toBe('new'); // any member 'new' -> pack 'new'

    expect((grouped[1] as DocumentItem).id).toBe('c');
  });
});
