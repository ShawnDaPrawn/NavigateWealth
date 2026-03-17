import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import { Button } from '../../../../ui/button';
import { Label } from '../../../../ui/label';
import { Input } from '../../../../ui/input';
import { RadioGroup, RadioGroupItem } from '../../../../ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import { FileText, Download } from 'lucide-react';
import { format, isSameDay, isSameMonth, isSameYear } from 'date-fns';
import { toast } from 'sonner@2.0.3';
import type { CalendarEvent } from '../types';
import { BasePdfLayout, BASE_PDF_CSS } from '../../resources/templates/BasePdfLayout';

interface CalendarPDFExportModalProps {
  open: boolean;
  onClose: () => void;
  events: CalendarEvent[];
}

type ExportScope = 'day' | 'month' | 'year';

export function CalendarPDFExportModal({
  open,
  onClose,
  events,
}: CalendarPDFExportModalProps) {
  const [scope, setScope] = useState<ExportScope>('day');
  
  // Date state
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedMonth, setSelectedMonth] = useState<string>(String(new Date().getMonth()));
  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));

  const [isGenerating, setIsGenerating] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Filter events based on current selection
  // Construct the effective date based on scope
  let date: Date;
  
  if (scope === 'day') {
    // For day scope, use the specific selected date
    const [sYear, sMonth, sDay] = selectedDate.split('-').map(Number);
    date = new Date(sYear, sMonth - 1, sDay);
  } else if (scope === 'month') {
    // For month scope, construct 1st of selected Month/Year
    date = new Date(Number(selectedYear), Number(selectedMonth), 1);
  } else {
    // For year scope, construct 1st Jan of selected Year
    date = new Date(Number(selectedYear), 0, 1);
  }

  let filteredEvents: CalendarEvent[] = [];
  let docTitle = '';
  let period = '';

  if (scope === 'day') {
    filteredEvents = events.filter(e => isSameDay(new Date(e.start_at), date));
    docTitle = 'Daily Schedule';
    period = format(date, 'EEEE, MMMM d, yyyy');
  } else if (scope === 'month') {
    filteredEvents = events.filter(e => isSameMonth(new Date(e.start_at), date));
    docTitle = 'Monthly Schedule';
    period = format(date, 'MMMM yyyy');
  } else if (scope === 'year') {
    filteredEvents = events.filter(e => isSameYear(new Date(e.start_at), date));
    docTitle = 'Annual Schedule';
    period = format(date, 'yyyy');
  }

  // Generate Year Options (Current Year + Previous 5 Years)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

  // Month Options
  const monthOptions = [
    { value: '0', label: 'January' },
    { value: '1', label: 'February' },
    { value: '2', label: 'March' },
    { value: '3', label: 'April' },
    { value: '4', label: 'May' },
    { value: '5', label: 'June' },
    { value: '6', label: 'July' },
    { value: '7', label: 'August' },
    { value: '8', label: 'September' },
    { value: '9', label: 'October' },
    { value: '10', label: 'November' },
    { value: '11', label: 'December' },
  ];

  // Sort by date
  filteredEvents.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

  // Group events by day for month/year views
  const eventsByDay: Record<string, CalendarEvent[]> = {};
  if (scope !== 'day') {
    filteredEvents.forEach(event => {
      const dayKey = format(new Date(event.start_at), 'yyyy-MM-dd');
      if (!eventsByDay[dayKey]) {
        eventsByDay[dayKey] = [];
      }
      eventsByDay[dayKey].push(event);
    });
  }
  
  const sortedDays = Object.keys(eventsByDay).sort();

  const handleExport = () => {
    setIsGenerating(true);
    
    // 1. Create iframe
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    
    const doc = iframe.contentWindow?.document;
    if (!doc || !printRef.current) {
      setIsGenerating(false);
      return;
    }

    // 2. Clone the content
    const content = printRef.current.innerHTML;

    // 3. Write to iframe
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Calendar Export - ${period}</title>
          <style>
            ${BASE_PDF_CSS}
            
            /* Print Overrides */
            @media print {
              @page {
                size: A4;
                margin: 0 !important; 
              }
              
              html, body {
                width: 210mm;
                height: 297mm;
                margin: 0 !important;
                padding: 0 !important;
                background: white;
              }

              .pdf-viewport {
                display: block !important;
                background: none !important;
                padding: 0 !important;
                height: auto !important;
                min-height: 0 !important;
              }

              .pdf-page {
                margin: 0 !important;
                border: none !important;
                box-shadow: none !important;
                width: 210mm !important;
                min-height: 297mm !important;
                position: relative !important; 
                overflow: hidden !important;
                page-break-after: always;
              }
              
              .pdf-page:last-child {
                page-break-after: auto;
              }

              .pdf-content {
                padding: var(--margin-top) var(--margin-right) var(--margin-bottom-with-footer) var(--margin-left) !important;
              }

              .pdf-footer {
                position: absolute !important;
                bottom: var(--margin-bottom) !important;
                left: var(--margin-left) !important;
                right: var(--margin-right) !important;
                width: auto !important;
              }
              
              /* Ensure day sections don't split awkwardly if small enough */
              .day-section {
                page-break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          ${content}
        </body>
      </html>
    `);
    doc.close();

    // 4. Print
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(iframe);
        setIsGenerating(false);
        onClose();
      }, 1000);
    }, 500);
  };

  const renderEventTable = (events: CalendarEvent[], showDateInTime = false) => (
    <div className="w-full border border-gray-300 rounded-sm bg-white">
      <table className="w-full text-[9.5px] border-collapse table-fixed">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-200 px-2 py-1.5 text-left font-bold text-gray-700" style={{ width: '10%' }}>Time</th>
            <th className="border border-gray-200 px-2 py-1.5 text-left font-bold text-gray-700" style={{ width: '70%' }}>Event Details</th>
            <th className="border border-gray-200 px-2 py-1.5 text-left font-bold text-gray-700" style={{ width: '20%' }}>Type / Location</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => {
            const start = new Date(event.start_at);
            const end = new Date(event.end_at);
            return (
              <tr key={event.id}>
                <td className="border border-gray-200 px-2 py-1.5 align-top">
                  <div className="text-gray-900">
                    <span className="font-bold">Start:</span> {format(start, 'HH:mm')}
                  </div>
                  <div className="text-gray-500 text-[8.5px]">
                    <span className="font-medium">End:</span> {format(end, 'HH:mm')}
                  </div>
                  {showDateInTime && (
                    <div className="mt-1 text-[8.5px] text-purple-700 font-medium">
                      {format(start, 'MMM d')}
                    </div>
                  )}
                </td>
                <td className="border border-gray-200 px-2 py-1.5 align-top">
                  <div className="font-bold text-gray-900">{event.title}</div>
                  {event.description && (
                    <div className="text-gray-600 mt-1 whitespace-pre-wrap" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                      {event.description}
                    </div>
                  )}
                </td>
                <td className="border border-gray-200 px-2 py-1.5 align-top">
                  <div className="font-bold text-purple-700 uppercase text-[8.5px] tracking-wide">
                    {event.event_type}
                  </div>
                  {(event.location || event.location_type) && (
                    <div className="mt-1 text-gray-500" style={{ wordBreak: 'break-word' }}>
                      {event.location_type === 'video' ? 'Video Meeting' : (event.location || 'In Person')}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-600" />
            Export Schedule to PDF
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label>Export Scope</Label>
            <RadioGroup 
              value={scope} 
              onValueChange={(v) => setScope(v as ExportScope)}
              className="flex flex-col space-y-2"
            >
              <div 
                className={`flex items-center space-x-2 rounded-lg border p-3 cursor-pointer hover:bg-gray-50 transition-colors ${scope === 'day' ? 'border-purple-600 bg-purple-50' : 'border-gray-200'}`}
                onClick={() => setScope('day')}
              >
                <RadioGroupItem value="day" id="export-scope-day" />
                <Label htmlFor="export-scope-day" className="flex-1 cursor-pointer">Daily Schedule</Label>
              </div>
              <div 
                className={`flex items-center space-x-2 rounded-lg border p-3 cursor-pointer hover:bg-gray-50 transition-colors ${scope === 'month' ? 'border-purple-600 bg-purple-50' : 'border-gray-200'}`}
                onClick={() => setScope('month')}
              >
                <RadioGroupItem value="month" id="export-scope-month" />
                <Label htmlFor="export-scope-month" className="flex-1 cursor-pointer">Monthly Overview</Label>
              </div>
              <div 
                className={`flex items-center space-x-2 rounded-lg border p-3 cursor-pointer hover:bg-gray-50 transition-colors ${scope === 'year' ? 'border-purple-600 bg-purple-50' : 'border-gray-200'}`}
                onClick={() => setScope('year')}
              >
                <RadioGroupItem value="year" id="export-scope-year" />
                <Label htmlFor="export-scope-year" className="flex-1 cursor-pointer">Yearly Summary</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label>Select Period</Label>
            
            {scope === 'day' && (
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            )}

            {scope === 'month' && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger>
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent>
                      {monthOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger>
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {yearOptions.map((year) => (
                        <SelectItem key={year} value={String(year)}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {scope === 'year' && (
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <p className="text-xs text-muted-foreground mt-1">
              {scope === 'day' && 'Select the specific day to export.'}
              {scope === 'month' && 'Choose the month and year to export.'}
              {scope === 'year' && 'Choose the year to export (Current + Past 5 Years).'}
            </p>
          </div>
          
          <div className="flex justify-end pt-2">
             <Button variant="outline" onClick={() => {
                const now = new Date();
                setSelectedDate(format(now, 'yyyy-MM-dd'));
                setSelectedMonth(String(now.getMonth()));
                setSelectedYear(String(now.getFullYear()));
                setScope('day');
             }} className="mr-auto text-xs">
                Reset to Today
             </Button>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleExport} disabled={isGenerating} className="bg-purple-600 hover:bg-purple-700">
            {isGenerating ? (
              <span>Generating...</span>
            ) : (
              <div className="contents">
                <Download className="h-4 w-4 mr-2" />
                Print / Save PDF
              </div>
            )}
          </Button>
        </div>

        {/* Hidden Print View */}
        <div style={{ display: 'none' }}>
           <div ref={printRef}>
              <BasePdfLayout
                docTitle={docTitle}
                issueDate={format(new Date(), 'dd/MM/yyyy')}
              >
                {/* Custom Content for Calendar */}
                <div className="section">
                  <div className="section-head">
                    <span className="num mr-2 text-purple-700 font-bold">01</span>
                    <h2 className="uppercase font-bold text-gray-800 m-0">{period}</h2>
                  </div>
                  
                  {filteredEvents.length === 0 ? (
                    <div className="p-4 text-sm text-gray-500 italic border border-gray-200 rounded bg-gray-50">
                      No events scheduled for this period.
                    </div>
                  ) : (
                    <div className="mt-4">
                      {scope === 'day' ? (
                        renderEventTable(filteredEvents)
                      ) : (
                        sortedDays.map((dayKey) => {
                          const [y, m, d] = dayKey.split('-').map(Number);
                          const dayDate = new Date(y, m - 1, d);
                          
                          return (
                            <div key={dayKey} className="mb-8 day-section break-inside-avoid">
                              <h3 className="font-bold text-[12px] text-purple-800 border-b border-purple-100 pb-2 mb-3 uppercase tracking-wide">
                                {format(dayDate, 'EEEE, MMMM d, yyyy')}
                              </h3>
                              {renderEventTable(eventsByDay[dayKey])}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                  
                  {/* Summary / Stats Block */}
                  <div className="mt-6 border border-gray-200 rounded p-4 bg-gray-50">
                     <div className="font-bold text-[10px] mb-4 text-purple-800 uppercase tracking-wider border-b border-gray-200 pb-2">
                        Schedule Summary
                     </div>
                     <div className="flex gap-8 text-[9.5px]">
                        <div className="flex-1">
                           <div className="text-[8px] text-gray-500 uppercase tracking-wide mb-1">Total Events</div>
                           <div className="font-medium text-gray-900 border-b border-gray-300 pb-1">{filteredEvents.length}</div>
                        </div>
                        <div className="flex-1">
                           <div className="text-[8px] text-gray-500 uppercase tracking-wide mb-1">Date Range</div>
                           <div className="font-medium text-gray-900 border-b border-gray-300 pb-1">
                              {scope === 'day' ? format(date, 'dd MMM yyyy') : 
                               scope === 'month' ? `${format(startOfMonth(date), 'dd MMM')} - ${format(endOfMonth(date), 'dd MMM yyyy')}` :
                               `${format(startOfYear(date), 'dd MMM')} - ${format(endOfYear(date), 'dd MMM yyyy')}`
                              }
                           </div>
                        </div>
                        <div className="flex-1">
                           <div className="text-[8px] text-gray-500 uppercase tracking-wide mb-1">Generated On</div>
                           <div className="font-medium text-gray-900 border-b border-gray-300 pb-1">{format(new Date(), 'dd MMM yyyy HH:mm')}</div>
                        </div>
                     </div>
                  </div>
                </div>
              </BasePdfLayout>
           </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helpers needed if not imported
function startOfMonth(date: Date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
function endOfMonth(date: Date) { return new Date(date.getFullYear(), date.getMonth() + 1, 0); }
function startOfYear(date: Date) { return new Date(date.getFullYear(), 0, 1); }
function endOfYear(date: Date) { return new Date(date.getFullYear(), 11, 31); }