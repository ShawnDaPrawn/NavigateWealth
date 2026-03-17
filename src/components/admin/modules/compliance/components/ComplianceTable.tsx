import React, { useState } from 'react';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Badge } from '../../../../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../ui/table';
import { 
  Search, 
  Filter, 
  Download, 
  Plus, 
  Edit, 
  Paperclip, 
  Eye,
  MoreHorizontal,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../../../../ui/dropdown-menu';

import { ComplianceRecord, ComplianceColumn, ComplianceFilter, RAGStatus } from '../types';

interface ComplianceTableProps {
  title: string;
  description?: string;
  records: ComplianceRecord[];
  columns: ComplianceColumn[];
  onAdd?: () => void;
  onEdit?: (record: ComplianceRecord) => void;
  onExport?: () => void;
  filters?: ComplianceFilter[];
  loading?: boolean;
}

export function ComplianceTable({ 
  title, 
  description, 
  records, 
  columns, 
  onAdd, 
  onEdit, 
  onExport,
  filters = [],
  loading = false
}: ComplianceTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string>>({});
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Filter and search records
  const filteredRecords = records.filter(record => {
    // Search filter
    const matchesSearch = searchTerm === '' || 
      record.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.owner.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (record.notes && record.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
      record.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));

    // Additional filters
    const matchesFilters = Object.entries(selectedFilters).every(([key, value]) => {
      if (!value) return true;
      // Dynamic property access on compliance records
      return (record as Record<string, unknown>)[key] === value;
    });

    return matchesSearch && matchesFilters;
  });

  // Sort records
  const sortedRecords = [...filteredRecords].sort((a, b) => {
    if (!sortColumn) return 0;
    
    const aValue = (a as Record<string, unknown>)[sortColumn];
    const bValue = (b as Record<string, unknown>)[sortColumn];
    
    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const getRAGBadge = (status: RAGStatus) => {
    switch (status) {
      case 'green':
        return <Badge variant="default" className="bg-green-100 text-green-700 border-green-200 hover:bg-green-200">Green</Badge>;
      case 'amber':
        return <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200">Amber</Badge>;
      case 'red':
        return <Badge variant="destructive">Red</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'current':
        return <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />Current</Badge>;
      case 'due-soon':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Due Soon</Badge>;
      case 'overdue':
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Overdue</Badge>;
      case 'pending':
        return <Badge variant="outline"><Calendar className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'complete':
        return <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />Complete</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-ZA', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const renderCellValue = (column: ComplianceColumn, record: ComplianceRecord) => {
    // Dynamic property access on compliance records
    const value = (record as Record<string, unknown>)[column.key];
    
    if (column.render) {
      return column.render(value, record);
    }

    switch (column.type) {
      case 'date':
        return value instanceof Date ? formatDate(value) : (value ? String(value) : '—');
      case 'badge':
        if (column.key === 'status') return getStatusBadge(String(value));
        if (column.key === 'ragStatus') return getRAGBadge(value as RAGStatus);
        return <Badge variant="outline">{String(value)}</Badge>;
      case 'number':
        return typeof value === 'number' ? value.toLocaleString() : '0';
      case 'currency':
        return typeof value === 'number' ? `R${value.toLocaleString()}` : '—';
      default:
        return value ? String(value) : '—';
    }
  };

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  if (loading) {
    return (
      <Card className="max-w-full overflow-hidden w-full">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="h-8 w-1/3 bg-muted animate-pulse rounded"></div>
            <div className="h-8 w-24 bg-muted animate-pulse rounded"></div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-10 w-full bg-muted animate-pulse rounded"></div>
          <div className="space-y-2">
            <div className="h-12 w-full bg-muted animate-pulse rounded"></div>
            <div className="h-12 w-full bg-muted animate-pulse rounded"></div>
            <div className="h-12 w-full bg-muted animate-pulse rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-full overflow-hidden w-full">
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate">{title}</CardTitle>
            {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {onExport && (
              <Button variant="outline" size="sm" onClick={onExport} className="whitespace-nowrap">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            )}
            {onAdd && (
              <Button size="sm" onClick={onAdd} className="whitespace-nowrap">
                <Plus className="h-4 w-4 mr-2" />
                Add Record
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 max-w-full overflow-hidden">
        {/* Filters and Search */}
        <div className="flex flex-col gap-4 max-w-full overflow-hidden">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 min-w-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search records..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2 sm:flex-nowrap">
              {filters.map((filter) => (
                <Select
                  key={filter.key}
                  value={selectedFilters[filter.key] || 'all'}
                  onValueChange={(value) => setSelectedFilters(prev => ({
                    ...prev,
                    [filter.key]: value === 'all' ? '' : value
                  }))}
                >
                  <SelectTrigger className="w-[180px] min-w-[180px]">
                    <SelectValue placeholder={filter.label} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All {filter.label}</SelectItem>
                    {filter.options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ))}

              <Button variant="outline" size="sm" className="whitespace-nowrap">
                <Filter className="h-4 w-4 mr-2" />
                More Filters
              </Button>
            </div>
          </div>
        </div>

        {/* Results Summary */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {sortedRecords.length} of {records.length} records
          </span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              Red: {records.filter(r => r.ragStatus === 'red').length}
            </span>
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              Amber: {records.filter(r => r.ragStatus === 'amber').length}
            </span>
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              Green: {records.filter(r => r.ragStatus === 'green').length}
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px] sticky left-0 bg-background z-10 border-r min-w-[80px]">RAG</TableHead>
                  {columns.map((column) => (
                    <TableHead 
                      key={column.key}
                      className="cursor-pointer hover:bg-muted/50 min-w-[140px] whitespace-nowrap px-4"
                      onClick={() => handleSort(column.key)}
                    >
                      <div className="flex items-center gap-1">
                        {column.label}
                        {sortColumn === column.key && (
                          <span className="text-xs">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </TableHead>
                  ))}
                  <TableHead className="text-center min-w-[120px] whitespace-nowrap">Attachments</TableHead>
                  <TableHead className="w-[80px] sticky right-0 bg-background z-10 border-l min-w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRecords.map((record) => (
                  <TableRow key={record.id} className="hover:bg-muted/50">
                    <TableCell className="sticky left-0 bg-background z-10 border-r min-w-[80px]">
                      {getRAGBadge(record.ragStatus)}
                    </TableCell>
                    {columns.map((column) => (
                      <TableCell key={column.key} className="whitespace-nowrap min-w-[140px] px-4">
                        {renderCellValue(column, record)}
                      </TableCell>
                    ))}
                    <TableCell className="text-center whitespace-nowrap min-w-[120px]">
                      {record.attachments > 0 && (
                        <Button variant="ghost" size="sm">
                          <Paperclip className="h-4 w-4" />
                          <span className="ml-1">{record.attachments}</span>
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="sticky right-0 bg-background z-10 border-l min-w-[80px]">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => console.log('View', record.id)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          {onEdit && (
                            <DropdownMenuItem onClick={() => onEdit(record)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Record
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => console.log('Download attachments', record.id)}>
                            <Download className="h-4 w-4 mr-2" />
                            Download Files
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => console.log('Audit trail', record.id)}>
                            View Audit Trail
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {sortedRecords.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto opacity-50 mb-4" />
            <p>No records found matching your criteria</p>
            {onAdd && (
              <Button className="mt-4" onClick={onAdd}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Record
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}