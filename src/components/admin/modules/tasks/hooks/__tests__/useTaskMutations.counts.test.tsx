/** Creating or deleting a task refreshes the sidebar To-Do count. */
import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { pendingCountsKeys } from '../../../../../../utils/queryKeys';

vi.mock('../../api', () => ({
  TasksAPI: {
    createTask: vi.fn().mockResolvedValue({ id: 't-1' }),
    deleteTask: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useCreateTask, useDeleteTask } from '../useTaskMutations';

function setup() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { invalidate, wrapper };
}

describe('task mutations and the sidebar count', () => {
  it('create refreshes pending counts', async () => {
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useCreateTask(), { wrapper });
    await act(() => result.current.mutateAsync({ title: 'Call client' } as never));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: pendingCountsKeys.all });
  });

  it('delete refreshes pending counts', async () => {
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useDeleteTask(), { wrapper });
    await act(() => result.current.mutateAsync('t-1'));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: pendingCountsKeys.all });
  });
});
