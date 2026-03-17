/**
 * CalloutExtension — Custom TipTap Node
 *
 * Renders callout blocks (Key Takeaway, Important, Note, Tip, Risk Warning)
 * as styled containers in the editor. The callout type is stored as an
 * attribute and rendered with the appropriate CSS class for the Phase 1
 * article renderer to pick up.
 *
 * @module publications/editor/CalloutExtension
 */

import { Node, mergeAttributes } from '@tiptap/core';

export type CalloutType = 'takeaway' | 'important' | 'note' | 'tip' | 'warning';

export interface CalloutOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (attrs?: { type?: CalloutType }) => ReturnType;
      toggleCallout: (attrs?: { type?: CalloutType }) => ReturnType;
      unsetCallout: () => ReturnType;
    };
  }
}

export const CALLOUT_CONFIG: Record<CalloutType, { label: string; prefix: string }> = {
  takeaway: { label: 'Key Takeaway', prefix: 'Key Takeaway:' },
  important: { label: 'Important', prefix: 'Important:' },
  note: { label: 'Note', prefix: 'Note:' },
  tip: { label: 'Tip', prefix: 'Tip:' },
  warning: { label: 'Risk Warning', prefix: 'Risk Warning:' },
};

export const CalloutExtension = Node.create<CalloutOptions>({
  name: 'callout',

  group: 'block',

  content: 'block+',

  defining: true,

  addAttributes() {
    return {
      type: {
        default: 'note',
        parseHTML: (element) => {
          if (element.classList.contains('article-callout-takeaway') || element.classList.contains('preview-callout-takeaway'))
            return 'takeaway';
          if (element.classList.contains('article-callout-important') || element.classList.contains('preview-callout-important'))
            return 'important';
          if (element.classList.contains('article-callout-tip') || element.classList.contains('preview-callout-tip'))
            return 'tip';
          if (element.classList.contains('article-callout-warning') || element.classList.contains('preview-callout-warning'))
            return 'warning';
          return 'note';
        },
        renderHTML: (attributes) => {
          return {};
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div.article-callout',
      },
      {
        tag: 'div.preview-callout',
      },
      {
        tag: 'div.editor-callout',
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const calloutType = node.attrs.type as CalloutType;
    const baseClass = 'editor-callout';
    const typeClass = `editor-callout-${calloutType}`;
    // Also emit the article-callout class so the Phase 1 renderer recognises it
    const articleClass = `article-callout article-callout-${calloutType}`;

    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: `${baseClass} ${typeClass} ${articleClass}`,
        'data-callout-type': calloutType,
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setCallout:
        (attrs) =>
        ({ commands }) => {
          return commands.wrapIn(this.name, attrs);
        },
      toggleCallout:
        (attrs) =>
        ({ commands }) => {
          return commands.toggleWrap(this.name, attrs);
        },
      unsetCallout:
        () =>
        ({ commands }) => {
          return commands.lift(this.name);
        },
    };
  },
});
