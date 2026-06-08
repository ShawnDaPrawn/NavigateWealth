import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSignerBranding } from '../useSignerBranding';

// ============================================================================
// Helpers
// ============================================================================

const DEFAULT_ACCENT = '#4f46e5';
const DEFAULT_DISPLAY_NAME = 'Navigate Wealth';

beforeEach(() => {
  // Reset any CSS variable set by a previous test
  document.documentElement.style.removeProperty('--esign-accent');
});

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.style.removeProperty('--esign-accent');
});

// ============================================================================
// Default values
// ============================================================================

describe('useSignerBranding — defaults', () => {
  it('returns default accent hex when branding is null', () => {
    const { result } = renderHook(() => useSignerBranding(null));

    expect(result.current.accentHex).toBe(DEFAULT_ACCENT);
  });

  it('returns default display name when branding is null', () => {
    const { result } = renderHook(() => useSignerBranding(null));

    expect(result.current.displayName).toBe(DEFAULT_DISPLAY_NAME);
  });

  it('returns null logoUrl when branding is null', () => {
    const { result } = renderHook(() => useSignerBranding(null));

    expect(result.current.logoUrl).toBeNull();
  });

  it('returns null supportEmail when branding is null', () => {
    const { result } = renderHook(() => useSignerBranding(null));

    expect(result.current.supportEmail).toBeNull();
  });

  it('returns default accent when branding is undefined', () => {
    const { result } = renderHook(() => useSignerBranding(undefined));

    expect(result.current.accentHex).toBe(DEFAULT_ACCENT);
  });
});

// ============================================================================
// accentHex validation
// ============================================================================

describe('useSignerBranding — accentHex', () => {
  it('uses provided valid 6-digit hex colour', () => {
    const { result } = renderHook(() => useSignerBranding({ accent_hex: '#ab1234' }));

    expect(result.current.accentHex).toBe('#ab1234');
  });

  it('falls back to default for invalid hex (short)', () => {
    const { result } = renderHook(() => useSignerBranding({ accent_hex: '#abc' }));

    expect(result.current.accentHex).toBe(DEFAULT_ACCENT);
  });

  it('falls back to default for hex without hash prefix', () => {
    const { result } = renderHook(() => useSignerBranding({ accent_hex: 'ab1234' }));

    expect(result.current.accentHex).toBe(DEFAULT_ACCENT);
  });

  it('falls back to default for null accent_hex', () => {
    const { result } = renderHook(() => useSignerBranding({ accent_hex: null }));

    expect(result.current.accentHex).toBe(DEFAULT_ACCENT);
  });
});

// ============================================================================
// displayName
// ============================================================================

describe('useSignerBranding — displayName', () => {
  it('uses provided display_name', () => {
    const { result } = renderHook(() => useSignerBranding({ display_name: 'My Firm' }));

    expect(result.current.displayName).toBe('My Firm');
  });

  it('trims whitespace from display_name', () => {
    const { result } = renderHook(() => useSignerBranding({ display_name: '  Trim Me  ' }));

    expect(result.current.displayName).toBe('Trim Me');
  });

  it('falls back to default when display_name is empty string', () => {
    const { result } = renderHook(() => useSignerBranding({ display_name: '' }));

    expect(result.current.displayName).toBe(DEFAULT_DISPLAY_NAME);
  });

  it('falls back to default when display_name is null', () => {
    const { result } = renderHook(() => useSignerBranding({ display_name: null }));

    expect(result.current.displayName).toBe(DEFAULT_DISPLAY_NAME);
  });
});

// ============================================================================
// logoUrl and supportEmail
// ============================================================================

describe('useSignerBranding — logoUrl and supportEmail', () => {
  it('returns provided logo_url', () => {
    const { result } = renderHook(() =>
      useSignerBranding({ logo_url: 'https://example.com/logo.png' }),
    );

    expect(result.current.logoUrl).toBe('https://example.com/logo.png');
  });

  it('returns null logoUrl when logo_url is empty string', () => {
    const { result } = renderHook(() => useSignerBranding({ logo_url: '' }));

    expect(result.current.logoUrl).toBeNull();
  });

  it('returns provided support_email', () => {
    const { result } = renderHook(() => useSignerBranding({ support_email: 'help@firm.co' }));

    expect(result.current.supportEmail).toBe('help@firm.co');
  });

  it('returns null supportEmail when support_email is null', () => {
    const { result } = renderHook(() => useSignerBranding({ support_email: null }));

    expect(result.current.supportEmail).toBeNull();
  });
});

// ============================================================================
// stripStyle and primaryButtonStyle
// ============================================================================

describe('useSignerBranding — derived styles', () => {
  it('stripStyle includes the accent colour', () => {
    const accent = '#ff6600';
    const { result } = renderHook(() => useSignerBranding({ accent_hex: accent }));

    expect(result.current.stripStyle.background).toContain(accent);
  });

  it('primaryButtonStyle background equals the accent colour', () => {
    const accent = '#ff6600';
    const { result } = renderHook(() => useSignerBranding({ accent_hex: accent }));

    expect(result.current.primaryButtonStyle.background).toBe(accent);
    expect(result.current.primaryButtonStyle.borderColor).toBe(accent);
  });

  it('uses default accent in styles when accent_hex is invalid', () => {
    const { result } = renderHook(() => useSignerBranding({ accent_hex: 'bad' }));

    expect(result.current.primaryButtonStyle.background).toBe(DEFAULT_ACCENT);
  });
});

// ============================================================================
// CSS custom property side effect
// ============================================================================

describe('useSignerBranding — CSS variable', () => {
  it('sets --esign-accent CSS variable on mount', () => {
    const accent = '#123456';
    renderHook(() => useSignerBranding({ accent_hex: accent }));

    expect(document.documentElement.style.getPropertyValue('--esign-accent')).toBe(accent);
  });

  it('removes --esign-accent on unmount when it was not set before', () => {
    const { unmount } = renderHook(() => useSignerBranding({ accent_hex: '#aabbcc' }));

    unmount();

    expect(document.documentElement.style.getPropertyValue('--esign-accent')).toBe('');
  });

  it('restores previous --esign-accent value on unmount', () => {
    const previous = '#111111';
    document.documentElement.style.setProperty('--esign-accent', previous);

    const { unmount } = renderHook(() => useSignerBranding({ accent_hex: '#aabbcc' }));

    // After unmount, previous value should be restored
    unmount();

    expect(document.documentElement.style.getPropertyValue('--esign-accent')).toBe(previous);
  });
});
