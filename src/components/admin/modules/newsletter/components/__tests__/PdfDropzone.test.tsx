import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PdfDropzone } from '../PdfDropzone';
import { formatFileSize, pdfFileProblem } from '../../utils/pdf';
import { MAX_PDF_BYTES } from '../../constants';

const pdf = (name = 'issue.pdf', size = 1024, type = 'application/pdf') => {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('pdfFileProblem', () => {
  it('accepts a PDF by type or extension and rejects the rest', () => {
    expect(pdfFileProblem(pdf())).toBeNull();
    expect(pdfFileProblem(pdf('issue.PDF', 10, ''))).toBeNull();
    expect(pdfFileProblem(pdf('photo.png', 10, 'image/png'))).toMatch(/Only PDF/);
    expect(pdfFileProblem(pdf('issue.pdf', 0))).toMatch(/empty/);
    expect(pdfFileProblem(pdf('issue.pdf', MAX_PDF_BYTES + 1))).toMatch(/limit is 5 MB/);
  });

  it('formats sizes for people', () => {
    expect(formatFileSize(512)).toBe('1 KB');
    expect(formatFileSize(300 * 1024)).toBe('300 KB');
    expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
  });
});

describe('PdfDropzone', () => {
  it('hands a valid file to onSelect and reports a bad one inline instead', () => {
    const onSelect = vi.fn();
    const { container } = render(<PdfDropzone stored={null} onSelect={onSelect} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [pdf('photo.png', 10, 'image/png')] } });
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/Only PDF/);

    fireEvent.change(input, { target: { files: [pdf()] } });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('accepts a dropped file', () => {
    const onSelect = vi.fn();
    render(<PdfDropzone stored={null} onSelect={onSelect} />);
    fireEvent.drop(screen.getByRole('button', { name: /upload the newsletter pdf/i }), {
      dataTransfer: { files: [pdf('dropped.pdf')] },
    });
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ name: 'dropped.pdf' }));
  });

  it('shows the stored PDF with preview and replace, and hides replace when disabled', () => {
    const onPreview = vi.fn();
    const stored = {
      storagePath: 'c1/x.pdf',
      fileName: 'September.pdf',
      sizeBytes: 2 * 1024 * 1024,
      uploadedAt: new Date().toISOString(),
    };
    const { rerender } = render(
      <PdfDropzone stored={stored} onSelect={vi.fn()} onPreview={onPreview} />,
    );
    expect(screen.getByText('September.pdf')).toBeTruthy();
    expect(screen.getByText(/2\.0 MB/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /preview/i }));
    expect(onPreview).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /replace/i })).toBeTruthy();

    rerender(<PdfDropzone stored={stored} onSelect={vi.fn()} onPreview={onPreview} disabled />);
    expect(screen.queryByRole('button', { name: /replace/i })).toBeNull();
  });

  it('surfaces a server-side rejection passed in as error', () => {
    render(<PdfDropzone stored={null} onSelect={vi.fn()} error="The file is not a PDF." />);
    expect(screen.getByRole('alert').textContent).toBe('The file is not a PDF.');
  });
});
