/**
 * What a client can change on each service, per service id.
 *
 * Split out of `ProductsServicesDashboardPage.tsx` (1,482 lines), which carried
 * the service catalogue, the per-service change options and every derivation
 * alongside a 950-line page.
 */
import { projectId } from '../../../utils/supabase/info';
import { type ServiceModule } from './serviceModules';

export interface ChangeOption {
  id: string;
  label: string;
  description: string;
}

export const SUBMISSIONS_API = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/submissions`;

export const CHANGE_OPTIONS_BY_SERVICE: Record<ServiceModule['id'], ChangeOption[]> = {
  'risk-management': [
    {
      id: 'beneficiary_change',
      label: 'Beneficiary change',
      description: 'Update or replace the nominated beneficiary on this policy.',
    },
    {
      id: 'debit_order_date_change',
      label: 'Debit order date change',
      description: 'Request a new debit order collection date.',
    },
    {
      id: 'bank_account_change',
      label: 'Bank account change',
      description: 'Change the bank account linked to this premium collection.',
    },
    {
      id: 'cover_review',
      label: 'Cover review',
      description: 'Ask us to review whether this cover still matches your needs.',
    },
  ],
  'medical-aid': [
    {
      id: 'plan_change',
      label: 'Plan option change',
      description: 'Request help changing the medical aid plan option.',
    },
    {
      id: 'dependant_update',
      label: 'Dependant update',
      description: 'Add or remove a dependant on this plan.',
    },
    {
      id: 'bank_account_change',
      label: 'Bank account change',
      description: 'Change the bank account used for monthly collections.',
    },
    {
      id: 'membership_update',
      label: 'Membership detail change',
      description: 'Update contact or membership details linked to this plan.',
    },
  ],
  'investment-management': [
    {
      id: 'contribution_change',
      label: 'Contribution change',
      description: 'Increase, reduce, or pause regular contributions.',
    },
    {
      id: 'bank_account_change',
      label: 'Bank account change',
      description: 'Update the bank account used for recurring investments.',
    },
    {
      id: 'withdrawal_request',
      label: 'Withdrawal request',
      description: 'Ask for help with a withdrawal or access request.',
    },
    {
      id: 'switch_instruction',
      label: 'Switch instruction',
      description: 'Request a review or switch instruction on this investment.',
    },
  ],
  'retirement-planning': [
    {
      id: 'contribution_change',
      label: 'Contribution change',
      description: 'Adjust the monthly contribution on this retirement plan.',
    },
    {
      id: 'beneficiary_change',
      label: 'Beneficiary change',
      description: 'Update the beneficiary details attached to this plan.',
    },
    {
      id: 'bank_account_change',
      label: 'Bank account change',
      description: 'Change the bank account used for contributions.',
    },
    {
      id: 'retirement_review',
      label: 'Retirement review',
      description: 'Request a review of this retirement policy or fund.',
    },
  ],
  'tax-planning': [
    {
      id: 'document_request',
      label: 'Document request',
      description: 'Request tax documents or supporting records for this service.',
    },
    {
      id: 'submission_support',
      label: 'Submission support',
      description: 'Ask for help with a tax filing or submission-related change.',
    },
    {
      id: 'detail_update',
      label: 'Detail update',
      description: 'Update the information we should use for this tax service.',
    },
  ],
  'estate-planning': [
    {
      id: 'beneficiary_change',
      label: 'Beneficiary change',
      description: 'Request a beneficiary-related update connected to this planning area.',
    },
    {
      id: 'document_update',
      label: 'Document update',
      description: 'Ask us to update or review a will, trust, or estate document.',
    },
    {
      id: 'planning_review',
      label: 'Planning review',
      description: 'Request an estate planning review meeting for this arrangement.',
    },
  ],
  'employee-benefits': [
    {
      id: 'member_update',
      label: 'Member detail change',
      description: 'Update employee or membership information on this benefit plan.',
    },
    {
      id: 'beneficiary_change',
      label: 'Beneficiary change',
      description: 'Update the nominated beneficiary for this benefit.',
    },
    {
      id: 'bank_account_change',
      label: 'Bank account change',
      description: 'Update the banking details linked to this arrangement.',
    },
    {
      id: 'benefit_review',
      label: 'Benefit review',
      description: 'Request a review of the benefits or cover attached to this plan.',
    },
  ],
};
