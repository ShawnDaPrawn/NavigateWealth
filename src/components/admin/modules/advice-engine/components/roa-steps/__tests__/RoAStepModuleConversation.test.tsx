/**
 * RoAStepModuleConversation — fire-and-forget chat and upload handlers.
 *
 * A failed upload used to escape the file input's onChange as an unhandled
 * rejection and land in Issue Manager. sendMessage already restored the draft
 * on failure; uploadFile now has to fail the same way: toasted by the hook,
 * swallowed here, and the attach control left usable.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { RoADraft, RoAModule } from '../../../types';

const chat = vi.hoisted(() => ({
  sendMessage: vi.fn(),
  uploadFile: vi.fn(),
  completeModule: vi.fn(),
  status: 'pending' as 'pending' | 'in_progress' | 'complete',
  isComplete: false,
  isLoading: false,
}));

vi.mock('../../../hooks/useRoAModuleChat', () => ({
  useRoAModuleChat: () => ({
    messages: [],
    status: chat.status,
    isComplete: chat.isComplete,
    isLoading: chat.isLoading,
    conversation: null,
    sendMessage: chat.sendMessage,
    uploadFile: chat.uploadFile,
    completeModule: chat.completeModule,
  }),
}));

vi.mock('../RoAStepModuleDetails', () => ({
  RoAStepModuleDetails: () => <div>form-fallback</div>,
}));

import { RoAStepModuleConversation } from '../RoAStepModuleConversation';

function makeDraft(): RoADraft {
  return {
    id: 'draft-1',
    selectedModules: ['risk'],
    moduleData: {},
    status: 'draft',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    version: 1,
  };
}

function makeModule(mode: 'ai-signal' | 'manual' = 'ai-signal'): RoAModule {
  return {
    id: 'risk',
    title: 'Risk',
    description: 'Capture the risk need',
    fields: [],
    disclosures: [],
    compileOrder: [],
    authoringMode: 'conversation',
    conversation: {
      instructions: 'Ask about the need',
      narrativeSections: [],
      uploads: [
        {
          id: 'policy',
          label: 'Policy schedule',
          required: true,
          acceptedMimeTypes: ['application/pdf'],
        },
      ],
      completion: { mode },
    },
  };
}

function renderStep(mode: 'ai-signal' | 'manual' = 'ai-signal') {
  return render(
    <RoAStepModuleConversation
      draft={makeDraft()}
      onUpdate={vi.fn()}
      modules={[makeModule(mode)]}
      onAllComplete={vi.fn()}
    />,
  );
}

beforeEach(() => {
  chat.sendMessage.mockReset();
  chat.uploadFile.mockReset();
  chat.completeModule.mockReset();
  chat.status = 'pending';
  chat.isComplete = false;
  chat.isLoading = false;
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('RoAStepModuleConversation', () => {
  it('swallows a rejected upload and leaves the attach control usable', async () => {
    chat.uploadFile.mockRejectedValue(new Error('Files must be 15 MB or smaller.'));
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);

    try {
      renderStep();
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['hello'], 'policy.pdf', { type: 'application/pdf' });

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => expect(chat.uploadFile).toHaveBeenCalledWith('policy', file));
      await waitFor(() => expect(screen.getByText('Attach file')).toBeDefined());
      expect(input.disabled).toBe(false);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('restores the draft when sending fails', async () => {
    chat.sendMessage.mockRejectedValue(new Error('network down'));
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);

    try {
      renderStep();
      const textarea = screen.getByPlaceholderText(/Type your message/) as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'Need a policy' } });
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));

      await waitFor(() => expect(textarea.value).toBe('Need a policy'));
      expect(chat.sendMessage).toHaveBeenCalledWith('Need a policy');
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('keeps Complete disabled until an ai-signal module is finished', () => {
    renderStep('ai-signal');
    expect(
      (screen.getByRole('button', { name: /Complete & continue/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('lets the adviser complete a manual module before the assistant finishes', () => {
    renderStep('manual');
    expect(
      (screen.getByRole('button', { name: /Complete & continue/ }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });
});
