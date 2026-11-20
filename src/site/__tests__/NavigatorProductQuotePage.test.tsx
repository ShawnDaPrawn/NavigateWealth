/**
 * The redesigned quote "details" step (/get-quote/:service), reached the way
 * production reaches it: ProductQuotePage with the design switch on
 * lazy-loads NavigatorProductQuotePage, with the router state the "your
 * details" step hands over.
 *
 * The request each service sends is not written down here. Each payload test
 * answers the redesign's questions through its controls, checks the answers
 * were kept exactly as the live wizard keeps them (the same session-storage
 * key and shape), then runs the LIVE wizard (the switch off) on those same
 * answers and expects the redesign's request to match it byte for byte: same
 * endpoint, same method, same body with its keys in the same order.
 *
 * Also covers: the H1 and headings, links, SEO and noindex, the redirect to
 * the "your details" step, the unknown service, the medical-aid landing page
 * without contact details, validation (Next and submit held back, with the
 * board's hints), back and next, progress kept across a reload, the "Quoting
 * for" switch, the success screen and where it leads, and a failed send.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';

const mode = vi.hoisted(() => ({ design: 'navigator' as 'navigator' | 'legacy' }));

vi.mock('../design', () => ({
  get SITE_DESIGN() {
    return mode.design;
  },
  resolveSiteDesign: () => mode.design,
}));
vi.mock('../../utils/supabase/info', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/supabase/info')>()),
  projectId: 'proj',
  publicAnonKey: 'anon',
}));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const { ProductQuotePage } = await import('../../components/pages/ProductQuotePage');
// Loaded up front, so the switch's lazy import resolves at once under load.
await import('../pages/NavigatorProductQuotePage');
const { getServiceConfig } = await import('../../components/pages/quote/constants');
const { QUOTE_GATEWAY_SESSION_KEY } = await import('../../components/pages/quote/gatewaySession');
const { getSEOData } = await import('../../components/seo/seo-config');
const { toast } = await import('sonner');

const SUBMIT_URL =
  'https://proj.supabase.co/functions/v1/make-server-91ed8379/quote-request/submit';
const NOW = new Date('2026-11-19T10:00:00Z');

const CONTACT = {
  firstName: ' Thandi ',
  lastName: 'van der Merwe',
  email: 'thandi@example.co.za ',
  phone: '082 345 6789',
};
const ROUTER_STATE = {
  contact: CONTACT,
  service: 'risk-management',
  parentSubmissionId: 'sub-123',
};

function stubFetch(reply: { ok: boolean; body: unknown } | 'offline' = OK) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      if (reply === 'offline') throw new TypeError('Failed to fetch');
      return { ok: reply.ok, json: async () => reply.body };
    }),
  );
}
const OK = { ok: true, body: { success: true, submissionId: 'sub-999' } };

function submitCalls() {
  return vi.mocked(fetch).mock.calls.filter(([url]) => String(url).includes('/quote-request/'));
}

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}
const location = () => screen.getByTestId('location').textContent;

function renderAt(service: string, state: unknown = { ...ROUTER_STATE, service }) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: `/get-quote/${service}`, state }]}>
      <Routes>
        <Route path="/" element={<p>Home page</p>} />
        <Route path="/get-quote" element={<p>All services</p>} />
        <Route path="/get-quote/:service/contact" element={<p>Your details step</p>} />
        <Route path="/get-quote/:service" element={<ProductQuotePage />} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

async function renderPage(service = 'risk-management', state?: unknown) {
  renderAt(service, state === undefined ? { ...ROUTER_STATE, service } : state);
  return screen.findByRole('heading', { level: 1 }, { timeout: 5000 });
}

// ── Driving the redesign's controls ───────────────────────────────────────────

const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const starts = (t: string) => new RegExp(`^${esc(t)}`);

function type(label: string, value: string, index = 0) {
  fireEvent.change(screen.getAllByLabelText(starts(label))[index], { target: { value } });
}
function choose(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(starts(label)), { target: { value } });
}
function radio(group: string, name: string, index = 0) {
  const groups = screen.getAllByRole('radiogroup', { name: starts(group) });
  fireEvent.click(within(groups[index]).getByRole('radio', { name: starts(name) }));
}
function press(name: string, index = 0) {
  fireEvent.click(screen.getAllByRole('button', { name: starts(name) })[index]);
}
function next() {
  const button = screen.getByRole('button', { name: /^Next/ });
  expect(button).toHaveProperty('disabled', false);
  fireEvent.click(button);
}
async function submit(name = 'Submit Quote Request') {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: starts(name) }));
  });
}
const stepHeading = () => document.querySelector<HTMLElement>('.nwpq-step-title')!;

interface Case {
  service: string;
  /** The live wizard's draft key, or the details form's session key. */
  key: string;
  /** The answers as the live wizard keeps them, once the review is reached. */
  draft: unknown;
  /** Answers the redesign's questions, ending on the review. */
  answer: () => void;
  submitLabel?: string;
}

const CASES: Case[] = [
  {
    service: 'risk-management',
    key: 'nw_risk_quote_draft',
    draft: {
      risk_needs: {
        life_cover: { selected: true, amount: '2,000,000', adviser_assist: false },
        lump_sum_disability: { selected: false, amount: '', adviser_assist: false },
        severe_illness: { selected: false, amount: '', adviser_assist: false },
        income_protection: { selected: true, amount: '', adviser_assist: true },
      },
      personal_details: {
        occupation: 'Project Manager',
        income_gross_monthly: '85,000',
        income_net_monthly: '62,000',
        smoker_status: 'non-smoker',
        highest_qualification: 'honours',
        marital_status: 'married',
        spouse_income_monthly: '45,000',
      },
      health_disclosures: {
        has_conditions: true,
        selected_conditions: ['Asthma', 'High cholesterol'],
        free_text: 'Mild, well controlled',
      },
      currentStep: 4,
    },
    answer: () => {
      press('Life Cover');
      type('Cover amount (ZAR)', '2000000');
      press('Income Protection');
      press('Require adviser assistance determining my cover amount', 1);
      next();
      type('Occupation', 'Project Manager');
      choose('Smoker status', 'non-smoker');
      type('Gross monthly income', '85000');
      type('Net monthly income', '62000');
      choose('Highest qualification', 'honours');
      choose('Marital status', 'married');
      type('Spouse / partner monthly income', '45000');
      next();
      radio('Chronic conditions', 'Yes, I have conditions');
      press('Asthma');
      press('High cholesterol');
      type('Additional details or other conditions', 'Mild, well controlled');
      next();
    },
  },
  {
    service: 'medical-aid',
    key: 'nw_medical_aid_quote_draft',
    draft: {
      members: {
        membership_type: 'family',
        main: { dob: '', age: '41' },
        spouse: { dob: '', age: '39' },
        children: [
          { dob: '', age: '7' },
          { dob: '2021-03-14', age: '' },
        ],
      },
      preferences: {
        cover_type: 'comprehensive',
        network: 'network',
        budget_band: '6000_8500',
        province: 'Gauteng',
      },
      medical_aid_history: {
        current_status: 'currently_on',
        current_scheme: 'Discovery Health',
        current_plan: 'Classic Saver',
        current_tenure_band: '3_plus_years',
        time_without_sa_medical_aid: '',
        lpj_time_off_since_35: '0_months',
      },
      health: {
        has_chronic_conditions: true,
        selected_conditions: ['High blood pressure'],
        applies_to_members: ['Main', 'Child 2'],
        notes: 'Controlled with medication',
      },
      currentStep: 5,
    },
    answer: () => {
      radio('Membership type', 'Family (adults + children)');
      type('Or age', '41', 0);
      type('Or age', '39', 1);
      type('Or age', '7', 2);
      press('Add child');
      type('Date of birth', '2021-03-14', 3);
      next();
      radio('Cover type', 'Comprehensive');
      radio('Network preference', 'Network / designated providers');
      radio('Monthly budget', 'R6,000–R8,500');
      choose('Province', 'Gauteng');
      next();
      radio('Current cover status', 'I am currently on');
      choose('Current scheme name', 'Discovery Health');
      type('Current plan name', 'Classic Saver');
      radio('How long have you been on this scheme?', '3+ years');
      radio('Since turning 35', '0 months');
      next();
      radio('Any diagnosed chronic conditions?', 'Yes');
      press('High blood pressure');
      type('Add details (optional)', 'Controlled with medication');
      const members = screen.getByRole('group', { name: /Which member/ });
      fireEvent.click(within(members).getByRole('button', { name: 'Main' }));
      fireEvent.click(within(members).getByRole('button', { name: 'Child 2' }));
      next();
    },
  },
  {
    service: 'investment-management',
    key: 'nw_investment_quote_draft',
    draft: {
      selected_types: ['unit_trust', 'tfsa'],
      contributions: {
        unit_trust: {
          contribution_type: 'both',
          lump_sum_amount: '250,000',
          lump_sum_adviser_assist: false,
          monthly_amount: '',
          monthly_adviser_assist: true,
        },
        tfsa: {
          contribution_type: 'monthly',
          lump_sum_amount: '',
          lump_sum_adviser_assist: false,
          monthly_amount: '3,000',
          monthly_adviser_assist: false,
        },
      },
      objective: {
        primary_objective: 'wealth_accumulation',
        time_horizon: '10_plus_years',
        risk_comfort: 'balanced',
      },
      financial: {
        income_gross_monthly: '95,000',
        income_net_monthly: '68,000',
        existing_investments: 'TFSA with Sygnia',
        has_retirement_annuity: true,
        tax_bracket: '31_39',
      },
      currentStep: 5,
    },
    answer: () => {
      press('Unit Trust');
      press('Tax-Free Savings Account');
      next();
      radio('Contribution type', 'Both', 0);
      radio('Contribution type', 'Monthly debit order', 1);
      type('Lump sum amount (ZAR)', '250000');
      fireEvent.click(screen.getAllByRole('button', { name: 'Adviser assist' })[1]);
      type('Monthly amount (ZAR /month)', '3000', 1);
      next();
      radio('Primary objective', 'Wealth accumulation / growth');
      radio('Time horizon', '10+ years');
      radio('Risk comfort level', 'Balanced');
      next();
      type('Gross monthly income', '95000');
      type('Net monthly income', '68000');
      type('Existing investments', 'TFSA with Sygnia');
      radio('Do you currently have a retirement annuity?', 'Yes');
      radio('Tax bracket', '31–39%');
      next();
    },
  },
  {
    service: 'retirement-planning',
    key: 'nw_retirement_quote_draft',
    draft: {
      selected_product: 'ra',
      ra_contribution: {
        contribution_type: 'both',
        monthly_amount: '4,500',
        monthly_adviser_assist: false,
        lump_sum_amount: '',
        lump_sum_adviser_assist: true,
      },
      preservation: { is_transferring: null, transfer_amount: '', transfer_not_sure: false },
      not_sure_context: {
        currently_employed: null,
        leaving_employer_fund: null,
        want_monthly_contributions: '',
      },
      timeline: {
        planned_retirement_age: '63',
        current_age: '38',
        member_of_retirement_fund: true,
        fund_details: 'Employer pension fund',
      },
      financial: {
        income_gross_monthly: '72,000',
        income_net_monthly: '51,000',
        current_retirement_savings: '640,000',
        tax_bracket: '31_39',
      },
      currentStep: 5,
    },
    answer: () => {
      radio('Retirement products', 'Retirement Annuity (RA)');
      next();
      radio('Contribution type', 'Both');
      type('Monthly contribution amount (ZAR)', '4500');
      fireEvent.click(screen.getAllByRole('button', { name: 'Adviser assist' })[1]);
      next();
      type('Current age', '38');
      type('Planned retirement age', '63');
      radio('Are you currently a member of any retirement fund?', 'Yes');
      type('Which fund(s)?', 'Employer pension fund');
      next();
      type('Gross monthly income', '72000');
      type('Net monthly income', '51000');
      type('Current total retirement savings', '640000');
      radio('Tax bracket', '31–39%');
      next();
    },
  },
  {
    service: 'employee-benefits',
    key: 'nw_employee_benefits_quote_draft',
    draft: {
      business: {
        company_name: 'Acme Holdings (Pty) Ltd ',
        trading_name: ' ',
        industry_sector: 'Technology',
        employee_count: '21-50',
        province: 'Western Cape',
      },
      benefit_type: 'both',
      budget: {
        monthly_budget: '40,000',
        budget_adviser_assist: false,
        contribution_structure: 'cost_shared',
        compulsory_for_all: 'yes',
      },
      workforce: {
        average_age_band: '30_40',
        workforce_type: 'office',
        has_existing_benefits: true,
        existing_benefits_description: 'Group RA with Old Mutual',
      },
      currentStep: 5,
    },
    answer: () => {
      type('Registered company name', 'Acme Holdings (Pty) Ltd ');
      type('Trading name', ' ');
      choose('Industry sector', 'Technology');
      radio('Number of employees', '21–50');
      radio('Location (Province)', 'Western Cape');
      next();
      radio('Benefit types', 'Both Retirement and Risk Benefits');
      next();
      type('Estimated total monthly budget', '40000');
      radio('Contribution structure preference', 'Cost shared');
      radio('Are benefits compulsory for all staff?', 'Yes');
      next();
      radio('Average employee age band', '30–40');
      radio('Are employees primarily:', 'Office-based');
      radio('Do you currently have any employee benefits in place?', 'Yes');
      type('Briefly describe current arrangement', 'Group RA with Old Mutual');
      next();
    },
  },
  {
    service: 'tax-planning',
    key: 'nw_tax_planning_quote_draft',
    draft: {
      selected_types: ['itr12', 'cgt'],
      taxpayer_context: {
        taxpayer_type: 'individual',
        sars_registered: 'yes',
        submission_status: 'outstanding',
        tax_years: 'multiple',
      },
      financial_scope: {
        turnover_band: '1m_5m',
        has_foreign_income: 'no',
        under_sars_audit: 'no',
        has_penalties: 'not_sure',
      },
      currentStep: 4,
    },
    answer: () => {
      press('Individual Income Tax Return (ITR12)');
      press('Not Sure — Require Adviser Assistance');
      // "Not sure" is exclusive: another choice clears it.
      press('Individual Income Tax Return (ITR12)');
      press('Capital Gains Tax (CGT) Declaration');
      next();
      radio('Taxpayer type', 'Individual');
      radio('Are you currently registered with SARS', 'Yes');
      radio('Is this a new submission', 'Outstanding returns');
      radio('Tax year(s) involved', 'Multiple outstanding years');
      next();
      radio('Estimated annual turnover or income', 'R1m – R5m');
      radio('Do you have foreign income or offshore assets?', 'No');
      radio('Are you currently under SARS audit or verification?', 'No');
      radio('Have penalties or interest been raised?', 'Not sure');
      next();
    },
  },
  {
    service: 'estate-planning',
    key: 'nw_product_quote_estate-planning',
    // The details form keeps its answers in the order they were given; the
    // request's productDetails is this object as it stands.
    draft: {
      estateNeed: 'trust-setup',
      hasWill: 'outdated',
      estimatedEstateValue: '7,500,000',
      hasTrust: 'considering',
    },
    answer: () => {
      choose('Estate planning need', 'trust-setup');
      choose('Do you have a current will?', 'outdated');
      type('Estimated estate value (R)', '7500000');
      choose('Do you have existing trust structures?', 'considering');
    },
    submitLabel: 'Get My Estate Quote',
  },
];

/**
 * The live page, given the answers as its draft (or its details-form session),
 * at the review: submit, and return its request.
 */
async function runLive(c: Case) {
  mode.design = 'legacy';
  sessionStorage.clear();
  sessionStorage.setItem(c.key, JSON.stringify(c.draft));
  renderAt(c.service);
  await screen.findByRole('heading', { level: 1 }, { timeout: 5000 });
  // Really the live page, not the redesign twice.
  expect(document.querySelector('.nw-site')).toBeNull();
  await submit(c.submitLabel);
  await waitFor(() => expect(submitCalls()).toHaveLength(1));
  await screen.findByText('Quote Request Received!');
  const [url, init] = submitCalls()[0];
  const sent = { url: String(url), method: init!.method, body: String(init!.body) };
  cleanup();
  vi.mocked(fetch).mockClear();
  sessionStorage.clear();
  mode.design = 'navigator';
  return sent;
}

beforeEach(() => {
  mode.design = 'navigator';
  sessionStorage.clear();
  stubFetch();
  vi.mocked(toast.success).mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.getElementById('seo-structured-data')?.remove();
  document.querySelector('meta[name="robots"]')?.remove();
});

describe('Navigator quote details step — the request', () => {
  for (const c of CASES) {
    it(`${c.service}: answers kept as the live wizard keeps them, and the live request sent`, async () => {
      vi.useFakeTimers({ toFake: ['Date'], now: NOW });
      const expected = await runLive(c);

      await renderPage(c.service);
      await screen.findByRole('heading', {
        level: 2,
        name: `${getServiceConfig(c.service)!.label} details`,
      });
      c.answer();
      // Progress is kept under the live wizard's key, in its shape.
      expect(JSON.parse(sessionStorage.getItem(c.key)!)).toEqual(c.draft);

      await submit(c.submitLabel);
      await screen.findByRole('heading', { level: 2, name: 'Quote request received' });
      const calls = submitCalls();
      expect(calls).toHaveLength(1);
      const [url, init] = calls[0];
      expect(String(url)).toBe(SUBMIT_URL);
      expect({ url: String(url), method: init!.method, body: String(init!.body) }).toEqual(
        expected,
      );
      // Public endpoint: no anon key as a bearer (anon-key-bearer ratchet).
      expect(init!.headers).toEqual({ 'Content-Type': 'application/json' });
      // The wizard's progress is cleared once sent, as on the live page.
      expect(sessionStorage.getItem(c.key)).toBeNull();
    });
  }

  it('the medical-aid landing page, reached directly, sends no parentSubmissionId', async () => {
    sessionStorage.setItem('nw_medical_aid_quote_draft', JSON.stringify(CASES[1].draft));
    await renderPage('medical-aid', null);
    type('First Name', 'Ann');
    type('Last Name', 'Lee');
    type('Email', 'ann@example.com');
    type('Phone', '0820000000');
    await submit();
    const body = JSON.parse(String(submitCalls()[0][1]!.body));
    expect(Object.keys(body)).toEqual([
      'firstName',
      'lastName',
      'email',
      'phone',
      'productName',
      'stage',
      'service',
      'productDetails',
    ]);
    expect(body).toMatchObject({ firstName: 'Ann', service: 'medical-aid', stage: 'full' });
  });
});

describe('Navigator quote details step — the page', () => {
  it('has one H1 with the board text, and headings in order', async () => {
    const h1 = await renderPage();
    expect(h1.textContent).toBe('Risk Management quote');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Contact details',
      'Risk Management details',
    ]);
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'What cover do you want to quote?',
      'Why Navigate Wealth?',
    ]);
    const levels = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((h) =>
      Number(h.tagName[1]),
    );
    levels.forEach((level, i) => expect(level - (levels[i - 1] ?? 0)).toBeLessThanOrEqual(1));
    expect(screen.getByText('Step 3 of 3 — Quote details · last step')).toBeDefined();
    expect(screen.getByText(getServiceConfig('risk-management')!.heroDescription)).toBeDefined();
    expect(screen.getByText('Pre-filled from your previous step')).toBeDefined();
  });

  it('links only to routes the site serves; every image has alt text', async () => {
    await renderPage();
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(new Set(hrefs)).toEqual(
      new Set(['/', '/get-quote', '/get-quote/risk-management/contact', '/legal/privacy-notice']),
    );
    expect(screen.getByRole('link', { name: 'Privacy Policy' }).getAttribute('href')).toBe(
      '/legal/privacy-notice',
    );
    expect(screen.getByRole('link', { name: /^Back/ }).getAttribute('href')).toBe(
      '/get-quote/risk-management/contact',
    );
    const logos = screen.getAllByTitle(/./).map((l) => l.getAttribute('title'));
    expect(logos).toEqual(getServiceConfig('risk-management')!.providers.map((p) => p.name));
    for (const img of document.querySelectorAll('img'))
      expect(img.getAttribute('alt')).toMatch(/ logo$/);
  });

  it('shows the providers, the partner count and the trust facts of the service', async () => {
    await renderPage('tax-planning');
    expect(screen.getByText('1 Trusted Partner')).toBeDefined();
    expect(screen.getByText('1 partner')).toBeDefined();
    expect(screen.getByTitle('Profin Accounting')).toBeDefined();
    for (const fact of ['FSP 54606', 'FSCA Regulated', 'Free Consultation', 'No Obligation'])
      expect(screen.getAllByText(fact).length).toBeGreaterThan(0);
  });

  it('keeps quote steps out of the index, as the live page does', async () => {
    await renderPage('risk-management');
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex, follow',
    );
  });

  it('indexes the medical-aid landing page with its SEO data, and asks for contact details there', async () => {
    await renderPage('medical-aid', null);
    const seo = getSEOData('get-quote-medical-aid');
    await waitFor(() => expect(document.title).toBe(seo.title));
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'index, follow',
    );
    const data = JSON.parse(document.getElementById('seo-structured-data')!.textContent!);
    expect(data['@type']).toBe('WebPage');
    expect(data.url).toBe(seo.canonicalUrl);
    // No details handed over: empty fields, no badge, and the wizard waits.
    expect(screen.queryByText('Pre-filled from your previous step')).toBeNull();
    expect(
      screen.getByText('Please fill in all contact details above to start the quote wizard.'),
    ).toBeDefined();
    type('First Name', 'Ann');
    type('Last Name', 'Lee');
    type('Email', 'ann@example.com');
    expect(screen.queryByRole('heading', { level: 3, name: 'Who needs cover?' })).toBeNull();
    type('Phone', '0820000000');
    expect(screen.getByRole('heading', { level: 3, name: 'Who needs cover?' })).toBeDefined();
  });

  it('sends a deep link without contact details back to the "your details" step', async () => {
    renderAt('investment-management', null);
    await waitFor(() => expect(location()).toBe('/get-quote/investment-management/contact'));
    expect(screen.getByText('Your details step')).toBeDefined();
  });

  it('says so for a service that does not exist', async () => {
    const h1 = await renderPage('crypto-trading');
    expect(h1.textContent).toBe('Service Not Found');
    expect(screen.getByText("The requested service doesn't exist.")).toBeDefined();
    expect(screen.getByRole('link', { name: 'Browse All Services' }).getAttribute('href')).toBe(
      '/get-quote',
    );
  });

  it('draws the one-step form for estate planning, with the live fields', async () => {
    await renderPage('estate-planning');
    expect(screen.getByText('Your quote details')).toBeDefined();
    for (const f of getServiceConfig('estate-planning')!.productFields) {
      expect(screen.getByLabelText(starts(f.label))).toBeDefined();
    }
    expect(screen.queryByRole('list', { name: 'Quote wizard steps' })).toBeNull();
  });

  it('"Quoting for" goes to the other service\'s details step with the contact carried over', async () => {
    await renderPage();
    fireEvent.change(screen.getByLabelText('Quoting for'), { target: { value: 'medical-aid' } });
    await waitFor(() => expect(location()).toBe('/get-quote/medical-aid/contact'));
    expect(JSON.parse(sessionStorage.getItem(QUOTE_GATEWAY_SESSION_KEY)!)).toEqual(CONTACT);
  });
});

describe('Navigator quote details step — validation', () => {
  it("holds Next back until the step's required answers are in, with the board's hints", async () => {
    await renderPage();
    const nextButton = () => screen.getByRole('button', { name: /^Next/ });
    expect(nextButton()).toHaveProperty('disabled', true);
    expect(screen.getByText('Select a cover or request adviser assistance')).toBeDefined();
    expect(nextButton().getAttribute('aria-describedby')).toBeTruthy();

    // A cover without an amount is not enough; adviser help or an amount is.
    press('Life Cover');
    expect(nextButton()).toHaveProperty('disabled', true);
    expect(
      screen.getByText("Not sure? Choose adviser assistance and we'll calculate this with you."),
    ).toBeDefined();
    type('Cover amount (ZAR)', '0');
    expect(nextButton()).toHaveProperty('disabled', true);
    type('Cover amount (ZAR)', '1500000');
    expect(nextButton()).toHaveProperty('disabled', false);
    next();

    // About you: every starred field, and the spouse's income once married.
    expect(screen.getByText('Complete the required fields to continue')).toBeDefined();
    type('Occupation', 'Teacher');
    choose('Smoker status', 'smoker');
    type('Gross monthly income', '40000');
    type('Net monthly income', '45000');
    expect(
      screen.getByText('Net income is usually lower than gross — please double-check.'),
    ).toBeDefined();
    choose('Marital status', 'life-partner');
    expect(nextButton()).toHaveProperty('disabled', true);
    type('Spouse / partner monthly income', '30000');
    expect(nextButton()).toHaveProperty('disabled', false);
    choose('Marital status', 'single');
    expect(screen.queryByLabelText(starts('Spouse / partner monthly income'))).toBeNull();
    next();

    expect(screen.getByText('Choose None or Yes to continue')).toBeDefined();
    radio('Chronic conditions', 'None');
    expect(nextButton()).toHaveProperty('disabled', false);
  });

  it('holds the one-step form back until its required fields are filled', async () => {
    await renderPage('estate-planning');
    const send = () => screen.getByRole('button', { name: /^Get My/ });
    expect(send()).toHaveProperty('disabled', true);
    choose('Estate planning need', 'succession');
    expect(send()).toHaveProperty('disabled', true);
    choose('Do you have a current will?', 'no');
    expect(send()).toHaveProperty('disabled', false);
    // Clearing a contact field holds it back again, as on the live page.
    type('Phone', ' ');
    expect(send()).toHaveProperty('disabled', true);
  });
});

describe('Navigator quote details step — moving between steps', () => {
  it('goes forward and back, by Previous, by a finished step and by Edit', async () => {
    sessionStorage.setItem('nw_risk_quote_draft', JSON.stringify(CASES[0].draft));
    await renderPage();
    expect(stepHeading().textContent).toBe('Review & Submit');
    const steps = screen.getByRole('list', { name: 'Quote wizard steps' });
    expect(
      within(steps)
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual([
      'Step 1: Cover (completed, go back)',
      'Step 2: Details (completed, go back)',
      'Step 3: Health (completed, go back)',
      'Step 4: Review (current)',
    ]);

    // The review reads the answers back.
    expect(screen.getByText('R 2,000,000')).toBeDefined();
    expect(screen.getByText('Adviser assistance requested')).toBeDefined();
    expect(screen.getByText('R 45,000 /month')).toBeDefined();
    expect(screen.getByText('Asthma, High cholesterol, Mild, well controlled')).toBeDefined();
    expect(screen.getByText('Thandi van der Merwe')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(stepHeading().textContent).toBe('Any ongoing or chronic conditions?');
    // The new step's heading takes focus.
    expect(document.activeElement).toBe(stepHeading());

    fireEvent.click(within(steps).getByRole('button', { name: /^Step 1: Cover/ }));
    expect(stepHeading().textContent).toBe('What cover do you want to quote?');
    expect(within(steps).getByRole('button', { name: /^Step 3: Health/ })).toHaveProperty(
      'disabled',
      true,
    );
    next();
    next();
    next();
    fireEvent.click(screen.getByRole('button', { name: 'Edit about you' }));
    expect(stepHeading().textContent).toBe('Tell us a bit about you');
  });

  it('keeps progress across a reload, under the live key', async () => {
    await renderPage('tax-planning');
    press('Trust Tax Return (ITR12T)');
    next();
    radio('Taxpayer type', 'Trust');
    cleanup();
    await renderPage('tax-planning');
    expect(stepHeading().textContent).toBe('Tell us about the taxpayer');
    expect(
      within(screen.getByRole('radiogroup', { name: 'Taxpayer type' }))
        .getByRole('radio', { name: 'Trust' })
        .getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('keeps the details form across a reload, under the live key', async () => {
    await renderPage('estate-planning');
    choose('Estate planning need', 'buy-sell');
    expect(JSON.parse(sessionStorage.getItem('nw_product_quote_estate-planning')!)).toEqual({
      estateNeed: 'buy-sell',
    });
    cleanup();
    await renderPage('estate-planning');
    expect((screen.getByLabelText(starts('Estate planning need')) as HTMLSelectElement).value).toBe(
      'buy-sell',
    );
  });
});

describe('Navigator quote details step — sending', () => {
  it('shows the success card, with the live words and where they lead', async () => {
    sessionStorage.setItem('nw_investment_quote_draft', JSON.stringify(CASES[2].draft));
    await renderPage('investment-management');
    await submit();
    const done = await screen.findByRole('status');
    expect(within(done).getByRole('heading', { level: 2 }).textContent).toBe(
      'Quote request received',
    );
    expect(done.textContent).toContain(
      'Thank you for your investment management quote request. We will be in touch within 24 hours on business days with a personalised, no-obligation quote.',
    );
    expect(
      within(done).getByRole('link', { name: 'Request Another Quote' }).getAttribute('href'),
    ).toBe('/get-quote');
    expect(within(done).getByRole('link', { name: 'Back to Home' }).getAttribute('href')).toBe('/');
    expect(document.activeElement).toBe(within(done).getByRole('heading', { level: 2 }));
    expect(toast.success).toHaveBeenCalledWith('Your investment quote request has been submitted!');
    // The forms are gone; the hero keeps the one H1.
    expect(screen.queryByRole('heading', { name: 'Contact details' })).toBeNull();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it("shows the server's reason when a send is refused, and keeps the answers", async () => {
    stubFetch({ ok: false, body: { error: 'Please provide a valid email address' } });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    sessionStorage.setItem('nw_employee_benefits_quote_draft', JSON.stringify(CASES[4].draft));
    await renderPage('employee-benefits');
    await submit();
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Please provide a valid email address',
    );
    expect(spy).toHaveBeenCalledWith('Employee benefits quote submission error:', {
      error: 'Please provide a valid email address',
    });
    expect(screen.queryByText('Quote request received')).toBeNull();
    expect(stepHeading().textContent).toBe('Review & submit');
    expect(sessionStorage.getItem('nw_employee_benefits_quote_draft')).not.toBeNull();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('says to check the connection when the send fails, and the live words when the server gives none', async () => {
    stubFetch('offline');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    sessionStorage.setItem('nw_retirement_quote_draft', JSON.stringify(CASES[3].draft));
    await renderPage('retirement-planning');
    await submit();
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Unable to submit your request. Please check your connection and try again.',
    );
    // Sending again clears the message; a refusal without a reason reads the live default.
    stubFetch({ ok: false, body: {} });
    await submit();
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Something went wrong. Please try again.',
    );
  });

  it('reports a failed details-form send in the form too', async () => {
    stubFetch({ ok: false, body: {} });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    sessionStorage.setItem('nw_product_quote_estate-planning', JSON.stringify(CASES[6].draft));
    await renderPage('estate-planning');
    await submit('Get My Estate Quote');
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Something went wrong. Please try again.',
    );
    expect(spy).toHaveBeenCalledWith('Product quote submission error:', {});
    expect(sessionStorage.getItem('nw_product_quote_estate-planning')).not.toBeNull();
  });
});
