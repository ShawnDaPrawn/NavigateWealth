/**
 * Step definitions for the admin will-drafting wizard — one list for a last
 * will, one for a living will. Split out of WillDraftingWizard.tsx.
 */
/**
 * Will Drafting Wizard
 * Multi-step wizard for drafting Last Will & Testament and Living Will for clients.
 * Admin tool that creates draft wills that can be finalized when original signed will is collected.
 *
 * Decomposed per Guidelines S4.1 — types, constants, UI primitives, and step renderers
 * are extracted into sibling files for discoverability and maintainability.
 *
 * UI/UX improvements v2:
 *  - Numbered horizontal stepper with connecting progress track
 *  - 2-column form grid for paired fields
 *  - Accent-bordered item cards with numbered badges
 *  - Richer empty states with guidance text
 *  - Better living-will treatment preference layout
 *  - Review step with sectioned summary cards
 *  - Step counter in footer
 */

import {
  User,
  Users,
  Home,
  Briefcase,
  Heart,
  CheckCircle2,
  FileText,
  Shield,
  Activity,
  HandHeart,
  Stethoscope,
} from 'lucide-react';

// ── Extracted modules ──────────────────────────────────────────────
import type { WizardStep } from './WillDraftingTypes';
// Constants are now consumed by the extracted step components in ./will-steps/

// Re-export types for consumers that import from the main file

export function getWizardSteps(
  isLivingWill: boolean,
): { id: WizardStep; label: string; icon: React.ElementType; description: string }[] {
  return isLivingWill
    ? [
        {
          id: 'personal-details',
          label: 'Personal Details',
          icon: User,
          description: 'Testator identification and address',
        },
        {
          id: 'healthcare-agents',
          label: 'Healthcare Agents',
          icon: Shield,
          description: 'Appoint healthcare decision-makers',
        },
        {
          id: 'life-sustaining',
          label: 'Treatment',
          icon: Activity,
          description: 'Life-sustaining treatment preferences',
        },
        {
          id: 'pain-management',
          label: 'Pain Management',
          icon: Stethoscope,
          description: 'Comfort care and pain relief',
        },
        {
          id: 'organ-donation',
          label: 'Organ Donation',
          icon: HandHeart,
          description: 'Organ and tissue donation wishes',
        },
        {
          id: 'living-will-wishes',
          label: 'Final Wishes',
          icon: Heart,
          description: 'Funeral and end-of-life directives',
        },
        {
          id: 'review',
          label: 'Review',
          icon: CheckCircle2,
          description: 'Review and save the draft',
        },
      ]
    : [
        {
          id: 'personal-details',
          label: 'Personal Details',
          icon: User,
          description: 'Testator identification and address',
        },
        {
          id: 'executors',
          label: 'Executors',
          icon: Briefcase,
          description: 'Appoint estate administrators',
        },
        {
          id: 'beneficiaries',
          label: 'Beneficiaries',
          icon: Users,
          description: 'Designate heirs and their shares',
        },
        {
          id: 'guardians',
          label: 'Guardians',
          icon: Shield,
          description: 'Guardians for minor children',
        },
        {
          id: 'bequests',
          label: 'Bequests',
          icon: Home,
          description: 'Specific items to specific people',
        },
        {
          id: 'funeral-wishes',
          label: 'Final Wishes',
          icon: FileText,
          description: 'Funeral wishes and additional clauses',
        },
        {
          id: 'review',
          label: 'Review',
          icon: CheckCircle2,
          description: 'Review and save the draft',
        },
      ];
}
