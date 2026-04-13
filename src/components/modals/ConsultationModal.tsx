/**
 * ConsultationModal — Schedule Consultation flow
 *
 * Multi-step wizard: Meeting Type → Date → Time → Details → Confirmation
 *
 * Improvements over previous version:
 *   - Labelled step indicators with visual progress
 *   - Animated transitions between steps
 *   - Inline validation with clear error states
 *   - Success state with animated confirmation
 *   - Better mobile responsiveness
 *   - Consistent Design System tokens
 *
 * §7   — No business logic in UI
 * §8.3 — Design System colours, spacing, typography
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Calendar } from '../ui/calendar';
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  Phone,
  Mail,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Video,
  PhoneCall,
  MessageSquare,
  Shield,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { format, startOfDay, addDays, isBefore } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { cn } from '../ui/utils';

// ── Helpers ───────────────────────────────────────────────────────────────────

const getCurrentSASTTime = () =>
  new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Johannesburg' }));

const isWeekend = (date: Date): boolean =>
  date.getDay() === 0 || date.getDay() === 6;

/**
 * Returns the earliest bookable date.
 *
 * Policy: bookings require at least one full business day for scheduling.
 * Today and the next business day are both disabled. The first available
 * date is the second business day from today.
 *
 * Examples (SAST):
 *   Monday    → Wednesday
 *   Thursday  → Monday   (Fri skipped, Sat/Sun are weekends)
 *   Friday    → Tuesday  (Mon is next biz day → skip, Sat/Sun weekends)
 */
const getMinBookingDate = (): Date => {
  const today = startOfDay(getCurrentSASTTime());
  let date = addDays(today, 1);

  // Advance past weekends to find the next business day
  while (isWeekend(date)) date = addDays(date, 1);

  // That's the next business day — skip it
  date = addDays(date, 1);

  // Advance past weekends again to land on the first available business day
  while (isWeekend(date)) date = addDays(date, 1);

  return date;
};

/** True if the calendar day cannot be booked (weekends or before earliest bookable date). */
const isBookingDateDisabled = (date: Date): boolean => {
  const d = startOfDay(date);
  const minDate = getMinBookingDate();
  return isBefore(d, minDate) || isWeekend(d);
};

/** Calendar day is strictly before “today” in SAST (for past styling). */
const isPastCalendarDay = (date: Date): boolean =>
  isBefore(startOfDay(date), startOfDay(getCurrentSASTTime()));

/**
 * Generates 30-minute time slots within business hours (08:00 – 16:30 SAST).
 *
 * Because the earliest bookable date is always at least two business days
 * out, there is no need to filter past slots for the current time.
 */
const generateTimeSlots = (): string[] => {
  const slots: string[] = [];
  for (let hour = 8; hour <= 16; hour++) {
    for (const minute of [0, 30]) {
      if (hour === 16 && minute > 0) break;
      slots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
    }
  }
  return slots;
};

function formatTimeLabel(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayH}:${m.toString().padStart(2, '0')} ${suffix}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 'meeting-type' | 'date' | 'time' | 'details' | 'confirm';

const STEPS: { id: Step; label: string }[] = [
  { id: 'meeting-type', label: 'Type' },
  { id: 'date', label: 'Date' },
  { id: 'time', label: 'Time' },
  { id: 'details', label: 'Details' },
  { id: 'confirm', label: 'Review' },
];

interface ConsultationModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ConsultationModal({
  isOpen,
  onClose,
  open,
  onOpenChange,
}: ConsultationModalProps) {
  const modalOpen = open !== undefined ? open : isOpen || false;

  const [currentStep, setCurrentStep] = useState<Step>('meeting-type');
  const [selectedMeetingType, setSelectedMeetingType] = useState<'virtual' | 'telephonic'>('virtual');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    additionalNotes: '',
  });

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);
  const availableTimeSlots = useMemo(
    () => (selectedDate ? generateTimeSlots() : []),
    [selectedDate]
  );

  const handleInputChange = (field: string, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) setCurrentStep(STEPS[nextIndex].id);
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) setCurrentStep(STEPS[prevIndex].id);
  };

  const canProceed = useCallback((): boolean => {
    switch (currentStep) {
      case 'meeting-type':
        return true;
      case 'date':
        return !!selectedDate;
      case 'time':
        return !!selectedTime;
      case 'details':
        return !!(formData.name.trim() && formData.email.trim() && formData.phone.trim());
      case 'confirm':
        return true;
      default:
        return false;
    }
  }, [currentStep, selectedDate, selectedTime, formData]);

  const resetForm = useCallback(() => {
    setCurrentStep('meeting-type');
    setSelectedMeetingType('virtual');
    setSelectedDate(undefined);
    setSelectedTime('');
    setIsSubmitting(false);
    setIsSuccess(false);
    setFormData({ name: '', email: '', phone: '', additionalNotes: '' });
  }, []);

  const handleDialogOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        resetForm();
      }
      if (onOpenChange) {
        onOpenChange(nextOpen);
      } else if (!nextOpen && onClose) {
        onClose();
      }
    },
    [resetForm, onOpenChange, onClose],
  );

  const handleSubmit = async () => {
    if (!selectedDate || !selectedTime) {
      toast.error('Please select a date and time');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/consultation/request`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            meetingType: selectedMeetingType,
            preferredDate1: format(selectedDate, 'yyyy-MM-dd'),
            preferredTime1: selectedTime,
            preferredDate2: '',
            preferredTime2: '',
            preferredDate3: '',
            preferredTime3: '',
            additionalNotes: formData.additionalNotes,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Consultation request error:', errorData);
        toast.error('Failed to book consultation. Please try again or contact us directly.');
        setIsSubmitting(false);
        return;
      }

      setIsSubmitting(false);
      setIsSuccess(true);
    } catch (error) {
      console.error('Error booking consultation:', error);
      toast.error('Failed to book consultation. Please try again or contact us directly at (+27) 12-667-2505.');
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    resetForm();
    if (onOpenChange) {
      onOpenChange(false);
    } else if (onClose) {
      onClose();
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Dialog open={modalOpen} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-[680px] max-w-none max-h-[100dvh] sm:max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 rounded-none sm:rounded-lg inset-0 sm:inset-auto sm:top-[50%] sm:left-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] translate-x-0 translate-y-0 border-0 sm:border">
        {/* ── Success State ── */}
        {isSuccess ? (
          <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-6"
            >
              <CheckCircle className="h-10 w-10 text-green-600" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Consultation Booked!</h3>
              <p className="text-sm text-gray-500 max-w-sm mb-2">
                We've received your request and sent a confirmation to{' '}
                <span className="font-medium text-gray-700">{formData.email}</span>.
              </p>
              <p className="text-sm text-gray-500 max-w-sm mb-8">
                Our bookings agent will contact you within 24 hours to finalize your appointment.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="bg-gray-50 rounded-xl p-5 w-full max-w-sm space-y-3 mb-8"
            >
              <div className="flex items-center gap-3 text-sm">
                {selectedMeetingType === 'virtual' ? (
                  <Video className="h-4 w-4 text-primary flex-shrink-0" />
                ) : (
                  <PhoneCall className="h-4 w-4 text-primary flex-shrink-0" />
                )}
                <span className="text-gray-700">
                  {selectedMeetingType === 'virtual' ? 'Virtual Meeting' : 'Telephonic Meeting'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <CalendarIcon className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="text-gray-700">
                  {selectedDate ? format(selectedDate, 'EEEE, d MMMM yyyy') : ''}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Clock className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="text-gray-700">{formatTimeLabel(selectedTime)} (SAST)</span>
              </div>
            </motion.div>

            <Button onClick={handleClose} className="bg-primary text-white hover:bg-primary/90 px-8">
              Done
            </Button>
          </div>
        ) : (
          <>
            {/* ── Header ── */}
            <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-gray-100">
              <DialogHeader className="space-y-1 mb-4 sm:mb-5">
                <DialogTitle className="text-lg sm:text-xl font-bold text-gray-900 text-center">
                  Schedule Your Free Consultation
                </DialogTitle>
                <DialogDescription className="text-center text-sm text-gray-500">
                  Book a complimentary session with a qualified financial adviser
                </DialogDescription>
              </DialogHeader>

              {/* Step Indicators */}
              <div className="flex items-center justify-between gap-1">
                {STEPS.map((step, idx) => {
                  const isActive = idx === currentStepIndex;
                  const isComplete = idx < currentStepIndex;
                  return (
                    <div key={step.id} className="flex-1 flex flex-col items-center gap-1.5">
                      <div
                        className={`
                          w-full h-1 rounded-full transition-colors duration-300
                          ${isComplete ? 'bg-primary' : isActive ? 'bg-primary' : 'bg-gray-200'}
                        `}
                      />
                      <span
                        className={`text-[10px] font-medium tracking-wide uppercase transition-colors duration-300 ${
                          isActive ? 'text-primary' : isComplete ? 'text-primary/60' : 'text-gray-400'
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Body ── */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 min-h-0 sm:min-h-[360px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* ── Step 1: Meeting Type ── */}
                  {currentStep === 'meeting-type' && (
                    <div className="space-y-4 sm:space-y-5">
                      <div className="text-center space-y-1">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900">How would you like to meet?</h3>
                        <p className="text-sm text-gray-500">Choose your preferred consultation method</p>
                      </div>

                      <div className="grid gap-2.5 sm:gap-3">
                        {([
                          {
                            id: 'virtual' as const,
                            icon: Video,
                            title: 'Virtual Meeting',
                            subtitle: 'Video call via Microsoft Teams or Zoom',
                            detail: 'Best for screen sharing and document review',
                          },
                          {
                            id: 'telephonic' as const,
                            icon: PhoneCall,
                            title: 'Telephonic Meeting',
                            subtitle: 'Voice call via telephone',
                            detail: 'Quick and convenient for initial consultations',
                          },
                        ] as const).map((opt) => {
                          const selected = selectedMeetingType === opt.id;
                          return (
                            <button
                              key={opt.id}
                              onClick={() => setSelectedMeetingType(opt.id)}
                              className={`
                                relative p-3.5 sm:p-5 rounded-xl border-2 transition-all duration-200 text-left
                                ${
                                  selected
                                    ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                }
                              `}
                            >
                              <div className="flex items-start gap-4">
                                <div
                                  className={`
                                    p-2.5 rounded-lg transition-colors duration-200
                                    ${selected ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'}
                                  `}
                                >
                                  <opt.icon className="h-5 w-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-semibold text-gray-900">{opt.title}</h4>
                                    <div
                                      className={`
                                        w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all
                                        ${selected ? 'border-primary bg-primary' : 'border-gray-300'}
                                      `}
                                    >
                                      {selected && <CheckCircle className="h-3.5 w-3.5 text-white" />}
                                    </div>
                                  </div>
                                  <p className="text-sm text-gray-500 mt-0.5">{opt.subtitle}</p>
                                  <p className="text-xs text-gray-400 mt-1">{opt.detail}</p>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 sm:p-3.5 flex items-start gap-3">
                        <Clock className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-blue-900">Business Hours</p>
                          <p className="text-xs text-blue-700 mt-0.5">
                            Monday – Friday, 08:00 – 16:30 (SAST). Bookings require at least one full business day's notice.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Step 2: Date ── */}
                  {currentStep === 'date' && (
                    <div className="space-y-4 sm:space-y-5">
                      <div className="text-center space-y-1 px-1">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900">Select a date</h3>
                        <p className="text-sm text-gray-500">Choose your preferred consultation date</p>
                      </div>

                      <div className="w-full max-w-full -mx-2 px-0.5 sm:mx-0 sm:px-0">
                        <style>{`
                          .nw-consultation-calendar.rdp-root { width: 100%; max-width: 100%; }
                          .nw-consultation-calendar .rdp-month { width: 100%; }
                          .nw-consultation-calendar table.rdp-month_grid { width: 100%; table-layout: fixed; }
                          .nw-consultation-calendar td.rdp-day[data-disabled="true"] .rdp-day_button {
                            background-color: rgb(243 244 246);
                            color: rgb(156 163 175);
                            cursor: not-allowed;
                            opacity: 1;
                            font-weight: 400;
                          }
                          .nw-consultation-calendar td.rdp-day[data-disabled="true"] .rdp-day_button:hover {
                            background-color: rgb(243 244 246);
                            color: rgb(156 163 175);
                          }
                          .nw-consultation-calendar td.nw-cal-past[data-disabled="true"] .rdp-day_button {
                            text-decoration: line-through;
                            text-decoration-color: rgb(209 213 219);
                          }
                          .nw-consultation-calendar td.rdp-day.rdp-selected:not([data-disabled="true"]) .rdp-day_button {
                            background-color: rgb(109 40 217);
                            color: white;
                          }
                          .nw-consultation-calendar td.rdp-day.rdp-selected:not([data-disabled="true"]) .rdp-day_button:hover {
                            background-color: rgb(91 33 182);
                            color: white;
                          }
                        `}</style>
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={(date) => {
                            setSelectedDate(date);
                            setSelectedTime('');
                          }}
                          disabled={isBookingDateDisabled}
                          modifiers={{ past: isPastCalendarDay }}
                          modifiersClassNames={{ past: 'nw-cal-past' }}
                          className={cn(
                            'nw-consultation-calendar w-full max-w-full rounded-xl border border-gray-200 bg-white p-2 shadow-sm sm:p-3'
                          )}
                          classNames={{
                            root: 'w-full max-w-full',
                            months: 'w-full flex flex-col gap-4 sm:flex-row sm:gap-4',
                            month: 'w-full space-y-3',
                            month_caption: 'relative mb-1 flex h-10 items-center justify-center px-11',
                            caption_label: 'text-sm font-semibold text-gray-900',
                            nav: 'absolute inset-x-0 top-0 flex w-full items-center justify-between px-0.5',
                            button_previous:
                              'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
                            button_next:
                              'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
                            month_grid: 'w-full border-collapse',
                            weekdays: 'flex w-full',
                            weekday:
                              'flex h-9 flex-1 items-center justify-center p-0 text-[0.65rem] font-medium uppercase tracking-wide text-gray-400 sm:text-xs',
                            weeks: 'w-full',
                            week: 'mt-1.5 flex w-full gap-0.5 sm:mt-2 sm:gap-1',
                            day: 'relative flex min-h-[2.75rem] flex-1 items-center justify-center p-0 text-center',
                            day_button: cn(
                              'rdp-day_button inline-flex h-11 min-h-[2.75rem] w-full max-w-[3rem] sm:max-w-[3.25rem]',
                              'items-center justify-center rounded-lg text-sm font-medium text-gray-900',
                              'hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40'
                            ),
                            outside: 'text-gray-400 opacity-60',
                            today: 'font-semibold [&_.rdp-day_button]:ring-1 [&_.rdp-day_button]:ring-primary/35',
                            disabled: 'nw-day-disabled',
                          }}
                        />
                      </div>

                      <p className="text-center text-xs text-gray-400 px-1">
                        Unavailable dates are greyed; days before today also show a strikethrough.
                      </p>

                      {selectedDate && (
                        <div className="bg-primary/5 border border-primary/15 rounded-lg p-3 text-center">
                          <p className="text-sm text-gray-700">
                            Selected:{' '}
                            <span className="font-semibold text-primary">
                              {format(selectedDate, 'EEEE, d MMMM yyyy')}
                            </span>
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Step 3: Time ── */}
                  {currentStep === 'time' && selectedDate && (
                    <div className="space-y-4 sm:space-y-5">
                      <div className="text-center space-y-1">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900">Select a time</h3>
                        <p className="text-sm text-gray-500">
                          {format(selectedDate, 'EEEE, d MMMM yyyy')}
                        </p>
                      </div>

                      {availableTimeSlots.length > 0 ? (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[300px] overflow-y-auto pr-1">
                          {availableTimeSlots.map((time) => {
                            const isSelected = selectedTime === time;
                            return (
                              <button
                                key={time}
                                onClick={() => setSelectedTime(time)}
                                className={`
                                  py-2.5 px-2 rounded-lg border transition-all duration-150 text-center
                                  ${
                                    isSelected
                                      ? 'border-primary bg-primary text-white shadow-sm'
                                      : 'border-gray-200 hover:border-primary/40 hover:bg-primary/5 text-gray-700'
                                  }
                                `}
                              >
                                <span className="text-sm font-medium">{formatTimeLabel(time)}</span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
                          <Clock className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                          <p className="text-sm text-gray-600 font-medium">No available time slots</p>
                          <p className="text-xs text-gray-400 mt-1">Please select a different date.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Step 4: Contact Details ── */}
                  {currentStep === 'details' && (
                    <div className="space-y-4 sm:space-y-5">
                      <div className="text-center space-y-1">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900">Your details</h3>
                        <p className="text-sm text-gray-500">
                          We'll use this to confirm your appointment
                        </p>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="consultation-name" className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                            Full Name <span className="text-red-500">*</span>
                          </Label>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                              id="consultation-name"
                              type="text"
                              placeholder="e.g. John Smith"
                              value={formData.name}
                              onChange={(e) => handleInputChange('name', e.target.value)}
                              className="pl-10 h-10"
                              required
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="consultation-email" className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                            Email Address <span className="text-red-500">*</span>
                          </Label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                              id="consultation-email"
                              type="email"
                              placeholder="e.g. john@example.com"
                              value={formData.email}
                              onChange={(e) => handleInputChange('email', e.target.value)}
                              className="pl-10 h-10"
                              required
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="consultation-phone" className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                            Contact Number <span className="text-red-500">*</span>
                          </Label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                              id="consultation-phone"
                              type="tel"
                              placeholder="e.g. +27 12 345 6789"
                              value={formData.phone}
                              onChange={(e) => handleInputChange('phone', e.target.value)}
                              className="pl-10 h-10"
                              required
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="consultation-notes" className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                            Additional Notes <span className="text-gray-400 font-normal normal-case">(optional)</span>
                          </Label>
                          <div className="relative">
                            <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Textarea
                              id="consultation-notes"
                              placeholder="Tell us about your financial planning needs or any specific questions..."
                              value={formData.additionalNotes}
                              onChange={(e) => handleInputChange('additionalNotes', e.target.value)}
                              rows={3}
                              className="pl-10 resize-none"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Step 5: Confirmation ── */}
                  {currentStep === 'confirm' && selectedDate && (
                    <div className="space-y-4 sm:space-y-5">
                      <div className="text-center space-y-1">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900">Review your booking</h3>
                        <p className="text-sm text-gray-500">Please confirm the details below</p>
                      </div>

                      <div className="bg-gray-50 rounded-xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">
                        {/* Meeting type */}
                        <div className="flex items-center gap-3 px-5 py-3.5">
                          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                            {selectedMeetingType === 'virtual' ? (
                              <Video className="h-4 w-4 text-primary" />
                            ) : (
                              <PhoneCall className="h-4 w-4 text-primary" />
                            )}
                          </div>
                          <div>
                            <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">Meeting Type</p>
                            <p className="text-sm font-medium text-gray-900">
                              {selectedMeetingType === 'virtual' ? 'Virtual Meeting' : 'Telephonic Meeting'}
                            </p>
                          </div>
                        </div>

                        {/* Date */}
                        <div className="flex items-center gap-3 px-5 py-3.5">
                          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                            <CalendarIcon className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">Date</p>
                            <p className="text-sm font-medium text-gray-900">
                              {format(selectedDate, 'EEEE, d MMMM yyyy')}
                            </p>
                          </div>
                        </div>

                        {/* Time */}
                        <div className="flex items-center gap-3 px-5 py-3.5">
                          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Clock className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">Time</p>
                            <p className="text-sm font-medium text-gray-900">{formatTimeLabel(selectedTime)} (SAST)</p>
                          </div>
                        </div>

                        {/* Contact */}
                        <div className="flex items-center gap-3 px-5 py-3.5">
                          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">Contact</p>
                            <p className="text-sm font-medium text-gray-900">{formData.name}</p>
                            <p className="text-xs text-gray-500">{formData.email} &middot; {formData.phone}</p>
                          </div>
                        </div>

                        {/* Notes */}
                        {formData.additionalNotes && (
                          <div className="flex items-start gap-3 px-5 py-3.5">
                            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                              <MessageSquare className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">Notes</p>
                              <p className="text-sm text-gray-700 leading-relaxed">{formData.additionalNotes}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Trust signals */}
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { icon: Shield, text: 'Free consultation' },
                          { icon: CheckCircle, text: 'No obligation' },
                          { icon: Sparkles, text: 'Expert advice' },
                        ].map(({ icon: Icon, text }) => (
                          <div
                            key={text}
                            className="flex flex-col items-center gap-1.5 text-center bg-green-50 border border-green-100 rounded-lg py-3 px-2"
                          >
                            <Icon className="h-4 w-4 text-green-600" />
                            <span className="text-[11px] font-medium text-green-800">{text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* ── Footer ── */}
            <div className="border-t border-gray-100 px-4 sm:px-6 py-3 sm:py-4 bg-gray-50/80 mt-auto">
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleBack}
                  disabled={currentStepIndex === 0}
                  className="text-sm disabled:opacity-0"
                >
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  Back
                </Button>

                {currentStep !== 'confirm' ? (
                  <Button
                    type="button"
                    onClick={handleNext}
                    disabled={!canProceed()}
                    className="bg-primary text-white hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-sm px-6"
                  >
                    Continue
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="bg-primary text-white hover:bg-primary/90 text-sm px-6"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Booking...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Confirm Booking
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
