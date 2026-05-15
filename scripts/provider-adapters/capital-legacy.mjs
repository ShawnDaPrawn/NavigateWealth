export const capitalLegacyAdapter = {
  id: 'capital-legacy',
  label: 'Capital Legacy',
  defaultLoginUrl: 'https://legacylink.co.za/login',
  snapshotDebugArtifactName: 'capital-legacy-snapshot',

  matches(context = {}) {
    const providerText = [
      context.providerId,
      context.providerName,
      context.job?.providerId,
      context.job?.providerName,
      context.flow?.providerId,
      context.flow?.name,
      context.flow?.loginUrl,
    ].filter(Boolean).join(' ');

    return /capital\s*legacy|legacylink\.co\.za/i.test(providerText);
  },

  isProviderPage(page) {
    return /legacylink\.co\.za/i.test(page.url());
  },

  async extractSnapshot(page, item, runtime) {
    if (!this.isProviderPage(page)) return {};
    return extractCapitalLegacySnapshot(page, item, runtime);
  },

  async findDocumentClickTarget(page, options, runtime) {
    if (options?.step?.target !== 'download_button' || !this.isProviderPage(page)) {
      return null;
    }
    return findCapitalLegacyDocumentAction(page, options, runtime);
  },
};

async function extractCapitalLegacySnapshot(page, item, runtime) {
  const policyInfo = await readCapitalLegacyPolicyInfo(page, item, runtime);
  const willInfo = await readCapitalLegacyWillInfo(page, runtime).catch(() => ({}));

  return {
    ...policyInfo,
    ...willInfo,
    source: 'capital_legacy_snapshot',
  };
}

async function findCapitalLegacyDocumentAction(page, options, runtime) {
  const artifactId = String(options?.artifact?.id || '');
  const attachTarget = String(options?.artifact?.attachTo || '');
  const documentType = String(options?.artifact?.documentType || '');

  if (artifactId === 'policy_schedule' || documentType === 'policy_schedule') {
    const ready = await ensureCapitalLegacySection(page, 'products', runtime);
    if (!ready) return null;
    return findCapitalLegacyLabelAction(page, ['View Current Plan Schedule', 'Current Plan Schedule'], runtime);
  }

  if (
    attachTarget === 'estate_documents'
    || artifactId.includes('signed_will')
    || artifactId.includes('last_will')
    || documentType === 'last_will_scanned'
  ) {
    const ready = await ensureCapitalLegacySection(page, 'wills', runtime);
    if (!ready) return null;
    return findCapitalLegacyLabelAction(page, ['View Last Signed Will', 'Last Signed Will'], runtime);
  }

  return null;
}

async function readCapitalLegacyPolicyInfo(page, item, runtime) {
  const { evaluateWithNavigationRetry } = runtime;

  return evaluateWithNavigationRetry(page, (policyNumber) => {
    const normalise = (value) => String(value || '').trim().replace(/\s+/g, ' ');
    const rawBodyText = document.body?.innerText || document.body?.textContent || '';
    const lines = String(rawBodyText)
      .split(/\r?\n/)
      .map((line) => normalise(line))
      .filter(Boolean);
    const bodyText = normalise(rawBodyText);
    const moneyRegex = /R\s*[\d\s,]+(?:\.\d{1,2})?/i;
    const isoDateRegex = /\b\d{4}-\d{2}-\d{2}\b/;

    const valueAfter = (labelRegex, options = {}) => {
      const lookahead = Math.max(1, Number(options.lookahead || 4));
      const matcher = options.valueRegex || null;
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (!labelRegex.test(line)) continue;
        const sameLine = matcher
          ? (line.match(matcher)?.[0] || '')
          : normalise(line.replace(labelRegex, '').replace(/^[:\-\s]+/, ''));
        if (sameLine && !labelRegex.test(sameLine)) return sameLine;
        for (let offset = 1; offset <= lookahead; offset += 1) {
          const candidate = lines[index + offset] || '';
          if (!candidate || labelRegex.test(candidate)) continue;
          if (matcher) {
            const match = candidate.match(matcher);
            if (match?.[0]) return match[0].trim();
            continue;
          }
          return candidate;
        }
      }
      const textMatch = bodyText.match(labelRegex);
      if (textMatch && typeof textMatch.index === 'number') {
        const segment = bodyText.slice(textMatch.index, Math.min(bodyText.length, textMatch.index + 220));
        if (matcher) {
          const match = segment.match(matcher);
          if (match?.[0]) return match[0].trim();
        }
      }
      return '';
    };

    return {
      policyNumber: valueAfter(/\bCode\b/i, { lookahead: 2 }) || normalise(policyNumber),
      premium: valueAfter(/\bPremium\b/i, { valueRegex: moneyRegex }),
      productType: valueAfter(/\bPlan\b/i, { lookahead: 3 }),
      dateOfInception: valueAfter(/\bCommencement\s+date\b/i, { valueRegex: isoDateRegex }),
      status: valueAfter(/\bStatus\b/i, { lookahead: 2 }),
      nextAnniversaryDate: valueAfter(/\bNext\s+anniversary\s+date\b/i, { valueRegex: isoDateRegex }),
      diagnostics: {
        url: window.location.href,
        title: document.title,
        hasPolicyNumber: Boolean(policyNumber && bodyText.includes(policyNumber)),
      },
    };
  }, String(item?.policyNumber || '')).catch(() => ({}));
}

async function readCapitalLegacyWillInfo(page, runtime) {
  const ready = await ensureCapitalLegacySection(page, 'wills', runtime);
  if (!ready) return {};

  const { evaluateWithNavigationRetry } = runtime;
  return evaluateWithNavigationRetry(page, () => {
    const normalise = (value) => String(value || '').trim().replace(/\s+/g, ' ');
    const rawBodyText = document.body?.innerText || document.body?.textContent || '';
    const lines = String(rawBodyText)
      .split(/\r?\n/)
      .map((line) => normalise(line))
      .filter(Boolean);

    const valueAfter = (labelRegex, lookahead = 4) => {
      for (let index = 0; index < lines.length; index += 1) {
        if (!labelRegex.test(lines[index])) continue;
        for (let offset = 1; offset <= lookahead; offset += 1) {
          const candidate = lines[index + offset] || '';
          if (!candidate || labelRegex.test(candidate)) continue;
          return candidate;
        }
      }
      return '';
    };

    const signedCopy = valueAfter(/\bSigned\s+Copy\s+of\s+Will\b/i);
    const signedOriginal = valueAfter(/\bSigned\s+Original\s+of\s+Will\b/i);
    const lastSignedWillDate = valueAfter(/\bDate\s+of\s+Last\s+Signed\s+Will\b/i);
    const buttonVisible = /\bVIEW\s+LAST\s+SIGNED\s+WILL\b/i.test(rawBodyText);
    const hasSignedWill = buttonVisible
      || /^yes$/i.test(signedCopy)
      || /^yes$/i.test(signedOriginal);
    const hasExplicitNo = /^no$/i.test(signedCopy) || /^no$/i.test(signedOriginal);

    return {
      lastWillTestament: hasSignedWill ? 'Yes' : hasExplicitNo ? 'No' : '',
      lastSignedWillDate,
      signedCopyOfWill: signedCopy,
      signedOriginalOfWill: signedOriginal,
    };
  }).catch(() => ({}));
}

async function ensureCapitalLegacySection(page, section, runtime) {
  const alreadyVisible = await isCapitalLegacySectionVisible(page, section);
  if (alreadyVisible) return true;

  const selector = await inferCapitalLegacySectionSelector(page, section, runtime);
  if (!selector) return false;

  const locator = page.locator(selector).first();
  if (!await locator.isVisible({ timeout: 1500 }).catch(() => false)) return false;

  await locator.click();
  await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => undefined);
  await page.waitForLoadState('networkidle', { timeout: 2500 }).catch(() => undefined);
  await page.waitForTimeout(800);

  return isCapitalLegacySectionVisible(page, section);
}

async function isCapitalLegacySectionVisible(page, section) {
  if (section === 'products') {
    const productMarkers = [
      page.getByText(/View Current Plan Schedule/i).first(),
      page.getByText(/Principal Life Assured/i).first(),
      page.getByText(/Plan Value/i).first(),
    ];
    for (const marker of productMarkers) {
      if (await marker.isVisible({ timeout: 800 }).catch(() => false)) return true;
    }
    return /tab=products/i.test(page.url());
  }

  if (section === 'wills') {
    const willMarkers = [
      page.getByText(/View Last Signed Will/i).first(),
      page.getByText(/Signed Copy of Will/i).first(),
      page.getByText(/Date of Last Signed Will/i).first(),
    ];
    for (const marker of willMarkers) {
      if (await marker.isVisible({ timeout: 800 }).catch(() => false)) return true;
    }
    return /\/wills\/|tab=wills/i.test(page.url());
  }

  return false;
}

async function findCapitalLegacyLabelAction(page, labels, runtime) {
  for (const label of labels) {
    const labelRegex = new RegExp(escapeRegex(label), 'i');
    const directCandidates = [
      page.getByRole('link', { name: labelRegex }).first(),
      page.getByRole('button', { name: labelRegex }).first(),
      page.locator('a, button, [role="link"], [role="button"]').filter({ hasText: labelRegex }).first(),
    ];
    for (const candidate of directCandidates) {
      if (await candidate.isVisible({ timeout: 800 }).catch(() => false)) return candidate;
    }
  }

  const { evaluateWithNavigationRetry } = runtime;
  const selector = await evaluateWithNavigationRetry(page, (labelList) => {
    const normalise = (value) => String(value || '').trim().replace(/\s+/g, ' ');
    const isVisible = (el) => {
      if (!(el instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && rect.width > 0
        && rect.height > 0;
    };
    const clickables = Array.from(document.querySelectorAll('a, button, [role="link"], [role="button"]'))
      .filter(isVisible);
    const labelRegexes = (labelList || []).map((label) => new RegExp(String(label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
    const candidate = clickables.find((el) => {
      const text = normalise([
        el.textContent,
        el.getAttribute('aria-label'),
        el.getAttribute('title'),
        el.getAttribute('download'),
      ].filter(Boolean).join(' '));
      return labelRegexes.some((regex) => regex.test(text));
    });
    if (!candidate) return '';
    const id = `nw-capital-legacy-action-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    candidate.setAttribute('data-nw-worker-clickable', id);
    return `[data-nw-worker-clickable="${id}"]`;
  }, labels).catch(() => '');

  if (!selector) return null;
  const locator = page.locator(selector).first();
  if (await locator.isVisible({ timeout: 1000 }).catch(() => false)) return locator;
  return null;
}

async function inferCapitalLegacySectionSelector(page, section, runtime) {
  const { evaluateWithNavigationRetry } = runtime;
  return evaluateWithNavigationRetry(page, (targetSection) => {
    const normalise = (value) => String(value || '').trim().replace(/\s+/g, ' ');
    const isVisible = (el) => {
      if (!(el instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && rect.width >= 20
        && rect.height >= 20;
    };
    const clickables = Array.from(document.querySelectorAll('a, button, [role="tab"], [role="link"], [role="button"], [role="menuitem"]'))
      .filter(isVisible)
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const text = normalise([
          el.textContent,
          el.getAttribute('aria-label'),
          el.getAttribute('title'),
          el.getAttribute('href'),
          el.getAttribute('data-testid'),
          el.getAttribute('class'),
          ...Array.from(el.querySelectorAll('svg, i, span')).map((icon) => [
            icon.textContent,
            icon.getAttribute('aria-label'),
            icon.getAttribute('title'),
            icon.getAttribute('class'),
          ].filter(Boolean).join(' ')),
        ].filter(Boolean).join(' '));
        const href = normalise(el.getAttribute('href'));
        let score = 0;

        const topNavZone = rect.top >= 60 && rect.top <= 260;
        const mainContentZone = rect.left >= 260 && rect.left <= window.innerWidth - 80;
        if (topNavZone && mainContentZone) score += 25;

        if (targetSection === 'products') {
          if (/\bproducts?\b/i.test(text)) score += 120;
          if (/tab=products/i.test(href)) score += 180;
          if (/\bpolicy\b/i.test(text)) score -= 20;
        }

        if (targetSection === 'wills') {
          if (/\bwills?\b|\btestament\b/i.test(text)) score += 140;
          if (/\/wills\/|tab=wills/i.test(href)) score += 220;
          if (/signed\s+will/i.test(text)) score += 80;
        }

        return { el, score };
      })
      .filter((entry) => entry.score > 40)
      .sort((a, b) => b.score - a.score);

    const candidate = clickables[0]?.el;
    if (!candidate) return '';
    const id = `nw-capital-legacy-section-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    candidate.setAttribute('data-nw-worker-clickable', id);
    return `[data-nw-worker-clickable="${id}"]`;
  }, section).catch(() => '');
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
