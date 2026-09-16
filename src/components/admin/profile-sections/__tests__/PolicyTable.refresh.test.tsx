/**
 * PolicyTable — Per-Policy Refresh Control
 * ========================================
 *
 * The smallest unit of portal work used to be every policy a provider has in a
 * category, so an adviser looking at one stale value had no way to say "just
 * refresh this one". This is the control that fixes that, and it sits on the
 * policy row in the client record rather than three tabs away in admin.
 *
 * Pinned here: the control only appears when a refresh handler is supplied, it
 * hands back the policy it belongs to, it is suppressed for archived policies
 * (which are not queued by the server either), and it cannot be fired twice
 * while a refresh is already in flight.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@/test/utils';
import { PolicyTable, type PolicyRecord, type SchemaField } from '../PolicyTable';

const structure: SchemaField[] = [{ id: 'current_value', name: 'Current Value', type: 'currency' }];

const policy: PolicyRecord = {
  id: 'pol-1',
  categoryId: 'retirement_pre',
  providerId: 'allan-gray',
  providerName: 'Allan Gray',
  archived: false,
  data: { current_value: 125000 },
};

const REFRESH_TITLE = "Refresh this policy's values from the provider portal";

function makeProps(over: Partial<Parameters<typeof PolicyTable>[0]> = {}) {
  return {
    title: 'Pre-Retirement',
    policies: [policy],
    structure,
    clientId: 'client-1',
    onEdit: vi.fn(),
    onArchive: vi.fn(),
    onReinstate: vi.fn(),
    onDelete: vi.fn(),
    formatFieldValue: (_field: SchemaField, value: unknown) => String(value ?? ''),
    ...over,
  } as Parameters<typeof PolicyTable>[0];
}

describe('PolicyTable — provenance on the row', () => {
  it('says nothing when the policy has never been updated by an automated source', () => {
    render(<PolicyTable {...makeProps()} />);
    expect(screen.queryByText(/Updated from the/)).toBeNull();
  });

  it('names the provider portal and the date of the last portal update', () => {
    render(
      <PolicyTable
        {...makeProps({
          policies: [
            {
              ...policy,
              integrationSyncHistory: [
                {
                  runId: 'r1',
                  providerId: 'allan-gray',
                  categoryId: 'retirement_pre',
                  publishedAt: '2026-09-05T10:52:58.410Z',
                  source: 'portal',
                  fieldsApplied: ['current_value'],
                },
              ],
            },
          ],
        })}
      />,
    );
    expect(screen.getByText(/Updated from the provider portal on/)).toBeDefined();
  });

  it('distinguishes a value that came from a policy document', () => {
    render(
      <PolicyTable
        {...makeProps({
          policies: [
            {
              ...policy,
              integrationSyncHistory: [
                {
                  runId: 'd1',
                  providerId: 'allan-gray',
                  categoryId: 'retirement_pre',
                  publishedAt: '2026-09-05T10:52:58.410Z',
                  source: 'document',
                  fieldsApplied: ['current_value'],
                },
              ],
            },
          ],
        })}
      />,
    );
    expect(screen.getByText(/Updated from the policy document on/)).toBeDefined();
  });

  it('reports the most recent entry when a policy has several', () => {
    render(
      <PolicyTable
        {...makeProps({
          policies: [
            {
              ...policy,
              integrationSyncHistory: [
                {
                  runId: 'd1',
                  providerId: 'allan-gray',
                  categoryId: 'retirement_pre',
                  publishedAt: '2026-01-01T00:00:00.000Z',
                  source: 'document',
                  fieldsApplied: [],
                },
                {
                  runId: 'r2',
                  providerId: 'allan-gray',
                  categoryId: 'retirement_pre',
                  publishedAt: '2026-09-05T10:52:58.410Z',
                  source: 'portal',
                  fieldsApplied: [],
                },
              ],
            },
          ],
        })}
      />,
    );
    expect(screen.getByText(/Updated from the provider portal on/)).toBeDefined();
    expect(screen.queryByText(/policy document/)).toBeNull();
  });

  it('ignores an unparseable timestamp rather than rendering "Invalid Date"', () => {
    render(
      <PolicyTable
        {...makeProps({
          policies: [
            {
              ...policy,
              integrationSyncHistory: [
                {
                  runId: 'r1',
                  providerId: 'allan-gray',
                  categoryId: 'retirement_pre',
                  publishedAt: 'not-a-date',
                  source: 'portal',
                  fieldsApplied: [],
                },
              ],
            },
          ],
        })}
      />,
    );
    expect(screen.queryByText(/Updated from the/)).toBeNull();
  });
});

describe('PolicyTable — refresh from provider', () => {
  it('shows no refresh control when no handler is supplied', () => {
    render(<PolicyTable {...makeProps()} />);
    expect(screen.queryByTitle(REFRESH_TITLE)).toBeNull();
  });

  it('shows the control once a handler is supplied', () => {
    render(<PolicyTable {...makeProps({ onRefreshFromProvider: vi.fn() })} />);
    expect(screen.getByTitle(REFRESH_TITLE)).toBeDefined();
  });

  it('hands back the policy the row belongs to', () => {
    const onRefreshFromProvider = vi.fn();
    render(<PolicyTable {...makeProps({ onRefreshFromProvider })} />);

    fireEvent.click(screen.getByTitle(REFRESH_TITLE));

    expect(onRefreshFromProvider).toHaveBeenCalledTimes(1);
    expect(onRefreshFromProvider.mock.calls[0][0].id).toBe('pol-1');
  });

  it('offers no refresh on an archived policy, which the server will not queue either', () => {
    render(
      <PolicyTable
        {...makeProps({
          policies: [{ ...policy, archived: true }],
          onRefreshFromProvider: vi.fn(),
        })}
      />,
    );
    expect(screen.queryByTitle(REFRESH_TITLE)).toBeNull();
  });

  it('cannot be fired again while that policy is already refreshing', () => {
    const onRefreshFromProvider = vi.fn();
    render(<PolicyTable {...makeProps({ onRefreshFromProvider, refreshingPolicyId: 'pol-1' })} />);

    const button = screen.getByTitle(REFRESH_TITLE) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    fireEvent.click(button);
    expect(onRefreshFromProvider).not.toHaveBeenCalled();
  });

  it('leaves other rows clickable while one is refreshing', () => {
    const onRefreshFromProvider = vi.fn();
    render(
      <PolicyTable
        {...makeProps({
          policies: [policy, { ...policy, id: 'pol-2' }],
          onRefreshFromProvider,
          refreshingPolicyId: 'pol-1',
        })}
      />,
    );

    const buttons = screen.getAllByTitle(REFRESH_TITLE) as HTMLButtonElement[];
    expect(buttons).toHaveLength(2);
    expect(buttons[0].disabled).toBe(true);
    expect(buttons[1].disabled).toBe(false);

    fireEvent.click(buttons[1]);
    expect(onRefreshFromProvider.mock.calls[0][0].id).toBe('pol-2');
  });
});
