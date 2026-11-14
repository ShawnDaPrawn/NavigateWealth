/**
 * Saved custom reports. A definition picks one of the built-in exports as
 * its data source and the columns to keep; running it reuses that export's
 * route, so no new query path exists for custom reports.
 */

import {
  reportDefinitions,
  type ReportDefinition,
} from './repositories/report-definitions-repository.ts';

/** A practice has a handful of saved reports; one page covers them. */
const LIST_LIMIT = 200;

export async function listReportDefinitions(): Promise<ReportDefinition[]> {
  const page = await reportDefinitions.list({ limit: LIST_LIMIT });
  return page.items.sort((a, b) => a.name.localeCompare(b.name));
}

export async function createReportDefinition(
  input: Pick<ReportDefinition, 'name' | 'category' | 'dataSource' | 'columns' | 'format'>,
  createdBy: string,
  now: Date = new Date(),
): Promise<ReportDefinition> {
  const definition: ReportDefinition = {
    id: crypto.randomUUID(),
    name: input.name,
    category: input.category,
    dataSource: input.dataSource,
    columns: [...new Set(input.columns)],
    format: 'xlsx',
    createdBy,
    createdAt: now.toISOString(),
  };
  await reportDefinitions.put(definition.id, definition);
  return definition;
}

/** Returns false when there was nothing to delete. */
export async function deleteReportDefinition(id: string): Promise<boolean> {
  const existing = await reportDefinitions.get(id);
  if (!existing) return false;
  await reportDefinitions.remove(id);
  return true;
}
