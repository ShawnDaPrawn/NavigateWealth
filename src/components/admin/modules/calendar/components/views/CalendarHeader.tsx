import { useMemo } from 'react';
import { Button } from '../../../../../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../../ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  addDays,
  subDays,
  setMonth,
  setYear,
  getYear,
  getMonth,
  format,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import { Tabs } from '../../../../../ui/tabs';
import { SegmentedList, SegmentedTrigger } from '../../../../layout/page';
import type { CalendarView } from '../../types';

interface CalendarHeaderProps {
  view: CalendarView;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onViewChange: (view: CalendarView) => void;
  onToday: () => void;
}

export function CalendarHeader({
  view,
  currentDate,
  onDateChange,
  onViewChange,
  onToday,
}: CalendarHeaderProps) {
  const handlePrevious = () => {
    switch (view) {
      case 'day':
        onDateChange(subDays(currentDate, 1));
        break;
      case 'week':
        onDateChange(subWeeks(currentDate, 1));
        break;
      case 'month':
        onDateChange(subMonths(currentDate, 1));
        break;
      default:
        onDateChange(subDays(currentDate, 1)); // Agenda fallback
    }
  };

  const handleNext = () => {
    switch (view) {
      case 'day':
        onDateChange(addDays(currentDate, 1));
        break;
      case 'week':
        onDateChange(addWeeks(currentDate, 1));
        break;
      case 'month':
        onDateChange(addMonths(currentDate, 1));
        break;
      default:
        onDateChange(addDays(currentDate, 1));
    }
  };

  const handleMonthChange = (value: string) => {
    const newDate = setMonth(currentDate, parseInt(value));
    onDateChange(newDate);
    // When changing month explicitly, it makes sense to see the whole month
    onViewChange('month');
  };

  const handleYearChange = (value: string) => {
    const newDate = setYear(currentDate, parseInt(value));
    onDateChange(newDate);
    onViewChange('month');
  };

  // Generate year options (current year +/- 5 years)
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const result = [];
    for (let i = currentYear - 5; i <= currentYear + 5; i++) {
      result.push(i);
    }
    return result;
  }, []);

  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  const unit = view === 'month' ? 'month' : view === 'week' ? 'week' : 'day';
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const label =
    view === 'week'
      ? `${format(weekStart, weekStart.getMonth() === weekEnd.getMonth() ? 'd' : 'd MMM')} – ${format(weekEnd, 'd MMMM yyyy')}`
      : view === 'day'
        ? format(currentDate, 'EEEE, d MMMM yyyy')
        : view === 'agenda'
          ? `From ${format(currentDate, 'd MMMM yyyy')}`
          : null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={onToday} className="h-8">
          Today
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handlePrevious}
          aria-label={`Previous ${unit}`}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </Button>
        {view === 'month' ? (
          <div className="flex items-center gap-1">
            <Select value={getMonth(currentDate).toString()} onValueChange={handleMonthChange}>
              <SelectTrigger
                aria-label="Month"
                className="h-8 w-[130px] border-0 bg-transparent text-base font-semibold text-nw-ink shadow-none hover:bg-gray-100 focus:ring-0"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((month, index) => (
                  <SelectItem key={month} value={index.toString()}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={getYear(currentDate).toString()} onValueChange={handleYearChange}>
              <SelectTrigger
                aria-label="Year"
                className="h-8 w-[88px] border-0 bg-transparent text-base font-semibold text-nw-ink shadow-none hover:bg-gray-100 focus:ring-0"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <h2 className="px-1 text-base font-semibold text-nw-ink" aria-live="polite">
            {label}
          </h2>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleNext}
          aria-label={`Next ${unit}`}
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <Tabs value={view} onValueChange={(v) => onViewChange(v as CalendarView)}>
        <SegmentedList aria-label="Calendar view">
          <SegmentedTrigger value="month">Month</SegmentedTrigger>
          <SegmentedTrigger value="week">Week</SegmentedTrigger>
          <SegmentedTrigger value="day">Day</SegmentedTrigger>
          <SegmentedTrigger value="agenda">Agenda</SegmentedTrigger>
        </SegmentedList>
      </Tabs>
    </div>
  );
}
