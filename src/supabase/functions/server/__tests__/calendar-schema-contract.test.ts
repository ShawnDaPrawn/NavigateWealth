/**
 * Calendar: the database must be able to store what the app can produce.
 *
 * WHY THIS TEST EXISTS
 * --------------------
 * Every "New Event" submission failed with the toast "Failed to create event".
 * `CreateEventSchema` accepted the payload, the route returned it to the
 * service, and the INSERT then died against production for three independent
 * reasons — none of which any test could see, because validation and the
 * database schema were only ever checked separately:
 *
 *   1. `createEvent` always sends `recurrence_rule`; `public.events` had no
 *      such column (only `reminders` did) -> 42703 / PGRST204 on EVERY create.
 *   2. The form's Location Type offers "Virtual" and submits `virtual`;
 *      `location_type` had no such member -> 22P02.
 *   3. The form's Event Type offers "Consultation"/"Deadline" and the Filters
 *      drawer filters on 'birthday'/'renewal'; `event_type` had none of them
 *      -> 22P02. The filter reaches the DB as `.in('event_type', ...)`, so
 *      ticking "Birthday" broke the calendar *read* too.
 *
 * Reminders carried the identical drift — `CreateReminderSchema` *defaults*
 * priority to 'medium', which `reminder_priority` did not have — so the live
 * `POST /calendar/reminders` route would have failed the same way on a value
 * the caller never set. Both are fixed by migration
 * `20260902194331_calendar_events_schema_alignment`.
 *
 * The rule this locks in: a value the UI can pick, or a column the service
 * writes, must exist in the migrations. Adding one to the app without a
 * matching migration fails here instead of at runtime.
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/calendar-schema-contract.test.ts
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  EventTypeSchema,
  LocationTypeSchema,
  EventStatusSchema,
  ReminderTypeSchema,
  ReminderPrioritySchema,
  ReminderStatusSchema,
} from '../shared-calendar-validation.ts';
import {
  EVENT_TYPE_LABELS,
  LOCATION_TYPE_LABELS,
} from '../../../../components/admin/modules/calendar/constants';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const MIGRATIONS_DIR = resolve(REPO_ROOT, 'supabase/migrations');

/** Every migration, oldest first — the schema as `supabase db push` builds it. */
const MIGRATION_SQL = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(resolve(MIGRATIONS_DIR, f), 'utf8'))
  .join('\n');

/** Labels of a public enum: its CREATE TYPE plus every later ADD VALUE. */
function dbEnumLabels(typeName: string): Set<string> {
  const labels = new Set<string>();

  const created = new RegExp(`CREATE TYPE public\\.${typeName} AS ENUM\\s*\\(([^)]*)\\)`, 'i').exec(
    MIGRATION_SQL,
  );
  if (created) {
    for (const m of created[1].matchAll(/'([^']+)'/g)) labels.add(m[1]);
  }

  const added = new RegExp(
    `ALTER TYPE public\\.${typeName}\\s+ADD VALUE(?:\\s+IF NOT EXISTS)?\\s+'([^']+)'`,
    'gi',
  );
  for (const m of MIGRATION_SQL.matchAll(added)) labels.add(m[1]);

  return labels;
}

/** Columns of a public table: its CREATE TABLE body plus every later ADD COLUMN. */
function dbColumns(table: string): Set<string> {
  const cols = new Set<string>();

  const body = new RegExp(
    `CREATE TABLE IF NOT EXISTS public\\.${table}\\s*\\(([\\s\\S]*?)\\n\\);`,
    'i',
  ).exec(MIGRATION_SQL);
  if (body) {
    for (const line of body[1].split('\n')) {
      const m = /^\s{2,}([a-z_]+)\s+\S/.exec(line);
      // Skip table-level constraints, which are not columns.
      if (m && m[1] !== 'constraint') cols.add(m[1]);
    }
  }

  const added = new RegExp(
    `ALTER TABLE public\\.${table}\\s+ADD COLUMN(?:\\s+IF NOT EXISTS)?\\s+([a-z_]+)`,
    'gi',
  );
  for (const m of MIGRATION_SQL.matchAll(added)) cols.add(m[1]);

  return cols;
}

/** The column names a `.from('<table>').insert({...})` in the service writes. */
function servicePayloadColumns(table: string): string[] {
  const service = readFileSync(
    resolve(REPO_ROOT, 'src/supabase/functions/server/calendar-service.ts'),
    'utf8',
  );
  const block = new RegExp(
    `\\.from\\('${table}'\\)\\s*\\.insert\\(\\{([\\s\\S]*?)\\n\\s*\\}\\)`,
  ).exec(service);
  expect(block, `could not locate the ${table} insert in calendar-service.ts`).not.toBeNull();
  return [...block![1].matchAll(/^\s*([a-z_]+):/gm)].map((m) => m[1]);
}

describe('calendar migrations parse into something real', () => {
  // Without these, every assertion below would pass vacuously on an empty set.
  it('finds the calendar tables and their enums in the migrations', () => {
    expect(dbColumns('events').size).toBeGreaterThan(10);
    expect(dbColumns('reminders').size).toBeGreaterThan(10);
    expect(dbEnumLabels('event_type').size).toBeGreaterThan(5);
    expect(dbEnumLabels('location_type').size).toBeGreaterThan(3);
    expect(dbEnumLabels('event_status').size).toBeGreaterThan(2);
    expect(dbEnumLabels('reminder_type').size).toBeGreaterThan(4);
    expect(dbEnumLabels('reminder_priority').size).toBeGreaterThan(2);
    expect(dbEnumLabels('reminder_status').size).toBeGreaterThan(2);
  });
});

describe('the calendar tables store every column the service writes', () => {
  it.each([
    ['events', 'recurrence_rule'],
    // The reminders insert is unreachable from today's UI but the route is live.
    ['reminders', 'assignee_id'],
  ])('the %s insert names no column the migrations do not create', (table, mustWrite) => {
    const inserted = servicePayloadColumns(table);
    expect(inserted.length, `parsed no inserted columns for ${table}`).toBeGreaterThan(5);
    // Guards the regex against silently matching a different, shorter object.
    expect(inserted).toContain(mustWrite);

    const columns = dbColumns(table);
    expect(inserted.filter((c) => !columns.has(c))).toEqual([]);
  });
});

describe('calendar enums cover every value the app can send', () => {
  it.each([
    ['event_type', EventTypeSchema.options],
    ['location_type', LocationTypeSchema.options],
    ['event_status', EventStatusSchema.options],
    ['reminder_type', ReminderTypeSchema.options],
    ['reminder_priority', ReminderPrioritySchema.options],
    ['reminder_status', ReminderStatusSchema.options],
  ])('public.%s covers the validation schema', (typeName, options) => {
    const labels = dbEnumLabels(typeName as string);
    expect((options as string[]).filter((v) => !labels.has(v))).toEqual([]);
  });

  // The validation schemas are the API contract; these are what a user can
  // actually click. Both the New Event form and the Filters drawer render
  // every key of these maps, and the filter values reach the database through
  // `.in('event_type', ...)`, so an unbacked key breaks reads as well as writes.
  it('public.event_type covers every Event Type the UI offers', () => {
    const labels = dbEnumLabels('event_type');
    expect(Object.keys(EVENT_TYPE_LABELS).filter((v) => !labels.has(v))).toEqual([]);
  });

  it('public.location_type covers every Location Type the UI offers', () => {
    const labels = dbEnumLabels('location_type');
    expect(Object.keys(LOCATION_TYPE_LABELS).filter((v) => !labels.has(v))).toEqual([]);
  });
});
