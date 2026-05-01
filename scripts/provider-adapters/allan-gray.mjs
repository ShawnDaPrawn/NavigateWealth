export const allanGrayAdapter = {
  id: 'allan-gray',
  label: 'Allan Gray',
  snapshotDebugArtifactName: 'allan-gray-snapshot',
  currentValueMissingArtifactName: 'allan-gray-current-value-missing',
  requiresMappedCurrentValue: true,

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

    return /allan\s*gray|allangray\.co\.za/i.test(providerText);
  },

  isProviderPage(page) {
    return /allangray\.co\.za/i.test(page.url());
  },

  async extractSnapshot(page, item, runtime) {
    if (!this.isProviderPage(page)) return {};
    return extractAllanGraySnapshot(page, item, runtime);
  },

  async findDocumentClickTarget(page, options, runtime) {
    if (options?.step?.target !== 'download_button' || !this.isProviderPage(page)) {
      return null;
    }
    return findAllanGrayDownloadAction(page, runtime);
  },

  buildMissingMappedCurrentValueError(details) {
    const {
      fallbackCurrentValue,
      providerFallback,
      configuredFields,
      pageUrl,
    } = details || {};

    return new Error(
      `Allan Gray policy page did not produce a mapped current value. `
      + `Detected fallback value: ${fallbackCurrentValue ? 'yes' : 'no'}`
      + `${providerFallback?.currentValueSource ? ` (${providerFallback.currentValueSource})` : ''}. `
      + `Configured mapped fields: ${configuredFields || 'none'}. URL: ${pageUrl}. `
      + 'The worker will not mark this policy as extracted until the current value is captured into a mapped field.',
    );
  },
};

async function findAllanGrayDownloadAction(page, runtime) {
  const { evaluateWithNavigationRetry } = runtime;

  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' })).catch(() => undefined);
  await page.waitForTimeout(500);

  const inferredSelector = await evaluateWithNavigationRetry(page, () => {
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
    const iconText = (el) => normalise([
      el.textContent,
      el.getAttribute('aria-label'),
      el.getAttribute('title'),
      el.getAttribute('download'),
      el.getAttribute('data-testid'),
      el.getAttribute('mattooltip'),
      el.getAttribute('ng-reflect-message'),
      el.getAttribute('class'),
      ...Array.from(el.querySelectorAll('mat-icon, svg, use, i, span')).map((icon) => [
        icon.textContent,
        icon.getAttribute('aria-label'),
        icon.getAttribute('title'),
        icon.getAttribute('data-icon'),
        icon.getAttribute('href'),
        icon.getAttribute('xlink:href'),
        icon.getAttribute('class'),
      ].filter(Boolean).join(' ')),
    ].filter(Boolean).join(' '));
    const clickables = Array.from(document.querySelectorAll('a, button, [role="link"], [role="button"], [role="menuitem"], [tabindex], [onclick], .mat-icon-button, .mat-mdc-icon-button'))
      .filter(isVisible)
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const text = iconText(el);
        const toolbarPosition = rect.top >= 90
          && rect.top <= 285
          && rect.left >= window.innerWidth * 0.68;
        const accountToolbarDownloadZone = rect.top >= 145
          && rect.top <= 245
          && rect.left >= window.innerWidth * 0.82
          && rect.width >= 24
          && rect.width <= 80
          && rect.height >= 24
          && rect.height <= 80;
        const iconLike = Boolean(el.querySelector('svg, mat-icon, i, .material-icons, .mat-icon, [class*="icon" i]'))
          || /download|file_download|cloud_download|picture_as_pdf|pdf/i.test(text);
        const excluded = /zar|last\s+1\s+year|agra\d|account|client|user|profile|logout|south africa/i.test(text);
        return {
          el,
          text,
          rect,
          score: (accountToolbarDownloadZone ? 160 : 0)
            + (toolbarPosition ? 80 : 0)
            + (/download|file_download|cloud_download|picture_as_pdf|pdf/i.test(text) ? 60 : 0)
            + (iconLike ? 30 : 0)
            + Math.round(rect.left / Math.max(window.innerWidth, 1) * 10)
            - (excluded ? 200 : 0),
        };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);
    const candidate = clickables[0]?.el;
    if (!candidate) return '';
    const id = `nw-allan-gray-download-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    candidate.setAttribute('data-nw-worker-clickable', id);
    return `[data-nw-worker-clickable="${id}"]`;
  }).catch(() => '');

  if (!inferredSelector) return null;
  const locator = page.locator(inferredSelector).first();
  if (await locator.isVisible({ timeout: 1000 }).catch(() => false)) return locator;
  return null;
}

async function extractAllanGraySnapshot(page, item, runtime) {
  const { evaluateWithNavigationRetry } = runtime;

  return evaluateWithNavigationRetry(page, (policyNumber) => {
    const normalise = (value) => String(value || '').trim().replace(/\s+/g, ' ');
    const extractMoney = (value) => {
      const match = normalise(value).match(/R\s*[\d\s,]+(?:\.\d{1,2})?/i);
      return match ? match[0].trim() : '';
    };
    const extractDate = (value) => {
      const match = normalise(value).match(/\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\b/);
      return match ? match[0].trim() : '';
    };
    const rawBodyText = document.body?.innerText || document.body?.textContent || '';
    const bodyText = normalise(rawBodyText);
    const bodyLines = String(rawBodyText)
      .split(/\r?\n/)
      .map((line) => normalise(line))
      .filter(Boolean);
    const result = {
      policyNumber: normalise(policyNumber),
      productType: '',
      dateOfInception: '',
      currentValue: '',
      source: 'allan_gray_snapshot',
      currentValueSource: '',
      diagnostics: {
        url: window.location.href,
        title: document.title,
        hasPolicyNumber: Boolean(policyNumber && bodyText.includes(policyNumber)),
        labelledCandidates: [],
        amountCandidates: [],
        textSnippets: [],
      },
    };

    const labelledValue = (labelRegex, valueRegex) => {
      const labelMatch = bodyText.match(labelRegex);
      if (!labelMatch || typeof labelMatch.index !== 'number') return '';
      const segment = bodyText.slice(labelMatch.index, Math.min(bodyText.length, labelMatch.index + 260));
      const valueMatch = segment.match(valueRegex);
      result.diagnostics.textSnippets.push(segment.slice(0, 180));
      return valueMatch ? valueMatch[0].trim() : '';
    };
    const lineValueAfter = (labelRegex, valueRegex, label) => {
      for (let index = 0; index < bodyLines.length; index += 1) {
        if (!labelRegex.test(bodyLines[index])) continue;
        const segment = bodyLines.slice(index, index + 5).join(' ');
        const valueMatch = segment.match(valueRegex);
        result.diagnostics.textSnippets.push(`${label || labelRegex}: ${segment}`.slice(0, 220));
        if (valueMatch) return valueMatch[0].trim();
      }
      return '';
    };

    const ownText = (el) => Array.from(el.childNodes || [])
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent || '')
      .join(' ');
    const isVisibleElement = (el) => {
      if (!(el instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && rect.width > 0
        && rect.height > 0;
    };
    const visibleEntries = Array.from(document.querySelectorAll('body *')).filter(isVisibleElement).map((el) => {
      const rect = el.getBoundingClientRect();
      const text = normalise(ownText(el) || el.getAttribute('aria-label') || el.getAttribute('title') || el.innerText || el.textContent || '');
      return {
        text,
        rect: {
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height,
        },
      };
    }).filter((entry) => entry.text);

    const addCandidate = (value, source, score = 0, context = '') => {
      if (!value) return '';
      result.diagnostics.amountCandidates.push({
        value,
        source,
        score,
        context: normalise(context).slice(0, 180),
      });
      return value;
    };

    const nearestMoneyAfterLabel = (labelRegex) => {
      const labels = visibleEntries.filter((entry) => labelRegex.test(entry.text) && !extractMoney(entry.text));
      const monies = visibleEntries
        .map((entry) => ({ ...entry, money: extractMoney(entry.text) }))
        .filter((entry) => entry.money);
      const candidates = [];
      for (const label of labels) {
        for (const money of monies) {
          const sameLine = Math.abs(money.rect.top - label.rect.top) <= 36;
          const justBelow = money.rect.top >= label.rect.top && money.rect.top - label.rect.bottom <= 90;
          const toRight = money.rect.left >= label.rect.left;
          const verticalDistance = Math.abs(money.rect.top - label.rect.top);
          const horizontalDistance = Math.max(0, money.rect.left - label.rect.right);
          const belowDistance = Math.max(0, money.rect.top - label.rect.bottom);
          if ((sameLine && toRight) || justBelow) {
            candidates.push({
              value: money.money,
              label: label.text,
              context: money.text,
              distance: verticalDistance + horizontalDistance + belowDistance,
            });
          }
        }
      }
      candidates.sort((a, b) => a.distance - b.distance);
      const best = candidates[0];
      return best ? addCandidate(best.value, `near ${best.label}`, best.distance, best.context) : '';
    };

    const labelledMoney = (label, labelRegex) => {
      const value = lineValueAfter(labelRegex, /R\s*[\d\s,]+(?:\.\d{1,2})?/i, label)
        || labelledValue(labelRegex, /R\s*[\d\s,]+(?:\.\d{1,2})?/i);
      return value ? addCandidate(value, label, 0, label) : '';
    };

    result.currentValue = labelledMoney('Total value', /\bTotal\s+value\s*\??/i)
      || labelledMoney('Closing balance', /\bClosing\s+balance\b/i)
      || nearestMoneyAfterLabel(/\bTotal\s+value\s*\??/i)
      || nearestMoneyAfterLabel(/\bClosing\s+balance\b/i)
      || nearestMoneyAfterLabel(/\bValue\b/i);
    result.currentValueSource = result.diagnostics.amountCandidates[0]?.source || '';
    result.dateOfInception = lineValueAfter(/\bInception\s+date\b/i, /\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\b/i, 'Inception date')
      || lineValueAfter(/\bDate\s+of\s+inception\b/i, /\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\b/i, 'Date of inception')
      || labelledValue(/\bInception\s+date\b/i, /\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\b/i)
      || labelledValue(/\bDate\s+of\s+inception\b/i, /\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\b/i);

    const rows = Array.from(document.querySelectorAll('tr')).map((row) =>
      Array.from(row.querySelectorAll('th,td'))
        .map((cell) => normalise(cell.innerText || cell.textContent || ''))
        .filter(Boolean),
    ).filter((cells) => cells.length > 0);
    const policyRow = rows.find((cells) =>
      cells.some((cell) => policyNumber && normalise(cell).includes(policyNumber))
      || cells.some((cell) => /retirement\s+annuity/i.test(cell))
      || cells.some((cell) => extractMoney(cell)),
    );
    if (policyRow) {
      const productCell = policyRow.find((cell) =>
        /retirement\s+annuity|pension|provident|preservation|living\s+annuity/i.test(cell)
        && !extractMoney(cell)
        && !extractDate(cell)
        && !/account\s*(no|number)|value|date/i.test(cell)
      );
      const dateCell = policyRow.find((cell) => extractDate(cell));
      const valueCell = [...policyRow].reverse().find((cell) => extractMoney(cell));
      result.productType = productCell || result.productType;
      result.dateOfInception = dateCell ? extractDate(dateCell) : result.dateOfInception;
      if (valueCell && !result.currentValue) {
        result.currentValue = addCandidate(extractMoney(valueCell), 'policy row', 20, policyRow.join(' | '));
        result.currentValueSource = 'policy row';
      }
    }

    if (!result.productType) {
      const productMatch = bodyText.match(/\bRetirement\s+Annuity\s+Fund\b/i);
      result.productType = productMatch ? productMatch[0].trim() : '';
    }
    if (!result.currentValue) {
      const allAmounts = Array.from(bodyText.matchAll(/R\s*[\d\s,]+(?:\.\d{1,2})?/gi)).map((match) => match[0].trim());
      result.currentValue = addCandidate(allAmounts[0] || '', 'first page amount fallback', 100, bodyText.slice(0, 220));
      result.currentValueSource = result.currentValue ? 'first page amount fallback' : '';
    }

    result.diagnostics.labelledCandidates = visibleEntries
      .filter((entry) => /\b(total\s+value|closing\s+balance|inception\s+date|retirement\s+annuity|value)\b/i.test(entry.text))
      .slice(0, 30)
      .map((entry) => ({
        text: entry.text.slice(0, 180),
        rect: entry.rect,
        money: extractMoney(entry.text),
        date: extractDate(entry.text),
      }));

    return result;
  }, String(item?.policyNumber || '')).catch(() => ({}));
}
