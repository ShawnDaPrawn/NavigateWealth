/**
 * The attachments section of the task form modal: upload control and the
 * attachment list. JSX moved verbatim from TaskFormModal.tsx; every
 * captured name became a prop.
 */
import React from 'react';
import { File as FileIcon, Loader2, Paperclip, Plus } from 'lucide-react';
import type { Attachment } from './taskFormModalModel';

interface TaskAttachmentsSectionProps {
  attachments: Attachment[];
  isUploading: boolean;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleDeleteAttachment: (attachmentId: string) => Promise<void>;
}

export function TaskAttachmentsSection({
  attachments,
  isUploading,
  handleFileUpload,
  handleDeleteAttachment,
}: TaskAttachmentsSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-gray-500">
            <Paperclip className="w-5 h-5" />
          </div>
          <h3 className="font-medium text-gray-900">Attachments</h3>
        </div>
        <div>
          <input
            type="file"
            id="file-upload"
            className="hidden"
            onChange={handleFileUpload}
            disabled={isUploading}
          />
          <label
            htmlFor="file-upload"
            className={`text-xs font-medium flex items-center gap-2 cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-900 px-3 py-1.5 rounded-md transition-colors ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
          >
            {isUploading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
            Add
          </label>
        </div>
      </div>

      <div className="pl-9 space-y-3">
        {attachments.map((att) => (
          <div
            key={att.id}
            className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors group"
          >
            <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center shrink-0">
              <FileIcon className="h-5 w-5 text-gray-500" />
            </div>
            <div className="flex-1 min-w-0">
              <a
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-sm text-gray-900 hover:underline truncate block"
              >
                {att.name}
              </a>
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                <span>{new Date(att.uploadedAt).toLocaleDateString()}</span>
                <span>•</span>
                <span>{(att.size / 1024).toFixed(1)} KB</span>
                <span>•</span>
                <button
                  onClick={() => handleDeleteAttachment(att.id)}
                  className="text-gray-500 hover:text-red-600 underline"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
        {attachments.length === 0 && (
          <div className="text-sm text-gray-500 italic">No attachments</div>
        )}
      </div>
    </div>
  );
}
