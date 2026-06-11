/**
 * Portal worker — policy field extraction + validation.
 * =====================================================
 *
 * Extracted verbatim from scripts/provider-portal-worker.mjs (worker
 * decomposition). Owns label-based extraction, configured-selector reads,
 * provider-adapter snapshot merging, semantic validation, fail-closed
 * current-value enforcement, and legacy row extraction.
 * Behaviour-preserving move (buildExtractionFieldList is the former inline
 * field-list block of extractPolicyRecord, named so the shadow-extraction
 * comparison can reuse the exact same field set).
 */
import {
  getFallbackValueForField,
  getFieldSemanticKind,
  isLikelyCurrencyValue,
  isPlausibleValueForField,
} from '../provider-adapters/field-semantics.mjs';
import { maxPages } from './config.mjs';
import { writeDebugArtifact } from './debug-artifacts.mjs';
import { evaluateWithNavigationRetry, providerAdapterRuntime } from './page-utils.mjs';

export const TEMPLATE_METADATA_COLUMNS = {
  templateVersion: '_NW Template Version',
  policyId: '_NW Policy ID',
  clientId: '_NW Client ID',
  providerId: '_NW Provider ID',
  categoryId: '_NW Category ID',
  normalizedPolicyNumber: '_NW Normalized Policy Number',
};

export async function extractByLabels(page, fields) {
  return evaluateWithNavigationRetry(page, (fieldDefs) => {
    const normalise = (value) => String(value || '').trim().replace(/\s+/g, ' ');
    const normaliseLabel = (value) => normalise(value).toLowerCase().replace(/\s*[:?]\s*$/, '');
    const isUseful = (value) => {
      const text = normalise(value);
      return text && text.length <= 220;
    };
    const matchesLabel = (value, label) => {
      const text = normaliseLabel(value);
      const expected = normaliseLabel(label);
      return Boolean(text && expected) && (
        text === expected
        || text.replace(/\s+[?]\s*$/, '') === expected
        || text.startsWith(`${expected} ?`)
      );
    };
    const readControl = (el) => {
      if (!el) return '';
      if ('value' in el && typeof el.value === 'string') return el.value;
      return el.textContent || '';
    };
    const cleanValue = (value, label) => normalise(value)
      .replace(new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '')
      .replace(/^[:\-\s]+/, '')
      .trim();
    const extractInlineCurrency = (value, label) => {
      const text = normalise(value);
      const expected = normaliseLabel(label);
      if (!text || !expected) return '';
      const normalisedText = normaliseLabel(text);
      const labelIndex = normalisedText.indexOf(expected);
      if (labelIndex < 0) return '';
      const startsWithLabel = normalisedText.startsWith(expected);
      const isCompactLabelValue = text.length <= 180 && labelIndex >= 0;
      if (!startsWithLabel && !isCompactLabelValue) return '';
      const valueText = startsWithLabel
        ? cleanValue(text, label)
        : text.slice(Math.max(0, labelIndex + expected.length));
      const money = valueText.match(/R\s*[\d\s,]+(?:\.\d{1,2})?/i);
      return money ? money[0].trim() : '';
    };
    const findCurrencyNearLabel = (labelElement, _label) => {
      const labelRect = labelElement.getBoundingClientRect();
      const moneyElements = elements
        .map((el) => ({ el, text: normalise(el.textContent), rect: el.getBoundingClientRect() }))
        .filter((entry) => /R\s*[\d\s,]+(?:\.\d{1,2})?/i.test(entry.text))
        .filter((entry) => entry.rect.width > 0 && entry.rect.height > 0)
        .map((entry) => ({
          ...entry,
          distance: Math.abs(entry.rect.top - labelRect.top) + Math.max(0, entry.rect.left - labelRect.right),
        }))
        .sort((a, b) => a.distance - b.distance);
      const sameLine = moneyElements.find((entry) =>
        Math.abs(entry.rect.top - labelRect.top) <= Math.max(24, labelRect.height * 1.5)
        && entry.rect.left >= labelRect.left,
      );
      const nearby = sameLine || moneyElements[0];
      if (!nearby || nearby.distance > 600) return '';
      const match = nearby.text.match(/R\s*[\d\s,]+(?:\.\d{1,2})?/i);
      return match ? match[0].trim() : '';
    };
    const elements = Array.from(document.querySelectorAll('body *'))
      .filter((el) => {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const text = normalise(el.textContent);
        return text && text.length <= 240;
      });

    const result = {};
    for (const field of fieldDefs) {
      const labels = Array.isArray(field.labels) ? field.labels.filter(Boolean) : [];
      let value = '';
      let sourceLabel = '';

      for (const label of labels) {
        const inlineValueElement = elements.find((el) => extractInlineCurrency(el.textContent, label));
        if (inlineValueElement) {
          value = extractInlineCurrency(inlineValueElement.textContent, label);
          sourceLabel = label;
          break;
        }

        const labelElement = elements.find((el) => matchesLabel(el.textContent, label));
        if (!labelElement) continue;

        const nearbyCurrency = findCurrencyNearLabel(labelElement, label);
        if (nearbyCurrency) {
          value = nearbyCurrency;
          sourceLabel = label;
          break;
        }

        const row = labelElement.closest('tr');
        if (row) {
          const cells = Array.from(row.querySelectorAll('th,td'));
          const labelCellIndex = cells.findIndex((cell) => matchesLabel(cell.textContent, label));
          if (labelCellIndex >= 0) {
            const nextCell = cells[labelCellIndex + 1];
            if (isUseful(nextCell?.textContent)) {
              value = cleanValue(nextCell.textContent, label);
              sourceLabel = label;
              break;
            }
          }
        }

        if (labelElement.tagName?.toLowerCase() === 'dt') {
          const detailValue = labelElement.parentElement?.querySelector('dd');
          if (isUseful(readControl(detailValue))) {
            value = cleanValue(readControl(detailValue), label);
            sourceLabel = label;
            break;
          }
        }

        const next = labelElement.nextElementSibling;
        if (isUseful(readControl(next))) {
          value = cleanValue(readControl(next), label);
          sourceLabel = label;
          break;
        }

        const parent = labelElement.parentElement;
        if (parent) {
          const children = Array.from(parent.children);
          const childIndex = children.indexOf(labelElement);
          for (const sibling of children.slice(childIndex + 1, childIndex + 4)) {
            if (isUseful(readControl(sibling))) {
              value = cleanValue(readControl(sibling), label);
              sourceLabel = label;
              break;
            }
          }
          if (value) break;
        }
      }

      const fieldKey = String(field.columnName || field.sourceHeader || '').trim();
      result[fieldKey] = { value, sourceLabel };
    }
    return result;
  }, fields);
}

export function getFieldColumnName(field) {
  return String(field?.columnName || field?.sourceHeader || '').trim();
}

export function getFieldDisplayName(field) {
  return String(field?.targetFieldName || field?.columnName || field?.sourceHeader || field?.targetFieldId || 'Field').trim();
}

export function isPolicyNumberField(field) {
  const signature = [
    field?.targetFieldId,
    field?.targetFieldName,
    field?.columnName,
    field?.sourceHeader,
  ].filter(Boolean).join(' ');
  return /policy\s*(number|no)|reference/i.test(signature);
}

export function isPortalRunBlockingField(field) {
  return getFieldSemanticKind(field) === 'current_value';
}

export function findCurrentValueField(fields = []) {
  return fields.find((field) => getFieldSemanticKind(field) === 'current_value');
}

export function shouldCountAsExtractedBusinessValue(field, value) {
  if (isPolicyNumberField(field)) return false;
  return Boolean(String(value || '').trim());
}

export function applyTemplateMetadata(rawData, item) {
  return {
    ...rawData,
    [TEMPLATE_METADATA_COLUMNS.templateVersion]: '',
    [TEMPLATE_METADATA_COLUMNS.policyId]: String(item?.policyId || '').trim(),
    [TEMPLATE_METADATA_COLUMNS.clientId]: String(item?.clientId || '').trim(),
    [TEMPLATE_METADATA_COLUMNS.providerId]: String(item?.providerId || '').trim(),
    [TEMPLATE_METADATA_COLUMNS.categoryId]: String(item?.categoryId || '').trim(),
    [TEMPLATE_METADATA_COLUMNS.normalizedPolicyNumber]: String(item?.normalizedPolicyNumber || '').trim(),
  };
}

export function countVisibleValues(rawData) {
  return Object.entries(rawData || {})
    .filter(([key]) => !Object.values(TEMPLATE_METADATA_COLUMNS).includes(key))
    .filter(([, value]) => String(value || '').trim())
    .length;
}

export function buildExtractionFieldList(flow, config) {
  const mappingHeaders = Object.keys(config?.fieldMapping || {});
  const configuredFields = Array.isArray(flow.extraction?.fields) ? flow.extraction.fields : [];
  const fieldByHeader = new Map(configuredFields.map((field) => [getFieldColumnName(field), field]));
  return (mappingHeaders.length ? mappingHeaders : configuredFields.map((field) => getFieldColumnName(field)))
    .filter(Boolean)
    .map((columnName) => {
      const existing = fieldByHeader.get(columnName);
      return existing || { sourceHeader: columnName, columnName, labels: [columnName], selector: '' };
    });
}

export async function extractPolicyRecord(page, flow, config, item, providerAdapter) {
  const fields = buildExtractionFieldList(flow, config);

  const labelExtracted = await extractByLabels(page, fields);
  const providerFallback = await providerAdapter?.extractSnapshot?.(page, item, providerAdapterRuntime()) || {};
  if (providerAdapter?.snapshotDebugArtifactName) {
    await writeDebugArtifact(item, providerAdapter.snapshotDebugArtifactName, providerFallback);
  }
  const rawData = {};
  const extractedData = {};
  const missingRunBlockingFields = [];
  let businessValueCount = 0;
  const extractedFieldNames = [];

  for (const field of fields) {
    const columnName = getFieldColumnName(field);
    let selectedValue = '';
    const semanticKind = getFieldSemanticKind(field);
    const fallbackValue = getFallbackValueForField(field, providerFallback);
    if (
      providerAdapter?.requiresMappedCurrentValue
      && ['current_value', 'date_of_inception', 'product_type'].includes(semanticKind)
      && isPlausibleValueForField(field, fallbackValue, item)
    ) {
      selectedValue = fallbackValue;
    }

    const selectorValue = !selectedValue && field.selector ? await readField(page, field).catch(() => '') : '';
    if (!selectedValue && isPlausibleValueForField(field, selectorValue, item)) {
      selectedValue = selectorValue;
    } else {
      const labelValue = labelExtracted[columnName]?.value || '';
      if (!selectedValue && isPlausibleValueForField(field, labelValue, item)) {
        selectedValue = labelValue;
      } else if (!selectedValue && isPlausibleValueForField(field, fallbackValue, item)) {
        selectedValue = fallbackValue;
      }
    }

    rawData[columnName] = selectedValue;
    extractedData[columnName] = selectedValue;

    if (isPolicyNumberField(field)) {
      rawData[columnName] = item.policyNumber;
      extractedData[columnName] = item.policyNumber;
    } else {
      if (shouldCountAsExtractedBusinessValue(field, selectedValue)) {
        businessValueCount += 1;
        extractedFieldNames.push(getFieldDisplayName(field));
      } else if (isPortalRunBlockingField(field)) {
        const labels = Array.isArray(field.labels) ? field.labels.filter(Boolean).join(', ') : columnName;
        missingRunBlockingFields.push(`${getFieldDisplayName(field)} (${labels || columnName})`);
      }
    }
  }

  const currentValueField = findCurrentValueField(fields);
  const fallbackCurrentValue = providerFallback.currentValue || '';
  if (
    providerAdapter?.requiresMappedCurrentValue
    && fallbackCurrentValue
    && currentValueField
    && !String(rawData[getFieldColumnName(currentValueField)] || '').trim()
    && isPlausibleValueForField(currentValueField, fallbackCurrentValue, item)
  ) {
    const columnName = getFieldColumnName(currentValueField);
    rawData[columnName] = fallbackCurrentValue;
    extractedData[columnName] = fallbackCurrentValue;
    businessValueCount += 1;
    extractedFieldNames.push(getFieldDisplayName(currentValueField));
  }

  if (!fields.some((field) => isPolicyNumberField(field))) {
    rawData['Policy Number'] = item.policyNumber;
    extractedData['Policy Number'] = item.policyNumber;
  }

  const hasMappedCurrentValue = currentValueField
    ? isLikelyCurrencyValue(rawData[getFieldColumnName(currentValueField)])
    : false;
  if (providerAdapter?.requiresMappedCurrentValue && !hasMappedCurrentValue) {
    await writeDebugArtifact(item, providerAdapter.currentValueMissingArtifactName || 'provider-current-value-missing', {
      pageUrl: page.url(),
      fieldNames: fields.map((field) => ({
        columnName: getFieldColumnName(field),
        displayName: getFieldDisplayName(field),
        kind: getFieldSemanticKind(field),
        valuePresent: Boolean(String(rawData[getFieldColumnName(field)] || '').trim()),
      })),
      fallback: providerFallback,
    });
    const configuredFields = fields.map((field) => getFieldDisplayName(field)).filter(Boolean).join(', ') || 'none';
    throw providerAdapter.buildMissingMappedCurrentValueError?.({
      fallbackCurrentValue,
      providerFallback,
      configuredFields,
      pageUrl: page.url(),
    }) || new Error(
      `Provider policy page did not produce a mapped current value. `
      + `Configured mapped fields: ${configuredFields}. URL: ${page.url()}.`,
    );
  }

  const effectiveMissingRunBlockingFields = hasMappedCurrentValue ? [] : missingRunBlockingFields;
  if (effectiveMissingRunBlockingFields.length > 0 || businessValueCount === 0) {
    const missing = effectiveMissingRunBlockingFields.length > 0
      ? `Missing portal value field(s): ${effectiveMissingRunBlockingFields.join('; ')}.`
      : 'No business values were extracted from the confirmed policy page.';
    throw new Error(
      `${missing} URL: ${page.url()}. `
      + 'The worker will not stage a completed row without an extracted policy value.',
    );
  }

  const rawDataWithMetadata = applyTemplateMetadata(rawData, item);

  return {
    rawData: rawDataWithMetadata,
    extractedData,
    extractedFieldNames,
  };
}

export async function readField(row, field) {
  const locator = row.locator(field.selector).first();
  if (!(await locator.count())) {
    if (field.required) throw new Error(`Required field selector not found: ${getFieldDisplayName(field)}`);
    return '';
  }

  let value;
  if (field.attribute === 'value') {
    value = await locator.inputValue().catch(() => '');
  } else if (field.attribute && field.attribute !== 'text') {
    value = (await locator.getAttribute(field.attribute)) || '';
  } else {
    value = (await locator.textContent()) || '';
  }

  if (field.transform === 'number') {
    return value.replace(/[^\d.-]/g, '');
  }
  return value.trim();
}

export async function extractRows(page, flow) {
  const { extraction } = flow;
  if (!extraction?.policyRowSelector || !Array.isArray(extraction.fields) || extraction.fields.length === 0) {
    throw new Error('Portal flow extraction selectors are not configured yet.');
  }

  const rows = [];
  const seenPageKeys = new Set();
  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    await page.locator(extraction.policyRowSelector).first().waitFor({ state: 'visible', timeout: 45000 });
    const policyRows = page.locator(extraction.policyRowSelector);
    const count = await policyRows.count();

    for (let index = 0; index < count; index += 1) {
      const row = policyRows.nth(index);
      const record = {};
      for (const field of extraction.fields) {
        record[getFieldColumnName(field)] = await readField(row, field);
      }
      if (Object.values(record).some((value) => String(value || '').trim())) {
        rows.push(record);
      }
    }

    const pageKey = `${page.url()}:${count}:${rows.length}`;
    if (seenPageKeys.has(pageKey) || !flow.navigation?.nextPageSelector) break;
    seenPageKeys.add(pageKey);

    const next = page.locator(flow.navigation.nextPageSelector).first();
    if (!(await next.isVisible().catch(() => false)) || !(await next.isEnabled().catch(() => false))) break;
    await Promise.all([
      next.click(),
      page.waitForLoadState('domcontentloaded').catch(() => undefined),
    ]);
  }

  return rows;
}
