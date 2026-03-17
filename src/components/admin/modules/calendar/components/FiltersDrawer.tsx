import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../../../ui/dialog';
import { Button } from '../../../../ui/button';
import { Label } from '../../../../ui/label';
import { Input } from '../../../../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import { Checkbox } from '../../../../ui/checkbox';
import type { CalendarFilters, EventType, EventStatus } from '../types';
import { EVENT_TYPE_LABELS } from '../constants';
import { useClients } from '../../../../../hooks/useClients';

interface FiltersDrawerProps {
  open: boolean;
  onClose: () => void;
  filters: Partial<CalendarFilters>;
  onApplyFilters: (filters: Partial<CalendarFilters>) => void;
}

export function FiltersDrawer({
  open,
  onClose,
  filters,
  onApplyFilters,
}: FiltersDrawerProps) {
  const { data: clients = [] } = useClients();

  const [localFilters, setLocalFilters] = useState<Partial<CalendarFilters>>(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters, open]);

  const handleApply = () => {
    onApplyFilters(localFilters);
    onClose();
  };

  const handleReset = () => {
    const emptyFilters: Partial<CalendarFilters> = {
      search: '',
      dateRange: { start: null, end: null },
      eventTypes: [],
      eventStatuses: [],
      clientId: null,
    };
    setLocalFilters(emptyFilters);
    onApplyFilters(emptyFilters);
  };

  const toggleEventType = (type: EventType) => {
    setLocalFilters(prev => {
      const types = prev.eventTypes || [];
      if (types.includes(type)) {
        return { ...prev, eventTypes: types.filter(t => t !== type) };
      } else {
        return { ...prev, eventTypes: [...types, type] };
      }
    });
  };

  const toggleEventStatus = (status: EventStatus) => {
    setLocalFilters(prev => {
      const statuses = prev.eventStatuses || [];
      if (statuses.includes(status)) {
        return { ...prev, eventStatuses: statuses.filter(s => s !== status) };
      } else {
        return { ...prev, eventStatuses: [...statuses, status] };
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Filters</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-6">
          {/* Date Range */}
          <div>
            <Label className="text-base font-medium mb-3 block">Date Range</Label>
            <div className="space-y-3">
              <div>
                <Label htmlFor="start_date" className="text-sm">From</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={localFilters.dateRange?.start || ''}
                  onChange={(e) => setLocalFilters(prev => ({
                    ...prev,
                    dateRange: { ...prev.dateRange, start: e.target.value || null, end: prev.dateRange?.end || null }
                  }))}
                />
              </div>
              <div>
                <Label htmlFor="end_date" className="text-sm">To</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={localFilters.dateRange?.end || ''}
                  onChange={(e) => setLocalFilters(prev => ({
                    ...prev,
                    dateRange: { start: prev.dateRange?.start || null, ...prev.dateRange, end: e.target.value || null }
                  }))}
                />
              </div>
            </div>
          </div>

          {/* Event Types */}
          <div>
            <Label className="text-base font-medium mb-3 block">Event Types</Label>
            <div className="space-y-2">
              {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
                <div key={value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`event-${value}`}
                    checked={localFilters.eventTypes?.includes(value as EventType)}
                    onCheckedChange={() => toggleEventType(value as EventType)}
                  />
                  <Label htmlFor={`event-${value}`} className="font-normal cursor-pointer">
                    {label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Event Status */}
          <div>
            <Label className="text-base font-medium mb-3 block">Event Status</Label>
            <div className="space-y-2">
              {(['scheduled', 'completed', 'cancelled'] as EventStatus[]).map((status) => (
                <div key={status} className="flex items-center space-x-2">
                  <Checkbox
                    id={`event-status-${status}`}
                    checked={localFilters.eventStatuses?.includes(status)}
                    onCheckedChange={() => toggleEventStatus(status)}
                  />
                  <Label htmlFor={`event-status-${status}`} className="font-normal cursor-pointer">
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Client Filter */}
          <div>
            <Label htmlFor="client_filter" className="text-base font-medium mb-3 block">Client</Label>
            <Select
              value={localFilters.clientId || 'all'}
              onValueChange={(value) => setLocalFilters(prev => ({ ...prev, clientId: value === 'all' ? null : value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="All clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clients</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleReset} className="flex-1">
            Reset
          </Button>
          <Button onClick={handleApply} className="flex-1">
            Apply Filters
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
