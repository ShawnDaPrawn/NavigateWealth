import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { CommunicationDraft } from '../../../types';

vi.mock('react-quill-new', () => ({
  default: (props: { value: string }) => <div data-testid="editor">{props.value}</div>,
}));
vi.mock('../../../api', () => ({ communicationApi: { uploadFile: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), loading: vi.fn() } }));

import { Step2Compose } from '../Step2Compose';

afterEach(cleanup);

const draft = (overrides: Partial<CommunicationDraft> = {}): CommunicationDraft => ({
  step: 2,
  channel: 'email',
  recipientType: 'multiple',
  selectedRecipients: [],
  subject: '',
  bodyHtml: '',
  attachments: [],
  scheduling: { type: 'immediate' },
  ...overrides,
});

describe('Step2Compose', () => {
  it('offers Email, with WhatsApp switched off and tagged Soon', () => {
    render(
      <Step2Compose draft={draft()} updateDraft={vi.fn()} onNext={vi.fn()} onBack={vi.fn()} />,
    );
    const channel = screen.getByRole('tablist', { name: 'Channel' });
    expect(channel).toBeDefined();
    const whatsapp = screen.getByRole('tab', { name: /WhatsApp/ }) as HTMLButtonElement;
    expect(whatsapp.disabled).toBe(true);
    expect(whatsapp.textContent).toContain('Soon');
  });

  it('shows the preview beside the editor, not in a dialog', () => {
    render(
      <Step2Compose
        draft={draft({ subject: 'Hi {{first_name}}', bodyHtml: '<p>Hello</p>' })}
        updateDraft={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText('Preview')).toBeDefined();
    expect(screen.getAllByText('Hi John').length).toBeGreaterThan(0);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('checks the subject and message on Continue, with the form error banner', () => {
    const onNext = vi.fn();
    render(<Step2Compose draft={draft()} updateDraft={vi.fn()} onNext={onNext} onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Continue to review/ }));
    expect(screen.getByText('Fix 2 fields to continue to review.')).toBeDefined();
    expect(screen.getByText('Add a subject line')).toBeDefined();
    expect(screen.getByLabelText('Subject').getAttribute('aria-invalid')).toBe('true');
    expect(onNext).not.toHaveBeenCalled();
  });

  it('continues when the subject and message are there', () => {
    const onNext = vi.fn();
    render(
      <Step2Compose
        draft={draft({ subject: 'Year end', bodyHtml: '<p>Hello</p>' })}
        updateDraft={vi.fn()}
        onNext={onNext}
        onBack={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Continue to review/ }));
    expect(onNext).toHaveBeenCalled();
  });
});
