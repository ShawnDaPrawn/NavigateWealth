/**
 * EditorToolbar — TipTap Formatting Toolbar
 *
 * Reactive toolbar that reflects the editor's current state (active marks,
 * node types) and dispatches TipTap commands. Grouped into logical sections
 * with dividers and tooltips.
 *
 * @module publications/editor/EditorToolbar
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import { Button } from '../../../../ui/button';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Link as LinkIcon,
  Unlink,
  Quote,
  Code,
  Image as ImageIcon,
  Table as TableIcon,
  Minus,
  Undo2,
  Redo2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Lightbulb,
  AlertTriangle,
  StickyNote,
  Sparkles,
  ShieldAlert,
  RemoveFormatting,
  Pilcrow,
} from 'lucide-react';
import { cn } from '../../../../ui/utils';
import type { CalloutType } from './CalloutExtension';

interface EditorToolbarProps {
  editor: Editor;
  onInsertImage: () => void;
  onToggleAI?: () => void;
  isAIOpen?: boolean;
  preset?: 'full' | 'legal';
}

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({
  onClick,
  isActive = false,
  disabled = false,
  title,
  children,
}: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'h-8 w-8 p-0 rounded-md transition-colors',
        isActive && 'bg-purple-100 text-purple-700 hover:bg-purple-200',
        !isActive && 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      )}
    >
      {children}
    </Button>
  );
}

function Divider() {
  return <div className="w-px h-6 bg-gray-200 mx-0.5 flex-shrink-0" />;
}

// Callout submenu
function CalloutMenu({
  editor,
  onClose,
}: {
  editor: Editor;
  onClose: () => void;
}) {
  const items: { type: CalloutType; icon: React.ReactNode; label: string }[] = [
    { type: 'takeaway', icon: <Lightbulb className="h-4 w-4" />, label: 'Key Takeaway' },
    { type: 'important', icon: <AlertTriangle className="h-4 w-4" />, label: 'Important' },
    { type: 'note', icon: <StickyNote className="h-4 w-4" />, label: 'Note' },
    { type: 'tip', icon: <Sparkles className="h-4 w-4" />, label: 'Tip' },
    { type: 'warning', icon: <ShieldAlert className="h-4 w-4" />, label: 'Risk Warning' },
  ];

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1.5 w-48 z-50"
    >
      {items.map((item) => (
        <button
          key={item.type}
          onClick={() => {
            editor.chain().focus().toggleCallout({ type: item.type }).run();
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function EditorToolbar({ editor, onInsertImage, onToggleAI, isAIOpen, preset = 'full' }: EditorToolbarProps) {
  const [showCalloutMenu, setShowCalloutMenu] = useState(false);
  const showAdvancedBlocks = preset === 'full';

  const insertLink = useCallback(() => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('Enter URL:', previousUrl || 'https://');

    if (url === null) return; // cancelled
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: url, target: '_blank' })
      .run();
  }, [editor]);

  const insertTable = useCallback(() => {
    editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();
  }, [editor]);

  return (
    <div className="flex items-center gap-0.5 p-2 bg-gray-50/80 border border-gray-200 rounded-xl flex-wrap sticky top-0 z-10 backdrop-blur-sm">
      {/* Undo / Redo */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo (Ctrl+Z)"
      >
        <Undo2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo (Ctrl+Shift+Z)"
      >
        <Redo2 className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      {/* Block type */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setParagraph().run()}
        isActive={editor.isActive('paragraph')}
        title="Paragraph"
      >
        <Pilcrow className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive('heading', { level: 1 })}
        title="Heading 1"
      >
        <Heading1 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive('heading', { level: 2 })}
        title="Heading 2"
      >
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive('heading', { level: 3 })}
        title="Heading 3"
      >
        <Heading3 className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      {/* Inline formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        title="Bold (Ctrl+B)"
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title="Italic (Ctrl+I)"
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive('underline')}
        title="Underline (Ctrl+U)"
      >
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        title="Strikethrough"
      >
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        title="Bullet List"
      >
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        title="Numbered List"
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      {/* Insert elements */}
      <ToolbarButton
        onClick={insertLink}
        isActive={editor.isActive('link')}
        title="Insert Link (Ctrl+K)"
      >
        <LinkIcon className="h-4 w-4" />
      </ToolbarButton>
      {editor.isActive('link') && (
        <ToolbarButton
          onClick={() => editor.chain().focus().unsetLink().run()}
          title="Remove Link"
        >
          <Unlink className="h-4 w-4" />
        </ToolbarButton>
      )}
      {showAdvancedBlocks && (
        <ToolbarButton
          onClick={onInsertImage}
          title="Insert Image"
        >
          <ImageIcon className="h-4 w-4" />
        </ToolbarButton>
      )}
      {showAdvancedBlocks && (
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
          title="Block Quote"
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
      )}
      {showAdvancedBlocks && (
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          isActive={editor.isActive('codeBlock')}
          title="Code Block"
        >
          <Code className="h-4 w-4" />
        </ToolbarButton>
      )}
      {showAdvancedBlocks && (
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal Rule"
        >
          <Minus className="h-4 w-4" />
        </ToolbarButton>
      )}
      <ToolbarButton
        onClick={insertTable}
        isActive={editor.isActive('table')}
        title="Insert Table"
      >
        <TableIcon className="h-4 w-4" />
      </ToolbarButton>

      {showAdvancedBlocks && <Divider />}

      {/* Callout blocks */}
      {showAdvancedBlocks && (
        <div className="relative">
          <ToolbarButton
            onClick={() => setShowCalloutMenu(!showCalloutMenu)}
            isActive={editor.isActive('callout')}
            title="Insert Callout"
          >
            <Lightbulb className="h-4 w-4" />
          </ToolbarButton>
          {showCalloutMenu && (
            <CalloutMenu
              editor={editor}
              onClose={() => setShowCalloutMenu(false)}
            />
          )}
        </div>
      )}

      <Divider />

      {/* Text alignment */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        isActive={editor.isActive({ textAlign: 'left' })}
        title="Align Left"
      >
        <AlignLeft className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        isActive={editor.isActive({ textAlign: 'center' })}
        title="Align Center"
      >
        <AlignCenter className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        isActive={editor.isActive({ textAlign: 'right' })}
        title="Align Right"
      >
        <AlignRight className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      {/* Clear formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
        title="Clear Formatting"
      >
        <RemoveFormatting className="h-4 w-4" />
      </ToolbarButton>

      {/* AI Writing Tools */}
      {onToggleAI && (
        <div className="contents">
          <Divider />
          <ToolbarButton
            onClick={onToggleAI}
            isActive={isAIOpen}
            title="AI Writing Assistant"
          >
            <Sparkles className="h-4 w-4" />
          </ToolbarButton>
        </div>
      )}
    </div>
  );
}
