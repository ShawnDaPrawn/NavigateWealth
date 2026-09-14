/**
 * mediaApi — the upload must not be retried behind the user's back.
 *
 * The shared client retries a POST on a network error or a 5xx, and the server
 * mints a fresh storage path per attempt, so a retry after a lost response
 * would leave the same picture in the library twice.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

const client = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../../../../../utils/api', () => ({ api: client }));

import { mediaApi } from '../mediaApi';

beforeEach(() => {
  vi.clearAllMocks();
  client.post.mockResolvedValue({ success: true, data: { storagePath: 'uploads/a.png' } });
  client.get.mockResolvedValue({ success: true, data: [] });
  client.delete.mockResolvedValue({ success: true });
});

describe('upload', () => {
  it('sends the file as multipart with transient retries disabled', async () => {
    const file = new File([new Uint8Array([1])], 'chart.png', { type: 'image/png' });
    await mediaApi.upload(file);

    const [endpoint, body, options] = client.post.mock.calls[0];
    expect(endpoint).toBe('/social-marketing/media');
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get('file')).toBe(file);
    expect(options).toEqual({ retryTransientFailures: false });
  });
});

describe('listPage', () => {
  it('asks for the requested page', async () => {
    await mediaApi.listPage(60, 120);
    expect(client.get).toHaveBeenCalledWith('/social-marketing/media?limit=60&offset=120');
  });
});

describe('remove', () => {
  it('encodes the storage path', async () => {
    await mediaApi.remove('uploads/a b.png');
    expect(client.delete).toHaveBeenCalledWith(
      '/social-marketing/media?storagePath=uploads%2Fa%20b.png',
    );
  });
});
