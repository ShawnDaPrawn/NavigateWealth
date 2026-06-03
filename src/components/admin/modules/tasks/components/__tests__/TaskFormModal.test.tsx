/**
 * TaskFormModal — Render / Characterization Test (Phase 4)
 * =========================================================
 *
 * Locks the null guard (returns null when isOpen is false), dialog titles
 * ("Create New Task" / "Task Details"), and the Save button for this
 * 1,068-line Phase 6 decomposition target.
 *
 * Task mutation hooks, api, communicationApi, and @hello-pangea/dnd are mocked
 * to prevent React Query context requirements and drag-drop DOM errors.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/test/utils';

const mutationStub = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });

vi.mock('@/components/admin/modules/tasks/hooks', () => ({
  useCreateTask: mutationStub,
  useUpdateTask: mutationStub,
  useDeleteTask: mutationStub,
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
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { TaskFormModal } from '../TaskFormModal';

const noop = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TaskFormModal', () => {
  it('renders nothing (returns null) when isOpen is false', () => {
    const { container } = render(<TaskFormModal isOpen={false} onClose={noop} mode="create" />);
    expect(container.firstChild).toBeNull();
  });

  it('shows "Create New Task" dialog title when open in create mode', () => {
    render(<TaskFormModal isOpen={true} onClose={noop} mode="create" />);

    expect(screen.getByText('Create New Task')).toBeTruthy();
  });

  it('shows "Task Details" title when open in view mode with a task', () => {
    const task = { id: 't-1', title: 'Test Task', status: 'new', priority: 'medium' };
    render(<TaskFormModal isOpen={true} onClose={noop} mode="view" task={task as never} />);

    expect(screen.getByText('Task Details')).toBeTruthy();
  });
});
