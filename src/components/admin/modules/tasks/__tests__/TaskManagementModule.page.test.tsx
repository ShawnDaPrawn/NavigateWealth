import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { makeTestQueryClient } from '@/test/utils';
import type { Task } from '../types';

const tasks = [
  { id: 't-new', title: 'Send quote', status: 'new', priority: 'medium' },
  { id: 't-prog', title: 'Chase transfer', status: 'in_progress', priority: 'high' },
  { id: 't-done', title: 'File disclosure', status: 'completed', priority: 'low' },
  {
    id: 't-arch-1',
    title: 'Renew PI cover',
    status: 'archived',
    priority: 'medium',
    updated_at: '2026-09-30T00:00:00Z',
  },
  {
    id: 't-arch-2',
    title: 'Update FAIS log',
    status: 'archived',
    priority: 'low',
    updated_at: '2026-09-15T00:00:00Z',
  },
] as unknown as Task[];

const toastError = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({
  toast: { error: (m: string) => toastError(m), success: vi.fn(), info: vi.fn() },
}));

const perms = vi.hoisted(() => ({ create: true }));
const load = vi.hoisted(() => ({ error: null as Error | null, refetch: vi.fn() }));
vi.mock('../../personnel', () => ({
  useCurrentUserPermissions: () => ({
    canDo: (_m: string, action: string) => (action === 'create' ? perms.create : true),
  }),
}));

vi.mock('../hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks')>();
  const mutation = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
  return {
    ...actual,
    useTasks: () => ({
      data: tasks,
      isLoading: false,
      error: load.error,
      refetch: load.refetch,
      isFetching: false,
    }),
    useTaskStats: () => ({
      data: { total: 3, new: 1, in_progress: 1, completed: 1, archived: 2 },
    }),
    useUpdateTask: mutation,
    useDeleteTask: mutation,
    useMoveTask: mutation,
    useReorderTasks: mutation,
  };
});

vi.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('../components/TaskColumn', () => ({
  TaskColumn: (props: { status: string; tasks: Task[]; onViewTask: (t: Task) => void }) => (
    <section aria-label={`column ${props.status}`}>
      {props.tasks.map((t) => (
        <button key={t.id} onClick={() => props.onViewTask(t)}>
          {t.title}
        </button>
      ))}
    </section>
  ),
}));
vi.mock('../components/TaskPage', () => ({
  TaskPage: (props: {
    task?: Task | null;
    mode: string;
    onClose: () => void;
    backLabel: string;
  }) => (
    <div>
      <h1>{props.mode === 'create' ? 'New task' : props.task?.title}</h1>
      <button onClick={props.onClose}>Back to {props.backLabel}</button>
    </div>
  ),
}));

import { TaskManagementModule } from '../TaskManagementModule';

afterEach(() => {
  cleanup();
  toastError.mockClear();
  perms.create = true;
  load.error = null;
  load.refetch.mockClear();
});

function Location() {
  return <output data-testid="search">{useLocation().search}</output>;
}

function renderAt(url = '/admin?module=tasks') {
  render(
    <QueryClientProvider client={makeTestQueryClient()}>
      <MemoryRouter initialEntries={[url]}>
        <TaskManagementModule />
        <Location />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('To-Do page', () => {
  it('shows the header, the four status cards and the board', () => {
    renderAt();
    expect(screen.getByRole('heading', { level: 1, name: 'To-Do' })).toBeDefined();
    for (const label of ['Open', 'To do', 'In progress', 'Completed']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${label}`) })).toBeDefined();
    }
    expect(screen.getByRole('region', { name: 'column new' })).toBeDefined();
    expect(screen.getByRole('region', { name: 'column completed' })).toBeDefined();
  });

  it('filters the board from a stat card and keeps the filter in the address', () => {
    renderAt();
    const open = screen.getByRole('button', { name: /^Open/ });
    fireEvent.click(open);
    expect(open.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('search').textContent).toBe('?module=tasks&status=open');
    expect(screen.getByRole('region', { name: 'column in_progress' })).toBeDefined();
    expect(screen.queryByRole('region', { name: 'column completed' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Status: Open' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByTestId('search').textContent).toBe('?module=tasks');
  });

  it('opens a task as a page with the task in the address, and Back returns', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Chase transfer' }));
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'Chase transfer' }));
    expect(screen.queryByRole('heading', { name: 'To-Do' })).toBeNull();
    expect(screen.getByTestId('search').textContent).toBe('?module=tasks&task=t-prog');

    fireEvent.click(screen.getByRole('button', { name: 'Back to board' }));
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'To-Do' }));
    expect(screen.getByTestId('search').textContent).toBe('?module=tasks');
  });

  it('opens the task named in the address (Dashboard "Due today" link)', async () => {
    renderAt('/admin?module=tasks&task=t-new');
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'Send quote' }));
  });

  it('drops an unknown task from the address and says so', async () => {
    renderAt('/admin?module=tasks&task=nope');
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Task not found'));
    expect(screen.getByRole('heading', { level: 1, name: 'To-Do' })).toBeDefined();
    expect(screen.getByTestId('search').textContent).toBe('?module=tasks');
  });

  it('opens New task as a page at ?task=new', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'New task' }));
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'New task' }));
    expect(screen.getByTestId('search').textContent).toBe('?module=tasks&task=new');
  });

  it('does not open a new task from the address without create rights', async () => {
    perms.create = false;
    renderAt('/admin?module=tasks&task=new');
    await waitFor(() => expect(screen.getByTestId('search').textContent).toBe('?module=tasks'));
    expect(screen.queryByRole('button', { name: 'New task' })).toBeNull();
  });

  it('lists archived tasks in their tab with search and a priority chip', async () => {
    renderAt('/admin?module=tasks&tab=archived');
    expect(screen.getByRole('tab', { name: /Archived/ }).getAttribute('data-state')).toBe('active');
    expect(screen.getByText('Renew PI cover')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Filter by priority' })).toBeDefined();

    fireEvent.change(screen.getByLabelText('Search archived tasks'), {
      target: { value: 'FAIS' },
    });
    expect(screen.queryByText('Renew PI cover')).toBeNull();
    expect(screen.getByText('1 of 2 archived')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Update FAIS log' }));
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'Update FAIS log' }));
    expect(screen.getByRole('button', { name: 'Back to archived tasks' })).toBeDefined();
  });

  it('counts the board and the archive in the tabs', () => {
    renderAt();
    expect(screen.getByRole('tab', { name: /Board/ }).textContent).toContain('3');
    expect(screen.getByRole('tab', { name: /Archived/ }).textContent).toContain('2');
  });

  it('shows the standard error with Try again when tasks cannot load', () => {
    load.error = new Error('boom');
    renderAt();
    expect(screen.getByRole('heading', { name: 'Unable to load tasks' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Board' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(load.refetch).toHaveBeenCalled();
  });

  it('keeps a linked task in the address while tasks fail to load', () => {
    load.error = new Error('boom');
    renderAt('/admin?module=tasks&task=t-new');
    expect(screen.getByRole('heading', { name: 'Unable to load tasks' })).toBeDefined();
    expect(toastError).not.toHaveBeenCalled();
    expect(screen.getByTestId('search').textContent).toBe('?module=tasks&task=t-new');
  });

  it('says when no task matches the filters, with Clear filters', () => {
    renderAt();
    fireEvent.change(screen.getByLabelText('Search tasks'), { target: { value: 'zzz' } });
    expect(screen.getByText('No tasks match your filters.')).toBeDefined();
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear filters' })[1]);
    expect(screen.queryByText('No tasks match your filters.')).toBeNull();
  });

  it('says when no archived task matches, with Clear filters', () => {
    renderAt('/admin?module=tasks&tab=archived');
    fireEvent.change(screen.getByLabelText('Search archived tasks'), { target: { value: 'zzz' } });
    expect(
      screen.getByRole('heading', { name: 'No archived tasks match your filters' }),
    ).toBeDefined();
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear filters' }).at(-1)!);
    expect(screen.getByText('Renew PI cover')).toBeDefined();
  });
});
