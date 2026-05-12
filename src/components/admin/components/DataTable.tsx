import React, { useState, useEffect } from 'react';
import { cn } from '../../ui/utils';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import { Skeleton } from '../../ui/skeleton';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../../ui/table';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Filter,
  Settings,
  Search
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';

/** Numbered pagination buttons spanning up to maxButtons pages around currentPage (1-based). */
function getPaginationButtonPages(
  currentPage: number,
  totalPages: number,
  maxButtons: number,
): number[] {
  if (totalPages <= maxButtons) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const half = Math.floor(maxButtons / 2);
  let start = currentPage - half;
  let end = currentPage + half;

  if (start < 1) {
    start = 1;
    end = maxButtons;
  }
  if (end > totalPages) {
    end = totalPages;
    start = totalPages - maxButtons + 1;
  }
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export interface Column<T = Record<string, unknown>> {
  key: string;
  title: string;
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: unknown, row: T) => React.ReactNode;
  width?: string;
}

export interface DataTableProps<T = Record<string, unknown>> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  exportable?: boolean;
  exportFilename?: string;
  onRowClick?: (row: T) => void;
  pageSize?: number;
  /** When provided, pagination footer includes a rows-per-page selector */
  rowSizeOptions?: readonly number[];
  getRowKey?: (row: T) => React.Key;
  emptyState?: React.ReactNode;
  className?: string;
  /** When false, all rows render in one scrollable list (document scroll). Defaults to true. */
  paginate?: boolean;
}

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  loading = false,
  searchable = true,
  searchPlaceholder = "Search...",
  exportable = true,
  exportFilename = "data",
  onRowClick,
  pageSize = 10,
  rowSizeOptions,
  getRowKey,
  emptyState,
  className,
  paginate = true,
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(pageSize);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    columns.map(col => col.key)
  );

  useEffect(() => {
    setRowsPerPage(pageSize);
  }, [pageSize]);

  // Filter data based on search query
  const filteredData = searchQuery
    ? data.filter(row =>
        Object.values(row).some(value =>
          String(value).toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    : data;

  // Sort data
  const sortedData = sortColumn
    ? [...filteredData].sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];
        
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      })
    : filteredData;

  useEffect(() => {
    if (!paginate) return;
    const totalPg = Math.max(1, Math.ceil(sortedData.length / rowsPerPage) || 1);
    setCurrentPage(p => Math.min(p, totalPg));
  }, [paginate, sortedData.length, rowsPerPage]);

  // Paginate data (optional — Client Management prefers one long alphabetical list)
  const totalPages = paginate ? Math.max(1, Math.ceil(sortedData.length / rowsPerPage) || 1) : 1;
  const paginatedData = paginate
    ? sortedData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)
    : sortedData;

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  const exportToCSV = () => {
    const visibleCols = columns.filter(col => visibleColumns.includes(col.key));
    const csvHeader = visibleCols.map(col => col.title).join(',');
    const csvRows = sortedData.map(row =>
      visibleCols.map(col => {
        const value = row[col.key];
        return typeof value === 'string' && value.includes(',') 
          ? `"${value}"` 
          : String(value);
      }).join(',')
    );
    
    const csvContent = [csvHeader, ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${exportFilename}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const LoadingSkeleton = () => (
    <div className="space-y-0" role="status" aria-label="Loading table data">
      {Array.from({ length: Math.min(rowsPerPage, 12) }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-b-0">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
      <span className="sr-only">Loading data, please wait…</span>
    </div>
  );

  const EmptyState = () => emptyState || (
    <div className="text-center py-12">
      <div className="text-muted-foreground">
        <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <h3 className="text-lg font-medium mb-2">No data found</h3>
        <p>No results match your current filters.</p>
      </div>
    </div>
  );

  return (
    <div className={cn("space-y-4", className)}>
      {/* Table Controls */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Search */}
        {searchable && (
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10"
              aria-label={searchPlaceholder}
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* Export */}
          {exportable && (
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              {columns
                .filter(col => visibleColumns.includes(col.key))
                .map((column) => (
                  <TableHead 
                    key={column.key}
                    style={{ width: column.width }}
                    className={cn(
                      column.sortable && "cursor-pointer hover:bg-muted/50",
                      "select-none"
                    )}
                    onClick={() => column.sortable && handleSort(column.key)}
                    onKeyDown={(e) => {
                      if (column.sortable && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        handleSort(column.key);
                      }
                    }}
                    tabIndex={column.sortable ? 0 : undefined}
                    role={column.sortable ? "columnheader" : undefined}
                    aria-sort={
                      sortColumn === column.key
                        ? sortDirection === 'asc' ? 'ascending' : 'descending'
                        : undefined
                    }
                    scope="col"
                  >
                    <div className="flex items-center gap-2">
                      {column.title}
                      {column.sortable && sortColumn === column.key && (
                        <span className="text-xs" aria-hidden="true">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </TableHead>
                ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={visibleColumns.length}>
                  <LoadingSkeleton />
                </TableCell>
              </TableRow>
            ) : paginatedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleColumns.length}>
                  <EmptyState />
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((row, index) => (
                <TableRow 
                  key={getRowKey ? getRowKey(row) : index}
                  className={cn(
                    onRowClick && "cursor-pointer hover:bg-muted/50"
                  )}
                  onClick={() => onRowClick?.(row)}
                  onKeyDown={onRowClick ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onRowClick(row);
                    }
                  } : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  role={onRowClick ? "button" : undefined}
                >
                  {columns
                    .filter(col => visibleColumns.includes(col.key))
                    .map((column) => (
                      <TableCell key={column.key}>
                        {column.render 
                          ? column.render(row[column.key], row)
                          : String(row[column.key] || '')
                        }
                      </TableCell>
                    ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {!loading && sortedData.length > 0 && paginate && (
        <nav
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          aria-label="Table pagination"
        >
          <div className="text-sm text-muted-foreground" aria-live="polite">
            Showing {(currentPage - 1) * rowsPerPage + 1} to{' '}
            {Math.min(currentPage * rowsPerPage, sortedData.length)} of {sortedData.length} results
          </div>

          <div className="flex flex-wrap items-center gap-3 justify-end">
            {rowSizeOptions && rowSizeOptions.length > 0 ? (
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                  Rows per page
                </span>
                <Select
                  value={String(rowsPerPage)}
                  onValueChange={(v) => {
                    const n = Number(v);
                    if (!Number.isFinite(n)) return;
                    setRowsPerPage(n);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 w-[72px]" aria-label="Rows per page">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {rowSizeOptions.map((opt) => (
                      <SelectItem key={opt} value={String(opt)}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {totalPages > 1 ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>

                <div className="flex items-center gap-1">
                  {getPaginationButtonPages(currentPage, totalPages, 7).map((pageNum) => (
                    <Button
                      key={pageNum}
                      variant={pageNum === currentPage ? 'default' : 'outline'}
                      size="sm"
                      className="min-w-9 px-2"
                      onClick={() => setCurrentPage(pageNum)}
                      aria-label={`Go to page ${pageNum}`}
                      aria-current={pageNum === currentPage ? 'page' : undefined}
                    >
                      {pageNum}
                    </Button>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  aria-label="Next page"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
          </div>
        </nav>
      )}
    </div>
  );
}