import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AudiencePicker } from '../AudiencePicker';
import type { NewsletterListView } from '../../types';

const lists: NewsletterListView[] = [
  {
    id: 'sys_newsletter_contacts',
    name: 'Newsletter Contacts',
    description: 'Every confirmed subscriber',
    type: 'system',
    memberCount: 205,
    externalContactCount: 205,
    clientCount: 0,
  },
  {
    id: 'sys_all',
    name: 'All Clients',
    description: 'Every client',
    type: 'system',
    memberCount: 80,
    externalContactCount: 0,
    clientCount: 80,
  },
  {
    id: 'g-vip',
    name: 'VIP clients',
    description: '',
    type: 'custom',
    memberCount: 12,
    externalContactCount: 0,
    clientCount: 12,
  },
];

describe('AudiencePicker', () => {
  it('lists every audience with counts, marks the default, and toggles selection', () => {
    const onChange = vi.fn();
    render(
      <AudiencePicker lists={lists} value={['sys_newsletter_contacts']} onChange={onChange} />,
    );
    expect(screen.getByText('Newsletter Contacts')).toBeTruthy();
    expect(screen.getByText('Default')).toBeTruthy();
    expect(screen.getByText('205 members')).toBeTruthy();
    expect(screen.getByText(/About 205 recipients/)).toBeTruthy();

    fireEvent.click(screen.getByRole('checkbox', { name: 'VIP clients' }));
    expect(onChange).toHaveBeenCalledWith(['sys_newsletter_contacts', 'g-vip']);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Newsletter Contacts' }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('says an empty audience is allowed, because website-only is a real choice', () => {
    render(<AudiencePicker lists={lists} value={[]} onChange={vi.fn()} />);
    expect(screen.getByText(/published on the website without being emailed/)).toBeTruthy();
  });

  it('points to Communication when there are no groups', () => {
    render(<AudiencePicker lists={[]} value={[]} onChange={vi.fn()} />);
    expect(screen.getByText(/Communication → Groups first/)).toBeTruthy();
  });
});
