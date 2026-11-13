/**
 * Resources › Tools — three tool cards; each tool opens as a page of its own
 * (not a dialog) with "‹ Back to Tools", and the open tool is in the address.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';

vi.mock('../FormTemplateTool', () => ({
  FormTemplateTool: () => <div>Mapping studio body</div>,
}));
vi.mock('../ZipEncryptTool', () => ({ ZipEncryptTool: () => <div>Zip body</div> }));
vi.mock('../PdfDecryptTool', () => ({ PdfDecryptTool: () => <div>Decrypt body</div> }));

import { ToolsTab } from '../ToolsTab';
import { BreadcrumbContext } from '@/components/admin/layout/page/breadcrumbContext';

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.search}</div>;
}

function renderTab(initial = '/') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <ToolsTab />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('ToolsTab', () => {
  it('lists the three tools as cards', () => {
    renderTab();
    expect(screen.getByRole('heading', { name: 'Form Mapping Studio' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Zip & Encrypt' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'PDF Decryptor' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens a tool as a page with a back link, kept in the address', async () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Open Zip & Encrypt' }));

    expect(await screen.findByText('Zip body')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Zip & Encrypt' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('location').textContent).toContain('tool=zip');

    fireEvent.click(screen.getByRole('button', { name: /Back to Tools/ }));
    await waitFor(() => expect(screen.queryByText('Zip body')).toBeNull());
    expect(screen.getByTestId('location').textContent).not.toContain('tool=');
  });

  it('lands on the tool named in a pasted link', async () => {
    renderTab('/?tool=decrypt');
    expect(await screen.findByText('Decrypt body')).toBeTruthy();
  });

  it('sets the top-bar breadcrumb to Tools › <tool>', async () => {
    const setTrail = vi.fn();
    render(
      <BreadcrumbContext.Provider value={{ trail: [], setTrail }}>
        <MemoryRouter initialEntries={['/?tool=mapping']}>
          <ToolsTab />
        </MemoryRouter>
      </BreadcrumbContext.Provider>,
    );
    await screen.findByText('Mapping studio body');
    const last = setTrail.mock.calls.at(-1)?.[0] as Array<{ label: string }>;
    expect(last.map((c) => c.label)).toEqual(['Tools', 'Form Mapping Studio']);
  });
});
