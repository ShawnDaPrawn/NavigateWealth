/**
 * A `clientId` deep link opens that client once and is then removed from the
 * URL, so Client Management does not keep reopening the last linked client.
 */
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { useClientDeepLink } from '../useClientDeepLink';
import type { Client } from '../../types';

const aaron = { id: 'c-aaron', firstName: 'Aaron' } as Client;
const bea = { id: 'c-bea', firstName: 'Bea' } as Client;

function setup(url: string, clients: Client[], loading = false) {
  const openClient = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
  );
  const { result, rerender } = renderHook(
    (props: { clients: Client[]; loading: boolean }) => {
      useClientDeepLink(props.clients, props.loading, openClient);
      return useLocation().search;
    },
    { wrapper, initialProps: { clients, loading } },
  );
  return { openClient, search: () => result.current, rerender };
}

describe('useClientDeepLink', () => {
  it('opens the linked client once and drops the id from the URL', () => {
    const { openClient, search } = setup('/admin?module=clients&clientId=c-aaron', [aaron, bea]);

    expect(openClient).toHaveBeenCalledTimes(1);
    expect(openClient).toHaveBeenCalledWith(aaron);
    expect(search()).toBe('?module=clients');
  });

  it('opens nothing without a link', () => {
    const { openClient, search } = setup('/admin?module=clients', [aaron, bea]);
    expect(openClient).not.toHaveBeenCalled();
    expect(search()).toBe('?module=clients');
  });

  it('waits for the client list, then opens the client', () => {
    const { openClient, search, rerender } = setup(
      '/admin?module=clients&clientId=c-bea',
      [],
      true,
    );
    expect(openClient).not.toHaveBeenCalled();

    rerender({ clients: [aaron, bea], loading: false });
    expect(openClient).toHaveBeenCalledWith(bea);
    expect(search()).toBe('?module=clients');
  });

  it('keeps a link to a client not in the list yet, for a refreshed list to honour', () => {
    const { openClient, search, rerender } = setup('/admin?module=clients&clientId=c-new', [aaron]);
    expect(openClient).not.toHaveBeenCalled();
    expect(search()).toBe('?module=clients&clientId=c-new');

    const added = { id: 'c-new', firstName: 'New' } as Client;
    rerender({ clients: [aaron, added], loading: false });
    expect(openClient).toHaveBeenCalledWith(added);
    expect(search()).toBe('?module=clients');
  });
});
