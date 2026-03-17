/**
 * Centralized image URL constants with optimization
 * Use these constants throughout the app for consistent, optimized image loading
 */

import { applyImagePreset } from './imageOptimization';

/**
 * Team member images - optimized for avatar display
 */
export const TEAM_IMAGES = {
  michael: applyImagePreset(
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face',
    'avatar'
  ),
  sarah: applyImagePreset(
    'https://images.unsplash.com/photo-1494790108755-2616b2e8b8c8?w=400&h=400&fit=crop&crop=face',
    'avatar'
  ),
  david: applyImagePreset(
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face',
    'avatar'
  ),
} as const;

/**
 * Service card images - optimized for card display
 */
export const SERVICE_IMAGES = {
  riskManagement: applyImagePreset(
    'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&h=250&fit=crop',
    'card'
  ),
  retirementPlanning: applyImagePreset(
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=250&fit=crop',
    'card'
  ),
  investmentManagement: applyImagePreset(
    'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=250&fit=crop',
    'card'
  ),
  employeeBenefits: applyImagePreset(
    'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=400&h=250&fit=crop',
    'card'
  ),
  taxPlanning: applyImagePreset(
    'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&h=250&fit=crop',
    'card'
  ),
  financialPlanning: applyImagePreset(
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=250&fit=crop',
    'card'
  ),
  estatePlanning: applyImagePreset(
    'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=400&h=250&fit=crop',
    'card'
  ),
} as const;

/**
 * Common placeholder colors for images
 */
export const PLACEHOLDER_COLORS = {
  purple: '#6d28d9',
  lightPurple: '#a78bfa',
  gray: '#e5e7eb',
  lightGray: '#f3f4f6',
} as const;

/**
 * Image loading priorities for different page sections
 */
export const IMAGE_PRIORITIES = {
  hero: 'high' as const,
  aboveFold: 'high' as const,
  card: 'auto' as const,
  belowFold: 'low' as const,
  avatar: 'auto' as const,
  thumbnail: 'low' as const,
} as const;

/**
 * Recommended image sizes for different use cases
 */
export const RECOMMENDED_SIZES = {
  hero: { width: 1920, height: 800 },
  card: { width: 600, height: 400 },
  thumbnail: { width: 300, height: 200 },
  avatar: { width: 200, height: 200 },
  icon: { width: 100, height: 100 },
  fullWidth: { width: 1600, height: undefined },
  banner: { width: 1200, height: 400 },
} as const;
