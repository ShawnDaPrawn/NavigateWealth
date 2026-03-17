/**
 * SlashCommandMenu — Inline Command Palette for TipTap
 *
 * Appears when the user types "/" at the start of a new line.
 * Provides quick access to block types, callouts, images, and tables.
 * Supports keyboard navigation (arrow keys, Enter, Escape).
 *
 * @module publications/editor/SlashCommandMenu
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Image as ImageIcon,
  Table as TableIcon,
  Minus,
  Lightbulb,
  AlertTriangle,
  StickyNote,
  Sparkles,
  ShieldAlert,
  Pilcrow,
  Type,
  Wand2,
  Expand,
  Shrink,
  ArrowRight,
  SpellCheck,
} from 'lucide-react';
import { cn } from '../../../../ui/utils';
import type { CalloutType } from './CalloutExtension';

interface SlashMenuItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  action: (editor: Editor) => void;
}

const SLASH_ITEMS: SlashMenuItem[] = [
  // Text blocks
  {
    title: 'Paragraph',
    description: 'Plain text paragraph',
    icon: <Pilcrow className="h-4 w-4" />,
    category: 'Basic',
    action: (editor) => editor.chain().focus().setParagraph().run(),
  },
  {
    title: 'Heading 1',
    description: 'Large section heading',
    icon: <Heading1 className="h-4 w-4" />,
    category: 'Basic',
    action: (editor) =>
      editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: <Heading2 className="h-4 w-4" />,
    category: 'Basic',
    action: (editor) =>
      editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    title: 'Heading 3',
    description: 'Small section heading',
    icon: <Heading3 className="h-4 w-4" />,
    category: 'Basic',
    action: (editor) =>
      editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },

  // Lists
  {
    title: 'Bullet List',
    description: 'Unordered list of items',
    icon: <List className="h-4 w-4" />,
    category: 'Lists',
    action: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    title: 'Numbered List',
    description: 'Ordered list of items',
    icon: <ListOrdered className="h-4 w-4" />,
    category: 'Lists',
    action: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },

  // Rich blocks
  {
    title: 'Block Quote',
    description: 'Pull quote or citation',
    icon: <Quote className="h-4 w-4" />,
    category: 'Blocks',
    action: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    title: 'Code Block',
    description: 'Formatted code snippet',
    icon: <Code className="h-4 w-4" />,
    category: 'Blocks',
    action: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    title: 'Horizontal Rule',
    description: 'Visual section divider',
    icon: <Minus className="h-4 w-4" />,
    category: 'Blocks',
    action: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },
  {
    title: 'Table',
    description: '3×3 table with header row',
    icon: <TableIcon className="h-4 w-4" />,
    category: 'Blocks',
    action: (editor) =>
      editor
        .chain()
        .focus()
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run(),
  },
  {
    title: 'Image',
    description: 'Insert an image by URL',
    icon: <ImageIcon className="h-4 w-4" />,
    category: 'Blocks',
    action: (editor) => {
      // Dispatch custom event — the parent RichTextEditor listens for it
      window.dispatchEvent(new CustomEvent('tiptap:insert-image'));
    },
  },

  // Callouts
  {
    title: 'Key Takeaway',
    description: 'Highlight an important insight',
    icon: <Lightbulb className="h-4 w-4 text-green-600" />,
    category: 'Callouts',
    action: (editor) =>
      editor.chain().focus().toggleCallout({ type: 'takeaway' as CalloutType }).run(),
  },
  {
    title: 'Important',
    description: 'Draw attention to critical info',
    icon: <AlertTriangle className="h-4 w-4 text-amber-600" />,
    category: 'Callouts',
    action: (editor) =>
      editor.chain().focus().toggleCallout({ type: 'important' as CalloutType }).run(),
  },
  {
    title: 'Note',
    description: 'Add an informational note',
    icon: <StickyNote className="h-4 w-4 text-blue-600" />,
    category: 'Callouts',
    action: (editor) =>
      editor.chain().focus().toggleCallout({ type: 'note' as CalloutType }).run(),
  },
  {
    title: 'Tip',
    description: 'Share a helpful tip',
    icon: <Sparkles className="h-4 w-4 text-purple-600" />,
    category: 'Callouts',
    action: (editor) =>
      editor.chain().focus().toggleCallout({ type: 'tip' as CalloutType }).run(),
  },
  {
    title: 'Risk Warning',
    description: 'Compliance risk notice',
    icon: <ShieldAlert className="h-4 w-4 text-red-600" />,
    category: 'Callouts',
    action: (editor) =>
      editor.chain().focus().toggleCallout({ type: 'warning' as CalloutType }).run(),
  },

  // AI Writing Tools
  {
    title: 'AI Improve',
    description: 'Enhance selected text with AI',
    icon: <Wand2 className="h-4 w-4 text-purple-600" />,
    category: 'AI Writing',
    action: () => {
      window.dispatchEvent(new CustomEvent('tiptap:ai-action', { detail: { action: 'improve' } }));
    },
  },
  {
    title: 'AI Expand',
    description: 'Add more detail with AI',
    icon: <Expand className="h-4 w-4 text-purple-600" />,
    category: 'AI Writing',
    action: () => {
      window.dispatchEvent(new CustomEvent('tiptap:ai-action', { detail: { action: 'expand' } }));
    },
  },
  {
    title: 'AI Continue',
    description: 'AI writes the next paragraphs',
    icon: <ArrowRight className="h-4 w-4 text-purple-600" />,
    category: 'AI Writing',
    action: () => {
      window.dispatchEvent(new CustomEvent('tiptap:ai-action', { detail: { action: 'continue' } }));
    },
  },
  {
    title: 'AI Summarize',
    description: 'Condense text to key points',
    icon: <Shrink className="h-4 w-4 text-purple-600" />,
    category: 'AI Writing',
    action: () => {
      window.dispatchEvent(new CustomEvent('tiptap:ai-action', { detail: { action: 'summarize' } }));
    },
  },
  {
    title: 'AI Fix Grammar',
    description: 'Correct spelling and grammar',
    icon: <SpellCheck className="h-4 w-4 text-purple-600" />,
    category: 'AI Writing',
    action: () => {
      window.dispatchEvent(new CustomEvent('tiptap:ai-action', { detail: { action: 'fix_grammar' } }));
    },
  },
  {
    title: 'AI Assistant',
    description: 'Open the AI writing panel',
    icon: <Sparkles className="h-4 w-4 text-purple-600" />,
    category: 'AI Writing',
    action: () => {
      window.dispatchEvent(new CustomEvent('tiptap:open-ai-panel'));
    },
  },
];

interface SlashCommandMenuProps {
  editor: Editor;
  isOpen: boolean;
  onClose: () => void;
  query: string;
  position: { top: number; left: number };
}

export function SlashCommandMenu({
  editor,
  isOpen,
  onClose,
  query,
  position,
}: SlashCommandMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  // Filter items based on query
  const filteredItems = SLASH_ITEMS.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.description.toLowerCase().includes(query.toLowerCase()) ||
      item.category.toLowerCase().includes(query.toLowerCase())
  );

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredItems.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredItems.length - 1
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          selectItem(filteredItems[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, selectedIndex, filteredItems]);

  // Scroll selected item into view
  useEffect(() => {
    if (!menuRef.current) return;
    const selectedEl = menuRef.current.querySelector(
      `[data-index="${selectedIndex}"]`
    );
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const selectItem = useCallback(
    (item: SlashMenuItem) => {
      // Delete the slash command text before executing
      const { from, to } = editor.state.selection;
      const textBefore = editor.state.doc.textBetween(
        Math.max(0, from - query.length - 1),
        from,
        '\n'
      );
      const slashPos = textBefore.lastIndexOf('/');
      if (slashPos >= 0) {
        const deleteFrom = from - query.length - 1;
        editor
          .chain()
          .focus()
          .deleteRange({ from: Math.max(0, deleteFrom), to: from })
          .run();
      }

      item.action(editor);
      onClose();
    },
    [editor, query, onClose]
  );

  if (!isOpen || filteredItems.length === 0) return null;

  // Group by category
  const categories = [...new Set(filteredItems.map((i) => i.category))];

  return (
    <div
      ref={menuRef}
      className="fixed bg-white rounded-xl shadow-2xl border border-gray-200 py-2 w-72 max-h-80 overflow-y-auto z-[100] animate-in fade-in slide-in-from-top-2 duration-150"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      {categories.map((category) => {
        const categoryItems = filteredItems.filter(
          (i) => i.category === category
        );
        return (
          <div key={category}>
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
              {category}
            </div>
            {categoryItems.map((item) => {
              const globalIndex = filteredItems.indexOf(item);
              return (
                <button
                  key={item.title}
                  data-index={globalIndex}
                  onClick={() => selectItem(item)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
                    globalIndex === selectedIndex
                      ? 'bg-purple-50 text-purple-900'
                      : 'text-gray-700 hover:bg-gray-50'
                  )}
                >
                  <div
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                      globalIndex === selectedIndex
                        ? 'bg-purple-100'
                        : 'bg-gray-100'
                    )}
                  >
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {item.title}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {item.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        );
      })}

      <div className="px-3 py-1.5 mt-1 border-t border-gray-100">
        <span className="text-[10px] text-gray-400">
          ↑↓ navigate · Enter select · Esc close
        </span>
      </div>
    </div>
  );
}