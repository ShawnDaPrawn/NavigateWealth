import { useCallback, useEffect, useState } from 'react';
import { IntegrationFieldBinding, PortalFlowField, PortalProviderFlow } from '../../types';
import { buildPortalFieldsFromBindings } from '@/shared/integrations/binding-utils';
import { getPortalFieldKey, getPortalFieldColumnName } from './portalHelpers';

// Field-selector draft state shared between the Provider Setup tab (where
// selectors are edited) and the Portal Automation tab (where discovery and
// dry-run refinement reuse them). Lives in IntegrationsTab so both tabs see
// the same edits.
export function usePortalFieldSelectors(
  mappingBindings: IntegrationFieldBinding[],
  flow?: PortalProviderFlow,
) {
  const [fieldSelectors, setFieldSelectors] = useState<PortalFlowField[]>([]);

  useEffect(() => {
    if (mappingBindings.length === 0) return;
    setFieldSelectors((currentFields) => {
      const merged = buildPortalFieldsFromBindings(
        mappingBindings,
        currentFields,
      ) as PortalFlowField[];
      const unchanged =
        merged.length === currentFields.length &&
        merged.every(
          (field, index) => JSON.stringify(field) === JSON.stringify(currentFields[index]),
        );
      return unchanged ? currentFields : merged;
    });
  }, [mappingBindings]);

  useEffect(() => {
    if (flow?.extraction?.fields?.length) {
      setFieldSelectors((current) => (current.length === 0 ? flow.extraction.fields : current));
    }
  }, [flow]);

  const updateFieldSelector = useCallback((index: number, selector: string) => {
    setFieldSelectors((prev) =>
      prev.map((field, currentIndex) => (currentIndex === index ? { ...field, selector } : field)),
    );
  }, []);

  const updateFieldRequired = useCallback((index: number, required: boolean) => {
    setFieldSelectors((prev) =>
      prev.map((field, currentIndex) => (currentIndex === index ? { ...field, required } : field)),
    );
  }, []);

  const buildProviderFallbackFields = useCallback((): PortalFlowField[] => {
    const existingByKey = new Map(
      (flow?.extraction?.fields || []).map((field) => [getPortalFieldKey(field), field]),
    );
    const existingByColumn = new Map(
      (flow?.extraction?.fields || []).map((field) => [getPortalFieldColumnName(field), field]),
    );
    const bindingByKey = new Map(
      mappingBindings.map((binding) => [binding.targetFieldId || binding.columnName, binding]),
    );
    const bindingByColumn = new Map(
      mappingBindings.map((binding) => [String(binding.columnName || '').trim(), binding]),
    );

    return fieldSelectors
      .map((field) => {
        const key = getPortalFieldKey(field);
        const columnName = getPortalFieldColumnName(field);
        const existing = existingByKey.get(key) || existingByColumn.get(columnName);
        const binding = bindingByKey.get(key) || bindingByColumn.get(columnName);
        const inheritedSelector = String(
          binding?.portalSelector || existing?.selector || '',
        ).trim();
        const nextSelector =
          field.selector.trim() === inheritedSelector
            ? String(existing?.selector || '').trim()
            : field.selector.trim();
        return {
          sourceHeader: columnName,
          columnName,
          targetFieldId: field.targetFieldId,
          targetFieldName: field.targetFieldName,
          selector: nextSelector,
          labels:
            Array.isArray(existing?.labels) && existing.labels.length > 0 ? existing.labels : [],
          attribute: existing?.attribute || field.attribute || 'text',
          required: field.required === true,
          transform: field.transform || existing?.transform || 'trim',
        };
      })
      .filter((field) => field.columnName);
  }, [fieldSelectors, flow, mappingBindings]);

  return {
    fieldSelectors,
    setFieldSelectors,
    updateFieldSelector,
    updateFieldRequired,
    buildProviderFallbackFields,
  };
}
