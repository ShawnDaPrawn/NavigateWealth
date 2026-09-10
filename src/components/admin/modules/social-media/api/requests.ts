/**
 * Request/filter shapes shared by the social-media API slices.
 */
import type { PostStatus } from '../types';

export type {
  ComposeRequest as CreatePostRequest,
  ComposeImage,
  ComposeMode,
  ComposeResult,
} from '../types';

/** Calendar window for Buffer posts (both bounds inclusive). */
export interface PostFilters {
  startDate?: Date;
  endDate?: Date;
  channelId?: string;
  /** Client-side filter applied after the fetch. */
  status?: PostStatus | PostStatus[];
}
