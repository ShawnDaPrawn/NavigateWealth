/**
 * Attachment and comment shapes for the task form modal. Moved verbatim
 * from TaskFormModal.tsx.
 */
export interface Attachment {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  uploadedAt: string;
}

export interface TaskComment {
  id: string;
  text: string;
  taskId: string;
  createdAt: string;
  userId?: string; // In a real app, we'd have user info
  userName?: string;
}
