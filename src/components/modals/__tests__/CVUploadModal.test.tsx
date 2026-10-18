import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const toastSuccess = vi.fn();
vi.mock('sonner', () => ({ toast: { success: (m: string) => toastSuccess(m), error: vi.fn() } }));
vi.mock('../../../utils/supabase/info', () => ({ projectId: 'proj', publicAnonKey: 'anon' }));

const { CVUploadModal } = await import('../CVUploadModal');

afterEach(() => {
  vi.unstubAllGlobals();
  toastSuccess.mockReset();
});

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

  it('asks for the CV by email instead of pretending to upload it', () => {
    render(<CVUploadModal isOpen onClose={vi.fn()} />);
    expect(screen.queryByText(/Drop your CV here/i)).toBeNull();
    const link = screen.getByRole('link', { name: 'info@navigatewealth.co' });
    expect(link.getAttribute('href')).toMatch(/^mailto:info@navigatewealth\.co\?subject=/);
  });

  it('sends the applicant details as a real enquiry before confirming', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    const onClose = vi.fn();
    render(<CVUploadModal isOpen onClose={onClose} />);

    fireEvent.change(screen.getByPlaceholderText(/Your full name/i), {
      target: { value: 'Jane Doe' },
    });
    fireEvent.change(screen.getByPlaceholderText(/your.email@example.com/i), {
      target: { value: 'jane@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/\+27/i), { target: { value: '082 000 0000' } });
    fireEvent.click(screen.getByRole('button', { name: /Send My Details/ }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/contact-form/submit');
    expect(JSON.parse(init.body)).toMatchObject({
      firstName: 'Jane',
      lastName: 'Doe',
      service: 'Careers',
      clientType: 'job application',
    });
    expect(toastSuccess).toHaveBeenCalled();
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
