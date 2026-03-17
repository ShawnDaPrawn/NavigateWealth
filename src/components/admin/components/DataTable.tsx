import React, { useState } from 'react';
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
  emptyState?: React.ReactNode;
  className?: string;
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
  emptyState,
  className
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    columns.map(col => col.key)
  );

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

  // Paginate data
  const totalPages = Math.ceil(sortedData.length / pageSize);
  const paginatedData = sortedData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

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
      {Array.from({ length: pageSize }).map((_, i) => (
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
                  key={index}
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
      {totalPages > 1 && (
        <nav className="flex items-center justify-between" aria-label="Table pagination">
          <div className="text-sm text-muted-foreground" aria-live="polite">
            Showing {((currentPage - 1) * pageSize) + 1} to{' '}
            {Math.min(currentPage * pageSize, sortedData.length)} of{' '}
            {sortedData.length} results
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const page = i + 1;
                return (
                  <Button
                    key={page}
                    variant={page === currentPage ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    aria-label={`Go to page ${page}`}
                    aria-current={page === currentPage ? "page" : undefined}
                  >
                    {page}
                  </Button>
                );
              })}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              aria-label="Next page"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}