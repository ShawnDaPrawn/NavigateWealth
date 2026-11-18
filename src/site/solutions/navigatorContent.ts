/**
 * Navigator-only content for the Solutions pages: the audience switcher, and
 * the "How We Work" steps and FAQ the boards add (both from existing sources). Kept apart from
 * solutionsContent.ts so the live pages, which import that file, do not pull
 * any of this in.
 */
import faqData from '../../components/seo/faqs.json';
import { PROCESS_STEPS } from '../../components/pages/servicesPageData';

/** The audience switcher in the Navigator hero: the three Solutions routes. */
export const SOLUTION_AUDIENCES = [
  {
    id: 'individuals',
    label: 'For Individuals',
    note: 'Advice for every life stage.',
    path: '/solutions/individuals',
  },
  {
    id: 'businesses',
    label: 'For Businesses',
    note: 'Benefits and key-person cover.',
    path: '/solutions/businesses',
  },
  {
    id: 'advisers',
    label: 'For Advisers',
    note: 'Grow your practice with us.',
    path: '/solutions/advisers',
  },
] as const;

export type SolutionAudience = (typeof SOLUTION_AUDIENCES)[number]['id'];

/**
 * "How We Work" — the Services page's four steps (one source, shared with it),
 * which the Navigator boards place on every Solutions page.
 */
export const HOW_WE_WORK = {
  title: 'How We Work',
  lead: 'A simple, transparent process designed to put your financial goals at the centre of every decision.',
  steps: PROCESS_STEPS.map(({ title, description }) => ({ title, description, details: [] })),
};

export interface FaqEntry {
  question: string;
  answer: string;
}

/**
 * The site-wide questions from faqs.json (the single source the structured
 * data reads), in the order given. A question that has since been reworded
 * there is skipped rather than shown stale.
 */
export function pickCommonFaqs(questions: readonly string[]): FaqEntry[] {
  const common: FaqEntry[] = faqData.common;
  return questions
    .map((q) => common.find((f) => f.question === q))
    .filter((f): f is FaqEntry => f !== undefined);
}
