/**
 * The risk assessment questionnaire.
 *
 * Split out of `useClientProfile.ts` (1,523 lines), where nine collection
 * editors shared one hook body. These are plain functions over the profile
 * state, not hooks — the region contains no `useState`, `useCallback` or
 * `useEffect`, which is what makes moving it out of the hook body legal.
 *
 * The hook still owns the state; this owns the operations on one slice of it.
 */
import type { Dispatch, SetStateAction } from 'react';
import { ProfileData } from '../../types';

interface Deps {
  setAssessmentStarted: Dispatch<SetStateAction<boolean>>;
  setHasChanges: Dispatch<SetStateAction<boolean>>;
  setProfileData: Dispatch<SetStateAction<ProfileData>>;
}

export function createRiskAssessmentHandlers({
  setAssessmentStarted,
  setHasChanges,
  setProfileData,
}: Deps) {
  const updateRiskQuestion = (questionNumber: number, score: number) => {
    setProfileData((prev) => {
      const updatedAssessment = {
        ...prev.riskAssessment,
        [`question${questionNumber}`]: score,
      };

      // Calculate total score
      const totalScore =
        updatedAssessment.question1 +
        updatedAssessment.question2 +
        updatedAssessment.question3 +
        updatedAssessment.question4 +
        updatedAssessment.question5 +
        updatedAssessment.question6 +
        updatedAssessment.question7 +
        updatedAssessment.question8 +
        updatedAssessment.question9 +
        updatedAssessment.question10;

      // Check if all questions are answered
      const allAnswered =
        updatedAssessment.question1 > 0 &&
        updatedAssessment.question2 > 0 &&
        updatedAssessment.question3 > 0 &&
        updatedAssessment.question4 > 0 &&
        updatedAssessment.question5 > 0 &&
        updatedAssessment.question6 > 0 &&
        updatedAssessment.question7 > 0 &&
        updatedAssessment.question8 > 0 &&
        updatedAssessment.question9 > 0 &&
        updatedAssessment.question10 > 0;

      // Determine risk category (only if all questions answered)
      let riskCategory = '';
      if (allAnswered) {
        if (totalScore >= 10 && totalScore <= 15) {
          riskCategory = 'Conservative';
        } else if (totalScore >= 16 && totalScore <= 22) {
          riskCategory = 'Moderate';
        } else if (totalScore >= 23 && totalScore <= 30) {
          riskCategory = 'Aggressive';
        }
      }

      return {
        ...prev,
        riskAssessment: {
          ...updatedAssessment,
          totalScore,
          riskCategory,
          dateCompleted: allAnswered ? new Date().toISOString() : '',
          canRetake: allAnswered,
        },
      };
    });
    setHasChanges(true);
  };

  const resetRiskAssessment = () => {
    setProfileData((prev) => ({
      ...prev,
      riskAssessment: {
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
      },
    }));
    setAssessmentStarted(false);
    setHasChanges(true);
  };

  return {
    updateRiskQuestion,
    resetRiskAssessment,
  };
}
