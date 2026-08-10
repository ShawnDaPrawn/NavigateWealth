/**
 * CreateEventSchema — attendees shape regression guard
 * =====================================================
 *
 * The calendar UI builds `attendees` as a JSONB map keyed by client ID
 * (`{ "<client-id>": { name, email, type } }`) and always includes the field
 * in the create payload — even as an empty `{}` when no client is attached.
 *
 * The validation schema previously required `z.array(...)`, so every create
 * from the admin form (including the common "video call meeting for a client"
 * case) failed validation and the route returned HTTP 400, surfacing as the
 * "Failed to create event" toast. This guards the map shape being accepted.
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/calendar-create-event-validation.test.ts
 */
import { describe, it, expect } from 'vitest';

import { CreateEventSchema, UpdateEventSchema } from '../shared-calendar-validation.ts';

const base = {
  title: 'Investment Review',
  description: null,
  event_type: 'meeting' as const,
  start_at: '2026-08-01T09:00:00.000Z',
  end_at: '2026-08-01T10:00:00.000Z',
  location_type: 'video' as const,
  location: null,
  video_link: 'https://meet.example.com/abc',
  client_id: 'client-uuid-1',
  recurrence_rule: null,
};

describe('CreateEventSchema attendees', () => {
  it('accepts a video-call meeting with a client attendee (map keyed by client ID)', () => {
    const result = CreateEventSchema.safeParse({
      ...base,
      attendees: {
        'client-uuid-1': { name: 'Jane Doe', email: 'jane@example.com', type: 'client' },
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts an empty attendees map (no client attached)', () => {
    const result = CreateEventSchema.safeParse({ ...base, client_id: null, attendees: {} });
    expect(result.success).toBe(true);
  });

  it('still accepts an attendees array for forward compatibility', () => {
    const result = CreateEventSchema.safeParse({
      ...base,
      attendees: [{ name: 'Jane Doe', email: 'jane@example.com', type: 'client' }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts a payload with no attendees field at all', () => {
    const { client_id: _client_id, ...noClient } = base;
    const result = CreateEventSchema.safeParse(noClient);
    expect(result.success).toBe(true);
  });
});

describe('UpdateEventSchema attendees', () => {
  it('accepts an attendees map on update', () => {
    const result = UpdateEventSchema.safeParse({
      attendees: {
        'client-uuid-1': { name: 'Jane Doe', email: 'jane@example.com', type: 'client' },
      },
    });
    expect(result.success).toBe(true);
  });
});
