/**
 * RichTextEditor — TipTap-based Block Editor (Phase 2)
 *
 * Replaces the deprecated document.execCommand / contentEditable editor
 * with a modern TipTap (ProseMirror) editor featuring:
 *
 *  - Full formatting toolbar with active-state feedback
 *  - Slash command menu (type "/" for quick block insertion)
 *  - Inline images (URL or upload)
 *  - Callout blocks (Key Takeaway, Important, Note, Tip, Risk Warning)
 *  - Tables (insert, add/remove rows & columns)
 *  - Text alignment
 *  - Keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+K, etc.)
 *  - Word count & character count
 *
 * Contract: same props interface as the previous editor so ArticleEditor
 * continues to work with zero changes:
 *   value: string (HTML)
 *   onChange: (value: string) => void
 *
 * @module publications/RichTextEditor
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { Link as LinkExtension } from '@tiptap/extension-link';
import { Image as ImageExtension } from '@tiptap/extension-image';
import { Table as TableExtension } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TextAlign } from '@tiptap/extension-text-align';
import { Placeholder } from '@tiptap/extension-placeholder';
import { cn } from '../../../ui/utils';

// Editor sub-components
import { EditorToolbar } from './editor/EditorToolbar';
import { SlashCommandMenu } from './editor/SlashCommandMenu';
import { ImageInsertDialog } from './editor/ImageInsertDialog';
import { CalloutExtension } from './editor/CalloutExtension';
import { AIWritingPanel } from './editor/AIWritingPanel';

// ---------------------------------------------------------------------------
// Props — identical to the previous editor for drop-in compatibility
// ---------------------------------------------------------------------------

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  preset?: 'full' | 'legal';
  enableAI?: boolean;
  enableSlashMenu?: boolean;
  /** Article metadata for AI context */
  articleTitle?: string;
  articleExcerpt?: string;
  articleCategory?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Start writing, or type "/" for commands…',
  minHeight = 'min-h-[500px]',
  preset = 'full',
  enableAI = true,
  enableSlashMenu = true,
  articleTitle,
  articleExcerpt,
  articleCategory,
}: RichTextEditorProps) {
  // Slash command state
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashPos, setSlashPos] = useState({ top: 0, left: 0 });

  // Image dialog
  const [showImageDialog, setShowImageDialog] = useState(false);

  // Word count
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);

  // AI Writing Panel
  const [showAIPanel, setShowAIPanel] = useState(false);

  // Track whether the editor was initialised with content
  const initialContentRef = useRef(value);
  const isExternalUpdateRef = useRef(false);

  // TipTap editor instance
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        blockquote: { HTMLAttributes: { class: 'article-pull-quote' } },
        codeBlock: {
          HTMLAttributes: {
            class: 'bg-gray-900 text-gray-100 rounded-xl p-4 font-mono text-sm',
          },
        },
        horizontalRule: {
          HTMLAttributes: { class: 'my-8 border-gray-200' },
        },
        // WORKAROUND: Disable link and underline from StarterKit to prevent
        // duplicate extension warnings — they are registered separately below
        // with custom configuration. The bundled StarterKit in this environment
        // includes both, unlike the standard @tiptap/starter-kit package.
        link: false,
        underline: false,
      }),
      Underline,
      LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-purple-600 underline hover:text-purple-700 cursor-pointer',
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
      ImageExtension.configure({
        HTMLAttributes: {
          class: 'rounded-xl shadow-lg my-6 max-w-full mx-auto',
        },
        allowBase64: false,
      }),
      TableExtension.configure({
        resizable: false,
        HTMLAttributes: { class: 'editor-table' },
      }),
      TableRow,
      TableCell.configure({
        HTMLAttributes: { class: 'editor-table-cell' },
      }),
      TableHeader.configure({
        HTMLAttributes: { class: 'editor-table-header' },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      CalloutExtension,
    ],
    content: value || '<p></p>',
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-lg max-w-none focus:outline-none px-6 py-5',
          minHeight,
          // Heading styles
          'prose-headings:font-bold prose-headings:text-gray-900 prose-headings:tracking-tight',
          'prose-h1:text-3xl prose-h1:mt-8 prose-h1:mb-4',
          'prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-gray-100',
          'prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-3',
          // Paragraphs
          'prose-p:text-gray-700 prose-p:leading-[1.85] prose-p:mb-4 prose-p:text-[16px]',
          // Links
          'prose-a:text-purple-600 prose-a:underline hover:prose-a:text-purple-700',
          // Marks
          'prose-strong:text-gray-900 prose-strong:font-semibold',
          'prose-em:italic',
          // Lists
          'prose-ul:my-4 prose-ol:my-4',
          'prose-li:text-gray-700 prose-li:my-1 prose-li:leading-relaxed',
          // Images
          'prose-img:rounded-xl prose-img:shadow-lg prose-img:my-6',
          // Code
          'prose-code:text-purple-600 prose-code:bg-purple-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-medium',
        ),
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (!isExternalUpdateRef.current) {
        const html = ed.getHTML();
        onChange(html);
      }

      // Update word & char count
      const text = ed.state.doc.textContent;
      setCharCount(text.length);
      setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);
    },
  });

  // Sync external value changes (e.g., form reset, load existing article)
  useEffect(() => {
    if (!editor) return;

    const currentHtml = editor.getHTML();
    // Only update if the external value truly differs from what the editor has
    if (value !== currentHtml && value !== initialContentRef.current) {
      isExternalUpdateRef.current = true;
      editor.commands.setContent(value || '<p></p>', false);
      initialContentRef.current = value;
      setTimeout(() => {
        isExternalUpdateRef.current = false;
      }, 0);
    }
  }, [value, editor]);

  // Slash command detection
  useEffect(() => {
    if (!enableSlashMenu) {
      setSlashOpen(false);
      setSlashQuery('');
      return;
    }

    if (!editor) return;

    const handleTransaction = () => {
      const { state } = editor;
      const { from } = state.selection;

      // Get the text from the start of the current block to the cursor
      const $from = state.doc.resolve(from);
      const textBefore = $from.parent.textBetween(
        0,
        $from.parentOffset,
        undefined,
        '\ufffc'
      );

      const slashMatch = textBefore.match(/\/([a-zA-Z0-9 ]*)$/);

      if (slashMatch) {
        // Get cursor position for the menu
        const coords = editor.view.coordsAtPos(from);
        setSlashPos({
          top: coords.bottom + 8,
          left: coords.left,
        });
        setSlashQuery(slashMatch[1] || '');
        setSlashOpen(true);
      } else {
        setSlashOpen(false);
        setSlashQuery('');
      }
    };

    editor.on('transaction', handleTransaction);
    return () => {
      editor.off('transaction', handleTransaction);
    };
  }, [editor, enableSlashMenu]);

  // Listen for custom image insert event from slash menu
  useEffect(() => {
    const handler = () => setShowImageDialog(true);
    window.addEventListener('tiptap:insert-image', handler);
    return () => window.removeEventListener('tiptap:insert-image', handler);
  }, []);

  // Listen for AI slash command events
  useEffect(() => {
    const handleAIAction = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.action) {
        setShowAIPanel(true);
        // Dispatch after panel opens so the panel can pick it up
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent('tiptap:ai-execute', { detail })
          );
        }, 100);
      }
    };

    const handleOpenAIPanel = () => setShowAIPanel(true);

    window.addEventListener('tiptap:ai-action', handleAIAction);
    window.addEventListener('tiptap:open-ai-panel', handleOpenAIPanel);
    return () => {
      window.removeEventListener('tiptap:ai-action', handleAIAction);
      window.removeEventListener('tiptap:open-ai-panel', handleOpenAIPanel);
    };
  }, []);

  // Image insertion callback
  const handleInsertImage = useCallback(
    (url: string, alt: string) => {
      if (!editor) return;
      editor.chain().focus().setImage({ src: url, alt }).run();
      setShowImageDialog(false);
    },
    [editor]
  );

  if (!editor) return null;

  return (
    <div className="space-y-0">
      {/* Toolbar */}
      <EditorToolbar
        editor={editor}
        onInsertImage={() => setShowImageDialog(true)}
        onToggleAI={enableAI ? () => setShowAIPanel(!showAIPanel) : undefined}
        isAIOpen={enableAI ? showAIPanel : false}
        preset={preset}
      />

      {/* Editor body + AI panel layout */}
      <div className="flex">
        {/* Main editor area */}
        <div className="flex-1 min-w-0">
          <div className={cn(
            'border border-gray-200 border-t-0 bg-white overflow-auto relative',
            enableAI && showAIPanel ? 'rounded-bl-xl' : 'rounded-b-xl'
          )}>
            <EditorContent editor={editor} />

            {/* Slash command menu */}
            {enableSlashMenu && (
              <SlashCommandMenu
                editor={editor}
                isOpen={slashOpen}
                onClose={() => setSlashOpen(false)}
                query={slashQuery}
                position={slashPos}
              />
            )}
          </div>
        </div>

        {/* AI Writing Panel */}
        {enableAI && showAIPanel && (
          <div className={cn(
            'border border-gray-200 border-t-0 border-l-0 rounded-br-xl overflow-hidden',
            'transition-all duration-200'
          )}>
            <AIWritingPanel
              editor={editor}
              isOpen={showAIPanel}
              onClose={() => setShowAIPanel(false)}
              articleTitle={articleTitle}
              articleExcerpt={articleExcerpt}
              articleCategory={articleCategory}
            />
          </div>
        )}
      </div>

      {/* Footer — word count & help */}
      <div className="flex items-center justify-between text-xs text-gray-500 px-1 pt-2">
        <div className="flex items-center gap-4">
          <span>{wordCount.toLocaleString()} words</span>
          <span>{charCount.toLocaleString()} characters</span>
          {wordCount > 0 && (
            <span className="text-gray-400">
              ~{Math.max(1, Math.ceil(wordCount / 200))} min read
            </span>
          )}
        </div>
        {enableSlashMenu ? (
          <div className="text-gray-400">
            Type <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-mono">/</kbd> for commands
          </div>
        ) : <div />}
      </div>

      {/* Image insert dialog */}
      <ImageInsertDialog
        isOpen={showImageDialog}
        onClose={() => setShowImageDialog(false)}
        onInsert={handleInsertImage}
      />

      {/* Editor styles */}
      <style>{`
        /* Placeholder */
        .is-editor-empty::before {
          content: attr(data-placeholder);
          float: left;
          color: #9ca3af;
          pointer-events: none;
          height: 0;
          font-style: italic;
        }

        /* TipTap prose overrides */
        .ProseMirror {
          outline: none;
          min-height: inherit;
        }

        .ProseMirror > *:first-child {
          margin-top: 0;
        }

        /* Blockquote / pull quote styling */
        .ProseMirror blockquote {
          position: relative;
          margin: 2rem 0;
          padding: 1.5rem 1.5rem 1.5rem 2rem;
          border-left: 4px solid rgb(139, 92, 246);
          background: linear-gradient(135deg, rgb(245, 243, 255) 0%, rgb(238, 242, 255) 100%);
          border-radius: 0 0.75rem 0.75rem 0;
          font-style: italic;
          color: rgb(55, 48, 163);
        }

        .ProseMirror blockquote::before {
          content: '"';
          position: absolute;
          top: -0.25rem;
          left: 0.5rem;
          font-size: 3rem;
          font-weight: 700;
          color: rgb(196, 181, 253);
          font-family: Georgia, 'Times New Roman', serif;
          line-height: 1;
        }

        /* Callout blocks */
        .ProseMirror .editor-callout {
          margin: 1.5rem 0;
          padding: 1rem 1.25rem;
          border-radius: 0.75rem;
          font-style: normal;
          position: relative;
        }

        .ProseMirror .editor-callout p {
          margin-bottom: 0.25rem;
        }

        .ProseMirror .editor-callout-takeaway {
          background-color: rgb(240, 253, 244);
          border: 1px solid rgb(187, 247, 208);
          color: rgb(22, 101, 52);
        }
        .ProseMirror .editor-callout-takeaway::before {
          content: '💡 Key Takeaway';
          display: block;
          font-weight: 700;
          margin-bottom: 0.5rem;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          opacity: 0.8;
        }

        .ProseMirror .editor-callout-important {
          background-color: rgb(255, 251, 235);
          border: 1px solid rgb(253, 224, 71);
          color: rgb(113, 63, 18);
        }
        .ProseMirror .editor-callout-important::before {
          content: '⚠️ Important';
          display: block;
          font-weight: 700;
          margin-bottom: 0.5rem;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          opacity: 0.8;
        }

        .ProseMirror .editor-callout-note {
          background-color: rgb(239, 246, 255);
          border: 1px solid rgb(191, 219, 254);
          color: rgb(30, 64, 175);
        }
        .ProseMirror .editor-callout-note::before {
          content: '📝 Note';
          display: block;
          font-weight: 700;
          margin-bottom: 0.5rem;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          opacity: 0.8;
        }

        .ProseMirror .editor-callout-tip {
          background-color: rgb(245, 243, 255);
          border: 1px solid rgb(221, 214, 254);
          color: rgb(76, 29, 149);
        }
        .ProseMirror .editor-callout-tip::before {
          content: '✨ Tip';
          display: block;
          font-weight: 700;
          margin-bottom: 0.5rem;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          opacity: 0.8;
        }

        .ProseMirror .editor-callout-warning {
          background-color: rgb(254, 242, 242);
          border: 1px solid rgb(254, 202, 202);
          color: rgb(153, 27, 27);
        }
        .ProseMirror .editor-callout-warning::before {
          content: '⚠️ Risk Warning';
          display: block;
          font-weight: 700;
          margin-bottom: 0.5rem;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          opacity: 0.8;
        }

        /* Table styles */
        .ProseMirror .editor-table {
          border-collapse: collapse;
          width: 100%;
          margin: 1.5rem 0;
          border-radius: 0.5rem;
          overflow: hidden;
          border: 1px solid rgb(229, 231, 235);
        }

        .ProseMirror .editor-table-header {
          background-color: rgb(249, 250, 251);
          font-weight: 600;
          text-align: left;
          padding: 0.75rem 1rem;
          border-bottom: 2px solid rgb(229, 231, 235);
          border-right: 1px solid rgb(229, 231, 235);
          font-size: 0.875rem;
          color: rgb(55, 65, 81);
        }

        .ProseMirror .editor-table-cell {
          padding: 0.75rem 1rem;
          border-bottom: 1px solid rgb(243, 244, 246);
          border-right: 1px solid rgb(243, 244, 246);
          font-size: 0.875rem;
          color: rgb(55, 65, 81);
          vertical-align: top;
        }

        .ProseMirror .editor-table-header:last-child,
        .ProseMirror .editor-table-cell:last-child {
          border-right: none;
        }

        /* Selected cell styling */
        .ProseMirror .selectedCell {
          background-color: rgb(245, 243, 255) !important;
          outline: 2px solid rgb(139, 92, 246);
          outline-offset: -2px;
        }

        /* Image styling in editor */
        .ProseMirror img {
          max-width: 100%;
          height: auto;
          border-radius: 0.75rem;
          margin: 1.5rem auto;
          display: block;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .ProseMirror img.ProseMirror-selectednode {
          outline: 3px solid rgb(139, 92, 246);
          outline-offset: 3px;
          border-radius: 0.75rem;
        }

        /* Horizontal rule */
        .ProseMirror hr {
          border: none;
          border-top: 2px solid rgb(229, 231, 235);
          margin: 2rem 0;
        }

        .ProseMirror hr.ProseMirror-selectednode {
          border-top-color: rgb(139, 92, 246);
        }

        /* Code block */
        .ProseMirror pre {
          background: rgb(17, 24, 39);
          color: rgb(243, 244, 246);
          padding: 1rem 1.25rem;
          border-radius: 0.75rem;
          font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
          font-size: 0.875rem;
          line-height: 1.7;
          overflow-x: auto;
          margin: 1.5rem 0;
        }

        .ProseMirror pre code {
          background: transparent;
          color: inherit;
          padding: 0;
          border-radius: 0;
          font-size: inherit;
        }

        /* Inline code */
        .ProseMirror code {
          background-color: rgb(243, 232, 255);
          color: rgb(147, 51, 234);
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
          font-size: 0.875rem;
          font-weight: 500;
        }

        /* List styling */
        .ProseMirror ul {
          list-style-type: disc;
          margin-left: 1.5rem;
          margin-top: 0.75rem;
          margin-bottom: 0.75rem;
        }

        .ProseMirror ol {
          list-style-type: decimal;
          margin-left: 1.5rem;
          margin-top: 0.75rem;
          margin-bottom: 0.75rem;
        }

        .ProseMirror li {
          margin: 0.25rem 0;
          color: rgb(55, 65, 81);
          line-height: 1.75;
        }

        .ProseMirror li p {
          margin-bottom: 0.25rem;
        }

        /* Heading styles */
        .ProseMirror h1 {
          font-size: 1.875rem;
          font-weight: 700;
          margin-top: 2rem;
          margin-bottom: 1rem;
          color: rgb(17, 24, 39);
          letter-spacing: -0.025em;
        }

        .ProseMirror h2 {
          font-size: 1.5rem;
          font-weight: 700;
          margin-top: 2rem;
          margin-bottom: 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid rgb(243, 244, 246);
          color: rgb(17, 24, 39);
          letter-spacing: -0.025em;
        }

        .ProseMirror h3 {
          font-size: 1.25rem;
          font-weight: 700;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          color: rgb(17, 24, 39);
        }

        /* Paragraph styling */
        .ProseMirror p {
          margin-bottom: 1rem;
          line-height: 1.85;
          color: rgb(55, 65, 81);
        }

        /* Link styling */
        .ProseMirror a {
          color: rgb(147, 51, 234);
          text-decoration: underline;
          cursor: pointer;
        }

        .ProseMirror a:hover {
          color: rgb(126, 34, 206);
        }

        /* Strong / em */
        .ProseMirror strong {
          font-weight: 600;
          color: rgb(17, 24, 39);
        }

        .ProseMirror em {
          font-style: italic;
        }

        /* Gapcursor */
        .ProseMirror .ProseMirror-gapcursor::after {
          border-top: 1px solid rgb(139, 92, 246);
        }
      `}</style>
    </div>
  );
}
