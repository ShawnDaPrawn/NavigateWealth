import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RiskProfileSection } from '../RiskProfileSection';
import type { RiskAssessment } from '../../modules/client-management/types';

function buildRiskAssessment(overrides: Partial<RiskAssessment> = {}): RiskAssessment {
  return {
    question1: 3,
    question2: 2,
    question3: 2,
    question4: 2,
    question5: 3,
    question6: 2,
    question7: 2,
    question8: 2,
    question9: 2,
    question10: 2,
    totalScore: 22,
    riskCategory: 'Moderate',
    dateCompleted: '2026-05-13T10:15:00.000Z',
    canRetake: true,
    ...overrides,
  };
}

describe('RiskProfileSection', () => {
  it('shows the PDF action only when the assessment is complete', () => {
    const { rerender } = render(
      <RiskProfileSection
        profileData={{
          firstName: 'Jane',
          lastName: 'Doe',
          riskAssessment: buildRiskAssessment({
            question10: 0,
            totalScore: 20,
            riskCategory: '',
            dateCompleted: '',
          }),
        }}
        assessmentStarted={true}
        setAssessmentStarted={vi.fn()}
        updateRiskQuestion={vi.fn()}
        resetRiskAssessment={vi.fn()}
        allQuestionsAnswered={() => false}
      />,
    );

    expect(screen.queryByRole('button', { name: /risk portrait pdf/i })).toBeNull();

    rerender(
      <RiskProfileSection
        profileData={{ firstName: 'Jane', lastName: 'Doe', riskAssessment: buildRiskAssessment() }}
        assessmentStarted={true}
        setAssessmentStarted={vi.fn()}
        updateRiskQuestion={vi.fn()}
        resetRiskAssessment={vi.fn()}
        allQuestionsAnswered={() => true}
      />,
    );

    expect(screen.getByRole('button', { name: /risk portrait pdf/i })).not.toBeNull();
  });

  it('opens the branded preview when the PDF action is clicked', () => {
    render(
      <RiskProfileSection
        profileData={{ firstName: 'Jane', lastName: 'Doe', riskAssessment: buildRiskAssessment() }}
        assessmentStarted={true}
        setAssessmentStarted={vi.fn()}
        updateRiskQuestion={vi.fn()}
        resetRiskAssessment={vi.fn()}
        allQuestionsAnswered={() => true}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /risk portrait pdf/i }));

    expect(screen.getByText('Client Risk Portrait')).not.toBeNull();
    expect(screen.getByRole('button', { name: /download pdf/i })).not.toBeNull();
  });
});
