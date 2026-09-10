/**
 * Buffer credentials repository
 *
 * Stores the optional admin-pasted Buffer API key when BUFFER_API_KEY is not
 * set as an Edge Function secret. The env secret always wins at read time.
 */

import type { BufferStoredCredentials } from '../buffer-types.ts';
import { createKvRepository } from './kv-repository.ts';

export const BUFFER_CREDENTIALS_NAMESPACE = 'buffer:credentials:';
export const BUFFER_CREDENTIALS_ID = 'account';

export const bufferCredentials = createKvRepository<BufferStoredCredentials>(
  BUFFER_CREDENTIALS_NAMESPACE,
);
