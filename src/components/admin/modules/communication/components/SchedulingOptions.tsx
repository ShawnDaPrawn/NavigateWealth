import { Calendar as CalendarIcon, Clock, Repeat } from 'lucide-react';
import { Tabs } from '../../../../ui/tabs';
import { Switch } from '../../../../ui/switch';
import { SegmentedList, SegmentedTrigger } from '../../../layout/page';
import { Label } from '../../../../ui/label';
import { Input } from '../../../../ui/input';
import { NumberInputField } from '../../../../ui/number-input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../../../../ui/select';
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
      <Tabs
        value={config.type}
        onValueChange={(val) => handleTypeChange(val as 'immediate' | 'scheduled')}
      >
        <SegmentedList aria-label="When to send">
          <SegmentedTrigger value="immediate">Send now</SegmentedTrigger>
          <SegmentedTrigger value="scheduled">Schedule</SegmentedTrigger>
        </SegmentedList>
      </Tabs>

      {config.type === 'scheduled' && (
        <Card className="animate-in fade-in zoom-in-95 duration-200 border-primary/20 bg-primary/5">
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={'outline'}
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !config.startDate && 'text-muted-foreground',
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {config.startDate ? (
                        config.startDate.toDateString()
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={config.startDate}
                      onSelect={(date) => updateScheduled({ startDate: date })}
                      initialFocus
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
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
                <Switch
                  id="recurring"
                  checked={config.isRecurring || false}
                  onCheckedChange={(checked) => updateScheduled({ isRecurring: checked })}
                />
                <Label
                  htmlFor="recurring"
                  className="flex items-center gap-2 font-medium cursor-pointer"
                >
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
                        onValueChange={(val: string) =>
                          updateScheduled({
                            recurringFrequency: val as typeof config.recurringFrequency,
                          })
                        }
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
                      <Label>End condition</Label>
                      <Select
                        value={config.endCondition || 'never'}
                        onValueChange={(val: string) =>
                          updateScheduled({ endCondition: val as typeof config.endCondition })
                        }
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
                      <NumberInputField
                        value={config.endOccurrences || ''}
                        onValueChange={(v) => updateScheduled({ endOccurrences: v })}
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
