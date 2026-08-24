/**
 * Priority-ordered action items, and their distribution by priority.
 *
 * Split out of `clientOverviewUtils.ts` (1,650 lines), itself an earlier
 * extraction from `ClientOverviewTab.tsx`. Pure functions — no React, no
 * hooks, no I/O.
 */
import type { ElementType } from 'react';
import type { ActionDistribution } from '../overview/OverviewCharts';
import { daysBetween, fmtDate, isPast, nextAnniversary } from './format';
import type { GapItem } from './gapAnalysis';
import type { Policy } from './policyFields';

export type ActionPriority = 'urgent' | 'attention' | 'recommended';

export interface ActionItem {
  id: string;
  priority: ActionPriority;
  category: 'fna' | 'coverage' | 'renewal' | 'profile' | 'compliance';
  title: string;
  detail?: string;
  icon: ElementType;
}

const INCEPTION_FIELD_IDS = [
  // keyIds (keyManagerConstants.ts)
  'risk_date_of_inception',
  'medical_aid_date_of_inception',
  'retirement_date_of_inception',
  'post_retirement_date_of_inception',
  'invest_date_of_inception',
  'invest_guaranteed_date_of_inception',
  'eb_date_of_inception',
  'eb_risk_date_of_inception',
  'eb_retirement_date_of_inception',
  'estate_date_of_inception',
  // Schema field IDs (default-schemas.ts)
  'rp_inception',
  'ma_inception',
  'ret_inception',
  'ret_pre_inception',
  'ret_post_inception',
  'inv_inception',
  'inv_vol_inception',
  'inv_gua_inception',
  'eb_inception',
  'eb_risk_inception',
  'eb_ret_inception',
  'est_inception',
];

/** Renewal warning window in days */
const RENEWAL_WINDOW_DAYS = 90;

export interface ActionItemIcons {
  ClipboardCheck: ElementType;
  PlayCircle: ElementType;
  Clock: ElementType;
  FileText: ElementType;
  Shield: ElementType;
  AlertTriangle: ElementType;
  Calendar: ElementType;
  DollarSign: ElementType;
  Phone: ElementType;
  Users: ElementType;
  Scale: ElementType;
}

export interface ActionItemsInputs {
  fnaStatuses: ReadonlyArray<{
    loading?: boolean;
    nextReviewDue?: string | null;
    key: string;
    name: string;
    status?: string;
  }>;
  gapAnalysis: GapItem[];
  allPolicies: Policy[];
  grossMonthly: number;
  profile:
    | {
        emergencyContactName?: unknown;
        taxNumber?: unknown;
        familyMembers?: unknown[];
        assets?: unknown[];
        liabilities?: unknown[];
      }
    | null
    | undefined;
  dependants: ReadonlyArray<unknown>;
  isClient: boolean;
  icons: ActionItemIcons;
}

/**
 * Derive the priority-ordered action centre (FNA prompts, coverage gaps, policy
 * renewals, profile/compliance nudges) for adviser or client mode. Pure: same
 * inputs -> same ActionItem[]. Lifted verbatim from ClientOverviewTab; lucide
 * icons are threaded in as data so this stays runtime-React-free.
 */
export function deriveActionItems(inputs: ActionItemsInputs): ActionItem[] {
  const {
    fnaStatuses,
    gapAnalysis,
    allPolicies,
    grossMonthly,
    profile: p,
    dependants,
    isClient,
    icons,
  } = inputs;
  const {
    ClipboardCheck,
    PlayCircle,
    Clock,
    FileText,
    Shield,
    AlertTriangle,
    Calendar,
    DollarSign,
    Phone,
    Users,
    Scale,
  } = icons;
  const items: ActionItem[] = [];

  // --- FNA-derived items ---
  fnaStatuses.forEach((fna) => {
    if (fna.loading) return;

    if (fna.nextReviewDue && isPast(fna.nextReviewDue)) {
      items.push({
        id: `fna-overdue-${fna.key}`,
        priority: 'urgent',
        category: 'fna',
        title: isClient
          ? fna.status === 'published'
            ? `Time to refresh your ${fna.name}`
            : `Your ${fna.name} is overdue for a check-up`
          : `${fna.name} — review overdue`,
        detail: isClient
          ? fna.status === 'published'
            ? `Your last review was due ${fmtDate(fna.nextReviewDue)}. Update your facts and resubmit so your adviser can republish.`
            : `This was due for review on ${fmtDate(fna.nextReviewDue)}. Get in touch with your adviser to book a fresh one.`
          : `Was due ${fmtDate(fna.nextReviewDue)}. Book a new review to make sure the recommendations still hold.`,
        icon: ClipboardCheck,
      });
    }

    if (fna.status === 'client_draft') {
      items.push({
        id: `fna-client-draft-${fna.key}`,
        priority: 'attention',
        category: 'fna',
        title: isClient ? `Continue your ${fna.name}` : `${fna.name} — client draft in progress`,
        detail: isClient
          ? 'You started this discovery — pick up where you left off and submit when ready.'
          : 'Client has started intake but not submitted yet.',
        icon: PlayCircle,
      });
    }

    if (fna.status === 'submitted') {
      items.push({
        id: `fna-submitted-${fna.key}`,
        priority: isClient ? 'recommended' : 'attention',
        category: 'fna',
        title: isClient
          ? `${fna.name} is with your adviser`
          : `${fna.name} — intake in review queue`,
        detail: isClient
          ? 'Submitted for review — not advice until your adviser publishes the formal analysis.'
          : 'Client submitted intake. Accept from the intake queue to continue at Step 2.',
        icon: Clock,
      });
    }

    if (fna.status === 'draft') {
      items.push({
        id: `fna-draft-${fna.key}`,
        priority: 'attention',
        category: 'fna',
        title: isClient ? `Your ${fna.name} is being worked on` : `${fna.name} — draft in progress`,
        detail: isClient
          ? "Your adviser is putting this together. You'll be able to see it once it's ready."
          : 'Finish this up and publish it so the client can see the results.',
        icon: FileText,
      });
    }

    if (fna.status === 'not_started') {
      items.push({
        id: `fna-missing-${fna.key}`,
        priority: 'recommended',
        category: 'fna',
        title: isClient ? `Start your ${fna.name}` : `Start a ${fna.name}`,
        detail: isClient
          ? 'You prepare. We analyse. Together we plan — begin your financial discovery here.'
          : 'No review on file. Worth kicking one off at the next meeting.',
        icon: ClipboardCheck,
      });
    }
  });

  // --- Coverage gap items (friendly, natural language) ---
  gapAnalysis.forEach((gap) => {
    if (gap.status === 'gap') {
      const isCritical = ['Life Cover', 'Disability Cover', 'Income Protection'].includes(
        gap.label,
      );
      items.push({
        id: `gap-${gap.label.toLowerCase().replace(/\s+/g, '-')}`,
        priority: isCritical ? 'urgent' : 'attention',
        category: 'coverage',
        title: isClient
          ? `Your ${gap.label.toLowerCase()} needs topping up`
          : `${gap.label} — falling short`,
        detail: isClient
          ? `Right now you have ${gap.current} in ${gap.label.toLowerCase()}. A bit more cover would go a long way toward protecting you and your family.`
          : `Sitting at ${gap.current} against a recommendation of ${gap.recommended}. Flag this at the next review.`,
        icon: Shield,
      });
    } else if (gap.status === 'caution') {
      items.push({
        id: `gap-caution-${gap.label.toLowerCase().replace(/\s+/g, '-')}`,
        priority: 'attention',
        category: 'coverage',
        title: isClient ? `${gap.label} — almost there` : `${gap.label} — nearly on target`,
        detail: isClient
          ? `Your ${gap.label.toLowerCase()} is close to where it should be. A small tweak could get it just right.`
          : `At ${gap.current}. ${gap.detail || 'Just under the recommendation — probably fine, but worth a quick check next time.'}`,
        icon: AlertTriangle,
      });
    }
  });

  // --- Policy renewal items ---
  allPolicies.forEach((pol) => {
    let inceptionDateStr: string | null = null;
    for (const fieldId of INCEPTION_FIELD_IDS) {
      const val = pol.data?.[fieldId];
      if (val && typeof val === 'string') {
        const dt = new Date(val);
        if (!isNaN(dt.getTime())) {
          inceptionDateStr = val;
          break;
        }
      }
    }

    if (!inceptionDateStr) {
      for (const [key, val] of Object.entries(pol.data || {})) {
        if (key.toLowerCase().includes('inception') && typeof val === 'string') {
          const dt = new Date(val);
          if (!isNaN(dt.getTime())) {
            inceptionDateStr = val;
            break;
          }
        }
      }
    }

    if (inceptionDateStr) {
      const anniversary = nextAnniversary(inceptionDateStr);
      if (anniversary) {
        const daysUntil = daysBetween(new Date(), anniversary);
        if (daysUntil >= 0 && daysUntil <= RENEWAL_WINDOW_DAYS) {
          items.push({
            id: `renewal-${pol.id}`,
            priority: daysUntil <= 14 ? 'urgent' : 'attention',
            category: 'renewal',
            title: isClient
              ? `Your ${pol.providerName} policy is up for renewal soon`
              : `${pol.providerName} — renewal coming up`,
            detail: isClient
              ? `Renews on ${fmtDate(anniversary.toISOString())} (${daysUntil === 0 ? 'today' : `${daysUntil} days away`}). Your adviser might get in touch to go over it.`
              : `Due ${fmtDate(anniversary.toISOString())} (${daysUntil === 0 ? 'today' : `${daysUntil} days away`}). Good time to check the terms and premiums.`,
            icon: Calendar,
          });
        }
      }
    }
  });

  // --- Profile completeness items ---
  if (grossMonthly === 0) {
    items.push({
      id: 'profile-income-missing',
      priority: 'attention',
      category: 'profile',
      title: isClient ? 'We need your income details' : 'Income info is missing',
      detail: isClient
        ? 'Knowing your income lets us give you much more accurate recommendations and savings targets.'
        : "Can't calculate savings rates, gap analysis, or run FNAs properly without income on file.",
      icon: DollarSign,
    });
  }

  if (!p?.emergencyContactName) {
    items.push({
      id: 'profile-emergency-contact',
      priority: 'recommended',
      category: 'profile',
      title: isClient ? 'Add an emergency contact' : 'No emergency contact on file',
      detail: isClient
        ? 'Having someone we can reach in an emergency gives you extra peace of mind.'
        : 'Pop an emergency contact into Personal Details — good practice and covers duty of care.',
      icon: Phone,
    });
  }

  if (!p?.taxNumber) {
    items.push({
      id: 'profile-tax-number',
      priority: 'recommended',
      category: 'profile',
      title: isClient ? 'Add your tax reference number' : 'Tax number is missing',
      detail: isClient
        ? 'We need this for tax planning and to keep everything above board with SARS.'
        : 'Needed for tax planning and SARS compliance. Ask the client for it at the next touchpoint.',
      icon: FileText,
    });
  }

  if ((p?.familyMembers || []).length === 0 && dependants.length === 0) {
    items.push({
      id: 'profile-dependants',
      priority: 'recommended',
      category: 'profile',
      title: isClient ? 'Tell us about your family' : 'No family or dependants on record',
      detail: isClient
        ? 'Adding your family helps your adviser work out the right life cover and estate plan for you.'
        : "Can't size life cover, income protection, or estate plans without knowing the family picture.",
      icon: Users,
    });
  }

  // --- Compliance items (adviser-only) ---
  if (!isClient && (p?.assets || []).length === 0 && (p?.liabilities || []).length === 0) {
    items.push({
      id: 'compliance-balance-sheet',
      priority: 'recommended',
      category: 'compliance',
      title: 'No balance sheet on file',
      detail:
        'Worth capturing assets and liabilities — makes net worth tracking and financial planning much stronger.',
      icon: Scale,
    });
  }

  // Sort: urgent first, then attention, then recommended
  const priorityOrder: Record<ActionPriority, number> = {
    urgent: 0,
    attention: 1,
    recommended: 2,
  };
  items.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return items;
}

export function deriveActionDistribution(actionItems: ActionItem[]): ActionDistribution {
  const dist: ActionDistribution = { urgent: 0, attention: 0, recommended: 0, monitoring: 0 };
  actionItems.forEach((item) => {
    if (item.priority in dist) {
      dist[item.priority as keyof ActionDistribution]++;
    }
  });
  return dist;
}
