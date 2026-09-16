/**
 * The provider list, led by whether the provider works
 * ====================================================
 *
 * The list this replaces showed a green "Active" badge derived from the last
 * SYNC attempt. That made it actively misleading: a provider whose last
 * spreadsheet import succeeded read as Active however dead its portal was, and
 * a provider nobody had configured was indistinguishable from one whose
 * password had expired.
 *
 * Pinned here: the badge reflects sign-in, the action button is the thing that
 * would change it, clicking that action does not also change which provider is
 * selected underneath the dialog, and a provider with no portal at all is still
 * listed rather than quietly dropped.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@/test/utils';
import { ProviderConnectionList } from '../ProviderConnectionList';
import type { IntegrationProvider, PortalProviderConnection } from '../../../types';

const providers: IntegrationProvider[] = [
  { id: 'p1', name: 'Allan Gray', categoryIds: ['retirement_pre'] },
  { id: 'p2', name: 'Discovery Health', categoryIds: ['medical_aid'] },
];

const connection = (over: Partial<PortalProviderConnection> = {}): PortalProviderConnection => ({
  providerId: 'p1',
  providerName: 'Allan Gray',
  state: 'connected',
  categoryId: 'retirement_pre',
  credentialProfileId: 'allan-gray-env',
  loginUrl: 'https://portal.example/login',
  hasCredentials: true,
  ...over,
});

function makeProps(over: Partial<Parameters<typeof ProviderConnectionList>[0]> = {}) {
  return {
    providers,
    connections: [connection()],
    selectedProviderId: 'p1',
    onSelect: vi.fn(),
    onConnect: vi.fn(),
    ...over,
  } as Parameters<typeof ProviderConnectionList>[0];
}

describe('ProviderConnectionList — what the badge says', () => {
  it('says Connected only when sign-in has been proven', () => {
    render(<ProviderConnectionList {...makeProps()} />);
    expect(screen.getByText('Connected')).toBeDefined();
  });

  it('no longer claims a provider is Active off the last sync attempt', () => {
    render(<ProviderConnectionList {...makeProps()} />);
    expect(screen.queryByText('Active')).toBeNull();
    expect(screen.queryByText(/Last sync:/)).toBeNull();
  });

  it('shows a failed sign-in as failed, not as "not synced"', () => {
    render(
      <ProviderConnectionList
        {...makeProps({
          connections: [connection({ state: 'failed', message: 'Your password has expired.' })],
        })}
      />,
    );
    expect(screen.getByText('Sign-in failed')).toBeDefined();
    expect(screen.getByText('Your password has expired.')).toBeDefined();
  });

  it('distinguishes a provider nobody has tested from one that failed', () => {
    render(
      <ProviderConnectionList
        {...makeProps({ connections: [connection({ state: 'untested' })] })}
      />,
    );
    expect(screen.getByText('Not tested')).toBeDefined();
    expect(screen.queryByText('Sign-in failed')).toBeNull();
  });
});

describe('ProviderConnectionList — the action', () => {
  it('offers the action that would change the state', () => {
    render(
      <ProviderConnectionList
        {...makeProps({ connections: [connection({ state: 'untested' })] })}
      />,
    );
    expect(screen.getByText('Test sign-in')).toBeDefined();
  });

  it('asks for sign-in details before asking anyone to test them', () => {
    render(
      <ProviderConnectionList
        {...makeProps({
          connections: [connection({ state: 'no_credentials', hasCredentials: false })],
        })}
      />,
    );
    expect(screen.getByText('Add sign-in details')).toBeDefined();
  });

  it('offers nothing to press while a test is already running', () => {
    render(
      <ProviderConnectionList
        {...makeProps({ connections: [connection({ state: 'testing' })] })}
      />,
    );
    expect(screen.getByText('Testing')).toBeDefined();
    expect(screen.queryByText('Test sign-in')).toBeNull();
  });

  it('hands back the connection the row belongs to', () => {
    const props = makeProps({ connections: [connection({ state: 'untested' })] });
    render(<ProviderConnectionList {...props} />);

    fireEvent.click(screen.getByText('Test sign-in'));

    const onConnect = vi.mocked(props.onConnect);
    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(onConnect.mock.calls[0][0].providerId).toBe('p1');
  });

  it('does not also fire row selection, which would swap the panel underneath', () => {
    const props = makeProps({ connections: [connection({ state: 'untested' })] });
    render(<ProviderConnectionList {...props} />);

    fireEvent.click(screen.getByText('Test sign-in'));
    expect(props.onSelect).not.toHaveBeenCalled();
  });
});

describe('ProviderConnectionList — providers with no portal', () => {
  it('still lists a provider that has no connection row', () => {
    render(<ProviderConnectionList {...makeProps()} />);
    expect(screen.getByText('Discovery Health')).toBeDefined();
  });

  it('says why there is nothing to connect when the provider has no automation category', () => {
    render(
      <ProviderConnectionList
        {...makeProps({
          providers: [{ id: 'p3', name: 'Legacy Co', categoryIds: ['retirement_planning'] }],
          connections: [],
        })}
      />,
    );
    expect(screen.getByText(/no portal to connect to/i)).toBeDefined();
  });

  it('selecting a row still works, so the rest of the module is reachable', () => {
    const props = makeProps();
    render(<ProviderConnectionList {...props} />);

    fireEvent.click(screen.getByText('Discovery Health'));
    expect(props.onSelect).toHaveBeenCalledWith('p2');
  });
});
