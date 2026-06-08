import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmailSignatureGenerator } from '../EmailSignatureGenerator';

beforeEach(() => {
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('EmailSignatureGenerator', () => {
  it('renders without crashing', () => {
    const { container } = render(<EmailSignatureGenerator />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders heading', () => {
    render(<EmailSignatureGenerator />);
    expect(screen.getByText('Email Signature Generator')).toBeDefined();
  });

  it('renders form fields', () => {
    render(<EmailSignatureGenerator />);
    expect(screen.getByText(/Full Name/i)).toBeDefined();
  });

  it('renders template selector', () => {
    render(<EmailSignatureGenerator />);
    const allModern = screen.queryAllByText(/modern/i);
    expect(allModern.length).toBeGreaterThan(0);
  });

  it('renders non-empty container', () => {
    const { container } = render(<EmailSignatureGenerator />);
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
