/**
 * The Assets tab: media per channel, and the rules about what can go in it.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const api = vi.hoisted(() => ({
  listChannels: vi.fn(),
  list: vi.fn(),
  upload: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('../../api', () => ({ channelAssetsApi: api }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ChannelAssetsTab } from '../ChannelAssetsTab';
import { ChannelAssetPickerDialog } from '../ChannelAssetPickerDialog';
import {
  describeUpload,
  rejectionReasonFor,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
} from '../../hooks/useChannelAssets';
import { assetWarnings, formatDuration, CHANNEL_LABEL } from '../channelAssetsModel';
import type { ChannelAsset } from '../../types';

const asset = (over: Partial<ChannelAsset> = {}): ChannelAsset => ({
  id: 'a1',
  channel: 'instagram',
  media_type: 'image',
  storage_path: 'channels/instagram/a1__chart.png',
  url: 'https://cdn.test/a1.png',
  file_name: 'chart.png',
  content_type: 'image/png',
  byte_size: 2048,
  width: 1080,
  height: 1080,
  duration_seconds: null,
  caption: 'Two-pot explained',
  alt_text: 'A chart',
  tags: [],
  notes: null,
  status: 'available',
  used_at: null,
  buffer_post_id: null,
  published_at: null,
  source: 'chatgpt',
  created_at: '2026-09-17T10:00:00Z',
  updated_at: '2026-09-17T10:00:00Z',
  ...over,
});

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function file(name: string, type: string, size: number): File {
  const f = new File([new Uint8Array(1)], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  api.listChannels.mockResolvedValue([
    { id: 'linkedin', label: 'LinkedIn', available: 2, used: 0, archived: 0, total: 2 },
    { id: 'instagram', label: 'Instagram', available: 1, used: 0, archived: 0, total: 1 },
    { id: 'x', label: 'X (Twitter)', available: 0, used: 0, archived: 0, total: 0 },
  ]);
  api.list.mockResolvedValue([asset()]);
  api.upload.mockImplementation(async (_channel: string, f: File) => asset({ file_name: f.name }));
  api.update.mockResolvedValue(asset());
  api.remove.mockResolvedValue(undefined);
});

describe('rejectionReasonFor', () => {
  it('accepts the image and video formats the bucket takes', () => {
    expect(rejectionReasonFor(file('a.png', 'image/png', 1024))).toBeNull();
    expect(rejectionReasonFor(file('a.mp4', 'video/mp4', 50 * 1024 * 1024))).toBeNull();
  });

  it('turns away a document, and holds video to a larger limit than images', () => {
    expect(rejectionReasonFor(file('a.pdf', 'application/pdf', 10))).toMatch(/PNG, JPEG or WebP/);
    // A 50MB file is fine as video and far too big as an image.
    expect(rejectionReasonFor(file('a.png', 'image/png', MAX_IMAGE_BYTES + 1))).toMatch(/15MB/);
    expect(rejectionReasonFor(file('a.mp4', 'video/mp4', MAX_VIDEO_BYTES + 1))).toMatch(/50MB/);
    expect(rejectionReasonFor(file('a.png', 'image/png', 0))).toMatch(/empty/i);
  });
});

describe('model helpers', () => {
  it('counts what a reviewer should notice before a routine publishes', () => {
    expect(assetWarnings(asset())).toEqual([]);
    expect(assetWarnings(asset({ alt_text: null, caption: null }))).toEqual([
      'No alt text',
      'No suggested caption',
    ]);
  });

  it('shows a video length in minutes and seconds', () => {
    expect(formatDuration(21.5)).toBe('0:22');
    expect(formatDuration(95)).toBe('1:35');
    expect(formatDuration(null)).toBeNull();
  });

  it('calls X by the name people still use', () => {
    expect(CHANNEL_LABEL.x).toBe('X (Twitter)');
  });

  it('summarises an upload batch honestly', () => {
    expect(describeUpload({ uploaded: [asset()], failed: [] })).toBe('1 added');
    expect(
      describeUpload({ uploaded: [asset()], failed: [{ filename: 'b.pdf', error: 'nope' }] }),
    ).toBe('1 added, 1 failed');
  });
});

describe('ChannelAssetsTab', () => {
  it('opens on a channel and shows that channel’s available media', async () => {
    render(<ChannelAssetsTab />, { wrapper });
    await waitFor(() => expect(screen.getByText('chart.png')).toBeDefined());
    expect(api.list).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'instagram', status: 'available' }),
    );
  });

  it('switches channel, and asks for that channel instead', async () => {
    render(<ChannelAssetsTab />, { wrapper });
    await waitFor(() => expect(screen.getByText('chart.png')).toBeDefined());

    const linkedinTab = screen.getByRole('tab', { name: /LinkedIn/ });
    // Radix activates a tab on focus under its default automatic mode, so a
    // bare click in jsdom is not enough to switch it.
    linkedinTab.focus();
    fireEvent.click(linkedinTab);
    await waitFor(() =>
      expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ channel: 'linkedin' })),
    );
  });

  it('uploads a dropped file against the open channel', async () => {
    render(<ChannelAssetsTab />, { wrapper });
    await waitFor(() => expect(screen.getByText('chart.png')).toBeDefined());

    const dropped = file('reel.mp4', 'video/mp4', 2048);
    fireEvent.drop(screen.getByTestId('channel-asset-drop-zone'), {
      dataTransfer: { files: [dropped] },
    });
    await waitFor(() => expect(api.upload).toHaveBeenCalledWith('instagram', dropped));
  });

  it('says so when a channel has nothing yet', async () => {
    api.list.mockResolvedValue([]);
    render(<ChannelAssetsTab />, { wrapper });
    await waitFor(() => expect(screen.getByText(/Nothing here yet/i)).toBeDefined());
  });

  it('saves an edited caption', async () => {
    render(<ChannelAssetsTab />, { wrapper });
    await waitFor(() => expect(screen.getByText('chart.png')).toBeDefined());

    fireEvent.change(screen.getByLabelText('Suggested caption'), {
      target: { value: 'Sharper copy' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith(
        'a1',
        expect.objectContaining({ caption: 'Sharper copy' }),
      ),
    );
  });

  it('archives without a confirmation, but confirms before deleting', async () => {
    render(<ChannelAssetsTab />, { wrapper });
    await waitFor(() => expect(screen.getByText('chart.png')).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: /archive chart\.png/i }));
    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith(
        'a1',
        expect.objectContaining({ status: 'archived' }),
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: /delete chart\.png/i }));
    expect(screen.getByText(/Delete this asset\?/i)).toBeDefined();
    expect(api.remove).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith('a1'));
  });

  it('plays a video asset rather than trying to show it as a picture', async () => {
    api.list.mockResolvedValue([
      asset({ media_type: 'video', file_name: 'reel.mp4', duration_seconds: 21 }),
    ]);
    render(<ChannelAssetsTab />, { wrapper });
    await waitFor(() => expect(screen.getByLabelText('reel.mp4')).toBeDefined());
    expect(screen.getByLabelText('reel.mp4').tagName.toLowerCase()).toBe('video');
  });
});

describe('the composer picker', () => {
  it('offers only what is still on the shelf', async () => {
    // Archiving an asset means "take it out of circulation" and `used` means it
    // has already gone out. Asking without a status would list all three, and
    // the picker would happily re-attach a retired picture to a new post.
    render(
      <ChannelAssetPickerDialog
        open
        onOpenChange={() => {}}
        attachedPaths={[]}
        onConfirm={() => {}}
      />,
      { wrapper },
    );
    await waitFor(() => expect(api.list).toHaveBeenCalled());
    expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ status: 'available' }));
  });

  it('asks for images only, since a post carries no video yet', async () => {
    render(
      <ChannelAssetPickerDialog
        open
        onOpenChange={() => {}}
        attachedPaths={[]}
        onConfirm={() => {}}
      />,
      { wrapper },
    );
    await waitFor(() => expect(api.list).toHaveBeenCalled());
    expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ mediaType: 'image' }));
  });
});
