import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import ConnectionForm from './ConnectionForm';
import { api } from '../../../utils/api/client';
import { actionLabels, type ActionKey } from '../../../shared/password-manager';
vi.mock('../../../utils/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.get).mockResolvedValue({ data: [] });
});
afterEach(cleanup);

const actionSelect = (key: ActionKey) =>
  screen.getByRole('combobox', { name: actionLabels[key] }) as HTMLSelectElement;

describe('connection form', () => {
  it('fills every action from the Full autonomy preset and goes custom on edit', async () => {
    const onSaved = vi.fn();
    vi.mocked(api.post).mockResolvedValue({ connection: { id: 'c1' }, token: 'tok' });
    render(
      <ConnectionForm connection={null} collections={[]} onClose={vi.fn()} onSaved={onSaved} />,
    );
    expect(actionSelect('money_workflow').value).toBe('ask');
    const presets = screen.getByRole('group', { name: 'Autonomy preset' });
    fireEvent.click(within(presets).getByRole('button', { name: 'Full autonomy' }));
    for (const key of Object.keys(actionLabels) as ActionKey[])
      expect(actionSelect(key).value).toBe('auto');

    fireEvent.change(actionSelect('money_workflow'), { target: { value: 'ask' } });
    expect(screen.getByText('Custom — you changed lines below.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Person’s name'), { target: { value: 'Amy' } });
    fireEvent.change(screen.getByLabelText('Connection name'), {
      target: { value: 'Amy’s Claude' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create connection' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(api.post).toHaveBeenCalledWith(
      '/password-vault/connections',
      expect.objectContaining({
        personName: 'Amy',
        expiresInDays: 90,
        autonomy: expect.objectContaining({
          level: 'custom',
          actions: expect.objectContaining({ reveal: 'auto', money_workflow: 'ask' }),
        }),
      }),
      expect.anything(),
    );
  });
});
