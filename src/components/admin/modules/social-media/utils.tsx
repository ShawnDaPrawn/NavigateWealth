/**
 * Social Media Utilities
 * 
 * Helper functions for the Social Media module including:
 * - Formatting (dates, numbers, text)
 * - Platform-specific validations
 * - URL and UTM utilities
 * - Character counting
 * - Media validation
 * - Scheduling helpers
 * 
 * @module social-media/utils
 */

import type { 
  SocialPlatform, 
  SocialPost, 
  MediaFile, 
  UTMParameters,
  PlatformLimits 
} from './types';
import { PLATFORM_LIMITS } from './types';

// ============================================================================
// Formatting Utilities
// ============================================================================

/**
 * Format follower count with K/M suffix
 * @example formatFollowerCount(5234) => "5.2K"
 * @example formatFollowerCount(1500000) => "1.5M"
 */
export function formatFollowerCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

/**
 * Format engagement rate as percentage
 * @example formatEngagementRate(4.9745) => "4.97%"
 */
export function formatEngagementRate(rate: number): string {
  return `${rate.toFixed(2)}%`;
}

/**
 * Format click-through rate as percentage
 * @example formatCTR(7.14) => "7.14%"
 */
export function formatCTR(ctr: number): string {
  return `${ctr.toFixed(2)}%`;
}

/**
 * Format file size in human-readable format
 * @example formatFileSize(245760) => "240 KB"
 * @example formatFileSize(1048576) => "1.00 MB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Format post date relative to now
 * @example formatPostDate(new Date()) => "Just now"
 * @example formatPostDate(yesterday) => "1 day ago"
 */
export function formatPostDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
  });
}

/**
 * Format scheduled time in human-readable format
 * @example formatScheduledTime(tomorrow) => "Tomorrow at 9:00 AM"
 */
export function formatScheduledTime(date: Date): string {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const isToday = date.toDateString() === now.toDateString();
  const isTomorrow = date.toDateString() === tomorrow.toDateString();
  
  const time = date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
  
  if (isToday) return `Today at ${time}`;
  if (isTomorrow) return `Tomorrow at ${time}`;
  
  const dateStr = date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
  
  return `${dateStr} at ${time}`;
}

/**
 * Format time ago (e.g., "2 hours ago", "3 days ago")
 */
export function formatTimeAgo(date: Date): string {
  return formatPostDate(date);
}

// ============================================================================
// Platform Limits & Validation
// ============================================================================

/**
 * Get platform-specific limits
 */
export function getPlatformLimits(platform: SocialPlatform): PlatformLimits {
  return PLATFORM_LIMITS[platform];
}

/**
 * Validate post content against platform limits
 */
export function validatePostContent(
  platform: SocialPlatform, 
  content: string
): { valid: boolean; error?: string } {
  const limits = getPlatformLimits(platform);
  const charCount = countCharacters(content, platform);
  
  if (charCount > limits.maxCharacters) {
    return {
      valid: false,
      error: `Content exceeds ${limits.maxCharacters} character limit (${charCount} characters)`,
    };
  }
  
  return { valid: true };
}

/**
 * Check if more media can be added to a post
 */
export function canAddMedia(
  platform: SocialPlatform, 
  currentCount: number,
  mediaType: 'image' | 'video'
): boolean {
  const limits = getPlatformLimits(platform);
  
  if (mediaType === 'image') {
    return currentCount < limits.maxImages;
  } else {
    return currentCount < limits.maxVideos;
  }
}

/**
 * Validate media file against platform limits
 */
export function validateMediaFile(
  platform: SocialPlatform,
  file: File | MediaFile,
  existingMedia: MediaFile[] = []
): { valid: boolean; error?: string } {
  const limits = getPlatformLimits(platform);
  const fileSize = 'size' in file ? file.size : 0;
  const fileType = file.type?.startsWith('video/') || ('type' in file && file.type === 'video') 
    ? 'video' 
    : 'image';
  
  // Check file size
  const maxSize = fileType === 'video' ? limits.videoMaxSize : limits.imageMaxSize;
  const fileSizeMB = fileSize / (1024 * 1024);
  
  if (fileSizeMB > maxSize) {
    return {
      valid: false,
      error: `File size (${fileSizeMB.toFixed(2)} MB) exceeds ${maxSize} MB limit`,
    };
  }
  
  // Check media count
  const existingCount = existingMedia.filter(m => m.type === fileType).length;
  if (!canAddMedia(platform, existingCount, fileType)) {
    const maxCount = fileType === 'video' ? limits.maxVideos : limits.maxImages;
    return {
      valid: false,
      error: `Maximum ${maxCount} ${fileType}${maxCount !== 1 ? 's' : ''} allowed`,
    };
  }
  
  return { valid: true };
}

/**
 * Check if platform supports a specific feature
 */
export function supportsFeature(
  platform: SocialPlatform,
  feature: keyof PlatformLimits['features']
): boolean {
  return PLATFORM_LIMITS[platform].features[feature];
}

// ============================================================================
// Character Counting
// ============================================================================

/**
 * Count characters for a specific platform (some platforms count emojis differently)
 */
export function countCharacters(text: string, platform: SocialPlatform): number {
  // Twitter/X counts some characters differently (e.g., URLs, emojis)
  if (platform === 'x') {
    // Simplified: count URLs as 23 characters each
    let count = text.length;
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urls = text.match(urlRegex) || [];
    
    urls.forEach(url => {
      count = count - url.length + 23;
    });
    
    return count;
  }
  
  // For other platforms, simple character count
  return text.length;
}

/**
 * Get remaining characters for a platform
 */
export function getRemainingCharacters(text: string, platform: SocialPlatform): number {
  const limits = getPlatformLimits(platform);
  const used = countCharacters(text, platform);
  return Math.max(0, limits.maxCharacters - used);
}

/**
 * Check if text is within character limit
 */
export function isWithinCharacterLimit(text: string, platform: SocialPlatform): boolean {
  return getRemainingCharacters(text, platform) >= 0;
}

// ============================================================================
// URL & UTM Utilities
// ============================================================================

/**
 * Build URL with UTM parameters
 */
export function buildUTMUrl(url: string, params: UTMParameters): string {
  try {
    const urlObj = new URL(url);
    
    urlObj.searchParams.set('utm_source', params.source);
    urlObj.searchParams.set('utm_medium', params.medium);
    urlObj.searchParams.set('utm_campaign', params.campaign);
    
    if (params.term) urlObj.searchParams.set('utm_term', params.term);
    if (params.content) urlObj.searchParams.set('utm_content', params.content);
    
    return urlObj.toString();
  } catch (error) {
    // If URL is invalid, return original
    return url;
  }
}

/**
 * Parse UTM parameters from URL
 */
export function parseUTMParams(url: string): UTMParameters | null {
  try {
    const urlObj = new URL(url);
    const source = urlObj.searchParams.get('utm_source');
    const medium = urlObj.searchParams.get('utm_medium');
    const campaign = urlObj.searchParams.get('utm_campaign');
    
    if (!source || !medium || !campaign) return null;
    
    return {
      source,
      medium,
      campaign,
      term: urlObj.searchParams.get('utm_term') || undefined,
      content: urlObj.searchParams.get('utm_content') || undefined,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Extract URLs from text
 */
export function extractLinks(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s]+/g;
  return text.match(urlRegex) || [];
}

/**
 * Shorten URL (placeholder - would integrate with URL shortener service)
 */
export function shortenUrl(url: string): Promise<string> {
  // TODO: Integrate with URL shortening service (bit.ly, TinyURL, etc.)
  return Promise.resolve(url);
}

// ============================================================================
// Scheduling Utilities
// ============================================================================

/**
 * Get optimal post times for a platform (mock data - would come from analytics)
 */
export function getOptimalPostTimes(platform: SocialPlatform): Date[] {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Platform-specific optimal times (simplified)
  const optimalHours: Record<SocialPlatform, number[]> = {
    linkedin: [9, 12, 17], // Business hours
    instagram: [11, 13, 19], // Lunch and evening
    facebook: [13, 15, 19], // Afternoon and evening
    x: [9, 12, 15, 18], // Throughout the day
  };
  
  const hours = optimalHours[platform];
  return hours.map(hour => {
    const date = new Date(tomorrow);
    date.setHours(hour, 0, 0, 0);
    return date;
  });
}

/**
 * Validate if a schedule time is valid (not in the past, reasonable future)
 */
export function isValidScheduleTime(date: Date): { valid: boolean; error?: string } {
  const now = new Date();
  const maxFuture = new Date();
  maxFuture.setFullYear(maxFuture.getFullYear() + 1); // Max 1 year in future
  
  if (date <= now) {
    return {
      valid: false,
      error: 'Schedule time must be in the future',
    };
  }
  
  if (date > maxFuture) {
    return {
      valid: false,
      error: 'Schedule time cannot be more than 1 year in the future',
    };
  }
  
  return { valid: true };
}

/**
 * Convert date to specific timezone
 */
export function convertToTimezone(date: Date, timezone: string): Date {
  // Simplified: would use proper timezone library in production
  return new Date(date.toLocaleString('en-US', { timeZone: timezone }));
}

/**
 * Round date to nearest 15 minutes
 */
export function roundToNearest15Minutes(date: Date): Date {
  const minutes = date.getMinutes();
  const rounded = Math.round(minutes / 15) * 15;
  const newDate = new Date(date);
  newDate.setMinutes(rounded);
  newDate.setSeconds(0);
  newDate.setMilliseconds(0);
  return newDate;
}

// ============================================================================
// Post Utilities
// ============================================================================

/**
 * Get post status badge color
 */
export function getPostStatusColor(status: SocialPost['status']): string {
  const colors: Record<SocialPost['status'], string> = {
    draft: 'bg-gray-100 text-gray-800',
    pending_approval: 'bg-yellow-100 text-yellow-800',
    scheduled: 'bg-blue-100 text-blue-800',
    published: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
  };
  return colors[status];
}

/**
 * Get platform icon color
 */
export function getPlatformColor(platform: SocialPlatform): string {
  const colors: Record<SocialPlatform, string> = {
    linkedin: 'text-blue-600',
    instagram: 'text-pink-600',
    facebook: 'text-blue-700',
    x: 'text-gray-900',
  };
  return colors[platform];
}

/**
 * Get platform display name
 */
export function getPlatformDisplayName(platform: SocialPlatform): string {
  const names: Record<SocialPlatform, string> = {
    linkedin: 'LinkedIn',
    instagram: 'Instagram',
    facebook: 'Facebook',
    x: 'X (Twitter)',
  };
  return names[platform];
}

/**
 * Calculate engagement rate from analytics
 */
export function calculateEngagementRate(
  engagements: number,
  impressions: number
): number {
  if (impressions === 0) return 0;
  return (engagements / impressions) * 100;
}

/**
 * Calculate CTR from analytics
 */
export function calculateCTR(clicks: number, impressions: number): number {
  if (impressions === 0) return 0;
  return (clicks / impressions) * 100;
}

/**
 * Sort posts by date (newest first)
 */
export function sortPostsByDate(posts: SocialPost[], ascending = false): SocialPost[] {
  return [...posts].sort((a, b) => {
    const dateA = a.scheduledAt || a.publishedAt || a.createdAt;
    const dateB = b.scheduledAt || b.publishedAt || b.createdAt;
    
    const diff = dateA.getTime() - dateB.getTime();
    return ascending ? diff : -diff;
  });
}

/**
 * Filter posts by date range
 */
export function filterPostsByDateRange(
  posts: SocialPost[],
  startDate: Date,
  endDate: Date
): SocialPost[] {
  return posts.filter(post => {
    const postDate = post.scheduledAt || post.publishedAt || post.createdAt;
    return postDate >= startDate && postDate <= endDate;
  });
}

/**
 * Group posts by date
 */
export function groupPostsByDate(posts: SocialPost[]): Record<string, SocialPost[]> {
  const grouped: Record<string, SocialPost[]> = {};
  
  posts.forEach(post => {
    const date = post.scheduledAt || post.publishedAt || post.createdAt;
    const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
    
    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }
    grouped[dateKey].push(post);
  });
  
  return grouped;
}

// ============================================================================
// Hashtag Utilities
// ============================================================================

/**
 * Extract hashtags from text
 */
export function extractHashtags(text: string): string[] {
  const hashtagRegex = /#[\w]+/g;
  return text.match(hashtagRegex) || [];
}

/**
 * Extract mentions from text
 */
export function extractMentions(text: string): string[] {
  const mentionRegex = /@[\w]+/g;
  return text.match(mentionRegex) || [];
}

/**
 * Format hashtags for Instagram first comment
 */
export function formatHashtagsForInstagram(hashtags: string[]): string {
  return hashtags.join(' ');
}

// ============================================================================
// Media Utilities
// ============================================================================

/**
 * Get image dimensions from file
 */
export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
}

/**
 * Calculate aspect ratio
 */
export function calculateAspectRatio(width: number, height: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height);
  return `${width / divisor}:${height / divisor}`;
}

/**
 * Check if aspect ratio is supported
 */
export function isSupportedAspectRatio(
  platform: SocialPlatform,
  aspectRatio: string
): boolean {
  const limits = getPlatformLimits(platform);
  return limits.aspectRatios.supported.includes(aspectRatio);
}

// ============================================================================
// Export all utilities
// ============================================================================

export const socialMediaUtils = {
  // Formatting
  formatFollowerCount,
  formatEngagementRate,
  formatCTR,
  formatFileSize,
  formatPostDate,
  formatScheduledTime,
  formatTimeAgo,
  
  // Platform limits
  getPlatformLimits,
  validatePostContent,
  canAddMedia,
  validateMediaFile,
  supportsFeature,
  
  // Character counting
  countCharacters,
  getRemainingCharacters,
  isWithinCharacterLimit,
  
  // URLs & UTM
  buildUTMUrl,
  parseUTMParams,
  extractLinks,
  shortenUrl,
  
  // Scheduling
  getOptimalPostTimes,
  isValidScheduleTime,
  convertToTimezone,
  roundToNearest15Minutes,
  
  // Post utilities
  getPostStatusColor,
  getPlatformColor,
  getPlatformDisplayName,
  calculateEngagementRate,
  calculateCTR,
  sortPostsByDate,
  filterPostsByDateRange,
  groupPostsByDate,
  
  // Hashtags & mentions
  extractHashtags,
  extractMentions,
  formatHashtagsForInstagram,
  
  // Media
  getImageDimensions,
  calculateAspectRatio,
  isSupportedAspectRatio,
};

export default socialMediaUtils;
