/**
 * The four steps of the advice process, as the public site describes them.
 *
 * One copy, read by the Services page and the home page in both designs, so
 * the steps cannot drift apart. Icons are a presentation choice and stay with
 * each page.
 */
export interface AdviceStep {
  step: string;
  title: string;
  description: string;
}

export const ADVICE_PROCESS: readonly AdviceStep[] = [
  {
    step: '01',
    title: 'Discovery',
    description:
      'We learn about your goals, timeline, risk tolerance, and current financial situation through a no-obligation consultation.',
  },
  {
    step: '02',
    title: 'Analysis',
    description:
      'We conduct a comprehensive financial needs analysis and develop a customised strategy tailored to your needs.',
  },
  {
    step: '03',
    title: 'Implementation',
    description:
      'We compare products across the providers we work with and implement your financial plan with complete transparency.',
  },
  {
    step: '04',
    title: 'Ongoing Support',
    description:
      'Continuous portfolio management, annual reviews, and planning updates to keep you on track as your life evolves.',
  },
];
