import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import { useRecordInUrl, type RecordOpenResult } from '../useRecordInUrl';

afterEach(() => cleanup());

const RECORDS = ['a', 'b'];

let api: { open: (id: string | null) => void; back: () => void } = {
  open: () => undefined,
  back: () => undefined,
};

function Page({ ready = true }: { ready?: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const navigate = useNavigate();
  api = { open: setOpenId, back: () => navigate(-1) };
  useRecordInUrl('item', openId, {
    ready,
    openFromUrl: (id): RecordOpenResult => {
      if (!ready) return 'waiting';
      if (!RECORDS.includes(id)) return 'missing';
      setOpenId(id);
      return 'opened';
    },
    closeFromUrl: () => setOpenId(null),
  });
  return (
    <>
      <output data-testid="open">{openId ?? 'list'}</output>
      <output data-testid="search">{useLocation().search}</output>
    </>
  );
}

const renderAt = (url: string, ready = true) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Page ready={ready} />
    </MemoryRouter>,
  );

describe('useRecordInUrl', () => {
  it('writes an opened record to the address and removes it on close', () => {
    renderAt('/admin?module=clients');
    act(() => api.open('a'));
    expect(screen.getByTestId('search').textContent).toBe('?module=clients&item=a');
    act(() => api.open(null));
    expect(screen.getByTestId('search').textContent).toBe('?module=clients');
  });

  it('opens the record named in the address', () => {
    renderAt('/admin?item=b');
    expect(screen.getByTestId('open').textContent).toBe('b');
  });

  it('closes the record when Back leaves its address', () => {
    renderAt('/admin?module=clients');
    act(() => api.open('a'));
    act(() => api.back());
    expect(screen.getByTestId('open').textContent).toBe('list');
    expect(screen.getByTestId('search').textContent).toBe('?module=clients');
  });

  it('drops an address that names no record', () => {
    renderAt('/admin?module=clients&item=zzz');
    expect(screen.getByTestId('open').textContent).toBe('list');
    expect(screen.getByTestId('search').textContent).toBe('?module=clients');
  });

  it('waits for the list before opening', () => {
    const view = renderAt('/admin?item=a', false);
    expect(screen.getByTestId('open').textContent).toBe('list');
    expect(screen.getByTestId('search').textContent).toBe('?item=a');
    view.rerender(
      <MemoryRouter initialEntries={['/admin?item=a']}>
        <Page ready />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('open').textContent).toBe('a');
  });
});
