import React, { useMemo } from 'react';
import { Button } from '../../../../../ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../../ui/select';
import { 
  ChevronLeft, 
  ChevronRight, 
} from 'lucide-react';
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
  getMonth
} from 'date-fns';
import { CalendarView } from '../../types';

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
  onToday
}: CalendarHeaderProps) {

  const handlePrevious = () => {
    switch (view) {
      case 'day': onDateChange(subDays(currentDate, 1)); break;
      case 'week': onDateChange(subWeeks(currentDate, 1)); break;
      case 'month': onDateChange(subMonths(currentDate, 1)); break;
      default: onDateChange(subDays(currentDate, 1)); // Agenda fallback
    }
  };

  const handleNext = () => {
    switch (view) {
      case 'day': onDateChange(addDays(currentDate, 1)); break;
      case 'week': onDateChange(addWeeks(currentDate, 1)); break;
      case 'month': onDateChange(addMonths(currentDate, 1)); break;
      default: onDateChange(addDays(currentDate, 1));
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
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
      
      {/* Left: Navigation & Date Picking */}
      <div className="flex flex-wrap items-center gap-3">
         <div className="flex items-center rounded-lg border bg-gray-50/50 p-0.5 shadow-sm">
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white rounded-md" onClick={handlePrevious}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="w-px h-4 bg-gray-200 mx-1"></div>
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white rounded-md" onClick={handleNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
         </div>
         
         <Button variant="outline" size="sm" onClick={onToday} className="h-9">Today</Button>
         
         {/* Month & Year Selectors */}
         <div className="flex items-center gap-2 ml-1">
            <Select 
              value={getMonth(currentDate).toString()} 
              onValueChange={handleMonthChange}
            >
              <SelectTrigger className="h-8 w-[130px] font-medium text-sm bg-white border border-gray-200 hover:bg-gray-50 focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((month, index) => (
                  <SelectItem key={month} value={index.toString()}>{month}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select 
              value={getYear(currentDate).toString()} 
              onValueChange={handleYearChange}
            >
              <SelectTrigger className="h-8 w-[90px] font-medium text-sm bg-white border border-gray-200 hover:bg-gray-50 focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(year => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
         </div>
      </div>
    </div>
  );
}
