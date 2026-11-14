import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Table, TableBody } from '../../../../../ui/table';
import { TooltipProvider } from '../../../../../ui/tooltip';
import { EnvelopeManagementTableRow } from '../EnvelopeManagementTableRow';
import type { EsignEnvelope } from '../../types';

vi.mock('../../api', () => ({ esignApi: { getCertificateUrl: vi.fn() } }));

afterEach(() => cleanup());

function envelope(status: string): EsignEnvelope {
  return {
    id: 'e1',
    title: 'Record of Advice',
    status,
    created_at: '2026-11-09T00:00:00Z',
    signers: [],
  } as unknown as EsignEnvelope;
}

function renderRow(status: string, layout: 'icons' | 'menu' = 'menu') {
  const handlers = {
    onRowClick: vi.fn(),
    onView: vi.fn(),
    onDownload: vi.fn(async () => undefined),
    onDelete: vi.fn(),
    onRecall: vi.fn(),
  };
  render(
    <TooltipProvider>
      <Table>
        <TableBody>
          <EnvelopeManagementTableRow
            envelope={envelope(status)}
            actionsLayout={layout}
            {...handlers}
          />
        </TableBody>
      </Table>
    </TooltipProvider>,
  );
  return handlers;
}

async function openMenu() {
  fireEvent.pointerDown(screen.getByRole('button', { name: /More actions/ }), {
    button: 0,
    ctrlKey: false,
  });
  await screen.findByRole('menu');
}

describe('Envelope row — menu layout (client E-Sign tab)', () => {
  it('a pending envelope shows View details, with Recall under ⋯', async () => {
    const h = renderRow('sent');
    fireEvent.click(screen.getByRole('button', { name: 'View details' }));
    expect(h.onView).toHaveBeenCalled();
    await openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Recall/ }));
    expect(h.onRecall).toHaveBeenCalled();
  });

  it('a draft shows Continue, with Delete under ⋯', async () => {
    const h = renderRow('draft');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(h.onRowClick).toHaveBeenCalled();
    await openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Delete/ }));
    expect(h.onDelete).toHaveBeenCalled();
  });

  it('a completed envelope shows Download PDF, with the certificate under ⋯', async () => {
    const h = renderRow('completed');
    fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
    expect(h.onDownload).toHaveBeenCalled();
    await openMenu();
    expect(screen.getByRole('menuitem', { name: /Download certificate/ })).toBeTruthy();
  });

  it('keeps the icon layout by default for other screens', () => {
    renderRow('sent', 'icons');
    expect(screen.getByRole('button', { name: 'Recall envelope' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /More actions/ })).toBeNull();
  });
});
