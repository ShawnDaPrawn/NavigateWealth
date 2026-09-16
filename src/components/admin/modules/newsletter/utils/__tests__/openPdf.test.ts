import { afterEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getPdfUrl: vi.fn(async () => ({ url: 'https://signed.test/c1.pdf', fileName: 'c1.pdf' })),
}));
vi.mock('../../api', () => ({ newsletterStudioApi: api }));

import { openPdf } from '../openPdf';

type FakeTab = { opener: unknown; closed: boolean; location: { href: string }; close: () => void };

function fakeTab(): FakeTab {
  const tab: FakeTab = {
    opener: { real: true },
    closed: false,
    location: { href: '' },
    close: vi.fn(() => {
      tab.closed = true;
    }),
  };
  return tab;
}

const flush = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  vi.restoreAllMocks();
  api.getPdfUrl.mockClear();
});

describe('openPdf', () => {
  it('opens the tab synchronously, severs its opener, then navigates it to the signed URL', async () => {
    const tab = fakeTab();
    const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);

    openPdf('c1');

    // Opened before any await (a tab opened after one is popup-blocked) and
    // without the `noopener` feature, which makes some browsers return null.
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith('', '_blank');
    expect(tab.opener).toBeNull();
    expect(api.getPdfUrl).toHaveBeenCalledWith('c1');

    await flush();
    expect(tab.location.href).toBe('https://signed.test/c1.pdf');
    expect(open).toHaveBeenCalledTimes(1);
    expect(tab.close).not.toHaveBeenCalled();
  });

  it('closes the placeholder tab when the signed URL cannot be fetched', async () => {
    const tab = fakeTab();
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    api.getPdfUrl.mockRejectedValueOnce(new Error('403'));

    openPdf('c1');
    await flush();

    expect(tab.close).toHaveBeenCalledTimes(1);
    expect(tab.location.href).toBe('');
  });

  it('falls back to a fresh noopener window when the placeholder was blocked', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);

    openPdf('c1');
    await flush();

    expect(open).toHaveBeenNthCalledWith(1, '', '_blank');
    expect(open).toHaveBeenNthCalledWith(2, 'https://signed.test/c1.pdf', '_blank', 'noopener');
  });
});
