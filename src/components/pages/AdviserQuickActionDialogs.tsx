/**
 * The Schedule Meeting and Message Adviser quick-action dialogs of the My
 * Adviser page (each carries its own trigger button). JSX moved verbatim
 * from MyAdviserPage.tsx; every captured name became a prop.
 */
import React from 'react';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Calendar, CheckCircle, Info, MessageSquare, Send } from 'lucide-react';

interface AdviserQuickActionDialogsProps {
  adviserData: { name: string };
  scheduleMeetingOpen: boolean;
  setScheduleMeetingOpen: React.Dispatch<React.SetStateAction<boolean>>;
  messageAdviserOpen: boolean;
  setMessageAdviserOpen: React.Dispatch<React.SetStateAction<boolean>>;
  timeSlots: string[];
  selectedTimeSlots: string[];
  handleTimeSlotToggle: (slot: string) => void;
  meetingPurpose: string;
  setMeetingPurpose: React.Dispatch<React.SetStateAction<string>>;
  messageContent: string;
  setMessageContent: React.Dispatch<React.SetStateAction<string>>;
  handleScheduleMeeting: () => void;
  handleSendMessage: () => void;
}

export function AdviserQuickActionDialogs({
  adviserData,
  scheduleMeetingOpen,
  setScheduleMeetingOpen,
  messageAdviserOpen,
  setMessageAdviserOpen,
  timeSlots,
  selectedTimeSlots,
  handleTimeSlotToggle,
  meetingPurpose,
  setMeetingPurpose,
  messageContent,
  setMessageContent,
  handleScheduleMeeting,
  handleSendMessage,
}: AdviserQuickActionDialogsProps) {
  return (
    <>
      <Dialog open={scheduleMeetingOpen} onOpenChange={setScheduleMeetingOpen}>
        <DialogTrigger asChild>
          <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white">
            <Calendar className="h-4 w-4 mr-2" />
            Schedule Meeting
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Schedule a Meeting with {adviserData.name}</DialogTitle>
            <DialogDescription>
              Please select 3 available time slots next week (10:00 AM - 4:00 PM). Your adviser's
              Personal Assistant will contact you to confirm the best time slot.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div>
              <Label htmlFor="purpose">Meeting Purpose *</Label>
              <Select value={meetingPurpose} onValueChange={setMeetingPurpose}>
                <SelectTrigger>
                  <SelectValue placeholder="Select meeting purpose" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual_review">Annual Portfolio Review</SelectItem>
                  <SelectItem value="tax_planning">Tax Planning Session</SelectItem>
                  <SelectItem value="investment_review">Investment Strategy Review</SelectItem>
                  <SelectItem value="insurance_review">Insurance Coverage Review</SelectItem>
                  <SelectItem value="estate_planning">Estate Planning Discussion</SelectItem>
                  <SelectItem value="general_consultation">
                    General Financial Consultation
                  </SelectItem>
                  <SelectItem value="urgent_matter">Urgent Financial Matter</SelectItem>
                  <SelectItem value="goal_review">Financial Goals Review</SelectItem>
                  <SelectItem value="market_discussion">Market Discussion</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Available Time Slots (Select 3) *</Label>
              <p className="text-sm text-gray-600 mb-3">
                Selected: {selectedTimeSlots.length}/3 time slots
              </p>
              <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
                {timeSlots.map((slot) => (
                  <div
                    key={slot}
                    className={`p-3 border rounded-lg cursor-pointer transition-all ${
                      selectedTimeSlots.includes(slot)
                        ? 'border-purple-300 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleTimeSlotToggle(slot)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm">{slot}</span>
                      {selectedTimeSlots.includes(slot) && (
                        <CheckCircle className="h-4 w-4 text-purple-600" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Alert className="bg-blue-50 border-blue-200">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                Meetings will be conducted via video call or phone. Your adviser's PA will send you
                the meeting details and agenda 24 hours before the confirmed time.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button
              onClick={handleScheduleMeeting}
              disabled={selectedTimeSlots.length !== 3 || !meetingPurpose}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Send className="h-4 w-4 mr-2" />
              Submit Meeting Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={messageAdviserOpen} onOpenChange={setMessageAdviserOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="w-full border-purple-600 text-purple-600 hover:bg-purple-50"
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Message Adviser
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Message to {adviserData.name}</DialogTitle>
            <DialogDescription>
              Send a secure message to your adviser. You'll receive a response within 24 hours.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="message">Your Message *</Label>
              <Textarea
                id="message"
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                placeholder="Type your message here..."
                rows={6}
                className="resize-none"
              />
              <p className="text-sm text-gray-500 mt-1">{messageContent.length}/1000 characters</p>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={handleSendMessage}
              disabled={!messageContent.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Send className="h-4 w-4 mr-2" />
              Send Message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
