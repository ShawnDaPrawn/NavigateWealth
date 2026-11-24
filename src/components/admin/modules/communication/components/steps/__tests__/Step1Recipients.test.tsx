import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ClientGroup, CommunicationDraft } from '../../../types';

const groups: ClientGroup[] = [
  {
    id: 'sys_all',
    name: 'All Clients',
    description: 'Every client',
    type: 'system',
    clientIds: [],
    clientCount: 3,
  },
  {
    id: 'g1',
    name: 'Shawn Test Group',
    description: '',
    type: 'custom',
    clientIds: ['c1', 'c2'],
    clientCount: 2,
  },
  {
    id: 'g2',
    name: 'Allan Gray Clients',
    description: '',
    type: 'system',
    clientIds: ['c2', 'c3'],
    clientCount: 2,
  },
];

vi.mock('../../../api', () => ({
  communicationApi: {
    getClients: vi.fn(async () => [
      { id: 'c1', firstName: 'Ann', email: 'a@x.com' },
      { id: 'c2', firstName: 'Ben', email: 'b@x.com' },
      { id: 'c3', firstName: 'Cara', email: 'c@x.com' },
    ]),
    getGroups: vi.fn(async () => groups),
  },
}));
vi.mock('../../CustomGroupManager', () => ({ CustomGroupManager: () => null }));

import { Step1Recipients } from '../Step1Recipients';

afterEach(cleanup);

const EMPTY: CommunicationDraft = {
  step: 1,
  channel: 'email',
  recipientType: 'group',
  selectedRecipients: [],
  subject: '',
  bodyHtml: '',
  attachments: [],
  scheduling: { type: 'immediate' },
};

let latest: CommunicationDraft = EMPTY;
function Harness({ onNext = vi.fn() }: { onNext?: () => void }) {
  const [draft, setDraft] = useState<CommunicationDraft>(EMPTY);
  latest = draft;
  return (
    <Step1Recipients
      draft={draft}
      updateDraft={(u) => setDraft((d) => ({ ...d, ...u }))}
      onNext={onNext}
    />
  );
}

describe('Step1Recipients — client groups', () => {
  it('shows which groups are selected, lets several be picked, and removes them', async () => {
    render(<Harness />);
    const summary = screen.getByTestId('selected-groups');
    expect(within(summary).getByText('No groups selected')).toBeDefined();
    expect(screen.getByTestId('recipient-summary').textContent).toBe('No group selected');

    fireEvent.click(await screen.findByRole('checkbox', { name: 'Shawn Test Group' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Allan Gray Clients' }));

    expect(
      screen.getByRole('checkbox', { name: 'Shawn Test Group' }).getAttribute('aria-checked'),
    ).toBe('true');
    // c2 is in both groups: three people, not four.
    expect(within(summary).getByText('2 groups selected · 3 recipients')).toBeDefined();
    expect(screen.getByTestId('recipient-summary').textContent).toBe(
      'To Shawn Test Group, Allan Gray Clients · 3 recipients',
    );
    expect(latest.selectedGroups?.map((g) => g.id)).toEqual(['g1', 'g2']);
    expect(latest.selectedRecipients.map((c) => c.id)).toEqual(['c1', 'c2', 'c3']);

    fireEvent.click(screen.getByRole('button', { name: 'Remove Shawn Test Group' }));
    expect(screen.getByTestId('recipient-summary').textContent).toBe(
      'To Allan Gray Clients · 2 recipients',
    );
    expect(
      screen.getByRole('checkbox', { name: 'Shawn Test Group' }).getAttribute('aria-checked'),
    ).toBe('false');
  });

  it('deselects a group when its card is clicked again, and needs one to continue', async () => {
    const onNext = vi.fn();
    render(<Harness onNext={onNext} />);
    const card = await screen.findByRole('checkbox', { name: 'Shawn Test Group' });
    const next = screen.getByRole('button', { name: /Continue to message/ }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);

    fireEvent.click(card);
    expect(next.disabled).toBe(false);
    fireEvent.click(card);
    expect(next.disabled).toBe(true);

    fireEvent.keyDown(card, { key: ' ' });
    fireEvent.click(next);
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(latest.recipientType).toBe('group');
    expect(latest.selectedGroup?.id).toBe('g1');
  });
});
