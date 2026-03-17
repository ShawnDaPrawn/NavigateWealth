import React, { useState } from 'react';
import { Archive, Filter, Plus, Search } from 'lucide-react';
import { useRequests } from '../../hooks/useRequests';
import { RequestStatus, Request } from '../../types';
import { RequestCard } from './RequestCard';
import { Button } from '../../../../../ui/button';
import { Input } from '../../../../../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../../ui/select';

interface RequestBoardViewProps {
  onCreateRequest: () => void;
  onViewRequest: (request: Request) => void;
}

export function RequestBoardView({ onCreateRequest, onViewRequest }: RequestBoardViewProps) {
  const { requests, loading, error, updateRequest, refetch } = useRequests();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTemplate, setFilterTemplate] = useState<string>('all');

  // Ensure requests is always an array (defensive programming)
  const requestsArray = Array.isArray(requests) ? requests : [];

  // Archive a completed request
  const handleArchive = async (request: Request) => {
    if (!confirm(`Are you sure you want to archive request "${request.id}"?`)) return;
    
    const result = await updateRequest(request.id, { status: RequestStatus.CANCELLED });
    if (result.success) {
      refetch();
    } else {
      alert(`Failed to archive request: ${result.error}`);
    }
  };

  // Move request to different status
  const handleMoveRequest = async (request: Request, newStatus: RequestStatus) => {
    const result = await updateRequest(request.id, { status: newStatus });
    if (result.success) {
      refetch();
    } else {
      alert(`Failed to move request: ${result.error}`);
    }
  };

  // Filter requests by search and template
  const filteredRequests = requestsArray.filter(request => {
    // Exclude archived/cancelled requests from main board
    if (request.status === RequestStatus.CANCELLED) return false;
    
    // Search filter
    const matchesSearch = !searchQuery || 
      request.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.clientName?.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Template filter
    const matchesTemplate = filterTemplate === 'all' || request.templateId === filterTemplate;
    
    return matchesSearch && matchesTemplate;
  });

  // Group requests by status
  const newRequests = filteredRequests.filter(r => r.status === RequestStatus.NEW);
  const pendingRequests = filteredRequests.filter(r => 
    r.status === RequestStatus.IN_COMPLIANCE_REVIEW || 
    r.status === RequestStatus.IN_LIFECYCLE ||
    r.status === RequestStatus.IN_SIGN_OFF ||
    r.status === RequestStatus.ON_HOLD
  );
  const completedRequests = filteredRequests.filter(r => r.status === RequestStatus.COMPLETED);

  // Get unique templates for filter
  const uniqueTemplates = Array.from(new Set(requestsArray.map(r => r.templateId)));

  if (error) {
    return (
      <div className="p-4 text-red-500 bg-red-50 rounded-lg">
        Error loading requests: {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with filters */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by request ID or client name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Select value={filterTemplate} onValueChange={setFilterTemplate}>
            <SelectTrigger className="w-[200px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by template" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Templates</SelectItem>
              {uniqueTemplates.map((templateId) => (
                <SelectItem key={templateId} value={templateId}>
                  {templateId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Board columns */}
      <div className="grid grid-cols-3 gap-4">
        {/* New Column */}
        <div className="flex flex-col bg-slate-50 rounded-lg border border-slate-200">
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-slate-900">New</h3>
              <span className="text-sm text-slate-500 bg-white px-2 py-1 rounded">
                {newRequests.length}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Intake / Pre-lifecycle</p>
          </div>
          
          <div className="p-3 space-y-3 flex-1 overflow-y-auto max-h-[calc(100vh-300px)]">
            {loading ? (
              <div className="text-center py-8 text-slate-500">Loading...</div>
            ) : newRequests.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">No new requests</div>
            ) : (
              newRequests.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  onView={() => onViewRequest(request)}
                  onMove={(status) => handleMoveRequest(request, status)}
                  showMoveActions
                  availableStatuses={[RequestStatus.IN_COMPLIANCE_REVIEW, RequestStatus.CANCELLED]}
                />
              ))
            )}
          </div>
        </div>

        {/* Pending Column */}
        <div className="flex flex-col bg-slate-50 rounded-lg border border-slate-200">
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-slate-900">Pending</h3>
              <span className="text-sm text-slate-500 bg-white px-2 py-1 rounded">
                {pendingRequests.length}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Active lifecycle</p>
          </div>
          
          <div className="p-3 space-y-3 flex-1 overflow-y-auto max-h-[calc(100vh-300px)]">
            {loading ? (
              <div className="text-center py-8 text-slate-500">Loading...</div>
            ) : pendingRequests.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">No pending requests</div>
            ) : (
              pendingRequests.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  onView={() => onViewRequest(request)}
                  onMove={(status) => handleMoveRequest(request, status)}
                  showMoveActions
                  availableStatuses={[RequestStatus.COMPLETED, RequestStatus.ON_HOLD, RequestStatus.CANCELLED]}
                />
              ))
            )}
          </div>
        </div>

        {/* Completed Column */}
        <div className="flex flex-col bg-slate-50 rounded-lg border border-slate-200">
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-slate-900">Completed</h3>
              <span className="text-sm text-slate-500 bg-white px-2 py-1 rounded">
                {completedRequests.length}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Finalised / Read-only</p>
          </div>
          
          <div className="p-3 space-y-3 flex-1 overflow-y-auto max-h-[calc(100vh-300px)]">
            {loading ? (
              <div className="text-center py-8 text-slate-500">Loading...</div>
            ) : completedRequests.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">No completed requests</div>
            ) : (
              completedRequests.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  onView={() => onViewRequest(request)}
                  onArchive={() => handleArchive(request)}
                  showArchiveAction
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}