export const brightRockAdapter = {
  id: 'brightrock',
  label: 'BrightRock',
  defaultLoginUrl: 'https://iris.brightrock.co.za/',
  snapshotDebugArtifactName: 'brightrock-snapshot',

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

    return /bright\s*rock|brightrock/i.test(providerText);
  },

  isProviderPage(page) {
    return /bright\s*rock|brightrock/i.test(page.url());
  },

  async extractSnapshot(page, item, runtime) {
    return extractBrightRockSnapshot(page, item, runtime);
  },
};

async function extractBrightRockSnapshot(page, item, runtime) {
  const { evaluateWithNavigationRetry } = runtime;

  return evaluateWithNavigationRetry(page, (policyNumber) => {
    const normalise = (value) => String(value || '').trim().replace(/\s+/g, ' ');
    const moneyRegex = /R\s*\d[\d\s,]*(?:\.\d{1,2})?/i;
    const rawBodyText = document.body?.innerText || document.body?.textContent || '';
    const bodyText = normalise(rawBodyText);
    const bodyLines = String(rawBodyText)
      .split(/\r?\n/)
      .map((line) => normalise(line))
      .filter(Boolean);

    const result = {
      policyNumber: normalise(policyNumber),
      premium: '',
      lifeCover: '',
      disability: '',
      severeIllness: '',
      temporaryIcb: '',
      source: 'brightrock_policy_structure',
      diagnostics: {
        url: window.location.href,
        title: document.title,
        hasPolicyDetails: /\bpolicy details\b/i.test(bodyText),
        hasPolicyStructure: /\bpolicy structure\b/i.test(bodyText),
        hasPolicyNumber: Boolean(policyNumber && bodyText.includes(policyNumber)),
        textSnippets: [],
      },
    };

    const extractMoney = (value) => {
      const match = normalise(value).match(moneyRegex);
      return match ? match[0].trim() : '';
    };
    const moneyValues = (value) => Array.from(normalise(value).matchAll(/R\s*\d[\d\s,]*(?:\.\d{1,2})?/gi))
      .map((match) => match[0].trim());
    const findMoneyAfterLabel = (labelRegex, maxLines = 4) => {
      for (let index = 0; index < bodyLines.length; index += 1) {
        if (!labelRegex.test(bodyLines[index])) continue;
        const segment = bodyLines.slice(index, index + maxLines).join(' ');
        const money = extractMoney(segment);
        result.diagnostics.textSnippets.push(segment.slice(0, 220));
        if (money) return money;
      }
      const match = bodyText.match(labelRegex);
      if (match && typeof match.index === 'number') {
        const segment = bodyText.slice(match.index, Math.min(bodyText.length, match.index + 220));
        const money = extractMoney(segment);
        result.diagnostics.textSnippets.push(segment.slice(0, 220));
        if (money) return money;
      }
      return '';
    };

    result.premium = findMoneyAfterLabel(/\bcurrent\s+monthly\s+premium\b/i);

    const coverSummaryRoot = Array.from(document.querySelectorAll('section, main, article, div, table'))
      .find((el) => /\bcover summary\b/i.test(normalise(el.textContent || '')));
    const coverText = normalise(coverSummaryRoot?.textContent || bodyText);

    const isVisibleElement = (el) => {
      if (!(el instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && rect.width > 0
        && rect.height > 0;
    };
    const visibleEntries = Array.from((coverSummaryRoot || document.body).querySelectorAll('*'))
      .filter(isVisibleElement)
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const text = normalise(el.innerText || el.textContent || '');
        return {
          text,
          rect: {
            top: rect.top,
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
            width: rect.width,
            height: rect.height,
            centerX: rect.left + (rect.width / 2),
            centerY: rect.top + (rect.height / 2),
          },
        };
      })
      .filter((entry) => entry.text);

    const findHeader = (regex) => visibleEntries
      .filter((entry) => regex.test(entry.text) && !extractMoney(entry.text))
      .sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left)[0];
    const findRowLabel = (regex) => visibleEntries
      .filter((entry) => regex.test(entry.text) && !extractMoney(entry.text))
      .sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left)[0];
    const moneyEntries = visibleEntries
      .map((entry) => ({ ...entry, values: moneyValues(entry.text) }))
      .filter((entry) => entry.values.length > 0);
    const extractVisualGridMoney = (headerRegex, rowRegex, valueKind) => {
      const header = findHeader(headerRegex);
      const row = findRowLabel(rowRegex);
      if (!header || !row) return '';
      const rowTop = row.rect.top - 28;
      const rowBottom = row.rect.bottom + 72;
      const candidates = moneyEntries
        .filter((entry) => entry.rect.centerY >= rowTop && entry.rect.centerY <= rowBottom)
        .map((entry) => ({
          ...entry,
          distance: Math.abs(entry.rect.centerX - header.rect.centerX)
            + (entry.rect.centerX < row.rect.right ? 600 : 0),
        }))
        .sort((a, b) => a.distance - b.distance);
      const best = candidates[0];
      if (!best || best.distance > 420) return '';
      result.diagnostics.textSnippets.push(`${header.text} / ${row.text}: ${best.text}`.slice(0, 240));
      if (valueKind === 'monthly') {
        const monthlyIndex = best.text.toLowerCase().indexOf('monthly');
        if (monthlyIndex >= 0) {
          const beforeMonthly = best.text.slice(0, monthlyIndex);
          const monthlyValues = moneyValues(beforeMonthly);
          if (monthlyValues.length > 0) return monthlyValues[monthlyValues.length - 1];
        }
      }
      return best.values[0] || '';
    };

    const extractFromCoverSegment = (startRegex, endRegex, pick = 'first') => {
      const start = coverText.search(startRegex);
      if (start < 0) return '';
      const tail = coverText.slice(start);
      const end = endRegex ? tail.search(endRegex) : -1;
      const segment = end > 0 ? tail.slice(0, end) : tail.slice(0, 900);
      const values = moneyValues(segment);
      result.diagnostics.textSnippets.push(segment.slice(0, 240));
      if (values.length === 0) return '';
      return pick === 'last' ? values[values.length - 1] : values[0];
    };

    result.temporaryIcb = extractVisualGridMoney(
      /that\s+you\s+can\s+recover\s+from/i,
      /cover\s+for\s+household.*death-related\s+needs/i,
      'monthly',
    ) || extractFromCoverSegment(
      /that\s+you\s+can\s+recover\s+from/i,
      /that's\s+permanent|that's\s+caused\s+by\s+death|additional\s+expense\s+needs/i,
      'first',
    );
    result.disability = extractVisualGridMoney(
      /that's\s+permanent/i,
      /cover\s+for\s+household.*death-related\s+needs/i,
      'lump_sum',
    ) || extractFromCoverSegment(
      /that's\s+permanent/i,
      /that's\s+caused\s+by\s+death|additional\s+expense\s+needs/i,
      'first',
    );
    result.lifeCover = extractVisualGridMoney(
      /that's\s+caused\s+by\s+death/i,
      /cover\s+for\s+household.*death-related\s+needs/i,
      'lump_sum',
    ) || extractFromCoverSegment(
      /that's\s+caused\s+by\s+death/i,
      /additional\s+expense\s+needs|this\s+table\s+shows/i,
      'first',
    );
    result.severeIllness = extractVisualGridMoney(
      /that\s+you\s+can\s+recover\s+from/i,
      /additional\s+expense\s+needs/i,
      'lump_sum',
    ) || extractFromCoverSegment(
      /additional\s+expense\s+needs/i,
      /this\s+table\s+shows/i,
      'first',
    );

    return result;
  }, String(item?.policyNumber || '')).catch(() => ({}));
}
