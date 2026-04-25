/**
 * ServiceRequestModal
 * Reusable modal for sending structured service requests to the client's adviser.
 * Used for "Submit Claim", "Boost Contribution", "Submit Return", etc.
 *
 * Submits via the quote-request/submit endpoint with requestType metadata
 * so the admin can route it appropriately.
 *
 * Guidelines refs: §7 (presentation), §10 (error handling), §12.2 (no PII in logs)
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import {
  CheckCircle,
  Loader2,
  Send,
  Upload,
  TrendingUp,
  Users,
  Scroll,
  MessageSquare,
  PieChart,
  Briefcase,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { useAuth } from '../auth/AuthContext';
import {
  getBlockedEmailDomain,
  getBlockedEmailDomainWarning,
} from '@/shared/submissions/blockedEmailDomains';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379`;

export type ServiceRequestType =
  | 'claim'
  | 'contribution_change'
  | 'tax_return'
  | 'will_review'
  | 'add_dependant'
  | 'view_allocation'
  | 'view_members'
  | 'general';

export interface ServiceRequestConfig {
  title: string;
  description: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  subjectPrefix: string;
  fields: RequestField[];
  submitLabel: string;
}

interface RequestField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select';
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
}

interface ServiceRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ServiceRequestConfig;
  requestType: ServiceRequestType;
  /** Product category for admin routing (e.g. 'risk_planning', 'medical_aid') */
  productCategory: string;
}

export function ServiceRequestModal({
  isOpen,
  onClose,
  config,
  requestType,
  productCategory,
}: ServiceRequestModalProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleFieldChange = (fieldId: string, value: string) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = async () => {
    const missingRequired = config.fields
      .filter((f) => f.required && !formData[f.id]?.trim())
      .map((f) => f.label);

    if (missingRequired.length > 0) {
      toast.error(`Please fill in: ${missingRequired.join(', ')}`);
      return;
    }

    const blockedDomain = getBlockedEmailDomain(user?.email || '');
    if (blockedDomain) {
      toast.error(getBlockedEmailDomainWarning(blockedDomain));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE}/quote-request/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          firstName: user?.firstName || '',
          lastName: user?.lastName || '',
          email: user?.email || '',
          phone: '',
          service: productCategory,
          productDetails: {
            requestType,
            subjectPrefix: config.subjectPrefix,
            ...formData,
          },
          metadata: {
            source: 'ClientPortalServiceRequest',
            requestType,
            productCategory,
            submitted_at: new Date().toISOString(),
            status: 'submitted',
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        console.error('Service request submission failed:', response.status, errorBody);
        throw new Error(
          typeof errorBody?.error === 'string'
            ? errorBody.error
            : 'Unable to submit your request. Please try again or contact your adviser directly.',
        );
      }

      setIsSubmitted(true);
      toast.success('Request submitted successfully. Your adviser will be in touch.');
    } catch (error) {
      console.error('Error submitting service request:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Unable to submit your request. Please try again or contact your adviser directly.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({});
    setIsSubmitted(false);
    onClose();
  };

  const Icon = config.icon;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className={`h-10 w-10 rounded-lg ${config.iconBg} flex items-center justify-center`}>
              <Icon className={`h-5 w-5 ${config.iconColor}`} />
            </div>
            <div>
              <DialogTitle className="text-lg">{config.title}</DialogTitle>
              <DialogDescription className="text-sm">{config.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isSubmitted ? (
          <div className="py-8 text-center">
            <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-7 w-7 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Request Submitted</h3>
            <p className="text-sm text-gray-600 max-w-sm mx-auto">
              Your adviser has been notified and will follow up with you shortly. You can track the
              status on your Communications page.
            </p>
            <Button onClick={handleClose} className="mt-6" variant="outline">
              Close
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Pre-filled client info */}
            <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                </div>
                <Badge variant="outline" className="text-xs border-gray-200 text-gray-500">
                  {config.subjectPrefix}
                </Badge>
              </div>
            </div>

            {/* Dynamic fields */}
            {config.fields.map((field) => (
              <div key={field.id} className="space-y-1.5">
                <Label htmlFor={field.id} className="text-sm font-medium text-gray-700">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-0.5">*</span>}
                </Label>
                {field.type === 'textarea' ? (
                  <textarea
                    id={field.id}
                    placeholder={field.placeholder}
                    value={formData[field.id] || ''}
                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                    className="w-full min-h-[100px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y"
                  />
                ) : field.type === 'select' && field.options ? (
                  <select
                    id={field.id}
                    value={formData[field.id] || ''}
                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">Select...</option>
                    {field.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id={field.id}
                    type="text"
                    placeholder={field.placeholder}
                    value={formData[field.id] || ''}
                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                    className="border-gray-300 bg-white text-gray-900"
                  />
                )}
              </div>
            ))}

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <div className="contents">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </div>
                ) : (
                  <div className="contents">
                    <Send className="h-4 w-4 mr-2" />
                    {config.submitLabel}
                  </div>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Pre-built configs for common request types ─────────────────────────────

export const SERVICE_REQUEST_CONFIGS: Record<string, ServiceRequestConfig> = {
  claim: {
    title: 'Submit a Claim',
    description: 'Notify your adviser to start the claims process on your behalf.',
    icon: Upload,
    iconBg: 'bg-green-50',
    iconColor: 'text-green-600',
    subjectPrefix: 'Claim Request',
    submitLabel: 'Submit Claim Request',
    fields: [
      {
        id: 'claimType',
        label: 'Type of claim',
        type: 'select',
        required: true,
        options: [
          { value: 'death', label: 'Death Claim' },
          { value: 'disability', label: 'Disability Claim' },
          { value: 'severe_illness', label: 'Severe Illness Claim' },
          { value: 'income_protection', label: 'Income Protection Claim' },
          { value: 'retrenchment', label: 'Retrenchment Claim' },
          { value: 'other', label: 'Other' },
        ],
      },
      {
        id: 'policyReference',
        label: 'Policy number (if known)',
        type: 'text',
        placeholder: 'e.g. POL-12345',
        required: false,
      },
      {
        id: 'description',
        label: 'Brief description',
        type: 'textarea',
        placeholder: 'Please describe the circumstances of the claim...',
        required: true,
      },
    ],
  },
  contribution_change: {
    title: 'Change Contribution',
    description: 'Request a change to your monthly contribution amount.',
    icon: TrendingUp,
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-600',
    subjectPrefix: 'Contribution Change',
    submitLabel: 'Submit Request',
    fields: [
      {
        id: 'changeType',
        label: 'Change type',
        type: 'select',
        required: true,
        options: [
          { value: 'increase', label: 'Increase contribution' },
          { value: 'decrease', label: 'Decrease contribution' },
          { value: 'lump_sum', label: 'Make a lump sum contribution' },
        ],
      },
      {
        id: 'amount',
        label: 'New/additional amount (R)',
        type: 'text',
        placeholder: 'e.g. 5 000',
        required: false,
      },
      {
        id: 'notes',
        label: 'Additional notes',
        type: 'textarea',
        placeholder: 'Any additional details...',
        required: false,
      },
    ],
  },
  tax_return: {
    title: 'Submit Tax Return',
    description: 'Send your tax documents to your adviser for processing.',
    icon: Upload,
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
    subjectPrefix: 'Tax Return',
    submitLabel: 'Submit Request',
    fields: [
      {
        id: 'taxYear',
        label: 'Tax year',
        type: 'select',
        required: true,
        options: [
          { value: '2026', label: '2025/2026' },
          { value: '2025', label: '2024/2025' },
          { value: '2024', label: '2023/2024' },
        ],
      },
      {
        id: 'returnType',
        label: 'Return type',
        type: 'select',
        required: true,
        options: [
          { value: 'individual', label: 'Individual (ITR12)' },
          { value: 'provisional', label: 'Provisional (IRP6)' },
          { value: 'company', label: 'Company (ITR14)' },
        ],
      },
      {
        id: 'notes',
        label: 'Additional information',
        type: 'textarea',
        placeholder: 'List any documents you\'ll be providing (IRP5, medical certificates, etc.)...',
        required: false,
      },
    ],
  },
  add_dependant: {
    title: 'Add Dependant',
    description: 'Request to add a new dependant to your medical aid membership.',
    icon: Users,
    iconBg: 'bg-red-50',
    iconColor: 'text-red-600',
    subjectPrefix: 'Add Dependant',
    submitLabel: 'Submit Request',
    fields: [
      {
        id: 'relationship',
        label: 'Relationship',
        type: 'select',
        required: true,
        options: [
          { value: 'spouse', label: 'Spouse / Partner' },
          { value: 'child', label: 'Child' },
          { value: 'parent', label: 'Parent' },
          { value: 'other', label: 'Other' },
        ],
      },
      {
        id: 'dependantName',
        label: 'Dependant name',
        type: 'text',
        placeholder: 'Full name of the dependant',
        required: true,
      },
      {
        id: 'notes',
        label: 'Additional details',
        type: 'textarea',
        placeholder: 'Date of birth, ID number (if applicable), reason for adding...',
        required: false,
      },
    ],
  },
  will_review: {
    title: 'Review My Will',
    description: 'Request a review or update of your Last Will and Testament.',
    icon: Scroll,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
    subjectPrefix: 'Will Review',
    submitLabel: 'Submit Request',
    fields: [
      {
        id: 'reviewReason',
        label: 'Reason for review',
        type: 'select',
        required: true,
        options: [
          { value: 'periodic', label: 'Routine periodic review' },
          { value: 'marriage', label: 'Marriage / Divorce' },
          { value: 'birth', label: 'Birth of a child' },
          { value: 'property', label: 'Property purchase / sale' },
          { value: 'beneficiary', label: 'Change beneficiaries' },
          { value: 'other', label: 'Other life event' },
        ],
      },
      {
        id: 'notes',
        label: 'Additional details',
        type: 'textarea',
        placeholder: 'Describe what needs to change...',
        required: false,
      },
    ],
  },
  view_allocation: {
    title: 'Request Allocation Report',
    description: 'Your adviser will prepare a detailed breakdown of your portfolio allocation.',
    icon: PieChart,
    iconBg: 'bg-green-50',
    iconColor: 'text-green-600',
    subjectPrefix: 'Allocation Report',
    submitLabel: 'Request Report',
    fields: [
      {
        id: 'notes',
        label: 'Specific areas of interest',
        type: 'textarea',
        placeholder: 'e.g. Asset class breakdown, geographic exposure, sector allocation...',
        required: false,
      },
    ],
  },
  view_members: {
    title: 'Manage Scheme Members',
    description: 'Request changes to your group scheme membership.',
    icon: Briefcase,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    subjectPrefix: 'Member Management',
    submitLabel: 'Submit Request',
    fields: [
      {
        id: 'changeType',
        label: 'What do you need?',
        type: 'select',
        required: true,
        options: [
          { value: 'add_member', label: 'Add a member' },
          { value: 'remove_member', label: 'Remove a member' },
          { value: 'update_details', label: 'Update member details' },
          { value: 'member_list', label: 'Request current member list' },
        ],
      },
      {
        id: 'notes',
        label: 'Additional details',
        type: 'textarea',
        placeholder: 'Provide names, dates, and any other relevant information...',
        required: false,
      },
    ],
  },
  general: {
    title: 'Contact Your Adviser',
    description: 'Send a request to your financial adviser.',
    icon: MessageSquare,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    subjectPrefix: 'General Request',
    submitLabel: 'Send Request',
    fields: [
      {
        id: 'subject',
        label: 'Subject',
        type: 'text',
        placeholder: 'What is this about?',
        required: true,
      },
      {
        id: 'description',
        label: 'Details',
        type: 'textarea',
        placeholder: 'Please describe what you need...',
        required: true,
      },
    ],
  },
};
