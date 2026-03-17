import React from 'react';
import { Calendar as CalendarIcon, Clock, Repeat } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '../../../../ui/radio-group';
import { Label } from '../../../../ui/label';
import { Input } from '../../../../ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../../../ui/select';
import { Calendar } from '../../../../ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../../../../ui/popover';
import { Button } from '../../../../ui/button';
import { Card, CardContent } from '../../../../ui/card';
import { SchedulingConfig } from '../types';
import { cn } from '../../../../ui/utils';

interface SchedulingOptionsProps {
  config: SchedulingConfig;
  onChange: (config: SchedulingConfig) => void;
}

export function SchedulingOptions({ config, onChange }: SchedulingOptionsProps) {
  const handleTypeChange = (type: 'immediate' | 'scheduled') => {
    onChange({ ...config, type });
  };

  const updateScheduled = (updates: Partial<SchedulingConfig>) => {
    onChange({ ...config, type: 'scheduled', ...updates });
  };

  return (
    <div className="space-y-6">
      <RadioGroup 
        value={config.type} 
        onValueChange={(val) => handleTypeChange(val as 'immediate' | 'scheduled')}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
      >
        <div>
          <RadioGroupItem value="immediate" id="immediate" className="peer sr-only" />
          <Label
            htmlFor="immediate"
            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer h-full"
          >
            <SendIcon className="mb-3 h-6 w-6" />
            <div className="text-center">
              <div className="font-semibold">Send Now</div>
              <div className="text-xs text-muted-foreground mt-1">Dispatch immediately</div>
            </div>
          </Label>
        </div>

        <div>
          <RadioGroupItem value="scheduled" id="scheduled" className="peer sr-only" />
          <Label
            htmlFor="scheduled"
            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer h-full"
          >
            <CalendarIcon className="mb-3 h-6 w-6" />
            <div className="text-center">
              <div className="font-semibold">Schedule Send</div>
              <div className="text-xs text-muted-foreground mt-1">Pick a date & time</div>
            </div>
          </Label>
        </div>
      </RadioGroup>

      {config.type === 'scheduled' && (
        <Card className="animate-in fade-in zoom-in-95 duration-200 border-primary/20 bg-primary/5">
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !config.startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {config.startDate ? config.startDate.toDateString() : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={config.startDate}
                      onSelect={(date) => updateScheduled({ startDate: date })}
                      initialFocus
                      disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="space-y-2">
                <Label>Time</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    type="time" 
                    className="pl-9"
                    value={config.time || ''}
                    onChange={(e) => updateScheduled({ time: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Recurring Options */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center space-x-2">
                <input 
                  type="checkbox" 
                  id="recurring" 
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  checked={config.isRecurring || false}
                  onChange={(e) => updateScheduled({ isRecurring: e.target.checked })}
                />
                <Label htmlFor="recurring" className="flex items-center gap-2 font-medium cursor-pointer">
                  <Repeat className="h-4 w-4" /> Repeat this email
                </Label>
              </div>

              {config.isRecurring && (
                <div className="pl-6 space-y-4 pt-2 animate-in slide-in-from-top-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Frequency</Label>
                      <Select 
                        value={config.recurringFrequency || 'monthly'} 
                        onValueChange={(val: string) => updateScheduled({ recurringFrequency: val })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                          <SelectItem value="annually">Annually</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>End Condition</Label>
                      <Select 
                        value={config.endCondition || 'never'}
                        onValueChange={(val: string) => updateScheduled({ endCondition: val })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="never">Never end</SelectItem>
                          <SelectItem value="after_occurrences">After X times</SelectItem>
                          <SelectItem value="on_date">On specific date</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {config.endCondition === 'after_occurrences' && (
                    <div className="space-y-2">
                      <Label>Number of occurrences</Label>
                      <Input 
                        type="number" 
                        min={1}
                        value={config.endOccurrences || ''}
                        onChange={(e) => updateScheduled({ endOccurrences: parseInt(e.target.value) })}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SendIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}