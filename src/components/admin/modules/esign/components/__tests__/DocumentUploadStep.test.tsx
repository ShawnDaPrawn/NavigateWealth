/**
 * The documents step is now controlled — every keystroke and every dropped
 * file has to reach the parent's wizard state, because that state is what the
 * shell reads to decide whether Continue is allowed. A step that quietly kept
 * its own copy would show a filled-in form behind a dead button.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/utils';

import { DocumentUploadStep } from '../DocumentUploadStep';
import { DEFAULT_EXPIRY_DAYS, type DocumentUploadValue } from '../documentStepModel';

const EMPTY: DocumentUploadValue = {
  files: [],
  title: '',
  message: '',
  expiryDays: DEFAULT_EXPIRY_DAYS,
};

function pdf(name = 'mandate.pdf', size = 1024) {
  const file = new File(['%PDF-1.7'], name, { type: 'application/pdf' });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

function fileInput(container: HTMLElement) {
  const input = container.querySelector('input[type="file"]');
  expect(input).toBeTruthy();
  return input as HTMLInputElement;
}

function drop(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, 'files', { value: files, configurable: true });
  fireEvent.change(input);
}

describe('DocumentUploadStep', () => {
  it('reports an added PDF up to the parent and names the envelope after it', () => {
    const onChange = vi.fn();
    const { container } = render(<DocumentUploadStep value={EMPTY} onChange={onChange} />);

    drop(fileInput(container), [pdf()]);

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as DocumentUploadValue;
    expect(next.files).toHaveLength(1);
    expect(next.title).toBe('mandate');
  });

  it('leaves a title the user has already typed alone', () => {
    const onChange = vi.fn();
    const { container } = render(
      <DocumentUploadStep value={{ ...EMPTY, title: 'Signed by hand' }} onChange={onChange} />,
    );

    drop(fileInput(container), [pdf()]);

    expect((onChange.mock.calls[0][0] as DocumentUploadValue).title).toBe('Signed by hand');
  });

  it('refuses a non-PDF and says which file was rejected', () => {
    const onChange = vi.fn();
    const { container } = render(<DocumentUploadStep value={EMPTY} onChange={onChange} />);

    drop(fileInput(container), [new File(['x'], 'notes.docx', { type: 'application/msword' })]);

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/notes\.docx is not a PDF/i);
  });

  it('refuses a PDF over the size limit', () => {
    const onChange = vi.fn();
    const { container } = render(<DocumentUploadStep value={EMPTY} onChange={onChange} />);

    drop(fileInput(container), [pdf('huge.pdf', 11 * 1024 * 1024)]);

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/larger than 10MB/i);
  });

  it('refuses a file that is already on the envelope', () => {
    const onChange = vi.fn();
    const existing = pdf();
    const { container } = render(
      <DocumentUploadStep value={{ ...EMPTY, files: [existing] }} onChange={onChange} />,
    );

    drop(fileInput(container), [pdf()]);

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/already added/i);
  });

  it('removes a file the user drops from the list', () => {
    const onChange = vi.fn();
    render(
      <DocumentUploadStep
        value={{ ...EMPTY, files: [pdf('a.pdf'), pdf('b.pdf')] }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /remove a\.pdf/i }));

    const next = onChange.mock.calls[0][0] as DocumentUploadValue;
    expect(next.files.map((f) => f.name)).toEqual(['b.pdf']);
  });

  it('pushes title, message and expiry edits straight to the parent', () => {
    const onChange = vi.fn();
    render(<DocumentUploadStep value={EMPTY} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/envelope title/i), { target: { value: 'Mandate' } });
    fireEvent.change(screen.getByLabelText(/message to recipients/i), {
      target: { value: 'Please sign' },
    });
    fireEvent.change(screen.getByLabelText(/days to expire/i), { target: { value: '14' } });

    expect((onChange.mock.calls[0][0] as DocumentUploadValue).title).toBe('Mandate');
    expect((onChange.mock.calls[1][0] as DocumentUploadValue).message).toBe('Please sign');
    expect((onChange.mock.calls[2][0] as DocumentUploadValue).expiryDays).toBe(14);
  });

  it('shows the resulting expiry date, and flags an out-of-range one instead', () => {
    const { rerender } = render(<DocumentUploadStep value={EMPTY} onChange={vi.fn()} />);
    expect(screen.getByText(/^Expires on /)).toBeTruthy();

    rerender(<DocumentUploadStep value={{ ...EMPTY, expiryDays: 400 }} onChange={vi.fn()} />);
    expect(screen.getByText(/choose between 1 and 365 days/i)).toBeTruthy();
  });
});
