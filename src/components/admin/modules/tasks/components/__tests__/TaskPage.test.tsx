/**
 * TaskPage — the task as a full page (create and edit share it).
 *
 * Task mutation hooks, api, communicationApi, and @hello-pangea/dnd are mocked
 * to prevent React Query context requirements and drag-drop DOM errors.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/utils';

const { mutationStub } = vi.hoisted(() => ({
  mutationStub: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}));

const created = vi.hoisted(() => vi.fn());
vi.mock('@/components/admin/modules/tasks/hooks', () => ({
  useCreateTask: () => ({ mutate: vi.fn(), mutateAsync: created, isPending: false }),
  useUpdateTask: mutationStub,
  useDeleteTask: mutationStub,
  useDuplicateTask: mutationStub,
}));

vi.mock('@/components/admin/modules/communication/api', () => ({
  communicationApi: { getAllTemplates: vi.fn().mockResolvedValue([]), createTemplate: vi.fn() },
}));

vi.mock('@/utils/api', () => ({
  api: { get: vi.fn().mockResolvedValue([]), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

vi.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ children }: { children: React.ReactNode }) => children,
  Droppable: ({
    children,
  }: {
    children: (p: Record<string, unknown>, s: Record<string, unknown>) => React.ReactNode;
  }) =>
    children(
      { innerRef: () => {}, droppableProps: {}, placeholder: null },
      { isDraggingOver: false },
    ),
  Draggable: ({
    children,
  }: {
    children: (p: Record<string, unknown>, s: Record<string, unknown>) => React.ReactNode;
  }) =>
    children(
      { innerRef: () => {}, draggableProps: {}, dragHandleProps: {} },
      { isDragging: false },
    ),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock('@/components/auth/AuthContext', () => ({
  useAuth: () => ({ user: { firstName: 'Erin', lastName: 'Admin' } }),
}));

import { fireEvent } from '@/test/utils';
import { TaskPage } from '../TaskPage';

const noop = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TaskPage', () => {
  it('shows a new task as a page, not a dialog', () => {
    render(<TaskPage onClose={noop} mode="create" />);
    expect(screen.getByRole('heading', { level: 1, name: 'New task' })).toBeTruthy();
    expect(screen.getByText('Goes into To do')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Create task' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Back to board' })).toBeTruthy();
  });

  it('asks for a title inline before creating', async () => {
    render(<TaskPage onClose={noop} mode="create" />);
    fireEvent.click(screen.getByRole('button', { name: 'Create task' }));
    expect(await screen.findByText('Give the task a title')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Fix 1 field to create the task');
    expect(created).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Title/), { target: { value: 'Call the client' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create task' }));
    await waitFor(() => expect(created).toHaveBeenCalled());
    expect(created.mock.calls[0][0]).toMatchObject({ title: 'Call the client' });
    await waitFor(() => expect(noop).toHaveBeenCalled());
  });

  it('shows an existing task with its title, status and the next move', async () => {
    const task = { id: 't-1', title: 'Test Task', status: 'new', priority: 'medium' };
    render(<TaskPage onClose={noop} mode="view" task={task as never} />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Test Task' })).toBeTruthy();
    });
    expect(screen.getByText('Task · To do')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'More task actions' })).toBeTruthy();
  });

  it('hides the next move and the menu without edit and delete rights', () => {
    const task = { id: 't-1', title: 'Test Task', status: 'in_progress', priority: 'medium' };
    render(
      <TaskPage
        onClose={noop}
        mode="view"
        task={task as never}
        canEdit={false}
        canDelete={false}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Complete' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'More task actions' })).toBeNull();
  });
});
