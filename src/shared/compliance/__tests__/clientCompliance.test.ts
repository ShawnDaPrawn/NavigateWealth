import { describe, expect, it } from 'vitest';
import {
  CLIENT_COMPLIANCE_SCHEMA_VERSION,
  addMonthsIso,
  complianceIndicators,
  emptyComplianceDeclarations,
  emptyComplianceReview,
  isPepExposed,
  legacyConsentEvidence,
  normalizeComplianceDeclarations,
  normalizeComplianceReview,
  outstandingDeclarations,
  suggestNextKycReviewDate,
  type ComplianceDeclarations,
} from '../clientCompliance';

/** A client who has answered everything, with nothing to flag. */
function completeDeclarations(): ComplianceDeclarations {
  const d = emptyComplianceDeclarations();
  return {
    ...d,
    isPep: 'no',
    isPepRelated: 'no',
    sourceOfFunds: ['salary'],
    sourceOfWealth: ['employment'],
    taxResidencies: [
      { id: 't1', country: 'South Africa', taxNumber: '0123456789', noTaxNumberReason: '' },
    ],
    isUsPerson: 'no',
    consents: {
      ...d.consents,
      dataProcessing: { status: 'granted', recordedAt: '2026-11-01T10:00:00.000Z' },
      providerSharing: { status: 'granted', recordedAt: '2026-11-01T10:00:00.000Z' },
    },
  };
}

describe('normalizeComplianceDeclarations', () => {
  it('reads nothing as a complete, unanswered version-1 record', () => {
    expect(normalizeComplianceDeclarations(undefined)).toEqual(emptyComplianceDeclarations());
    expect(normalizeComplianceDeclarations('garbage').schemaVersion).toBe(
      CLIENT_COMPLIANCE_SCHEMA_VERSION,
    );
  });

  it('keeps valid answers and drops values it does not recognise', () => {
    const d = normalizeComplianceDeclarations({
      isPep: 'yes',
      pepCategory: 'martian',
      sourceOfFunds: ['salary', 42],
      taxResidencies: [{ country: 'UK', noTaxNumberReason: 'pending' }],
      consents: { marketing: { status: 'granted', recordedAt: 'x' }, providerSharing: 'yes' },
    });
    expect(d.isPep).toBe('yes');
    expect(d.pepCategory).toBe('');
    expect(d.sourceOfFunds).toEqual(['salary']);
    expect(d.taxResidencies).toEqual([
      { id: 'tax-residency-1', country: 'UK', taxNumber: '', noTaxNumberReason: 'pending' },
    ]);
    expect(d.consents.marketing).toEqual({ status: 'granted', recordedAt: 'x' });
    expect(d.consents.providerSharing).toEqual({ status: '', recordedAt: '' });
    expect(d.consents.electronicDelivery).toEqual({ status: '', recordedAt: '' });
  });
});

describe('normalizeComplianceReview', () => {
  it('fills a partial record and rejects unknown ratings', () => {
    const r = normalizeComplianceReview({ riskRating: 'extreme', sanctionsResult: 'clear' });
    expect(r).toEqual({ ...emptyComplianceReview(), sanctionsResult: 'clear' });
  });
});

describe('outstandingDeclarations', () => {
  it('lists every unanswered question on an empty record', () => {
    expect(outstandingDeclarations(emptyComplianceDeclarations())).toEqual([
      'PEP status',
      'PEP family or associate',
      'Source of funds',
      'Source of wealth',
      'Tax residency',
      'US person (FATCA)',
      'POPIA consent',
      'Provider sharing consent',
    ]);
  });

  it('is empty once everything is answered', () => {
    expect(outstandingDeclarations(completeDeclarations())).toEqual([]);
  });

  it('asks for the details behind a "yes"', () => {
    const d = {
      ...completeDeclarations(),
      isPep: 'yes' as const,
      isPepRelated: 'yes' as const,
      isUsPerson: 'yes' as const,
    };
    expect(outstandingDeclarations(d)).toEqual([
      'PEP details',
      'PEP relation details',
      'US tax number',
    ]);
  });

  it('needs a tax number or a reason for every residency', () => {
    const d = completeDeclarations();
    d.taxResidencies = [{ id: 't', country: 'Mauritius', taxNumber: '', noTaxNumberReason: '' }];
    expect(outstandingDeclarations(d)).toEqual(['Tax residency details']);
    d.taxResidencies[0].noTaxNumberReason = 'not-issued';
    expect(outstandingDeclarations(d)).toEqual([]);
  });
});

describe('KYC review dates', () => {
  it('adds months and clamps to the end of a shorter month', () => {
    expect(addMonthsIso('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsIso('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonthsIso('2026-11-24', 12)).toBe('2027-11-24');
    expect(addMonthsIso('not a date', 12)).toBe('');
  });

  it('suggests the next review from the rating', () => {
    expect(suggestNextKycReviewDate('2026-11-24', 'high')).toBe('2027-11-24');
    expect(suggestNextKycReviewDate('2026-11-24', 'medium')).toBe('2028-11-24');
    expect(suggestNextKycReviewDate('2026-11-24', 'low')).toBe('2029-11-24');
    expect(suggestNextKycReviewDate('2026-11-24', '')).toBe('');
    expect(suggestNextKycReviewDate('', 'high')).toBe('');
  });
});

describe('complianceIndicators', () => {
  const TODAY = '2026-11-24';
  const reviewed = {
    ...emptyComplianceReview(),
    riskRating: 'low' as const,
    sanctionsResult: 'clear' as const,
    nextKycReviewDate: '2029-11-24',
  };

  it('has nothing to say about a complete, low-risk client', () => {
    expect(complianceIndicators(completeDeclarations(), reviewed, TODAY)).toEqual([]);
  });

  it('flags a sanctions hit, PEP exposure, an overdue review and a rating mismatch', () => {
    const d = { ...completeDeclarations(), isPepRelated: 'yes' as const };
    d.pepRelatedName = 'A. Minister';
    d.pepRelationship = 'family-member';
    const r = {
      ...reviewed,
      sanctionsResult: 'potential-match' as const,
      nextKycReviewDate: '2026-01-01',
    };
    const messages = complianceIndicators(d, r, TODAY).map((i) => `${i.level}: ${i.message}`);
    expect(messages).toEqual([
      'alert: Potential sanctions match awaiting resolution.',
      'warning: PEP exposure declared — enhanced due diligence and senior management approval required.',
      'warning: KYC review overdue since 2026-01-01.',
      'warning: PEP exposure declared but the client is not rated high risk.',
    ]);
  });

  it('notes FATCA, CRS and what the client still has to declare', () => {
    const d = { ...emptyComplianceDeclarations(), isUsPerson: 'yes' as const, usTin: '123' };
    d.taxResidencies = [
      { id: 't', country: 'United Kingdom', taxNumber: 'UK1', noTaxNumberReason: '' },
    ];
    const levels = complianceIndicators(d, emptyComplianceReview(), TODAY);
    expect(levels.map((i) => i.message)).toEqual([
      'Client risk rating not set.',
      'Sanctions screening not recorded.',
      'US person — FATCA reporting applies.',
      'Tax resident outside South Africa — CRS reporting applies.',
      'Client still to declare: PEP status, PEP family or associate, Source of funds, Source of wealth, POPIA consent, Provider sharing consent.',
    ]);
  });

  it('alerts when processing consent was declined', () => {
    const d = completeDeclarations();
    d.consents.dataProcessing = { status: 'declined', recordedAt: '' };
    expect(complianceIndicators(d, reviewed, TODAY)).toContainEqual({
      level: 'alert',
      message: 'POPIA processing consent declined.',
    });
  });

  it('treats a confirmed sanctions match as an alert', () => {
    const r = { ...reviewed, sanctionsResult: 'confirmed-match' as const };
    expect(complianceIndicators(completeDeclarations(), r, TODAY)[0]).toEqual({
      level: 'alert',
      message: 'Confirmed sanctions match — do not transact.',
    });
  });
});

describe('isPepExposed', () => {
  it('is true for the client or a relation', () => {
    expect(isPepExposed(completeDeclarations())).toBe(false);
    expect(isPepExposed({ ...completeDeclarations(), isPep: 'yes' })).toBe(true);
    expect(isPepExposed({ ...completeDeclarations(), isPepRelated: 'yes' })).toBe(true);
  });
});

describe('legacyConsentEvidence', () => {
  it('reads the first-sign-in terms before the application', () => {
    expect(
      legacyConsentEvidence({
        _termsConsent: { popiaConsent: true, acceptedAt: '2026-10-01T08:00:00.000Z' },
        _applicationMeta: {
          popiaConsent: true,
          communicationConsent: true,
          electronicCommunicationConsent: true,
        },
      }),
    ).toEqual([
      {
        key: 'dataProcessing',
        status: 'granted',
        recordedAt: '2026-10-01T08:00:00.000Z',
        source: 'first sign-in terms',
      },
      { key: 'electronicDelivery', status: 'granted', recordedAt: '', source: 'application' },
      { key: 'marketing', status: 'granted', recordedAt: '', source: 'application' },
    ]);
  });

  it('falls back to the application and returns nothing when there is nothing', () => {
    expect(legacyConsentEvidence({ _applicationMeta: { popiaConsent: true } })).toEqual([
      { key: 'dataProcessing', status: 'granted', recordedAt: '', source: 'application' },
    ]);
    expect(legacyConsentEvidence({})).toEqual([]);
  });
});
