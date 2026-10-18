/**
 * CVUploadModal — the Careers application form.
 *
 * It used to show a file drop zone and then "simulate" an upload: after two
 * seconds it announced "Your CV has been submitted successfully!" while
 * sending nothing. There is no CV storage behind the site, so the honest
 * version sends the applicant's details as a real enquiry (stored, and emailed
 * to the firm and the applicant) and asks for the CV by email to the one
 * public mailbox.
 */
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { toast } from 'sonner';
import { Mail, MessageSquare, Phone, User } from 'lucide-react';
import { COMPANY } from '@/config/companyFacts';
import { splitFullName, submitContactEnquiry } from '../../services/contactEnquiry';

interface CVUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EMPTY_FORM = { name: '', email: '', phone: '', message: '' };

export function CVUploadModal({ isOpen, onClose }: CVUploadModalProps) {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cvMailto = `mailto:${COMPANY.email}?subject=${encodeURIComponent(
    `CV – ${formData.name.trim() || 'Application'}`,
  )}`;

  const handleInputChange = (field: keyof typeof EMPTY_FORM, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.email.trim() || !formData.phone.trim()) {
      toast.error('Please fill in all required fields.');
      return;
    }

    setIsSubmitting(true);
    const result = await submitContactEnquiry({
      ...splitFullName(formData.name),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      service: 'Careers',
      message: formData.message.trim(),
      clientType: 'job application',
    });
    setIsSubmitting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(`Thank you — we have your details. Please email your CV to ${COMPANY.email}.`);
    setFormData(EMPTY_FORM);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg sm:max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle className="text-2xl text-center mb-2">Submit Your CV</DialogTitle>
          <DialogDescription className="text-center text-lg">
            Send us your details below, then email your CV to {COMPANY.email}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Contact Information</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-gray-700">
                  Full Name *
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Your full name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-700">
                  Email Address *
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@example.com"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-gray-700">
                Phone Number *
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+27 12 345 6789"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message" className="text-gray-700">
              Tell us about yourself
            </Label>
            <div className="relative">
              <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Textarea
                id="message"
                placeholder="Tell us about your experience, what role you're interested in, or why you'd like to work with Navigate Wealth..."
                value={formData.message}
                onChange={(e) => handleInputChange('message', e.target.value)}
                className="pl-10 min-h-[100px]"
              />
            </div>
          </div>

          <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 text-sm text-purple-900">
            <p className="font-medium mb-1">Your CV</p>
            <p>
              Please email your CV (PDF or Word) to{' '}
              <a href={cvMailto} className="font-semibold underline">
                {COMPANY.email}
              </a>{' '}
              with your name in the subject line.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3"
            >
              {isSubmitting ? 'Sending…' : 'Send My Details'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 py-3"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
