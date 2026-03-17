import React from 'react';
import type { ProfileData } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card';
import { Label } from '../../../ui/label';
import { Button } from '../../../ui/button';
import { Badge } from '../../../ui/badge';
import { Alert, AlertDescription } from '../../../ui/alert';
import { RadioGroup, RadioGroupItem } from '../../../ui/radio-group';
import { Target, Sparkles, Info, Calendar } from 'lucide-react';

interface RiskProfileSectionProps {
  profileData: ProfileData;
  assessmentStarted: boolean;
  setAssessmentStarted: React.Dispatch<React.SetStateAction<boolean>>;
  updateRiskQuestion: (questionNumber: number, score: number) => void;
  resetRiskAssessment: () => void;
  allQuestionsAnswered: () => boolean;
}

/** Single risk question component to reduce repetition */
function RiskQuestion({
  questionNumber, title, subtitle, options, value, onSelect,
}: {
  questionNumber: number;
  title: string;
  subtitle: string;
  options: { score: number; label: string }[];
  value: number;
  onSelect: (questionNumber: number, score: number) => void;
}) {
  return (
    <div className="p-6 border-2 border-gray-200 rounded-lg bg-white space-y-4">
      <div>
        <h4 className="text-base text-gray-900 mb-1">{questionNumber}. {title}</h4>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>
      <RadioGroup
        value={value === 0 ? '' : value.toString()}
        onValueChange={(v) => onSelect(questionNumber, parseInt(v))}
      >
        {options.map((opt) => (
          <div
            key={opt.score}
            onClick={() => onSelect(questionNumber, opt.score)}
            className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200"
          >
            <RadioGroupItem value={opt.score.toString()} id={`q${questionNumber}-opt${opt.score}`} />
            <Label htmlFor={`q${questionNumber}-opt${opt.score}`} className="cursor-pointer flex-1">{opt.label}</Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}

const RISK_QUESTIONS = [
  {
    questionNumber: 1,
    title: 'How long do you plan to keep your investment before needing to access it?',
    subtitle: 'Investment timeframe is important for risk assessment',
    options: [
      { score: 1, label: 'Less than 2 years' },
      { score: 2, label: '3–5 years' },
      { score: 3, label: 'More than 5 years' },
    ],
  },
  {
    questionNumber: 2,
    title: 'How would you react if your investment dropped by 10% in a month?',
    subtitle: 'Your reaction to market volatility',
    options: [
      { score: 1, label: 'Sell everything immediately' },
      { score: 2, label: 'Wait and see' },
      { score: 3, label: 'Buy more while prices are low' },
    ],
  },
  {
    questionNumber: 3,
    title: 'What is your primary investment goal?',
    subtitle: 'Understanding your investment objectives',
    options: [
      { score: 1, label: 'Capital preservation' },
      { score: 2, label: 'Balanced growth and income' },
      { score: 3, label: 'Maximum long-term growth' },
    ],
  },
  {
    questionNumber: 4,
    title: 'What portion of your monthly income are you willing to invest?',
    subtitle: 'Your investment capacity',
    options: [
      { score: 1, label: 'Less than 10%' },
      { score: 2, label: '10–25%' },
      { score: 3, label: 'More than 25%' },
    ],
  },
  {
    questionNumber: 5,
    title: 'How familiar are you with investments such as equities, bonds, or unit trusts?',
    subtitle: 'Your investment experience level',
    options: [
      { score: 1, label: 'Little to no experience' },
      { score: 2, label: 'Some experience' },
      { score: 3, label: 'Very experienced' },
    ],
  },
  {
    questionNumber: 6,
    title: 'Which statement best describes your attitude towards investment risk?',
    subtitle: 'Your risk appetite',
    options: [
      { score: 1, label: 'I prefer guaranteed returns, even if they are small' },
      { score: 2, label: "I'm comfortable with some ups and downs" },
      { score: 3, label: "I'm willing to take high risks for high returns" },
    ],
  },
  {
    questionNumber: 7,
    title: 'If you received an unexpected bonus, what would you most likely do?',
    subtitle: 'Your financial decision-making style',
    options: [
      { score: 1, label: 'Keep it in a savings account' },
      { score: 2, label: 'Invest part and save part' },
      { score: 3, label: 'Invest all of it in higher-return options' },
    ],
  },
  {
    questionNumber: 8,
    title: 'How dependent are you on the income from your investments?',
    subtitle: 'Your reliance on investment returns',
    options: [
      { score: 1, label: 'Fully dependent' },
      { score: 2, label: 'Somewhat dependent' },
      { score: 3, label: 'Not dependent' },
    ],
  },
  {
    questionNumber: 9,
    title: 'Which investment return range would you prefer?',
    subtitle: 'Your expected return expectations',
    options: [
      { score: 1, label: '4–6% with very low risk' },
      { score: 2, label: '6–10% with moderate risk' },
      { score: 3, label: '10%+ with high volatility' },
    ],
  },
  {
    questionNumber: 10,
    title: 'How important is liquidity (the ability to withdraw funds quickly) to you?',
    subtitle: 'Your need for quick access to funds',
    options: [
      { score: 1, label: 'Extremely important' },
      { score: 2, label: 'Somewhat important' },
      { score: 3, label: 'Not very important' },
    ],
  },
] as const;

export function RiskProfileSection({
  profileData,
  assessmentStarted,
  setAssessmentStarted,
  updateRiskQuestion,
  resetRiskAssessment,
  allQuestionsAnswered,
}: RiskProfileSectionProps) {
  const { riskAssessment } = profileData;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-[#6d28d9]/10 flex items-center justify-center">
            <Target className="h-5 w-5 text-[#6d28d9]" />
          </div>
          <div>
            <CardTitle>Risk Profile Assessment</CardTitle>
            <CardDescription>Complete the questionnaire to determine your risk tolerance</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Empty State */}
        {!assessmentStarted && !allQuestionsAnswered() && (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="h-20 w-20 rounded-full bg-gray-100 flex items-center justify-center mb-6">
              <Target className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-lg text-gray-900 mb-2">No risk assessment completed</h3>
            <p className="text-sm text-gray-600 text-center mb-6 max-w-md">
              Complete the <span className="text-[#6d28d9]">questionnaire</span> to determine your investor profile
            </p>
            <Button onClick={() => setAssessmentStarted(true)} className="bg-[#6d28d9] hover:bg-[#5b21b6] text-white px-6">
              <Sparkles className="h-4 w-4 mr-2" />Start Assessment
            </Button>
          </div>
        )}

        {/* Questionnaire */}
        {assessmentStarted && !allQuestionsAnswered() && (
          <div className="contents">
            <Alert className="bg-[#6d28d9]/5 border-[#6d28d9]/20">
              <Info className="h-4 w-4 text-[#6d28d9]" />
              <AlertDescription>
                Answer all 10 questions below to receive your personalized investor risk profile. Your responses will help us recommend suitable investment strategies.
              </AlertDescription>
            </Alert>

            {RISK_QUESTIONS.map((q) => (
              <RiskQuestion
                key={q.questionNumber}
                questionNumber={q.questionNumber}
                title={q.title}
                subtitle={q.subtitle}
                options={[...q.options]}
                value={(riskAssessment as Record<string, number>)[`question${q.questionNumber}`] || 0}
                onSelect={updateRiskQuestion}
              />
            ))}
          </div>
        )}

        {/* Results */}
        {allQuestionsAnswered() && (
          <div className="contents">
            <div className="p-6 rounded-lg border-2 bg-gradient-to-br from-[#6d28d9]/5 to-transparent border-[#6d28d9]/30">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg text-gray-900 mb-1">Your Risk Profile Results</h3>
                  <p className="text-sm text-gray-600">Based on your responses</p>
                </div>
                <Button onClick={resetRiskAssessment} variant="outline" size="sm" className="border-[#6d28d9] text-[#6d28d9] hover:bg-[#6d28d9] hover:text-white">
                  Retake Assessment
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="p-4 bg-white rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600 mb-1">Total Score</p>
                  <p className="text-3xl text-[#6d28d9]">{riskAssessment.totalScore}/30</p>
                </div>
                <div className="p-4 bg-white rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600 mb-1">Investor Type</p>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={`text-base px-3 py-1 ${
                        riskAssessment.riskCategory === 'Conservative'
                          ? 'bg-blue-100 text-blue-800 hover:bg-blue-100'
                          : riskAssessment.riskCategory === 'Moderate'
                          ? 'bg-amber-100 text-amber-800 hover:bg-amber-100'
                          : 'bg-red-100 text-red-800 hover:bg-red-100'
                      }`}
                    >
                      {riskAssessment.riskCategory}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Category Description */}
              <div className="p-4 bg-white rounded-lg border border-gray-200">
                <h4 className="text-sm text-gray-900 mb-2">What This Means</h4>
                {riskAssessment.riskCategory === 'Conservative' && (
                  <p className="text-sm text-gray-700">
                    <strong>Conservative Investor:</strong> You focus on capital protection and steady, reliable returns. You prefer low-risk assets such as fixed income, money markets, or capital-protected funds. You prioritise stability over growth and avoid volatility.
                  </p>
                )}
                {riskAssessment.riskCategory === 'Moderate' && (
                  <p className="text-sm text-gray-700">
                    <strong>Moderate Investor:</strong> You seek a balanced mix of growth and security, blending equities and bonds. You accept some short-term fluctuations for better medium-term returns, aiming to outpace inflation while managing downside risk.
                  </p>
                )}
                {riskAssessment.riskCategory === 'Aggressive' && (
                  <p className="text-sm text-gray-700">
                    <strong>Aggressive Investor:</strong> You are comfortable with high volatility and long-term investment horizons. You prioritise capital growth through equities, offshore exposure, and higher-risk instruments. You understand that higher risk can yield higher potential returns.
                  </p>
                )}
              </div>

              {riskAssessment.dateCompleted && (
                <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
                  <Calendar className="h-3 w-3" />
                  <span>Completed on {new Date(riskAssessment.dateCompleted).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
