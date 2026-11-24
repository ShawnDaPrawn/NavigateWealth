import { describe, expect, it } from 'vitest';
import {
  clientsInGroups,
  estimateGroupRecipients,
  getDraftGroups,
  groupSelectionUpdate,
  toggleGroup,
} from '../groupSelection';
import type { Client, ClientGroup } from '../types';

const group = (id: string, overrides: Partial<ClientGroup> = {}): ClientGroup => ({
  id,
  name: id,
  description: '',
  type: 'custom',
  clientIds: [],
  clientCount: 0,
  ...overrides,
});

const client = (id: string) => ({ id, firstName: id, email: `${id}@x.com` }) as Client;

describe('groupSelection', () => {
  it('reads old single-group drafts as a one-item selection', () => {
    const g = group('a');
    expect(getDraftGroups({ selectedGroup: g })).toEqual([g]);
    expect(getDraftGroups({})).toEqual([]);
    expect(getDraftGroups({ selectedGroup: g, selectedGroups: [group('b')] })[0].id).toBe('b');
  });

  it('toggles a group in and out of the selection', () => {
    const a = group('a');
    const b = group('b');
    expect(toggleGroup([a], b).map((g) => g.id)).toEqual(['a', 'b']);
    expect(toggleGroup([a, b], a).map((g) => g.id)).toEqual(['b']);
  });

  it("reports a single group's own count", () => {
    expect(estimateGroupRecipients([group('a', { clientIds: ['1'], clientCount: 7 })])).toBe(7);
  });

  it('counts a client in two groups once, and external emails case-insensitively', () => {
    const a = group('a', {
      clientIds: ['1', '2'],
      externalContacts: [{ email: 'Ext@x.com', source: 'n', subscribedAt: '' }],
    });
    const b = group('b', {
      clientIds: ['2', '3'],
      externalContacts: [{ email: 'ext@x.com', source: 'n', subscribedAt: '' }],
    });
    expect(estimateGroupRecipients([a, b])).toBe(4);
  });

  it('treats All Clients as everyone', () => {
    const all = group('sys_all', { type: 'system', clientCount: 184 });
    expect(estimateGroupRecipients([all, group('b', { clientIds: ['1'] })])).toBe(184);
    const clients = [client('1'), client('2')];
    expect(clientsInGroups([all], clients)).toBe(clients);
  });

  it('writes the selection, the first group and the de-duplicated members', () => {
    const a = group('a', { clientIds: ['1', '2'] });
    const b = group('b', { clientIds: ['2', '3'] });
    const update = groupSelectionUpdate([a, b], [client('1'), client('2'), client('3')]);
    expect(update.selectedGroup).toBe(a);
    expect(update.selectedGroups).toEqual([a, b]);
    expect(update.selectedRecipients.map((c) => c.id)).toEqual(['1', '2', '3']);
  });
});
