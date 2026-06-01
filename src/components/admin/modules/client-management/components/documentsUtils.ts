/**
 * Pure helpers extracted from DocumentsTab.tsx (Phase 6 god-file split).
 *
 * Document filtering + pack grouping — no React, no I/O — lifted out so they can
 * be unit-tested and the 1.9k-line component shrinks toward its rendering
 * responsibility. Tested in documentsUtils.test.ts.
 */

export interface DocumentItem {
  id: string;
  userId: string;
  type: 'document' | 'link';
  title: string;
  uploadDate: string;
  productCategory: string;
  policyNumber: string;
  status: 'new' | 'viewed';
  isFavourite: boolean;
  uploadedBy: string;
  // Grouping
  packId?: string;
  packTitle?: string;
  subcategory?: string;
  // Document specific
  fileName?: string;
  fileSize?: number;
  filePath?: string;
  // Link specific
  url?: string;
  description?: string;
  // Generated system documents
  sourceSystem?: string;
  downloadMode?: 'roa-generated' | 'roa-evidence';
  sha256?: string;
  roaDocumentStatus?: 'draft' | 'final';
  roaFormat?: 'pdf' | 'docx';
  roaModuleId?: string;
  roaRequirementId?: string;
}

export interface DocumentFilters {
  searchQuery: string;
  filterCategory: string;
  filterDateStart: string;
  filterDateEnd: string;
}

/** Apply the search-query, category and date-range filters to a document list. */
export function filterDocuments(
  documents: DocumentItem[],
  filters: DocumentFilters,
): DocumentItem[] {
  const { searchQuery, filterCategory, filterDateStart, filterDateEnd } = filters;
  return documents.filter((doc) => {
    // Search query
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      doc.title.toLowerCase().includes(searchLower) ||
      (doc.fileName && doc.fileName.toLowerCase().includes(searchLower)) ||
      (doc.policyNumber && doc.policyNumber.toLowerCase().includes(searchLower)) ||
      (doc.description && doc.description.toLowerCase().includes(searchLower));

    // Category filter
    const matchesCategory = filterCategory === 'All' || doc.productCategory === filterCategory;

    // Date range filter
    let matchesDate = true;
    if (filterDateStart) {
      matchesDate = matchesDate && new Date(doc.uploadDate) >= new Date(filterDateStart);
    }
    if (filterDateEnd) {
      // Add 1 day to include the end date fully (since date inputs are usually 00:00)
      const endDate = new Date(filterDateEnd);
      endDate.setHours(23, 59, 59, 999);
      matchesDate = matchesDate && new Date(doc.uploadDate) <= endDate;
    }

    return matchesSearch && matchesCategory && matchesDate;
  });
}

/** A group of documents sharing a packId (subcategory / multi-file upload). */
export interface DocPack {
  type: 'pack';
  id: string;
  title: string;
  documents: DocumentItem[];
  category: string;
  date: string;
  status: string;
  policyNumber?: string;
}

export type GroupedDocItem = DocumentItem | DocPack;

/** Collapse packId-sharing documents into a single pack entry; singles pass through. */
export function groupDocumentsByPack(filteredDocuments: DocumentItem[]): GroupedDocItem[] {
  const groupedItems: GroupedDocItem[] = [];
  const processedPackIds = new Set<string>();

  filteredDocuments.forEach((doc) => {
    // Group if packId exists (Subcategory upload or multi-file upload)
    if (doc.packId) {
      if (!processedPackIds.has(doc.packId)) {
        processedPackIds.add(doc.packId);
        const packDocs = filteredDocuments.filter((d) => d.packId === doc.packId);
        // Sort inside pack
        const sortedPackDocs = [...packDocs].sort((a, b) =>
          a.title.localeCompare(b.title, undefined, { numeric: true }),
        );

        groupedItems.push({
          type: 'pack',
          id: doc.packId,
          title: doc.packTitle || doc.title.replace(/\s\(\d+\)$/, ''),
          documents: sortedPackDocs,
          category: doc.productCategory,
          date: doc.uploadDate,
          status: packDocs.some((d) => d.status === 'new') ? 'new' : 'viewed',
          policyNumber: doc.policyNumber,
        });
      }
    } else {
      // Single document (no packId)
      groupedItems.push(doc);
    }
  });

  return groupedItems;
}
