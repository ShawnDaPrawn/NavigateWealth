/**
 * Risk assessment: per-question updates with derived scoring, and reset.
 *
 * Split out of `useProfileManager.ts` (1,126 lines), following the
 * clientProfile factory pattern: plain functions over the profile state —
 * no useState/useCallback/useEffect in this region, which is what makes
 * moving it out of the hook body legal. The hook still owns the state.
 */
import type { Dispatch, SetStateAction } from 'react';
import type { ProfileData } from '../../types';
import { calculateRiskAssessment } from '../../profileHandlers';

// ============================================================================
// Hook Input
// ============================================================================

interface Deps {
  setProfileData: Dispatch<SetStateAction<ProfileData>>;
  setAssessmentStarted: Dispatch<SetStateAction<boolean>>;
}

export function createRiskAssessmentHandlers({ setProfileData, setAssessmentStarted }: Deps) {
  const updateRiskQuestion = (questionNumber: number, score: number) => {
    setProfileData((prev) => {
      const updatedAssessment = { ...prev.riskAssessment, [`question${questionNumber}`]: score };
      const answers = [
        updatedAssessment.question1,
        updatedAssessment.question2,
        updatedAssessment.question3,
        updatedAssessment.question4,
        updatedAssessment.question5,
        updatedAssessment.question6,
        updatedAssessment.question7,
        updatedAssessment.question8,
        updatedAssessment.question9,
        updatedAssessment.question10,
      ];
      const derived = calculateRiskAssessment(answers);
      return {
        ...prev,
        riskAssessment: {
          ...updatedAssessment,
          ...derived,
        },
      };
    });
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
  };

  // ══════════════════════════════════════════════════════════════════
  // Identity Document Management
  //
  // Kept as manual handlers because:
  //  - add() takes a `type` parameter (not a simple factory)
  //  - save() has type-dependent validation
  //  - handleDocumentUpload is a complex async operation
  // ══════════════════════════════════════════════════════════════════

  return {
    updateRiskQuestion,
    resetRiskAssessment,
  };
}
