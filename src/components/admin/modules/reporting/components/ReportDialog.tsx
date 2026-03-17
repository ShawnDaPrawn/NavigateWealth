import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Play, Calendar, X } from 'lucide-react';
import { Report } from '../types';

/**
 * Pre-set date range quick-select options.
 * Value is the number of days to subtract from today for startDate.
 */
const DATE_PRESETS: Array<{ label: string; days: number }> = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'Last 12 months', days: 365 },
];

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: Report | null;
  onRun: (report: Report) => void;
}

export function ReportDialog({ open, onOpenChange, report, onRun }: ReportDialogProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Reset dates when dialog opens with a new report
  useEffect(() => {
    if (open) {
      setStartDate('');
      setEndDate('');
    }
  }, [open, report?.id]);

  if (!report) return null;

  /**
   * Apply a quick-select preset: sets startDate to N days ago and endDate to today.
   */
  const applyPreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  /**
   * Clear date range filters.
   */
  const clearDates = () => {
    setStartDate('');
    setEndDate('');
  };

  /**
   * Build a report object with the selected date range merged into parameters
   * and trigger execution.
   */
  const handleRun = () => {
    const params: Record<string, unknown> = { ...report.parameters };
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    const updatedReport: Report = {
      ...report,
      parameters: params,
    };

    onRun(updatedReport);
    onOpenChange(false);
  };

  const hasDateFilter = startDate !== '' || endDate !== '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{report.name}</DialogTitle>
          <DialogDescription>
            {report.description}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-5">
          {/* Export Format */}
          <div>
            <Label>Export Format</Label>
            <Select defaultValue="xlsx" disabled>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="xlsx">Excel (XLSX)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Currently only Excel format is supported.
            </p>
          </div>

          {/* Date Range Filter */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                Date Range (optional)
              </Label>
              {hasDateFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={clearDates}
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1.5">
              {DATE_PRESETS.map((preset) => (
                <Button
                  key={preset.days}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => applyPreset(preset.days)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>

            {/* Custom Date Range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">From</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)}
                  max={endDate || undefined}
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)}
                  min={startDate || undefined}
                  className="text-sm"
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {hasDateFilter
                ? 'Only records within this date range will be included.'
                : 'Leave empty to export all records regardless of date.'}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleRun}>
            <Play className="mr-2 h-4 w-4" />
            Run Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
