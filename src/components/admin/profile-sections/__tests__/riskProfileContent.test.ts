import { describe, expect, it } from 'vitest';
import {
  RISK_PROFILE_QUESTIONS,
  RISK_CATEGORY_SUMMARIES,
  getRiskCategorySummary,
  getSelectedRiskAnswerLabel,
  getRiskAssessmentClientName,
} from '../riskProfileContent';

describe('riskProfileContent', () => {
  it('RISK_PROFILE_QUESTIONS has 10 questions', () => {
    expect(RISK_PROFILE_QUESTIONS.length).toBe(10);
  });

  it('each question has number, key, prompt, helperText, and options', () => {
    RISK_PROFILE_QUESTIONS.forEach((q) => {
      expect(typeof q.number).toBe('number');
      expect(typeof q.key).toBe('string');
      expect(typeof q.prompt).toBe('string');
      expect(typeof q.helperText).toBe('string');
      expect(Array.isArray(q.options)).toBe(true);
      expect(q.options.length).toBeGreaterThan(0);
    });
  });

  it('each option has value (1-3) and label', () => {
    RISK_PROFILE_QUESTIONS.forEach((q) => {
      q.options.forEach((opt) => {
        expect([1, 2, 3]).toContain(opt.value);
        expect(typeof opt.label).toBe('string');
      });
    });
  });

  it('RISK_CATEGORY_SUMMARIES has Conservative, Moderate, and Aggressive', () => {
    const labels = RISK_CATEGORY_SUMMARIES.map((s) => s.label);
    expect(labels).toContain('Conservative');
    expect(labels).toContain('Moderate');
    expect(labels).toContain('Aggressive');
  });

  it('getRiskCategorySummary returns the correct summary', () => {
    const result = getRiskCategorySummary('Conservative');
    expect(result).not.toBeNull();
    expect(result!.label).toBe('Conservative');
    expect(typeof result!.body).toBe('string');
  });

  it('getRiskCategorySummary returns null for unknown category', () => {
    expect(getRiskCategorySummary('Unknown')).toBeNull();
  });

  it('getSelectedRiskAnswerLabel returns label when answered', () => {
    const question = RISK_PROFILE_QUESTIONS[0];
    const assessment = { [question.key]: question.options[0].value } as never;
    const label = getSelectedRiskAnswerLabel(assessment, question);
    expect(label).toBe(question.options[0].label);
  });

  it('getSelectedRiskAnswerLabel returns Not answered for unanswered question', () => {
    const question = RISK_PROFILE_QUESTIONS[0];
    const assessment = {} as never;
    const label = getSelectedRiskAnswerLabel(assessment, question);
    expect(label).toBe('Not answered');
  });

  it('getRiskAssessmentClientName uses preferredName first', () => {
    expect(
      getRiskAssessmentClientName({
        preferredName: 'Nick',
        firstName: 'Nicholas',
        lastName: 'Smith',
      }),
    ).toBe('Nick');
  });

  it('getRiskAssessmentClientName falls back to firstName + lastName', () => {
    expect(getRiskAssessmentClientName({ firstName: 'Jane', lastName: 'Doe' })).toBe('Jane Doe');
  });

  it('getRiskAssessmentClientName falls back to Client when all empty', () => {
    expect(getRiskAssessmentClientName({})).toBe('Client');
  });
});
