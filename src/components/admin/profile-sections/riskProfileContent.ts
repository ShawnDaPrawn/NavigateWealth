import type { RiskAssessment } from '../modules/client-management/types';

type RiskQuestionNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type RiskQuestionKey = `question${RiskQuestionNumber}`;

export interface RiskQuestionOption {
  value: 1 | 2 | 3;
  label: string;
}

export interface RiskQuestionDefinition {
  number: RiskQuestionNumber;
  key: RiskQuestionKey;
  prompt: string;
  helperText: string;
  options: readonly RiskQuestionOption[];
}

export interface RiskCategorySummary {
  label: 'Conservative' | 'Moderate' | 'Aggressive';
  scoreRange: string;
  body: string;
}

export const RISK_PROFILE_QUESTIONS: readonly RiskQuestionDefinition[] = [
  {
    number: 1,
    key: 'question1',
    prompt: 'How long do you plan to keep your investment before needing to access it?',
    helperText: 'Investment timeframe is important for risk assessment',
    options: [
      { value: 1, label: 'Less than 2 years' },
      { value: 2, label: '3-5 years' },
      { value: 3, label: 'More than 5 years' },
    ],
  },
  {
    number: 2,
    key: 'question2',
    prompt: 'How would you react if your investment dropped by 10% in a month?',
    helperText: 'Your reaction to market volatility',
    options: [
      { value: 1, label: 'Sell everything immediately' },
      { value: 2, label: 'Wait and see' },
      { value: 3, label: 'Buy more while prices are low' },
    ],
  },
  {
    number: 3,
    key: 'question3',
    prompt: 'What is your primary investment goal?',
    helperText: 'Understanding your investment objectives',
    options: [
      { value: 1, label: 'Capital preservation' },
      { value: 2, label: 'Balanced growth and income' },
      { value: 3, label: 'Maximum long-term growth' },
    ],
  },
  {
    number: 4,
    key: 'question4',
    prompt: 'What portion of your monthly income are you willing to invest?',
    helperText: 'Your investment capacity',
    options: [
      { value: 1, label: 'Less than 10%' },
      { value: 2, label: '10-25%' },
      { value: 3, label: 'More than 25%' },
    ],
  },
  {
    number: 5,
    key: 'question5',
    prompt: 'How familiar are you with investments such as equities, bonds, or unit trusts?',
    helperText: 'Your investment experience level',
    options: [
      { value: 1, label: 'Little to no experience' },
      { value: 2, label: 'Some experience' },
      { value: 3, label: 'Very experienced' },
    ],
  },
  {
    number: 6,
    key: 'question6',
    prompt: 'Which statement best describes your attitude towards investment risk?',
    helperText: 'Your risk appetite',
    options: [
      { value: 1, label: 'I prefer guaranteed returns, even if they are small' },
      { value: 2, label: "I'm comfortable with some ups and downs" },
      { value: 3, label: "I'm willing to take high risks for high returns" },
    ],
  },
  {
    number: 7,
    key: 'question7',
    prompt: 'How important is it for your investment to outpace inflation over time?',
    helperText: 'Your long-term growth expectations',
    options: [
      { value: 1, label: 'Not very important' },
      { value: 2, label: 'Somewhat important' },
      { value: 3, label: 'Extremely important' },
    ],
  },
  {
    number: 8,
    key: 'question8',
    prompt: 'If given the choice, which portfolio would you prefer?',
    helperText: 'Your preferred investment strategy',
    options: [
      { value: 1, label: 'Low return, very stable' },
      { value: 2, label: 'Moderate return, moderate stability' },
      { value: 3, label: 'High return, more volatile' },
    ],
  },
  {
    number: 9,
    key: 'question9',
    prompt: 'How likely are you to monitor or adjust your investment strategy regularly?',
    helperText: 'Your involvement in portfolio management',
    options: [
      { value: 1, label: 'Rarely' },
      { value: 2, label: 'Occasionally' },
      { value: 3, label: 'Frequently' },
    ],
  },
  {
    number: 10,
    key: 'question10',
    prompt: 'How important is potential high growth compared to avoiding losses?',
    helperText: 'Your growth-versus-protection preference',
    options: [
      { value: 1, label: 'Avoiding losses is more important' },
      { value: 2, label: 'A balance of both is important' },
      { value: 3, label: 'Potential high growth is more important' },
    ],
  },
] as const;

export const RISK_CATEGORY_SUMMARIES: readonly RiskCategorySummary[] = [
  {
    label: 'Conservative',
    scoreRange: '10-15',
    body: 'Focuses on capital protection and steady, reliable returns. Prefers low-risk assets such as fixed income, money markets, or capital-protected funds. Prioritises stability over growth and avoids volatility.',
  },
  {
    label: 'Moderate',
    scoreRange: '16-22',
    body: 'Seeks a balanced mix of growth and security, blending equities and bonds. Accepts some short-term fluctuations for better medium-term returns while managing downside risk.',
  },
  {
    label: 'Aggressive',
    scoreRange: '23-30',
    body: 'Comfortable with high volatility and longer horizons. Prioritises capital growth through equities, offshore exposure, and higher-risk instruments in pursuit of stronger long-term returns.',
  },
] as const;

export function getRiskCategorySummary(category: string): RiskCategorySummary | null {
  return RISK_CATEGORY_SUMMARIES.find((entry) => entry.label === category) ?? null;
}

export function getSelectedRiskAnswerLabel(
  riskAssessment: RiskAssessment,
  question: RiskQuestionDefinition,
): string {
  const selected = question.options.find((option) => option.value === riskAssessment[question.key]);
  return selected?.label || 'Not answered';
}

export function getRiskAssessmentClientName(profileData: {
  preferredName?: string;
  firstName?: string;
  lastName?: string;
}): string {
  const preferred = String(profileData.preferredName || '').trim();
  const fullName = [profileData.firstName, profileData.lastName]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' ');

  return preferred || fullName || 'Client';
}
