interface DefaultPortalFlowProvider {
  name?: string;
}

interface DefaultPortalFlowOptions {
  defaultPortalBrainGoal: (providerName: string) => string;
  categoryId?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  retirement_planning: 'Retirement Planning',
  retirement_pre: 'Pre-Retirement',
  retirement_post: 'Post-Retirement',
  investments: 'Investments',
  investments_voluntary: 'Voluntary Investments',
  investments_guaranteed: 'Guaranteed Investments',
};

function isInvestmentCategory(categoryId?: string): boolean {
  return String(categoryId || '').startsWith('investments');
}

export function getDefaultPortalFlow(
  provider: DefaultPortalFlowProvider,
  providerId: string,
  options: DefaultPortalFlowOptions,
) {
  const providerName = String(provider.name || providerId);
  const providerKey = providerName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const isAllanGray = providerName.toLowerCase().includes('allan gray') || providerId.toLowerCase().includes('allan');
  const categoryLabel = CATEGORY_LABELS[options.categoryId || ''] || 'portal';
  const categorySuffix = options.categoryId ? `${providerId}:${options.categoryId}:default` : `${providerId}:default`;
  const now = new Date().toISOString();

  if (isAllanGray) {
    const productTypeLabels = isInvestmentCategory(options.categoryId)
      ? ['Investment', 'Unit trust', 'Portfolio', 'Account type', 'Product type']
      : ['Retirement annuity fund'];
    const currentValueLabels = isInvestmentCategory(options.categoryId)
      ? ['Total value', 'Market value', 'Portfolio value', 'Current value', 'Closing balance', 'Value']
      : ['Total value', 'Closing balance', 'Value'];

    return {
      id: categorySuffix,
      providerId,
      name: options.categoryId
        ? `Allan Gray ${categoryLabel} portal extraction`
        : 'Allan Gray portal policy extraction',
      loginUrl: 'https://login.secure.allangray.co.za/?audience=New%20clients',
      credentialProfiles: [
        {
          id: 'allan-gray-env',
          label: 'Allan Gray Supabase credentials',
          source: 'supabase_kv',
          usernameEnvVar: 'NW_PROVIDER_ALLAN_GRAY_USERNAME',
          passwordEnvVar: 'NW_PROVIDER_ALLAN_GRAY_PASSWORD',
        },
      ],
      login: {
        usernameSelector: 'input[name="username"], input[type="email"], input[autocomplete="username"], input[id*="user" i]',
        passwordSelector: 'input[name="password"], input[type="password"], input[autocomplete="current-password"]',
        submitSelector: 'button[type="submit"], button:has-text("Log in"), button:has-text("Login"), input[type="submit"]',
      },
      otp: {
        mode: 'manual_sms',
        detectionSelectors: [
          'input[name*="otp" i]',
          'input[name*="code" i]',
          'input[autocomplete="one-time-code"]',
          'text=/verification code/i',
          'text=/one-time password/i',
        ],
        inputSelector: 'input[name*="otp" i], input[name*="code" i], input[autocomplete="one-time-code"]',
        submitSelector: 'button[type="submit"], button:has-text("Verify"), button:has-text("Continue")',
        timeoutMs: 600000,
        instructions: 'The Allan Gray SMS OTP must be entered by an admin in Navigate Wealth. The worker will pause and poll for it; never store the OTP in a spreadsheet or flow config.',
      },
      navigation: {
        policyListSteps: [
          {
            id: 'click-clients-link',
            action: 'click',
            selector: 'a:has-text("Clients"), button:has-text("Clients"), [role="link"]:has-text("Clients"), [role="button"]:has-text("Clients"), [role="menuitem"]:has-text("Clients")',
            timeoutMs: 45000,
            optional: true,
            description: 'Click the main Clients navigation item after login to reach the Allan Gray client search area.',
          },
        ],
        clientListSelector: '[data-testid*="client" i], a:has-text("Clients"), a:has-text("Investors")',
        clientRowSelector: '[data-testid*="client-row" i], table tbody tr',
        nextPageSelector: 'a[rel="next"], button:has-text("Next")',
      },
      search: {
        mode: 'policy_number',
        searchInputLabels: ['Policy number', 'Account number', 'Search', 'Client search', 'Investor search'],
        searchInputSelector: 'input[type="search"], input[placeholder*="Search" i], input[name*="search" i], input[id*="search" i]',
        submitSelector: 'button:has-text("Search"), button[type="submit"], input[type="submit"]',
        resultContainerSelector: 'table tbody tr, [data-testid*="result" i], [data-testid*="policy" i], a',
        resultLinkSelector: 'a, button, [role="link"], [role="button"]',
        noResultsText: ['No results', 'No clients found', 'No investments found', 'No policies found'],
        instructions: 'Search Allan Gray by the Navigate Wealth policy number. The worker only opens a result when the policy number is found on the page.',
        brain: {
          enabled: true,
          goal: options.defaultPortalBrainGoal(providerName),
          maxDecisionsPerItem: 2,
          rememberSelectors: true,
        },
      },
      extraction: {
        policyRowSelector: '[data-testid*="policy" i], table tbody tr',
        fields: [
          { sourceHeader: 'Policy Number', columnName: 'Policy Number', targetFieldName: 'Policy Number', selector: '[data-field="policyNumber"], [data-testid*="policy-number" i], [data-testid*="account-number" i], [data-testid*="investment-number" i]', labels: ['Policy number', 'Account number', 'Investment number'], attribute: 'text', required: true, transform: 'trim' },
          { sourceHeader: 'Product Type', columnName: 'Product Type', targetFieldName: 'Product Type', selector: '[data-field="productType"], [data-testid*="retirement-annuity" i], [data-testid*="product-type" i]', labels: productTypeLabels, attribute: 'text', transform: 'trim' },
          { sourceHeader: 'Date of Inception', columnName: 'Date of Inception', targetFieldName: 'Date of Inception', selector: '[data-field="inceptionDate"], [data-testid*="inception" i], [data-testid*="start-date" i]', labels: ['Inception date', 'Date of inception'], attribute: 'text', transform: 'trim' },
          { sourceHeader: 'Current Value', columnName: 'Current Value', targetFieldName: 'Current Value', selector: '[data-field="fundValue"], [data-testid*="closing-balance" i], [data-testid*="fund-value" i], [data-testid*="market-value" i], [data-testid*="current-value" i]', labels: currentValueLabels, attribute: 'text', required: true, transform: 'trim' },
        ],
      },
      policySchedule: {
        enabled: false,
        downloadLabels: ['Policy schedule', 'Download policy schedule', 'Download PDF', 'Statement', 'Download'],
        downloadMenuLabels: ['Download PDF with company logo', 'Download PDF without company logo'],
        documentType: 'policy_schedule',
        required: false,
        waitForDownloadMs: 45000,
      },
      documentArtifacts: [],
      notes: [
        'The worker starts from Navigate Wealth policy numbers and searches Allan Gray one policy at a time.',
        'Credentials are stored server-side in Supabase and are never returned to the browser.',
        'Use label phrases first. Advanced selectors are only needed when the provider page is ambiguous.',
        'SMS OTP is a manual pause-and-resume checkpoint and is cleared after the worker consumes it.',
      ],
      needsDiscovery: true,
      updatedAt: now,
    };
  }

  return {
    id: categorySuffix,
    providerId,
    name: options.categoryId
      ? `${providerName} ${categoryLabel} portal policy extraction`
      : `${providerName} portal policy extraction`,
    loginUrl: '',
    credentialProfiles: [
      {
        id: `${providerKey}-env`,
        label: `${providerName} Supabase credentials`,
        source: 'supabase_kv',
        usernameEnvVar: `NW_PROVIDER_${providerKey.toUpperCase()}_USERNAME`,
        passwordEnvVar: `NW_PROVIDER_${providerKey.toUpperCase()}_PASSWORD`,
      },
    ],
    login: {
      usernameSelector: 'input[autocomplete="username"], input[name*="user" i], input[type="email"]',
      passwordSelector: 'input[type="password"], input[autocomplete="current-password"]',
      submitSelector: 'button[type="submit"], input[type="submit"]',
    },
    otp: {
      mode: 'manual_sms',
      detectionSelectors: ['input[autocomplete="one-time-code"]', 'input[name*="otp" i]', 'input[name*="code" i]'],
      inputSelector: 'input[autocomplete="one-time-code"], input[name*="otp" i], input[name*="code" i]',
      submitSelector: 'button[type="submit"], button:has-text("Verify"), button:has-text("Continue")',
      timeoutMs: 600000,
      instructions: 'Enter the SMS OTP in Navigate Wealth when the worker pauses.',
    },
    navigation: { policyListSteps: [] },
    search: {
      mode: 'policy_number',
      searchInputLabels: ['Policy number', 'Account number', 'Search'],
      searchInputSelector: 'input[type="search"], input[placeholder*="Search" i], input[name*="search" i], input[id*="search" i]',
      submitSelector: 'button:has-text("Search"), button[type="submit"], input[type="submit"]',
      resultContainerSelector: 'table tbody tr, [data-testid*="result" i], a',
      resultLinkSelector: 'a, button, [role="link"], [role="button"]',
      noResultsText: ['No results', 'No policies found'],
      instructions: 'Search by policy number and only open results that contain the exact policy number.',
      brain: {
        enabled: false,
        goal: options.defaultPortalBrainGoal(providerName),
        maxDecisionsPerItem: 2,
        rememberSelectors: true,
      },
    },
    extraction: { fields: [] },
    policySchedule: {
      enabled: false,
      downloadLabels: ['Policy schedule', 'Download', 'PDF', 'Statement'],
      documentType: 'policy_schedule',
      required: false,
      waitForDownloadMs: 30000,
    },
    documentArtifacts: [],
    notes: ['Configure login, policy search, and field labels before running this provider in production.'],
    needsDiscovery: true,
    updatedAt: now,
  };
}
