/**
 * Portfolio Summary — Booking Modal
 * Modal for scheduling a meeting with the financial adviser.
 * Submits a calendar event via the portfolio API layer.
 * Guidelines §7 (presentation + local UI state), §8.3 (form patterns).
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../ui/dialog';
import { Button } from '../../../ui/button';
import { Label } from '../../../ui/label';
import { Textarea } from '../../../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select';
import { Calendar, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { useAuth } from '../../../auth/AuthContext';
import { useBookMeeting } from '../hooks';

interface BookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ── Meeting type labels (Guidelines §5.3) ──
const MEETING_TYPES = [
  { value: 'Annual Portfolio Review', label: 'Annual Portfolio Review' },
  { value: 'Risk Assessment', label: 'Risk Assessment' },
  { value: 'Investment Consultation', label: 'Investment Consultation' },
  { value: 'Retirement Planning', label: 'Retirement Planning' },
  { value: 'Tax Planning', label: 'Tax Planning' },
  { value: 'Estate Planning', label: 'Estate Planning' },
  { value: 'General Consultation', label: 'General Consultation' },
] as const;

const TIME_PREFERENCES = [
  { value: 'morning', label: 'Morning (09:00 - 12:00)' },
  { value: 'afternoon', label: 'Afternoon (12:00 - 17:00)' },
  { value: 'evening', label: 'Evening (17:00 - 19:00)' },
] as const;

const MEETING_FORMATS = [
  { value: 'video', label: 'Video Call' },
  { value: 'phone', label: 'Phone Call' },
  { value: 'inperson', label: 'In-Person Meeting' },
] as const;

export function BookingModal({ open, onOpenChange }: BookingModalProps) {
  const { user } = useAuth();

  const [meetingType, setMeetingType] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [format, setFormat] = useState('');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const bookMutation = useBookMeeting();

  const canSubmit = meetingType && preferredTime && format;

  const handleSubmit = async () => {
    if (!user?.id || !canSubmit) return;

    const result = await bookMutation.mutateAsync({
      meetingType,
      preferredTime,
      format,
      notes,
      clientId: user.id,
      clientName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Client',
    });

    if (result.success) {
      setSubmitted(true);
      toast.success('Meeting request submitted', {
        description: 'Your adviser will confirm the appointment shortly.',
      });
    } else {
      toast.error('Unable to book meeting', {
        description: result.error || 'Please try again later.',
      });
    }
  };

  const handleClose = () => {
    setMeetingType('');
    setPreferredTime('');
    setFormat('');
    setNotes('');
    setSubmitted(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Calendar className="h-6 w-6 text-blue-600" />
            <span>Book a Meeting</span>
          </DialogTitle>
          <DialogDescription>
            Schedule a consultation with your financial adviser
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="flex flex-col items-center py-10 text-center">
            <CheckCircle className="h-14 w-14 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold text-black mb-2">
              Meeting Request Submitted
            </h3>
            <p className="text-sm text-gray-600 max-w-md">
              Your request for a <strong>{meetingType}</strong> has been received.
              Your adviser will confirm the date and time shortly.
            </p>
            <Button className="mt-6" onClick={handleClose}>
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-black mb-2 block">Meeting Type</Label>
                <Select value={meetingType} onValueChange={setMeetingType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select meeting type" />
                  </SelectTrigger>
                  <SelectContent>
                    {MEETING_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-black mb-2 block">Preferred Time</Label>
                <Select value={preferredTime} onValueChange={setPreferredTime}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select time preference" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_PREFERENCES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-black mb-2 block">Meeting Format</Label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger>
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  {MEETING_FORMATS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-black mb-2 block">
                What would you like to discuss? (Optional)
              </Label>
              <Textarea
                placeholder="Describe any specific topics or concerns you'd like to cover..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end space-x-3">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                disabled={!canSubmit || bookMutation.isPending}
                onClick={handleSubmit}
              >
                {bookMutation.isPending ? (
                  <div className="contents">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </div>
                ) : (
                  'Book Meeting'
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}