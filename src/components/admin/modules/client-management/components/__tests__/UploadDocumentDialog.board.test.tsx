import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('../../../../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/utils/api', () => ({ api: { post: vi.fn(), get: vi.fn() } }));

import { UploadDocumentDialog } from '../UploadDocumentDialog';

afterEach(() => cleanup());

function renderDialog() {
  render(
    <UploadDocumentDialog
      open
      onOpenChange={vi.fn()}
      selectedClient={{ id: 'c1' }}
      onUploaded={vi.fn()}
      onLinkAdded={vi.fn()}
    />,
  );
}

describe('Add document or link dialog', () => {
  it('offers Upload document | Add link, and General upload | Subcategory group', () => {
    renderDialog();
    expect(screen.getByRole('heading', { name: 'Add document or link' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Upload document/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /General upload/ })).toBeTruthy();
    expect(screen.getByText('Category *')).toBeTruthy();
    expect(screen.getByText('PDF, DOC, DOCX, XLS, XLSX, JPG, PNG · max 50MB')).toBeTruthy();
  });

  it('shows the pack name and groups for a subcategory group upload', () => {
    renderDialog();
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Subcategory group/ }));
    expect(screen.getByText('Pack name (required)')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Add another subcategory group/ })).toBeTruthy();
  });

  it('shows the link fields on Add link', () => {
    renderDialog();
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Add link/ }));
    expect(screen.getByText('URL *')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Add link/ })).toBeTruthy();
  });
});
