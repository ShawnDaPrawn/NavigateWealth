/**
 * The media library: uploading, picking, and the path from a picture to a post.
 *
 * The gap this closed was that Compose accepted an image URL and nothing else,
 * so anyone without their own hosting could not attach a picture at all. These
 * tests hold that door open.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const api = vi.hoisted(() => ({
  listPage: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('../../api', () => ({ mediaApi: api }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { MediaLibraryPanel } from '../MediaLibraryPanel';
import { MediaPickerDialog } from '../MediaPickerDialog';
import {
  describeUpload,
  rejectionReasonFor,
  LIBRARY_PAGE_SIZE,
  MAX_UPLOAD_BYTES,
} from '../../hooks/useSocialMediaLibrary';
import { assetToMediaFile, composeBlocker, MAX_POST_IMAGES } from '../../composerModel';
import type { MediaFile, SocialProfile } from '../../types';
import type { SocialMediaAsset } from '../../types';

const asset = (name: string, path = `uploads/id__${name}`): SocialMediaAsset => ({
  storagePath: path,
  url: `https://cdn.test/${path}.png`,
  name,
  size: 2048,
  contentType: 'image/png',
  uploadedAt: '2026-09-13T10:00:00Z',
});

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function pngFile(name = 'chart.png', size = 1024): File {
  const file = new File([new Uint8Array(size)], name, { type: 'image/png' });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

beforeEach(() => {
  vi.clearAllMocks();
  api.listPage.mockResolvedValue([asset('quarterly review')]);
  api.upload.mockImplementation(async (f: File) => asset(f.name));
  api.remove.mockResolvedValue(undefined);
});

describe('rejectionReasonFor', () => {
  it('lets a normal image through', () => {
    expect(rejectionReasonFor(pngFile())).toBeNull();
  });

  it('turns away a PDF and an oversized image before the network is touched', () => {
    const pdf = new File(['x'], 'brochure.pdf', { type: 'application/pdf' });
    expect(rejectionReasonFor(pdf)).toMatch(/PNG, JPEG and WebP/);
    expect(rejectionReasonFor(pngFile('huge.png', MAX_UPLOAD_BYTES + 1))).toMatch(/10MB/);
    expect(rejectionReasonFor(pngFile('empty.png', 0))).toMatch(/empty/i);
  });
});

describe('describeUpload', () => {
  it('counts what landed and what did not', () => {
    expect(describeUpload({ uploaded: [asset('a')], failed: [] })).toBe('1 image added');
    expect(
      describeUpload({
        uploaded: [asset('a'), asset('b')],
        failed: [{ filename: 'c', error: 'x' }],
      }),
    ).toBe('2 images added, 1 failed');
  });
});

describe('assetToMediaFile', () => {
  it('carries the public URL and never the private-bucket storagePath', () => {
    // storagePath means "copy this out of the private AI bucket"; a library
    // image is already public, so setting it would make the server copy a path
    // that does not exist there.
    const media = assetToMediaFile(asset('team photo'));
    expect(media.url).toBe('https://cdn.test/uploads/id__team photo.png');
    expect(media.libraryPath).toBe('uploads/id__team photo');
    expect(media.storagePath).toBeUndefined();
    expect(media.alt).toBe('team photo');
  });
});

describe('MediaLibraryPanel', () => {
  it('shows the library and hands an image to the composer', async () => {
    const onUseInPost = vi.fn();
    render(<MediaLibraryPanel onUseInPost={onUseInPost} />, { wrapper });

    await waitFor(() => expect(screen.getByText('quarterly review')).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: /use in post/i }));
    expect(onUseInPost).toHaveBeenCalledWith(expect.objectContaining({ name: 'quarterly review' }));
  });

  it('says so when nothing has been uploaded yet', async () => {
    api.listPage.mockResolvedValue([]);
    render(<MediaLibraryPanel onUseInPost={vi.fn()} />, { wrapper });
    await waitFor(() => expect(screen.getByText(/No images yet/i)).toBeDefined());
  });

  it('uploads the files dropped on the zone', async () => {
    render(<MediaLibraryPanel onUseInPost={vi.fn()} />, { wrapper });
    await waitFor(() => expect(screen.getByText('quarterly review')).toBeDefined());

    const file = pngFile('dropped.png');
    fireEvent.drop(screen.getByTestId('media-drop-zone'), { dataTransfer: { files: [file] } });
    await waitFor(() => expect(api.upload).toHaveBeenCalledWith(file));
  });

  it('confirms before deleting, because a scheduled post may use the image', async () => {
    render(<MediaLibraryPanel onUseInPost={vi.fn()} />, { wrapper });
    await waitFor(() => expect(screen.getByText('quarterly review')).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: /delete quarterly review/i }));
    expect(screen.getByText(/Delete this image\?/i)).toBeDefined();
    expect(api.remove).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith('uploads/id__quarterly review'));
  });
});

describe('MediaPickerDialog', () => {
  it('does not load the library until it is opened', async () => {
    const { rerender } = render(
      <MediaPickerDialog
        open={false}
        onOpenChange={vi.fn()}
        attachedPaths={[]}
        onConfirm={vi.fn()}
      />,
      { wrapper },
    );
    expect(api.listPage).not.toHaveBeenCalled();

    rerender(
      <MediaPickerDialog open onOpenChange={vi.fn()} attachedPaths={[]} onConfirm={vi.fn()} />,
    );
    await waitFor(() => expect(api.listPage).toHaveBeenCalled());
  });

  it('returns the chosen images and closes', async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <MediaPickerDialog
        open
        onOpenChange={onOpenChange}
        attachedPaths={[]}
        onConfirm={onConfirm}
      />,
      { wrapper },
    );

    await waitFor(() => expect(screen.getByLabelText(/select quarterly review/i)).toBeDefined());
    fireEvent.click(screen.getByLabelText(/select quarterly review/i));
    fireEvent.click(screen.getByRole('button', { name: /add 1 image/i }));

    expect(onConfirm).toHaveBeenCalledWith([expect.objectContaining({ name: 'quarterly review' })]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('marks an image the draft already carries', async () => {
    render(
      <MediaPickerDialog
        open
        onOpenChange={vi.fn()}
        attachedPaths={['uploads/id__quarterly review']}
        onConfirm={vi.fn()}
      />,
      { wrapper },
    );
    await waitFor(() => expect(screen.getByText('Already added')).toBeDefined());
  });
});

// ── The three things the Codex review caught ────────────────────────────────

describe('a post cannot exceed the server’s image ceiling', () => {
  const profiles: SocialProfile[] = [
    { id: 'li', platform: 'linkedin', name: 'NW', username: 'nw', isConnected: true },
  ];
  const image = (n: number): MediaFile => ({
    id: `i${n}`,
    url: `https://cdn.test/${n}.png`,
    type: 'image',
    filename: `${n}.png`,
    size: 1,
  });

  it('blocks composing when more images are attached than the server accepts', () => {
    const over = {
      text: 'Hello',
      channelIds: ['li'],
      linkUrl: '',
      linkTitle: '',
      media: Array.from({ length: MAX_POST_IMAGES + 1 }, (_, i) => image(i)),
    };
    expect(composeBlocker(over, profiles)).toMatch(/at most 4 images/);

    const exactly = { ...over, media: over.media.slice(0, MAX_POST_IMAGES) };
    expect(composeBlocker(exactly, profiles)).toBeNull();
  });

  it('stops the picker selecting past the ceiling', async () => {
    api.listPage.mockResolvedValue([
      asset('one', 'uploads/1'),
      asset('two', 'uploads/2'),
      asset('three', 'uploads/3'),
    ]);
    render(
      <MediaPickerDialog
        open
        onOpenChange={vi.fn()}
        // Three already on the draft leaves room for exactly one more.
        attachedPaths={['uploads/a', 'uploads/b', 'uploads/c']}
        onConfirm={vi.fn()}
      />,
      { wrapper },
    );

    await waitFor(() => expect(screen.getByLabelText(/select one/i)).toBeDefined());
    fireEvent.click(screen.getByLabelText(/select one/i));
    expect(screen.getByText(/remove one to choose another/i)).toBeDefined();

    // The fourth fills the post; a fifth must not be selectable.
    const second = screen.getByLabelText(/select two/i) as HTMLButtonElement;
    expect(second.disabled).toBe(true);
    fireEvent.click(second);
    expect(screen.getByRole('button', { name: /add 1 image/i })).toBeDefined();
  });
});

describe('the library pages rather than hiding older uploads', () => {
  it('offers Load more when a full page comes back, and appends the next', async () => {
    const full = Array.from({ length: LIBRARY_PAGE_SIZE }, (_, i) =>
      asset(`image ${i}`, `uploads/p1-${i}`),
    );
    api.listPage.mockResolvedValueOnce(full).mockResolvedValueOnce([asset('older', 'uploads/p2')]);

    render(<MediaLibraryPanel onUseInPost={vi.fn()} />, { wrapper });
    await waitFor(() => expect(screen.getByText('image 0')).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: /load older images/i }));
    await waitFor(() => expect(screen.getByText('older')).toBeDefined());
    expect(api.listPage).toHaveBeenLastCalledWith(LIBRARY_PAGE_SIZE, LIBRARY_PAGE_SIZE);
  });

  it('shows no Load more when the first page is short', async () => {
    render(<MediaLibraryPanel onUseInPost={vi.fn()} />, { wrapper });
    await waitFor(() => expect(screen.getByText('quarterly review')).toBeDefined());
    expect(screen.queryByRole('button', { name: /load older images/i })).toBeNull();
  });
});
