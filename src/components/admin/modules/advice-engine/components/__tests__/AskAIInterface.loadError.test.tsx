/**
 * Ask Vasco: a failed status/history load shows the shared error state; the
 * "OpenAI API key needs to be updated" warning is only for a key the server
 * reports as missing or invalid.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const chat = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
}));

vi.mock('../../hooks', () => ({
  useAIChat: () => chat.state,
  useClientSearch: () => ({
    searchTerm: '',
    setSearchTerm: vi.fn(),
    results: [],
    isSearching: false,
    selectedClient: null,
    selectClient: vi.fn(),
  }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { AskAIInterface } from '../AskAIInterface';

function base(over: Record<string, unknown> = {}) {
  return {
    messages: [],
    isLoading: false,
    error: null,
    sendMessage: vi.fn(),
    clearChat: vi.fn(),
    apiKeyStatus: { configured: true, valid: true },
    isConfigured: true,
    loadError: null,
    retryLoad: vi.fn(),
    ...over,
  };
}

beforeEach(() => {
  chat.state = base();
});

describe('AskAIInterface — failed loads', () => {
  it('shows "Unable to load Ask Vasco" (not the API-key warning) when loading fails', () => {
    const retryLoad = vi.fn();
    chat.state = base({
      apiKeyStatus: null,
      isConfigured: false,
      loadError: new Error('Request failed (400)'),
      retryLoad,
    });
    render(<AskAIInterface />);
    expect(screen.getByText('Unable to load Ask Vasco')).toBeTruthy();
    expect(screen.queryByText(/OpenAI API key needs to be updated/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }));
    expect(retryLoad).toHaveBeenCalled();
  });

  it('shows the API-key warning only when the server reports the key missing', () => {
    chat.state = base({
      apiKeyStatus: { configured: false, valid: false },
      isConfigured: false,
    });
    render(<AskAIInterface />);
    expect(screen.getByText(/OpenAI API key needs to be updated/)).toBeTruthy();
    expect(screen.queryByText('Unable to load Ask Vasco')).toBeNull();
  });
});
