/**
 * KV namespace for GoAML morning-digest snapshots.
 *
 * Latest successful (or attempted) scan and the last mail we actually sent
 * live here so the next automation run can diff without the Edge Function
 * ever talking to goAML itself.
 */

import { createKvRepository } from './kv-repository.ts';
import type { GoamlDigestRecord } from '../goaml-digest-types.ts';

export const GOAML_DIGEST_NAMESPACE = 'goaml:digest:';

export const GOAML_DIGEST_LATEST_ID = 'latest';
export const GOAML_DIGEST_LAST_SENT_ID = 'last_sent';

export const goamlDigestStore = createKvRepository<GoamlDigestRecord>(GOAML_DIGEST_NAMESPACE);
