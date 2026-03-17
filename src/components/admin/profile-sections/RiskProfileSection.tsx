import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import { Badge } from '../../ui/badge';
import { Alert, AlertDescription } from '../../ui/alert';
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group';
import { Target, Sparkles, Info, Calendar } from 'lucide-react';

interface RiskAssessment {
  question1: number;
  question2: number;
  question3: number;
  question4: number;
  question5: number;
  question6: number;
  question7: number;
  question8: number;
  question9: number;
  question10: number;
  totalScore: number;
  riskCategory: string;
  dateCompleted: string;
  canRetake: boolean;
}

interface ProfileDataForRisk {
  riskAssessment?: RiskAssessment;
}

interface RiskProfileSectionProps {
  profileData: ProfileDataForRisk;
  assessmentStarted: boolean;
  setAssessmentStarted: (value: boolean) => void;
  updateRiskQuestion: (questionNumber: number, score: number) => void;
  resetRiskAssessment: () => void;
  allQuestionsAnswered: () => boolean;
}

export function RiskProfileSection({
  profileData,
  assessmentStarted,
  setAssessmentStarted,
  updateRiskQuestion,
  resetRiskAssessment,
  allQuestionsAnswered
}: RiskProfileSectionProps) {
  // Extract riskAssessment from profileData with safe defaults
  const riskAssessment = profileData?.riskAssessment || {
    question1: 0,
    question2: 0,
    question3: 0,
    question4: 0,
    question5: 0,
    question6: 0,
    question7: 0,
    question8: 0,
    question9: 0,
    question10: 0,
    totalScore: 0,
    riskCategory: '',
    dateCompleted: '',
    canRetake: true,
  };
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-[#6d28d9]/10 flex items-center justify-center">
            <Target className="h-5 w-5 text-[#6d28d9]" />
          </div>
          <div>
            <CardTitle>Risk Profile Assessment</CardTitle>
            <CardDescription>Complete the questionnaire to determine risk tolerance</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Empty State - Show when assessment not started */}
        {!assessmentStarted && !allQuestionsAnswered() && (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="h-20 w-20 rounded-full bg-gray-100 flex items-center justify-center mb-6">
              <Target className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-lg text-gray-900 mb-2">No risk assessment completed</h3>
            <p className="text-sm text-gray-600 text-center mb-6 max-w-md">
              Complete the <span className="text-[#6d28d9]">questionnaire</span> to determine investor profile
            </p>
            <Button
              onClick={() => setAssessmentStarted(true)}
              className="bg-[#6d28d9] hover:bg-[#5b21b6] text-white px-6"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Start Assessment
            </Button>
          </div>
        )}

        {/* Questionnaire - Show when assessment started but not completed */}
        {assessmentStarted && !allQuestionsAnswered() && (
          <div className="contents">
            {/* Instructions */}
            <Alert className="bg-[#6d28d9]/5 border-[#6d28d9]/20">
              <Info className="h-4 w-4 text-[#6d28d9]" />
              <AlertDescription>
                Answer all 10 questions below to receive a personalized investor risk profile. The responses will help recommend suitable investment strategies.
              </AlertDescription>
            </Alert>

            {/* Question 1 */}
            <div className="p-6 border-2 border-gray-200 rounded-lg bg-white space-y-4">
              <div>
                <h4 className="text-base text-gray-900 mb-1">1. How long do you plan to keep your investment before needing to access it?</h4>
                <p className="text-xs text-gray-500">Investment timeframe is important for risk assessment</p>
              </div>
              <RadioGroup
                value={riskAssessment.question1 === 0 ? "" : riskAssessment.question1.toString()}
                onValueChange={(value) => updateRiskQuestion(1, parseInt(value))}
              >
                <div onClick={() => updateRiskQuestion(1, 1)} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200">
                  <RadioGroupItem value="1" id="q1-opt1" />
                  <Label htmlFor="q1-opt1" className="cursor-pointer flex-1">Less than 2 years</Label>
                </div>
                <div onClick={() => updateRiskQuestion(1, 2)} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200">
                  <RadioGroupItem value="2" id="q1-opt2" />
                  <Label htmlFor="q1-opt2" className="cursor-pointer flex-1">3–5 years</Label>
                </div>
                <div onClick={() => updateRiskQuestion(1, 3)} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200">
                  <RadioGroupItem value="3" id="q1-opt3" />
                  <Label htmlFor="q1-opt3" className="cursor-pointer flex-1">More than 5 years</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Question 2 */}
            <div className="p-6 border-2 border-gray-200 rounded-lg bg-white space-y-4">
              <div>
                <h4 className="text-base text-gray-900 mb-1">2. How would you react if your investment dropped by 10% in a month?</h4>
                <p className="text-xs text-gray-500">Your reaction to market volatility</p>
              </div>
              <RadioGroup
                value={riskAssessment.question2 === 0 ? "" : riskAssessment.question2.toString()}
                onValueChange={(value) => updateRiskQuestion(2, parseInt(value))}
              >
                <div onClick={() => updateRiskQuestion(2, 1)} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200">
                  <RadioGroupItem value="1" id="q2-opt1" />
                  <Label htmlFor="q2-opt1" className="cursor-pointer flex-1">Sell everything immediately</Label>
                </div>
                <div onClick={() => updateRiskQuestion(2, 2)} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200">
                  <RadioGroupItem value="2" id="q2-opt2" />
                  <Label htmlFor="q2-opt2" className="cursor-pointer flex-1">Wait and see</Label>
                </div>
                <div onClick={() => updateRiskQuestion(2, 3)} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200">
                  <RadioGroupItem value="3" id="q2-opt3" />
                  <Label htmlFor="q2-opt3" className="cursor-pointer flex-1">Buy more while prices are low</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Question 3 */}
            <div className="p-6 border-2 border-gray-200 rounded-lg bg-white space-y-4">
              <div>
                <h4 className="text-base text-gray-900 mb-1">3. What is your primary investment goal?</h4>
                <p className="text-xs text-gray-500">Understanding your investment objectives</p>
              </div>
              <RadioGroup
                value={riskAssessment.question3 === 0 ? "" : riskAssessment.question3.toString()}
                onValueChange={(value) => updateRiskQuestion(3, parseInt(value))}
              >
                <div onClick={() => updateRiskQuestion(3, 1)} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200">
                  <RadioGroupItem value="1" id="q3-opt1" />
                  <Label htmlFor="q3-opt1" className="cursor-pointer flex-1">Capital preservation</Label>
                </div>
                <div onClick={() => updateRiskQuestion(3, 2)} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200">
                  <RadioGroupItem value="2" id="q3-opt2" />
                  <Label htmlFor="q3-opt2" className="cursor-pointer flex-1">Balanced growth and income</Label>
                </div>
                <div onClick={() => updateRiskQuestion(3, 3)} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200">
                  <RadioGroupItem value="3" id="q3-opt3" />
                  <Label htmlFor="q3-opt3" className="cursor-pointer flex-1">Maximum long-term growth</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Question 4 */}
            <div className="p-6 border-2 border-gray-200 rounded-lg bg-white space-y-4">
              <div>
                <h4 className="text-base text-gray-900 mb-1">4. What portion of your monthly income are you willing to invest?</h4>
                <p className="text-xs text-gray-500">Your investment capacity</p>
              </div>
              <RadioGroup
                value={riskAssessment.question4 === 0 ? "" : riskAssessment.question4.toString()}
                onValueChange={(value) => updateRiskQuestion(4, parseInt(value))}
              >
                <div onClick={() => updateRiskQuestion(4, 1)} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200">
                  <RadioGroupItem value="1" id="q4-opt1" />
                  <Label htmlFor="q4-opt1" className="cursor-pointer flex-1">Less than 10%</Label>
                </div>
                <div onClick={() => updateRiskQuestion(4, 2)} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200">
                  <RadioGroupItem value="2" id="q4-opt2" />
                  <Label htmlFor="q4-opt2" className="cursor-pointer flex-1">10–25%</Label>
                </div>
                <div onClick={() => updateRiskQuestion(4, 3)} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200">
                  <RadioGroupItem value="3" id="q4-opt3" />
                  <Label htmlFor="q4-opt3" className="cursor-pointer flex-1">More than 25%</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Question 5 */}
            <div className="p-6 border-2 border-gray-200 rounded-lg bg-white space-y-4">
              <div>
                <h4 className="text-base text-gray-900 mb-1">5. How familiar are you with investments such as equities, bonds, or unit trusts?</h4>
                <p className="text-xs text-gray-500">Your investment experience level</p>
              </div>
              <RadioGroup
                value={riskAssessment.question5 === 0 ? "" : riskAssessment.question5.toString()}
                onValueChange={(value) => updateRiskQuestion(5, parseInt(value))}
              >
                <div onClick={() => updateRiskQuestion(5, 1)} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200">
                  <RadioGroupItem value="1" id="q5-opt1" />
                  <Label htmlFor="q5-opt1" className="cursor-pointer flex-1">Little to no experience</Label>
                </div>
                <div onClick={() => updateRiskQuestion(5, 2)} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200">
                  <RadioGroupItem value="2" id="q5-opt2" />
                  <Label htmlFor="q5-opt2" className="cursor-pointer flex-1">Some experience</Label>
                </div>
                <div onClick={() => updateRiskQuestion(5, 3)} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200">
                  <RadioGroupItem value="3" id="q5-opt3" />
                  <Label htmlFor="q5-opt3" className="cursor-pointer flex-1">Very experienced</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Question 6 */}
            <div className="p-6 border-2 border-gray-200 rounded-lg bg-white space-y-4">
              <div>
                <h4 className="text-base text-gray-900 mb-1">6. Which statement best describes your attitude towards investment risk?</h4>
                <p className="text-xs text-gray-500">Your risk appetite</p>
              </div>
              <RadioGroup
                value={riskAssessment.question6 === 0 ? "" : riskAssessment.question6.toString()}
                onValueChange={(value) => updateRiskQuestion(6, parseInt(value))}
              >
                <div onClick={() => updateRiskQuestion(6, 1)} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200">
                  <RadioGroupItem value="1" id="q6-opt1" />
                  <Label htmlFor="q6-opt1" className="cursor-pointer flex-1">I prefer guaranteed returns, even if they are small</Label>
                </div>
                <div onClick={() => updateRiskQuestion(6, 2)} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200">
                  <RadioGroupItem value="2" id="q6-opt2" />
                  <Label htmlFor="q6-opt2" className="cursor-pointer flex-1">I'm comfortable with some ups and downs</Label>
                </div>
                <div onClick={() => updateRiskQuestion(6, 3)} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200">
                  <RadioGroupItem value="3" id="q6-opt3" />
                  <Label htmlFor="q6-opt3" className="cursor-pointer flex-1">I'm willing to take high risks for high returns</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Question 7 */}
            <div className="p-6 border-2 border-gray-200 rounded-lg bg-white space-y-4">
              <div>
                <h4 className="text-base text-gray-900 mb-1">7. If you received an unexpected bonus, what would you most likely do?</h4>
                <p className="text-xs text-gray-500">Your financial decision-making style</p>
              </div>
              <RadioGroup
                value={riskAssessment.question7 === 0 ? "" : riskAssessment.question7.toString()}
                onValueChange={(value) => updateRiskQuestion(7, parseInt(value))}
              >
                <div onClick={() => updateRiskQuestion(7, 1)} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200">
                  <RadioGroupItem value="1" id="q7-opt1" />
                  <Label htmlFor="q7-opt1" className="cursor-pointer flex-1">Keep it in a savings account</Label>
                </div>
                <div onClick={() => updateRiskQuestion(7, 2)} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200">
                  <RadioGroupItem value="2" id="q7-opt2" />
                  <Label htmlFor="q7-opt2" className="cursor-pointer flex-1">Invest part and save part</Label>
                </div>
                <div onClick={() => updateRiskQuestion(7, 3)} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200">
                  <RadioGroupItem value="3" id="q7-opt3" />
                  <Label htmlFor="q7-opt3" className="cursor-pointer flex-1">Invest all of it in higher-return options</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Question 8 */}
            <div className="p-6 border-2 border-gray-200 rounded-lg bg-white space-y-4">
              <div>
                <h4 className="text-base text-gray-900 mb-1">8. How dependent are you on the income from your investments?</h4>
                <p className="text-xs text-gray-500">Your reliance on investment returns</p>
              </div>
              <RadioGroup
                value={riskAssessment.question8 === 0 ? "" : riskAssessment.question8.toString()}
                onValueChange={(value) => updateRiskQuestion(8, parseInt(value))}
              >
                <div onClick={() => updateRiskQuestion(8, 1)} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200">
                  <RadioGroupItem value="1" id="q8-opt1" />
                  <Label htmlFor="q8-opt1" className="cursor-pointer flex-1">Fully dependent</Label>
                </div>
                <div onClick={() => updateRiskQuestion(8, 2)} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200">
                  <RadioGroupItem value="2" id="q8-opt2" />
                  <Label htmlFor="q8-opt2" className="cursor-pointer flex-1">Somewhat dependent</Label>
                </div>
                <div onClick={() => updateRiskQuestion(8, 3)} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200">
                  <RadioGroupItem value="3" id="q8-opt3" />
                  <Label htmlFor="q8-opt3" className="cursor-pointer flex-1">Not dependent</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Question 9 */}
            <div className="p-6 border-2 border-gray-200 rounded-lg bg-white space-y-4">
              <div>
                <h4 className="text-base text-gray-900 mb-1">9. Which investment return range would you prefer?</h4>
                <p className="text-xs text-gray-500">Your expected return expectations</p>
              </div>
              <RadioGroup
                value={riskAssessment.question9 === 0 ? "" : riskAssessment.question9.toString()}
                onValueChange={(value) => updateRiskQuestion(9, parseInt(value))}
              >
                <div onClick={() => updateRiskQuestion(9, 1)} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200">
                  <RadioGroupItem value="1" id="q9-opt1" />
                  <Label htmlFor="q9-opt1" className="cursor-pointer flex-1">4–6% with very low risk</Label>
                </div>
                <div onClick={() => updateRiskQuestion(9, 2)} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200">
                  <RadioGroupItem value="2" id="q9-opt2" />
                  <Label htmlFor="q9-opt2" className="cursor-pointer flex-1">6–10% with moderate risk</Label>
                </div>
                <div onClick={() => updateRiskQuestion(9, 3)} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200">
                  <RadioGroupItem value="3" id="q9-opt3" />
                  <Label htmlFor="q9-opt3" className="cursor-pointer flex-1">10%+ with high volatility</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Question 10 */}
            <div className="p-6 border-2 border-gray-200 rounded-lg bg-white space-y-4">
              <div>
                <h4 className="text-base text-gray-900 mb-1">10. How important is liquidity (the ability to withdraw funds quickly) to you?</h4>
                <p className="text-xs text-gray-500">Your need for quick access to funds</p>
              </div>
              <RadioGroup
                value={riskAssessment.question10 === 0 ? "" : riskAssessment.question10.toString()}
                onValueChange={(value) => updateRiskQuestion(10, parseInt(value))}
              >
                <div onClick={() => updateRiskQuestion(10, 1)} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200">
                  <RadioGroupItem value="1" id="q10-opt1" />
                  <Label htmlFor="q10-opt1" className="cursor-pointer flex-1">Extremely important</Label>
                </div>
                <div onClick={() => updateRiskQuestion(10, 2)} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200">
                  <RadioGroupItem value="2" id="q10-opt2" />
                  <Label htmlFor="q10-opt2" className="cursor-pointer flex-1">Somewhat important</Label>
                </div>
                <div onClick={() => updateRiskQuestion(10, 3)} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200">
                  <RadioGroupItem value="3" id="q10-opt3" />
                  <Label htmlFor="q10-opt3" className="cursor-pointer flex-1">Not very important</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        )}

        {/* Results Display - Show only when assessment completed */}
        {allQuestionsAnswered() && (
          <div className="contents">
            <div className="p-6 rounded-lg border-2 bg-gradient-to-br from-[#6d28d9]/5 to-transparent border-[#6d28d9]/30">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg text-gray-900 mb-1">Risk Profile Results</h3>
                  <p className="text-sm text-gray-600">Based on the responses</p>
                </div>
                <Button
                  onClick={resetRiskAssessment}
                  variant="outline"
                  size="sm"
                  className="border-[#6d28d9] text-[#6d28d9] hover:bg-[#6d28d9] hover:text-white"
                >
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
                    <strong>Conservative Investor:</strong> Focuses on capital protection and steady, reliable returns. Prefers low-risk assets such as fixed income, money markets, or capital-protected funds. Prioritises stability over growth and avoids volatility.
                  </p>
                )}
                {riskAssessment.riskCategory === 'Moderate' && (
                  <p className="text-sm text-gray-700">
                    <strong>Moderate Investor:</strong> Seeks a balanced mix of growth and security, blending equities and bonds. Accepts some short-term fluctuations for better medium-term returns, aiming to outpace inflation while managing downside risk.
                  </p>
                )}
                {riskAssessment.riskCategory === 'Aggressive' && (
                  <p className="text-sm text-gray-700">
                    <strong>Aggressive Investor:</strong> Comfortable with high volatility and long-term investment horizons. Prioritises capital growth through equities, offshore exposure, and higher-risk instruments. Understands that higher risk can yield higher potential returns.
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