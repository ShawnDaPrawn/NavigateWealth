/**
 * utils/services/applicationService.ts — unit tests
 *
 * Mocks fetch globally and stubs logger/supabase info so no real
 * network calls or environment dependencies are needed.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

// ── Mock supabase info ───────────────────────────────────────────────────────
vi.mock('../../supabase/info', () => ({
  projectId: 'test-project-id',
  publicAnonKey: 'test-anon-key',
  supabaseUrl: 'https://test-project-id.supabase.co',
}));

// ── Mock logger ──────────────────────────────────────────────────────────────
vi.mock('../../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ── Import after mocks ───────────────────────────────────────────────────────
import { submitApplication, getApplication, saveApplicationProgress } from '../applicationService';
import type { ApplicationSubmissionData } from '../applicationService';

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeFetchResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
  };
}

const minimalAppData: ApplicationSubmissionData['applicationData'] = {
  title: 'Mr',
  firstName: 'John',
  middleName: '',
  preferredName: 'John',
  lastName: 'Smith',
  dateOfBirth: '1985-06-15',
  gender: 'male',
  nationality: 'South African',
  idType: 'ID',
  idNumber: '8506150001088',
  taxNumber: '',
  isSATaxResident: true,
  maritalStatus: 'single',
  maritalRegime: '',
  numberOfDependants: '0',
  spouseFirstName: '',
  spouseLastName: '',
  spouseDateOfBirth: '',
  spouseEmployed: '',
  emailAddress: 'john@example.com',
  alternativeEmail: '',
  cellphoneNumber: '0821234567',
  alternativeCellphone: '',
  whatsappNumber: '',
  preferredContactMethod: 'email',
  bestTimeToContact: 'morning',
  residentialAddressLine1: '1 Test St',
  residentialAddressLine2: '',
  residentialSuburb: 'Suburb',
  residentialCity: 'Cape Town',
  residentialProvince: 'Western Cape',
  residentialPostalCode: '8001',
  residentialCountry: 'South Africa',
  employmentStatus: 'employed',
  jobTitle: 'Developer',
  employerName: 'ACME',
  industry: 'IT',
  selfEmployedCompanyName: '',
  selfEmployedIndustry: '',
  selfEmployedDescription: '',
  grossMonthlyIncome: '50000',
  monthlyExpensesEstimate: '20000',
  accountReasons: ['investment'],
  otherReason: '',
  financialGoals: 'Retirement',
  urgency: 'medium',
  existingProducts: [],
  existingProductProviders: {},
  termsAccepted: true,
  popiaConsent: true,
  disclosureAcknowledged: true,
  faisAcknowledged: true,
  electronicCommunicationConsent: true,
  communicationConsent: true,
  signatureFullName: 'John Smith',
};

const submissionData: ApplicationSubmissionData = {
  userId: 'user-001',
  applicationData: minimalAppData,
};

// ── Setup / Teardown ─────────────────────────────────────────────────────────
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ── submitApplication ─────────────────────────────────────────────────────────
describe('submitApplication', () => {
  it('returns { success: true, data } on successful submission', async () => {
    const responseData = { data: { applicationId: 'app-001' } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeFetchResponse(responseData)));

    const result = await submitApplication(submissionData);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ applicationId: 'app-001' });
  });

  it('POSTs to the correct endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeFetchResponse({ data: {} }));
    vi.stubGlobal('fetch', mockFetch);

    await submitApplication(submissionData);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/applications/submit');
    expect((options as RequestInit).method).toBe('POST');
  });

  it('includes the Authorization header', async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeFetchResponse({ data: {} }));
    vi.stubGlobal('fetch', mockFetch);

    await submitApplication(submissionData);
    const [, options] = mockFetch.mock.calls[0];
    expect((options as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer test-anon-key',
    });
  });

  it('sends submission data as JSON body', async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeFetchResponse({ data: {} }));
    vi.stubGlobal('fetch', mockFetch);

    await submitApplication(submissionData);
    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse((options as RequestInit).body as string);
    expect(body.userId).toBe('user-001');
  });

  it('returns { success: false, error } on non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeFetchResponse({ error: 'Validation failed' }, false, 400)),
    );

    const result = await submitApplication(submissionData);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Validation failed');
  });

  it('returns { success: false } on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection refused')));

    const result = await submitApplication(submissionData);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Connection refused');
  });

  it('returns generic error message for non-Error throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue('unexpected'));

    const result = await submitApplication(submissionData);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unknown error occurred');
  });
});

// ── getApplication ────────────────────────────────────────────────────────────
describe('getApplication', () => {
  it('returns { success: true, data } on success', async () => {
    const appData = { status: 'pending', applicationId: 'app-001' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeFetchResponse({ data: appData })));

    const result = await getApplication('user-001');
    expect(result.success).toBe(true);
    expect(result.data).toEqual(appData);
  });

  it('GETs the correct URL with userId', async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeFetchResponse({ data: null }));
    vi.stubGlobal('fetch', mockFetch);

    await getApplication('user-456');
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/applications/user-456');
    expect((options as RequestInit).method).toBe('GET');
  });

  it('includes the Authorization header', async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeFetchResponse({ data: null }));
    vi.stubGlobal('fetch', mockFetch);

    await getApplication('user-001');
    const [, options] = mockFetch.mock.calls[0];
    expect((options as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer test-anon-key',
    });
  });

  it('returns { success: false, error } on non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeFetchResponse({ error: 'Not found' }, false, 404)),
    );

    const result = await getApplication('user-001');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('returns { success: false } on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network timeout')));

    const result = await getApplication('user-001');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Network timeout');
  });

  it('returns generic message for non-Error throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(42));

    const result = await getApplication('user-001');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unknown error occurred');
  });
});

// ── saveApplicationProgress ───────────────────────────────────────────────────
describe('saveApplicationProgress', () => {
  it('returns { success: true, data } on success', async () => {
    const responseData = { data: { saved: true } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeFetchResponse(responseData)));

    const result = await saveApplicationProgress('user-001', { firstName: 'John' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ saved: true });
  });

  it('POSTs to the save-progress endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeFetchResponse({ data: {} }));
    vi.stubGlobal('fetch', mockFetch);

    await saveApplicationProgress('user-001', { firstName: 'Test' });
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/applications/save-progress');
    expect((options as RequestInit).method).toBe('POST');
  });

  it('sends userId and partial applicationData in body', async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeFetchResponse({ data: {} }));
    vi.stubGlobal('fetch', mockFetch);

    const partial = { firstName: 'Jane', lastName: 'Doe' };
    await saveApplicationProgress('user-002', partial);
    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse((options as RequestInit).body as string);
    expect(body.userId).toBe('user-002');
    expect(body.applicationData).toEqual(partial);
  });

  it('returns { success: false, error } on non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeFetchResponse({ error: 'Save failed' }, false, 500)),
    );

    const result = await saveApplicationProgress('user-001', {});
    expect(result.success).toBe(false);
    expect(result.error).toBe('Save failed');
  });

  it('returns { success: false } on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline')));

    const result = await saveApplicationProgress('user-001', {});
    expect(result.success).toBe(false);
    expect(result.error).toBe('Offline');
  });

  it('returns generic message for non-Error throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(null));

    const result = await saveApplicationProgress('user-001', {});
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unknown error occurred');
  });
});
