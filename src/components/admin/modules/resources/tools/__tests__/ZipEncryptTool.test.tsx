import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../hooks/useZipEncryption', () => ({
  useZipEncryption: () => ({
    processing: false,
    progress: 0,
    currentAction: '',
    zipUrl: null,
    generateZip: vi.fn(),
    reset: vi.fn(),
  }),
  FileItem: {},
  EncryptionMethod: {},
}));

import { ZipEncryptTool } from '../ZipEncryptTool';

describe('ZipEncryptTool', () => {
  it('renders without crashing', () => {
    const { container } = render(<ZipEncryptTool />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders ZIP heading or button', () => {
    render(<ZipEncryptTool />);
    const els = screen.queryAllByText(/Zip|Encrypt|Secure/i);
    expect(els.length).toBeGreaterThan(0);
  });

  it('renders non-empty container', () => {
    const { container } = render(<ZipEncryptTool />);
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
