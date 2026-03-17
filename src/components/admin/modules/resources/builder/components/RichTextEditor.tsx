import React, { useRef, useCallback, useEffect, useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Link as LinkIcon,
  Unlink,
  Heading3,
  Heading4,
  Pilcrow,
  Braces,
} from 'lucide-react';
import { cn } from '../../../../../ui/utils';
import { Button } from '../../../../../ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../../../../ui/popover';
import { Input } from '../../../../../ui/input';
import { Label } from '../../../../../ui/label';
import { KeySelector } from './KeySelector';
import { toast } from 'sonner@2.0.3';

// ============================================================================
// RichTextEditor — lightweight WYSIWYG for the TextBlock editor panel.
//
// Uses contentEditable + execCommand for basic formatting. The content
// is stored as HTML, matching the existing TextData.content contract.
// ============================================================================

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

// -- Format state tracked by toolbar --
interface FormatState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  unorderedList: boolean;
  orderedList: boolean;
  alignLeft: boolean;
  alignCenter: boolean;
  alignRight: boolean;
  alignJustify: boolean;
  blockType: 'p' | 'h3' | 'h4';
  hasLink: boolean;
}

const DEFAULT_FORMAT: FormatState = {
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  unorderedList: false,
  orderedList: false,
  alignLeft: true,
  alignCenter: false,
  alignRight: false,
  alignJustify: false,
  blockType: 'p',
  hasLink: false,
};

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Start typing…',
  className,
  minHeight = '180px',
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [formatState, setFormatState] = useState<FormatState>(DEFAULT_FORMAT);
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const isInternalUpdate = useRef(false);
  const savedSelection = useRef<Range | null>(null);

  // -- Initialise editor content from value prop --
  useEffect(() => {
    if (editorRef.current && !isInternalUpdate.current) {
      // Only update DOM if external value differs from current editor content
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || '';
      }
    }
    isInternalUpdate.current = false;
  }, [value]);

  // -- Query active formatting at cursor position --
  const updateFormatState = useCallback(() => {
    try {
      const state: FormatState = {
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strikethrough: document.queryCommandState('strikeThrough'),
        unorderedList: document.queryCommandState('insertUnorderedList'),
        orderedList: document.queryCommandState('insertOrderedList'),
        alignLeft: document.queryCommandState('justifyLeft'),
        alignCenter: document.queryCommandState('justifyCenter'),
        alignRight: document.queryCommandState('justifyRight'),
        alignJustify: document.queryCommandState('justifyFull'),
        blockType: 'p',
        hasLink: false,
      };

      // Detect block type
      const blockTag = document.queryCommandValue('formatBlock')?.toLowerCase();
      if (blockTag === 'h3') state.blockType = 'h3';
      else if (blockTag === 'h4') state.blockType = 'h4';

      // Detect link
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        let node: Node | null = sel.anchorNode;
        while (node && node !== editorRef.current) {
          if ((node as HTMLElement).tagName === 'A') {
            state.hasLink = true;
            break;
          }
          node = node.parentNode;
        }
      }

      setFormatState(state);
    } catch {
      // queryCommandState can throw in some edge cases
    }
  }, []);

  // -- Emit HTML changes --
  const handleInput = useCallback(() => {
    if (editorRef.current) {
      isInternalUpdate.current = true;
      onChange(editorRef.current.innerHTML);
    }
    updateFormatState();
  }, [onChange, updateFormatState]);

  // -- Execute formatting command --
  const exec = useCallback(
    (command: string, value?: string) => {
      editorRef.current?.focus();
      document.execCommand(command, false, value);
      handleInput();
    },
    [handleInput]
  );

  // -- Block format (paragraph / heading) --
  const setBlockFormat = useCallback(
    (tag: 'p' | 'h3' | 'h4') => {
      editorRef.current?.focus();
      document.execCommand('formatBlock', false, `<${tag}>`);
      handleInput();
    },
    [handleInput]
  );

  // -- Save/restore selection for popover interactions --
  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedSelection.current = sel.getRangeAt(0).cloneRange();
    }
  }, []);

  const restoreSelection = useCallback(() => {
    if (savedSelection.current) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(savedSelection.current);
    }
  }, []);

  // -- Insert link --
  const handleInsertLink = useCallback(() => {
    if (!linkUrl.trim()) return;
    restoreSelection();
    editorRef.current?.focus();
    const url = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`;
    document.execCommand('createLink', false, url);
    setLinkUrl('');
    setLinkPopoverOpen(false);
    handleInput();
  }, [linkUrl, restoreSelection, handleInput]);

  // -- Remove link --
  const handleUnlink = useCallback(() => {
    editorRef.current?.focus();
    document.execCommand('unlink');
    handleInput();
  }, [handleInput]);

  // -- Insert variable at cursor --
  const handleInsertVariable = useCallback(
    (key: string) => {
      editorRef.current?.focus();
      const variable = `{{${key}}}`;
      // Use insertHTML to place at cursor position
      document.execCommand('insertHTML', false, `<span class="variable-tag">${variable}</span>&nbsp;`);
      handleInput();
      toast.success(`Inserted ${variable}`);
    },
    [handleInput]
  );

  // -- Handle paste: strip complex formatting, keep basic HTML --
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const html = e.clipboardData.getData('text/html');
      const text = e.clipboardData.getData('text/plain');

      if (html) {
        // Strip complex formatting but keep basic tags
        const cleaned = sanitizePastedHtml(html);
        document.execCommand('insertHTML', false, cleaned);
      } else {
        document.execCommand('insertText', false, text);
      }
      handleInput();
    },
    [handleInput]
  );

  // -- Keyboard shortcuts inside editor --
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
        switch (e.key.toLowerCase()) {
          case 'b':
            e.preventDefault();
            exec('bold');
            break;
          case 'i':
            e.preventDefault();
            exec('italic');
            break;
          case 'u':
            e.preventDefault();
            exec('underline');
            break;
        }
      }
    },
    [exec]
  );

  const isEmpty = !value || value === '<br>' || value === '<p><br></p>' || value.replace(/<[^>]*>/g, '').trim() === '';

  // ---- TOOLBAR BUTTON ----
  const ToolbarBtn = ({
    active,
    onClick,
    title,
    children,
    disabled,
  }: {
    active?: boolean;
    onClick: () => void;
    title: string;
    children: React.ReactNode;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()} // Prevent focus steal from editor
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'h-7 w-7 flex items-center justify-center rounded text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors',
        active && 'bg-purple-100 text-purple-700 hover:bg-purple-200 hover:text-purple-800',
        disabled && 'opacity-40 cursor-not-allowed hover:bg-transparent'
      )}
    >
      {children}
    </button>
  );

  const Separator = () => <div className="w-px h-5 bg-gray-200 mx-0.5" />;

  return (
    <div className={cn('border border-gray-200 rounded-md overflow-hidden bg-white', className)}>
      {/* TOOLBAR */}
      <div className="flex items-center gap-0.5 px-1.5 py-1 border-b border-gray-200 bg-gray-50 flex-wrap">
        {/* Block type */}
        <ToolbarBtn
          active={formatState.blockType === 'p'}
          onClick={() => setBlockFormat('p')}
          title="Paragraph"
        >
          <Pilcrow className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          active={formatState.blockType === 'h3'}
          onClick={() => setBlockFormat('h3')}
          title="Heading 3"
        >
          <Heading3 className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          active={formatState.blockType === 'h4'}
          onClick={() => setBlockFormat('h4')}
          title="Heading 4"
        >
          <Heading4 className="h-3.5 w-3.5" />
        </ToolbarBtn>

        <Separator />

        {/* Inline formatting */}
        <ToolbarBtn active={formatState.bold} onClick={() => exec('bold')} title="Bold (Ctrl+B)">
          <Bold className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          active={formatState.italic}
          onClick={() => exec('italic')}
          title="Italic (Ctrl+I)"
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          active={formatState.underline}
          onClick={() => exec('underline')}
          title="Underline (Ctrl+U)"
        >
          <Underline className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          active={formatState.strikethrough}
          onClick={() => exec('strikeThrough')}
          title="Strikethrough"
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolbarBtn>

        <Separator />

        {/* Lists */}
        <ToolbarBtn
          active={formatState.unorderedList}
          onClick={() => exec('insertUnorderedList')}
          title="Bullet List"
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          active={formatState.orderedList}
          onClick={() => exec('insertOrderedList')}
          title="Numbered List"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarBtn>

        <Separator />

        {/* Alignment */}
        <ToolbarBtn
          active={formatState.alignLeft}
          onClick={() => exec('justifyLeft')}
          title="Align Left"
        >
          <AlignLeft className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          active={formatState.alignCenter}
          onClick={() => exec('justifyCenter')}
          title="Align Center"
        >
          <AlignCenter className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          active={formatState.alignRight}
          onClick={() => exec('justifyRight')}
          title="Align Right"
        >
          <AlignRight className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          active={formatState.alignJustify}
          onClick={() => exec('justifyFull')}
          title="Justify"
        >
          <AlignJustify className="h-3.5 w-3.5" />
        </ToolbarBtn>

        <Separator />

        {/* Link */}
        {formatState.hasLink ? (
          <ToolbarBtn active={false} onClick={handleUnlink} title="Remove Link">
            <Unlink className="h-3.5 w-3.5" />
          </ToolbarBtn>
        ) : (
          <Popover open={linkPopoverOpen} onOpenChange={(open) => {
            if (open) saveSelection();
            setLinkPopoverOpen(open);
          }}>
            <PopoverTrigger asChild>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                title="Insert Link"
                className="h-7 w-7 flex items-center justify-center rounded text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              >
                <LinkIcon className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3" align="start">
              <div className="space-y-2">
                <Label className="text-xs font-medium">URL</Label>
                <div className="flex gap-2">
                  <Input
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="h-8 text-xs flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleInsertLink();
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    className="h-8 text-xs px-3"
                    onClick={handleInsertLink}
                    disabled={!linkUrl.trim()}
                  >
                    Insert
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Variable insert */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                saveSelection();
              }}
              title="Insert Variable"
              className="h-7 w-7 flex items-center justify-center rounded text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              <Braces className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3" align="start">
            <div className="space-y-2">
              <Label className="text-xs font-medium">Insert Data Variable</Label>
              <KeySelector
                value=""
                onChange={(key) => {
                  restoreSelection();
                  handleInsertVariable(key);
                }}
                placeholder="Select variable..."
                className="w-full h-8 text-xs"
              />
              <p className="text-[10px] text-gray-400">
                Inserts a {'{{variable}}'} placeholder that resolves to client data.
              </p>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* EDITOR SURFACE */}
      <div className="relative">
        {isEmpty && (
          <div className="absolute top-0 left-0 right-0 px-3 py-2 pointer-events-none text-xs text-gray-400 italic select-none">
            {placeholder}
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className={cn(
            'px-3 py-2 text-xs leading-relaxed outline-none',
            'prose prose-sm max-w-none',
            // Override prose defaults for our compact editor
            '[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1',
            '[&_h4]:text-xs [&_h4]:font-semibold [&_h4]:mt-2 [&_h4]:mb-1',
            '[&_p]:my-1 [&_p]:text-xs [&_p]:leading-relaxed',
            '[&_ul]:my-1 [&_ul]:pl-5 [&_ul]:text-xs',
            '[&_ol]:my-1 [&_ol]:pl-5 [&_ol]:text-xs',
            '[&_li]:my-0.5',
            '[&_a]:text-purple-600 [&_a]:underline',
            '[&_.variable-tag]:bg-purple-100 [&_.variable-tag]:text-purple-700 [&_.variable-tag]:px-1 [&_.variable-tag]:py-0.5 [&_.variable-tag]:rounded [&_.variable-tag]:text-[10px] [&_.variable-tag]:font-mono [&_.variable-tag]:whitespace-nowrap'
          )}
          style={{ minHeight }}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onMouseUp={updateFormatState}
          onKeyUp={updateFormatState}
          onFocus={updateFormatState}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Paste sanitiser — strips complex formatting, keeps basic structural HTML
// ============================================================================
function sanitizePastedHtml(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Tags we allow
  const allowedTags = new Set([
    'P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL',
    'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'UL', 'OL', 'LI',
    'A', 'SPAN', 'DIV',
    'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD',
  ]);

  // Allowed attributes
  const allowedAttrs: Record<string, string[]> = {
    A: ['href', 'target'],
    SPAN: ['class'],
  };

  function clean(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const el = node as HTMLElement;
    const tag = el.tagName;

    // Process children
    let childHtml = '';
    el.childNodes.forEach((child) => {
      childHtml += clean(child);
    });

    if (!allowedTags.has(tag)) {
      // Unwrap: return children without the disallowed tag
      return childHtml;
    }

    // Build allowed attributes
    const attrs = allowedAttrs[tag] || [];
    let attrStr = '';
    attrs.forEach((attr) => {
      const val = el.getAttribute(attr);
      if (val) {
        attrStr += ` ${attr}="${val.replace(/"/g, '&quot;')}"`;
      }
    });

    // Self-closing tags
    if (tag === 'BR') return '<br />';

    return `<${tag.toLowerCase()}${attrStr}>${childHtml}</${tag.toLowerCase()}>`;
  }

  let result = '';
  doc.body.childNodes.forEach((child) => {
    result += clean(child);
  });

  return result;
}