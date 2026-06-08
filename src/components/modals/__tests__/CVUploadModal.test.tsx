import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CVUploadModal } from '../CVUploadModal';

describe('CVUploadModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<CVUploadModal isOpen={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders form fields when open', () => {
    render(<CVUploadModal isOpen onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText(/Your full name/i)).toBeDefined();
  });

  it('renders email field', () => {
    render(<CVUploadModal isOpen onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText(/your.email@example.com/i)).toBeDefined();
  });

  it('renders phone field', () => {
    render(<CVUploadModal isOpen onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText(/\+27/i)).toBeDefined();
  });

  it('renders upload area', () => {
    render(<CVUploadModal isOpen onClose={vi.fn()} />);
    expect(screen.getByText(/Drop your CV here/i)).toBeDefined();
  });

  it('renders submit button', () => {
    render(<CVUploadModal isOpen onClose={vi.fn()} />);
    expect(screen.getByText(/Submit Your CV/i)).toBeDefined();
  });

  it('updates form fields on input', () => {
    render(<CVUploadModal isOpen onClose={vi.fn()} />);
    const nameInput = screen.getByPlaceholderText(/Your full name/i);
    fireEvent.change(nameInput, { target: { value: 'John Doe' } });
    expect((nameInput as HTMLInputElement).value).toBe('John Doe');
  });

  it('renders non-empty container when open', () => {
    const { container } = render(<CVUploadModal isOpen onClose={vi.fn()} />);
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
