import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import { Badge } from '../../ui/badge';
import { Alert, AlertDescription } from '../../ui/alert';
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group';
import { Target, Sparkles, Info, Calendar, Download } from 'lucide-react';
import type { RiskAssessment } from '../modules/client-management/types';
import { PdfTemplateViewer } from '../modules/resources/PdfTemplateViewer';
import { RiskProfilePdfDocument } from './RiskProfilePdfDocument';
import {
  getRiskAssessmentClientName,
  getRiskCategorySummary,
  RISK_PROFILE_QUESTIONS,
} from './riskProfileContent';

interface ProfileDataForRisk {
  firstName?: string;
  lastName?: string;
  preferredName?: string;
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

const EMPTY_RISK_ASSESSMENT: RiskAssessment = {
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

function getInvestorTypeBadgeClass(riskCategory: string) {
  if (riskCategory === 'Conservative') return 'bg-blue-100 text-blue-800 hover:bg-blue-100';
  if (riskCategory === 'Moderate') return 'bg-amber-100 text-amber-800 hover:bg-amber-100';
  return 'bg-red-100 text-red-800 hover:bg-red-100';
}

export function RiskProfileSection({
  profileData,
  assessmentStarted,
  setAssessmentStarted,
  updateRiskQuestion,
  resetRiskAssessment,
  allQuestionsAnswered,
}: RiskProfileSectionProps) {
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const riskAssessment = profileData?.riskAssessment || EMPTY_RISK_ASSESSMENT;
  const clientName = getRiskAssessmentClientName(profileData);
  const assessmentComplete = allQuestionsAnswered();
  const categorySummary = getRiskCategorySummary(riskAssessment.riskCategory);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#6d28d9]/10">
              <Target className="h-5 w-5 text-[#6d28d9]" />
            </div>
            <div>
              <CardTitle>Risk Profile Assessment</CardTitle>
              <CardDescription>Complete the questionnaire to determine risk tolerance</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {!assessmentStarted && !assessmentComplete && (
            <div className="flex flex-col items-center justify-center px-4 py-12">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
                <Target className="h-10 w-10 text-gray-400" />
              </div>
              <h3 className="mb-2 text-lg text-gray-900">No risk assessment completed</h3>
              <p className="mb-6 max-w-md text-center text-sm text-gray-600">
                Complete the <span className="text-[#6d28d9]">questionnaire</span> to determine investor profile
              </p>
              <Button
                onClick={() => setAssessmentStarted(true)}
                className="bg-[#6d28d9] px-6 text-white hover:bg-[#5b21b6]"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Start Assessment
              </Button>
            </div>
          )}

          {assessmentStarted && !assessmentComplete && (
            <div className="contents">
              <Alert className="border-[#6d28d9]/20 bg-[#6d28d9]/5">
                <Info className="h-4 w-4 text-[#6d28d9]" />
                <AlertDescription>
                  Answer all 10 questions below to receive a personalized investor risk profile. The responses will help recommend suitable investment strategies.
                </AlertDescription>
              </Alert>

              {RISK_PROFILE_QUESTIONS.map((question) => {
                const selectedValue = riskAssessment[question.key];
                return (
                  <div key={question.key} className="space-y-4 rounded-lg border-2 border-gray-200 bg-white p-6">
                    <div>
                      <h4 className="mb-1 text-base text-gray-900">
                        {question.number}. {question.prompt}
                      </h4>
                      <p className="text-xs text-gray-500">{question.helperText}</p>
                    </div>

                    <RadioGroup
                      value={selectedValue === 0 ? '' : String(selectedValue)}
                      onValueChange={(value) => {
                        const numericValue = Number.parseInt(value, 10);
                        if (!Number.isFinite(numericValue)) return;
                        updateRiskQuestion(question.number, numericValue);
                      }}
                    >
                      {question.options.map((option) => {
                        const optionId = `${question.key}-opt${option.value}`;
                        return (
                          <div
                            key={optionId}
                            onClick={() => updateRiskQuestion(question.number, option.value)}
                            className="flex cursor-pointer items-center space-x-3 rounded-lg border border-transparent p-3 hover:border-gray-200 hover:bg-gray-50"
                          >
                            <RadioGroupItem value={String(option.value)} id={optionId} />
                            <Label htmlFor={optionId} className="flex-1 cursor-pointer">
                              {option.label}
                            </Label>
                          </div>
                        );
                      })}
                    </RadioGroup>
                  </div>
                );
              })}
            </div>
          )}

          {assessmentComplete && (
            <div className="contents">
              <div className="rounded-lg border-2 border-[#6d28d9]/30 bg-gradient-to-br from-[#6d28d9]/5 to-transparent p-6">
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="mb-1 text-lg text-gray-900">Risk Profile Results</h3>
                    <p className="text-sm text-gray-600">Based on the responses</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      onClick={() => setPdfPreviewOpen(true)}
                      size="sm"
                      className="bg-[#6d28d9] text-white hover:bg-[#5b21b6]"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Risk Portrait PDF
                    </Button>
                    <Button
                      onClick={resetRiskAssessment}
                      variant="outline"
                      size="sm"
                      className="border-[#6d28d9] text-[#6d28d9] hover:bg-[#6d28d9] hover:text-white"
                    >
                      Retake Assessment
                    </Button>
                  </div>
                </div>

                <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <p className="mb-1 text-sm text-gray-600">Total Score</p>
                    <p className="text-3xl text-[#6d28d9]">{riskAssessment.totalScore}/30</p>
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <p className="mb-1 text-sm text-gray-600">Investor Type</p>
                    <div className="flex items-center gap-2">
                      <Badge className={`px-3 py-1 text-base ${getInvestorTypeBadgeClass(riskAssessment.riskCategory)}`}>
                        {riskAssessment.riskCategory}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <h4 className="mb-2 text-sm text-gray-900">What This Means</h4>
                  <p className="text-sm text-gray-700">
                    <strong>{categorySummary?.label || 'Risk profile pending'}:</strong>{' '}
                    {categorySummary?.body || 'The assessment must be completed before a risk profile can be interpreted.'}
                  </p>
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

      <PdfTemplateViewer
        open={pdfPreviewOpen}
        onOpenChange={setPdfPreviewOpen}
        title={`Risk Portrait - ${clientName}`}
        pageSize="A4"
        orientation="portrait"
        renderPdfFromPreview={true}
      >
        <RiskProfilePdfDocument
          clientName={clientName}
          riskAssessment={riskAssessment}
        />
      </PdfTemplateViewer>
    </>
  );
}
