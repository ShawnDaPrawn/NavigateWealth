/**
 * The activity/comments section of the task form modal. JSX moved verbatim
 * from TaskFormModal.tsx; every captured name became a prop.
 */
import React from 'react';
import { Button } from '../../../../ui/button';
import { Textarea } from '../../../../ui/textarea';
import { Activity, Loader2, User } from 'lucide-react';
import type { TaskComment } from './taskFormModalModel';

interface TaskActivitySectionProps {
  comments: TaskComment[];
  isLoadingComments: boolean;
  newComment: string;
  setNewComment: React.Dispatch<React.SetStateAction<string>>;
  handleAddComment: () => Promise<void>;
  handleDeleteComment: (commentId: string) => Promise<void>;
}

export function TaskActivitySection({
  comments,
  isLoadingComments,
  newComment,
  setNewComment,
  handleAddComment,
  handleDeleteComment,
}: TaskActivitySectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="text-gray-500">
          <Activity className="w-5 h-5" />
        </div>
        <h3 className="font-medium text-gray-900">Activity</h3>
      </div>

      <div className="pl-9 space-y-6">
        {/* Comment Input */}
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 shrink-0">
            <User className="w-4 h-4" />
          </div>
          <div className="flex-1 space-y-2">
            <Textarea
              placeholder="Write a comment..."
              className="min-h-[80px] text-sm resize-y"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
            />
            {newComment.trim() && (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleAddComment}
                  disabled={isLoadingComments}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {isLoadingComments ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Save Comment
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Comment List */}
        <div className="space-y-6">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3 text-sm group">
              <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 uppercase border border-purple-200">
                {(comment.userName || 'S').charAt(0)}
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">
                    {comment.userName || 'Super Admin'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(comment.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="text-gray-800 leading-relaxed">{comment.text}</div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity pt-1">
                  <button
                    onClick={() => handleDeleteComment(comment.id)}
                    className="text-xs text-gray-500 hover:text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
